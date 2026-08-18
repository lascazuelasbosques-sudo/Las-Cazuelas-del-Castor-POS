import React, { useState, useEffect } from 'react';
import { Smartphone, Download, CheckCircle, Bell, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { OfflineInstallerModal } from './OfflineInstallerModal';

interface PWAInstallBannerProps {
  onDismiss?: () => void;
  compact?: boolean;
}

export function PWAInstallBanner({ onDismiss, compact = false }: PWAInstallBannerProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showInstallerModal, setShowInstallerModal] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    // Check if running in standalone mode (already installed as PWA)
    const checkStandalone = () => {
      const isStandaloneMedia = window.matchMedia('(display-mode: standalone)').matches;
      const isIOSStandalone = (navigator as any).standalone === true;
      setIsStandalone(isStandaloneMedia || isIOSStandalone);
    };

    checkStandalone();
    window.addEventListener('resize', checkStandalone);

    // Listen for Chrome/Android/Edge beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Check notification permission
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }

    return () => {
      window.removeEventListener('resize', checkStandalone);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          toast.success('¡Aplicación instalada con éxito!', { icon: '📲' });
          setDeferredPrompt(null);
        } else {
          setShowInstallerModal(true);
        }
      } catch (err) {
        setShowInstallerModal(true);
      }
    } else {
      setShowInstallerModal(true);
    }
  };

  const requestNotifications = async () => {
    if (!('Notification' in window)) {
      toast.error('Tu navegador no soporta notificaciones de escritorio.');
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission === 'granted') {
        toast.success('¡Notificaciones en segundo plano activadas!', { icon: '🔔' });
        
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({
            type: 'SHOW_BACKGROUND_NOTIFICATION',
            title: '📻 Radio Las Cazuelas',
            body: 'Las notificaciones en segundo plano y Walkie-Talkie están listas.'
          });
        }
      } else {
        toast.error('Permiso de notificaciones denegado.');
      }
    } catch (err) {
      console.error('Notification permission error:', err);
    }
  };

  if (isStandalone) {
    if (compact) return null;
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 rounded-xl text-[10px] font-extrabold uppercase tracking-wide">
        <CheckCircle size={13} className="text-emerald-400" />
        <span>App Instalada (Offline Listo)</span>
      </div>
    );
  }

  if (compact) {
    return (
      <>
        <button
          onClick={handleInstallClick}
          className="flex items-center gap-1 px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg text-[10px] font-extrabold uppercase tracking-wider transition-all cursor-pointer shrink-0"
          title="Instalar App Móvil / Modo Offline"
        >
          <Smartphone size={12} />
          <span>Instalar / Offline</span>
        </button>

        <OfflineInstallerModal
          isOpen={showInstallerModal}
          onClose={() => setShowInstallerModal(false)}
        />
      </>
    );
  }

  return (
    <>
      <div className="bg-stone-900 border-2 border-amber-500/80 text-white p-3.5 rounded-2xl shadow-2xl flex flex-col md:flex-row items-center justify-between gap-3 my-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
            <Smartphone size={22} />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-black text-xs uppercase tracking-wide text-amber-400">Instala la App en tu Celular o PC</span>
              <span className="px-1.5 py-0.5 bg-emerald-950 text-emerald-300 text-[8px] font-extrabold rounded-md uppercase border border-emerald-800">100% Offline</span>
            </div>
            <p className="text-[10px] text-stone-300 font-medium leading-tight">
              Añade <span className="font-bold text-white">Las Cazuelas</span> a tu pantalla principal para trabajar sin conexión a internet y recibir avisos.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          {notificationPermission !== 'granted' && (
            <button
              onClick={requestNotifications}
              className="px-3 py-2 bg-stone-800 hover:bg-stone-700 text-amber-400 border border-stone-700 font-extrabold rounded-xl text-[10px] uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
            >
              <Bell size={12} />
              <span>Activar Avisos</span>
            </button>
          )}

          <button
            onClick={handleInstallClick}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-stone-950 font-black rounded-xl text-[11px] uppercase tracking-wider flex items-center gap-2 shadow-lg transition-all active:scale-95 cursor-pointer shrink-0"
          >
            <Download size={14} strokeWidth={2.5} />
            <span>{deferredPrompt ? 'Instalar Ahora' : 'Instalador Offline'}</span>
          </button>

          {onDismiss && (
            <button
              onClick={onDismiss}
              className="p-1.5 text-stone-400 hover:text-white rounded-lg hover:bg-stone-800 transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      <OfflineInstallerModal
        isOpen={showInstallerModal}
        onClose={() => setShowInstallerModal(false)}
      />
    </>
  );
}
