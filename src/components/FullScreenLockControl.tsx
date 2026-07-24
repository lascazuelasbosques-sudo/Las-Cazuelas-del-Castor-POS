import React, { useState, useEffect, useRef } from 'react';
import { Lock, Unlock, Maximize2, ShieldAlert, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';

interface FullScreenLockProps {
  compact?: boolean;
}

export function FullScreenLockControl({ compact = false }: FullScreenLockProps) {
  const [isLocked, setIsLocked] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const holdIntervalRef = useRef<any>(null);
  const wakeLockRef = useRef<any>(null);

  // Monitor Fullscreen status
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Request Wake Lock while screen locked
  useEffect(() => {
    if (isLocked && 'wakeLock' in navigator) {
      (navigator as any).wakeLock?.request('screen').then((lock: any) => {
        wakeLockRef.current = lock;
      }).catch((e: any) => console.log('Wake Lock info:', e));
    } else if (!isLocked && wakeLockRef.current) {
      wakeLockRef.current.release().catch(() => {});
      wakeLockRef.current = null;
    }
  }, [isLocked]);

  const lockScreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen().catch(() => {});
      }
    } catch (e) {
      console.warn('Fullscreen error:', e);
    }

    if (navigator.vibrate) {
      try { navigator.vibrate([100, 50, 100]); } catch (e) {}
    }

    setIsLocked(true);
    toast.success('🔒 Pantalla Bloqueada (Modo Pantalla Completa)', {
      icon: '🔒',
      duration: 3000
    });
  };

  const startUnlockHold = () => {
    setHoldProgress(0);
    let count = 0;
    holdIntervalRef.current = setInterval(() => {
      count += 10;
      setHoldProgress(count);
      if (count >= 100) {
        clearInterval(holdIntervalRef.current);
        unlockScreen();
      }
    }, 100);
  };

  const stopUnlockHold = () => {
    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
    setHoldProgress(0);
  };

  const unlockScreen = () => {
    if (navigator.vibrate) {
      try { navigator.vibrate(200); } catch (e) {}
    }
    setIsLocked(false);
    setHoldProgress(0);
    toast.success('🔓 Pantalla Desbloqueada', { icon: '🔓' });
  };

  return (
    <>
      {/* Lock Button trigger */}
      {compact ? (
        <button
          onClick={lockScreen}
          className="flex flex-col items-center gap-1 p-2 rounded-xl text-stone-600 hover:bg-stone-50 shrink-0 transition-all active:scale-95 cursor-pointer"
          title="Bloquear Pantalla Completa"
        >
          <Lock size={21} className="text-amber-500" />
          <span className="text-[9px] font-extrabold whitespace-nowrap">Bloquear</span>
        </button>
      ) : (
        <button
          onClick={lockScreen}
          className="flex items-center justify-center lg:justify-start gap-3 w-full border border-stone-200 bg-white text-stone-700 hover:bg-amber-50 hover:text-amber-900 hover:border-amber-300 px-0 lg:px-4 h-[40px] rounded-xl text-xs font-extrabold transition-all active:scale-98 cursor-pointer shadow-sm"
          title="Bloquear Pantalla Completa contra toques accidentales"
        >
          <Lock size={18} className="text-amber-500 shrink-0" />
          <span className="hidden lg:inline">Bloquear Pantalla</span>
        </button>
      )}

      {/* Screen Lock Overlay */}
      {isLocked && (
        <div 
          className="fixed inset-0 z-[9999] bg-stone-950/70 backdrop-blur-xs flex flex-col items-center justify-between p-6 select-none animate-in fade-in duration-200"
          style={{ touchAction: 'none' }}
        >
          {/* Top Status */}
          <div className="flex items-center gap-2 bg-stone-900/90 text-amber-400 border border-amber-500/40 px-4 py-2 rounded-full shadow-2xl text-xs font-black uppercase tracking-wider animate-pulse">
            <Lock size={16} />
            <span>Pantalla Bloqueada • Las Cazuelas del Castor</span>
          </div>

          {/* Center Unlock Holding Area */}
          <div className="flex flex-col items-center justify-center gap-4 text-center my-auto">
            <div className="relative">
              {/* Progress Ring / Outer glow */}
              <div 
                className="w-28 h-28 rounded-full border-4 border-amber-500/20 bg-stone-900/90 shadow-2xl flex items-center justify-center transition-transform active:scale-95 cursor-pointer"
                onMouseDown={startUnlockHold}
                onMouseUp={stopUnlockHold}
                onMouseLeave={stopUnlockHold}
                onTouchStart={startUnlockHold}
                onTouchEnd={stopUnlockHold}
              >
                <div 
                  className="absolute inset-0 rounded-full border-4 border-amber-500 transition-all duration-100"
                  style={{
                    clipPath: `inset(${100 - holdProgress}% 0 0 0)`
                  }}
                />
                <div className="flex flex-col items-center gap-1 text-amber-400">
                  <Unlock size={32} className={holdProgress > 0 ? "scale-110 text-amber-300" : ""} />
                  <span className="text-[10px] font-black uppercase tracking-wider">
                    {holdProgress > 0 ? `${holdProgress}%` : 'MANTÉN'}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-1 max-w-xs">
              <p className="text-stone-200 text-xs font-bold uppercase tracking-wide">
                Mantén presionado 1 segundo
              </p>
              <p className="text-stone-400 text-[10px]">
                Protección contra toques accidentales en comandas o mesas
              </p>
            </div>
          </div>

          {/* Bottom Footer Info */}
          <div className="text-[10px] font-mono text-stone-500 uppercase tracking-widest">
            Dispositivo en protección activa
          </div>
        </div>
      )}
    </>
  );
}
