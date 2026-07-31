import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Play, Pause, SkipForward, SkipBack, Volume2, VolumeX, Volume1,
  Music, ListMusic, Plus, Trash2, ExternalLink, Radio, Disc, 
  Shuffle, Repeat, Search, Youtube, RefreshCw, X, Edit3, ChevronRight, ChevronDown, Tag, Check,
  Link, Save, CheckCircle2, Sparkles, Filter, Layers, Eye, EyeOff, Download
} from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '../lib/utils';
import { db } from '../firebase';
import { collection, onSnapshot, doc, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';

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
  tracks?: TrackItem[];
  importedAt?: string;
  isCustom?: boolean;
}

// Preset recommended playlists
const PRESET_PLAYLISTS: SavedPlaylist[] = [
  {
    id: 'PLDISa-NAtXbvhLd4f-v_4_lC668R8Xg8C',
    title: 'Cumbia & Salsa Tropical',
    description: 'Sabor y ritmo alegre para amenizar la comida.',
    category: 'Fiesta & Sabor',
    url: 'https://music.youtube.com/playlist?list=PLDISa-NAtXbvhLd4f-v_4_lC668R8Xg8C',
    thumbnailUrl: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=400&q=80',
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
    tracks: [
      { id: '5qap5aO4i9A', title: 'Girl From Ipanema', artist: 'Stan Getz & Astrud Gilberto', thumbnailUrl: 'https://i.ytimg.com/vi/5qap5aO4i9A/hqdefault.jpg' },
    ]
  }
];

// Automatically select high-quality matching image based on music genre, title, description or tracks
export function getMatchingImage(title: string, category: string, description: string, tracks: TrackItem[] = []): string {
  const trackText = tracks.map(t => `${t.title} ${t.artist}`).join(' ');
  const combined = `${title} ${category} ${description} ${trackText}`.toLowerCase();
  
  if (combined.includes('cumbia') || combined.includes('salsa') || combined.includes('tropical') || combined.includes('baile') || combined.includes('ritmo') || combined.includes('sonora') || combined.includes('margarita') || combined.includes('angeles azules') || combined.includes('cañaveral')) {
    return 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=400&q=80';
  }
  if (combined.includes('mariachi') || combined.includes('ranchera') || combined.includes('mexic') || combined.includes('norteñ') || combined.includes('banda') || combined.includes('vicente') || combined.includes('fernandez') || combined.includes('infante') || combined.includes('vargas') || combined.includes('potrillo')) {
    return 'https://images.unsplash.com/photo-1568051243851-f9b136146e97?auto=format&fit=crop&w=400&q=80';
  }
  if (combined.includes('jazz') || combined.includes('bossa') || combined.includes('blues') || combined.includes('sax') || combined.includes('instrumental') || combined.includes('relax') || combined.includes('café') || combined.includes('cafe') || combined.includes('piano') || combined.includes('chill')) {
    return 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=400&q=80';
  }
  if (combined.includes('pop') || combined.includes('balada') || combined.includes('romant') || combined.includes('love') || combined.includes('exitos') || combined.includes('luis miguel') || combined.includes('mana') || combined.includes('jose jose')) {
    return 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=400&q=80';
  }
  if (combined.includes('rock') || combined.includes('metal') || combined.includes('guitar') || combined.includes('indie') || combined.includes('soda stereo') || combined.includes('caifanes') || combined.includes('enanitos')) {
    return 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?auto=format&fit=crop&w=400&q=80';
  }
  if (combined.includes('electro') || combined.includes('dance') || combined.includes('techno') || combined.includes('dj') || combined.includes('party') || combined.includes('house')) {
    return 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?auto=format&fit=crop&w=400&q=80';
  }
  if (combined.includes('reggeat') || combined.includes('urban') || combined.includes('trap') || combined.includes('hip hop') || combined.includes('rap') || combined.includes('bad bunny') || combined.includes('j balvin')) {
    return 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=400&q=80';
  }
  
  return 'https://images.unsplash.com/photo-1487180142328-054b783fc471?auto=format&fit=crop&w=400&q=80';
}

// Extract playlist IDs from text (single or multiple)
export function parseYouTubePlaylistIds(text: string): string[] {
  const idsSet = new Set<string>();
  if (!text) return [];

  // 1. Matches list=PL... or list=RD... or list=OLAK5...
  const listMatches = text.matchAll(/[?&]list=([a-zA-Z0-9_-]+)/gi);
  for (const m of listMatches) {
    if (m[1] && m[1].length >= 8) idsSet.add(m[1]);
  }

  // 2. Standalone playlist IDs starting with PL, RD, FL, OLAK5, UU, LL
  const standaloneMatches = text.matchAll(/\b(PL|RD|FL|OLAK5|UU|LL)[a-zA-Z0-9_-]{10,}\b/g);
  for (const m of standaloneMatches) {
    idsSet.add(m[0]);
  }

  return Array.from(idsSet);
}

// Extract video IDs from text (single or multiple)
export function parseYouTubeVideoIds(text: string): string[] {
  const idsSet = new Set<string>();
  if (!text) return [];

  const videoMatches = text.matchAll(/(?:v=|v\/|embed\/|youtu\.be\/|\/v\/)([\w-]{11})/gi);
  for (const m of videoMatches) {
    if (m[1] && !m[0].includes('list=')) idsSet.add(m[1]);
  }

  return Array.from(idsSet);
}

const ensurePlaylistTracks = (playlist: SavedPlaylist): TrackItem[] => {
  if (playlist.tracks && playlist.tracks.length > 0) {
    return playlist.tracks;
  }
  const presetMatch = PRESET_PLAYLISTS.find(p => p.id === playlist.id);
  if (presetMatch && presetMatch.tracks && presetMatch.tracks.length > 0) {
    return presetMatch.tracks;
  }
  return [];
};

interface MusicPlayerViewProps {
  userRole?: string;
  activeTab?: string;
  onNavigateToMusic?: () => void;
}

