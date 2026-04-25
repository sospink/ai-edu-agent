# Ubuntu 24.04 单节点 Kubernetes 1.30 部署教程

> **适用环境**：Ubuntu 24.04 LTS (Noble Numbat)
> **K8S 版本**：1.30.x（生产稳定版）
> **容器运行时**：containerd 1.7.x
> **CNI 插件**：Flannel（单节点推荐）
> **文档版本**：v1.0 | 2026-04-19

---

## 前置说明

### 最低配置要求

| 资源 | 最低 | 推荐 |
|------|------|------|
| CPU | 2 核 | 4 核 |
| 内存 | 4G | 8G |
| 磁盘 | 40G | 80G+ |
| 系统 | Ubuntu 24.04 LTS | Ubuntu 24.04 LTS |
| 网络 | 固定 IP | 固定 IP |

### Ubuntu 24.04 特有注意事项

Ubuntu 24.04 与之前版本相比有三个关键差异，**必须处理**：

1. **zswap**：Ubuntu 24 默认启用 zswap（内存压缩 swap），需要额外步骤禁用
2. **AppArmor**：Ubuntu 24 的 AppArmor 配置会导致容器停止时卡顿 10 秒以上，需处理
3. **K8S apt 源**：旧源 `apt.kubernetes.io` 已于 2023 年停止维护，必须用新源 `pkgs.k8s.io`

---

## 部署总览

```
Step 1  系统初始化（关 swap、开内核转发）
Step 2  安装 containerd（容器运行时）
Step 3  修复 Ubuntu 24 AppArmor 问题
Step 4  安装 kubeadm / kubelet / kubectl
Step 5  kubeadm init 初始化集群
Step 6  配置 kubectl
Step 7  安装 CNI 网络插件（Flannel）
Step 8  去除 control-plane 污点（单节点必须）
Step 9  配置国内镜像加速（可选但推荐）
Step 10 验证集群健康
```

---

## Step 1：系统初始化

> 所有命令以 root 或 sudo 执行。建议全程使用 root。

### 1.1 更新系统

```bash
sudo apt update && sudo apt upgrade -y
```

### 1.2 关闭 Swap（含 Ubuntu 24 特有的 zswap）

Kubernetes 强制要求关闭 swap，否则 kubeadm init 会报错退出。

```bash
# 关闭当前 swap（立即生效）
sudo swapoff -a

# 持久化：注释掉 /etc/fstab 中所有 swap 行（重启后不再挂载）
sudo sed -i '/ swap / s/^\(.*\)$/#\1/' /etc/fstab

# ── Ubuntu 24.04 专属步骤：禁用 zswap ──
# 查看 zswap 是否已启用
  cat /sys/module/zswap/parameters/enabled
# 如果输出 Y，需要禁用

# 临时禁用 zswap（立即生效）
echo 0 | sudo tee /sys/module/zswap/parameters/enabled

# 持久化禁用 zswap（写入 GRUB 参数）
sudo mkdir -p /etc/default/grub.d
echo 'GRUB_CMDLINE_LINUX_DEFAULT="$GRUB_CMDLINE_LINUX_DEFAULT zswap.enabled=0"' \
  | sudo tee /etc/default/grub.d/zswap-disable.cfg

sudo update-grub
```

**验证：**

```bash
swapon --show
# 输出为空 = 成功关闭
free -h
# Swap 行全部为 0
```

### 1.3 加载必要内核模块

```bash
# 加载 overlay 和 br_netfilter 模块
cat <<EOF | sudo tee /etc/modules-load.d/k8s.conf
overlay
br_netfilter
EOF

sudo modprobe overlay
sudo modprobe br_netfilter

# 验证是否加载成功
lsmod | grep -E "overlay|br_netfilter"
```

### 1.4 配置内核网络参数

```bash
cat <<EOF | sudo tee /etc/sysctl.d/k8s.conf
# 允许 iptables 处理网桥流量（Flannel 必须）
net.bridge.bridge-nf-call-iptables  = 1
net.bridge.bridge-nf-call-ip6tables = 1
# 开启 IPv4 转发（容器网络必须）
net.ipv4.ip_forward                 = 1
EOF

# 立即应用
sudo sysctl --system
```

**验证：**
```bash
sysctl net.ipv4.ip_forward
# 输出：net.ipv4.ip_forward = 1
```

---

## Step 2：安装 containerd

containerd 是 Kubernetes 官方推荐的容器运行时，替代旧版的 Docker shim。

### 2.1 安装

```bash
sudo apt update
sudo apt install -y containerd
```

