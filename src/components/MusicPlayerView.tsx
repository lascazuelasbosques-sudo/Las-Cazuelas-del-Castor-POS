import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, Pause, SkipForward, SkipBack, Volume2, VolumeX, Volume1,
  Music, ListMusic, Plus, Trash2, ExternalLink, Radio, Disc, 
  Shuffle, Repeat, Sparkles, Search, Youtube, RefreshCw, Check, CheckCircle2,
  ListPlus, Info, Layers, Sliders, ChevronRight, Monitor, Smartphone, Clock, Link, Save, Eye, X
} from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '../lib/utils';

// Declare YT for TypeScript
declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: (() => void) | undefined;
  }
}

export interface TrackItem {
  id: string; // YouTube Video ID
  title: string;
  artist: string;
  thumbnailUrl: string;
  duration?: string;
  durationSeconds?: number;
}

export interface SavedPlaylist {
  id: string; // YouTube Playlist ID or custom ID
  title: string;
  description: string;
  category: string;
  thumbnailUrl?: string;
  url?: string;
  lastPlayedAt?: string;
  tracks?: TrackItem[];
}

// Initial default seed for Recently Played Playlists
const INITIAL_RECENT_PLAYLISTS: SavedPlaylist[] = [
  {
    id: 'PLDISa-NAtXbvhLd4f-v_4_lC668R8Xg8C',
    title: 'Cumbia & Salsa Tropical',
    description: 'Sabor y ritmo alegre para amenizar la comida.',
    category: 'Fiesta & Sabor',
    url: 'https://music.youtube.com/playlist?list=PLDISa-NAtXbvhLd4f-v_4_lC668R8Xg8C',
    thumbnailUrl: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=400&q=80',
    lastPlayedAt: 'Hoy',
    tracks: [
      { id: '3JZ_D3ELwOQ', title: 'Como Te Voy a Olvidar', artist: 'Los Ángeles Azules', thumbnailUrl: 'https://i.ytimg.com/vi/3JZ_D3ELwOQ/hqdefault.jpg' },
      { id: '1oJ35i8lS8c', title: '17 Años', artist: 'Los Ángeles Azules ft. Jay de la Cueva', thumbnailUrl: 'https://i.ytimg.com/vi/1oJ35i8lS8c/hqdefault.jpg' },
      { id: 'M3A60v2m4jU', title: 'Tiene Espinas El Rosal', artist: 'Grupo Cañaveral', thumbnailUrl: 'https://i.ytimg.com/vi/M3A60v2m4jU/hqdefault.jpg' },
    ]
  },
  {
    id: 'RDEMLIYf42tL3A-p9v6I-7O61A',
    title: 'Mariachi & Rancheras Clásicas',
    description: 'Tradición mexicana con los mejores exponentes.',
    category: 'Tradición Mexicana',
    url: 'https://music.youtube.com/playlist?list=RDEMLIYf42tL3A-p9v6I-7O61A',
    thumbnailUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=400&q=80',
    lastPlayedAt: 'Ayer',
    tracks: [
      { id: '8R8Qx-M952Y', title: 'El Rey', artist: 'Vicente Fernández', thumbnailUrl: 'https://i.ytimg.com/vi/8R8Qx-M952Y/hqdefault.jpg' },
      { id: '2V0X4Z7432M', title: 'Cielito Lindo', artist: 'Mariachi Vargas de Tecalitlán', thumbnailUrl: 'https://i.ytimg.com/vi/2V0X4Z7432M/hqdefault.jpg' },
    ]
  },
  {
    id: 'PL4fGSI1pDJn6O1LS0XSdF3RyO0Bo_dD_S',
    title: 'Pop Latino & Baladas del Recuerdo',
    description: 'Música suave y agradable para ambiente familiar.',
    category: 'Ambiente Familiar',
    url: 'https://music.youtube.com/playlist?list=PL4fGSI1pDJn6O1LS0XSdF3RyO0Bo_dD_S',
    thumbnailUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=400&q=80',
    lastPlayedAt: 'Ayer',
    tracks: [
      { id: 'W3q8Od5qJio', title: 'La Incondicional', artist: 'Luis Miguel', thumbnailUrl: 'https://i.ytimg.com/vi/W3q8Od5qJio/hqdefault.jpg' },
      { id: 'p6fO690YpB8', title: 'Rayando El Sol', artist: 'Maná', thumbnailUrl: 'https://i.ytimg.com/vi/p6fO690YpB8/hqdefault.jpg' },
    ]
  },
  {
    id: 'PLw-VjHDlEOgv_fS7p4p8C4kK2tQ4sL3Nn',
    title: 'Cafe Jazz & Bossa Nova Chill',
    description: 'Música Instrumental sofisticada para desayunos y cafés.',
    category: 'Relax & Café',
    url: 'https://music.youtube.com/playlist?list=PLw-VjHDlEOgv_fS7p4p8C4kK2tQ4sL3Nn',
    thumbnailUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=400&q=80',
    lastPlayedAt: 'Hace 2 días',
    tracks: [
      { id: '5qap5aO4i9A', title: 'Girl From Ipanema', artist: 'Stan Getz & Astrud Gilberto', thumbnailUrl: 'https://i.ytimg.com/vi/5qap5aO4i9A/hqdefault.jpg' },
    ]
  }
];

