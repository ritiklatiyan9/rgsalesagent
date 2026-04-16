import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'sonner';
import './index.css';
import App from './App.jsx';
import { persistInit } from './lib/storage/persistCache';
import { hydrateCache } from './lib/queryCache';
import { initNetwork } from './lib/network';

// Pre-initialize persistence + network before React mounts.
// This ensures cached data is available on first render (no blank screen).
async function bootstrap() {
  try {
    await persistInit();
    await Promise.all([hydrateCache(), initNetwork()]);
  } catch (e) {
    console.warn('[bootstrap] init failed (non-fatal):', e.message);
  }

  createRoot(document.getElementById('root')).render(
    <BrowserRouter>
      <App />
      <Toaster position="top-right" />
    </BrowserRouter>
  );
}

bootstrap();