### 2.2 生成默认配置文件

```bash
sudo mkdir -p /etc/containerd
containerd config default | sudo tee /etc/containerd/config.toml > /dev/null
```

### 2.3 启用 SystemdCgroup（关键配置）

> **必须执行**：containerd 必须与 kubelet 使用相同的 cgroup driver（systemd），否则 Pod 无法启动。

```bash
# 将 SystemdCgroup 改为 true
sudo sed -i 's/SystemdCgroup = false/SystemdCgroup = true/g' /etc/containerd/config.toml

# 验证修改成功
grep "SystemdCgroup" /etc/containerd/config.toml
# 应输出：SystemdCgroup = true
```

### 2.4 启动并设置开机自启

```bash
sudo systemctl enable containerd
sudo systemctl restart containerd

# 验证状态
sudo systemctl status containerd
# 应显示：Active: active (running)
```

---

## Step 3：修复 Ubuntu 24.04 AppArmor 问题

> **Ubuntu 24.04 特有问题**：AppArmor 会拦截 containerd 的信号，导致容器停止时卡顿 10~12 秒（超时后强制 kill），影响 Pod 优雅关闭。

### 3.1 判断是否受影响

```bash
# 查看 containerd 的 AppArmor 配置是否存在
sudo ls /etc/apparmor.d/ | grep -i containerd
```

### 3.2 修复方案（二选一）

**方案 A：设置 containerd 为 complain 模式（推荐，不影响安全性）**

```bash
# 安装 apparmor-utils
sudo apt install -y apparmor-utils

# 将 containerd 的 AppArmor 策略设为 complain 模式（仅记录，不拦截）
sudo aa-complain /usr/bin/containerd 2>/dev/null || true

# 重启 containerd
sudo systemctl restart containerd
```

**方案 B：直接禁用 AppArmor 对 containerd 的限制（彻底解决）**

```bash
# 如果存在对应配置文件，则禁用
if [ -f /etc/apparmor.d/usr.bin.containerd ]; then
    sudo ln -sf /etc/apparmor.d/usr.bin.containerd \
        /etc/apparmor.d/disable/usr.bin.containerd
    sudo apparmor_parser -R /etc/apparmor.d/usr.bin.containerd 2>/dev/null || true
    sudo systemctl restart containerd
    echo "AppArmor 对 containerd 的限制已禁用"
else
    echo "未检测到 containerd AppArmor 配置，无需处理"
fi
```

---

## Step 4：安装 kubeadm / kubelet / kubectl

### 4.1 添加 Kubernetes 官方 apt 源

> **注意**：旧源 `apt.kubernetes.io` 已停止更新，必须使用新源 `pkgs.k8s.io`。

```bash
# 安装依赖
sudo apt install -y apt-transport-https ca-certificates curl gpg

# 创建密钥目录
sudo mkdir -p /etc/apt/keyrings

# 下载 K8S 1.30 的 GPG 公钥
curl -fsSL https://pkgs.k8s.io/core:/stable:/v1.30/deb/Release.key \
  | sudo gpg --dearmor -o /etc/apt/keyrings/kubernetes-apt-keyring.gpg

# 添加 K8S 1.30 apt 仓库
echo 'deb [signed-by=/etc/apt/keyrings/kubernetes-apt-keyring.gpg] https://pkgs.k8s.io/core:/stable:/v1.30/deb/ /' \
  | sudo tee /etc/apt/sources.list.d/kubernetes.list
```

### 4.2 安装三件套

```bash
sudo apt update
sudo apt install -y kubelet kubeadm kubectl

# 锁定版本，防止 apt upgrade 自动升级导致版本不一致
sudo apt-mark hold kubelet kubeadm kubectl
```

**验证安装：**
```bash
kubeadm version
kubectl version --client
kubelet --version
```

---

## Step 5：初始化 K8S 集群

### 5.1 预拉取镜像（国内必做）

> **重要**：`registry.k8s.io` 会将请求 302 重定向到 `*.pkg.dev`（Google 欧洲节点），hosts.toml 只能拦截第一跳，无法拦截重定向目标，导致镜像加速失效、直连超时。
>
> 正确做法是用 `--image-repository` 参数直接从阿里云拉取，完全绕开 `registry.k8s.io`。

```bash
# 预拉取所有 K8S 核心镜像（从阿里云）
sudo kubeadm config images pull \
  --image-repository=registry.aliyuncs.com/google_containers \
  --kubernetes-version=v1.30.14

# 验证镜像已全部拉取成功
sudo crictl images | grep -E "kube-|etcd|coredns|pause"
# 应能看到 kube-apiserver、kube-scheduler、kube-controller-manager、etcd、coredns、pause
```

