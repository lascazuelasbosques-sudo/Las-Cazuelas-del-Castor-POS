import React, { useState, useEffect, useRef } from 'react';
import { Lock, Unlock, Maximize2, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';

interface FullScreenLockProps {
  compact?: boolean;
}

export function FullScreenLockControl({ compact = false }: FullScreenLockProps) {
  const [isLocked, setIsLocked] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const wakeLockRef = useRef<any>(null);

  // Monitor Fullscreen status and enforce lock if exited unexpectedly
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFull = !!document.fullscreenElement;
      setIsFullscreen(isFull);

      // If fullscreen was exited while lock is active, force re-entry
      if (!isFull && isLocked) {
        toast('Manteniendo pantalla completa bloqueada', { icon: '🔒' });
        setTimeout(() => {
          document.documentElement.requestFullscreen().catch(() => {});
        }, 100);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [isLocked]);

  // Manage Screen Wake Lock to prevent phone display from turning off or sleeping
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
    if (!isLocked) {
      // Activate Fullscreen Lock
      try {
        if (!document.fullscreenElement) {
          await document.documentElement.requestFullscreen().catch(() => {});
        }
      } catch (e) {
        console.warn('Fullscreen error:', e);
      }

      if (navigator.vibrate) {
        try { navigator.vibrate([80, 40, 80]); } catch (e) {}
      }

      setIsLocked(true);
      toast.success('🔒 Maximización Bloqueada (No se saldrá de pantalla completa)', {
        icon: '🔒',
        duration: 3500
      });
    } else {
      // Deactivate Lock
      if (navigator.vibrate) {
        try { navigator.vibrate(150); } catch (e) {}
      }
      setIsLocked(false);
      toast.success('🔓 Bloqueo de Maximización Desactivado', { icon: '🔓' });
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
        title={isLocked ? 'Maximización Bloqueada. Clic para desbloquear' : 'Bloquear Maximización (Evitar salir de Pantalla Completa)'}
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
      title={isLocked ? 'Desbloquear Pantalla Completa' : 'Bloquear Maximización en Pantalla Completa'}
    >
      {isLocked ? (
        <>
          <Lock size={18} className="text-stone-950 shrink-0" />
          <span className="hidden lg:inline">Maximización Bloqueada</span>
        </>
      ) : (
        <>
          <Maximize2 size={18} className="text-amber-500 shrink-0" />
          <span className="hidden lg:inline">Bloquear Maximización</span>
        </>
      )}
    </button>
  );
}

