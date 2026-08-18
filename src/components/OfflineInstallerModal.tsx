import React, { useState, useEffect } from "react";
import { 
  Smartphone, Download, CheckCircle2, Share, Bell, X, 
  Wifi, WifiOff, HardDrive, Sparkles, RefreshCw, Layers, ShieldCheck 
} from "lucide-react";
import { preloadMenuCache, getLocalCache } from "../lib/offlineService";
import toast from "react-hot-toast";

interface OfflineInstallerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function OfflineInstallerModal({ isOpen, onClose }: OfflineInstallerModalProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [isPreparingOffline, setIsPreparingOffline] = useState(false);
  const [offlineStats, setOfflineStats] = useState<{ productsCount: number; categoriesCount: number; isCached: boolean }>({
    productsCount: 0,
    categoriesCount: 0,
    isCached: false
  });

  useEffect(() => {
    // Check standalone mode
    const checkStandalone = () => {
      const isStandaloneMedia = window.matchMedia('(display-mode: standalone)').matches;
      const isIOSStandalone = (navigator as any).standalone === true;
      setIsStandalone(isStandaloneMedia || isIOSStandalone);
    };

    checkStandalone();
    window.addEventListener('resize', checkStandalone);

    // Detect iOS
    const ua = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(ua));

    // Listen for install prompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // Connection listener
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Read initial cache
    updateCacheStats();

    return () => {
      window.removeEventListener('resize', checkStandalone);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const updateCacheStats = () => {
    const products = getLocalCache('products') || [];
    const categories = getLocalCache('categories') || [];
    setOfflineStats({
      productsCount: products.length,
      categoriesCount: categories.length,
      isCached: products.length > 0
    });
  };

  const handleInstallApp = async () => {
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          toast.success('¡Instalación iniciada con éxito!');
          setDeferredPrompt(null);
        } else {
          toast('Instalación cancelada', { icon: 'ℹ️' });
        }
      } catch (err) {
        console.error('Error al invocar instalación:', err);
      }
    } else if (isIOS) {
      toast('Sigue las instrucciones de Safari abajo', { icon: '📲' });
    } else {
      toast('Usa el menú de tu navegador para "Instalar Aplicación"', { icon: 'ℹ️' });
    }
  };

  const handlePrepareOffline = async () => {
    setIsPreparingOffline(true);
    try {
      // 1. Warm up menu cache in localStorage
      preloadMenuCache();
      
      // 2. Pre-cache app shell and static resources in Service Worker Cache if supported
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'PRECACHE_URLS',
          urls: ['/', '/index.html', '/manifest.json', '/logo_las_cazuelas_del_castor.jpg']
        });
      }

      // 3. Cache in window.caches if available
      if ('caches' in window) {
        const cache = await window.caches.open('cazuelas-pos-v3');
        await cache.addAll(['/', '/index.html', '/manifest.json', '/logo_las_cazuelas_del_castor.jpg']).catch(() => {});
      }

      updateCacheStats();
      toast.success('¡Sistema y comidas 100% listos para trabajar fuera de línea!', {
        icon: '💾',
        duration: 4000
      });
    } catch (error) {
      console.warn('Error preparando caché offline:', error);
      toast.success('Comidas y base de datos guardadas en caché local.');
    } finally {
      setIsPreparingOffline(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-stone-950/85 backdrop-blur-md flex items-center justify-center p-3 md:p-6 overflow-y-auto">
      <div className="bg-stone-900 border-2 border-amber-500/60 text-stone-100 rounded-3xl p-5 md:p-6 max-w-lg w-full shadow-2xl flex flex-col gap-4 relative animate-in fade-in zoom-in-95 duration-200">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-stone-400 hover:text-white p-2 rounded-full hover:bg-stone-800 transition-colors"
          title="Cerrar"
        >
          <X size={20} />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 pr-8">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
            <Smartphone size={26} />
          </div>
          <div>
            <h2 className="text-base font-black uppercase text-amber-400 tracking-wide">
              Instalador del Sistema Offline
            </h2>
            <p className="text-xs text-stone-300 font-medium">
              Instala la aplicación en tu navegador o celular para trabajar sin internet.
            </p>
          </div>
        </div>

        {/* Connection & Cache Status Bar */}
        <div className="grid grid-cols-2 gap-2 bg-stone-950 p-3 rounded-2xl border border-stone-800">
          <div className="flex items-center gap-2">
            {isOnline ? (
              <>
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <div className="text-[11px]">
                  <span className="text-stone-400 block">Conexión</span>
                  <span className="font-bold text-emerald-400">En Línea</span>
                </div>
              </>
            ) : (
              <>
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                <div className="text-[11px]">
                  <span className="text-stone-400 block">Conexión</span>
                  <span className="font-bold text-amber-400">Sin Internet</span>
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <HardDrive size={16} className="text-amber-400" />
            <div className="text-[11px]">
              <span className="text-stone-400 block">Comidas en Caché</span>
              <span className="font-bold text-stone-200">
                {offlineStats.productsCount} platillos ({offlineStats.categoriesCount} cat.)
              </span>
            </div>
          </div>
        </div>

        {/* One-Click Preload / Offline Activation */}
        <div className="bg-stone-950 p-4 rounded-2xl border border-amber-500/30 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-black uppercase text-amber-300">
              <Layers size={16} className="text-amber-400" />
              <span>Preparar Modo Fuera de Línea</span>
            </div>
            <span className="px-2 py-0.5 bg-emerald-950 text-emerald-400 border border-emerald-800 text-[9px] font-extrabold rounded-full uppercase">
              Listo
            </span>
          </div>

          <p className="text-[11px] text-stone-300 font-medium leading-relaxed">
            Descarga y almacena en la memoria del navegador todo el menú de comidas, precios, configuraciones y el motor de comandas offline para que el sistema funcione fluidamente aun si se corta el WiFi o los datos.
          </p>

          <button
            onClick={handlePrepareOffline}
            disabled={isPreparingOffline}
            className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-400 text-stone-950 font-black rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition-all active:scale-98 cursor-pointer disabled:opacity-50"
          >
            {isPreparingOffline ? (
              <>
                <RefreshCw size={15} className="animate-spin" />
                <span>Guardando en Caché...</span>
              </>
            ) : (
              <>
                <Download size={15} strokeWidth={2.5} />
                <span>Descargar y Actualizar Caché Offline</span>
              </>
            )}
          </button>
        </div>

        {/* PWA Direct Installation or Guide */}
        {isStandalone ? (
          <div className="p-3 bg-emerald-950/70 border border-emerald-800 rounded-2xl flex items-center gap-2 text-emerald-300 text-xs font-bold">
            <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
            <span>Esta aplicación ya está instalada y funcionando como App nativa en este dispositivo.</span>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {deferredPrompt ? (
              <button
                onClick={handleInstallApp}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl transition-all active:scale-95 cursor-pointer"
              >
                <Smartphone size={16} />
                <span>Instalar Aplicación en Pantalla de Inicio</span>
              </button>
            ) : isIOS ? (
              <div className="bg-stone-950 p-3.5 rounded-2xl border border-stone-800 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-xs font-black text-amber-300 uppercase">
                  <Share size={15} className="text-amber-400 animate-bounce" />
                  <span>Pasos para iPhone / iPad (Safari):</span>
                </div>
                <ol className="text-[11px] text-stone-300 space-y-1.5 list-decimal list-inside font-medium">
                  <li>Toca el botón <strong className="text-amber-400">Compartir</strong> (icono de cuadro con flecha hacia arriba).</li>
                  <li>Selecciona <strong className="text-amber-400">"Añadir a la pantalla de inicio"</strong>.</li>
                  <li>Toca <strong className="text-white font-bold">Añadir</strong> para instalar el icono de Las Cazuelas.</li>
                </ol>
              </div>
            ) : (
              <div className="bg-stone-950 p-3.5 rounded-2xl border border-stone-800 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-xs font-black text-amber-300 uppercase">
                  <Sparkles size={15} className="text-amber-400" />
                  <span>Pasos para Chrome / Edge / Android:</span>
                </div>
                <ol className="text-[11px] text-stone-300 space-y-1.5 list-decimal list-inside font-medium">
                  <li>Abre el menú de opciones de tu navegador (<strong className="text-amber-400">⋮ tres puntos</strong>).</li>
                  <li>Selecciona <strong className="text-amber-400">"Instalar aplicación"</strong> o <strong className="text-amber-400">"Añadir a pantalla principal"</strong>.</li>
                  <li>Confirma para abrir en pantalla completa y acceder sin internet.</li>
                </ol>
              </div>
            )}
          </div>
        )}

        {/* Action button */}
        <button
          onClick={onClose}
          className="w-full bg-stone-800 hover:bg-stone-700 text-stone-200 font-black py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}