### 5.2 修复 sandbox_image（关键，不做必超时）

> **这是国内环境最容易踩的坑**：`--image-repository` 只控制 K8S 组件镜像，**不控制 pause 沙箱镜像**。
> 每个 Pod 启动前都必须先拉取 `pause` 镜像，而 containerd 的 `sandbox_image` 默认指向 `registry.k8s.io/pause:x.x.x`，同样走 302 重定向到 Google，直连超时。
> 不处理这个问题，kubeadm init 必然在等待 API Server 时 4 分钟超时失败。

```bash
# 第一步：查看当前 sandbox_image 配置（记下版本号）
grep "sandbox_image" /etc/containerd/config.toml
# 例如输出：sandbox_image = "registry.k8s.io/pause:3.10.1"

# 第二步：从阿里云拉取 pause 镜像（版本号与上面一致）
sudo ctr -n k8s.io images pull \
  registry.aliyuncs.com/google_containers/pause:3.10.1

# 第三步：打 tag，让 containerd 的原始路径也能找到
sudo ctr -n k8s.io images tag \
  registry.aliyuncs.com/google_containers/pause:3.10.1 \
  registry.k8s.io/pause:3.10.1

# 第四步：修改 containerd 配置，固定 sandbox_image 为阿里云地址
sudo sed -i \
  's|sandbox_image = "registry.k8s.io/pause:.*"|sandbox_image = "registry.aliyuncs.com/google_containers/pause:3.10.1"|' \
  /etc/containerd/config.toml

# 验证修改成功
grep "sandbox_image" /etc/containerd/config.toml
# 应输出：sandbox_image = "registry.aliyuncs.com/google_containers/pause:3.10.1"

# 第五步：重启 containerd 使配置生效
sudo systemctl restart containerd
```

### 5.3 执行 kubeadm init

```bash
# 获取当前主机名（作为节点名）
NODENAME=$(hostname)
echo "节点名称：$NODENAME"

# 获取服务器内网 IP
NODE_IP=$(hostname -I | awk '{print $1}')
echo "节点 IP：$NODE_IP"

# 初始化集群（指定阿里云镜像仓库，不走 registry.k8s.io）
sudo kubeadm init \
  --image-repository=registry.aliyuncs.com/google_containers \
  --apiserver-advertise-address=$NODE_IP \
  --pod-network-cidr=10.244.0.0/16 \
  --node-name=$NODENAME \
  --cri-socket=unix:///run/containerd/containerd.sock
```

**参数说明：**

| 参数 | 说明 |
|------|------|
| `--image-repository` | **关键**：直接从阿里云拉组件镜像，完全绕过 registry.k8s.io |
| `--apiserver-advertise-address` | API Server 广播 IP，填服务器**内网 IP** |
| `--pod-network-cidr=10.244.0.0/16` | Pod 网络 CIDR，**必须与 Flannel 默认值一致** |
| `--node-name` | 节点名称，使用 hostname |
| `--cri-socket` | containerd 的 socket 路径 |

> ⏳ 镜像已预拉取 + sandbox_image 已修复，init 通常在 1~2 分钟内完成。

### 5.2 保存 join token（重要）

初始化成功后终端会输出类似内容，**务必复制保存**（添加 Worker 节点时需要）：

```
Your Kubernetes control-plane has initialized successfully!
...
kubeadm join 192.168.1.100:6443 --token abcdef.0123456789abcdef \
    --discovery-token-ca-cert-hash sha256:xxxxxxxxxxxxxxxx
```

Token 24 小时后过期，重新生成命令：
```bash
kubeadm token create --print-join-command
```

---

## Step 6：配置 kubectl

```bash
# 为当前用户配置 kubeconfig
mkdir -p $HOME/.kube
sudo cp /etc/kubernetes/admin.conf $HOME/.kube/config
sudo chown $(id -u):$(id -g) $HOME/.kube/config

# 验证连接
kubectl cluster-info
kubectl get nodes
```

此时节点状态为 `NotReady`，这是正常的——还没有安装 CNI 网络插件。

---

## Step 7：安装 Flannel CNI 网络插件

> Flannel 是最轻量的 CNI，单节点首选。安装后 Pod 之间才能通信。

```bash
kubectl apply -f https://raw.githubusercontent.com/flannel-io/flannel/master/Documentation/kube-flannel.yml
```

