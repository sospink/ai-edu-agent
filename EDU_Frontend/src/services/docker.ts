import { api } from './api';

export interface DockerInfo {
  serverVersion: string;
  containers: number;
  containersRunning: number;
  containersPaused: number;
  containersStopped: number;
  images: number;
  driver: string;
  memoryTotal: number;
  cpus: number;
  operatingSystem: string;
  architecture: string;
  kernelVersion: string;
  name: string;
}

export interface ContainerPort {
  privatePort: number;
  publicPort?: number;
  type: string;
  ip?: string;
}

export interface Container {
  id: string;
  fullId: string;
  names: string[];
  image: string;
  imageId: string;
  command: string;
  created: number;
  state: string;
  status: string;
  ports: ContainerPort[];
}

export interface ContainerDetail {
  id: string;
  fullId: string;
  name: string;
  image: string;
  created: string;
  state: {
    status: string;
    running: boolean;
    paused: boolean;
    startedAt: string;
    finishedAt: string;
  };
  config: {
    hostname: string;
    env: string[];
    cmd: string[];
    workingDir: string;
    exposedPorts: Record<string, object>;
  };
  networkSettings: {
    ipAddress: string;
    ports: Record<string, Array<{ HostIp: string; HostPort: string }> | null>;
  };
  mounts: Array<{
    type: string;
    source: string;
    destination: string;
    mode: string;
    rw: boolean;
  }>;
}

export interface ContainerStats {
  cpu: {
    percent: string;
    cores: number;
  };
  memory: {
    usage: number;
    limit: number;
    percent: string;
  };
  network: Record<string, { rx_bytes: number; tx_bytes: number }>;
  blockIO: object;
}

export interface DockerImage {
  id: string;
  fullId: string;
  repoTags: string[];
  created: number;
  size: number;
  virtualSize: number;
}

// Docker 服务
export const dockerService = {
  // 获取 Docker 系统信息
  getInfo: () => api.get<DockerInfo>('/docker/info'),

  // 容器管理
  listContainers: (all = true) => api.get<Container[]>(`/docker/containers?all=${all}`),
  inspectContainer: (id: string) => api.get<ContainerDetail>(`/docker/containers/${id}`),
  getContainerLogs: (id: string, tail = 100) => api.get<{ logs: string[] }>(`/docker/containers/${id}/logs?tail=${tail}`),
  getContainerStats: (id: string) => api.get<ContainerStats>(`/docker/containers/${id}/stats`),
  startContainer: (id: string) => api.post<{ message: string }>(`/docker/containers/${id}/start`),
  stopContainer: (id: string) => api.post<{ message: string }>(`/docker/containers/${id}/stop`),
  restartContainer: (id: string) => api.post<{ message: string }>(`/docker/containers/${id}/restart`),
  removeContainer: (id: string, force = false) => api.delete<{ message: string }>(`/docker/containers/${id}?force=${force}`),

  // 镜像管理
  listImages: () => api.get<DockerImage[]>('/docker/images'),
  removeImage: (id: string, force = false) => api.delete<{ message: string }>(`/docker/images/${id}?force=${force}`),
};
