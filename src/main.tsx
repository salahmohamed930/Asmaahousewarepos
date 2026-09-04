import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/Common/ErrorBoundary.tsx';
import './index.css';

// Global Unhandled Promise Rejection handler to cleanly intercept background promise errors
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const msg = reason?.message || String(reason || '');

    // Silently ignore benign background network/websocket/qz lifecycle events
    if (
      msg.includes('WebSocket') ||
      msg.includes('Connection closed') ||
      msg.includes('AbortError') ||
      msg.includes('Failed to fetch') ||
      msg.includes('NetworkError') ||
      msg.includes('Network request failed') ||
      msg.includes('qz') ||
      msg.includes('resizeObserver') ||
      msg.includes('ResizeObserver')
    ) {
      event.preventDefault();
      return;
    }

    // Prevent unhandled promise rejections from crashing or cluttering the console
    event.preventDefault();
  });

  window.addEventListener('error', (event) => {
    const msg = event.message || '';
    if (
      msg.includes('ResizeObserver') ||
      msg.includes('Script error.') ||
      msg.includes('WebSocket')
    ) {
      event.preventDefault();
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

