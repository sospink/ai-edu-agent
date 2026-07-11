/**
 * 跨环境复制到剪贴板。
 * navigator.clipboard 仅在安全上下文(HTTPS/localhost)可用；实验环境常通过
 * HTTP/IP 访问，此时需回退到 document.execCommand('copy')，否则复制按钮静默失败。
 */
export async function copyText(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // 安全上下文下仍可能因权限失败，继续走回退
  }
  try {
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch (err) {
    console.error('复制失败:', err);
    return false;
  }
}
