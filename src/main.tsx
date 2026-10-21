import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(<App />);

// Register Service Worker and pre-warm all current bundle assets for 0ms Web App cold start
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        const sendWarmAssets = () => {
          const worker = reg.active || reg.waiting || reg.installing;
          if (!worker) return;
          const urls: string[] = ['/'];
          document
            .querySelectorAll<HTMLScriptElement>('script[src]')
            .forEach((s) => s.src && urls.push(s.src));
          document
            .querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"][href], link[rel="modulepreload"][href]')
            .forEach((l) => l.href && urls.push(l.href));
          worker.postMessage({ type: 'WARM_ASSETS', urls });
        };
        if (reg.active) {
          sendWarmAssets();
        } else {
          navigator.serviceWorker.ready.then(sendWarmAssets).catch(() => {});
        }
      })
      .catch(() => {});
  });
}
