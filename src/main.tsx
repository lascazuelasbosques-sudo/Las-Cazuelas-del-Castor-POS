import {StrictMode, useState, useEffect} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { CustomerPortal } from './components/CustomerPortal';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

function AppWrapper() {
  const [isStaff, setIsStaff] = useState(() => {
    // If explicitly portal, don't show staff
    if (window.location.hash.includes('portal') || window.location.pathname.startsWith('/portal') || window.location.search.includes('portal')) {
      return false;
    }
    // Default to true (staff/login) unless portal is requested
    return true;
  });

  useEffect(() => {
    const checkRoute = () => {
      if (window.location.hash.includes('portal') || window.location.pathname.startsWith('/portal') || window.location.search.includes('portal')) {
        setIsStaff(false);
      } else {
        setIsStaff(true);
      }
    };
    window.addEventListener('hashchange', checkRoute);
    window.addEventListener('popstate', checkRoute);
    return () => {
      window.removeEventListener('hashchange', checkRoute);
      window.removeEventListener('popstate', checkRoute);
    };
  }, []);

  return isStaff ? <App /> : <CustomerPortal />;
}

// Service Worker Registration for offline capability and background communication
if ('serviceWorker' in navigator) {
  const isInsideIframe = window.self !== window.top;
  // If we are not embedded in an editor iframe, register service worker
  if (!isInsideIframe) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then(reg => {
          console.log('PWA Offline Service Worker activo:', reg.scope);
          // Check for updates
          reg.update().catch(() => {});
        })
        .catch(err => console.log('Error al registrar Service Worker:', err));
    });
  } else {
    // Inside AI Studio iframe editor, avoid stale worker interception
    navigator.serviceWorker.getRegistrations().then(registrations => {
      for (let registration of registrations) {
        registration.unregister();
      }
    }).catch(() => {});
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <AppWrapper />
    </ErrorBoundary>
  </StrictMode>,
);