如果 GitHub 访问慢，使用本地文件方式：

```bash
# 下载配置文件
curl -LO https://raw.githubusercontent.com/flannel-io/flannel/master/Documentation/kube-flannel.yml

# 应用
kubectl apply -f kube-flannel.yml
```

**等待 Flannel Pod 就绪：**
```bash
kubectl get pods -n kube-flannel -w
# 等待所有 Pod 变为 Running 状态（约 30~60 秒）
```

**验证节点状态：**
```bash
kubectl get nodes
# NAME       STATUS   ROLES           AGE   VERSION
# your-host  Ready    control-plane   5m    v1.30.x
```

节点变为 `Ready` 说明网络插件安装成功。

---

## Step 8：去除 control-plane 污点（单节点必须）

> 默认情况下，K8S 不允许在 control-plane 节点上调度普通业务 Pod。单节点部署必须移除此限制。

```bash
# 移除 control-plane taint（末尾的 - 表示移除）
kubectl taint nodes $(hostname) node-role.kubernetes.io/control-plane:NoSchedule-
```

**验证：**
```bash
kubectl describe node $(hostname) | grep Taint
# 应输出：Taints: <none>
```

---

## Step 9：国内镜像加速说明

> **为什么 hosts.toml 对 K8S 核心镜像无效？**
>
> `registry.k8s.io` 本质是一个重定向服务，请求流程如下：
> ```
> containerd → registry.k8s.io（302 重定向）→ europe-west4-docker.pkg.dev（Google 欧洲节点，被墙）
> ```
> hosts.toml 只能拦截第一跳，重定向后的 `*.pkg.dev` 没有对应加速配置，仍然直连 Google 超时。

### 9.1 K8S 核心镜像加速（`--image-repository` 方案，唯一可靠）

**已在 Step 5 中通过 `--image-repository=registry.aliyuncs.com/google_containers` 处理完毕**，无需额外配置。这是国内环境部署 K8S 的标准做法。

### 9.2 业务镜像加速（docker.io / ghcr.io）

K8S 集群搭好后，部署业务应用时会用到 Docker Hub 等镜像源。这类镜像可以用 hosts.toml 加速（不存在重定向问题）：

```bash
# docker.io 加速（部署 nginx、mysql 等常用镜像时用到）
sudo mkdir -p /etc/containerd/certs.d/docker.io
cat <<EOF | sudo tee /etc/containerd/certs.d/docker.io/hosts.toml
server = "https://registry-1.docker.io"

[host."https://docker.mirrors.ustc.edu.cn"]
  capabilities = ["pull", "resolve"]

[host."https://hub-mirror.c.163.com"]
  capabilities = ["pull", "resolve"]
EOF

# ghcr.io 加速（GitHub Container Registry，Flannel 等使用）
sudo mkdir -p /etc/containerd/certs.d/ghcr.io
cat <<EOF | sudo tee /etc/containerd/certs.d/ghcr.io/hosts.toml
server = "https://ghcr.io"

[host."https://ghcr.nju.edu.cn"]
  capabilities = ["pull", "resolve"]
EOF
```

### 9.3 启用 hosts 配置目录并重启

```bash
# 确认 config.toml 中 config_path 已设置
grep "config_path" /etc/containerd/config.toml

# 如果为空，手动设置
sudo sed -i 's|config_path = ""|config_path = "/etc/containerd/certs.d"|g' \
  /etc/containerd/config.toml

sudo systemctl restart containerd
```

### 9.4 验证 docker.io 加速是否生效

```bash
# 拉取 nginx（来自 docker.io）测试
sudo crictl pull docker.io/library/nginx:latest
# 速度明显快说明加速生效
```

> **各镜像源加速方案汇总：**
>
> | 镜像源 | 解决方案 | 原因 |
> |--------|----------|------|
> | `registry.k8s.io` | `--image-repository` 参数 | 存在 302 重定向，hosts.toml 无效 |
> | `docker.io` | hosts.toml | 直连，加速有效 |
> | `ghcr.io` | hosts.toml | 直连，加速有效 |
> | `gcr.io` | 尽量避免使用 | 同样存在重定向问题 |

---

## Step 10：验证集群健康

### 10.1 检查节点状态

```bash
kubectl get nodes -o wide
# 期望输出：
# NAME       STATUS   ROLES           AGE   VERSION   INTERNAL-IP   ...
# your-host  Ready    control-plane   10m   v1.30.x   192.168.x.x   ...
```

### 10.2 检查系统 Pod 状态