// Utility to parse YouTube Playlist ID or Video ID from input text/URL
export function parseYouTubeInput(input: string): { type: 'playlist' | 'video' | 'invalid'; id: string } {
  const clean = input.trim();
  if (!clean) return { type: 'invalid', id: '' };

  // Check for Playlist parameter list=...
  const playlistMatch = clean.match(/[?&]list=([a-zA-Z0-9_-]+)/i);
  if (playlistMatch && playlistMatch[1]) {
    return { type: 'playlist', id: playlistMatch[1] };
  }

  // Check if input is directly a Playlist ID
  if (/^(PL|RD|FL|OLAK5|UU|LL)[a-zA-Z0-9_-]{10,}$/i.test(clean)) {
    return { type: 'playlist', id: clean };
  }

  // Check for YouTube Video URL
  const videoMatch = clean.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/i);
  if (videoMatch && videoMatch[1]) {
    return { type: 'video', id: videoMatch[1] };
  }

  // Raw 11-char video ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(clean)) {
    return { type: 'video', id: clean };
  }

  return { type: 'invalid', id: '' };
}

interface MusicPlayerViewProps {
  userRole?: string;
  activeTab?: string;
  onNavigateToMusic?: () => void;
}

export const MusicPlayerView: React.FC<MusicPlayerViewProps> = ({ 
  userRole = 'admin',
  activeTab = 'music',
  onNavigateToMusic
}) => {
  // Device detection (PC vs Mobile)
  const [isPC, setIsPC] = useState(false);
  const [bgMusicEnabled, setBgMusicEnabled] = useState(true);

  // Player state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPlaylistId, setCurrentPlaylistId] = useState<string>(INITIAL_RECENT_PLAYLISTS[0].id);
  const [playlistTitle, setPlaylistTitle] = useState<string>(INITIAL_RECENT_PLAYLISTS[0].title);
  const [playlistTracks, setPlaylistTracks] = useState<TrackItem[]>(INITIAL_RECENT_PLAYLISTS[0].tracks || []);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [currentTrack, setCurrentTrack] = useState<TrackItem | null>(INITIAL_RECENT_PLAYLISTS[0].tracks?.[0] || null);

  // Audio control state
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);
  const [isRepeat, setIsRepeat] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Lists state
  const [recentlyPlayed, setRecentlyPlayed] = useState<SavedPlaylist[]>([]);
  const [customPlaylists, setCustomPlaylists] = useState<SavedPlaylist[]>([]);
  
  // UI state
  const [inputUrl, setInputUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showVideo, setShowVideo] = useState(false);
  const [showAddByAddressModal, setShowAddByAddressModal] = useState(false);

  // Add by Address Form State
  const [directAddress, setDirectAddress] = useState('');
  const [directTitle, setDirectTitle] = useState('');
  const [directCategory, setDirectCategory] = useState('');

  // Player references
  const playerRef = useRef<any>(null);
  const progressTimerRef = useRef<any>(null);

  // Detect PC/Desktop vs Mobile device
  useEffect(() => {
    const checkDevice = () => {
      const hasTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
      const isWideScreen = window.innerWidth >= 1024;
      const userAgentMobile = /Mobi|Android|iPhone|iPad|iPod|Windows Phone/i.test(navigator.userAgent);
      setIsPC(isWideScreen && !userAgentMobile);
    };

    checkDevice();
    window.addEventListener('resize', checkDevice);
    return () => window.removeEventListener('resize', checkDevice);
  }, []);

  // Load bgMusic preference and playlists from localStorage on mount
  useEffect(() => {
    try {
      // Saved custom playlists
      const savedCustom = localStorage.getItem('pos_custom_playlists');
      if (savedCustom) {
        setCustomPlaylists(JSON.parse(savedCustom));
      }

      // Recently played playlists
      const savedRecent = localStorage.getItem('pos_recently_played_playlists');
      if (savedRecent) {
        setRecentlyPlayed(JSON.parse(savedRecent));
      } else {
        setRecentlyPlayed(INITIAL_RECENT_PLAYLISTS);
        localStorage.setItem('pos_recently_played_playlists', JSON.stringify(INITIAL_RECENT_PLAYLISTS));
      }

      // Background music toggle for PC
      const bgPref = localStorage.getItem('pos_bg_music_enabled');
      if (bgPref !== null) {
        setBgMusicEnabled(bgPref === 'true');
      }
    } catch (e) {
      console.error('Error loading playlists from storage:', e);
    }
  }, []);

  // Initialize YouTube IFrame API
  useEffect(() => {
    let isMounted = true;

    const initYTPlayer = () => {
      if (!window.YT || !window.YT.Player) return;
      if (playerRef.current) return;

      try {
        playerRef.current = new window.YT.Player('yt-player-target', {
          height: '100%',
          width: '100%',
          playerVars: {
            autoplay: 0,
            controls: 1,
            modestbranding: 1,
            rel: 0,
            fs: 1,
            playsinline: 1,
            origin: window.location.origin
          },
          events: {
            onReady: (event: any) => {
              if (!isMounted) return;
              event.target.setVolume(volume);
              loadPlaylistById(currentPlaylistId, false);
            },
            onStateChange: (event: any) => {
              if (!isMounted) return;
              if (event.data === 1) { // Playing
                setIsPlaying(true);
                updateCurrentTrackInfo();
              } else if (event.data === 2) { // Paused
                setIsPlaying(false);
              } else if (event.data === 0) { // Ended
                setIsPlaying(false);
                handleTrackNext();
              }
            },
            onError: (err: any) => {
              console.warn('YouTube Player error code:', err.data);
              toast.error('Error al reproducir la canción');
              setIsLoading(false);
            }
          }
        });
      } catch (err) {
        console.error('Error initializing YT Player:', err);
      }
    };

    if (window.YT && window.YT.Player) {
      initYTPlayer();
    } else {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

      window.onYouTubeIframeAPIReady = () => {
        initYTPlayer();
      };
    }

    return () => {
      isMounted = false;
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    };
  }, []);

  // Update track time loop
  useEffect(() => {
    if (isPlaying) {
      progressTimerRef.current = setInterval(() => {
        if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
          const cur = playerRef.current.getCurrentTime() || 0;
          const dur = playerRef.current.getDuration() || 0;
          setCurrentTime(cur);
          setDuration(dur);
        }
      }, 500);
    } else {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    }
    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    };
  }, [isPlaying]);

  // Sync volume
  useEffect(() => {
    if (playerRef.current && typeof playerRef.current.setVolume === 'function') {
      playerRef.current.setVolume(isMuted ? 0 : volume);
    }
  }, [volume, isMuted]);

  // Fetch track details via oEmbed
  const fetchTrackMetadata = async (videoId: string): Promise<TrackItem> => {
    try {
      const response = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`);
      if (response.ok) {
        const data = await response.json();
        return {
          id: videoId,
          title: data.title || `Canción ${videoId}`,
          artist: data.author_name || 'YouTube Music',
          thumbnailUrl: data.thumbnail_url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        };
      }
    } catch (e) {
      console.warn('Could not fetch oEmbed info:', videoId);
    }
    return {
      id: videoId,
      title: `Canción (${videoId})`,
      artist: 'YouTube Music',
      thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    };
  };

  // Update track info
  const updateCurrentTrackInfo = async () => {
    if (!playerRef.current) return;
    try {
      let videoData = typeof playerRef.current.getVideoData === 'function' ? playerRef.current.getVideoData() : null;
      let videoId = videoData?.video_id;

      if (!videoId && typeof playerRef.current.getPlaylist === 'function') {
        const list = playerRef.current.getPlaylist();
        const index = typeof playerRef.current.getPlaylistIndex === 'function' ? playerRef.current.getPlaylistIndex() : 0;
        if (list && list[index]) {
          videoId = list[index];
          setCurrentTrackIndex(index);
        }
      }

      if (videoId) {
        if (videoData && videoData.title) {
          setCurrentTrack({
            id: videoId,
            title: videoData.title,
            artist: videoData.author || 'YouTube Music',
            thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
          });
        } else {
          const meta = await fetchTrackMetadata(videoId);
          setCurrentTrack(meta);
        }
      }
    } catch (err) {
      console.warn('Error reading current track:', err);
    }
  };

  // Add playlist to Recently Played
  const recordInRecentlyPlayed = (playlist: SavedPlaylist) => {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setRecentlyPlayed(prev => {
      const filtered = prev.filter(p => p.id !== playlist.id);
      const updated = [{ ...playlist, lastPlayedAt: `Hoy (${timeStr})` }, ...filtered].slice(0, 10);
      try {
        localStorage.setItem('pos_recently_played_playlists', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  };

  // Load playlist or video into YouTube Player
  const loadPlaylistById = async (playlistIdOrUrl: string, autoPlay = true) => {
    setIsLoading(true);
    const parsed = parseYouTubeInput(playlistIdOrUrl);

    if (parsed.type === 'invalid') {
      toast.error('Formato de enlace o ID de playlist no válido');
      setIsLoading(false);
      return;
    }

    setCurrentPlaylistId(parsed.id);

    // Find in existing lists
    const existing = recentlyPlayed.find(p => p.id === parsed.id) || customPlaylists.find(p => p.id === parsed.id);
    const titleToUse = existing?.title || `Lista YouTube (${parsed.id})`;
    setPlaylistTitle(titleToUse);

    if (existing?.tracks && existing.tracks.length > 0) {
      setPlaylistTracks(existing.tracks);
      setCurrentTrack(existing.tracks[0]);
    }

    try {
      if (playerRef.current) {
        if (parsed.type === 'playlist') {
          if (autoPlay) {
            playerRef.current.loadPlaylist({
              listType: 'playlist',
              list: parsed.id,
              index: 0,
              startSeconds: 0
            });
            setIsPlaying(true);
          } else {
            playerRef.current.cuePlaylist({
              listType: 'playlist',
              list: parsed.id,
              index: 0,
              startSeconds: 0
            });
          }

          setTimeout(async () => {
            if (playerRef.current && typeof playerRef.current.getPlaylist === 'function') {
              const videoIds: string[] = playerRef.current.getPlaylist();
              if (videoIds && Array.isArray(videoIds) && videoIds.length > 0) {
                toast.success(`Cargadas ${videoIds.length} canciones de la lista`);
                const loadedTracks: TrackItem[] = await Promise.all(
                  videoIds.slice(0, 20).map(id => fetchTrackMetadata(id))
                );
                setPlaylistTracks(loadedTracks);
                if (loadedTracks.length > 0) setCurrentTrack(loadedTracks[0]);

                // Record in Recently Played
                recordInRecentlyPlayed({
                  id: parsed.id,
                  title: titleToUse,
                  description: `${videoIds.length} canciones`,
                  category: existing?.category || 'Reproducida',
                  url: playlistIdOrUrl,
                  thumbnailUrl: loadedTracks[0]?.thumbnailUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=400&q=80',
                  tracks: loadedTracks
                });
              }
            }
            setIsLoading(false);
          }, 1500);

        } else if (parsed.type === 'video') {
          if (autoPlay) {
            playerRef.current.loadVideoById(parsed.id);
            setIsPlaying(true);
          } else {
            playerRef.current.cueVideoById(parsed.id);
          }
          const meta = await fetchTrackMetadata(parsed.id);
          setPlaylistTracks([meta]);
          setCurrentTrack(meta);
          setCurrentTrackIndex(0);
          setPlaylistTitle(`Canción: ${meta.title}`);

          recordInRecentlyPlayed({
            id: parsed.id,
            title: meta.title,
            description: meta.artist,
            category: 'Canción Individual',
            url: `https://www.youtube.com/watch?v=${parsed.id}`,
            thumbnailUrl: meta.thumbnailUrl,
            tracks: [meta]
          });

          setIsLoading(false);
        }
      } else {
        setIsLoading(false);
      }
    } catch (err) {
      console.error('Error loading content:', err);
      toast.error('Ocurrió un error al cargar el reproductor');
      setIsLoading(false);
    }
  };

  // Playback control actions
  const togglePlayPause = () => {
    if (!playerRef.current) return;
    if (isPlaying) {
      playerRef.current.pauseVideo();
      setIsPlaying(false);
    } else {
      playerRef.current.playVideo();
      setIsPlaying(true);
    }
  };

  const handleTrackNext = () => {
    if (!playerRef.current) return;
    if (playlistTracks.length > 1) {
      const nextIdx = (currentTrackIndex + 1) % playlistTracks.length;
      setCurrentTrackIndex(nextIdx);
      playTrackAtIndex(nextIdx);
    } else if (typeof playerRef.current.nextVideo === 'function') {
      playerRef.current.nextVideo();
    }
  };

  const handleTrackPrev = () => {
    if (!playerRef.current) return;
    if (currentTime > 5) {
      playerRef.current.seekTo(0, true);
    } else if (playlistTracks.length > 1) {
      const prevIdx = (currentTrackIndex - 1 + playlistTracks.length) % playlistTracks.length;
      setCurrentTrackIndex(prevIdx);
      playTrackAtIndex(prevIdx);
    } else if (typeof playerRef.current.previousVideo === 'function') {
      playerRef.current.previousVideo();
    }
  };

  const playTrackAtIndex = (index: number) => {
    setCurrentTrackIndex(index);
    const targetTrack = playlistTracks[index];
    if (targetTrack) setCurrentTrack(targetTrack);

    if (playerRef.current) {
      if (typeof playerRef.current.playVideoAt === 'function') {
        playerRef.current.playVideoAt(index);
      } else if (targetTrack) {
        playerRef.current.loadVideoById(targetTrack.id);
      }
      setIsPlaying(true);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const seekTime = parseFloat(e.target.value);
    setCurrentTime(seekTime);
    if (playerRef.current && typeof playerRef.current.seekTo === 'function') {
      playerRef.current.seekTo(seekTime, true);
    }
  };

  // Save playlist by direct address (URL or ID)
  const handleSavePlaylistByAddress = (e: React.FormEvent) => {
    e.preventDefault();
    if (!directAddress.trim()) {
      toast.error('Ingresa una dirección o enlace de YouTube Music');
      return;
    }

    const parsed = parseYouTubeInput(directAddress);
    if (parsed.type === 'invalid') {
      toast.error('Dirección o enlace de YouTube no válido');
      return;
    }

    const title = directTitle.trim() || `Lista Guardada (${parsed.id})`;
    const category = directCategory.trim() || 'Mis Listas Directas';

    const newPlaylistObj: SavedPlaylist = {
      id: parsed.id,
      title,
      description: `Dirección: ${directAddress.trim()}`,
      category,
      url: directAddress.trim(),
      thumbnailUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=400&q=80',
    };

    const updated = [newPlaylistObj, ...customPlaylists.filter(p => p.id !== newPlaylistObj.id)];
    setCustomPlaylists(updated);
    try {
      localStorage.setItem('pos_custom_playlists', JSON.stringify(updated));
      toast.success(`¡Lista "${title}" guardada con éxito por dirección!`);
      setDirectAddress('');
      setDirectTitle('');
      setDirectCategory('');
      setShowAddByAddressModal(false);
    } catch (err) {
      toast.error('No se pudo guardar la lista');
    }
  };

  // Delete individual item from recently played
  const handleDeleteRecentPlaylist = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = recentlyPlayed.filter(p => p.id !== id);
    setRecentlyPlayed(updated);
    localStorage.setItem('pos_recently_played_playlists', JSON.stringify(updated));
    toast.success('Lista reproducida eliminada');
  };

  // Clear all recently played playlists
  const handleClearAllRecentPlaylists = () => {
    if (recentlyPlayed.length === 0) return;
    if (window.confirm('¿Deseas vaciar todas las listas reproducidas del historial?')) {
      setRecentlyPlayed([]);
      localStorage.setItem('pos_recently_played_playlists', JSON.stringify([]));
      toast.success('Historial de listas reproducidas vaciado');
    }
  };

  // Broadcast music state to DiscreteMiniPlayer
  useEffect(() => {
    const detail = {
      isPlaying,
      currentTrack,
      playlistTitle,
      currentTime,
      duration
    };
    window.dispatchEvent(new CustomEvent('pos-music-state', { detail }));
  }, [isPlaying, currentTrack, playlistTitle, currentTime, duration]);

  // Listen for commands from DiscreteMiniPlayer or external controls
  useEffect(() => {
    const handleCommand = (e: any) => {
      const cmd = e.detail?.command;
      if (cmd === 'togglePlayPause') togglePlayPause();
      else if (cmd === 'next') handleTrackNext();
      else if (cmd === 'prev') handleTrackPrev();
    };
    window.addEventListener('pos-music-command', handleCommand);
    return () => window.removeEventListener('pos-music-command', handleCommand);
  }, [isPlaying, playlistTracks, currentTrackIndex]);

  // Delete saved custom playlist
  const handleDeleteCustomPlaylist = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = customPlaylists.filter(p => p.id !== id);
    setCustomPlaylists(updated);
    localStorage.setItem('pos_custom_playlists', JSON.stringify(updated));
    toast.success('Lista eliminada');
  };

  // Toggle PC Background Music
  const toggleBgMusic = () => {
    if (!isPC) {
      toast.error('La música en segundo plano solo está permitida en computadoras / PC.');
      return;
    }
    const nextVal = !bgMusicEnabled;
    setBgMusicEnabled(nextVal);
    localStorage.setItem('pos_bg_music_enabled', String(nextVal));
    if (nextVal) {
      toast.success('Música en segundo plano activada para PC');
    } else {
      toast('Música en segundo plano desactivada', { icon: '⏸️' });
    }
  };

  // Time formatter
  const formatTime = (secs: number) => {
    if (!secs || isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const filteredTracks = playlistTracks.filter(t => 
    t.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    t.artist.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isCurrentTab = activeTab === 'music';

  if (!isPC) {
    if (!isCurrentTab) return null;
    return (
      <div className="h-full w-full bg-stone-950 text-stone-100 flex flex-col items-center justify-center p-6 text-center select-none">
        <div className="w-16 h-16 rounded-2xl bg-stone-900 border border-stone-800 flex items-center justify-center text-red-500 mb-4 shadow-xl">
          <Smartphone className="w-8 h-8" />
        </div>
        <h2 className="text-lg font-black text-white mb-2">Modo Música Exclusivo para PC</h2>
        <p className="text-xs text-stone-400 max-w-sm mb-6 leading-relaxed">
          El reproductor de música y mini reproductor en segundo plano están deshabilitados en dispositivos móviles para optimizar el rendimiento y consumo de datos.
        </p>
        <div className="px-4 py-2 bg-stone-900 border border-stone-800 rounded-xl text-stone-300 text-xs font-mono">
          Accede desde una computadora (PC / Laptop)
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={cn(
        "h-full w-full bg-stone-950 text-stone-100 flex flex-col overflow-y-auto lg:overflow-hidden select-none",
        !isCurrentTab && "hidden"
      )}>
        
        {/* TOP TOOLBAR */}
        <div className="bg-stone-900/95 border-b border-stone-800 px-4 py-3 flex flex-wrap items-center justify-between gap-3 shadow-md shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-600 via-amber-500 to-red-600 flex items-center justify-center shadow-lg shadow-rose-900/30">
              <Radio className="w-5 h-5 text-white animate-pulse" />
            </div>
            <div>
              <h1 className="text-base font-black tracking-wide text-white flex items-center gap-2">
                YouTube Music Player
                <span className="text-[10px] bg-red-600/30 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                  Música Restaurante
                </span>
              </h1>
              <p className="text-xs text-stone-400">Ambiente en vivo y listas de reproducción por dirección</p>
            </div>
          </div>

          {/* PC BACKGROUND MUSIC TOGGLE BANNER */}
          <div className="flex items-center gap-3">
            {isPC ? (
              <button
                onClick={toggleBgMusic}
                className={cn(
                  "px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-sm",
                  bgMusicEnabled 
                    ? "bg-emerald-950/40 border-emerald-500/50 text-emerald-300 hover:bg-emerald-900/50" 
                    : "bg-stone-800 border-stone-700 text-stone-400 hover:text-white"
                )}
                title="Música en segundo plano activa al cambiar de pantalla"
              >
                <Monitor className="w-4 h-4 text-emerald-400" />
                Segundo Plano (PC): {bgMusicEnabled ? 'Activado' : 'Desactivado'}
              </button>
            ) : (
              <div className="px-3 py-1.5 bg-stone-900 border border-stone-800 text-amber-400/90 text-[11px] font-semibold rounded-xl flex items-center gap-1.5 opacity-90">
                <Smartphone className="w-3.5 h-3.5" />
                <span>Segundo Plano sólo disponible en PC</span>
              </div>
            )}

            {/* BUTTON TO ADD BY ADDRESS */}
            <button
              onClick={() => setShowAddByAddressModal(true)}
              className="px-3.5 py-1.5 bg-stone-800 hover:bg-stone-700 border border-stone-700 text-white font-bold text-xs rounded-xl flex items-center gap-2 cursor-pointer transition-all shadow-md active:scale-95"
            >
              <Link className="w-3.5 h-3.5 text-red-400" />
              Guardar por Dirección
            </button>
          </div>
        </div>

        {/* INPUT URL / DIRECT PLAYBAR */}
        <div className="bg-stone-900/60 border-b border-stone-800/80 px-4 py-2.5 flex items-center gap-2">
          <Youtube className="text-red-500 w-4 h-4 shrink-0" />
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              if (inputUrl) loadPlaylistById(inputUrl, true);
            }}
            className="flex items-center gap-2 w-full"
          >
            <input 
              type="text" 
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              placeholder="Pegar dirección de lista o canción (ej. https://music.youtube.com/playlist?list=PL...)"
              className="flex-1 bg-stone-950 border border-stone-800 focus:border-red-500 focus:ring-1 focus:ring-red-500/50 rounded-xl px-3 py-1.5 text-xs text-stone-100 placeholder-stone-500 outline-none transition-all"
            />
            <button
              type="submit"
              disabled={isLoading || !inputUrl.trim()}
              className="px-4 py-1.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow shrink-0"
            >
              {isLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-white" />}
              Reproducir
            </button>
          </form>
        </div>

        {/* MAIN LAYOUT GRID */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-0 overflow-hidden">
          
          {/* LEFT COLUMN: LISTAS REPRODUCIDAS & MIS LISTAS GUARDADAS (4 cols) */}
          <div className="lg:col-span-4 bg-stone-900/50 border-r border-stone-800/80 p-4 flex flex-col gap-4 overflow-y-auto">
            
            {/* 1. LISTAS REPRODUCIDAS (REPLACING RECOMMENDED LISTS) */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-black uppercase tracking-wider text-stone-300 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-400" />
                  Listas Reproducidas ({recentlyPlayed.length})
                </h2>
                {recentlyPlayed.length > 0 && (
                  <button
                    onClick={handleClearAllRecentPlaylists}
                    className="text-[10px] text-stone-400 hover:text-red-400 font-bold flex items-center gap-1 cursor-pointer transition-colors"
                    title="Vaciar todo el historial"
                  >
                    <Trash2 className="w-3 h-3 text-red-400" /> Vaciar
                  </button>
                )}
              </div>

              {recentlyPlayed.length === 0 ? (
                <div className="p-4 bg-stone-900/40 rounded-2xl border border-stone-800 text-center">
                  <p className="text-xs text-stone-500">No hay listas reproduciendo en el historial.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2.5">
                  {recentlyPlayed.map((pl) => {
                    const isActive = currentPlaylistId === pl.id;
                    return (
                      <div
                        key={pl.id}
                        onClick={() => loadPlaylistById(pl.url || pl.id, true)}
                        className={cn(
                          "p-3 rounded-2xl border transition-all cursor-pointer flex items-center gap-3 relative group overflow-hidden",
                          isActive 
                            ? "bg-stone-800/95 border-red-500/70 shadow-lg shadow-red-950/40" 
                            : "bg-stone-900/70 border-stone-800/80 hover:bg-stone-800/60 hover:border-stone-700"
                        )}
                      >
                        <div className="w-12 h-12 rounded-xl overflow-hidden bg-stone-950 relative shrink-0">
                          <img 
                            src={pl.thumbnailUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=400&q=80'} 
                            alt={pl.title} 
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                          />
                          {isActive && isPlaying && (
                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                              <div className="flex items-end gap-0.5 h-4">
                                <span className="w-1 bg-red-500 animate-[bounce_1s_infinite_100ms] h-full rounded-full"></span>
                                <span className="w-1 bg-red-500 animate-[bounce_1s_infinite_300ms] h-3 rounded-full"></span>
                                <span className="w-1 bg-red-500 animate-[bounce_1s_infinite_200ms] h-4 rounded-full"></span>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1 mb-0.5">
                            <span className="text-[9px] font-black uppercase text-amber-500 tracking-wider">
                              {pl.category || 'Historial'}
                            </span>
                            {pl.lastPlayedAt && (
                              <span className="text-[9px] font-mono text-stone-500">
                                {pl.lastPlayedAt}
                              </span>
                            )}
                          </div>
                          <h3 className="text-xs font-bold text-stone-100 truncate">
                            {pl.title}
                          </h3>
                          <p className="text-[11px] text-stone-400 truncate leading-tight">
                            {pl.description}
                          </p>
                        </div>

                        <button
                          onClick={(e) => handleDeleteRecentPlaylist(pl.id, e)}
                          className="p-1.5 rounded-lg hover:bg-red-500/20 text-stone-500 hover:text-red-400 transition-colors cursor-pointer shrink-0"
                          title="Eliminar del historial"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 2. MIS LISTAS GUARDADAS (CON DIRECCIÓN) */}
            <div className="mt-2">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-black uppercase tracking-wider text-stone-300 flex items-center gap-2">
                  <ListMusic className="w-4 h-4 text-red-400" />
                  Mis Listas Guardadas ({customPlaylists.length})
                </h2>
                <button
                  onClick={() => setShowAddByAddressModal(true)}
                  className="text-[10px] text-red-400 hover:text-red-300 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3" /> Agregar
                </button>
              </div>

              {customPlaylists.length === 0 ? (
                <div className="p-4 bg-stone-900/40 rounded-2xl border border-stone-800 text-center">
                  <p className="text-xs text-stone-500 mb-2">No has guardado listas con dirección.</p>
                  <button
                    onClick={() => setShowAddByAddressModal(true)}
                    className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 text-xs font-bold rounded-xl border border-red-500/30 cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Link className="w-3 h-3" /> Guardar Lista por Dirección
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {customPlaylists.map((pl) => {
                    const isActive = currentPlaylistId === pl.id;
                    return (
                      <div
                        key={pl.id}
                        onClick={() => loadPlaylistById(pl.url || pl.id, true)}
                        className={cn(
                          "p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 group",
                          isActive 
                            ? "bg-red-950/20 border-red-500/50 shadow-md" 
                            : "bg-stone-900/50 border-stone-800 hover:bg-stone-800/40"
                        )}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-stone-800 flex items-center justify-center text-red-500 shrink-0">
                            <Music className="w-4.5 h-4.5" />
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-xs font-bold text-stone-100 truncate">{pl.title}</h4>
                            <p className="text-[10px] text-stone-400 font-mono truncate">{pl.description}</p>
                          </div>
                        </div>

                        <button
                          onClick={(e) => handleDeleteCustomPlaylist(pl.id, e)}
                          className="p-1.5 rounded-lg hover:bg-red-500/20 text-stone-500 hover:text-red-400 transition-colors cursor-pointer"
                          title="Eliminar de mis listas"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>

          {/* RIGHT COLUMN: PLAYER CONTROLS + QUEUE (8 cols) */}
          <div className="lg:col-span-8 flex flex-col overflow-hidden bg-stone-950">
            
            {/* CURRENT TRACK HERO CARD */}
            <div className="p-4 sm:p-6 bg-gradient-to-b from-stone-900 to-stone-950 border-b border-stone-800 flex flex-col md:flex-row items-center gap-6 shrink-0 relative overflow-hidden">
              
              <div className="absolute top-0 right-0 w-96 h-96 bg-red-600/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>

              {/* ALBUM ART / VINYL */}
              <div className="relative group shrink-0">
                <div className={cn(
                  "w-36 h-36 sm:w-44 sm:h-44 rounded-2xl overflow-hidden shadow-2xl border-2 border-stone-800 relative bg-stone-900 flex items-center justify-center transition-transform duration-500",
                  isPlaying && "shadow-red-900/30 scale-102"
                )}>
                  {currentTrack?.thumbnailUrl ? (
                    <img 
                      src={currentTrack.thumbnailUrl} 
                      alt={currentTrack.title} 
                      className="w-full h-full object-cover" 
                    />
                  ) : (
                    <Disc className={cn("w-16 h-16 text-stone-700", isPlaying && "animate-spin [animation-duration:4s]")} />
                  )}

                  <div 
                    onClick={togglePlayPause}
                    className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                  >
                    <div className="w-12 h-12 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform">
                      {isPlaying ? <Pause className="w-6 h-6 fill-white" /> : <Play className="w-6 h-6 fill-white ml-0.5" />}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setShowVideo(!showVideo)}
                  className="absolute -bottom-2 -right-2 bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white px-2.5 py-1 rounded-full text-[10px] font-bold border border-stone-700 flex items-center gap-1 shadow-md transition-all cursor-pointer"
                >
                  <Youtube className="w-3 h-3 text-red-500" />
                  {showVideo ? 'Ocultar Video' : 'Ver Video'}
                </button>
              </div>

              {/* CONTROLS & TRACK DETAILS */}
              <div className="flex-1 w-full min-w-0 flex flex-col justify-center">
                
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-red-400 bg-red-950/40 border border-red-800/40 px-2.5 py-0.5 rounded-full inline-block">
                    {playlistTitle}
                  </span>
                  <span className="text-[11px] text-stone-400 font-mono">
                    Canción {currentTrackIndex + 1} de {playlistTracks.length || 1}
                  </span>
                </div>

                <h2 className="text-lg sm:text-xl font-black text-white truncate leading-tight mb-0.5">
                  {currentTrack?.title || 'Selecciona una canción'}
                </h2>
                <p className="text-xs sm:text-sm font-semibold text-stone-400 truncate mb-4">
                  {currentTrack?.artist || 'YouTube Music'}
                </p>

                {/* SLIDER */}
                <div className="w-full mb-3">
                  <input 
                    type="range"
                    min="0"
                    max={duration || 100}
                    value={currentTime}
                    onChange={handleSeek}
                    className="w-full h-1.5 bg-stone-800 rounded-lg appearance-none cursor-pointer accent-red-500 hover:accent-red-400 transition-all"
                  />
                  <div className="flex justify-between items-center text-[11px] font-mono text-stone-400 mt-1">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>

                {/* PLAYBACK CONTROL BUTTONS */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => setIsShuffle(!isShuffle)}
                      className={cn(
                        "p-2 rounded-xl transition-colors cursor-pointer",
                        isShuffle ? "text-red-400 bg-red-950/50" : "text-stone-500 hover:text-stone-300"
                      )}
                      title="Aleatorio"
                    >
                      <Shuffle className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => setIsRepeat(!isRepeat)}
                      className={cn(
                        "p-2 rounded-xl transition-colors cursor-pointer",
                        isRepeat ? "text-red-400 bg-red-950/50" : "text-stone-500 hover:text-stone-300"
                      )}
                      title="Repetir"
                    >
                      <Repeat className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleTrackPrev}
                      className="p-2.5 rounded-full bg-stone-800 hover:bg-stone-700 text-stone-200 transition-transform active:scale-90 cursor-pointer shadow"
                      title="Anterior"
                    >
                      <SkipBack className="w-5 h-5 fill-current" />
                    </button>

                    <button
                      onClick={togglePlayPause}
                      className="w-12 h-12 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-lg shadow-red-950/50 transition-transform active:scale-90 cursor-pointer"
                      title={isPlaying ? "Pausar" : "Reproducir"}
                    >
                      {isPlaying ? (
                        <Pause className="w-6 h-6 fill-white" />
                      ) : (
                        <Play className="w-6 h-6 fill-white ml-0.5" />
                      )}
                    </button>

                    <button
                      onClick={handleTrackNext}
                      className="p-2.5 rounded-full bg-stone-800 hover:bg-stone-700 text-stone-200 transition-transform active:scale-90 cursor-pointer shadow"
                      title="Siguiente"
                    >
                      <SkipForward className="w-5 h-5 fill-current" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsMuted(!isMuted)}
                      className="text-stone-400 hover:text-white transition-colors cursor-pointer"
                    >
                      {isMuted || volume === 0 ? <VolumeX className="w-4 h-4 text-red-400" /> : volume < 50 ? <Volume1 className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    </button>
                    <input 
                      type="range"
                      min="0"
                      max="100"
                      value={isMuted ? 0 : volume}
                      onChange={(e) => {
                        setVolume(parseInt(e.target.value));
                        if (isMuted) setIsMuted(false);
                      }}
                      className="w-20 h-1.5 bg-stone-800 rounded-lg appearance-none cursor-pointer accent-stone-300"
                    />
                  </div>
                </div>

              </div>
            </div>

            {/* VIDEO CONTAINER */}
            <div className={cn(
              "w-full transition-all duration-300 overflow-hidden bg-black relative",
              showVideo ? "h-64 sm:h-80 border-b border-stone-800" : "h-0"
            )}>
              <div id="yt-player-target" className="w-full h-full"></div>
            </div>

            {/* TRACKLIST */}
            <div className="flex-1 flex flex-col p-4 overflow-hidden">
              <div className="flex items-center justify-between gap-3 mb-3 shrink-0">
                <h3 className="text-xs font-black uppercase tracking-wider text-stone-300 flex items-center gap-2">
                  <ListMusic className="w-4 h-4 text-red-500" />
                  Lista de Canciones ({playlistTracks.length})
                </h3>

                <div className="relative w-48 sm:w-64">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-500 w-3.5 h-3.5" />
                  <input 
                    type="text" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar canción..."
                    className="w-full bg-stone-900 border border-stone-800 rounded-xl pl-8 pr-3 py-1 text-xs text-stone-200 placeholder-stone-500 outline-none focus:border-stone-700"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto space-y-1 pr-1">
                {filteredTracks.length === 0 ? (
                  <div className="py-12 text-center text-stone-500 text-xs">
                    No se encontraron canciones en esta lista.
                  </div>
                ) : (
                  filteredTracks.map((track, idx) => {
                    const isCurrent = currentTrackIndex === idx || currentTrack?.id === track.id;
                    return (
                      <div
                        key={`${track.id}-${idx}`}
                        onClick={() => playTrackAtIndex(idx)}
                        className={cn(
                          "p-2.5 rounded-xl transition-all cursor-pointer flex items-center gap-3 border group",
                          isCurrent 
                            ? "bg-red-950/30 border-red-500/50 text-white font-bold" 
                            : "bg-stone-900/40 hover:bg-stone-900 border-stone-800/40 text-stone-300 hover:text-white"
                        )}
                      >
                        <div className="w-6 text-center text-xs font-mono font-bold text-stone-500 shrink-0">
                          {isCurrent && isPlaying ? (
                            <div className="flex items-end justify-center gap-0.5 h-3.5">
                              <span className="w-0.5 bg-red-500 animate-[bounce_0.8s_infinite_100ms] h-full"></span>
                              <span className="w-0.5 bg-red-500 animate-[bounce_0.8s_infinite_300ms] h-2"></span>
                              <span className="w-0.5 bg-red-500 animate-[bounce_0.8s_infinite_200ms] h-3"></span>
                            </div>
                          ) : (
                            idx + 1
                          )}
                        </div>

                        <div className="w-10 h-10 rounded-lg bg-stone-950 overflow-hidden shrink-0 relative">
                          <img 
                            src={track.thumbnailUrl} 
                            alt={track.title} 
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform" 
                          />
                          {isCurrent && (
                            <div className="absolute inset-0 bg-red-600/30 flex items-center justify-center">
                              <Play className="w-4 h-4 fill-white text-white" />
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <h4 className={cn("text-xs truncate leading-tight", isCurrent ? "text-red-400 font-extrabold" : "text-stone-200")}>
                            {track.title}
                          </h4>
                          <p className="text-[11px] text-stone-500 truncate">
                            {track.artist}
                          </p>
                        </div>

                        <a
                          href={`https://www.youtube.com/watch?v=${track.id}`}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="p-1.5 text-stone-600 hover:text-stone-300 rounded-lg hover:bg-stone-800 transition-colors"
                          title="Abrir en YouTube"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

          </div>

        </div>
      </div>

      {/* MODAL TO ADD PLAYLIST BY DIRECT ADDRESS / URL */}
      {showAddByAddressModal && (
        <div className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-3xl w-full max-w-lg p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between mb-4 border-b border-stone-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-red-600/20 border border-red-500/30 flex items-center justify-center text-red-400">
                  <Link className="w-4 h-4" />
                </div>
                <h3 className="text-base font-black text-white">Guardar Lista por Dirección</h3>
              </div>
              <button 
                onClick={() => setShowAddByAddressModal(false)}
                className="text-stone-400 hover:text-white p-1 rounded-lg hover:bg-stone-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePlaylistByAddress} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-stone-300 mb-1 block">
                  Dirección o Enlace de la Lista (URL / ID YouTube Music) *
                </label>
                <input 
                  type="text" 
                  required
                  value={directAddress}
                  onChange={(e) => setDirectAddress(e.target.value)}
                  placeholder="Ej: https://music.youtube.com/playlist?list=PL... o ID de playlist"
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-stone-500 outline-none focus:border-red-500 font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-stone-300 mb-1 block">
                  Nombre Personalizado para la Lista *
                </label>
                <input 
                  type="text" 
                  required
                  value={directTitle}
                  onChange={(e) => setDirectTitle(e.target.value)}
                  placeholder="Ej: Cumbias de la Tarde / Mariachi Especial"
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-stone-500 outline-none focus:border-stone-700"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-stone-300 mb-1 block">
                  Categoría o Notas (Opcional)
                </label>
                <input 
                  type="text" 
                  value={directCategory}
                  onChange={(e) => setDirectCategory(e.target.value)}
                  placeholder="Ej: Para Desayunos / Fin de Semana"
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-stone-500 outline-none focus:border-stone-700"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-stone-800">
                <button
                  type="button"
                  onClick={() => setShowAddByAddressModal(false)}
                  className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl flex items-center gap-2 cursor-pointer shadow-md"
                >
                  <Save className="w-3.5 h-3.5" />
                  Guardar Lista
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
