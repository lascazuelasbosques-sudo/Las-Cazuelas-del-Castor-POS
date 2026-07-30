import React, { useState, useEffect } from 'react';
import { Play, Pause, SkipForward, Disc, Music, Eye } from 'lucide-react';
import { cn } from '../lib/utils';

export interface DiscreteMiniPlayerProps {
  compact?: boolean;
  onNavigateToMusic?: () => void;
}

export const DiscreteMiniPlayer: React.FC<DiscreteMiniPlayerProps> = ({
  compact = false,
  onNavigateToMusic
}) => {
  const [isPC, setIsPC] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [trackTitle, setTrackTitle] = useState('YouTube Music');
  const [artist, setArtist] = useState('Música Restaurante');
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);

  useEffect(() => {
    const checkDevice = () => {
      const isWideScreen = window.innerWidth >= 1024;
      const userAgentMobile = /Mobi|Android|iPhone|iPad|iPod|Windows Phone/i.test(navigator.userAgent);
      setIsPC(isWideScreen && !userAgentMobile);
    };

    checkDevice();
    window.addEventListener('resize', checkDevice);
    return () => window.removeEventListener('resize', checkDevice);
  }, []);

  useEffect(() => {
    const handleStateUpdate = (e: any) => {
      const detail = e.detail;
      if (!detail) return;
      if (typeof detail.isPlaying === 'boolean') setIsPlaying(detail.isPlaying);
      if (detail.currentTrack) {
        setTrackTitle(detail.currentTrack.title || 'YouTube Music');
        setArtist(detail.currentTrack.artist || 'Música');
        setThumbnailUrl(detail.currentTrack.thumbnailUrl || null);
      } else if (detail.playlistTitle) {
        setTrackTitle(detail.playlistTitle);
      }
    };

    window.addEventListener('pos-music-state', handleStateUpdate);
    return () => window.removeEventListener('pos-music-state', handleStateUpdate);
  }, []);

  const sendCommand = (cmd: string) => {
    window.dispatchEvent(new CustomEvent('pos-music-command', { detail: { command: cmd } }));
  };

  // Allow mini player on all screen sizes

  if (compact) {
    return (
      <div className="flex items-center gap-1 px-2 py-1 bg-stone-900/90 hover:bg-stone-800/90 border border-stone-800 text-stone-200 rounded-lg shadow-sm text-xs shrink-0 select-none">
        <button
          onClick={onNavigateToMusic}
          className="flex items-center gap-1.5 cursor-pointer hover:text-white transition-colors min-w-0"
          title={`Reproductor: ${trackTitle}`}
        >
          <Disc className={cn("w-3.5 h-3.5 shrink-0 text-red-500", isPlaying && "animate-spin [animation-duration:3s]")} />
          <span className="text-[10px] font-bold text-stone-200 truncate max-w-[70px] sm:max-w-[100px]">
            {trackTitle}
          </span>
        </button>

        <div className="flex items-center gap-0.5 border-l border-stone-800 pl-1 shrink-0">
          <button
            onClick={() => sendCommand('togglePlayPause')}
            className="p-1 text-stone-300 hover:text-white cursor-pointer transition-colors"
            title={isPlaying ? "Pausar" : "Reproducir"}
          >
            {isPlaying ? <Pause className="w-3 h-3 fill-white" /> : <Play className="w-3 h-3 fill-white ml-0.5" />}
          </button>
          <button
            onClick={() => sendCommand('next')}
            className="p-1 text-stone-400 hover:text-white cursor-pointer transition-colors"
            title="Siguiente canción"
          >
            <SkipForward className="w-3 h-3" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-stone-900/90 border border-stone-800/80 p-2 rounded-xl text-white flex items-center justify-between gap-2 shadow-xs select-none">
      <div 
        onClick={onNavigateToMusic}
        className="flex items-center gap-2 min-w-0 cursor-pointer group flex-1"
      >
        <div className="w-8 h-8 rounded-lg bg-stone-950 border border-stone-800 overflow-hidden shrink-0 relative flex items-center justify-center">
          {thumbnailUrl ? (
            <img src={thumbnailUrl} alt={trackTitle} className="w-full h-full object-cover" />
          ) : (
            <Music className="w-4 h-4 text-stone-600" />
          )}
          {isPlaying && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <span className="text-[8px] font-black uppercase text-red-400 tracking-wider block leading-none mb-0.5">
            {isPlaying ? 'Sonando' : 'Música'}
          </span>
          <h4 className="text-[11px] font-bold text-stone-100 truncate group-hover:text-red-400 transition-colors leading-tight">
            {trackTitle}
          </h4>
          <p className="text-[9px] text-stone-400 truncate leading-tight">{artist}</p>
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => sendCommand('togglePlayPause')}
          className="w-7 h-7 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow cursor-pointer transition-transform active:scale-95"
          title={isPlaying ? "Pausar" : "Reproducir"}
        >
          {isPlaying ? <Pause className="w-3.5 h-3.5 fill-white" /> : <Play className="w-3.5 h-3.5 fill-white ml-0.5" />}
        </button>

        <button
          onClick={() => sendCommand('next')}
          className="p-1.5 text-stone-400 hover:text-white rounded-lg hover:bg-stone-800 cursor-pointer transition-colors"
          title="Siguiente"
        >
          <SkipForward className="w-3.5 h-3.5" />
        </button>

        {onNavigateToMusic && (
          <button
            onClick={onNavigateToMusic}
            className="p-1.5 text-amber-400 hover:text-amber-300 rounded-lg hover:bg-stone-800 cursor-pointer transition-colors"
            title="Abrir reproductor completo"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
