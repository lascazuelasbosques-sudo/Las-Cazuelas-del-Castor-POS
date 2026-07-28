import React, { useState, useEffect, useRef } from 'react';
import { Music, Play, Pause, Volume2, VolumeX, Radio, Disc, Sparkles, X, Minus, Move, GripHorizontal, ListMusic, Heart, RefreshCw } from 'lucide-react';

interface LatinMusicWidgetProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

export interface Station {
  id: string;
  name: string;
  genre: 'Salsa' | 'Pop Latino' | 'Rock en Español' | 'Cumbia' | 'Bachata & Merengue' | 'Regional Mexicano' | 'Urbana & Reggaeton';
  streamUrl: string;
  backupUrl?: string;
  description: string;
  icon: string;
  color: string;
}

const LATIN_STATIONS: Station[] = [
  {
    id: 'salsa-hits',
    name: 'Radio Salsa Brava',
    genre: 'Salsa',
    streamUrl: 'https://stream.zeno.fm/f3wvbbqmdg8uv',
    backupUrl: 'https://stream.zeno.fm/6s81a03fbeuvv',
    description: 'Los mejores clasicos y éxitos de Salsa dura, brava y romántica.',
    icon: '🎺',
    color: 'from-red-600 to-amber-600'
  },
  {
    id: 'pop-latino',
    name: 'Exa Pop Latino FM',
    genre: 'Pop Latino',
    streamUrl: 'https://stream.zeno.fm/3sghq4z5euvv',
    backupUrl: 'https://stream.zeno.fm/381y91v5euvv',
    description: 'Pop en español, baladas y hits del momento en Latinoamérica.',
    icon: '🎙️',
    color: 'from-pink-500 to-rose-600'
  },
  {
    id: 'rock-espanol',
    name: 'Rock en Español 80/90s',
    genre: 'Rock en Español',
    streamUrl: 'https://stream.zeno.fm/u9v3xbrfbeuvv',
    backupUrl: 'https://stream.zeno.fm/q5b3f11z5euvv',
    description: 'Soda Stereo, Caifanes, Mana, Enanitos Verdes y leyendas del rock.',
    icon: '🎸',
    color: 'from-purple-700 to-indigo-900'
  },
  {
    id: 'cumbia-sonidera',
    name: 'Cumbias Inmortales & Fiesta',
    genre: 'Cumbia',
    streamUrl: 'https://stream.zeno.fm/xbb1u53fbeuvv',
    backupUrl: 'https://stream.zeno.fm/f8z0p53fbeuvv',
    description: 'Cumbia colombiana, mexicana, sonidera y tropical para alegrar el día.',
    icon: '🪗',
    color: 'from-amber-500 to-yellow-600'
  },
  {
    id: 'bachata-merengue',
    name: 'Bachata & Merengue Mix',
    genre: 'Bachata & Merengue',
    streamUrl: 'https://stream.zeno.fm/0545s41z5euvv',
    backupUrl: 'https://stream.zeno.fm/1r2s3v4fbeuvv',
    description: 'Ritmos caribeños, Romeo Santos, Juan Luis Guerra y merengue bailable.',
    icon: '🌴',
    color: 'from-blue-600 to-cyan-600'
  },
  {
    id: 'regional-mexicano',
    name: 'La Banda & Regional Mexicano',
    genre: 'Regional Mexicano',
    streamUrl: 'https://stream.zeno.fm/381y91v5euvv',
    backupUrl: 'https://stream.zeno.fm/3sghq4z5euvv',
    description: 'Mariachi, Norteño, Banda y Corridos tradicionales.',
    icon: '🎺',
    color: 'from-emerald-600 to-teal-800'
  },
  {
    id: 'reggaeton-urbana',
    name: 'Urban Hits Latino',
    genre: 'Urbana & Reggaeton',
    streamUrl: 'https://stream.zeno.fm/1r2s3v4fbeuvv',
    backupUrl: 'https://stream.zeno.fm/f3wvbbqmdg8uv',
    description: 'Reggaetón, Trap latino y ritmos urbanos del momento.',
    icon: '🔥',
    color: 'from-orange-600 to-red-700'
  }
];

