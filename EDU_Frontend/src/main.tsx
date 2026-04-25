import React from 'react';
import ReactDOM from 'react-dom/client';
import { HeroUIProvider, ToastProvider } from '@heroui/react';
import App from './App';
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
    <HeroUIProvider>
      <App />
      <ToastProvider
        placement="top-right"
        toastOffset={16}
        regionProps={{ className: 'z-[10050]' }}
        toastProps={{
          classNames: {
            base: 'w-auto min-w-[240px] max-w-[360px]',
            title: 'truncate',
            description: 'line-clamp-2',
            content: 'min-w-0',
          },
        }}
      />
    </HeroUIProvider>
  </React.StrictMode>
);
