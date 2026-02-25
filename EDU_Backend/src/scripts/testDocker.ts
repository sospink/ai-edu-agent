import 'dotenv/config';
import { docker, testDockerConnection } from '../utils/docker';

async function main() {
  console.log('========================================');
  console.log('  Docker 远程连接测试');
  console.log('========================================');
  console.log('');

  const connected = await testDockerConnection();

  if (!connected) {
    process.exit(1);
  }

  console.log('');
  console.log('--- 列出所有容器 ---');
  const containers = await docker.listContainers({ all: true });

  if (containers.length === 0) {
    console.log('没有容器');
  } else {
    containers.forEach((container) => {
      console.log(`  ${container.Names[0]} - ${container.State} - ${container.Image}`);
    });
  }

  console.log('');
  console.log('--- 列出所有镜像 ---');
  const images = await docker.listImages();

  images.slice(0, 10).forEach((image) => {
    const tag = image.RepoTags?.[0] || '<none>';
    const size = (image.Size / 1024 / 1024).toFixed(2);
    console.log(`  ${tag} - ${size} MB`);
  });

  if (images.length > 10) {
    console.log(`  ... 还有 ${images.length - 10} 个镜像`);
  }

  console.log('');
  console.log('========================================');
  console.log('  测试完成!');
  console.log('========================================');
}

main().catch(console.error);
