// 品牌插件只调整原版展示，不参与会话、模型或工具逻辑。
import { readFileSync } from 'node:fs';

export const inject = ['webServer'];
export function apply(ctx) {
  const title = process.env.EDU_LOCALE === 'zh-CN' ? 'Agent EDU 智能助教' : 'Agent EDU Tutor';
  const icon = 'edu-brand-logo.gif';
  const logo = readFileSync(new URL('./assets/platform-logo.gif', import.meta.url));
  // 原版插件静态路由不支持GIF；保留平台原始动图并注册独立只读资源。
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact', path: '/edu-brand-logo.gif', auth: 'required',
    handler(req, res) {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405, { Allow: 'GET, HEAD' });
        res.end();
        return;
      }
      res.writeHead(200, { 'Content-Type': 'image/gif', 'Content-Length': logo.length });
      res.end(req.method === 'HEAD' ? undefined : logo);
    },
  }));
  ctx.effect(() => ctx.webServer.tapIndex(html => html
    .replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
    .replace(/<link\b[^>]*\brel=["'](?:icon|shortcut icon|apple-touch-icon|manifest)["'][^>]*>/gi, '')
    .replace(/<meta\b[^>]*\bname=["']apple-mobile-web-app-title["'][^>]*>/gi, '')
    .replace(/>HARNESS</g, '>Agent EDU<')
    // 只隐藏原版首页的版本徽标，不影响文件预览或其他业务文案。
    .replace('</head>', `<link rel="icon" type="image/gif" href="${icon}"><meta name="apple-mobile-web-app-title" content="${title}"><style>[class$="_previewBadge"]{display:none!important}</style></head>`)));
}
