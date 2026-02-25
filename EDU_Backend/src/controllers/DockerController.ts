import { Request, Response } from 'express';
import { docker } from '../utils/docker';
import { sendSuccess, sendError } from '../utils/response';

export class DockerController {
  // 获取 Docker 系统信息
  async getInfo(_req: Request, res: Response) {
    try {
      const info = await docker.info();
      return sendSuccess(res, {
        serverVersion: info.ServerVersion,
        containers: info.Containers,
        containersRunning: info.ContainersRunning,
        containersPaused: info.ContainersPaused,
        containersStopped: info.ContainersStopped,
        images: info.Images,
        driver: info.Driver,
        memoryTotal: info.MemTotal,
        cpus: info.NCPU,
        operatingSystem: info.OperatingSystem,
        architecture: info.Architecture,
        kernelVersion: info.KernelVersion,
        name: info.Name,
      });
    } catch (err: any) {
      return sendError(res, 'Failed to get Docker info: ' + err.message, 500);
    }
  }

  // 获取容器列表
  async listContainers(req: Request, res: Response) {
    try {
      const { all = 'true' } = req.query;
      const containers = await docker.listContainers({ all: all === 'true' });
      
      const result = containers.map(c => ({
        id: c.Id.substring(0, 12),
        fullId: c.Id,
        names: c.Names.map(n => n.replace(/^\//, '')),
        image: c.Image,
        imageId: c.ImageID?.substring(7, 19),
        command: c.Command,
        created: c.Created,
        state: c.State,
        status: c.Status,
        ports: c.Ports.map(p => ({
          privatePort: p.PrivatePort,
          publicPort: p.PublicPort,
          type: p.Type,
          ip: p.IP,
        })),
      }));
      
      return sendSuccess(res, result);
    } catch (err: any) {
      return sendError(res, 'Failed to list containers: ' + err.message, 500);
    }
  }

  // 获取镜像列表
  async listImages(_req: Request, res: Response) {
    try {
      const images = await docker.listImages();
      
      const result = images.map(img => ({
        id: img.Id.substring(7, 19),
        fullId: img.Id,
        repoTags: img.RepoTags || ['<none>:<none>'],
        created: img.Created,
        size: img.Size,
        virtualSize: img.VirtualSize,
      }));
      
      return sendSuccess(res, result);
    } catch (err: any) {
      return sendError(res, 'Failed to list images: ' + err.message, 500);
    }
  }

  // 启动容器
  async startContainer(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const container = docker.getContainer(id);
      await container.start();
      return sendSuccess(res, { message: `Container ${id} started` });
    } catch (err: any) {
      return sendError(res, 'Failed to start container: ' + err.message, 500);
    }
  }

  // 停止容器
  async stopContainer(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const container = docker.getContainer(id);
      await container.stop();
      return sendSuccess(res, { message: `Container ${id} stopped` });
    } catch (err: any) {
      return sendError(res, 'Failed to stop container: ' + err.message, 500);
    }
  }

  // 重启容器
  async restartContainer(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const container = docker.getContainer(id);
      await container.restart();
      return sendSuccess(res, { message: `Container ${id} restarted` });
    } catch (err: any) {
      return sendError(res, 'Failed to restart container: ' + err.message, 500);
    }
  }

  // 删除容器
  async removeContainer(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { force = 'false' } = req.query;
      const container = docker.getContainer(id);
      await container.remove({ force: force === 'true' });
      return sendSuccess(res, { message: `Container ${id} removed` });
    } catch (err: any) {
      return sendError(res, 'Failed to remove container: ' + err.message, 500);
    }
  }

  // 获取容器详情
  async inspectContainer(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const container = docker.getContainer(id);
      const info = await container.inspect();
      
      return sendSuccess(res, {
        id: info.Id.substring(0, 12),
        fullId: info.Id,
        name: info.Name.replace(/^\//, ''),
        image: info.Config.Image,
        created: info.Created,
        state: {
          status: info.State.Status,
          running: info.State.Running,
          paused: info.State.Paused,
          startedAt: info.State.StartedAt,
          finishedAt: info.State.FinishedAt,
        },
        config: {
          hostname: info.Config.Hostname,
          env: info.Config.Env,
          cmd: info.Config.Cmd,
          workingDir: info.Config.WorkingDir,
          exposedPorts: info.Config.ExposedPorts,
        },
        networkSettings: {
          ipAddress: info.NetworkSettings.IPAddress,
          ports: info.NetworkSettings.Ports,
        },
        mounts: info.Mounts?.map(m => ({
          type: m.Type,
          source: m.Source,
          destination: m.Destination,
          mode: m.Mode,
          rw: m.RW,
        })),
      });
    } catch (err: any) {
      return sendError(res, 'Failed to inspect container: ' + err.message, 500);
    }
  }

  // 获取容器日志
  async getContainerLogs(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { tail = '100' } = req.query;
      const container = docker.getContainer(id);
      
      const logs = await container.logs({
        stdout: true,
        stderr: true,
        tail: parseInt(tail as string),
        timestamps: true,
      });
      
      // 处理日志流，移除 Docker 日志头部的 8 字节
      const logString = logs.toString('utf8');
      const lines = logString.split('\n').map(line => {
        // Docker 日志每行前 8 字节是头部信息
        if (line.length > 8) {
          return line.substring(8);
        }
        return line;
      }).filter(line => line.trim());
      
      return sendSuccess(res, { logs: lines });
    } catch (err: any) {
      return sendError(res, 'Failed to get container logs: ' + err.message, 500);
    }
  }

  // 获取容器统计信息
  async getContainerStats(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const container = docker.getContainer(id);
      
      const stats = await container.stats({ stream: false });
      
      // 计算 CPU 使用率
      const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
      const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
      const cpuPercent = systemDelta > 0 ? (cpuDelta / systemDelta) * stats.cpu_stats.online_cpus * 100 : 0;
      
      // 计算内存使用率
      const memUsage = stats.memory_stats.usage || 0;
      const memLimit = stats.memory_stats.limit || 1;
      const memPercent = (memUsage / memLimit) * 100;
      
      return sendSuccess(res, {
        cpu: {
          percent: cpuPercent.toFixed(2),
          cores: stats.cpu_stats.online_cpus,
        },
        memory: {
          usage: memUsage,
          limit: memLimit,
          percent: memPercent.toFixed(2),
        },
        network: stats.networks,
        blockIO: stats.blkio_stats,
      });
    } catch (err: any) {
      return sendError(res, 'Failed to get container stats: ' + err.message, 500);
    }
  }

  // 删除镜像
  async removeImage(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { force = 'false' } = req.query;
      const image = docker.getImage(id);
      await image.remove({ force: force === 'true' });
      return sendSuccess(res, { message: `Image ${id} removed` });
    } catch (err: any) {
      return sendError(res, 'Failed to remove image: ' + err.message, 500);
    }
  }
}

export default new DockerController();
