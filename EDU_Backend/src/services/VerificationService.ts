import { docker } from '../utils/docker';
import { Verification } from '../models/AgentStep';

export interface VerifyResult {
  success: boolean;
  message: string;
  details?: string;
}

// 在容器中执行命令
async function execInContainer(containerId: string, command: string): Promise<{ output: string; exitCode: number }> {
  try {
    const container = docker.getContainer(containerId);
    
    const exec = await container.exec({
      Cmd: ['/bin/bash', '-c', command],
      AttachStdout: true,
      AttachStderr: true,
    });

    const stream = await exec.start({ hijack: true, stdin: false });
    
    return new Promise((resolve, reject) => {
      let output = '';
      
      stream.on('data', (chunk: Buffer) => {
        // Docker stream 前8字节是头信息，跳过
        const data = chunk.slice(8).toString('utf-8');
        output += data;
      });

      stream.on('end', async () => {
        try {
          const inspect = await exec.inspect();
          resolve({ output: output.trim(), exitCode: inspect.ExitCode || 0 });
        } catch {
          resolve({ output: output.trim(), exitCode: 0 });
        }
      });

      stream.on('error', reject);
    });
  } catch (error: any) {
    throw new Error(`容器命令执行失败: ${error.message}`);
  }
}

// 验证文件是否存在
async function verifyFileExists(containerId: string, path: string): Promise<VerifyResult> {
  const { exitCode } = await execInContainer(containerId, `test -e "${path}"`);
  
  if (exitCode === 0) {
    return { success: true, message: '文件已创建' };
  }
  return { success: false, message: `文件 ${path} 不存在`, details: '请按照步骤创建所需文件' };
}

// 验证命令输出
async function verifyCommandOutput(
  containerId: string,
  command: string,
  expect: string,
  value?: string
): Promise<VerifyResult> {
  const { output, exitCode } = await execInContainer(containerId, command);

  // 命令执行失败
  if (exitCode !== 0) {
    return { success: false, message: '命令执行失败', details: output || '请检查命令是否正确' };
  }

  switch (expect) {
    case 'not_empty':
      if (output.length > 0) {
        return { success: true, message: '验证通过' };
      }
      return { success: false, message: '命令输出为空', details: '请确保命令有正确输出' };

    case 'contains':
      if (value && output.includes(value)) {
        return { success: true, message: '验证通过' };
      }
      return { success: false, message: `输出中未包含 "${value}"`, details: `实际输出: ${output.slice(0, 200)}` };

    case 'equals':
      if (output === value) {
        return { success: true, message: '验证通过' };
      }
      return { success: false, message: '输出不匹配', details: `期望: ${value}\n实际: ${output.slice(0, 200)}` };

    case 'regex':
      if (value && new RegExp(value).test(output)) {
        return { success: true, message: '验证通过' };
      }
      return { success: false, message: '输出不匹配正则表达式', details: `实际输出: ${output.slice(0, 200)}` };

    default:
      return { success: true, message: '验证通过' };
  }
}

// 验证服务是否运行
async function verifyServiceRunning(containerId: string, port: number): Promise<VerifyResult> {
  const { exitCode } = await execInContainer(containerId, `netstat -tlnp 2>/dev/null | grep -q ":${port} " || ss -tlnp | grep -q ":${port} "`);
  
  if (exitCode === 0) {
    return { success: true, message: `服务已在端口 ${port} 运行` };
  }
  return { success: false, message: `端口 ${port} 上没有服务运行`, details: '请启动相应的服务' };
}

// 执行自定义脚本验证
async function verifyCustomScript(containerId: string, script: string): Promise<VerifyResult> {
  const { output, exitCode } = await execInContainer(containerId, script);
  
  if (exitCode === 0) {
    return { success: true, message: output || '验证通过' };
  }
  return { success: false, message: '自定义验证失败', details: output };
}

// 主验证函数
export async function verify(containerId: string, verification: Verification): Promise<VerifyResult> {
  try {
    switch (verification.type) {
      case 'file_exists':
        if (!verification.path) {
          return { success: false, message: '验证配置错误：缺少文件路径' };
        }
        return await verifyFileExists(containerId, verification.path);

      case 'command_output':
        if (!verification.command) {
          return { success: false, message: '验证配置错误：缺少命令' };
        }
        return await verifyCommandOutput(
          containerId,
          verification.command,
          verification.expect || 'not_empty',
          verification.value
        );

      case 'service_running':
        if (!verification.port) {
          return { success: false, message: '验证配置错误：缺少端口号' };
        }
        return await verifyServiceRunning(containerId, verification.port);

      case 'custom':
        if (!verification.script) {
          return { success: false, message: '验证配置错误：缺少脚本' };
        }
        return await verifyCustomScript(containerId, verification.script);

      default:
        return { success: true, message: '无需验证' };
    }
  } catch (error: any) {
    console.error('[VerificationService] Error:', error);
    return { success: false, message: '验证执行失败', details: error.message };
  }
}
