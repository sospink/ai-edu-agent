import React from 'react';
import ReactDOM from 'react-dom/client';
import { HeroUIProvider, ToastProvider } from '@heroui/react';
import { I18nextProvider } from 'react-i18next';
import App from './App';
import i18n from './i18n';
import './styles/index.css';

// Polyfill for crypto.randomUUID (needed for non-HTTPS environments)
// Some browser extensions call this API which fails in insecure contexts
if (typeof crypto !== 'undefined' && !crypto.randomUUID) {
  (crypto as any).randomUUID = function() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Could not find root element to mount to');
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <I18nextProvider i18n={i18n}>
      <HeroUIProvider>
        <App />
        <ToastProvider
          placement="top-right"
          toastOffset={16}
          regionProps={{ className: 'z-[10050]' }}
          toastProps={{
            classNames: {
              // 固定宽度，避免 toast 随内容长短在 240~360px 之间忽宽忽窄；三端统一
              base: 'w-[360px]',
              title: 'truncate',
              description: 'line-clamp-2',
              content: 'min-w-0',
            },
          }}
        />
      </HeroUIProvider>
    </I18nextProvider>
  </React.StrictMode>
);