export const MusicPlayerView: React.FC<MusicPlayerViewProps> = ({
  activeTab,
}) => {
  // Saved / Custom Playlists
  const [customPlaylists, setCustomPlaylists] = useState<SavedPlaylist[]>([]);
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});

  const toggleCategoryCollapse = (cat: string) => {
    setCollapsedCategories(prev => ({
      ...prev,
      [cat]: !prev[cat]
    }));
  };
  
  // Active Playlist & Player state
  const [currentPlaylistId, setCurrentPlaylistId] = useState<string>(PRESET_PLAYLISTS[0].id);
  const [currentPlaylist, setCurrentPlaylist] = useState<SavedPlaylist>(PRESET_PLAYLISTS[0]);
  const [playlistTracks, setPlaylistTracks] = useState<TrackItem[]>(PRESET_PLAYLISTS[0].tracks || []);
  
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number>(0);
  const [currentTrack, setCurrentTrack] = useState<TrackItem | null>(PRESET_PLAYLISTS[0].tracks?.[0] || null);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(80);
  const [shuffle, setShuffle] = useState<boolean>(false);
  const [repeat, setRepeat] = useState<'none' | 'all' | 'one'>('none');

  const [playbackTime, setPlaybackTime] = useState<number>(0);
  const [trackDuration, setTrackDuration] = useState<number>(0);

  // Filters & Search
  const [filterMode, setFilterMode] = useState<'all' | 'custom'>('custom'); // Default to showing added playlists
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [trackSearchQuery, setTrackSearchQuery] = useState<string>('');
  const [showVideoPlayer, setShowVideoPlayer] = useState<boolean>(false);

  // Modals state
  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [showAddTrackModal, setShowAddTrackModal] = useState<boolean>(false);

  // Sequential Import Review Modal state
  const [pendingImportQueue, setPendingImportQueue] = useState<SavedPlaylist[]>([]);
  const [currentQueueIndex, setCurrentQueueIndex] = useState<number>(0);
  const [showSequentialModal, setShowSequentialModal] = useState<boolean>(false);

  // Form states for item review in sequential wizard
  const [reviewTitle, setReviewTitle] = useState<string>('');
  const [reviewCategory, setReviewCategory] = useState<string>('Fiesta & Sabor');
  const [reviewDescription, setReviewDescription] = useState<string>('');

  // Edit Existing Playlist Modal state
  const [playlistToEdit, setPlaylistToEdit] = useState<SavedPlaylist | null>(null);
  const [editTitle, setEditTitle] = useState<string>('');
  const [editCategory, setEditCategory] = useState<string>('');
  const [editDescription, setEditDescription] = useState<string>('');

  // Import form state
  const [importTextInput, setImportTextInput] = useState<string>('');
  const [importCategory, setImportCategory] = useState<string>('Mi Música');
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importProgress, setImportProgress] = useState<string>('');

  // Add Track form state
  const [newTrackUrl, setNewTrackUrl] = useState<string>('');
  const [newTrackTitle, setNewTrackTitle] = useState<string>('');
  const [newTrackArtist, setNewTrackArtist] = useState<string>('');

  // Player Ref & API Ready state
  const playerRef = useRef<any>(null);
  const [isApiReady, setIsApiReady] = useState<boolean>(false);
  const containerIdRef = useRef<string>('yt-player-container');

  // Load custom playlists from Firestore & LocalStorage
  useEffect(() => {
    // 1. LocalStorage initial load
    try {
      const cached = localStorage.getItem('yt_custom_playlists');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setCustomPlaylists(parsed);
        }
      }
    } catch (e) {}

    // 2. Firestore Sync
    const unsubscribe = onSnapshot(collection(db, 'yt_music_playlists'), (snapshot) => {
      const loaded: SavedPlaylist[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        loaded.push({
          id: docSnap.id,
          title: data.title || 'Lista Importada',
          description: data.description || '',
          category: data.category || 'Importadas',
          thumbnailUrl: data.thumbnailUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=400&q=80',
          url: data.url || '',
          tracks: data.tracks || [],
          importedAt: data.importedAt || new Date().toISOString(),
          isCustom: true
        });
      });

      if (loaded.length > 0) {
        setCustomPlaylists(loaded);
        try {
          localStorage.setItem('yt_custom_playlists', JSON.stringify(loaded));
        } catch (e) {}
      }
    }, () => {
      // Ignore Firestore permission errors silently
    });

    return () => unsubscribe();
  }, []);

  // Save single playlist to Cloud & LocalStorage
  const savePlaylistToStorage = async (playlistObj: SavedPlaylist) => {
    setCustomPlaylists(prev => {
      const idx = prev.findIndex(p => p.id === playlistObj.id);
      let updated: SavedPlaylist[];
      if (idx >= 0) {
        updated = [...prev];
        updated[idx] = playlistObj;
      } else {
        updated = [playlistObj, ...prev];
      }
      try {
        localStorage.setItem('yt_custom_playlists', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });

    try {
      await setDoc(doc(db, 'yt_music_playlists', playlistObj.id), {
        title: playlistObj.title,
        description: playlistObj.description || '',
        category: playlistObj.category || 'Mi Música',
        thumbnailUrl: playlistObj.thumbnailUrl || '',
        url: playlistObj.url || '',
        tracks: playlistObj.tracks || [],
        importedAt: playlistObj.importedAt || new Date().toISOString()
      }, { merge: true });
    } catch (e) {}
  };

  // Delete playlist from Cloud & LocalStorage
  const handleDeletePlaylist = async (playlistIdToDelete: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    setCustomPlaylists(prev => {
      const filtered = prev.filter(p => p.id !== playlistIdToDelete);
      try {
        localStorage.setItem('yt_custom_playlists', JSON.stringify(filtered));
      } catch (err) {}
      return filtered;
    });

    try {
      await deleteDoc(doc(db, 'yt_music_playlists', playlistIdToDelete));
    } catch (err) {}

    toast.success('Lista eliminada correctamente');

    // If active playlist was deleted, switch to preset
    if (currentPlaylistId === playlistIdToDelete) {
      loadPlaylist(PRESET_PLAYLISTS[0]);
    }
  };

  // Delete all added playlists
  const handleDeleteAllCustomPlaylists = async () => {
    if (!window.confirm('¿Estás seguro de eliminar TODAS las listas agregadas?')) return;

    setCustomPlaylists([]);
    try {
      localStorage.removeItem('yt_custom_playlists');
    } catch (err) {}

    try {
      const batch = writeBatch(db);
      customPlaylists.forEach(p => {
        batch.delete(doc(db, 'yt_music_playlists', p.id));
      });
      await batch.commit();
    } catch (err) {}

    toast.success('Todas las listas agregadas han sido eliminadas');
    loadPlaylist(PRESET_PLAYLISTS[0]);
  };

  // Fetch metadata for a YouTube Playlist
  const fetchPlaylistMetadata = async (playlistId: string): Promise<{ title: string; thumbnailUrl: string }> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      const response = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/playlist?list=${playlistId}`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        if (data && data.title) {
          return {
            title: data.title,
            thumbnailUrl: data.thumbnail_url || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=400&q=80'
          };
        }
      }
    } catch (e) {}

    return {
      title: `Lista YT (${playlistId.substring(0, 10)})`,
      thumbnailUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=400&q=80'
    };
  };

  // Fetch metadata for a YouTube Video Track
  const fetchTrackMetadata = async (videoId: string): Promise<TrackItem> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        if (data && data.title) {
          return {
            id: videoId,
            title: data.title,
            artist: data.author_name || 'YouTube Music',
            thumbnailUrl: data.thumbnail_url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
          };
        }
      }
    } catch (e) {}

    // Fallback if oEmbed failed
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const resp = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (resp.ok) {
        const data = await resp.json();
        if (data && data.title) {
          return {
            id: videoId,
            title: data.title,
            artist: data.author_name || 'YouTube Music',
            thumbnailUrl: data.thumbnail_url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
          };
        }
      }
    } catch (e) {}

    return {
      id: videoId,
      title: `Canción (${videoId})`,
      artist: 'YouTube Music',
      thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
    };
  };

  // Update sequential review form fields whenever current index or queue changes
  useEffect(() => {
    if (pendingImportQueue.length > 0 && currentQueueIndex < pendingImportQueue.length) {
      const current = pendingImportQueue[currentQueueIndex];
      if (current) {
        setReviewTitle(current.title || '');
        setReviewCategory(current.category || importCategory || 'Mi Música');
        setReviewDescription(current.description || '');
      }
    }
  }, [currentQueueIndex, pendingImportQueue]);

  // Handle Importing Single or Multiple Playlists/Videos -> Populates Sequential Review Wizard
  const handleImportPlaylistsOrSongs = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importTextInput.trim()) {
      toast.error('Ingresa o pega uno o varios enlaces/IDs de YouTube Music');
      return;
    }

    setIsImporting(true);
    setImportProgress('Analizando enlaces de YouTube...');

    const playlistIds = parseYouTubePlaylistIds(importTextInput);
    const videoIds = parseYouTubeVideoIds(importTextInput);

    if (playlistIds.length === 0 && videoIds.length === 0) {
      toast.error('No se encontraron enlaces o IDs válidos de listas o canciones de YouTube.');
      setIsImporting(false);
      return;
    }

    const queueItems: SavedPlaylist[] = [];

    // 1. Process Playlists
    if (playlistIds.length > 0) {
      setImportProgress(`Procesando ${playlistIds.length} lista(s)...`);
      for (let i = 0; i < playlistIds.length; i++) {
        const plId = playlistIds[i];
        setImportProgress(`Obteniendo título de lista ${i + 1} de ${playlistIds.length}...`);
        
        const meta = await fetchPlaylistMetadata(plId);
        
        // Ensure unique ID to avoid overwriting existing saved lists
        let finalId = plId;
        if (customPlaylists.some(p => p.id === finalId)) {
          finalId = `${plId}_${Date.now()}`;
        }

        // Auto assign high quality image matching the title/category
        const resolvedThumbnail = getMatchingImage(meta.title, importCategory, `Lista de YouTube Music (${plId})`, []);

        const playlistObj: SavedPlaylist = {
          id: finalId,
          title: meta.title,
          description: `Lista de YouTube Music (${plId})`,
          category: importCategory.trim() || 'Mi Música',
          url: `https://music.youtube.com/playlist?list=${plId}`,
          thumbnailUrl: resolvedThumbnail,
          isCustom: true,
          tracks: []
        };

        queueItems.push(playlistObj);
      }
    }

    // 2. Process Songs (if pasted individual song links without a playlist ID)
    if (playlistIds.length === 0 && videoIds.length > 0) {
      setImportProgress(`Procesando ${videoIds.length} canción(es)...`);
      const tracks: TrackItem[] = [];
      for (const vId of videoIds) {
        const tMeta = await fetchTrackMetadata(vId);
        tracks.push(tMeta);
      }

      const customPlId = `pl_custom_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const playlistTitle = `Lista de Canciones (${tracks.length} temas)`;
      const playlistCategory = importCategory.trim() || 'Mis Canciones';
      const playlistDescription = `Importada desde enlaces de YouTube`;
      
      // Auto assign matching cover image
      const resolvedThumbnail = getMatchingImage(playlistTitle, playlistCategory, playlistDescription, tracks) || tracks[0]?.thumbnailUrl;

      const playlistObj: SavedPlaylist = {
        id: customPlId,
        title: playlistTitle,
        description: playlistDescription,
        category: playlistCategory,
        url: `https://music.youtube.com/watch?v=${tracks[0]?.id || ''}`,
        thumbnailUrl: resolvedThumbnail,
        tracks,
        isCustom: true
      };

      queueItems.push(playlistObj);
    }

    setIsImporting(false);
    setShowImportModal(false);

    if (queueItems.length > 0) {
      setPendingImportQueue(queueItems);
      setCurrentQueueIndex(0);
      setShowSequentialModal(true);
      toast.success(`Se prepararon ${queueItems.length} lista(s). Personaliza el nombre y categoría a continuación:`);
    }
  };

  // Sequential Wizard: Save Current Item & Proceed to Next or Finish
  const handleSaveAndNextSequential = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!pendingImportQueue[currentQueueIndex]) return;

    const currentItem = pendingImportQueue[currentQueueIndex];
    
    const finalTitle = reviewTitle.trim() || currentItem.title || 'Lista Personalizada';
    const finalCategory = reviewCategory.trim() || 'Mi Música';
    const finalDescription = reviewDescription.trim() || currentItem.description || '';

    // Assign automatic matching image based on finalized user input fields and tracks
    const resolvedThumbnail = getMatchingImage(finalTitle, finalCategory, finalDescription, currentItem.tracks || []) || currentItem.thumbnailUrl;

    // Double check unique ID to avoid overwriting existing saved playlists
    let finalId = currentItem.id;
    if (customPlaylists.some(p => p.id === finalId)) {
      finalId = `${currentItem.id}_${Date.now()}`;
    }

    const finalPlaylistObj: SavedPlaylist = {
      ...currentItem,
      id: finalId,
      title: finalTitle,
      category: finalCategory,
      description: finalDescription,
      thumbnailUrl: resolvedThumbnail
    };

    // Save item to cloud & local state
    await savePlaylistToStorage(finalPlaylistObj);

    if (currentQueueIndex + 1 < pendingImportQueue.length) {
      const nextIdx = currentQueueIndex + 1;
      setCurrentQueueIndex(nextIdx);
      toast.success(`Guardada "${finalPlaylistObj.title}". Siguiente lista (${nextIdx + 1}/${pendingImportQueue.length})`);
    } else {
      // Completed all
      setShowSequentialModal(false);
      setPendingImportQueue([]);
      setCurrentQueueIndex(0);
      setImportTextInput('');
      setFilterMode('custom');
      
      toast.success(`¡Todas las listas se guardaron en tu biblioteca! Puedes reproducirlas cuando desees.`);
    }
  };

  // Sequential Wizard: Skip current item
  const handleSkipSequential = () => {
    if (currentQueueIndex + 1 < pendingImportQueue.length) {
      const nextIdx = currentQueueIndex + 1;
      setCurrentQueueIndex(nextIdx);
      toast('Lista omitida', { icon: '⏭️' });
    } else {
      setShowSequentialModal(false);
      setPendingImportQueue([]);
      setCurrentQueueIndex(0);
      setImportTextInput('');
      setFilterMode('custom');
      toast.success('Proceso de revisión finalizado');
    }
  };

  // Sequential Wizard: Cancel all remaining items and close modal
  const handleCancelSequential = () => {
    setShowSequentialModal(false);
    setPendingImportQueue([]);
    setCurrentQueueIndex(0);
    setImportTextInput('');
    toast('Ventana cerrada');
  };

  // Open Edit Existing Playlist Modal
  const handleOpenEditPlaylist = (playlist: SavedPlaylist, e: React.MouseEvent) => {
    e.stopPropagation();
    setPlaylistToEdit(playlist);
    setEditTitle(playlist.title);
    setEditCategory(playlist.category || 'Mi Música');
    setEditDescription(playlist.description || '');
  };

  // Save Edited Playlist
  const handleSaveEditedPlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playlistToEdit) return;

    const finalTitle = editTitle.trim() || playlistToEdit.title;
    const finalCategory = editCategory.trim() || 'Mi Música';
    const finalDescription = editDescription.trim() || '';

    // Recalculate matching cover image based on the edited name, category, and tracks
    const resolvedThumbnail = getMatchingImage(finalTitle, finalCategory, finalDescription, playlistToEdit.tracks || []) || playlistToEdit.thumbnailUrl;

    const updatedObj: SavedPlaylist = {
      ...playlistToEdit,
      title: finalTitle,
      category: finalCategory,
      description: finalDescription,
      thumbnailUrl: resolvedThumbnail
    };

    await savePlaylistToStorage(updatedObj);

    if (currentPlaylistId === updatedObj.id) {
      setCurrentPlaylist(updatedObj);
    }

    setPlaylistToEdit(null);
    toast.success(`Lista "${updatedObj.title}" actualizada correctamente`);
  };

  // Add individual track to current playlist
  const handleAddTrackToCurrentPlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTrackUrl.trim()) {
      toast.error('Ingresa la URL o ID del video de YouTube');
      return;
    }

    const parsedVideoIds = parseYouTubeVideoIds(newTrackUrl);
    const videoId = parsedVideoIds[0] || newTrackUrl.trim();

    if (!videoId) {
      toast.error('Enlace o ID de video no válido');
      return;
    }

    const meta = await fetchTrackMetadata(videoId);
    const newTrackObj: TrackItem = {
      id: videoId,
      title: newTrackTitle.trim() || meta.title || `Canción (${videoId})`,
      artist: newTrackArtist.trim() || meta.artist || 'YouTube Music',
      thumbnailUrl: meta.thumbnailUrl || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
    };

    const updatedTracks = [...playlistTracks, newTrackObj];
    setPlaylistTracks(updatedTracks);

    // Save if this playlist is a custom playlist
    const customMatch = customPlaylists.find(p => p.id === currentPlaylistId);
    if (customMatch) {
      const updatedPlaylistObj: SavedPlaylist = {
        ...customMatch,
        tracks: updatedTracks
      };
      await savePlaylistToStorage(updatedPlaylistObj);
    }

    toast.success(`¡"${newTrackObj.title}" agregada a la lista!`);
    setNewTrackUrl('');
    setNewTrackTitle('');
    setNewTrackArtist('');
    setShowAddTrackModal(false);
  };

  // Delete individual track from current playlist
  const handleDeleteTrackFromCurrentPlaylist = async (indexToDelete: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (indexToDelete < 0 || indexToDelete >= playlistTracks.length) return;

    const trackToDelete = playlistTracks[indexToDelete];
    const updatedTracks = playlistTracks.filter((_, idx) => idx !== indexToDelete);
    setPlaylistTracks(updatedTracks);

    if (currentTrackIndex === indexToDelete) {
      if (updatedTracks.length > 0) {
        const nextIdx = indexToDelete % updatedTracks.length;
        setCurrentTrackIndex(nextIdx);
        setCurrentTrack(updatedTracks[nextIdx]);
      } else {
        setCurrentTrack(null);
      }
    } else if (currentTrackIndex > indexToDelete) {
      setCurrentTrackIndex(prev => prev - 1);
    }

    // Save updated tracks list if custom
    const customMatch = customPlaylists.find(p => p.id === currentPlaylistId);
    if (customMatch) {
      const updatedPlaylistObj: SavedPlaylist = {
        ...customMatch,
        tracks: updatedTracks
      };
      await savePlaylistToStorage(updatedPlaylistObj);
    }

    toast.success(`Canción "${trackToDelete?.title || 'seleccionada'}" eliminada`);
  };

  const handleDownloadTrack = (track: TrackItem, e: React.MouseEvent) => {
    e.stopPropagation();
    toast.success(`Redirigiendo para descargar "${track.title}"...`);
    window.open(`https://www.y2mate.com/youtube/${track.id}`, '_blank');
  };

  const handleDownloadPlaylist = () => {
    toast.success(`Preparando la descarga de las ${playlistTracks.length} canciones...`);
    // Open the first track as a demonstration
    if (playlistTracks.length > 0) {
      setTimeout(() => {
         window.open(`https://www.y2mate.com/youtube/${playlistTracks[0].id}`, '_blank');
      }, 1000);
    }
  };

  // Initialize YouTube Iframe API
  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

      window.onYouTubeIframeAPIReady = () => {
        setIsApiReady(true);
      };
    } else {
      setIsApiReady(true);
    }
  }, []);

  // Update track information from YouTube Player state
  const updateTrackInfoFromPlayer = useCallback(() => {
    if (!playerRef.current) return;
    try {
      const dur = playerRef.current.getDuration() || 0;
      const curTime = playerRef.current.getCurrentTime() || 0;
      if (dur > 0) setTrackDuration(dur);
      if (curTime >= 0) setPlaybackTime(curTime);

      // Extract current video ID if available
      const videoData = playerRef.current.getVideoData?.();
      if (videoData && videoData.video_id) {
        const curId = videoData.video_id;
        const curTitle = videoData.title;
        const curAuthor = videoData.author || 'YouTube Music';

        // Update active track in playlistTracks if placeholder title
        if (curTitle) {
          setPlaylistTracks(prev => {
            const targetIdx = prev.findIndex(t => t.id === curId);
            if (targetIdx >= 0) {
              const existing = prev[targetIdx];
              if (existing.title.startsWith('Canción #') || existing.title.startsWith('Canción (') || !existing.title) {
                const updated = [...prev];
                updated[targetIdx] = {
                  ...existing,
                  title: curTitle,
                  artist: curAuthor
                };
                savePlaylistToStorage({
                  ...currentPlaylist,
                  tracks: updated
                });
                return updated;
              }
            }
            return prev;
          });
        }

        if (!currentTrack || currentTrack.id !== curId) {
          const matchIdx = playlistTracks.findIndex(t => t.id === curId);
          if (matchIdx >= 0) {
            setCurrentTrackIndex(matchIdx);
          }
          const match = playlistTracks.find(t => t.id === curId);
          if (match) {
            setCurrentTrack({
              ...match,
              title: (match.title && !match.title.startsWith('Canción #')) ? match.title : (curTitle || match.title),
              artist: (match.artist && match.artist !== 'YouTube Music') ? match.artist : curAuthor
            });
          } else {
            setCurrentTrack({
              id: curId,
              title: curTitle || `Canción YT`,
              artist: curAuthor,
              thumbnailUrl: `https://i.ytimg.com/vi/${curId}/hqdefault.jpg`
            });
          }
        }
      }

      // Populate & sync playlist tracks from YouTube Iframe Player
      const playlistVideoIds: string[] = playerRef.current.getPlaylist?.();
      if (Array.isArray(playlistVideoIds) && playlistVideoIds.length > 0) {
        const needsSync = playlistTracks.length < playlistVideoIds.length || 
                          playlistTracks.some((t, i) => t.id !== playlistVideoIds[i]);

        if (needsSync) {
          const extractedTracks: TrackItem[] = playlistVideoIds.map((vid, idx) => {
            const existing = playlistTracks.find(t => t.id === vid);
            if (existing && existing.title && !existing.title.startsWith('Canción #')) {
              return existing;
            }
            return {
              id: vid,
              title: (idx === 0 && videoData && videoData.video_id === vid && videoData.title) ? videoData.title : `Canción #${idx + 1}`,
              artist: (idx === 0 && videoData && videoData.video_id === vid && videoData.author) ? videoData.author : 'YouTube Music',
              thumbnailUrl: `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`
            };
          });

          setPlaylistTracks(extractedTracks);

          // Save/Sync back to current playlist in Storage
          const updatedPlaylist: SavedPlaylist = {
            ...currentPlaylist,
            tracks: extractedTracks
          };
          setCurrentPlaylist(updatedPlaylist);
          savePlaylistToStorage(updatedPlaylist);

          // Fetch rich track metadata in background for up to 40 tracks
          playlistVideoIds.slice(0, 40).forEach(async (vid) => {
            const meta = await fetchTrackMetadata(vid);
            setPlaylistTracks(prev => {
              const targetIdx = prev.findIndex(t => t.id === vid);
              if (targetIdx >= 0 && meta && meta.title && !meta.title.includes('(' + vid + ')')) {
                const updated = [...prev];
                updated[targetIdx] = {
                  ...updated[targetIdx],
                  title: meta.title,
                  artist: meta.artist || 'YouTube Music',
                  thumbnailUrl: meta.thumbnailUrl || updated[targetIdx].thumbnailUrl
                };
                
                // Persist detailed tracks
                savePlaylistToStorage({
                  ...currentPlaylist,
                  tracks: updated
                });

                return updated;
              }
              return prev;
            });
          });
        }
      }
    } catch (e) {}
  }, [currentTrack, playlistTracks, currentPlaylist]);

  // Handle Player State Changes
  const onPlayerStateChange = useCallback((event: any) => {
    // YT.PlayerState: PLAYING = 1, PAUSED = 2, ENDED = 0, BUFFERING = 3
    if (event.data === 1) {
      setIsPlaying(true);
      updateTrackInfoFromPlayer();
    } else if (event.data === 2) {
      setIsPlaying(false);
    } else if (event.data === 0) {
      setIsPlaying(false);
      // Auto next track
      if (repeat === 'one') {
        playerRef.current?.playVideo();
      } else {
        handleNextTrack();
      }
    }
  }, [repeat, updateTrackInfoFromPlayer]);

  // Instantiate or mount YT Player
  useEffect(() => {
    if (!isApiReady) return;

    const elem = document.getElementById(containerIdRef.current);
    if (!elem) return;

    if (!playerRef.current) {
      try {
        playerRef.current = new window.YT.Player(containerIdRef.current, {
          height: '100%',
          width: '100%',
          playerVars: {
            autoplay: 1,
            controls: 1,
            modestbranding: 1,
            rel: 0,
            showinfo: 0,
            fs: 0
          },
          events: {
            onReady: (event: any) => {
              event.target.setVolume(volume);
              if (currentPlaylistId) {
                event.target.loadPlaylist({
                  list: currentPlaylistId,
                  listType: 'playlist'
                });
              }
            },
            onStateChange: onPlayerStateChange
          }
        });
      } catch (e) {}
    }
  }, [isApiReady, volume, currentPlaylistId, onPlayerStateChange]);

  // Periodic timer for playback progress bar
  useEffect(() => {
    const interval = setInterval(() => {
      if (isPlaying && playerRef.current) {
        updateTrackInfoFromPlayer();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isPlaying, updateTrackInfoFromPlayer]);

  // Listen for commands from DiscreteMiniPlayer (Navbar mini controls)
  useEffect(() => {
    const handleMusicCommand = (e: any) => {
      const { command, payload } = e.detail || {};
      if (command === 'play') {
        playerRef.current?.playVideo();
        setIsPlaying(true);
      } else if (command === 'pause') {
        playerRef.current?.pauseVideo();
        setIsPlaying(false);
      } else if (command === 'next') {
        handleNextTrack();
      } else if (command === 'prev') {
        handlePrevTrack();
      } else if (command === 'loadPlaylist' && payload) {
        loadPlaylist(payload);
      } else if (command === 'volumeUp') {
        const nv = Math.min(100, volume + 10);
        handleVolumeChange(nv);
      } else if (command === 'volumeDown') {
        const nv = Math.max(0, volume - 10);
        handleVolumeChange(nv);
      }
    };

    window.addEventListener('pos-music-command', handleMusicCommand);
    return () => window.removeEventListener('pos-music-command', handleMusicCommand);
  }, [volume, playlistTracks, currentTrackIndex]);

  // Broadcast current music state to DiscreteMiniPlayer and update Media Session
  useEffect(() => {
    const detail = {
      isPlaying,
      currentTrack: currentTrack || { title: currentPlaylist.title, artist: 'YouTube Music', thumbnailUrl: currentPlaylist.thumbnailUrl },
      currentPlaylistTitle: currentPlaylist.title,
      playbackTime,
      trackDuration
    };
    window.dispatchEvent(new CustomEvent('pos-music-sync', { detail }));

    // Update Media Session API for background OS playback controls
    if ('mediaSession' in navigator) {
      const track = detail.currentTrack;
      navigator.mediaSession.metadata = new window.MediaMetadata({
        title: track.title,
        artist: track.artist,
        album: detail.currentPlaylistTitle,
        artwork: track.thumbnailUrl ? [
          { src: track.thumbnailUrl, sizes: '512x512', type: 'image/jpeg' }
        ] : []
      });

      navigator.mediaSession.setActionHandler('play', () => {
        playerRef.current?.playVideo();
        setIsPlaying(true);
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        playerRef.current?.pauseVideo();
        setIsPlaying(false);
      });
      navigator.mediaSession.setActionHandler('nexttrack', () => {
        handleNextTrack();
      });
      navigator.mediaSession.setActionHandler('previoustrack', () => {
        handlePrevTrack();
      });
    }
  }, [isPlaying, currentTrack, currentPlaylist, playbackTime, trackDuration]);

  // Load playlist into player
  const loadPlaylist = (playlist: SavedPlaylist) => {
    setCurrentPlaylistId(playlist.id);
    setCurrentPlaylist(playlist);

    const tracks = ensurePlaylistTracks(playlist);
    setPlaylistTracks(tracks);
    setCurrentTrackIndex(0);
    setCurrentTrack(tracks[0] || null);

    if (playerRef.current && typeof playerRef.current.loadPlaylist === 'function') {
      try {
        let ytListId = '';
        if (playlist.url && playlist.url.includes('list=')) {
          ytListId = playlist.url.split('list=')[1].split('&')[0];
        } else if (playlist.id && !playlist.id.startsWith('pl_custom_')) {
          ytListId = playlist.id.split('_')[0];
        }

        if (ytListId) {
          playerRef.current.loadPlaylist({
            list: ytListId,
            listType: 'playlist'
          });
        } else if (tracks.length > 0) {
          const videoIds = tracks.map(t => t.id);
          if (videoIds.length > 0) {
            playerRef.current.loadPlaylist(videoIds);
          }
        }
        setIsPlaying(true);
      } catch (e) {}
    }

    toast.success(`Reproduciendo "${playlist.title}"`);
  };

  // Play specific track in current tracklist
  const playTrackAtIndex = (index: number) => {
    if (index < 0 || index >= playlistTracks.length) return;
    setCurrentTrackIndex(index);
    const targetTrack = playlistTracks[index];
    setCurrentTrack(targetTrack);

    if (playerRef.current) {
      try {
        if (typeof playerRef.current.playVideoAt === 'function' && !currentPlaylistId.startsWith('pl_custom_')) {
          playerRef.current.playVideoAt(index);
        } else if (targetTrack?.id) {
          playerRef.current.loadVideoById(targetTrack.id);
        }
        setIsPlaying(true);
      } catch (e) {}
    }
  };

  // Controls
  const togglePlayPause = () => {
    if (!playerRef.current) return;
    try {
      if (isPlaying) {
        playerRef.current.pauseVideo();
        setIsPlaying(false);
      } else {
        playerRef.current.playVideo();
        setIsPlaying(true);
      }
    } catch (e) {}
  };

  const handleNextTrack = () => {
    if (playlistTracks.length > 0) {
      const nextIdx = (currentTrackIndex + 1) % playlistTracks.length;
      playTrackAtIndex(nextIdx);
    } else if (playerRef.current && typeof playerRef.current.nextVideo === 'function') {
      playerRef.current.nextVideo();
    }
  };

  const handlePrevTrack = () => {
    if (playlistTracks.length > 0) {
      const prevIdx = (currentTrackIndex - 1 + playlistTracks.length) % playlistTracks.length;
      playTrackAtIndex(prevIdx);
    } else if (playerRef.current && typeof playerRef.current.previousVideo === 'function') {
      playerRef.current.previousVideo();
    }
  };

  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol);
    if (newVol === 0) setIsMuted(true);
    else setIsMuted(false);

    if (playerRef.current && typeof playerRef.current.setVolume === 'function') {
      playerRef.current.setVolume(newVol);
    }
  };

  const toggleMute = () => {
    if (isMuted) {
      setIsMuted(false);
      if (playerRef.current) playerRef.current.unMute();
    } else {
      setIsMuted(true);
      if (playerRef.current) playerRef.current.mute();
    }
  };

  const handleSeek = (newTime: number) => {
    setPlaybackTime(newTime);
    if (playerRef.current && typeof playerRef.current.seekTo === 'function') {
      playerRef.current.seekTo(newTime, true);
    }
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Dynamic list of all genres/categories
  const defaultCategories = ['Fiesta & Sabor', 'Cumbias', 'Salsa', 'Mariachi', 'Pop Latino', 'Rock', 'Ambiental', 'Restaurante'];
  const allAvailableCategories = Array.from(new Set([
    ...defaultCategories,
    ...PRESET_PLAYLISTS.map(p => p.category),
    ...customPlaylists.map(p => p.category).filter(Boolean)
  ])).sort();

  // Combined lists for rendering with deduplication
  const presetNotInCustom = PRESET_PLAYLISTS.filter(preset => !customPlaylists.some(cp => cp.id === preset.id));
  const allPlaylistsList = filterMode === 'custom' 
    ? customPlaylists 
    : [...customPlaylists, ...presetNotInCustom];

  const filteredPlaylists = allPlaylistsList.filter(p => {
    const matchesSearch = p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'Todos' || p.category.toLowerCase() === selectedCategory.toLowerCase();
    return matchesSearch && matchesCategory;
  });

  const filteredTracks = playlistTracks.filter(t => 
    t.title.toLowerCase().includes(trackSearchQuery.toLowerCase()) ||
    t.artist.toLowerCase().includes(trackSearchQuery.toLowerCase())
  );

  const isCurrentTab = activeTab === 'music';

  return (
    <div 
      className={cn(
        "h-full w-full flex-col overflow-hidden select-none flex",
        !isCurrentTab ? "absolute -left-[9999px] top-0 z-[-50] bg-transparent pointer-events-none opacity-0" : "bg-stone-950 text-stone-100"
      )}
    >
      
      {/* TOP HEADER */}
      <header className="p-4 bg-stone-900 border-b border-stone-800 flex items-center justify-between gap-3 flex-wrap shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-600/20 text-red-500 border border-red-500/30 flex items-center justify-center font-bold shadow-md">
            <Youtube className="w-6 h-6 text-red-500" />
          </div>
          <div>
            <h1 className="text-base font-black text-white tracking-wide flex items-center gap-2">
              Reproductor YouTube Music
            </h1>
            <p className="text-xs text-stone-400">
              Listas e importaciones guardadas en la nube
            </p>
          </div>
        </div>

        {/* TOP CONTROLS & FILTER TABS */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="bg-stone-950 p-1 rounded-xl border border-stone-800 flex items-center gap-1">
            <button
              onClick={() => setFilterMode('custom')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer",
                filterMode === 'custom' 
                  ? "bg-red-600 text-white shadow-sm" 
                  : "text-stone-400 hover:text-stone-200"
              )}
            >
              <Filter className="w-3.5 h-3.5" />
              Solo Agregadas ({customPlaylists.length})
            </button>
            <button
              onClick={() => setFilterMode('all')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer",
                filterMode === 'all' 
                  ? "bg-stone-800 text-white shadow-sm" 
                  : "text-stone-400 hover:text-stone-200"
              )}
            >
              <Layers className="w-3.5 h-3.5" />
              Todas
            </button>
          </div>

          <button
            onClick={() => setShowImportModal(true)}
            className="px-3.5 py-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-bold text-xs rounded-xl shadow-lg flex items-center gap-2 transition-all cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Importar Lista(s)</span>
          </button>

          {customPlaylists.length > 0 && (
            <button
              onClick={handleDeleteAllCustomPlaylists}
              className="p-2 bg-stone-900 hover:bg-red-950/40 text-stone-400 hover:text-red-400 border border-stone-800 rounded-xl transition-all cursor-pointer"
              title="Eliminar todas las listas agregadas"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      {/* MAIN CONTENT WORKSPACE */}
      <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12 gap-4 p-4">

        {/* LEFT COLUMN: ACTIVE PLAYER & SONG LIST (8 Cols) */}
        <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-4 overflow-hidden h-full">

          {/* PLAYER CARD */}
          <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 sm:p-6 shadow-2xl relative overflow-hidden shrink-0">
            
            {/* Background blur artwork */}
            {currentTrack?.thumbnailUrl && (
              <div 
                className="absolute inset-0 bg-cover bg-center opacity-10 blur-2xl pointer-events-none scale-125"
                style={{ backgroundImage: `url(${currentTrack.thumbnailUrl})` }}
              />
            )}

            <div className="relative z-10 flex flex-col sm:flex-row items-center gap-5">
              
              {/* ALBUM ART THUMBNAIL */}
              <div className="relative group shrink-0">
                <img 
                  src={currentTrack?.thumbnailUrl || currentPlaylist.thumbnailUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=400&q=80'} 
                  alt={currentTrack?.title || currentPlaylist.title}
                  className="w-28 h-28 sm:w-36 sm:h-36 object-cover rounded-2xl border-2 border-stone-700/60 shadow-2xl transition-all duration-300"
                />
                <button
                  onClick={togglePlayPause}
                  className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 rounded-2xl flex items-center justify-center transition-all cursor-pointer backdrop-blur-xs"
                >
                  {isPlaying ? <Pause className="w-10 h-10 text-white fill-white" /> : <Play className="w-10 h-10 text-white fill-white ml-1" />}
                </button>
              </div>

              {/* TRACK INFO & CONTROLS */}
              <div className="flex-1 min-w-0 w-full text-center sm:text-left">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-950/60 border border-red-500/30 text-red-400 text-[10px] font-black uppercase tracking-wider mb-2">
                  <Disc className="w-3 h-3 animate-spin-slow" />
                  <span>{currentPlaylist.title}</span>
                </div>

                <h2 className="text-base sm:text-lg font-black text-white truncate leading-tight mb-1">
                  {currentTrack?.title || 'Sin canción seleccionada'}
                </h2>
                <p className="text-xs text-stone-400 truncate mb-4 font-medium">
                  {currentTrack?.artist || 'YouTube Music'}
                </p>

                {/* SEEK BAR */}
                <div className="space-y-1 mb-4">
                  <input 
                    type="range"
                    min={0}
                    max={trackDuration || 100}
                    value={playbackTime}
                    onChange={(e) => handleSeek(Number(e.target.value))}
                    className="w-full h-1.5 bg-stone-800 accent-red-500 rounded-lg cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] font-mono text-stone-400">
                    <span>{formatTime(playbackTime)}</span>
                    <span>{formatTime(trackDuration)}</span>
                  </div>
                </div>

                {/* CONTROL BUTTONS */}
                <div className="flex items-center justify-center sm:justify-start gap-3">
                  <button
                    onClick={() => setShuffle(!shuffle)}
                    className={cn("p-2 rounded-xl transition-all cursor-pointer", shuffle ? "bg-red-600 text-white" : "text-stone-400 hover:text-white")}
                    title="Aleatorio"
                  >
                    <Shuffle className="w-4 h-4" />
                  </button>

                  <button
                    onClick={handlePrevTrack}
                    className="p-2.5 bg-stone-800 hover:bg-stone-700 text-stone-200 hover:text-white rounded-xl transition-all cursor-pointer active:scale-95"
                    title="Anterior"
                  >
                    <SkipBack className="w-5 h-5" />
                  </button>

                  <button
                    onClick={togglePlayPause}
                    className="p-3.5 bg-red-600 hover:bg-red-500 text-white rounded-2xl shadow-lg transition-all cursor-pointer active:scale-95"
                  >
                    {isPlaying ? <Pause className="w-6 h-6 fill-white" /> : <Play className="w-6 h-6 fill-white ml-0.5" />}
                  </button>

                  <button
                    onClick={handleNextTrack}
                    className="p-2.5 bg-stone-800 hover:bg-stone-700 text-stone-200 hover:text-white rounded-xl transition-all cursor-pointer active:scale-95"
                    title="Siguiente"
                  >
                    <SkipForward className="w-5 h-5" />
                  </button>

                  <button
                    onClick={() => setRepeat(repeat === 'none' ? 'all' : repeat === 'all' ? 'one' : 'none')}
                    className={cn("p-2 rounded-xl transition-all cursor-pointer", repeat !== 'none' ? "bg-red-600 text-white" : "text-stone-400 hover:text-white")}
                    title={`Repetición: ${repeat}`}
                  >
                    <Repeat className="w-4 h-4" />
                  </button>

                  {/* Volume Control */}
                  <div className="hidden sm:flex items-center gap-1.5 ml-2">
                    <button onClick={toggleMute} className="text-stone-400 hover:text-white p-1">
                      {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    </button>
                    <input 
                      type="range"
                      min={0}
                      max={100}
                      value={isMuted ? 0 : volume}
                      onChange={(e) => handleVolumeChange(Number(e.target.value))}
                      className="w-16 h-1 bg-stone-800 accent-red-500 rounded-lg cursor-pointer"
                    />
                  </div>

                  {/* Toggle Video Player Box */}
                  <button
                    onClick={() => setShowVideoPlayer(!showVideoPlayer)}
                    className={cn(
                      "p-2 rounded-xl transition-all cursor-pointer ml-auto",
                      showVideoPlayer ? "bg-red-950/60 text-red-400 border border-red-500/30" : "text-stone-400 hover:text-white"
                    )}
                    title={showVideoPlayer ? "Ocultar reproductor de video" : "Mostrar reproductor de video"}
                  >
                    {showVideoPlayer ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

              </div>
            </div>

            {/* EMBEDDED YOUTUBE IFRAME BOX */}
            <div 
              className={cn(
                "rounded-xl overflow-hidden bg-black transition-all",
                showVideoPlayer ? "mt-4 h-48 sm:h-56 border border-stone-800 opacity-100" : "mt-4 h-[1px] w-[1px] opacity-0 pointer-events-none border-none overflow-hidden"
              )}
            >
              <div id={containerIdRef.current} className="w-full h-full" />
            </div>

          </div>

          {/* SONGS LIST OF CURRENT PLAYLIST */}
          <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 shadow-xl flex-1 flex flex-col overflow-hidden min-h-[320px]">
            
            <div className="flex items-center justify-between gap-3 mb-3 shrink-0 flex-wrap">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-black uppercase tracking-wider text-stone-300 flex items-center gap-2">
                  <ListMusic className="w-4 h-4 text-red-500" />
                  Canciones de la Lista ({playlistTracks.length})
                </h3>
                <div className="flex items-center gap-1.5 ml-auto">
                  <button
                    onClick={handleDownloadPlaylist}
                    className="px-2.5 py-1 bg-stone-800 hover:bg-stone-700 text-stone-200 text-[11px] font-bold rounded-lg border border-stone-700 flex items-center gap-1 transition-all cursor-pointer"
                    title="Descargar todas las canciones"
                  >
                    <Download className="w-3 h-3 text-red-400" />
                    <span className="hidden sm:inline">Descargar Lista</span>
                  </button>
                  <button
                    onClick={() => setShowAddTrackModal(true)}
                    className="px-2.5 py-1 bg-stone-800 hover:bg-stone-700 text-stone-200 text-[11px] font-bold rounded-lg border border-stone-700 flex items-center gap-1 transition-all cursor-pointer"
                    title="Añadir una canción por enlace o ID"
                  >
                    <Plus className="w-3 h-3 text-red-400" />
                    <span className="hidden sm:inline">Añadir</span>
                  </button>
                </div>
              </div>

              <div className="relative w-full mt-2">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-500 w-3.5 h-3.5" />
                <input 
                  type="text"
                  placeholder="Buscar canción o artista..."
                  value={trackSearchQuery}
                  onChange={(e) => setTrackSearchQuery(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-stone-200 placeholder-stone-500 outline-none focus:border-red-500/50"
                />
              </div>
            </div>

            {/* SONGS LIST ITEMS */}
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar mt-3">
              {filteredTracks.length === 0 ? (
                <div className="text-center py-12 text-stone-500">
                  <Music className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-xs font-bold">No hay canciones listadas para esta lista</p>
                  <p className="text-[11px] text-stone-600 mt-1">Haz clic en "+ Añadir Canción" para agregar canciones manualmente.</p>
                </div>
              ) : (
                filteredTracks.map((track, idx) => {
                  const isCurrent = currentTrackIndex === idx;
                  return (
                    <div 
                      key={`${track.id}-${idx}`}
                      onClick={() => playTrackAtIndex(idx)}
                      className={cn(
                        "p-2.5 rounded-xl transition-all cursor-pointer flex items-center gap-3 border group relative",
                        isCurrent 
                          ? "bg-red-950/40 border-red-500/50 text-white font-bold" 
                          : "bg-stone-950/40 hover:bg-stone-800/60 border-stone-800/40 text-stone-300 hover:text-white"
                      )}
                    >
                      <span className="text-xs font-mono text-stone-500 w-5 text-center shrink-0">
                        {isCurrent && isPlaying ? (
                          <Radio className="w-3.5 h-3.5 text-red-500 animate-pulse mx-auto" />
                        ) : (
                          idx + 1
                        )}
                      </span>

                      <img 
                        src={track.thumbnailUrl || `https://i.ytimg.com/vi/${track.id}/hqdefault.jpg`} 
                        alt={track.title} 
                        className="w-9 h-9 object-cover rounded-lg shrink-0 border border-stone-800"
                      />

                      <div className="flex-1 min-w-0">
                        <p className="text-xs truncate font-bold leading-tight">{track.title}</p>
                        <p className="text-[10px] text-stone-400 truncate">{track.artist}</p>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={(e) => handleDownloadTrack(track, e)}
                          className="p-1.5 rounded-lg hover:bg-stone-700 text-stone-500 hover:text-stone-300 transition-colors cursor-pointer opacity-70 hover:opacity-100"
                          title="Descargar canción"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => handleDeleteTrackFromCurrentPlaylist(idx, e)}
                          className="p-1.5 rounded-lg hover:bg-red-500/20 text-stone-500 hover:text-red-400 transition-colors cursor-pointer opacity-70 hover:opacity-100"
                          title="Eliminar canción de esta lista"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

          </div>

        </div>

        {/* RIGHT COLUMN: SAVED & IMPORTED PLAYLISTS GRID (4 Cols) */}
        <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-3 overflow-hidden h-full">

          <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 shadow-xl flex-1 flex flex-col overflow-hidden">
            
            <div className="flex items-center justify-between gap-2 mb-3 shrink-0">
              <h3 className="text-xs font-black uppercase tracking-wider text-stone-200 flex items-center gap-2">
                <Music className="w-4 h-4 text-red-500" />
                {filterMode === 'custom' ? `Listas Agregadas (${customPlaylists.length})` : `Todas las Listas (${allPlaylistsList.length})`}
              </h3>

              <div className="relative w-36">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-stone-500 w-3 h-3" />
                <input 
                  type="text"
                  placeholder="Buscar..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-800 rounded-lg pl-6 pr-2 py-1 text-[11px] text-stone-200 placeholder-stone-500 outline-none focus:border-red-500/50"
                />
              </div>
            </div>

            {/* Dynamic Genre/Category Filter Bar */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-2.5 mb-1 shrink-0 select-none no-scrollbar border-b border-stone-800/50" style={{ scrollbarWidth: 'none' }}>
              <button
                onClick={() => setSelectedCategory('Todos')}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap cursor-pointer border",
                  selectedCategory === 'Todos'
                    ? "bg-red-600/25 border-red-500 text-red-400 shadow-sm"
                    : "bg-stone-950/80 border-stone-800 text-stone-400 hover:text-stone-200"
                )}
              >
                Todos
              </button>
              {allAvailableCategories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap cursor-pointer border",
                    selectedCategory.toLowerCase() === cat.toLowerCase()
                      ? "bg-red-600/25 border-red-500 text-red-400 shadow-sm"
                      : "bg-stone-950/80 border-stone-800 text-stone-400 hover:text-stone-200"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* PLAYLISTS GROUPED BY CATEGORY (COLLAPSIBLE ACCORDION SECTIONS) */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
              {filteredPlaylists.length === 0 ? (
                <div className="text-center py-16 text-stone-500">
                  <ListMusic className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p className="text-xs font-bold text-stone-400">
                    {filterMode === 'custom' ? 'No has agregado listas de YouTube aún' : 'No se encontraron listas'}
                  </p>
                  <p className="text-[11px] text-stone-500 mt-1 max-w-xs mx-auto">
                    Haz clic en "Importar Lista(s)" para agregar enlaces o IDs de tus listas de YouTube Music.
                  </p>
                  <button
                    onClick={() => setShowImportModal(true)}
                    className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl shadow-md inline-flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Plus className="w-4 h-4" /> Importar Lista(s) Ahora
                  </button>
                </div>
              ) : (
                Object.entries(
                  filteredPlaylists.reduce((acc: Record<string, SavedPlaylist[]>, pl) => {
                    const cat = pl.category || 'Otros';
                    if (!acc[cat]) acc[cat] = [];
                    acc[cat].push(pl);
                    return acc;
                  }, {})
                ).map(([cat, playlists]) => {
                  const isCollapsed = collapsedCategories[cat] || false;
                  return (
                    <div key={cat} className="bg-stone-950/40 border border-stone-800/80 rounded-2xl overflow-hidden shadow-md">
                      {/* Category Collapsible Header */}
                      <button
                        onClick={() => toggleCategoryCollapse(cat)}
                        className="w-full px-3.5 py-2.5 bg-stone-900/90 hover:bg-stone-800/90 border-b border-stone-800/60 flex items-center justify-between text-left transition-colors cursor-pointer select-none"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {isCollapsed ? <ChevronRight className="w-4 h-4 text-red-500 shrink-0" /> : <ChevronDown className="w-4 h-4 text-red-500 shrink-0" />}
                          <span className="text-xs font-black uppercase tracking-wider text-white truncate">{cat}</span>
                          <span className="px-2 py-0.5 rounded-full bg-red-950/60 text-red-400 text-[10px] font-bold border border-red-500/20 shrink-0">
                            {playlists.length}
                          </span>
                        </div>
                        <span className="text-[10px] text-stone-400 font-medium shrink-0 ml-2">
                          {isCollapsed ? 'Desplegar' : 'Ocultar'}
                        </span>
                      </button>

                      {/* Playlists in Category Dropdown */}
                      {!isCollapsed && (
                        <div className="p-2 space-y-2">
                          {playlists.map((pl, plIdx) => {
                            const isActive = currentPlaylistId === pl.id;
                            const resolvedThumb = pl.thumbnailUrl || getMatchingImage(pl.title, pl.category, pl.description, pl.tracks || []);
                            return (
                              <div
                                key={`${pl.id}-${plIdx}`}
                                onClick={() => loadPlaylist(pl)}
                                className={cn(
                                  "p-2.5 rounded-xl border transition-all cursor-pointer flex items-center gap-3 group relative overflow-hidden",
                                  isActive 
                                    ? "bg-red-950/50 border-red-500/60 shadow-md" 
                                    : "bg-stone-900/60 hover:bg-stone-800/80 border-stone-800/60"
                                )}
                              >
                                <div className="relative shrink-0">
                                  <img 
                                    src={resolvedThumb} 
                                    alt={pl.title}
                                    className="w-12 h-12 object-cover rounded-xl border border-stone-800"
                                  />
                                  {isActive && (
                                    <div className="absolute inset-0 bg-red-600/40 rounded-xl flex items-center justify-center">
                                      <Radio className="w-4 h-4 text-white animate-pulse" />
                                    </div>
                                  )}
                                </div>

                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    {pl.isCustom && (
                                      <span className="px-1.5 py-0.5 rounded-md bg-red-950 border border-red-500/30 text-[9px] font-bold text-red-400">
                                        Agregada
                                      </span>
                                    )}
                                  </div>
                                  <h4 className="text-xs font-bold text-white truncate mt-0.5 leading-tight">{pl.title}</h4>
                                  <p className="text-[10px] text-stone-400 truncate mt-0.5">
                                    {pl.tracks && pl.tracks.length > 0 ? `${pl.tracks.length} canciones` : 'Lista de YouTube'}
                                  </p>
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                  {pl.isCustom && (
                                    <>
                                      <button
                                        onClick={(e) => handleOpenEditPlaylist(pl, e)}
                                        className="p-1 rounded-lg hover:bg-stone-700 text-stone-400 hover:text-stone-200 transition-colors cursor-pointer"
                                        title="Editar nombre y categoría"
                                      >
                                        <Edit3 className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        onClick={(e) => handleDeletePlaylist(pl.id, e)}
                                        className="p-1 rounded-lg hover:bg-red-500/20 text-stone-500 hover:text-red-400 transition-colors cursor-pointer"
                                        title="Eliminar esta lista"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

          </div>

        </div>

      </div>

      {/* MODAL 1: PASTE YOUTUBE LINKS / PLAYLISTS */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 w-full max-w-lg rounded-2xl p-6 shadow-2xl relative">
            <button 
              onClick={() => setShowImportModal(false)}
              className="absolute top-4 right-4 text-stone-400 hover:text-white p-1 rounded-lg hover:bg-stone-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-600/20 text-red-500 border border-red-500/30 flex items-center justify-center font-bold">
                <Youtube className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Importar Lista(s) de YouTube Music</h3>
                <p className="text-xs text-stone-400">Pega enlaces o IDs individuales o varios a la vez</p>
              </div>
            </div>

            <form onSubmit={handleImportPlaylistsOrSongs} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-300 mb-1">
                  Dirección(es) o ID(s) de YouTube Music / YouTube *
                </label>
                <textarea 
                  required
                  rows={4}
                  value={importTextInput}
                  onChange={(e) => setImportTextInput(e.target.value)}
                  placeholder="Ejemplo:
https://music.youtube.com/playlist?list=PL...
PLDISa-NAtXbvhLd4f-v_4_lC668R8Xg8C
(Puedes pegar varios enlaces separados por salto de línea)"
                  className="w-full bg-stone-950 border border-stone-800 focus:border-red-500 rounded-xl p-3 text-xs text-white placeholder-stone-500 outline-none resize-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-300 mb-1">
                  Categoría Base Predeterminada
                </label>
                <input 
                  type="text"
                  value={importCategory}
                  onChange={(e) => setImportCategory(e.target.value)}
                  placeholder="Ej: Fiesta, Cumbias, Rock, Mi Selección"
                  className="w-full bg-stone-950 border border-stone-800 focus:border-red-500 rounded-xl px-3.5 py-2 text-xs text-white placeholder-stone-500 outline-none"
                />
              </div>

              {isImporting && (
                <div className="p-3 bg-red-950/40 border border-red-500/30 rounded-xl flex items-center gap-2 text-red-300 text-xs font-medium animate-pulse">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>{importProgress}</span>
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 font-bold text-xs rounded-xl transition-all cursor-pointer"
                  disabled={isImporting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isImporting}
                  className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl transition-all shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" /> Continuar y Personalizar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: SEQUENTIAL REVIEW & CUSTOMIZATION WIZARD */}
      {showSequentialModal && pendingImportQueue.length > 0 && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 w-full max-w-lg rounded-2xl p-6 shadow-2xl relative overflow-hidden">
            
            {/* Top Progress Bar */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-stone-800">
              <div 
                className="h-full bg-gradient-to-r from-red-600 to-amber-500 transition-all duration-300"
                style={{ width: `${((currentQueueIndex + 1) / pendingImportQueue.length) * 100}%` }}
              />
            </div>

            <button 
              onClick={handleCancelSequential}
              className="absolute top-4 right-4 text-stone-400 hover:text-white p-1 rounded-lg hover:bg-stone-800 transition-colors cursor-pointer z-10"
              title="Cerrar ventana"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center justify-between mb-4 pt-1 pr-6">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-red-600/20 text-red-500 border border-red-500/30 flex items-center justify-center font-bold text-xs">
                  {currentQueueIndex + 1}/{pendingImportQueue.length}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    Configurar Lista {currentQueueIndex + 1} de {pendingImportQueue.length}
                  </h3>
                  <p className="text-[11px] text-stone-400">Asigna un nombre descriptivo y una categoría a esta lista</p>
                </div>
              </div>

              <button 
                onClick={handleSkipSequential}
                className="text-stone-400 hover:text-stone-200 text-xs px-2.5 py-1 rounded-lg bg-stone-800/80 hover:bg-stone-800 transition-colors cursor-pointer"
                title="Omitir esta lista"
              >
                Omitir
              </button>
            </div>

            {/* Current Item Preview Box */}
            {pendingImportQueue[currentQueueIndex] && (
              <div className="bg-stone-950/80 border border-stone-800 rounded-xl p-3 mb-4 flex items-center gap-3">
                <img 
                  src={pendingImportQueue[currentQueueIndex].thumbnailUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=400&q=80'} 
                  alt="Preview" 
                  className="w-12 h-12 object-cover rounded-lg border border-stone-800 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] uppercase font-bold text-stone-500 tracking-wider">Detectado de YouTube</p>
                  <p className="text-xs font-bold text-stone-200 truncate">{pendingImportQueue[currentQueueIndex].title}</p>
                  <p className="text-[10px] text-stone-400 truncate">
                    {pendingImportQueue[currentQueueIndex].tracks && pendingImportQueue[currentQueueIndex].tracks!.length > 0 
                      ? `${pendingImportQueue[currentQueueIndex].tracks!.length} canciones` 
                      : `ID: ${pendingImportQueue[currentQueueIndex].id}`}
                  </p>
                </div>
              </div>
            )}

            <form onSubmit={handleSaveAndNextSequential} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-300 mb-1">
                  Nombre de la Lista / Título *
                </label>
                <input 
                  type="text"
                  required
                  value={reviewTitle}
                  onChange={(e) => setReviewTitle(e.target.value)}
                  placeholder="Ej: Cumbias del Recuerdo, Salsa Parrandera, etc."
                  className="w-full bg-stone-950 border border-stone-800 focus:border-red-500 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-stone-500 outline-none font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-300 mb-1">
                  Categoría *
                </label>
                <input 
                  type="text"
                  required
                  value={reviewCategory}
                  onChange={(e) => setReviewCategory(e.target.value)}
                  placeholder="Ej: Fiesta & Sabor, Cumbias, Rock, Mariachi..."
                  className="w-full bg-stone-950 border border-stone-800 focus:border-red-500 rounded-xl px-3.5 py-2 text-xs text-white placeholder-stone-500 outline-none mb-2"
                />

                {/* Quick Category Chips */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {allAvailableCategories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setReviewCategory(cat)}
                      className={cn(
                        "px-2 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer border",
                        reviewCategory === cat 
                          ? "bg-red-950 border-red-500 text-red-300" 
                          : "bg-stone-950 border-stone-800 text-stone-400 hover:text-stone-200 hover:border-stone-700"
                      )}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-300 mb-1">
                  Descripción (Opcional)
                </label>
                <input 
                  type="text"
                  value={reviewDescription}
                  onChange={(e) => setReviewDescription(e.target.value)}
                  placeholder="Ej: Especial para la hora de la comida y festejos"
                  className="w-full bg-stone-950 border border-stone-800 focus:border-red-500 rounded-xl px-3.5 py-2 text-xs text-white placeholder-stone-500 outline-none"
                />
              </div>

              <div className="pt-3 flex items-center justify-between gap-2 border-t border-stone-800/80">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCancelSequential}
                    className="px-3.5 py-2 bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-stone-200 font-bold text-xs rounded-xl transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleSkipSequential}
                    className="px-3.5 py-2 bg-stone-800/60 hover:bg-stone-800 text-stone-300 font-bold text-xs rounded-xl transition-all cursor-pointer"
                  >
                    Omitir esta Lista
                  </button>
                </div>

                <button
                  type="submit"
                  className="px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl transition-all shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  {currentQueueIndex + 1 < pendingImportQueue.length ? (
                    <>
                      <span>Guardar y Siguiente ({currentQueueIndex + 2}/{pendingImportQueue.length})</span>
                      <ChevronRight className="w-4 h-4" />
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Guardar y Finalizar</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: EDIT EXISTING PLAYLIST */}
      {playlistToEdit && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 w-full max-w-md rounded-2xl p-6 shadow-2xl relative">
            <button 
              onClick={() => setPlaylistToEdit(null)}
              className="absolute top-4 right-4 text-stone-400 hover:text-white p-1 rounded-lg hover:bg-stone-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-600/20 text-red-500 border border-red-500/30 flex items-center justify-center font-bold">
                <Edit3 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Editar Lista de Reproducción</h3>
                <p className="text-xs text-stone-400">Modifica el nombre o categoría</p>
              </div>
            </div>

            <form onSubmit={handleSaveEditedPlaylist} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-300 mb-1">
                  Nombre de la Lista *
                </label>
                <input 
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-800 focus:border-red-500 rounded-xl px-3.5 py-2 text-xs text-white placeholder-stone-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-300 mb-1">
                  Categoría *
                </label>
                <input 
                  type="text"
                  required
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-800 focus:border-red-500 rounded-xl px-3.5 py-2 text-xs text-white placeholder-stone-500 outline-none mb-2"
                />

                <div className="flex flex-wrap gap-1.5">
                  {allAvailableCategories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setEditCategory(cat)}
                      className={cn(
                        "px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer border",
                        editCategory === cat 
                          ? "bg-red-950 border-red-500 text-red-300" 
                          : "bg-stone-950 border-stone-800 text-stone-400 hover:text-stone-200"
                      )}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-300 mb-1">
                  Descripción (Opcional)
                </label>
                <input 
                  type="text"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-800 focus:border-red-500 rounded-xl px-3.5 py-2 text-xs text-white placeholder-stone-500 outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPlaylistToEdit(null)}
                  className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl transition-all shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4" /> Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: ADD SINGLE TRACK TO CURRENT PLAYLIST */}
      {showAddTrackModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 w-full max-w-md rounded-2xl p-6 shadow-2xl relative">
            <button 
              onClick={() => setShowAddTrackModal(false)}
              className="absolute top-4 right-4 text-stone-400 hover:text-white p-1 rounded-lg hover:bg-stone-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-600/20 text-red-500 border border-red-500/30 flex items-center justify-center font-bold">
                <Plus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Agregar Canción a esta Lista</h3>
                <p className="text-xs text-stone-400">Ingresa el enlace o ID de la canción</p>
              </div>
            </div>

            <form onSubmit={handleAddTrackToCurrentPlaylist} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-300 mb-1">
                  Enlace o ID de Canción de YouTube *
                </label>
                <input 
                  type="text"
                  required
                  value={newTrackUrl}
                  onChange={(e) => setNewTrackUrl(e.target.value)}
                  placeholder="https://music.youtube.com/watch?v=..."
                  className="w-full bg-stone-950 border border-stone-800 focus:border-red-500 rounded-xl px-3.5 py-2 text-xs text-white placeholder-stone-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-300 mb-1">
                  Título de Canción (Opcional)
                </label>
                <input 
                  type="text"
                  value={newTrackTitle}
                  onChange={(e) => setNewTrackTitle(e.target.value)}
                  placeholder="Ej: La Cumbia del Sol"
                  className="w-full bg-stone-950 border border-stone-800 focus:border-red-500 rounded-xl px-3.5 py-2 text-xs text-white placeholder-stone-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-300 mb-1">
                  Artista / Banda (Opcional)
                </label>
                <input 
                  type="text"
                  value={newTrackArtist}
                  onChange={(e) => setNewTrackArtist(e.target.value)}
                  placeholder="Ej: Grupo Cañaveral"
                  className="w-full bg-stone-950 border border-stone-800 focus:border-red-500 rounded-xl px-3.5 py-2 text-xs text-white placeholder-stone-500 outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddTrackModal(false)}
                  className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl transition-all shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" /> Agregar Canción
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