export const LatinMusicWidget: React.FC<LatinMusicWidgetProps> = ({ isOpen, setIsOpen }) => {
  const [currentStation, setCurrentStation] = useState<Station>(LATIN_STATIONS[0]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [selectedGenre, setSelectedGenre] = useState<string>('Todos');
  const [hasError, setHasError] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Position & dragging states
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; posX: number; posY: number }>({ x: 0, y: 0, posX: 0, posY: 0 });

  // Default position
  useEffect(() => {
    if (typeof window !== 'undefined' && position === null) {
      const initialX = Math.max(16, window.innerWidth - 440);
      const initialY = Math.max(20, window.innerHeight - 560);
      setPosition({ x: initialX, y: initialY });
    }
  }, [position]);

  // Audio object initialization and controls
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
    }
    const audio = audioRef.current;
    audio.volume = isMuted ? 0 : volume;

    const handleCanPlay = () => {
      setIsLoading(false);
      setHasError(false);
    };

    const handleError = () => {
      setIsLoading(false);
      setIsPlaying(false);
      setHasError(true);
    };

    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('error', handleError);
    };
  }, [volume, isMuted]);

  // Handle station change or playback toggle
  const changeStation = (station: Station) => {
    setCurrentStation(station);
    setHasError(false);
    setIsLoading(true);

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = station.streamUrl;
      audioRef.current.load();
      audioRef.current.play()
        .then(() => {
          setIsPlaying(true);
          setIsLoading(false);
        })
        .catch(() => {
          // If primary stream fails, try backup
          if (station.backupUrl && audioRef.current) {
            audioRef.current.src = station.backupUrl;
            audioRef.current.load();
            audioRef.current.play()
              .then(() => {
                setIsPlaying(true);
                setIsLoading(false);
              })
              .catch(() => {
                setIsPlaying(false);
                setIsLoading(false);
                setHasError(true);
              });
          } else {
            setIsPlaying(false);
            setIsLoading(false);
            setHasError(true);
          }
        });
    }
  };

  const togglePlay = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      setIsLoading(true);
      setHasError(false);
      if (!audioRef.current.src || audioRef.current.src === '') {
        audioRef.current.src = currentStation.streamUrl;
      }
      audioRef.current.play()
        .then(() => {
          setIsPlaying(true);
          setIsLoading(false);
        })
        .catch(() => {
          setIsLoading(false);
          setIsPlaying(false);
          setHasError(true);
        });
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (audioRef.current) {
      audioRef.current.volume = val;
    }
    if (val > 0 && isMuted) {
      setIsMuted(false);
    }
  };

  const toggleMute = () => {
    const newMuteState = !isMuted;
    setIsMuted(newMuteState);
    if (audioRef.current) {
      audioRef.current.volume = newMuteState ? 0 : volume;
    }
  };

  // Dragging logic
  const handleMouseDownDrag = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, input')) return;
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      posX: position ? position.x : 20,
      posY: position ? position.y : 20,
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaX = e.clientX - dragStartRef.current.x;
      const deltaY = e.clientY - dragStartRef.current.y;
      const newX = Math.max(-100, Math.min(window.innerWidth - 120, dragStartRef.current.posX + deltaX));
      const newY = Math.max(0, Math.min(window.innerHeight - 80, dragStartRef.current.posY + deltaY));
      setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  if (!isOpen) return null;

  const genres = ['Todos', 'Salsa', 'Pop Latino', 'Rock en Español', 'Cumbia', 'Bachata & Merengue', 'Regional Mexicano', 'Urbana & Reggaeton'];

  const filteredStations = selectedGenre === 'Todos'
    ? LATIN_STATIONS
    : LATIN_STATIONS.filter(s => s.genre === selectedGenre);

  // Minimized Bar State
  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-16 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
        <div className="bg-stone-900/95 text-white border-2 border-amber-500/80 rounded-2xl p-2 shadow-2xl flex items-center gap-3 backdrop-blur-md hover:scale-105 transition-all">
          <button
            onClick={togglePlay}
            className={`p-2.5 rounded-xl font-bold transition-all cursor-pointer ${
              isPlaying
                ? 'bg-amber-500 text-stone-950 shadow-md shadow-amber-500/30'
                : 'bg-stone-800 text-amber-400 hover:bg-stone-700'
            }`}
            title={isPlaying ? 'Pausar Música' : 'Reproducir Música'}
          >
            {isLoading ? (
              <RefreshCw size={16} className="animate-spin text-stone-950" />
            ) : isPlaying ? (
              <Pause size={16} />
            ) : (
              <Play size={16} className="ml-0.5" />
            )}
          </button>

          <button
            onClick={() => setIsMinimized(false)}
            className="flex items-center gap-2 cursor-pointer text-left"
          >
            <div className="p-1.5 bg-amber-500/20 text-amber-400 rounded-lg">
              <Radio size={16} className={isPlaying ? "animate-pulse" : ""} />
            </div>
            <div>
              <p className="text-xs font-bold text-amber-400 truncate max-w-[140px]">
                {currentStation.name}
              </p>
              <p className="text-[10px] text-stone-400 font-medium truncate max-w-[140px]">
                {isPlaying ? '♪ Sonando en vivo' : 'En pausa'}
              </p>
            </div>
          </button>

          <button
            onClick={() => setIsMinimized(false)}
            className="p-1.5 hover:bg-stone-800 text-stone-400 hover:text-white rounded-lg transition-colors cursor-pointer"
            title="Expandir Reproductor"
          >
            <ListMusic size={16} />
          </button>

          <button
            onClick={() => setIsOpen(false)}
            className="p-1.5 hover:bg-rose-900/80 text-stone-400 hover:text-rose-200 rounded-lg transition-colors cursor-pointer"
            title="Cerrar Reproductor"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: position ? `${position.y}px` : '5rem',
        left: position ? `${position.x}px` : 'auto',
        right: position ? 'auto' : '2rem',
      }}
      className={`z-50 w-[92vw] sm:w-[400px] bg-stone-900 text-white rounded-3xl shadow-2xl border border-stone-800 overflow-hidden transition-shadow select-none ${
        isDragging ? 'shadow-amber-500/20 border-amber-500/60' : ''
      }`}
    >
      {/* Draggable Titlebar */}
      <div
        onMouseDown={handleMouseDownDrag}
        className="bg-stone-950 px-4 py-3 border-b border-stone-800 flex items-center justify-between cursor-grab active:cursor-grabbing"
      >
        <div className="flex items-center gap-2.5">
          <GripHorizontal size={16} className="text-stone-500 hover:text-amber-400" />
          <div className="p-1.5 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
            <Radio size={18} />
          </div>
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              Música Latina FM
              <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[8px] px-1.5 py-0.2 rounded font-bold">
                Gratis
              </span>
            </h3>
            <p className="text-[10px] text-stone-400">Salsa, Pop, Rock, Cumbia & más</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMinimized(true)}
            className="p-1.5 hover:bg-stone-800 text-stone-400 hover:text-amber-400 rounded-xl transition-colors cursor-pointer"
            title="Minimizar reproductor"
          >
            <Minus size={16} />
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1.5 hover:bg-rose-900/80 text-stone-400 hover:text-rose-200 rounded-xl transition-colors cursor-pointer"
            title="Cerrar reproductor"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Main Active Player Card */}
      <div className={`p-4 bg-gradient-to-br ${currentStation.color} transition-all relative overflow-hidden`}>
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Disc size={120} className={isPlaying ? 'animate-spin-slow' : ''} />
        </div>

        <div className="flex items-center gap-4 relative z-10">
          <div className="w-16 h-16 rounded-2xl bg-black/30 backdrop-blur-md flex items-center justify-center text-3xl shadow-lg border border-white/10 shrink-0">
            {currentStation.icon}
          </div>

          <div className="flex-1 min-w-0">
            <span className="inline-block px-2 py-0.5 rounded-md bg-black/40 text-[10px] font-bold text-amber-200 mb-1 backdrop-blur-xs">
              {currentStation.genre}
            </span>
            <h4 className="text-base font-black truncate text-white drop-shadow-xs">
              {currentStation.name}
            </h4>
            <p className="text-xs text-white/80 truncate font-medium">
              {isPlaying ? '♪ Transmitiendo en vivo' : 'Selecciona una estación'}
            </p>
          </div>
        </div>

        {/* Animated Equalizer Bars when Playing */}
        {isPlaying && (
          <div className="flex items-end justify-center gap-1 h-6 mt-3 relative z-10">
            {[40, 80, 50, 90, 60, 100, 70, 45, 85, 30].map((h, i) => (
              <div
                key={i}
                className="w-1 bg-amber-300/90 rounded-full animate-pulse"
                style={{
                  height: `${h}%`,
                  animationDuration: `${0.4 + (i % 3) * 0.2}s`,
                }}
              />
            ))}
          </div>
        )}

        {/* Playback Controls & Volume */}
        <div className="mt-4 flex items-center justify-between gap-3 bg-black/40 p-2.5 rounded-2xl backdrop-blur-md border border-white/10 relative z-10">
          <button
            onClick={togglePlay}
            className={`p-3 rounded-xl font-bold transition-all transform active:scale-95 cursor-pointer flex items-center gap-2 ${
              isPlaying
                ? 'bg-amber-400 text-stone-950 shadow-lg shadow-amber-400/20 hover:bg-amber-300'
                : 'bg-white text-stone-900 hover:bg-amber-400 hover:text-stone-950'
            }`}
          >
            {isLoading ? (
              <RefreshCw size={20} className="animate-spin" />
            ) : isPlaying ? (
              <Pause size={20} />
            ) : (
              <Play size={20} className="ml-0.5" />
            )}
            <span className="text-xs font-black uppercase">
              {isLoading ? 'Cargando...' : isPlaying ? 'Pausar' : 'Reproducir'}
            </span>
          </button>

          {/* Volume Control */}
          <div className="flex items-center gap-2 flex-1 max-w-[140px]">
            <button
              onClick={toggleMute}
              className="text-stone-300 hover:text-white transition-colors cursor-pointer"
            >
              {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="w-full accent-amber-400 cursor-pointer h-1.5 bg-stone-700/80 rounded-lg"
            />
          </div>
        </div>

        {hasError && (
          <div className="mt-2 text-center text-[11px] bg-rose-950/80 text-rose-200 p-1.5 rounded-xl border border-rose-800/50">
            ⚠️ La transmisión está reintentando con audio de respaldo...
          </div>
        )}
      </div>

      {/* Genre Filter Tabs */}
      <div className="bg-stone-950 px-3 py-2 border-b border-stone-800 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        {genres.map(g => (
          <button
            key={g}
            onClick={() => setSelectedGenre(g)}
            className={`text-[10px] font-bold px-2.5 py-1 rounded-xl transition-all whitespace-nowrap cursor-pointer shrink-0 ${
              selectedGenre === g
                ? 'bg-amber-500 text-stone-950 font-black shadow-xs'
                : 'bg-stone-800 text-stone-400 hover:text-stone-200'
            }`}
          >
            {g}
          </button>
        ))}
      </div>

      {/* Stations List */}
      <div className="p-2 max-h-[220px] overflow-y-auto space-y-1.5 bg-stone-900 scrollbar-thin scrollbar-thumb-stone-700">
        {filteredStations.map(station => {
          const isCurrent = currentStation.id === station.id;
          return (
            <div
              key={station.id}
              onClick={() => changeStation(station)}
              className={`p-2.5 rounded-2xl flex items-center justify-between gap-3 cursor-pointer transition-all border ${
                isCurrent
                  ? 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                  : 'bg-stone-800/40 hover:bg-stone-800 border-stone-800 text-stone-300'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-xl">{station.icon}</span>
                <div className="min-w-0">
                  <p className="text-xs font-bold truncate flex items-center gap-1.5">
                    {station.name}
                    {isCurrent && isPlaying && (
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                    )}
                  </p>
                  <p className="text-[10px] text-stone-400 truncate">
                    {station.description}
                  </p>
                </div>
              </div>

              <div className="shrink-0">
                <span className={`text-[10px] px-2 py-0.5 rounded-lg font-bold border ${
                  isCurrent
                    ? 'bg-amber-500 text-stone-950 border-amber-400'
                    : 'bg-stone-800 text-stone-400 border-stone-700'
                }`}>
                  {isCurrent && isPlaying ? 'Reproduciendo' : 'Escuchar'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Info */}
      <div className="bg-stone-950 px-3 py-2 border-t border-stone-800 flex items-center justify-between text-[10px] text-stone-400">
        <span className="flex items-center gap-1">
          <Sparkles size={12} className="text-amber-400" /> Transmisión continua 24/7
        </span>
        <span className="text-stone-500 font-medium">Las Cazuelas Radio</span>
      </div>
    </div>
  );
};
