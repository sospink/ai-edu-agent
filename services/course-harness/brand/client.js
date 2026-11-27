window.__ModuleLoader__.load({
  id: '@agent-edu/tutor-brand',
  factory: (require) => {
    const React = require('react');
    function Mark({ size = 32, className }) {
      return React.createElement('img', {
        className, alt: 'Agent EDU',
        src: 'edu-brand-logo.gif',
        style: {
          display: 'block', width: size, height: size, flexShrink: 0,
          objectFit: 'contain',
        },
      });
    }
    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        const subscribe = callback => ctx.locale.subscribe(callback);
        const snapshot = () => ctx.locale.getSnapshot();
        const productTitle = () => snapshot().active.startsWith('zh') ? 'Agent EDU 智能助教' : 'Agent EDU Tutor';
        // 原版布局会重写浏览器标题；只同步head中的产品后缀，不扫描或翻译页面正文。
        ctx.effect(() => {
          const refreshTitle = () => {
            const next = document.title.replace(/(?:DeepSeek Harness|Agent EDU 智能助教|Agent EDU Tutor)$/, productTitle());
            if (next !== document.title) document.title = next;
          };
          const observer = new MutationObserver(refreshTitle);
          const element = document.querySelector('title');
          if (element) observer.observe(element, { childList: true, subtree: true, characterData: true });
          const unsubscribe = subscribe(refreshTitle);
          refreshTitle();
          return () => { observer.disconnect(); unsubscribe(); };
        });
        function Name() {
          const locale = React.useSyncExternalStore(subscribe, snapshot);
          const title = locale.active.startsWith('zh') ? 'Agent EDU 智能助教' : 'Agent EDU Tutor';
          return React.createElement('span', {
            style: { fontSize: 13, fontWeight: 600, lineHeight: 1.4, whiteSpace: 'normal' },
          }, title);
        }
        for (const [slot, component] of [
          ['sidebar.brand.mark', Mark],
          ['sidebar.brand.name', Name],
          ['conversation.hero.brand.mark', Mark],
        ]) {
          ctx.slots.inject(slot, () => ctx.slots.register({ name: slot }, component));
        }
      },
    };
  },
});
