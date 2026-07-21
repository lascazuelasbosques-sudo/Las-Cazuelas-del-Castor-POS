import React, { useState, useEffect } from 'react';
import { Smartphone, Download, CheckCircle, Share, Bell, X, ShieldAlert, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';

interface PWAInstallBannerProps {
  onDismiss?: () => void;
  compact?: boolean;
}

export function PWAInstallBanner({ onDismiss, compact = false }: PWAInstallBannerProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showModal, setShowModal] = useState(false);
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

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIOSDevice);

    // Listen for Chrome/Android/Edge beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      console.log('PWA Install prompt captured successfully');
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
          toast.success('¡Aplicación instalada con éxito en tu dispositivo!', { icon: '📲' });
          setDeferredPrompt(null);
        } else {
          toast('Instalación cancelada', { icon: 'ℹ️' });
        }
      } catch (err) {
        console.error('Error initiating install prompt:', err);
      }
    } else {
      setShowModal(true);
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
        
        // Register test notification via service worker
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({
            type: 'SHOW_BACKGROUND_NOTIFICATION',
            title: '📻 Radio Las Cazuelas',
            body: 'Las notificaciones en segundo plano y Walkie-Talkie están listas en tu celular.'
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
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 rounded-xl text-[10px] font-extrabold uppercase tracking-wide">
        <CheckCircle size={13} className="text-emerald-400" />
        <span>App Instalada</span>
      </div>
    );
  }

  if (compact) {
    return (
      <>
        <button
          onClick={handleInstallClick}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-stone-950 font-black rounded-xl text-[10px] uppercase tracking-wider shadow-md transition-all cursor-pointer"
          title="Instalar App Móvil PWA"
        >
          <Smartphone size={13} />
          <span>Instalar App</span>
        </button>

        {showModal && (
          <PWAInstructionsModal
            isIOS={isIOS}
            onClose={() => setShowModal(false)}
            onRequestNotifications={requestNotifications}
            notificationPermission={notificationPermission}
          />
        )}
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
              <span className="font-black text-xs uppercase tracking-wide text-amber-400">Instala la App en tu Celular</span>
              <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-300 text-[8px] font-extrabold rounded-md uppercase border border-amber-500/30">PWA Móvil</span>
            </div>
            <p className="text-[10px] text-stone-300 font-medium leading-tight">
              Añade <span className="font-bold text-white">Las Cazuelas</span> a tu pantalla de inicio para recibir walkie-talkie y comandas en segundo plano.
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
            <span>{deferredPrompt ? 'Instalar Ahora' : 'Guía de Instalación'}</span>
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

      {showModal && (
        <PWAInstructionsModal
          isIOS={isIOS}
          onClose={() => setShowModal(false)}
          onRequestNotifications={requestNotifications}
          notificationPermission={notificationPermission}
        />
      )}
    </>
  );
}

interface PWAInstructionsModalProps {
  isIOS: boolean;
  onClose: () => void;
  onRequestNotifications: () => void;
  notificationPermission: NotificationPermission;
}

function PWAInstructionsModal({ isIOS, onClose, onRequestNotifications, notificationPermission }: PWAInstructionsModalProps) {
  return (
    <div className="fixed inset-0 z-[120] bg-stone-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-stone-900 border-2 border-stone-750 text-white rounded-3xl p-5 max-w-md w-full shadow-2xl flex flex-col gap-4 relative animate-in fade-in zoom-in-95 duration-200">
        
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-stone-400 hover:text-white p-1 rounded-full hover:bg-stone-800 transition-colors"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
            <Smartphone size={24} />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase text-amber-400 tracking-wide">Instalar en la Pantalla de Inicio</h3>
            <p className="text-[10px] text-stone-400 font-medium">Instala la App en tu smartphone para recibir Walkie Talkie y comandas</p>
          </div>
        </div>

        {isIOS ? (
          <div className="bg-stone-950 p-4 rounded-2xl border border-stone-800 flex flex-col gap-3">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-300 uppercase">
              <Share size={16} className="text-amber-400 animate-bounce" />
              <span>Pasos para iPhone / iPad (Safari):</span>
            </div>
            <ol className="text-xs text-stone-300 space-y-2 list-decimal list-inside font-medium leading-relaxed">
              <li>Abre esta página en el navegador <strong className="text-white font-bold">Safari</strong>.</li>
              <li>Toca el botón <strong className="text-amber-400 font-bold">Compartir</strong> (icono de cuadro con flecha hacia arriba en la barra inferior).</li>
              <li>Desplázate hacia abajo y selecciona <strong className="text-amber-400 font-bold">"Añadir a la pantalla de inicio"</strong>.</li>
              <li>Confirma tocando <strong className="text-white font-bold">Añadir</strong> en la esquina superior derecha.</li>
            </ol>
          </div>
        ) : (
          <div className="bg-stone-950 p-4 rounded-2xl border border-stone-800 flex flex-col gap-3">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-300 uppercase">
              <Sparkles size={16} className="text-amber-400" />
              <span>Pasos para Android / Chrome:</span>
            </div>
            <ol className="text-xs text-stone-300 space-y-2 list-decimal list-inside font-medium leading-relaxed">
              <li>Toca los <strong className="text-amber-400 font-bold">3 puntos vertical</strong> del menú superior de tu navegador.</li>
              <li>Selecciona <strong className="text-amber-400 font-bold">"Instalar aplicación"</strong> o <strong className="text-amber-400 font-bold">"Añadir a pantalla principal"</strong>.</li>
              <li>Acepta la confirmación para tener la app nativa en tu teléfono.</li>
            </ol>
          </div>
        )}

        {/* Notification Permission Card */}
        <div className="bg-stone-950 p-3 rounded-2xl border border-stone-800 flex items-center justify-between gap-2">
          <div className="space-y-0.5">
            <p className="text-xs font-black text-stone-200 uppercase">Avisos en Segundo Plano</p>
            <p className="text-[9px] text-stone-400">Notificaciones y radio cuando la pantalla está apagada</p>
          </div>
          <button
            type="button"
            onClick={onRequestNotifications}
            disabled={notificationPermission === 'granted'}
            className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-xl border transition-all cursor-pointer flex items-center gap-1 ${
              notificationPermission === 'granted'
                ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                : 'bg-amber-500 text-stone-950 border-amber-600 hover:bg-amber-600'
            }`}
          >
            <Bell size={12} />
            <span>{notificationPermission === 'granted' ? 'ACTIVO' : 'ACTIVAR'}</span>
          </button>
        </div>

        <button
          onClick={onClose}
          className="w-full bg-stone-800 hover:bg-stone-700 text-white font-black py-2.5 rounded-2xl text-xs uppercase tracking-wider transition-all cursor-pointer"
        >
          Entendido / Cerrar
        </button>
      </div>
    </div>
  );
}
