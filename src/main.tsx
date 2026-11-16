import {createRoot} from 'react-dom/client';
import {registerSW} from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

if (import.meta.env.PROD) {
  registerSW({immediate: true});
} else if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/dev-sw.js?dev-sw', {scope: '/'}).catch((err) => {
      console.warn('Service worker dev registration skipped:', err);
    });
  });
}

createRoot(document.getElementById('root')!).render(<App />);
