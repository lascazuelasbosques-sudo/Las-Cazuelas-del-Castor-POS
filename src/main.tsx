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

// Service Worker Registration for background communication (Only in production standalone)
if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD && !window.location.hostname.includes('run.app') && !window.location.hostname.includes('localhost')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then(reg => console.log('Radio Service Worker registrado:', reg.scope))
        .catch(err => console.log('Error al registrar Service Worker:', err));
    });
  } else {
    // Unregister stale service workers in dev/iframe preview to prevent blank screen or cached script conflicts
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