```bash
kubectl get pods -A
# 期望：所有 Pod 均为 Running 或 Completed 状态
# kube-system 下应有：
#   coredns / etcd / kube-apiserver / kube-controller-manager
#   kube-proxy / kube-scheduler
# kube-flannel 下应有：
#   kube-flannel-ds-xxxxx  Running
```

### 10.3 部署一个测试 Pod 验证调度

```bash
# 创建测试 Nginx Pod
kubectl run nginx-test --image=nginx --port=80

# 等待 Pod 启动
kubectl get pod nginx-test -w
# 等待变为 Running 状态

# 测试 Pod 内网络
kubectl exec -it nginx-test -- curl localhost
# 应返回 Nginx 欢迎页 HTML

# 清理测试 Pod
kubectl delete pod nginx-test
```

### 10.4 检查集群信息

```bash
kubectl cluster-info
# 应输出：
# Kubernetes control plane is running at https://xxx.xxx.xxx.xxx:6443
# CoreDNS is running at https://...

kubectl get componentstatuses
# controller-manager   Healthy
# scheduler            Healthy
# etcd-0               Healthy
```

---

## 常用运维命令速查

### kubectl 日常操作

```bash
# ── 节点管理 ──
kubectl get nodes                              # 查看节点列表
kubectl describe node <node-name>              # 节点详细信息
kubectl top nodes                              # 节点资源用量（需 metrics-server）

# ── Pod 管理 ──
kubectl get pods -A                            # 所有命名空间的 Pod
kubectl get pods -n <namespace>                # 指定命名空间
kubectl describe pod <pod-name> -n <ns>        # Pod 详情（查看 Events 排查问题）
kubectl logs <pod-name> -n <ns>                # Pod 日志
kubectl logs <pod-name> -n <ns> -f             # 实时日志
kubectl logs <pod-name> -n <ns> --previous     # 崩溃前的日志
kubectl exec -it <pod-name> -n <ns> -- bash   # 进入 Pod shell

# ── 部署管理 ──
kubectl apply -f deployment.yaml               # 应用配置
kubectl delete -f deployment.yaml              # 删除资源
kubectl rollout status deployment/<name>       # 查看滚动更新状态
kubectl rollout restart deployment/<name>      # 重启 Deployment

# ── 排查问题 ──
kubectl get events -n <ns> --sort-by='.lastTimestamp'  # 查看最近事件
kubectl get pods -A | grep -v Running          # 找出不健康的 Pod
kubectl delete pod <pod-name> --grace-period=0 --force # 强制删除卡住的 Pod
```

### crictl 容器运行时操作

```bash
# ── 基础查看 ──
sudo crictl ps                      # 运行中的容器
sudo crictl ps -a                   # 所有容器（含已停止）
sudo crictl pods                    # 所有 Pod 沙箱
sudo crictl images                  # 本地镜像列表

# ── 调试 ──
sudo crictl logs <container-id>     # 容器日志
sudo crictl exec -it <container-id> bash  # 进入容器
sudo crictl inspect <container-id>  # 容器详细信息
sudo crictl stats                   # 容器资源用量

# ── 清理 ──
sudo crictl rmi <image-id>          # 删除镜像
sudo crictl rm <container-id>       # 删除容器
```

### 系统日志查看

```bash
# kubelet 日志（最常用的排查入口）
sudo journalctl -u kubelet -f                  # 实时日志
sudo journalctl -u kubelet -n 100              # 最后 100 行
sudo journalctl -u kubelet --since "30 min ago" # 最近 30 分钟

# containerd 日志
sudo journalctl -u containerd -f
sudo journalctl -u containerd -n 50

# 系统内核日志（网络/cgroup 问题排查）
sudo dmesg | tail -50
```

---

## 常见问题排查

### ❌ 问题 1：`[ERROR Swap]: running with swap on is not supported`

**原因**：swap 未完全关闭（Ubuntu 24 需要额外禁用 zswap）

```bash
# 检查 swap 状态
swapon --show
cat /sys/module/zswap/parameters/enabled

# 重新执行 Step 1.2 的所有步骤
sudo swapoff -a
echo 0 | sudo tee /sys/module/zswap/parameters/enabled
```

---

### ❌ 问题 2：`container runtime is not running`

**原因**：containerd 未运行，或 socket 路径不对

```bash
sudo systemctl status containerd
sudo ls -la /run/containerd/containerd.sock

# 重启 containerd
sudo systemctl restart containerd
```

---

### ❌ 问题 3：节点一直 `NotReady`

