import {StrictMode, useState, useEffect} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { CustomerPortal } from './components/CustomerPortal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { DeviceModeProvider } from './lib/useDeviceMode';
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

// Service Worker Registration for native PWA installation and offline capability
if ('serviceWorker' in navigator) {
  const isInsideIframe = window.self !== window.top;
  // If we are not embedded in an editor iframe, register service worker
  if (!isInsideIframe) {
    const registerSW = () => {
      navigator.serviceWorker.register('/sw.js')
        .then(reg => {
          reg.update().catch(() => {});
        })
        .catch(err => console.log('Error al registrar Service Worker:', err));
    };

    if (document.readyState === 'complete') {
      registerSW();
    } else {
      window.addEventListener('load', registerSW);
    }
  } else {
    // Inside AI Studio iframe editor, avoid stale worker interception
    navigator.serviceWorker.getRegistrations().then(registrations => {
      for (const registration of registrations) {
        registration.unregister();
      }
    }).catch(() => {});
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DeviceModeProvider>
      <ErrorBoundary>
        <AppWrapper />
      </ErrorBoundary>
    </DeviceModeProvider>
  </StrictMode>,
);


