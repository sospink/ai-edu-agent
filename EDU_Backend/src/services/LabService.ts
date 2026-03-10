import crypto from 'crypto';
import { AppDataSource } from '../config/database';
import { UserLabSession, LabRuntimeMode, LabSessionStatus, LabSourceType } from '../models/UserLabSession';
import { Course } from '../models/Course';
import { Project } from '../models/Project';
import { docker } from '../utils/docker';

const labSessionRepo = AppDataSource.getRepository(UserLabSession);
const courseRepo = AppDataSource.getRepository(Course);
const projectRepo = AppDataSource.getRepository(Project);

// Docker 主机配置
const DOCKER_HOST_IP = process.env.DOCKER_HOST || '192.168.20.3';

// 端口分配起始值（每个用户会话分配独立端口）
// 参考 opencode-lab 镜像端口: 22(SSH), 5901(VNC), 6080(noVNC)
const NOVNC_PORT_START = 6080;  // noVNC 网页桌面起始端口
const IDE_PORT_START = 3000;    // WebIDE 起始端口
const SSH_PORT_START = 2222;    // SSH 起始端口
const GATEWAY_PORT_START = 18789; // OpenClaw Gateway 起始端口
const OPENCLAW_GATEWAY_CONTAINER_PORT = 18789;
const PROJECT_LAB_RUNTIME = (process.env.PROJECT_LAB_RUNTIME || 'openclaw').toLowerCase();

export class LabService {
  private static generateGatewayToken(): string {
    return `project-gw-${crypto.randomBytes(12).toString('hex')}`;
  }

  private static buildOpenClawEnv(gatewayToken: string): string[] {
    const modelId = process.env.OPENCLAW_MODEL_ID || process.env.QWEN_MODEL || 'glm-5';
    const baseUrl = process.env.OPENCLAW_BASE_URL || process.env.QWEN_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4';
    const apiKey = process.env.OPENCLAW_API_KEY || process.env.DASHSCOPE_API_KEY || '';
    const apiProtocol = process.env.OPENCLAW_API_PROTOCOL || 'openai-completions';
    const contextWindow = process.env.OPENCLAW_CONTEXT_WINDOW || '200000';
    const maxTokens = process.env.OPENCLAW_MAX_TOKENS || '65536';

    return [
      'CLASSROOM_MODE=true',
      'CLASSROOM_FRONTEND=terminal',
      'CLASSROOM_FORCE_IM_DISABLED=true',
      'DESKTOP_ENABLED=true',
      'DESKTOP_HTTP_PORT=6080',
      'DESKTOP_VNC_PORT=5901',
      'SSH_ENABLED=true',
      'SSH_PORT=22',
      'SSH_USERNAME=root',
      'SSH_PASSWORD=opencode',
      'OPENCLAW_GATEWAY_BIND=lan',
      `OPENCLAW_GATEWAY_PORT=${OPENCLAW_GATEWAY_CONTAINER_PORT}`,
      'OPENCLAW_GATEWAY_AUTH_MODE=token',
      `OPENCLAW_GATEWAY_TOKEN=${gatewayToken}`,
      'OPENCLAW_GATEWAY_DANGEROUSLY_ALLOW_HOST_HEADER_ORIGIN_FALLBACK=true',
      `MODEL_ID=${modelId}`,
      `BASE_URL=${baseUrl}`,
      `API_PROTOCOL=${apiProtocol}`,
      `CONTEXT_WINDOW=${contextWindow}`,
      `MAX_TOKENS=${maxTokens}`,
      `API_KEY=${apiKey}`,
    ];
  }

  private static async ensureImageExists(imageName: string): Promise<void> {
    try {
      await docker.getImage(imageName).inspect();
      return;
    } catch {
      console.log(`[LabService] 镜像不存在，开始拉取: ${imageName}`);
    }

    await new Promise<void>((resolve, reject) => {
      docker.pull(imageName, (err: Error | null, stream: NodeJS.ReadableStream) => {
        if (err || !stream) {
          reject(err || new Error(`拉取镜像失败: ${imageName}`));
          return;
        }

        docker.modem.followProgress(
          stream,
          (pullErr: Error | null) => {
            if (pullErr) {
              reject(pullErr);
              return;
            }
            resolve();
          }
        );
      });
    });
  }

  /**
   * 获取用户当前活跃的实验会话
   * 会自动检查容器是否真的存在，如果不存在则更新状态
   */
  static async getActiveSession(userId: number): Promise<UserLabSession | null> {
    const session = await labSessionRepo.findOne({
      where: {
        userId,
        status: LabSessionStatus.RUNNING,
      },
    });

    // 如果有活跃会话，检查容器是否真的存在
    if (session && session.containerId) {
      try {
        const container = docker.getContainer(session.containerId);
        await container.inspect();
      } catch {
        // 容器不存在，更新状态
        console.log(`[LabService] Container ${session.containerId} not found, marking session as stopped`);
        session.status = LabSessionStatus.STOPPED;
        await labSessionRepo.save(session);
        return null;
      }
    }

    return session;
  }