**原因**：CNI 网络插件未安装，或 Flannel Pod 未启动成功

```bash
# 查看 Flannel Pod 状态
kubectl get pods -n kube-flannel
kubectl describe pod -n kube-flannel <flannel-pod-name>

# 重新应用 Flannel
kubectl apply -f https://raw.githubusercontent.com/flannel-io/flannel/master/Documentation/kube-flannel.yml
```

---

### ❌ 问题 4：Pod 一直 `Pending`，提示 `node(s) had taint`

**原因**：忘记去除 control-plane 污点

```bash
kubectl taint nodes $(hostname) node-role.kubernetes.io/control-plane:NoSchedule-
```

---

### ❌ 问题 5：`ImagePullBackOff` 镜像拉取失败

**原因**：无法访问境外镜像源

```bash
# 查看具体是哪个镜像拉取失败
kubectl describe pod <pod-name> -n <ns> | grep -A10 "Events"
```

**K8S 核心镜像（kube-*、etcd、pause）**：`registry.k8s.io` 有 302 重定向，hosts.toml 无效，必须用 `--image-repository` 方案：
```bash
# 手动补拉缺失的核心镜像
sudo crictl pull registry.aliyuncs.com/google_containers/pause:3.9
# 然后给镜像打 tag 让 K8S 认识
sudo ctr -n k8s.io images tag \
  registry.aliyuncs.com/google_containers/pause:3.9 \
  registry.k8s.io/pause:3.9
```

**业务镜像（nginx、mysql 等来自 docker.io）**：确认 Step 9.2 的 hosts.toml 配置已完成：
```bash
sudo cat /etc/containerd/certs.d/docker.io/hosts.toml
sudo crictl pull docker.io/library/nginx:latest  # 测试
```

---

### ❌ 问题 6：容器停止卡顿 10 秒以上

**原因**：Ubuntu 24.04 AppArmor 问题（见 Step 3）

```bash
# 检查 AppArmor 是否拦截了 containerd
sudo aa-status | grep containerd

# 重新执行 Step 3 的修复步骤
sudo apt install -y apparmor-utils
sudo aa-complain /usr/bin/containerd 2>/dev/null || true
sudo systemctl restart containerd
```

---

### ❌ 问题 7：kubeadm init 4 分钟超时（API Server 启不来）

**根因**：`pause` 沙箱镜像拉取失败。每个 Pod 启动前必须先跑一个 `pause` 容器，而 `--image-repository` 参数不覆盖 `sandbox_image`，containerd 仍然去 `registry.k8s.io` 拉 pause，触发 302 重定向到 Google 超时。

**表现**：`journalctl -u containerd` 看到 `failed to get sandbox image "registry.k8s.io/pause:x.x.x"`

**修复步骤：**

```bash
# 第一步：修复 sandbox_image（必须先做）
PAUSE_VERSION=$(grep "sandbox_image" /etc/containerd/config.toml \
  | grep -oP '(?<=pause:)\S+(?=")' | head -1)
echo "pause 版本: $PAUSE_VERSION"

sudo ctr -n k8s.io images pull \
  registry.aliyuncs.com/google_containers/pause:${PAUSE_VERSION}
sudo ctr -n k8s.io images tag \
  registry.aliyuncs.com/google_containers/pause:${PAUSE_VERSION} \
  registry.k8s.io/pause:${PAUSE_VERSION} 2>/dev/null || true
sudo sed -i \
  "s|sandbox_image = \"registry.k8s.io/pause:.*\"|sandbox_image = \"registry.aliyuncs.com/google_containers/pause:${PAUSE_VERSION}\"|" \
  /etc/containerd/config.toml
sudo systemctl restart containerd

# 第二步：重置集群
sudo kubeadm reset -f
sudo rm -rf /etc/kubernetes/ /var/lib/etcd/ $HOME/.kube/
sudo iptables -F && sudo iptables -t nat -F
sudo ipvsadm -C 2>/dev/null || true

# 第三步：重新 init（这次不会超时）
NODE_IP=$(hostname -I | awk '{print $1}')
sudo kubeadm init \
  --image-repository=registry.aliyuncs.com/google_containers \
  --apiserver-advertise-address=$NODE_IP \
  --pod-network-cidr=10.244.0.0/16 \
  --node-name=$(hostname) \
  --cri-socket=unix:///run/containerd/containerd.sock
```

---

## 一键部署脚本

> 适合全新 Ubuntu 24.04 环境，按顺序自动执行所有步骤。执行前请确认服务器 IP 正确。

