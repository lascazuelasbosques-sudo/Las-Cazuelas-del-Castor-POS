import React, { useState, useEffect } from "react";
import { 
  Smartphone, Monitor, Laptop, Download, CheckCircle2, Share, Bell, X, 
  Wifi, WifiOff, HardDrive, Sparkles, RefreshCw, Layers, ShieldCheck, Users,
  Terminal, Copy, Check, ExternalLink, ArrowRight
} from "lucide-react";
import { preloadMenuCache, preloadUsersCache, getLocalCache } from "../lib/offlineService";
import toast from "react-hot-toast";

interface OfflineInstallerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type PlatformTab = 'android' | 'windows' | 'linux' | 'ios';

export function OfflineInstallerModal({ isOpen, onClose }: OfflineInstallerModalProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [isPreparingOffline, setIsPreparingOffline] = useState(false);
  const [activePlatform, setActivePlatform] = useState<PlatformTab>('android');
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [offlineStats, setOfflineStats] = useState<{ productsCount: number; categoriesCount: number; usersCount: number; isCached: boolean }>({
    productsCount: 0,
    categoriesCount: 0,
    usersCount: 0,
    isCached: false
  });

  useEffect(() => {
    // Detect current platform
    const ua = (typeof window !== 'undefined' ? window.navigator.userAgent : '').toLowerCase();
    if (/android/.test(ua)) {
      setActivePlatform('android');
    } else if (/windows|win32|win64/.test(ua)) {
      setActivePlatform('windows');
    } else if (/linux/.test(ua)) {
      setActivePlatform('linux');
    } else if (/iphone|ipad|ipod|macintosh/.test(ua)) {
      setActivePlatform('ios');
    }

    // Check standalone mode
    const checkStandalone = () => {
      const isStandaloneMedia = window.matchMedia('(display-mode: standalone)').matches;
      const isIOSStandalone = (navigator as any).standalone === true;
      setIsStandalone(isStandaloneMedia || isIOSStandalone);
    };

    checkStandalone();
    window.addEventListener('resize', checkStandalone);

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
    const users = getLocalCache('users') || [];
    setOfflineStats({
      productsCount: products.length,
      categoriesCount: categories.length,
      usersCount: users.length,
      isCached: products.length > 0
    });
  };

  const handleInstallApp = async () => {
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          toast.success('¡Instalación completada exitosamente!', { icon: '📲' });
          setDeferredPrompt(null);
        } else {
          toast('Instalación cancelada en el diálogo', { icon: 'ℹ️' });
        }
      } catch (err) {
        console.error('Error al invocar instalación:', err);
      }
    } else {
      toast('Selecciona tu sistema abajo para ver los pasos de instalación directa.', { icon: 'ℹ️' });
    }
  };

  const handleCopyAppUrl = () => {
    const url = window.location.origin;
    navigator.clipboard.writeText(url);
    setCopiedUrl(true);
    toast.success('URL copiada al portapapeles: ' + url);
    setTimeout(() => setCopiedUrl(false), 2500);
  };

  const handleDownloadLinuxDesktopFile = () => {
    const appUrl = window.location.origin;
    const desktopFileContent = `[Desktop Entry]
Version=1.0
Type=Application
Name=Las Cazuelas del Castor
Comment=Sistema de Comandas, Caja y Punto de Venta
Exec=x-www-browser --app=${appUrl}
Icon=restaurant
Terminal=false
Categories=Office;Finance;Network;
StartupWMClass=las-cazuelas
`;
    const blob = new Blob([desktopFileContent], { type: 'application/x-desktop' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'las-cazuelas.desktop';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Descargado "las-cazuelas.desktop". Dale permisos de ejecución y muévelo a tu escritorio.', {
      duration: 5000,
      icon: '🐧'
    });
  };

  const handlePrepareOffline = async () => {
    setIsPreparingOffline(true);
    try {
      // 1. Warm up menu & users cache in localStorage
      preloadMenuCache();
      preloadUsersCache();
      
      // 2. Pre-cache app shell and static resources in Service Worker Cache if supported
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'PRECACHE_URLS',
          urls: [
            '/', 
            '/index.html', 
            '/manifest.json', 
            '/logo_las_cazuelas_del_castor.jpg',
            '/pwa-192x192.png',
            '/pwa-512x512.png',
            '/pwa-maskable-512x512.png',
            '/apple-touch-icon.png'
          ]
        });
      }

      // 3. Cache in window.caches if available
      if ('caches' in window) {
        const cache = await window.caches.open('cazuelas-pos-v3');
        await cache.addAll([
          '/', 
          '/index.html', 
          '/manifest.json', 
          '/logo_las_cazuelas_del_castor.jpg',
          '/pwa-192x192.png',
          '/pwa-512x512.png',
          '/pwa-maskable-512x512.png',
          '/apple-touch-icon.png'
        ]).catch(() => {});
      }

      updateCacheStats();
      toast.success('¡Menú, platillos y usuarios respaldados para trabajar 100% offline!', {
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
      <div className="bg-stone-900 border-2 border-amber-500/60 text-stone-100 rounded-3xl p-5 md:p-6 max-w-xl w-full shadow-2xl flex flex-col gap-4 relative animate-in fade-in zoom-in-95 duration-200 max-h-[92vh] overflow-y-auto custom-scrollbar">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-stone-400 hover:text-white p-2 rounded-full hover:bg-stone-800 transition-colors cursor-pointer z-10"
          title="Cerrar"
        >
          <X size={20} />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 pr-8">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
            <Download size={26} />
          </div>
          <div>
            <h2 className="text-base font-black uppercase text-amber-400 tracking-wide">
              Instalar Aplicación en tu Dispositivo
            </h2>
            <p className="text-xs text-stone-300 font-medium">
              Compatible con <span className="text-amber-300 font-bold">Android</span>, <span className="text-amber-300 font-bold">Windows</span> y <span className="text-amber-300 font-bold">Linux Mint</span>
            </p>
          </div>
        </div>

        {/* Universal 1-Click Install Button if Prompt is Ready */}
        {deferredPrompt && (
          <div className="p-3.5 bg-gradient-to-r from-emerald-950 to-stone-950 border-2 border-emerald-500/80 rounded-2xl flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase text-emerald-400 flex items-center gap-1.5">
                <Sparkles size={15} />
                ¡Tu dispositivo está listo para instalar!
              </span>
              <span className="text-[10px] bg-emerald-900/80 text-emerald-200 px-2 py-0.5 rounded-full font-bold uppercase">
                1 Clic
              </span>
            </div>
            <p className="text-[11px] text-stone-300">
              Presiona el botón para instalar Las Cazuelas directamente en tu pantalla de inicio o escritorio sin configuraciones manuales.
            </p>
            <button
              onClick={handleInstallApp}
              className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl shadow-emerald-950 transition-all active:scale-98 cursor-pointer"
            >
              <Download size={16} strokeWidth={2.5} />
              <span>Instalar Aplicación Ahora</span>
            </button>
          </div>
        )}

        {/* Standalone Active Banner */}
        {isStandalone && (
          <div className="p-3 bg-emerald-950/80 border border-emerald-800 rounded-2xl flex items-center gap-2.5 text-emerald-300 text-xs font-bold">
            <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
            <span>Esta aplicación ya está instalada y funcionando como aplicación nativa en este sistema.</span>
          </div>
        )}

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
              <span className="text-stone-400 block">Base de Datos Local</span>
              <span className="font-bold text-stone-200">
                {offlineStats.productsCount} platillos • {offlineStats.usersCount} usuarios
              </span>
            </div>
          </div>
        </div>

        {/* Platform Selector Tabs */}
        <div className="flex flex-col gap-2">
          <label className="text-[11px] font-black uppercase text-stone-400 tracking-wider">
            Selecciona tu sistema operativo:
          </label>
          <div className="grid grid-cols-4 gap-1.5 p-1 bg-stone-950 rounded-2xl border border-stone-800">
            <button
              onClick={() => setActivePlatform('android')}
              className={`py-2 px-1 rounded-xl text-xs font-extrabold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                activePlatform === 'android'
                  ? 'bg-amber-500 text-stone-950 shadow-md scale-[1.02]'
                  : 'text-stone-400 hover:text-white hover:bg-stone-900'
              }`}
            >
              <Smartphone size={16} />
              <span className="text-[10px] tracking-tight">Android</span>
            </button>

            <button
              onClick={() => setActivePlatform('windows')}
              className={`py-2 px-1 rounded-xl text-xs font-extrabold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                activePlatform === 'windows'
                  ? 'bg-amber-500 text-stone-950 shadow-md scale-[1.02]'
                  : 'text-stone-400 hover:text-white hover:bg-stone-900'
              }`}
            >
              <Monitor size={16} />
              <span className="text-[10px] tracking-tight">Windows</span>
            </button>

            <button
              onClick={() => setActivePlatform('linux')}
              className={`py-2 px-1 rounded-xl text-xs font-extrabold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                activePlatform === 'linux'
                  ? 'bg-amber-500 text-stone-950 shadow-md scale-[1.02]'
                  : 'text-stone-400 hover:text-white hover:bg-stone-900'
              }`}
            >
              <Laptop size={16} />
              <span className="text-[10px] tracking-tight">Linux Mint</span>
            </button>

            <button
              onClick={() => setActivePlatform('ios')}
              className={`py-2 px-1 rounded-xl text-xs font-extrabold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                activePlatform === 'ios'
                  ? 'bg-amber-500 text-stone-950 shadow-md scale-[1.02]'
                  : 'text-stone-400 hover:text-white hover:bg-stone-900'
              }`}
            >
              <Share size={16} />
              <span className="text-[10px] tracking-tight">iOS / iPad</span>
            </button>
          </div>
        </div>

        {/* Platform-Specific Step Guide */}
        <div className="bg-stone-950 p-4 rounded-2xl border border-stone-800 text-stone-200">
          {/* ANDROID INSTRUCTIONS */}
          {activePlatform === 'android' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-stone-800 pb-2">
                <div className="flex items-center gap-2 text-xs font-black text-amber-400 uppercase">
                  <Smartphone size={16} />
                  <span>Instalación en Android (Celulares y Tablets)</span>
                </div>
                <span className="px-2 py-0.5 bg-emerald-950 text-emerald-300 border border-emerald-800 text-[9px] font-bold rounded-full uppercase">
                  WebAPK Nativa
                </span>
              </div>

              <p className="text-[11px] text-stone-300">
                Al instalar en Android, Las Cazuelas se integra como una aplicación completa con icono en tu pantalla de inicio, notificaciones y pantalla completa sin barras del navegador.
              </p>

              <ol className="text-[11px] text-stone-300 space-y-2 list-decimal list-inside font-medium">
                <li>
                  Abre esta página en <strong className="text-white">Google Chrome</strong>, <strong className="text-white">Brave</strong> o <strong className="text-white">Edge</strong>.
                </li>
                <li>
                  Toca el menú de opciones <strong className="text-amber-400">(⋮ tres puntos)</strong> en la esquina superior derecha.
                </li>
                <li>
                  Selecciona la opción <strong className="text-amber-400">"Instalar aplicación"</strong> o <strong className="text-amber-400">"Añadir a la pantalla principal"</strong>.
                </li>
                <li>
                  Confirma tocando <strong className="text-white font-bold">Instalar</strong>.
                </li>
              </ol>

              {deferredPrompt && (
                <button
                  onClick={handleInstallApp}
                  className="w-full mt-2 py-2.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-black rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-md"
                >
                  <Download size={15} strokeWidth={2.5} />
                  <span>Instalar Directamente en este Android</span>
                </button>
              )}
            </div>
          )}

          {/* WINDOWS INSTRUCTIONS */}
          {activePlatform === 'windows' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-stone-800 pb-2">
                <div className="flex items-center gap-2 text-xs font-black text-amber-400 uppercase">
                  <Monitor size={16} />
                  <span>Instalación en Windows 10 / Windows 11</span>
                </div>
                <span className="px-2 py-0.5 bg-blue-950 text-blue-300 border border-blue-800 text-[9px] font-bold rounded-full uppercase">
                  App de Escritorio
                </span>
              </div>

              <p className="text-[11px] text-stone-300">
                Se instalará como programa de escritorio independiente. Creará un icono en el Escritorio, en el Menú Inicio de Windows y se podrá anclar a la barra de tareas.
              </p>

              <div className="space-y-2 text-[11px]">
                <div className="p-2.5 bg-stone-900 rounded-xl border border-stone-800">
                  <span className="font-bold text-amber-400 block mb-1">Método 1: Barra de Direcciones</span>
                  <p className="text-stone-300">
                    En <strong className="text-white">Google Chrome</strong> o <strong className="text-white">Microsoft Edge</strong>, busca el icono de <strong>Instalar (⊕ o monitor con flecha)</strong> ubicado en el extremo derecho de la barra donde está la dirección web y haz clic en él.
                  </p>
                </div>

                <div className="p-2.5 bg-stone-900 rounded-xl border border-stone-800">
                  <span className="font-bold text-amber-400 block mb-1">Método 2: Menú del Navegador</span>
                  <ol className="list-decimal list-inside space-y-1 text-stone-300">
                    <li>Haz clic en el menú <strong className="text-amber-400">⋮ (tres puntos)</strong> en Chrome o Edge.</li>
                    <li>Ve a <strong className="text-amber-400">"Aplicaciones"</strong> o <strong className="text-amber-400">"Guardar y compartir"</strong>.</li>
                    <li>Selecciona <strong className="text-white font-bold">"Instalar Las Cazuelas del Castor"</strong>.</li>
                  </ol>
                </div>
              </div>

              {deferredPrompt && (
                <button
                  onClick={handleInstallApp}
                  className="w-full mt-2 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-md"
                >
                  <Download size={15} strokeWidth={2.5} />
                  <span>Instalar en Windows Ahora</span>
                </button>
              )}
            </div>
          )}

          {/* LINUX MINT INSTRUCTIONS */}
          {activePlatform === 'linux' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-stone-800 pb-2">
                <div className="flex items-center gap-2 text-xs font-black text-amber-400 uppercase">
                  <Laptop size={16} />
                  <span>Instalación en Linux Mint (Cinnamon / MATE / XFCE)</span>
                </div>
                <span className="px-2 py-0.5 bg-emerald-950 text-emerald-300 border border-emerald-800 text-[9px] font-bold rounded-full uppercase">
                  Nativo Linux
                </span>
              </div>

              <p className="text-[11px] text-stone-300">
                Linux Mint cuenta con excelente soporte para aplicaciones web. Puedes instalarla mediante el navegador Chromium/Chrome o con la herramienta oficial de Linux Mint <strong>"Aplicaciones Web"</strong>.
              </p>

              <div className="space-y-2 text-[11px]">
                {/* Linux Mint Web App Manager */}
                <div className="p-3 bg-stone-900 rounded-xl border border-emerald-900/60 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-emerald-400 text-xs">⭐ Recomendado: Herramienta "Aplicaciones Web" de Linux Mint</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1 text-stone-300">
                    <li>Abre el Menú de Linux Mint y escribe <strong className="text-white">"Aplicaciones Web"</strong> (Web Apps).</li>
                    <li>Haz clic en el botón <strong className="text-amber-400">+ (Añadir)</strong>.</li>
                    <li>En Nombre escribe: <strong className="text-white">Las Cazuelas del Castor</strong>.</li>
                    <li>
                      En Dirección pega la URL de la aplicación:
                      <div className="flex items-center gap-2 mt-1">
                        <code className="px-2 py-1 bg-black rounded text-[10px] text-amber-300 font-mono flex-1 truncate">
                          {typeof window !== 'undefined' ? window.location.origin : ''}
                        </code>
                        <button
                          onClick={handleCopyAppUrl}
                          className="px-2.5 py-1 bg-stone-800 hover:bg-stone-700 text-white rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                        >
                          {copiedUrl ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                          <span>{copiedUrl ? '¡Copiada!' : 'Copiar URL'}</span>
                        </button>
                      </div>
                    </li>
                    <li>Selecciona tu navegador favorito y categoría (Oficina o Internet) y haz clic en <strong>Aceptar</strong>.</li>
                  </ol>
                  <p className="text-[10px] text-stone-400 italic">
                    ¡Listo! Aparecerá de forma nativa en tu Menú de Linux Mint como cualquier programa del sistema.
                  </p>
                </div>

                {/* Chrome / Chromium in Linux */}
                <div className="p-2.5 bg-stone-900 rounded-xl border border-stone-800">
                  <span className="font-bold text-amber-400 block mb-1">Método Navegador (Chromium / Chrome / Brave)</span>
                  <p className="text-stone-300 leading-relaxed">
                    Haz clic en el icono <strong>Instalar (⊕)</strong> en la barra de direcciones o en el menú <strong>(⋮) → "Guardar y compartir" → "Instalar página como aplicación"</strong>. Se generará automáticamente el archivo de inicio en <code>~/.local/share/applications/</code>.
                  </p>
                </div>

                {/* Direct .desktop file */}
                <div className="p-2.5 bg-stone-900 rounded-xl border border-stone-800 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="font-bold text-white text-xs block">Lanzador .desktop para Escritorio</span>
                    <span className="text-[10px] text-stone-400 block">Descarga el acceso directo listo para tu escritorio de Linux Mint.</span>
                  </div>
                  <button
                    onClick={handleDownloadLinuxDesktopFile}
                    className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-amber-300 border border-amber-500/40 font-bold rounded-xl text-[10px] uppercase flex items-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    <Download size={13} />
                    <span>Descargar .desktop</span>
                  </button>
                </div>
              </div>

              {deferredPrompt && (
                <button
                  onClick={handleInstallApp}
                  className="w-full mt-2 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-md"
                >
                  <Download size={15} strokeWidth={2.5} />
                  <span>Instalar PWA en Linux Mint Ahora</span>
                </button>
              )}
            </div>
          )}

          {/* IOS INSTRUCTIONS */}
          {activePlatform === 'ios' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-stone-800 pb-2">
                <div className="flex items-center gap-2 text-xs font-black text-amber-400 uppercase">
                  <Share size={16} />
                  <span>Instalación en iPhone / iPad (Safari)</span>
                </div>
                <span className="px-2 py-0.5 bg-stone-800 text-stone-300 border border-stone-700 text-[9px] font-bold rounded-full uppercase">
                  Safari iOS
                </span>
              </div>

              <p className="text-[11px] text-stone-300">
                En dispositivos Apple (iOS / iPadOS), la instalación se realiza a través de Safari mediante la opción de la pantalla de inicio.
              </p>

              <ol className="text-[11px] text-stone-300 space-y-2 list-decimal list-inside font-medium">
                <li>
                  Abre esta página en el navegador <strong className="text-white">Safari</strong>.
                </li>
                <li>
                  Toca el botón <strong className="text-amber-400">Compartir</strong> (icono de cuadrado con flecha hacia arriba en la barra inferior).
                </li>
                <li>
                  Desplázate hacia abajo y selecciona <strong className="text-amber-400">"Añadir a la pantalla de inicio"</strong>.
                </li>
                <li>
                  Toca <strong className="text-white font-bold">Añadir</strong> en la esquina superior derecha.
                </li>
              </ol>
            </div>
          )}
        </div>

        {/* Offline Cache Preload Section */}
        <div className="bg-stone-950 p-4 rounded-2xl border border-amber-500/30 flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-black uppercase text-amber-300">
              <Layers size={16} className="text-amber-400" />
              <span>Preparar Modo Fuera de Línea</span>
            </div>
            <span className="px-2 py-0.5 bg-emerald-950 text-emerald-400 border border-emerald-800 text-[9px] font-extrabold rounded-full uppercase">
              100% Offline
            </span>
          </div>

          <p className="text-[11px] text-stone-300 font-medium leading-relaxed">
            Descarga en la memoria local de tu equipo todo el menú de comidas, precios y datos para que puedas seguir levantando comandas y cobrando aun cuando se corte el internet o falle el router WiFi.
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

        {/* Footer Close Button */}
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
