import React, { useState, useEffect } from 'react';
import { Play, Pause, SkipForward, Volume1, Volume2, Music } from 'lucide-react';
import { cn } from '../lib/utils';

export interface DiscreteMiniPlayerProps {
  compact?: boolean;
  onNavigateToMusic?: () => void;
}

export const DiscreteMiniPlayer: React.FC<DiscreteMiniPlayerProps> = ({
  compact = false,
  onNavigateToMusic
}) => {
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const handleStateUpdate = (e: any) => {
      const detail = e.detail;
      if (!detail) return;
      if (typeof detail.isPlaying === 'boolean') setIsPlaying(detail.isPlaying);
    };

    window.addEventListener('pos-music-sync', handleStateUpdate);
    window.addEventListener('pos-music-state', handleStateUpdate);
    return () => {
      window.removeEventListener('pos-music-sync', handleStateUpdate);
      window.removeEventListener('pos-music-state', handleStateUpdate);
    };
  }, []);

  const sendCommand = (cmd: string) => {
    window.dispatchEvent(new CustomEvent('pos-music-command', { detail: { command: cmd } }));
  };

  return (
    <div className={cn(
      "flex items-center justify-between bg-stone-900/95 border border-stone-800 rounded-xl text-stone-200 shadow-sm select-none shrink-0 transition-all",
      compact ? "px-1.5 py-0.5 gap-1" : "px-2 py-0.5 gap-1.5"
    )}>
      {/* Small Music Indicator (Discreet link to music tab) */}
      <button
        onClick={onNavigateToMusic}
        className="flex items-center gap-1 cursor-pointer text-stone-400 hover:text-white transition-colors"
        title="Ver Reproductor de Música"
      >
        <Music className={cn("w-3 h-3 text-red-500", isPlaying && "animate-pulse")} />
        {!compact && <span className="text-[9px] font-black tracking-tight uppercase text-stone-400">Música</span>}
      </button>

      {/* Control Buttons */}
      <div className="flex items-center gap-0.5">
        {/* Play/Pause */}
        <button
          onClick={() => sendCommand(isPlaying ? 'pause' : 'play')}
          className="p-1 text-stone-300 hover:text-white hover:bg-stone-800 rounded-lg cursor-pointer transition-colors"
          title={isPlaying ? "Pausar" : "Reproducir"}
        >
          {isPlaying ? <Pause className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current" />}
        </button>

        {/* Siguiente */}
        <button
          onClick={() => sendCommand('next')}
          className="p-1 text-stone-300 hover:text-white hover:bg-stone-800 rounded-lg cursor-pointer transition-colors"
          title="Siguiente"
        >
          <SkipForward className="w-3 h-3" />
        </button>

        <span className="text-stone-800 mx-0.5 text-[8px]">|</span>

        {/* Bajar Volumen */}
        <button
          onClick={() => sendCommand('volumeDown')}
          className="p-1 text-stone-400 hover:text-white hover:bg-stone-800 rounded-lg cursor-pointer transition-colors"
          title="Bajar Volumen"
        >
          <Volume1 className="w-3 h-3" />
        </button>

        {/* Subir Volumen */}
        <button
          onClick={() => sendCommand('volumeUp')}
          className="p-1 text-stone-400 hover:text-white hover:bg-stone-800 rounded-lg cursor-pointer transition-colors"
          title="Subir Volumen"
        >
          <Volume2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};
