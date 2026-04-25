# K8S 开发测试接入说明

当前默认前提：K8S 单节点仅用于开发测试与功能验收。

## 当前远端开发集群

- 节点公网入口：`106.75.139.179`
- API Server：`https://106.75.139.179:6443`
- 节点主机名：`10-13-80-205`
- 节点角色：`control-plane`
- K8S 版本：`v1.30.14`
- 运行时：`containerd://2.2.1`
- 安装方式：`kubeadm`

说明：

- 该机器同时是 K8S 节点和 API Server 所在主机。
- 在本项目语境下，它只作为远端开发测试集群使用，不作为常规主机部署目标。
- `ubuntu` 用户默认没有可直接使用的 kubeconfig，需要通过 `sudo` 读取 `/etc/kubernetes/admin.conf`。
- 当前本地已准备的 kubeconfig 建议路径：`EDU_Backend_Go/.kube/remote-dev.yaml`

## 推荐约定

- 集群版本：1.30.x
- 业务命名空间：`edu-backend-go-dev`
- Lab 运行时命名空间：`edu-runtime-dev`
- Ingress Class：按当前集群实际安装填写，例如 `nginx`

## 本地开发方式

### 方式 1：使用本机 kubeconfig

```bash
export K8S_ENABLED=true
export K8S_IN_CLUSTER=false
export K8S_KUBECONFIG=/absolute/path/to/EDU_Backend_Go/.kube/remote-dev.yaml
export K8S_NAMESPACE=edu-backend-go-dev
export K8S_RUNTIME_NAMESPACE=edu-runtime-dev
```

建议做法：

- 从远端 `/etc/kubernetes/admin.conf` 提取 kubeconfig
- 将其中的 API Server 地址替换为 `https://106.75.139.179:6443`
- 保存为本地未纳管文件 `EDU_Backend_Go/.kube/remote-dev.yaml`
- 当前 `EDU_Backend_Go/configs/app.yaml` 已默认指向这份 kubeconfig

### 方式 2：在集群内运行

```bash
export K8S_ENABLED=true
export K8S_IN_CLUSTER=true
export K8S_NAMESPACE=edu-backend-go-dev
export K8S_RUNTIME_NAMESPACE=edu-runtime-dev
```

## Lab noVNC 访问边界

Classic Lab 的 noVNC / Web App 入口默认不做 NodePort / LoadBalancer / Ingress 暴露，学生浏览器只能访问平台后端提供的代理路径：

```text
/api/lab/proxy/:sessionId/:target/*
```

开发环境允许“本地 Go 后端 + 云端 K8S”：浏览器请求本地 `localhost:4000`，本地后端通过 kubeconfig 访问云端 K8S `ClusterIP` Service proxy，再把 noVNC 内容转发回来。云端 Pod 的 6080/8888 等端口不需要也不应该直接暴露到公网。

生产环境同样只暴露平台域名/API。Lab Pod / Service 应保持：

- Service 类型为 `ClusterIP`
- Pod 不启用 `hostNetwork`
- 容器端口不配置 `hostPort`
- 不为 Lab noVNC / Web App 创建 NodePort、LoadBalancer 或 Ingress

当前开发集群使用 flannel 时，K8S `NetworkPolicy` 资源可能不会被实际执行，因此不能把 NetworkPolicy 当作唯一防线。若从公网仍能访问 `nodeIP:6080`、`nodeIP:8888` 或其他 Lab 端口，优先排查云安全组、iptables、手动端口转发、旧 Docker/noVNC 进程，而不是 `ClusterIP` Service。

## 需要提前确认的集群信息

- kubeconfig 可用
- 镜像拉取策略与镜像仓库地址
- Ingress Controller 是否已安装
- 是否使用 LoadBalancer / NodePort / Ingress 暴露入口
- 后端 ServiceAccount 能否被授予命名空间内 Pod / Service / ConfigMap 基础读写权限

## 现阶段 K8S 资源范围

`EDU_Backend_Go` 当前提供了以下样板资源：

- Namespace
- ConfigMap
- Secret 示例
- Deployment
- Service
- Ingress
- Role
- RoleBinding

后续在 Lab Phase 再补：

- Pod 模板组装
- 会话 Service
- 会话级代理策略
- TTL / 清理机制