```bash
#!/bin/bash
set -e

echo "=================================================="
echo "  Ubuntu 24.04 单节点 Kubernetes 1.30 部署脚本"
echo "=================================================="

# ── 变量配置（按实际修改）──
NODE_IP=$(hostname -I | awk '{print $1}')
NODENAME=$(hostname)
POD_CIDR="10.244.0.0/16"

echo "[INFO] 节点 IP: $NODE_IP"
echo "[INFO] 节点名称: $NODENAME"

# ── Step 1: 系统初始化 ──
echo ""
echo "[Step 1] 系统初始化..."

# 关闭 swap
sudo swapoff -a
sudo sed -i '/ swap / s/^\(.*\)$/#\1/' /etc/fstab

# 禁用 zswap（Ubuntu 24 专属）
echo 0 | sudo tee /sys/module/zswap/parameters/enabled > /dev/null
sudo mkdir -p /etc/default/grub.d
echo 'GRUB_CMDLINE_LINUX_DEFAULT="$GRUB_CMDLINE_LINUX_DEFAULT zswap.enabled=0"' \
  | sudo tee /etc/default/grub.d/zswap-disable.cfg > /dev/null
sudo update-grub

# 内核模块
cat <<EOF | sudo tee /etc/modules-load.d/k8s.conf
overlay
br_netfilter
EOF
sudo modprobe overlay
sudo modprobe br_netfilter

# sysctl 网络参数
cat <<EOF | sudo tee /etc/sysctl.d/k8s.conf
net.bridge.bridge-nf-call-iptables  = 1
net.bridge.bridge-nf-call-ip6tables = 1
net.ipv4.ip_forward                 = 1
EOF
sudo sysctl --system > /dev/null

echo "[Step 1] ✅ 系统初始化完成"

# ── Step 2: 安装 containerd ──
echo ""
echo "[Step 2] 安装 containerd..."

sudo apt update -qq
sudo apt install -y containerd

sudo mkdir -p /etc/containerd
containerd config default | sudo tee /etc/containerd/config.toml > /dev/null
sudo sed -i 's/SystemdCgroup = false/SystemdCgroup = true/g' /etc/containerd/config.toml

sudo systemctl enable containerd
sudo systemctl restart containerd

echo "[Step 2] ✅ containerd 安装完成"

# ── Step 3: 修复 AppArmor ──
echo ""
echo "[Step 3] 检查 AppArmor..."

if dpkg -l | grep -q apparmor-utils; then
    sudo aa-complain /usr/bin/containerd 2>/dev/null || true
else
    sudo apt install -y apparmor-utils -qq
    sudo aa-complain /usr/bin/containerd 2>/dev/null || true
fi
sudo systemctl restart containerd

echo "[Step 3] ✅ AppArmor 处理完成"

# ── Step 4: 安装 kubeadm / kubelet / kubectl ──
echo ""
echo "[Step 4] 安装 kubeadm / kubelet / kubectl..."

sudo apt install -y apt-transport-https ca-certificates curl gpg -qq
sudo mkdir -p /etc/apt/keyrings

curl -fsSL https://pkgs.k8s.io/core:/stable:/v1.30/deb/Release.key \
  | sudo gpg --dearmor -o /etc/apt/keyrings/kubernetes-apt-keyring.gpg

echo 'deb [signed-by=/etc/apt/keyrings/kubernetes-apt-keyring.gpg] https://pkgs.k8s.io/core:/stable:/v1.30/deb/ /' \
  | sudo tee /etc/apt/sources.list.d/kubernetes.list > /dev/null

sudo apt update -qq
sudo apt install -y kubelet kubeadm kubectl
sudo apt-mark hold kubelet kubeadm kubectl

echo "[Step 4] ✅ K8S 组件安装完成"

# ── Step 5: 配置 docker.io 镜像加速（业务镜像用）──
echo ""
echo "[Step 5] 配置 docker.io 镜像加速..."

sudo mkdir -p /etc/containerd/certs.d/{docker.io,ghcr.io}

cat <<EOF | sudo tee /etc/containerd/certs.d/docker.io/hosts.toml
server = "https://registry-1.docker.io"
[host."https://docker.mirrors.ustc.edu.cn"]
  capabilities = ["pull", "resolve"]
[host."https://hub-mirror.c.163.com"]
  capabilities = ["pull", "resolve"]
EOF

cat <<EOF | sudo tee /etc/containerd/certs.d/ghcr.io/hosts.toml
server = "https://ghcr.io"
[host."https://ghcr.nju.edu.cn"]
  capabilities = ["pull", "resolve"]
EOF

# 在 config.toml 启用 hosts 目录
sudo sed -i 's|config_path = ""|config_path = "/etc/containerd/certs.d"|g' \
  /etc/containerd/config.toml

sudo systemctl restart containerd

echo "[Step 5] ✅ 镜像加速配置完成"

# ── Step 6: 预拉取镜像 + 修复 sandbox_image + 初始化集群 ──
echo ""
echo "[Step 6] 预拉取 K8S 核心镜像（从阿里云）..."

# registry.k8s.io 存在 302 重定向到 Google 节点，hosts.toml 无效
# 必须用 --image-repository 直接从阿里云拉取
sudo kubeadm config images pull \
  --image-repository=registry.aliyuncs.com/google_containers \
  --kubernetes-version=v1.30.14

echo "[Step 6] 修复 sandbox_image（pause 镜像）..."

# 获取当前配置的 pause 版本号
PAUSE_VERSION=$(grep "sandbox_image" /etc/containerd/config.toml \
  | grep -oP '(?<=pause:)\S+(?=")' | head -1)
echo "[INFO] 检测到 pause 版本: $PAUSE_VERSION"

# 从阿里云拉取 pause 镜像并打 tag
sudo ctr -n k8s.io images pull \
  registry.aliyuncs.com/google_containers/pause:${PAUSE_VERSION}
sudo ctr -n k8s.io images tag \
  registry.aliyuncs.com/google_containers/pause:${PAUSE_VERSION} \
  registry.k8s.io/pause:${PAUSE_VERSION} 2>/dev/null || true

# 修改 containerd sandbox_image 指向阿里云，避免启动时重新拉取
sudo sed -i \
  "s|sandbox_image = \"registry.k8s.io/pause:.*\"|sandbox_image = \"registry.aliyuncs.com/google_containers/pause:${PAUSE_VERSION}\"|" \
  /etc/containerd/config.toml

sudo systemctl restart containerd
echo "[Step 6] sandbox_image 修复完成，开始初始化集群..."

sudo kubeadm init \
  --image-repository=registry.aliyuncs.com/google_containers \
  --apiserver-advertise-address="$NODE_IP" \
  --pod-network-cidr="$POD_CIDR" \
  --node-name="$NODENAME" \
  --cri-socket=unix:///run/containerd/containerd.sock

# 配置 kubectl
mkdir -p "$HOME/.kube"
sudo cp /etc/kubernetes/admin.conf "$HOME/.kube/config"
sudo chown "$(id -u):$(id -g)" "$HOME/.kube/config"

echo "[Step 6] ✅ 集群初始化完成"

# ── Step 7: 安装 Flannel CNI ──
echo ""
echo "[Step 7] 安装 Flannel CNI..."

kubectl apply -f https://raw.githubusercontent.com/flannel-io/flannel/master/Documentation/kube-flannel.yml

echo "[Step 7] ✅ Flannel 安装完成，等待 Pod 就绪..."

# ── Step 8: 去除 control-plane 污点 ──
echo ""
echo "[Step 8] 去除 control-plane 污点（单节点必须）..."

sleep 10
kubectl taint nodes "$NODENAME" node-role.kubernetes.io/control-plane:NoSchedule- 2>/dev/null || true

echo "[Step 8] ✅ 污点已去除"

# ── 验证 ──
echo ""
echo "=================================================="
echo "  🎉 部署完成！等待集群就绪..."
echo "=================================================="
echo ""

# 等待节点 Ready
echo "等待节点变为 Ready 状态..."
for i in {1..30}; do
    STATUS=$(kubectl get nodes "$NODENAME" -o jsonpath='{.status.conditions[-1].type}' 2>/dev/null)
    if [ "$STATUS" = "Ready" ]; then
        echo "✅ 节点已 Ready！"
        break
    fi
    echo "  等待中... ($i/30)"
    sleep 10
done

echo ""
echo "当前集群状态："
kubectl get nodes -o wide
echo ""
echo "系统 Pod 状态："
kubectl get pods -A
echo ""
echo "=================================================="
echo "  下一步：部署你的应用到 K8S！"
echo "  kubectl apply -f your-app.yaml"
echo "=================================================="
```

**使用方法：**
```bash
# 保存脚本
curl -O https://your-domain/install-k8s.sh
# 或直接复制上面内容保存为 install-k8s.sh

chmod +x install-k8s.sh
sudo ./install-k8s.sh 2>&1 | tee k8s-install.log
```

---

*文档维护：研发团队*