  /**
   * 获取用户所有会话
   */
  static async getUserSessions(userId: number): Promise<UserLabSession[]> {
    return labSessionRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * 创建实验环境
   * 每个实验环境同时包含: Ubuntu桌面(VNC)、WebIDE、SSH终端
   */
  static async createLabSession(
    userId: number,
    sourceType: LabSourceType,
    sourceId: number
  ): Promise<{ success: boolean; data?: UserLabSession; error?: string }> {
    // 检查是否已有运行中的会话
    const existingSession = await this.getActiveSession(userId);
    if (existingSession) {
      return {
        success: false,
        error: '您已有一个运行中的实验环境，请先关闭后再创建新环境',
      };
    }

    // 获取环境配置
    let envImage = '';
    let ideImage = '';
    let sourceName = '';
    const useOpenClawRuntime = sourceType === LabSourceType.PROJECT && PROJECT_LAB_RUNTIME === 'openclaw';

    if (sourceType === LabSourceType.COURSE) {
      const course = await courseRepo.findOne({ where: { id: sourceId } });
      if (!course) {
        return { success: false, error: '课程不存在' };
      }
      envImage = course.envImage;
      ideImage = course.ideImage || '';
      sourceName = course.title;
    } else {
      const project = await projectRepo.findOne({ where: { id: sourceId } });
      if (!project) {
        return { success: false, error: '项目不存在' };
      }
      envImage = project.envImage;
      // 项目改造为 OpenClaw 运行时后，不再调度独立 IDE 容器
      ideImage = useOpenClawRuntime ? '' : project.ideImage || '';
      sourceName = project.title;
    }

    if (!envImage) {
      return { success: false, error: '该课程/项目未配置实验环境镜像' };
    }

    // 分配端口
    const ports = await this.allocatePorts();
    const containerName = `lab-${userId}-${Date.now()}`;
    let ideContainerName = ideImage ? `ide-${userId}-${Date.now()}` : '';
    const gatewayToken = useOpenClawRuntime ? this.generateGatewayToken() : '';

    // 创建会话记录
    const session = labSessionRepo.create({
      userId,
      sourceType,
      sourceId,
      containerName,
      imageName: envImage,
      vncPort: ports.novnc,      // noVNC 网页桌面端口
      idePort: ideImage ? ports.ide : 0,  // WebIDE 端口
      sshPort: ports.ssh,
      runtimeMode: useOpenClawRuntime ? LabRuntimeMode.OPENCLAW : LabRuntimeMode.CLASSIC,
      gatewayPort: useOpenClawRuntime ? ports.gateway : 0,
      gatewayToken,
      status: LabSessionStatus.CREATING,
      expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2小时后过期
    });
    await labSessionRepo.save(session);

    try {
      await this.ensureImageExists(envImage);

      const containerEnv = [
        `USER_ID=${userId}`,
        `SOURCE_TYPE=${sourceType}`,
        `SOURCE_ID=${sourceId}`,
        `SOURCE_NAME=${sourceName}`,
        'VNC_RESOLUTION=1920x1080',
      ];
      if (useOpenClawRuntime) {
        containerEnv.push(...this.buildOpenClawEnv(gatewayToken));
      }

      const exposedPorts: Record<string, object> = {
        '6080/tcp': {},  // noVNC 网页桌面
        '22/tcp': {},    // SSH
      };
      const portBindings: Record<string, Array<{ HostPort: string }>> = {
        '6080/tcp': [{ HostPort: String(ports.novnc) }],
        '22/tcp': [{ HostPort: String(ports.ssh) }],
      };
      if (useOpenClawRuntime) {
        exposedPorts[`${OPENCLAW_GATEWAY_CONTAINER_PORT}/tcp`] = {};
        portBindings[`${OPENCLAW_GATEWAY_CONTAINER_PORT}/tcp`] = [{ HostPort: String(ports.gateway) }];
      }

      // 创建主容器 (Ubuntu Desktop)
      const container = await docker.createContainer({
        Image: envImage,
        name: containerName,
        Hostname: 'lab-env',
        Env: containerEnv,
        ExposedPorts: exposedPorts,
        HostConfig: {
          PortBindings: portBindings,
          Memory: 2 * 1024 * 1024 * 1024, // 2GB 内存限制
          NanoCpus: 2 * 1000000000,       // 2 CPU 核心
          RestartPolicy: { Name: 'unless-stopped' },
        },
      });

      // 启动主容器
      await container.start();
      session.containerId = container.id;

      // 如果配置了 WebIDE 镜像，创建 IDE 容器
      if (ideImage) {
        try {
          await this.ensureImageExists(ideImage);

          const ideContainer = await docker.createContainer({
            Image: ideImage,
            name: ideContainerName,
            Hostname: 'ide-env',
            Env: [
              `USER_ID=${userId}`,
              `SOURCE_NAME=${sourceName}`,
            ],
            ExposedPorts: {
              '3000/tcp': {},  // OpenVSCode Server 默认端口
            },
            HostConfig: {
              PortBindings: {
                '3000/tcp': [{ HostPort: String(ports.ide) }],
              },
              Memory: 1 * 1024 * 1024 * 1024, // 1GB 内存限制
              NanoCpus: 1 * 1000000000,       // 1 CPU 核心
              RestartPolicy: { Name: 'unless-stopped' },
            },
          });

          await ideContainer.start();
          // 存储 IDE 容器名到 session（可以用 errorMessage 字段临时存储，或者添加新字段）
          session.errorMessage = ideContainerName; // 临时用这个字段存储 IDE 容器名
        } catch (ideError) {
          console.error('创建 WebIDE 容器失败:', ideError);
          // IDE 容器创建失败不影响主容器
          ideImage = '';
          ideContainerName = '';
          session.idePort = 0;
          session.errorMessage = '';
        }
      }

      // 更新会话状态
      session.status = LabSessionStatus.RUNNING;
      await labSessionRepo.save(session);

      return { success: true, data: session };
    } catch (error: unknown) {
      // 更新会话状态为错误
      session.status = LabSessionStatus.ERROR;
      session.errorMessage = error instanceof Error ? error.message : '创建容器失败';
      await labSessionRepo.save(session);

      return { success: false, error: session.errorMessage };
    }
  }

  /**
   * 停止实验环境
   */
  static async stopLabSession(
    userId: number,
    sessionId: number
  ): Promise<{ success: boolean; error?: string }> {
    const session = await labSessionRepo.findOne({
      where: { id: sessionId, userId },
    });

    if (!session) {
      return { success: false, error: '会话不存在' };
    }

    if (session.status !== LabSessionStatus.RUNNING) {
      return { success: false, error: '会话未在运行中' };
    }

    // 停止主容器
    if (session.containerId) {
      try {
        const container = docker.getContainer(session.containerId);
        await container.stop();
        await container.remove();
      } catch (error: unknown) {
        // 容器可能已经不存在，忽略错误继续更新状态
        console.log('停止主容器时出错（可能已不存在）:', error instanceof Error ? error.message : error);
      }
    }

    // 停止 IDE 容器（如果存在）
    // errorMessage 字段临时存储了 IDE 容器名
    if (
      session.sourceType === LabSourceType.COURSE &&
      session.errorMessage &&
      session.errorMessage.startsWith('ide-')
    ) {
      try {
        const ideContainerName = session.errorMessage;
        const containers = await docker.listContainers({ all: true });
        const ideContainer = containers.find(c => c.Names.includes(`/${ideContainerName}`));
        if (ideContainer) {
          const container = docker.getContainer(ideContainer.Id);
          await container.stop();
          await container.remove();
        }
      } catch (ideError) {
        console.log('停止 IDE 容器时出错（可能已不存在）:', ideError);
      }
    }

    // 无论容器操作是否成功，都更新会话状态
    session.status = LabSessionStatus.STOPPED;
    session.errorMessage = ''; // 清除临时存储的 IDE 容器名
    await labSessionRepo.save(session);

    return { success: true };
  }

  /**
   * 获取实验环境访问 URL
   * 返回 noVNC网页桌面、WebIDE、SSH 三种访问方式
   */
  static getLabUrls(session: UserLabSession): {
    vncUrl: string;
    ideUrl: string;
    sshInfo: string;
    gatewayUrl: string;
    gatewayToken: string;
    runtimeMode: 'classic' | 'openclaw';
  } {
    const host = DOCKER_HOST_IP;
    const port = session.vncPort;
    const isOpenClaw = session.runtimeMode === LabRuntimeMode.OPENCLAW;
    
    return {
      // noVNC 网页桌面（推荐）
      // resize=remote: 自动调整远程桌面分辨率以匹配浏览器窗口（推荐，无黑边）
      // 必须包含 host, port, path 参数才能正确建立 WebSocket 连接
      vncUrl: `http://${host}:${port}/vnc.html?host=${host}&port=${port}&path=websockify&resize=remote&autoconnect=true`,
      // WebIDE URL（如果配置了 idePort）
      ideUrl: session.idePort > 0 ? `http://${host}:${session.idePort}` : '',
      // SSH 连接信息（密码: opencode）
      sshInfo: `root@${host} -p ${session.sshPort}`,
      gatewayUrl: isOpenClaw && session.gatewayPort > 0 ? `/api/lab/gateway/${session.id}/` : '',
      gatewayToken: isOpenClaw ? session.gatewayToken : '',
      runtimeMode: isOpenClaw ? 'openclaw' : 'classic',
    };
  }

  /**
   * 分配可用端口
   */
  private static async allocatePorts(): Promise<{
    novnc: number;
    ide: number;
    ssh: number;
    gateway: number;
  }> {
    // 获取已使用的端口
    const activeSessions = await labSessionRepo.find({
      where: { status: LabSessionStatus.RUNNING },
      select: ['vncPort', 'idePort', 'sshPort', 'gatewayPort'],
    });

    const usedNovncPorts = new Set(activeSessions.map((s) => s.vncPort));
    const usedIdePorts = new Set(activeSessions.map((s) => s.idePort));
    const usedSshPorts = new Set(activeSessions.map((s) => s.sshPort));
    const usedGatewayPorts = new Set(activeSessions.map((s) => s.gatewayPort).filter((port) => port > 0));

    // 找到可用端口
    let novncPort = NOVNC_PORT_START;
    while (usedNovncPorts.has(novncPort)) novncPort++;

    let idePort = IDE_PORT_START;
    while (usedIdePorts.has(idePort)) idePort++;

    let sshPort = SSH_PORT_START;
    while (usedSshPorts.has(sshPort)) sshPort++;

    let gatewayPort = GATEWAY_PORT_START;
    while (usedGatewayPorts.has(gatewayPort)) gatewayPort++;

    return { novnc: novncPort, ide: idePort, ssh: sshPort, gateway: gatewayPort };
  }

  /**
   * 检查会话状态 (同步容器状态)
   */
  static async syncSessionStatus(sessionId: number): Promise<void> {
    const session = await labSessionRepo.findOne({ where: { id: sessionId } });
    if (!session || !session.containerId) return;

    try {
      const container = docker.getContainer(session.containerId);
      const info = await container.inspect();

      if (!info.State.Running && session.status === LabSessionStatus.RUNNING) {
        session.status = LabSessionStatus.STOPPED;
        await labSessionRepo.save(session);
      }
    } catch {
      // 容器不存在
      if (session.status === LabSessionStatus.RUNNING) {
        session.status = LabSessionStatus.STOPPED;
        await labSessionRepo.save(session);
      }
    }
  }

  /**
   * 在容器中执行命令
   */
  static async executeCommand(
    containerId: string,
    command: string
  ): Promise<{ success: boolean; output: string; exitCode: number; error?: string }> {
    try {
      const container = docker.getContainer(containerId);
      
      // 创建 exec 实例
      const exec = await container.exec({
        Cmd: ['/bin/bash', '-c', command],
        AttachStdout: true,
        AttachStderr: true,
      });

      // 执行命令
      const stream = await exec.start({ hijack: true, stdin: false });
      
      // 收集输出
      return new Promise((resolve) => {
        let output = '';
        let errorOutput = '';
        
        stream.on('data', (chunk: Buffer) => {
          // Docker stream 格式: 前8字节是header，后面是数据
          // header[0]: stream type (1=stdout, 2=stderr)
          // header[4-7]: payload size (big endian)
          let offset = 0;
          while (offset < chunk.length) {
            if (offset + 8 > chunk.length) break;
            
            const streamType = chunk[offset];
            const size = chunk.readUInt32BE(offset + 4);
            offset += 8;
            
            if (offset + size > chunk.length) break;
            
            const data = chunk.slice(offset, offset + size).toString('utf-8');
            if (streamType === 1) {
              output += data;
            } else if (streamType === 2) {
              errorOutput += data;
            }
            offset += size;
          }
        });

        stream.on('end', async () => {
          try {
            const inspectResult = await exec.inspect();
            const exitCode = inspectResult.ExitCode || 0;
            
            resolve({
              success: exitCode === 0,
              output: output || errorOutput,
              exitCode,
              error: exitCode !== 0 ? errorOutput : undefined,
            });
          } catch {
            resolve({
              success: true,
              output: output || errorOutput,
              exitCode: 0,
            });
          }
        });

        stream.on('error', (err: Error) => {
          resolve({
            success: false,
            output: '',
            exitCode: 1,
            error: err.message,
          });
        });
      });
    } catch (error: unknown) {
      return {
        success: false,
        output: '',
        exitCode: 1,
        error: error instanceof Error ? error.message : '执行命令失败',
      };
    }
  }
}
