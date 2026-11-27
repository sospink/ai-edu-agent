#!/usr/bin/env bash
# 由已有运维身份在42安装固定发布入口，只添加专用key，不改现有key。
set -euo pipefail
stage=${1:?包含 release42.py 和 deploy-key.pub 的目录}
test -f "$stage/release42.py"
test -f "$stage/deploy-key.pub"
sudo install -o root -g root -m 0755 "$stage/release42.py" /usr/local/sbin/edu-release-42
mkdir -p "$HOME/.ssh"
chmod 700 "$HOME/.ssh"
touch "$HOME/.ssh/authorized_keys"
chmod 600 "$HOME/.ssh/authorized_keys"
key=$(cat "$stage/deploy-key.pub")
[[ "$key" == ssh-ed25519\ * ]] || { echo "需要专用 Ed25519 公钥" >&2; exit 1; }
if ! grep -Fq -- "$key" "$HOME/.ssh/authorized_keys"; then
  printf '\nrestrict,command="sudo -n --preserve-env=SSH_ORIGINAL_COMMAND /usr/local/sbin/edu-release-42" %s\n' "$key" >> "$HOME/.ssh/authorized_keys"
fi
echo "42受限发布入口已安装"
