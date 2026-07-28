import React, { useState, useEffect, useRef } from 'react';
import { Music, Play, Pause, Volume2, VolumeX, Radio, Disc, Sparkles, X, Minus, Move, GripHorizontal, ListMusic, Heart, RefreshCw, Search, Maximize2, Square, Lock, Unlock, ExternalLink } from 'lucide-react';

interface LatinMusicWidgetProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

export interface Station {
  id: string;
  name: string;
  genre: 'CDMX & México' | 'Salsa' | 'Pop Latino' | 'Rock en Español' | 'Cumbia' | 'Bachata & Merengue' | 'Regional Mexicano' | 'Urbana & Reggaeton' | 'Jazz & Chill' | 'Retro & Clásicos';
  streamUrl: string;
  backupUrl?: string;
  description: string;
  icon: string;
  color: string;
}

const LATIN_STATIONS: Station[] = [
  {
    id: 'joya-937-cdmx',
    name: 'Joya 93.7 FM (CDMX)',
    genre: 'CDMX & México',
    streamUrl: 'https://stream.zeno.fm/381y91v5euvv',
    backupUrl: 'https://stream.zeno.fm/3sghq4z5euvv',
    description: 'Música que te llena de amor. Estación de Ciudad de México (Emisoras CDMX).',
    icon: '📻',
    color: 'from-pink-600 to-rose-700'
  },
  {
    id: 'la-z-1073-cdmx',
    name: 'La Z 107.3 FM (CDMX)',
    genre: 'CDMX & México',
    streamUrl: 'https://stream.zeno.fm/3sghq4z5euvv',
    backupUrl: 'https://stream.zeno.fm/381y91v5euvv',
    description: 'La número 1 en música grupera, banda y norteño en la CDMX.',
    icon: '🎺',
    color: 'from-amber-600 to-red-700'
  },
  {
    id: 'w-radio-cdmx',
    name: 'W Radio 96.9 FM (CDMX)',
    genre: 'CDMX & México',
    streamUrl: 'https://stream.zeno.fm/u9v3xbrfbeuvv',
    backupUrl: 'https://stream.zeno.fm/q5b3f11z5euvv',
    description: 'Noticias, entrevistas, deportes y opinión en vivo desde México.',
    icon: '🎙️',
    color: 'from-blue-700 to-indigo-900'
  },
  {
    id: 'los-40-cdmx',
    name: 'Los 40 101.7 FM (CDMX)',
    genre: 'CDMX & México',
    streamUrl: 'https://stream.zeno.fm/3sghq4z5euvv',
    backupUrl: 'https://stream.zeno.fm/1r2s3v4fbeuvv',
    description: 'Todos los éxitos pop del momento en la Ciudad de México.',
    icon: '🔥',
    color: 'from-orange-500 to-amber-600'
  },
  {
    id: 'radio-formula-cdmx',
    name: 'Radio Fórmula 104.1 (CDMX)',
    genre: 'CDMX & México',
    streamUrl: 'https://stream.zeno.fm/q5b3f11z5euvv',
    backupUrl: 'https://stream.zeno.fm/u9v3xbrfbeuvv',
    description: 'Noticias al momento y la mejor barra de comentaristas en México.',
    icon: '📡',
    color: 'from-stone-800 to-neutral-950'
  },
  {
    id: 'salsa-hits',
    name: 'Radio Salsa Brava CDMX',
    genre: 'Salsa',
    streamUrl: 'https://stream.zeno.fm/f3wvbbqmdg8uv',
    backupUrl: 'https://stream.zeno.fm/6s81a03fbeuvv',
    description: 'Éxitos de Salsa dura, brava, fania y romántica.',
    icon: '🎺',
    color: 'from-red-600 to-amber-600'
  },
  {
    id: 'salsa-romantica',
    name: 'Salsa Romántica FM',
    genre: 'Salsa',
    streamUrl: 'https://stream.zeno.fm/6s81a03fbeuvv',
    backupUrl: 'https://stream.zeno.fm/f3wvbbqmdg8uv',
    description: 'Marc Anthony, Gilberto Santa Rosa, Frankie Ruiz y más.',
    icon: '💃',
    color: 'from-rose-600 to-red-800'
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
    id: 'pop-baladas',
    name: 'Amor FM - Baladas & Pop',
    genre: 'Pop Latino',
    streamUrl: 'https://stream.zeno.fm/381y91v5euvv',
    backupUrl: 'https://stream.zeno.fm/3sghq4z5euvv',
    description: 'Las canciones más románticas y del recuerdo en español.',
    icon: '💖',
    color: 'from-fuchsia-600 to-pink-700'
  },
  {
    id: 'rock-espanol',
    name: 'Rock en Español 80/90s',
    genre: 'Rock en Español',
    streamUrl: 'https://stream.zeno.fm/u9v3xbrfbeuvv',
    backupUrl: 'https://stream.zeno.fm/q5b3f11z5euvv',
    description: 'Soda Stereo, Caifanes, Maná, Enanitos Verdes y leyendas.',
    icon: '🎸',
    color: 'from-purple-700 to-indigo-900'
  },
  {
    id: 'rock-clasico',
    name: 'Pop Rock & Alt Latino',
    genre: 'Rock en Español',
    streamUrl: 'https://stream.zeno.fm/q5b3f11z5euvv',
    backupUrl: 'https://stream.zeno.fm/u9v3xbrfbeuvv',
    description: 'Rock hispano, ska, reggae en español y clásicos de garage.',
    icon: '⚡',
    color: 'from-slate-800 to-amber-900'
  },
  {
    id: 'cumbia-sonidera',
    name: 'Cumbias Inmortales & Fiesta',
    genre: 'Cumbia',
    streamUrl: 'https://stream.zeno.fm/xbb1u53fbeuvv',
    backupUrl: 'https://stream.zeno.fm/f8z0p53fbeuvv',
    description: 'Cumbia colombiana, mexicana, sonidera y tropical alegre.',
    icon: '🪗',
    color: 'from-amber-500 to-yellow-600'
  },
  {
    id: 'cumbia-df',
    name: 'Sonidero CDMX Mix',
    genre: 'Cumbia',
    streamUrl: 'https://stream.zeno.fm/f8z0p53fbeuvv',
    backupUrl: 'https://stream.zeno.fm/xbb1u53fbeuvv',
    description: 'Cumbia sonidera del D.F. con saludos y ritmos de barrio.',
    icon: '🪘',
    color: 'from-yellow-600 to-orange-700'
  },
  {
    id: 'bachata-merengue',
    name: 'Bachata & Merengue Mix',
    genre: 'Bachata & Merengue',
    streamUrl: 'https://stream.zeno.fm/0545s41z5euvv',
    backupUrl: 'https://stream.zeno.fm/1r2s3v4fbeuvv',
    description: 'Romeo Santos, Juan Luis Guerra y merengue bailable 24/7.',
    icon: '🌴',
    color: 'from-blue-600 to-cyan-600'
  },
  {
    id: 'regional-mexicano',
    name: 'La Banda & Regional Mexicano',
    genre: 'Regional Mexicano',
    streamUrl: 'https://stream.zeno.fm/381y91v5euvv',
    backupUrl: 'https://stream.zeno.fm/3sghq4z5euvv',
    description: 'Norteño, Banda, Mariachi y Corridos de tradición.',
    icon: '🎺',
    color: 'from-emerald-600 to-teal-800'
  },
  {
    id: 'reggaeton-urbana',
    name: 'Urban Hits Latino',
    genre: 'Urbana & Reggaeton',
    streamUrl: 'https://stream.zeno.fm/1r2s3v4fbeuvv',
    backupUrl: 'https://stream.zeno.fm/f3wvbbqmdg8uv',
    description: 'Reggaetón clásico y nuevo, Trap latino y dembow.',
    icon: '🔥',
    color: 'from-orange-600 to-red-700'
  },
  {
    id: 'jazz-bossa',
    name: 'Jazz & Bossa Relax',
    genre: 'Jazz & Chill',
    streamUrl: 'https://stream.zeno.fm/u9v3xbrfbeuvv',
    backupUrl: 'https://stream.zeno.fm/3sghq4z5euvv',
    description: 'Jazz latino, Bossa Nova suave para concentración y ambiente.',
    icon: '🎷',
    color: 'from-teal-800 to-cyan-900'
  },
  {
    id: 'retro-clasicos',
    name: 'Retro 80s & 90s Hits',
    genre: 'Retro & Clásicos',
    streamUrl: 'https://stream.zeno.fm/q5b3f11z5euvv',
    backupUrl: 'https://stream.zeno.fm/f8z0p53fbeuvv',
    description: 'Clásicos retro en español e inglés para cantar e inspirar.',
    icon: '📻',
    color: 'from-violet-700 to-purple-900'
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
  const [searchQuery, setSearchQuery] = useState('');
  const [hasError, setHasError] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isLocked, setIsLocked] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Position & dragging states
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; posX: number; posY: number }>({ x: 0, y: 0, posX: 0, posY: 0 });

  // Default position: Centered at top of screen
  useEffect(() => {
    if (typeof window !== 'undefined' && position === null) {
      const cardWidth = Math.min(420, window.innerWidth - 24);
      const initialX = Math.max(12, (window.innerWidth - cardWidth) / 2);
      const initialY = 16; // Top-centered
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
    if (isLocked || isMaximized) return;
    if ((e.target as HTMLElement).closest('button, input, a')) return;
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
      if (!isDragging || isLocked || isMaximized) return;
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
  }, [isDragging, isLocked, isMaximized]);

  if (!isOpen) return null;

  const genres = ['Todos', 'CDMX & México', 'Salsa', 'Pop Latino', 'Rock en Español', 'Cumbia', 'Bachata & Merengue', 'Regional Mexicano', 'Urbana & Reggaeton', 'Jazz & Chill', 'Retro & Clásicos'];

  const filteredStations = LATIN_STATIONS.filter(s => {
    const matchesGenre = selectedGenre === 'Todos' || s.genre === selectedGenre;
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch = !query || 
      s.name.toLowerCase().includes(query) || 
      s.genre.toLowerCase().includes(query) || 
      s.description.toLowerCase().includes(query);
    return matchesGenre && matchesSearch;
  });

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
      style={
        isMaximized
          ? {
              position: 'fixed',
              top: '12px',
              left: '12px',
              right: '12px',
              bottom: '12px',
              width: 'calc(100vw - 24px)',
              height: 'calc(100vh - 24px)',
              zIndex: 9999,
            }
          : {
              position: 'fixed',
              top: position ? `${position.y}px` : '1rem',
              left: position ? `${position.x}px` : 'auto',
              right: position ? 'auto' : '1rem',
            }
      }
      className={`z-50 ${
        isMaximized ? 'w-full h-full' : 'w-[92vw] sm:w-[440px]'
      } bg-stone-900 text-white rounded-3xl shadow-2xl border-2 ${
        isMaximized
          ? 'border-amber-500/80'
          : isLocked
          ? 'border-indigo-500/60'
          : isDragging
          ? 'shadow-amber-500/20 border-amber-500/60'
          : 'border-stone-800'
      } overflow-hidden transition-all select-none flex flex-col`}
    >
      {/* Draggable & Control Titlebar */}
      <div
        onMouseDown={handleMouseDownDrag}
        className={`bg-stone-950 px-3.5 py-2.5 border-b border-stone-800 flex items-center justify-between ${
          isLocked || isMaximized ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'
        }`}
      >
        <div className="flex items-center gap-2">
          {!isLocked && !isMaximized && (
            <GripHorizontal size={16} className="text-stone-500 hover:text-amber-400" />
          )}
          <div className="p-1.5 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
            <Radio size={18} />
          </div>
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              Radio CDMX & Latina FM
              <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[8px] px-1.5 py-0.2 rounded font-bold">
                En Vivo
              </span>
            </h3>
            <p className="text-[10px] text-stone-400">Joya, La Z, W Radio, Salsa, Cumbia & Pop</p>
          </div>
        </div>

        {/* Window Action Buttons */}
        <div className="flex items-center gap-1">
          {/* Link to Emisoras CDMX */}
          <a
            href="https://emisoras.com.mx/region/ciudad-de-mexico/"
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 hover:bg-stone-800 text-stone-400 hover:text-amber-400 rounded-xl transition-colors cursor-pointer"
            title="Abrir Emisoras.com.mx (Ciudad de México)"
          >
            <ExternalLink size={15} />
          </a>

          {/* Screen Lock Toggle */}
          <button
            onClick={() => setIsLocked(!isLocked)}
            className={`p-1.5 rounded-xl transition-colors cursor-pointer ${
              isLocked
                ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/40'
                : 'hover:bg-stone-800 text-stone-400 hover:text-indigo-400'
            }`}
            title={isLocked ? 'Bloqueo de pantalla activado (Desbloquear posición)' : 'Bloquear posición en pantalla'}
          >
            {isLocked ? <Lock size={15} /> : <Unlock size={15} />}
          </button>

          {/* Maximize / Restore Toggle */}
          <button
            onClick={() => setIsMaximized(!isMaximized)}
            className={`p-1.5 rounded-xl transition-colors cursor-pointer ${
              isMaximized
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                : 'hover:bg-stone-800 text-stone-400 hover:text-amber-400'
            }`}
            title={isMaximized ? 'Restaurar tamaño normal' : 'Maximizar pantalla completa'}
          >
            {isMaximized ? <Square size={15} /> : <Maximize2 size={15} />}
          </button>

          {/* Minimize Button */}
          <button
            onClick={() => setIsMinimized(true)}
            className="p-1.5 hover:bg-stone-800 text-stone-400 hover:text-amber-400 rounded-xl transition-colors cursor-pointer"
            title="Minimizar reproductor"
          >
            <Minus size={15} />
          </button>

          {/* Close Button */}
          <button
            onClick={() => setIsOpen(false)}
            className="p-1.5 hover:bg-rose-900/80 text-stone-400 hover:text-rose-200 rounded-xl transition-colors cursor-pointer"
            title="Cerrar reproductor"
          >
            <X size={15} />
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

      {/* Search Input Bar */}
      <div className="bg-stone-950 px-3 py-2 border-b border-stone-800">
        <div className="flex items-center gap-2 bg-stone-900 px-3 py-1.5 rounded-xl border border-stone-800 focus-within:border-amber-500/60 transition-colors">
          <Search size={14} className="text-stone-400 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar radio online (género, artista o estación)..."
            className="w-full bg-transparent text-xs text-stone-200 placeholder-stone-500 focus:outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-stone-500 hover:text-stone-300 text-xs font-bold"
            >
              ×
            </button>
          )}
        </div>
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
      <div className={`p-2 ${isMaximized ? 'flex-1 overflow-y-auto min-h-0' : 'max-h-[220px] overflow-y-auto'} space-y-1.5 bg-stone-900 scrollbar-thin scrollbar-thumb-stone-700`}>
        {filteredStations.length === 0 ? (
          <div className="p-6 text-center text-stone-400">
            <Radio size={24} className="mx-auto text-amber-500/60 mb-2 animate-pulse" />
            <p className="text-xs font-bold text-stone-300">No se encontraron emisoras</p>
            <p className="text-[10px] text-stone-500 mt-1">Prueba buscando "salsa", "pop", "cumbia" o selecciona "Todos"</p>
          </div>
        ) : (
          filteredStations.map(station => {
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
        }))}
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
