# Build On Server

```bash
cd docker-build-artifacts
docker build -f Dockerfile.ai-courses-optimized -t opencode-lab-ai:latest .
docker run -d -p 2222:22 -p 5901:5901 -p 6080:6080 --name ai-lab opencode-lab-ai:latest
./setup-api-keys.sh
./test-courses-quick.sh
```

若 `ubuntu:22.04` 拉取失败，可使用：

```bash
sudo docker builder prune -af
sudo systemctl restart docker
sudo docker build \
  --build-arg BASE_IMAGE=m.daocloud.io/docker.io/library/ubuntu:22.04 \
  --build-arg INSTALL_VSCODE_EXTENSIONS=false \
  -f Dockerfile.ai-courses-optimized \
  -t opencode-lab-ai:latest .
```
