import React, { useState, useEffect, useRef } from 'react';
import { Lock, Maximize2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface FullScreenLockProps {
  compact?: boolean;
}

export function FullScreenLockControl({ compact = false }: FullScreenLockProps) {
  const [isLocked, setIsLocked] = useState<boolean>(() => {
    try {
      return localStorage.getItem('pos_fullscreen_locked') === 'true';
    } catch (e) {
      return false;
    }
  });
  const wakeLockRef = useRef<any>(null);

  // Keep state in sync if triggered elsewhere
  useEffect(() => {
    const handleLockSync = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail && typeof customEvent.detail.isLocked === 'boolean') {
        setIsLocked(customEvent.detail.isLocked);
      }
    };
    window.addEventListener('pos_lock_changed', handleLockSync);
    return () => window.removeEventListener('pos_lock_changed', handleLockSync);
  }, []);

  // Screen Wake Lock API to prevent mobile / tablet sleep
  useEffect(() => {
    if (isLocked && 'wakeLock' in navigator) {
      (navigator as any).wakeLock?.request('screen')
        .then((lock: any) => {
          wakeLockRef.current = lock;
        })
        .catch(() => {});
    } else if (!isLocked && wakeLockRef.current) {
      wakeLockRef.current.release().catch(() => {});
      wakeLockRef.current = null;
    }
  }, [isLocked]);

  const toggleLock = async () => {
    const nextState = !isLocked;
    setIsLocked(nextState);
    try {
      if (nextState) {
        localStorage.setItem('pos_fullscreen_locked', 'true');
      } else {
        localStorage.removeItem('pos_fullscreen_locked');
      }
    } catch (e) {}
    window.dispatchEvent(new CustomEvent('pos_lock_changed', { detail: { isLocked: nextState } }));

    if (nextState) {
      // Activate Fullscreen Lock
      try {
        const doc = document as any;
        const docElm = document.documentElement as any;
        if (!doc.fullscreenElement && !doc.webkitFullscreenElement) {
          const req = docElm.requestFullscreen || docElm.webkitRequestFullscreen;
          if (req) await req.call(docElm).catch(() => {});
        }
      } catch (e) {
        // App.tsx listener enforces simulated full screen
      }

      if (navigator.vibrate) {
        try { navigator.vibrate([80, 40, 80]); } catch (e) {}
      }

      toast.success('🔒 Pantalla Completa Bloqueada (Fija)', {
        icon: '🔒',
        id: 'lock-fs-toast',
        duration: 3000
      });
    } else {
      // Deactivate Lock
      if (navigator.vibrate) {
        try { navigator.vibrate(100); } catch (e) {}
      }

      toast.success('🔓 Bloqueo de Pantalla Completa Desactivado', {
        icon: '🔓',
        id: 'lock-fs-toast',
        duration: 2500
      });
    }
  };

  if (compact) {
    return (
      <button
        onClick={toggleLock}
        className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-extrabold uppercase tracking-wider transition-all cursor-pointer shrink-0 ${
          isLocked
            ? 'bg-amber-500 text-stone-950 border-amber-400 shadow-sm animate-pulse'
            : 'bg-stone-900/80 hover:bg-stone-800 text-stone-300 border-stone-800'
        }`}
        title={isLocked ? 'Pantalla Completa Bloqueada. Clic para desbloquear' : 'Bloquear Pantalla Completa (Evitar salir de Full Screen)'}
      >
        {isLocked ? (
          <>
            <Lock size={12} className="text-stone-950 shrink-0" />
            <span>Bloqueada</span>
          </>
        ) : (
          <>
            <Maximize2 size={12} className="text-amber-400 shrink-0" />
            <span>Bloquear</span>
          </>
        )}
      </button>
    );
  }

  return (
    <button
      onClick={toggleLock}
      className={`flex items-center justify-center lg:justify-start gap-3 w-full px-0 lg:px-4 h-[40px] rounded-xl text-xs font-extrabold transition-all cursor-pointer shadow-sm border ${
        isLocked
          ? 'bg-amber-500 text-stone-950 border-amber-400 hover:bg-amber-400'
          : 'bg-white text-stone-700 hover:bg-amber-50 hover:text-amber-900 border-stone-200'
      }`}
      title={isLocked ? 'Desbloquear Pantalla Completa' : 'Bloquear en Pantalla Completa'}
    >
      {isLocked ? (
        <>
          <Lock size={18} className="text-stone-950 shrink-0" />
          <span className="hidden lg:inline">Pantalla Completa Bloqueada</span>
        </>
      ) : (
        <>
          <Maximize2 size={18} className="text-amber-500 shrink-0" />
          <span className="hidden lg:inline">Bloquear Pantalla Completa</span>
        </>
      )}
    </button>
  );
}


