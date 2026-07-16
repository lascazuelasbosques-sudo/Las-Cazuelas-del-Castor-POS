import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardFooter } from "./Card";
import { Button } from "./Button";
import { Order, OrderStatus, OrderItem, Product } from "@/src/types";
import { Clock, CheckCircle2, PlayCircle, ClipboardList, PlusCircle, Trash2, Ban, X, XCircle, Bell, BellOff, Volume2, VolumeX, Smartphone, Music, FileAudio, Search, Play, Pause, Plus, FolderOpen, ListMusic, Globe, Save } from "lucide-react";
import { db } from "../firebase";
import { collection, onSnapshot, query, where, orderBy, doc, updateDoc, addDoc } from "firebase/firestore";
import { cn, customRound } from "@/src/lib/utils";
import toast from "react-hot-toast";
import { handleFirestoreError, OperationType } from "@/src/lib/firestoreErrorHandler";

interface KitchenTicketItem extends OrderItem {
  originalIndex: number;
}

interface KitchenTicket {
  id: string;
  orderId: string;
  order: Order;
  station: 'plancha' | 'cocina';
  items: KitchenTicketItem[];
  stationStatus: 'pending' | 'preparing';
}

const PRESET_SONGS = [
  // Cumbias y Salsas
  { id: "cumbia_1", name: "💃 Cumbia del Al Pastor (Activa)", genre: "Cumbias y Salsas", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" },
  { id: "salsa_1", name: "🔥 Salsa de la Plancha Hirviendo", genre: "Cumbias y Salsas", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3" },
  { id: "cumbia_2", name: "🥁 Ritmo Sabroso Parrillero", genre: "Cumbias y Salsas", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3" },
  { id: "salsa_2", name: "🌶️ Salsa Habanera Explosiva", genre: "Cumbias y Salsas", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3" },

  // Rock y Pop
  { id: "rock_1", name: "🎸 Rock del Carbón (Clásico)", genre: "Rock y Pop", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3" },
  { id: "pop_1", name: "🥑 Pop de los Tacos Dorados", genre: "Rock y Pop", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3" },
  { id: "rock_2", name: "⚡ Metal de la Campana de Extracción", genre: "Rock y Pop", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3" },
  { id: "pop_2", name: "🍋 Pop Cítrico Refrescante", genre: "Rock y Pop", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3" },

  // Música Mexicana
  { id: "mex_1", name: "🎺 Banda Alegre Sinaloense", genre: "Música Mexicana", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3" },
  { id: "mex_2", name: "🎻 Mariachi Imperial las Cazuelas", genre: "Música Mexicana", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3" },
  { id: "mex_3", name: "🤠 Norteño de Carbón y Leña", genre: "Música Mexicana", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-11.mp3" },

  // Relajante
  { id: "zen_1", name: "🍃 Clásica de Chiles en Nogada", genre: "Relajante y Ambiental", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-12.mp3" },
  { id: "zen_2", name: "☕ Café Chill para Tarde Lenta", genre: "Relajante y Ambiental", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-13.mp3" },
  { id: "zen_3", name: "🧘 Meditación del Sabor Secreto", genre: "Relajante y Ambiental", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-14.mp3" }
];

interface KitchenViewProps {
  onEditOrder?: (order: Order) => void;
  userRole?: string;
  onNavigateToOrders?: () => void;
}

export const KitchenView = ({ onEditOrder, userRole = 'admin', onNavigateToOrders }: KitchenViewProps) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStation, setActiveStation] = useState<'all' | 'plancha' | 'cocina'>(() => {
    if (userRole === 'parrilla') return 'plancha';
    if (userRole === 'kitchen') return 'cocina';
    return 'all';
  });
  const [orderToCancel, setOrderToCancel] = useState<Order | null>(null);
  const [itemCancellation, setItemCancellation] = useState<{ orderId: string; originalIndex: number; itemName: string } | null>(null);

  // States for adding dishes directly to orders from the kitchen
  const [products, setProducts] = useState<Product[]>([]);
  const [orderToAddItems, setOrderToAddItems] = useState<Order | null>(null);
  const [searchProductQuery, setSearchProductQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [addQuantity, setAddQuantity] = useState(1);
  const [addNotes, setAddNotes] = useState("");
  const [addStation, setAddStation] = useState<'cocina' | 'plancha'>('cocina');
  const [showDirectAddModal, setShowDirectAddModal] = useState(false);

  // Kitchen alerts state and references
  const [silencedTickets, setSilencedTickets] = useState<string[]>([]);
  const [isAlerting, setIsAlerting] = useState<boolean>(false);
  const [flashState, setFlashState] = useState<boolean>(false);
  const [kitchenSoundEnabled, setKitchenSoundEnabled] = useState<boolean>(true);
  const [fullscreenStrobe, setFullscreenStrobe] = useState<boolean>(false);
  const [testAlertActive, setTestAlertActive] = useState<boolean>(false);
  const [showSettingsPopover, setShowSettingsPopover] = useState<boolean>(false);
  const [showMusicSettings, setShowMusicSettings] = useState<boolean>(false);
  const [isTestingMusic, setIsTestingMusic] = useState<boolean>(false);
  const [notificationPermission, setNotificationPermission] = useState<string>(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      return Notification.permission;
    }
    return "unsupported";
  });

  // Preparation music configuration states
  const [prepSongType, setPrepSongType] = useState<'preset' | 'file' | 'url'>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("prep_song_type") as any) || "preset";
    }
    return "preset";
  });
  const [prepSongPreset, setPrepSongPreset] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("prep_song_preset") || "cumbia_1";
    }
    return "cumbia_1";
  });
  const [prepSongUrl, setPrepSongUrl] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("prep_song_url") || "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3";
    }
    return "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3";
  });
  const [prepSongFileName, setPrepSongFileName] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("prep_song_file_name") || "";
    }
    return "";
  });
  const [prepSongLocalUrl, setPrepSongLocalUrl] = useState<string>("");
  const [prepMusicMuted, setPrepMusicMuted] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("prep_music_muted") === "true";
    }
    return false;
  });

  // Music Explorer states
  const [musicSearchQuery, setMusicSearchQuery] = useState<string>("");
  const [selectedGenreTab, setSelectedGenreTab] = useState<string>("all");
  const [customLibrary, setCustomLibrary] = useState<{ id: string; name: string; url: string; isCustom: boolean }[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("custom_music_library");
        return saved ? JSON.parse(saved) : [];
      } catch (e) {
        return [];
      }
    }
    return [];
  });
  const [newCustomName, setNewCustomName] = useState<string>("");
  const [newCustomUrl, setNewCustomUrl] = useState<string>("");
  const [uploadedFiles, setUploadedFiles] = useState<{ id: string; name: string; url: string; size?: string }[]>([]);

  // State to track a direct list item play/pause preview
  const [previewingSongId, setPreviewingSongId] = useState<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  const preparationAudioRef = useRef<HTMLAudioElement | null>(null);

  // Toggle previewing a song directly in the explorer list
  const handleTogglePreview = (songId: string, url: string) => {
    if (previewingSongId === songId) {
      // Pause
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
      }
      setPreviewingSongId(null);
    } else {
      // Play new preview
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
      }
      const audio = new Audio(url);
      audio.loop = true;
      audio.volume = 0.5;
      previewAudioRef.current = audio;
      audio.play().catch(e => console.log("Preview play failed:", e));
      setPreviewingSongId(songId);
    }
  };

  // Clean up preview audio on unmount or settings close
  useEffect(() => {
    return () => {
      if (previewAudioRef.current) {
        try {
          previewAudioRef.current.pause();
        } catch (e) {}
        previewAudioRef.current = null;
      }
    };
  }, []);

  const handlePrepFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (prepSongLocalUrl) {
        URL.revokeObjectURL(prepSongLocalUrl);
      }
      const fileUrl = URL.createObjectURL(file);
      setPrepSongLocalUrl(fileUrl);
      setPrepSongFileName(file.name);
      localStorage.setItem("prep_song_file_name", file.name);
      
      const fileId = `upload_${Date.now()}`;
      const fileSize = (file.size / (1024 * 1024)).toFixed(2) + " MB";
      setUploadedFiles(prev => [
        { id: fileId, name: file.name, url: fileUrl, size: fileSize },
        ...prev
      ]);
      
      setPrepSongType('file');
      setPrepSongPreset(fileId); // select it
      setIsTestingMusic(false);
      toast.success(`Canción cargada correctamente: ${file.name}`);
    }
  };

  // Filter and search songs inside the explorer
  const getFilteredSongs = () => {
    let allSongs: { id: string; name: string; url: string; genre: string; isCustom?: boolean }[] = [];
    
    // Add presets
    PRESET_SONGS.forEach(s => {
      allSongs.push({ id: s.id, name: s.name, url: s.url, genre: s.genre });
    });

    // Add custom links
    customLibrary.forEach(s => {
      allSongs.push({ id: s.id, name: `🔗 ${s.name}`, url: s.url, genre: "Mis Enlaces", isCustom: true });
    });

    // Add uploaded files
    uploadedFiles.forEach(s => {
      allSongs.push({ id: s.id, name: `📱 ${s.name}`, url: s.url, genre: "Cargados" });
    });

    // Filter by genre tab
    if (selectedGenreTab !== "all") {
      if (selectedGenreTab === "cumbias") {
        allSongs = allSongs.filter(s => s.genre === "Cumbias y Salsas");
      } else if (selectedGenreTab === "rock") {
        allSongs = allSongs.filter(s => s.genre === "Rock y Pop");
      } else if (selectedGenreTab === "mexicana") {
        allSongs = allSongs.filter(s => s.genre === "Música Mexicana");
      } else if (selectedGenreTab === "ambient") {
        allSongs = allSongs.filter(s => s.genre === "Relajante y Ambiental");
      } else if (selectedGenreTab === "custom") {
        allSongs = allSongs.filter(s => s.genre === "Mis Enlaces");
      } else if (selectedGenreTab === "file") {
        allSongs = allSongs.filter(s => s.genre === "Cargados");
      }
    }

    // Filter by search query
    if (musicSearchQuery.trim()) {
      const q = musicSearchQuery.toLowerCase();
      allSongs = allSongs.filter(s => s.name.toLowerCase().includes(q));
    }

    return allSongs;
  };

  // Set the chosen song as active prep music
  const handleSelectSong = (song: { id: string; name: string; url: string; genre: string }) => {
    if (song.genre === "Cargados") {
      setPrepSongType('file');
      setPrepSongLocalUrl(song.url);
      setPrepSongFileName(song.name.replace("📱 ", ""));
      setPrepSongPreset(song.id);
      localStorage.setItem("prep_song_file_name", song.name.replace("📱 ", ""));
    } else if (song.genre === "Mis Enlaces") {
      setPrepSongType('url');
      setPrepSongUrl(song.url);
      setPrepSongFileName(song.name.replace("🔗 ", ""));
      setPrepSongPreset(song.id);
      localStorage.setItem("prep_song_file_name", song.name.replace("🔗 ", ""));
    } else {
      setPrepSongType('preset');
      setPrepSongPreset(song.id);
      setIsTestingMusic(false);
    }
    toast.success(`Establecido: ${song.name}`);
  };

  // Add custom URL to library
  const handleAddCustomSong = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomName.trim() || !newCustomUrl.trim()) {
      toast.error("Por favor ingresa nombre y enlace de audio");
      return;
    }
    if (!newCustomUrl.startsWith("http://") && !newCustomUrl.startsWith("https://")) {
      toast.error("El enlace debe comenzar con http:// o https://");
      return;
    }

    const newSong = {
      id: `custom_${Date.now()}`,
      name: newCustomName.trim(),
      url: newCustomUrl.trim(),
      isCustom: true
    };

    const updated = [...customLibrary, newSong];
    setCustomLibrary(updated);
    localStorage.setItem("custom_music_library", JSON.stringify(updated));
    
    // Auto select it
    setPrepSongType('url');
    setPrepSongUrl(newSong.url);
    setPrepSongFileName(newSong.name);
    setPrepSongPreset(newSong.id);
    localStorage.setItem("prep_song_file_name", newSong.name);

    setNewCustomName("");
    setNewCustomUrl("");
    toast.success(`Guardado y establecido: ${newSong.name}`);
  };

  // Delete custom URL from library
  const handleDeleteCustomSong = (id: string, name: string) => {
    const updated = customLibrary.filter(s => s.id !== id);
    setCustomLibrary(updated);
    localStorage.setItem("custom_music_library", JSON.stringify(updated));
    toast.success(`Eliminado: ${name}`);
    
    if (prepSongPreset === id) {
      setPrepSongType('preset');
      setPrepSongPreset('cumbia_1');
    }
  };

  const getPrepAudioUrl = () => {
    if (prepSongType === 'file') {
      return prepSongLocalUrl || "";
    }
    if (prepSongType === 'url') {
      return prepSongUrl;
    }
    // Check custom library
    const customFound = customLibrary.find(p => p.id === prepSongPreset);
    if (customFound) return customFound.url;
    
    // Check uploaded files
    const uploadedFound = uploadedFiles.find(p => p.id === prepSongPreset);
    if (uploadedFound) return uploadedFound.url;

    const found = PRESET_SONGS.find(p => p.id === prepSongPreset);
    return found ? found.url : PRESET_SONGS[0].url;
  };

  const prevPendingTicketIdsRef = useRef<string[]>([]);
  const prevOrdersRef = useRef<Order[]>([]);
  const kitchenAudioRef = useRef<HTMLAudioElement | null>(null);
  const torchTrackRef = useRef<any>(null);
  const torchStreamRef = useRef<any>(null);
  const ticketsRef = useRef<KitchenTicket[]>([]);

  const getTimeElapsed = (createdAt: string) => {
    const elapsed = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
    return `${elapsed} min`;
  };

  // Compute tickets and pending alerts
  const tickets: KitchenTicket[] = [];
  orders.forEach(order => {
    const itemsWithIndex = order.items.map((item, index) => ({ ...item, originalIndex: index }));
    const planchaItems = itemsWithIndex.filter(i => i.station === 'plancha' && i.status !== 'cancelled');
    const cocinaItems = itemsWithIndex.filter(i => (i.station === 'cocina' || !i.station) && i.status !== 'cancelled');

    const hasPendingPlancha = planchaItems.some(i => i.status !== 'completed');
    const hasPendingCocina = cocinaItems.some(i => i.status !== 'completed');

    if (hasPendingPlancha && (activeStation === 'all' || activeStation === 'plancha')) {
      tickets.push({
        id: `${order.id}-plancha`,
        orderId: order.id,
        order: order,
        station: 'plancha',
        items: planchaItems,
        stationStatus: planchaItems.some(i => i.status === 'preparing') ? 'preparing' : 'pending'
      });
    }
    
    if (hasPendingCocina && (activeStation === 'all' || activeStation === 'cocina')) {
      tickets.push({
        id: `${order.id}-cocina`,
        orderId: order.id,
        order: order,
        station: 'cocina',
        items: cocinaItems,
        stationStatus: cocinaItems.some(i => i.status === 'preparing') ? 'preparing' : 'pending'
      });
    }
  });

  // Assign compiled tickets to our mutable ref for background context safety
  ticketsRef.current = tickets;

  const currentPendingTickets = tickets.filter(t => t.stationStatus === 'pending');
  const currentPendingIds = currentPendingTickets.map(t => t.id);
  const activeAlertTickets = currentPendingTickets.filter(t => !silencedTickets.includes(t.id));
  const hasActiveAlerts = activeAlertTickets.length > 0 || testAlertActive;
  const pendingIdsString = currentPendingIds.join(",");

  const isPreparing = tickets.some(t => t.stationStatus === 'preparing');
  const shouldPlayMusic = (isPreparing || isTestingMusic) && !prepMusicMuted;

  // Synchronize alerting status
  useEffect(() => {
    if (hasActiveAlerts && kitchenSoundEnabled) {
      setIsAlerting(true);
    } else {
      setIsAlerting(false);
    }
  }, [hasActiveAlerts, kitchenSoundEnabled]);

  // Persist song configuration values
  useEffect(() => {
    localStorage.setItem("prep_song_type", prepSongType);
  }, [prepSongType]);

  useEffect(() => {
    localStorage.setItem("prep_song_preset", prepSongPreset);
  }, [prepSongPreset]);

  useEffect(() => {
    localStorage.setItem("prep_song_url", prepSongUrl);
  }, [prepSongUrl]);

  useEffect(() => {
    localStorage.setItem("prep_music_muted", String(prepMusicMuted));
  }, [prepMusicMuted]);

  useEffect(() => {
    if (userRole === 'parrilla') {
      setActiveStation('plancha');
    } else if (userRole === 'kitchen') {
      setActiveStation('cocina');
    }
  }, [userRole]);

  // Request notifications permission on mount
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission().then(permission => {
          setNotificationPermission(permission);
        });
      }
    }
  }, []);

  // Subscribe to products on mount
  useEffect(() => {
    const qProd = query(collection(db, "products"), orderBy("name", "asc"));
    const unsubscribe = onSnapshot(qProd, (snapshot) => {
      const prods = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      setProducts(prods);
    }, (error) => {
      console.error("Error loading products for kitchen:", error);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(
      collection(db, "orders"),
      where("status", "in", ["pending", "preparing", "ready", "served"]),
      orderBy("createdAt", "asc")
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const orderData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      // Filter out WhatsApp/takeaway orders that have not been confirmed yet by the operator
      const visibleOrders = orderData.filter(order => {
        if (order.isTakeaway && order.whatsAppConfirmed === false) {
          return false;
        }
        return true;
      });

      // --- DETECT CANCELLED ORDERS ---
      const prevOrders = prevOrdersRef.current;
      if (prevOrders.length > 0) {
        const currentIds = visibleOrders.map(o => o.id);
        const disappeared = prevOrders.filter(po => !currentIds.includes(po.id));

        for (const dispOrder of disappeared) {
          try {
            const { doc, getDoc } = await import("firebase/firestore");
            const orderDocRef = doc(db, "orders", dispOrder.id);
            const snap = await getDoc(orderDocRef);
            if (snap.exists()) {
              const data = snap.data() as Order;
              if (data.status === 'cancelled') {
                const orderInfo = data.isTakeaway ? "para llevar" : `Mesa ${data.tableNumber || ""}`;
                const speakMsg = `Atención. El pedido ${orderInfo} ha sido cancelado.`;

                // Voice Speech Synthesis
                if (typeof window !== "undefined" && window.speechSynthesis) {
                  try {
                    window.speechSynthesis.cancel();
                    const utterance = new SpeechSynthesisUtterance(speakMsg);
                    utterance.lang = "es-MX";
                    utterance.rate = 0.95;
                    const voices = window.speechSynthesis.getVoices();
                    const spanishVoice = voices.find(v => v.lang.startsWith("es"));
                    if (spanishVoice) utterance.voice = spanishVoice;
                    window.speechSynthesis.speak(utterance);
                  } catch (e) {
                    console.error("Speech error:", e);
                  }
                }

                // Chime/Buzzer sound
                try {
                  const cancelAudio = new Audio("https://assets.mixkit.co/active_storage/sfx/1446/1446-preview.mp3");
                  cancelAudio.volume = 0.9;
                  cancelAudio.play().catch(() => {});
                } catch (e) {}

                // Trigger background Web Notification for Cancelled Order
                if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
                  try {
                    new Notification("🛑 ¡PEDIDO CANCELADO!", {
                      body: `El pedido de ${orderInfo} ha sido cancelado.`,
                      requireInteraction: true,
                      tag: `cancelled-order-${data.id}`
                    });
                  } catch (e) {
                    console.error("Web Notification cancel error:", e);
                  }
                }

                // Red Toast Notification
                toast.error(`🚨 ¡PEDIDO CANCELADO! ${orderInfo.toUpperCase()}`, {
                  duration: 10000,
                  icon: "🛑",
                  style: {
                    background: "#dc2626",
                    color: "#ffffff",
                    fontWeight: "900",
                    border: "2px solid #ef4444",
                  }
                });
              }
            }
          } catch (err) {
            console.error("Error verifying cancellation:", err);
          }
        }
      }

      prevOrdersRef.current = visibleOrders;
      setOrders(visibleOrders);
      setLoading(false);
    }, (error) => {
      setLoading(false);
      handleFirestoreError(error, OperationType.LIST, "orders");
    });

    return () => unsubscribe();
  }, []);

  // Initialize kitchen buzzer sound
  useEffect(() => {
    // High contrast digital alarm buzzer
    kitchenAudioRef.current = new Audio("https://assets.mixkit.co/active_storage/sfx/951/951-preview.mp3");
    if (kitchenAudioRef.current) {
      kitchenAudioRef.current.loop = true;
      kitchenAudioRef.current.volume = 0.6;
    }
    return () => {
      if (kitchenAudioRef.current) {
        kitchenAudioRef.current.pause();
        kitchenAudioRef.current = null;
      }
    };
  }, []);

  // Screen strobe flash logic
  useEffect(() => {
    let flashInterval: any = null;
    if (isAlerting) {
      flashInterval = setInterval(() => {
        setFlashState(prev => !prev);
      }, 150); // Strobe frequency: 150ms
    } else {
      setFlashState(false);
    }
    return () => {
      if (flashInterval) clearInterval(flashInterval);
    };
  }, [isAlerting]);

  // Physical vibration alert loop
  useEffect(() => {
    let vibeInterval: any = null;
    if (isAlerting && kitchenSoundEnabled && typeof navigator !== "undefined" && navigator.vibrate) {
      const runVibration = () => {
        try {
          // Intense rhythmic double-pulses
          navigator.vibrate([400, 200, 400, 200, 800, 400]);
        } catch (e) {
          console.log("Device vibration blocked:", e);
        }
      };
      runVibration();
      vibeInterval = setInterval(runVibration, 3000);
    }
    return () => {
      if (vibeInterval) clearInterval(vibeInterval);
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        try {
          navigator.vibrate(0);
        } catch (e) {}
      }
    };
  }, [isAlerting, kitchenSoundEnabled]);

  // Buzzing Audio Alert Loop
  useEffect(() => {
    if (isAlerting && kitchenSoundEnabled) {
      kitchenAudioRef.current?.play().catch(err => {
        console.log("Audio autoplay waiting for user interaction:", err);
      });
    } else {
      kitchenAudioRef.current?.pause();
      if (kitchenAudioRef.current) {
        kitchenAudioRef.current.currentTime = 0;
      }
    }
  }, [isAlerting, kitchenSoundEnabled]);

  // Physical camera flashlight torch toggle (Progressive Enhancement)
  const togglePhysicalTorch = async (on: boolean) => {
    try {
      if (on) {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          if (torchTrackRef.current) return;
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment" }
          }).catch(async () => {
            return await navigator.mediaDevices.getUserMedia({
              video: { facingMode: { exact: "environment" } }
            });
          });
          const track = stream.getVideoTracks()[0];
          const capabilities = track.getCapabilities() as any;
          if (capabilities && capabilities.torch) {
            await track.applyConstraints({
              advanced: [{ torch: true } as any]
            });
            torchTrackRef.current = track;
            torchStreamRef.current = stream;
          } else {
            stream.getTracks().forEach(t => t.stop());
          }
        }
      } else {
        if (torchTrackRef.current) {
          try {
            await torchTrackRef.current.applyConstraints({
              advanced: [{ torch: false } as any]
            });
          } catch (e) {}
          try {
            torchTrackRef.current.stop();
          } catch (e) {}
          torchTrackRef.current = null;
        }
        if (torchStreamRef.current) {
          try {
            torchStreamRef.current.getTracks().forEach((t: any) => {
              try {
                t.stop();
              } catch (err) {}
            });
          } catch (e) {}
          torchStreamRef.current = null;
        }
      }
    } catch (err) {
      console.log("Physical flashlight not supported or camera blocked:", err);
    }
  };

  // Synchronize physical torch with high-speed flashState (turned off when preparation starts)
  useEffect(() => {
    if (isAlerting && kitchenSoundEnabled && !isPreparing) {
      togglePhysicalTorch(flashState);
    } else {
      togglePhysicalTorch(false);
    }
    return () => {
      togglePhysicalTorch(false);
    };
  }, [flashState, isAlerting, kitchenSoundEnabled, isPreparing]);

  // Trigger test alerts
  const triggerTestAlert = () => {
    if (testAlertActive) return;
    setTestAlertActive(true);
    setIsAlerting(true);
    toast.success("Iniciando prueba de 4s (Vibrar y Destellar)...", { icon: "📳" });
    setTimeout(() => {
      setTestAlertActive(false);
      setIsAlerting(false);
    }, 4000);
  };

  const notifyWhatsAppReady = async (orderId: string, order: Order) => {
    if (order.isTakeaway && order.waiterId && order.waiterId.startsWith("whatsapp-")) {
      const cleanPhone = order.waiterId.replace("whatsapp-", "");
      const transferMsg = `🔔 *AVISO:* ¡Felicidades! Tu pedido ya se encuentra listo para retirar en local.\n\n*🏦 DATOS PARA TRANSFERENCIA :*\n🏦 *Banco:* BBVA\n👤 *Nombre:* Antonieta Abigail Villagómez\n💳 *CTA:* 4152 3135 1505 5627\n\n*¡Listo! Por favor envíanos tu comprobante de pago.* 🙏`;
      try {
        await addDoc(collection(db, "chats", cleanPhone, "messages"), {
          sender: "staff",
          text: transferMsg,
          timestamp: new Date().toISOString(),
          status: "sent"
        });
        await updateDoc(doc(db, "chats", cleanPhone), {
          lastMessage: transferMsg,
          lastMessageAt: new Date().toISOString(),
          unreadCount: 0
        });
      } catch (e) {
        console.error("Error sending ready whatsapp message from kitchen:", e);
      }
    }
  };

  const updateOrderStatus = async (orderId: string, action: 'start_station' | 'finish_station', station: 'plancha' | 'cocina') => {
    try {
      // Turn off physical flashlight/torch immediately
      togglePhysicalTorch(false);

      const order = orders.find(o => o.id === orderId);
      if (!order) return;

      let updateData: any = {
        updatedAt: new Date().toISOString()
      };

      if (action === 'start_station') {
        // Silence this ticket immediately
        const ticketId = `${orderId}-${station}`;
        setSilencedTickets(prev => {
          if (!prev.includes(ticketId)) {
            return [...prev, ticketId];
          }
          return prev;
        });

        const updatedItems = order.items.map(item => {
          const itemStation = item.station || 'cocina';
          if (itemStation === station && item.status !== 'completed') {
            return { ...item, status: 'preparing' };
          }
          return item;
        });

        updateData.items = updatedItems;
        updateData.status = 'preparing';

        await updateDoc(doc(db, "orders", orderId), updateData);
        toast.success(`Comanda de ${station === 'plancha' ? 'Parrilla' : 'Cocina'} en preparación`);
      } else if (action === 'finish_station') {
        // Mark items for this station as completed
        const updatedItems = order.items.map(item => {
          const itemStation = item.station || 'cocina';
          if (itemStation === station) {
            return { ...item, status: 'completed' };
          }
          return item;
        });

        updateData.items = updatedItems;

        // Check if ALL items are now completed
        const allCompleted = updatedItems.every(item => item.status === 'completed');
        if (allCompleted) {
          updateData.status = 'ready';
        }

        await updateDoc(doc(db, "orders", orderId), updateData);
        if (updateData.status === 'ready') {
          await notifyWhatsAppReady(orderId, order);
        }
        toast.success(`Comanda de ${station === 'plancha' ? 'Parrilla' : 'Cocina'} lista`);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, "orders");
    }
  };

  const toggleItemStatus = async (orderId: string, originalIndex: number, currentStatus?: string) => {
    try {
      // Turn off physical flashlight/torch immediately
      togglePhysicalTorch(false);

      const order = orders.find(o => o.id === orderId);
      if (!order) return;

      const newStatus = currentStatus === 'completed' ? 'preparing' : 'completed';
      
      const updatedItems = [...order.items];
      updatedItems[originalIndex] = { ...updatedItems[originalIndex], status: newStatus };

      let updateData: any = {
        updatedAt: new Date().toISOString(),
        items: updatedItems,
      };

      // Check if ALL items are now completed
      const allCompleted = updatedItems.every(item => item.status === 'completed');
      
      if (allCompleted) {
        updateData.status = 'ready';
      } else if (order.status === 'ready') {
        updateData.status = 'preparing';
      } else if (order.status === 'pending') {
        // If an item is being marked completed, the order should at least be in 'preparing'
        updateData.status = 'preparing';
      }

      await updateDoc(doc(db, "orders", orderId), updateData);
      if (updateData.status === 'ready') {
        await notifyWhatsAppReady(orderId, order);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, "orders");
    }
  };

  const cancelOrderItem = async (orderId: string, originalIndex: number) => {
    try {
      const order = orders.find(o => o.id === orderId);
      if (!order) return;

      const updatedItems = [...order.items];
      const itemToCancel = updatedItems[originalIndex];
      if (!itemToCancel) return;

      // Update item status to 'cancelled'
      updatedItems[originalIndex] = { ...itemToCancel, status: 'cancelled' };

      // Recalculate subtotal and total
      const activeItems = updatedItems.filter(item => item.status !== 'cancelled');
      const newSubtotal = activeItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
      const newTotal = customRound(newSubtotal);

      let updateData: any = {
        updatedAt: new Date().toISOString(),
        items: updatedItems,
        subtotal: newSubtotal,
        total: newTotal
      };

      // Check if ALL remaining items (not cancelled) are now completed
      const remainingItems = updatedItems.filter(it => it.status !== 'cancelled');
      
      if (remainingItems.length === 0) {
        // If there are no items left in the order, mark as cancelled
        updateData.status = 'cancelled';
        toast.success("Pedido cancelado en su totalidad");
      } else {
        const allCompleted = remainingItems.every(item => item.status === 'completed');
        if (allCompleted) {
          updateData.status = 'ready';
        } else if (order.status === 'ready') {
          updateData.status = 'preparing';
        }
      }

      await updateDoc(doc(db, "orders", orderId), updateData);
      if (updateData.status === 'ready') {
        await notifyWhatsAppReady(orderId, order);
      }
      toast.success(`${itemToCancel.name} cancelado de la comanda`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, "orders");
    } finally {
      setItemCancellation(null);
    }
  };

  const cancelEntireOrder = async (orderId: string) => {
    try {
      const order = orders.find(o => o.id === orderId);
      if (!order) return;

      // Mark all items as 'cancelled'
      const updatedItems = order.items.map(item => ({ ...item, status: 'cancelled' as const }));

      const updateData: any = {
        updatedAt: new Date().toISOString(),
        items: updatedItems,
        status: 'cancelled',
        subtotal: 0,
        total: 0
      };

      await updateDoc(doc(db, "orders", orderId), updateData);
      toast.success(`Comanda de Mesa ${order.tableNumber} ha sido cancelada por completo`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, "orders");
    } finally {
      setOrderToCancel(null);
    }
  };

  const addProductToOrderDirectly = async (
    order: Order,
    product: Product,
    quantity: number,
    notes: string,
    station: 'plancha' | 'cocina'
  ) => {
    try {
      const newItem: OrderItem = {
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity: quantity,
        status: 'pending',
        station: station || product.station || 'cocina',
        notes: notes.trim() || undefined,
        hasExtraCheese: false
      };

      // Check if there's already a pending item of the exact same product with same notes and station
      let updatedItems = [...order.items];
      const existingItemIndex = updatedItems.findIndex(i => 
        i.productId === product.id && 
        i.status === 'pending' && 
        i.station === station && 
        (i.notes || "") === (notes.trim() || "")
      );

      if (existingItemIndex !== -1) {
        updatedItems[existingItemIndex] = {
          ...updatedItems[existingItemIndex],
          quantity: updatedItems[existingItemIndex].quantity + quantity
        };
      } else {
        updatedItems.push(newItem);
      }

      // Filter out any completely cancelled items or just sum up everything active (not cancelled)
      const activeItems = updatedItems.filter(item => item.status !== 'cancelled');
      const newSubtotal = activeItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
      const newTotal = customRound(newSubtotal);

      // We update the order in Firestore. We set status to 'pending' so it reactivates 
      // the kitchen comanda ticket and sounds/strobe if enabled.
      const orderRef = doc(db, "orders", order.id);
      await updateDoc(orderRef, {
        items: updatedItems,
        subtotal: newSubtotal,
        total: newTotal,
        status: 'pending', // Regresar a pendiente para alertar a la cocina
        updatedAt: new Date().toISOString()
      });

      toast.success(`Agregado: ${quantity}x ${product.name}`);
      
      // Reset modal state
      setOrderToAddItems(null);
      setSelectedProduct(null);
      setAddQuantity(1);
      setAddNotes("");
      setShowDirectAddModal(false);
    } catch (error) {
      console.error("Error adding product to order:", error);
      toast.error("Error al agregar platillo al pedido.");
    }
  };

  const getStatusColor = (status: OrderStatus) => {
    switch (status) {
      case 'pending': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'preparing': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'ready': return 'bg-mex-green/10 text-mex-green border-mex-green/20';
      default: return 'bg-stone-100 text-stone-700 border-stone-200';
    }
  };

  // Computed variables and alerting synched at the top of component

  useEffect(() => {
    const audioUrl = getPrepAudioUrl();
    
    if (shouldPlayMusic && audioUrl && kitchenSoundEnabled) {
      if (!preparationAudioRef.current || preparationAudioRef.current.src !== audioUrl) {
        if (preparationAudioRef.current) {
          try {
            preparationAudioRef.current.pause();
          } catch (e) {}
        }
        const audio = new Audio(audioUrl);
        audio.loop = true;
        audio.volume = 0.5;
        preparationAudioRef.current = audio;
      }

      preparationAudioRef.current.play().catch(err => {
        console.log("Failed to play preparation song:", err);
      });
    } else {
      if (preparationAudioRef.current) {
        try {
          preparationAudioRef.current.pause();
          preparationAudioRef.current.currentTime = 0;
        } catch (e) {}
      }
    }
  }, [shouldPlayMusic, prepSongType, prepSongPreset, prepSongUrl, prepSongLocalUrl, kitchenSoundEnabled, prepMusicMuted]);

  useEffect(() => {
    return () => {
      if (preparationAudioRef.current) {
        try {
          preparationAudioRef.current.pause();
        } catch (e) {}
        preparationAudioRef.current = null;
      }
    };
  }, []);

  // Handle newly arrived tickets
  useEffect(() => {
    const currentIds = pendingIdsString ? pendingIdsString.split(",") : [];
    const newlyArrived = currentIds.filter(id => !prevPendingTicketIdsRef.current.includes(id));
    
    if (newlyArrived.length > 0) {
      // Clear silenced state for newly arrived tickets so they trigger the alarm
      setSilencedTickets(prev => prev.filter(id => !newlyArrived.includes(id)));

      // Trigger Web Notifications for each newly arrived ticket
      if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
        newlyArrived.forEach(id => {
          const tIdParts = id.split("-");
          const stationName = tIdParts[1] || "cocina";
          const foundTicket = ticketsRef.current.find(t => t.id === id);
          if (foundTicket) {
            const orderInfo = foundTicket.order.isTakeaway 
              ? "para llevar" 
              : `Mesa ${foundTicket.order.tableNumber || ""}`;
            
            try {
              new Notification(`🍳 ¡NUEVA COMANDA EN ${stationName.toUpperCase()}!`, {
                body: `Comanda de ${orderInfo}. Inicia preparación para silenciar el buzzer.`,
                requireInteraction: true,
                tag: `new-ticket-${id}`
              });
            } catch (e) {
              console.error("Web Notification error on new ticket:", e);
            }
          }
        });
      }
    }
    
    prevPendingTicketIdsRef.current = currentIds;
  }, [pendingIdsString]);

  const handleSilenceTicket = (ticketId: string) => {
    setSilencedTickets(prev => {
      if (!prev.includes(ticketId)) {
        return [...prev, ticketId];
      }
      return prev;
    });
    toast.success("Alerta silenciada para esta comanda", { icon: "🔕" });
  };

  const handleSilenceAll = () => {
    setSilencedTickets(prev => [...prev, ...currentPendingIds]);
    setIsAlerting(false);
    toast.success("Todas las alertas silenciadas", { icon: "🔕" });
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-mex-green"></div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-hidden flex flex-col bg-mex-cream relative">
      {/* 1. HIGH-SPEED SCREEN STROBE VIEWER / PHONE LIGHT FALLBACK */}
      {isAlerting && (
        <div 
          className={cn(
            "fixed inset-0 pointer-events-none z-[400] transition-all duration-75 border-[16px]",
            flashState 
              ? "bg-amber-500/5 border-amber-500/80 shadow-[inset_0_0_60px_rgba(245,158,11,0.6)]" 
              : "bg-transparent border-red-600/40"
          )}
        />
      )}

      {/* 2. FULL-SCREEN PHYSICAL EMERGENCY FLASH STROBE MODE */}
      {isAlerting && fullscreenStrobe && (
        <div 
          onClick={handleSilenceAll}
          className={cn(
            "fixed inset-0 pointer-events-auto z-[500] flex flex-col items-center justify-center p-6 transition-all duration-75 cursor-pointer",
            flashState 
              ? "bg-white text-black" 
              : "bg-stone-900 text-white"
          )}
        >
          <div className="text-center space-y-6">
            <div className="animate-bounce inline-block bg-red-600 text-white p-6 rounded-full shadow-2xl">
              <Smartphone size={60} strokeWidth={2.5} className="animate-pulse" />
            </div>
            <h1 className="text-4xl md:text-6xl font-black uppercase tracking-wider leading-none">
              🚨 NUEVO PEDIDO 🚨
            </h1>
            <p className="text-sm font-serif max-w-md mx-auto uppercase tracking-widest text-stone-400">
              {activeStation === 'plancha' ? 'Parrilla / Plancha' : activeStation === 'cocina' ? 'Cocina principal' : 'Estación de cocina'}
            </p>
            <p className="text-[10px] font-black tracking-widest uppercase text-stone-500 animate-pulse">
              Toca cualquier parte de la pantalla para silenciar
            </p>
            <div className="pt-8">
              <Button 
                variant="primary" 
                className="px-8 py-4 bg-red-600 hover:bg-red-700 text-white text-lg font-black tracking-widest uppercase rounded-2xl shadow-xl border-none"
                onClick={(e) => {
                  e.stopPropagation();
                  handleSilenceAll();
                }}
              >
                SILENCIAR ALERTA
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 3. FLASHING ALERT WARNING BANNER */}
      {isAlerting && (
        <div 
          className={cn(
            "w-full py-3.5 px-4 flex items-center justify-between text-center select-none font-black text-xs uppercase tracking-widest transition-all duration-75 shrink-0 shadow-md z-[300]",
            flashState 
              ? "bg-red-600 text-white" 
              : "bg-stone-950 text-amber-400"
          )}
        >
          <div className="flex items-center gap-2 mx-auto">
            <span className="animate-ping inline-block w-2.5 h-2.5 rounded-full bg-white mr-1" />
            🚨 ¡NUEVA COMANDA RECIBIDA EN {activeStation === 'plancha' ? 'PARRILLA' : activeStation === 'cocina' ? 'COCINA' : 'ESTACIÓN'}! 🚨
          </div>
          <button 
            onClick={handleSilenceAll}
            className="ml-auto bg-white text-stone-900 px-4 py-1.5 rounded-lg text-[10px] font-black tracking-widest hover:bg-stone-100 transition-all border-none cursor-pointer shadow-sm shrink-0"
          >
            SILENCIAR TODO
          </button>
        </div>
      )}

      <div className="p-4 md:p-8 flex-1 overflow-hidden flex flex-col">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 md:mb-8 gap-4 shrink-0">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-serif text-mex-brown">
              {userRole === 'parrilla' ? 'Comandas en Parrilla' : userRole === 'kitchen' ? 'Comandas en Cocina' : 'Comandas'}
            </h1>
            {onNavigateToOrders && (userRole === 'kitchen' || userRole === 'parrilla') && (
              <button
                onClick={onNavigateToOrders}
                className="bg-mex-green hover:bg-mex-green/90 text-white font-black px-4 py-2 rounded-xl text-xs flex items-center gap-2 shadow-md transition-all active:scale-95 border-none cursor-pointer animate-pulse"
              >
                <span>📝</span>
                <span>LEVANTAR PEDIDO</span>
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <div className={cn("w-2 h-2 rounded-full animate-pulse", 
              activeStation === 'plancha' ? "bg-orange-500" : activeStation === 'cocina' ? "bg-blue-500" : "bg-mex-green"
            )} />
            <p className="text-[10px] text-stone-500 uppercase font-bold tracking-widest">
              {activeStation === 'all' ? 'Todas las estaciones' : activeStation === 'plancha' ? 'Estación: Parrilla' : 'Estación: Cocina'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 items-center self-start sm:self-auto">
          {userRole === 'admin' && (
            <div className="flex bg-white p-1.5 rounded-2xl shadow-sm border border-stone-100 overflow-x-auto no-scrollbar max-w-full">
              <button 
                onClick={() => setActiveStation('all')}
                className={cn(
                  "px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                  activeStation === 'all' ? "bg-mex-brown text-white shadow-md scale-100" : "text-stone-700 hover:text-stone-900 font-extrabold hover:bg-stone-50 active:scale-95"
                )}
              >
                Todas
              </button>
              <button 
                onClick={() => setActiveStation('cocina')}
                className={cn(
                  "px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border border-transparent",
                  activeStation === 'cocina' ? "bg-blue-600 text-white shadow-md border-blue-500 scale-100" : "text-stone-700 hover:text-stone-900 font-extrabold hover:bg-stone-50 active:scale-95"
                )}
              >
                Cocina
              </button>
              <button 
                onClick={() => setActiveStation('plancha')}
                className={cn(
                  "px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border border-transparent",
                  activeStation === 'plancha' ? "bg-orange-600 text-white shadow-md border-orange-500 scale-100" : "text-stone-700 hover:text-stone-900 font-extrabold hover:bg-stone-50 active:scale-95"
                )}
              >
                Parrilla
              </button>
            </div>
          )}

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowMusicSettings(!showMusicSettings)}
              className={cn(
                "p-2.5 px-3.5 rounded-2xl border transition-all flex items-center gap-2 cursor-pointer shadow-sm text-[10px] font-black uppercase tracking-wider h-[46px]",
                showMusicSettings 
                  ? "bg-amber-600 text-white border-amber-700" 
                  : "bg-white text-amber-700 border-amber-200 hover:bg-amber-50"
              )}
              title="Configuración de Música"
            >
              <Music size={15} className={cn(isPreparing && !prepMusicMuted && "animate-spin duration-3000")} />
              <span>🎵 Música</span>
            </button>

            <button
              onClick={() => setPrepMusicMuted(!prepMusicMuted)}
              className={cn(
                "p-2.5 rounded-2xl border transition-all flex items-center justify-center cursor-pointer shadow-sm w-[46px] h-[46px]",
                prepMusicMuted 
                  ? "bg-red-50 text-red-600 border-red-200 hover:bg-red-100/65" 
                  : "bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100/65"
              )}
              title={prepMusicMuted ? "Música Silenciada - Toca para Activar" : "Música Activa - Toca para Silenciar"}
            >
              {prepMusicMuted ? <VolumeX size={17} /> : <Volume2 size={17} className={cn(isPreparing && "animate-pulse")} />}
            </button>
          </div>

          <button
            onClick={() => {
              setShowSettingsPopover(!showSettingsPopover);
            }}
            className={cn(
              "p-2.5 px-3.5 rounded-2xl border transition-all flex items-center gap-2 cursor-pointer shadow-sm text-[10px] font-black uppercase tracking-wider h-[46px]",
              showSettingsPopover 
                ? "bg-stone-900 text-white border-stone-950" 
                : isAlerting
                  ? "bg-red-50 text-red-600 border-red-200 animate-pulse"
                  : "bg-white text-stone-700 border-stone-200 hover:bg-stone-50"
            )}
            title="Configurar Alertas"
          >
            {isAlerting ? <Bell className="animate-bounce text-red-500" size={15} /> : <Bell size={15} />}
            <span>⚙️ Alertas</span>
          </button>

          <button
            onClick={() => {
              setOrderToAddItems(null);
              setSelectedProduct(null);
              setSearchProductQuery("");
              setAddQuantity(1);
              setAddNotes("");
              setAddStation(activeStation === 'plancha' ? 'plancha' : 'cocina');
              setShowDirectAddModal(true);
            }}
            className="p-2.5 px-3.5 rounded-2xl bg-mex-green hover:bg-emerald-700 text-white transition-all flex items-center gap-2 cursor-pointer shadow-sm text-[10px] font-black uppercase tracking-wider h-[46px] border-none select-none active:scale-95"
            title="Agregar Platillo a una Orden / Mesa"
          >
            <Plus size={15} strokeWidth={3} />
            <span>Agregar Platillo</span>
          </button>
        </div>
      </div>

      {/* --- FLOATING ALERTS CONFIG MODAL --- */}
      {showSettingsPopover && (
        <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-sm z-[450] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl border border-stone-200 p-6 w-full max-w-md max-h-[90vh] flex flex-col animate-in fade-in duration-250">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-stone-100 shrink-0">
              <div className="flex items-center gap-2.5">
                <Smartphone className="text-mex-brown" size={20} />
                <h3 className="font-serif font-black text-stone-800 text-base leading-tight">Configurar Alertas</h3>
              </div>
              <button 
                onClick={() => setShowSettingsPopover(false)}
                className="p-1 rounded-full hover:bg-stone-100 text-stone-400 hover:text-stone-700 cursor-pointer transition-all border-none"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto flex-1 pr-1.5 scrollbar-thin pb-4">
              <p className="text-[10px] text-stone-500 font-bold uppercase tracking-widest leading-relaxed">
                Control de vibrador, alarmas y destellos de luz para los nuevos pedidos de cocina.
              </p>

              {/* 1. VIBRATION / SOUND TOGGLE */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-stone-50 border border-stone-100">
                <div className="space-y-0.5">
                  <p className="text-xs font-black text-stone-800 uppercase tracking-wide">Sonido y Vibración</p>
                  <p className="text-[9px] text-stone-500 font-medium">Buzzer audible y zumbador en móviles</p>
                </div>
                <button
                  onClick={() => {
                    setKitchenSoundEnabled(prev => !prev);
                    toast.success(!kitchenSoundEnabled ? "Alertas de vibración/sonido activadas" : "Vibración y alarmas silenciadas");
                  }}
                  className={cn(
                    "px-3 py-1.5 font-extrabold text-[9px] uppercase tracking-wider rounded-xl transition-all border flex items-center gap-1 cursor-pointer",
                    kitchenSoundEnabled 
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100" 
                      : "bg-stone-100 text-stone-500 border-stone-200 hover:bg-stone-200"
                  )}
                >
                  {kitchenSoundEnabled ? "🔊 ACTIVADO" : "🔕 SILENCIADO"}
                </button>
              </div>

              {/* 2. FULLSCREEN STROBE TOGGLE */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-stone-50 border border-stone-100">
                <div className="space-y-0.5">
                  <p className="text-xs font-black text-stone-800 uppercase tracking-wide">Destello de Pantalla</p>
                  <p className="text-[9px] text-stone-500 font-medium">Flash de pantalla completa para alertas</p>
                </div>
                <button
                  onClick={() => {
                    setFullscreenStrobe(prev => !prev);
                    toast.success(!fullscreenStrobe ? "Destello de pantalla completa activado" : "Destello de pantalla normal activado");
                  }}
                  className={cn(
                    "px-3 py-1.5 font-extrabold text-[9px] uppercase tracking-wider rounded-xl transition-all border flex items-center gap-1 cursor-pointer",
                    fullscreenStrobe 
                      ? "bg-amber-500 text-white border-amber-600 hover:bg-amber-600" 
                      : "bg-stone-100 text-stone-600 border-stone-200 hover:bg-stone-200"
                  )}
                >
                  ⚡ {fullscreenStrobe ? "PANTALLA COMPLETA" : "NORMAL"}
                </button>
              </div>

              {/* 3. TEST ALERT BUTTON */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-stone-50 border border-stone-100">
                <div className="space-y-0.5">
                  <p className="text-xs font-black text-stone-800 uppercase tracking-wide">Probar Alertas</p>
                  <p className="text-[9px] text-stone-500 font-medium">Simular señal de alarma por 4 segundos</p>
                </div>
                <button
                  onClick={triggerTestAlert}
                  disabled={isAlerting}
                  className="px-3 py-1.5 bg-stone-800 text-white hover:bg-stone-900 font-extrabold text-[9px] uppercase tracking-wider rounded-xl transition-all border-none cursor-pointer disabled:opacity-50"
                >
                  📳 PROBAR (4s)
                </button>
              </div>

              {/* 4. BACKGROUND SYSTEM NOTIFICATIONS */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-stone-50 border border-stone-100">
                <div className="space-y-0.5">
                  <p className="text-xs font-black text-stone-800 uppercase tracking-wide">Alertas Segundo Plano</p>
                  <p className="text-[9px] text-stone-500 font-medium">Notificaciones del sistema si la pestaña está oculta</p>
                </div>
                <button
                  onClick={() => {
                    if (typeof window !== "undefined" && "Notification" in window) {
                      Notification.requestPermission().then(permission => {
                        setNotificationPermission(permission);
                        if (permission === "granted") {
                          toast.success("¡Alertas en segundo plano activadas!", { icon: "🔔" });
                          try {
                            new Notification("Las Cazuelas", { 
                              body: "Las notificaciones en segundo plano están listas para avisar de nuevos pedidos.",
                              tag: "test-notification"
                            });
                          } catch (err) {}
                        } else {
                          toast.error("Permiso denegado. Por favor, actívalas en la configuración de tu navegador.");
                        }
                      });
                    } else {
                      toast.error("Tu navegador no soporta notificaciones de sistema.");
                    }
                  }}
                  className={cn(
                    "px-3 py-1.5 font-extrabold text-[9px] uppercase tracking-wider rounded-xl transition-all border flex items-center gap-1 cursor-pointer",
                    notificationPermission === "granted"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100" 
                      : notificationPermission === "denied"
                        ? "bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
                        : "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                  )}
                >
                  {notificationPermission === "granted" 
                    ? "🟢 ACTIVO" 
                    : notificationPermission === "denied" 
                      ? "🔴 BLOQUEADO" 
                      : "🔵 SOLICITAR"}
                </button>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-stone-100 flex justify-end gap-2 shrink-0">
              {isAlerting && (
                <button
                  onClick={() => {
                    handleSilenceAll();
                    setShowSettingsPopover(false);
                  }}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-black text-[10px] uppercase tracking-wider rounded-xl transition-all shadow-md shadow-red-600/10 cursor-pointer"
                >
                  🛑 Silenciar Todo
                </button>
              )}
              <button
                onClick={() => setShowSettingsPopover(false)}
                className="px-4 py-2 bg-stone-150 hover:bg-stone-200 text-stone-700 font-extrabold text-[10px] uppercase tracking-wider rounded-xl transition-all border-none cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- FLOATING MUSIC CONFIG MODAL (BUILT-IN MUSIC EXPLORER) --- */}
      {showMusicSettings && (
        <div className="fixed inset-0 bg-stone-950/65 backdrop-blur-sm z-[450] flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl border border-stone-200 p-5 sm:p-6 w-full max-w-lg max-h-[95vh] flex flex-col animate-in fade-in duration-200">
            {/* Header */}
            <div className="flex items-center justify-between mb-3 pb-3 border-b border-stone-100 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-amber-50 flex items-center justify-center">
                  <Music className="text-amber-600 animate-bounce" size={18} />
                </div>
                <div>
                  <h3 className="font-serif font-black text-stone-900 text-base leading-tight">Explorador de Música</h3>
                  <p className="text-[9px] text-stone-500 font-bold uppercase tracking-wider">Música para {userRole === 'parrilla' ? 'Parrilla' : 'Cocina'}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsTestingMusic(false);
                  if (previewAudioRef.current) {
                    previewAudioRef.current.pause();
                  }
                  setPreviewingSongId(null);
                  setShowMusicSettings(false);
                }}
                className="text-stone-400 hover:text-stone-700 p-2 rounded-full hover:bg-stone-50 transition-all border-none bg-transparent cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Quick Playback & Mute Status Bar */}
            <div className="mb-4 p-3 rounded-2xl bg-stone-50 border border-stone-150 flex flex-col gap-2 shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "w-2.5 h-2.5 rounded-full",
                    shouldPlayMusic ? "bg-emerald-500 animate-pulse" : "bg-stone-400"
                  )} />
                  <div className="text-[10px] leading-tight">
                    <span className="font-bold text-stone-500 uppercase tracking-wider block">Sonido Activo:</span>
                    <span className="font-black text-stone-850 uppercase max-w-[200px] truncate block">
                      {prepSongFileName ? prepSongFileName : "Canción por Defecto"}
                    </span>
                  </div>
                </div>
                
                <button
                  type="button"
                  onClick={() => {
                    setPrepMusicMuted(!prepMusicMuted);
                  }}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider border transition-all cursor-pointer flex items-center gap-1.5",
                    prepMusicMuted 
                      ? "bg-red-50 text-red-600 border-red-200 hover:bg-red-100" 
                      : "bg-white text-stone-700 border-stone-250 hover:bg-stone-100"
                  )}
                >
                  {prepMusicMuted ? (
                    <>
                      <VolumeX size={12} />
                      🔇 Muteado
                    </>
                  ) : (
                    <>
                      <Volume2 size={12} />
                      🔊 Sonando
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Search Input Bar */}
            <div className="relative mb-3 shrink-0">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-stone-400">
                <Search size={14} />
              </span>
              <input
                type="text"
                placeholder="Buscar canción, estilo, cumbia, pop..."
                value={musicSearchQuery}
                onChange={(e) => setMusicSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-stone-50 hover:bg-stone-100 focus:bg-white text-xs font-bold text-stone-800 placeholder-stone-400 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-500/15 focus:border-amber-500 transition-all"
              />
              {musicSearchQuery && (
                <button 
                  onClick={() => setMusicSearchQuery("")}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-stone-400 hover:text-stone-600 border-none bg-transparent cursor-pointer"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Category / Genre Selector Tabs */}
            <div className="flex gap-1 overflow-x-auto pb-2 shrink-0 scrollbar-none border-b border-stone-100 -mx-1 px-1">
              {[
                { id: "all", label: "🎵 Todo" },
                { id: "cumbias", label: "💃 Cumbia/Salsa" },
                { id: "rock", label: "🎸 Rock/Pop" },
                { id: "mexicana", label: "🇲🇽 Mexicana" },
                { id: "ambient", label: "🍃 Relax" },
                { id: "custom", label: "🔗 Enlaces" },
                { id: "file", label: "📱 Celular" }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setSelectedGenreTab(tab.id)}
                  className={cn(
                    "px-3 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-lg border transition-all whitespace-nowrap cursor-pointer",
                    selectedGenreTab === tab.id
                      ? "bg-amber-600 text-white border-amber-600 shadow-md shadow-amber-600/10"
                      : "bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* List & Scrollable Area */}
            <div className="flex-1 overflow-y-auto pr-1 scrollbar-thin py-3 space-y-3 min-h-[160px]">
              
              {/* Special Context Forms based on active tab */}
              {selectedGenreTab === "custom" && (
                <form onSubmit={handleAddCustomSong} className="p-3 bg-amber-50/40 border border-amber-200/60 rounded-2xl space-y-2 mb-2">
                  <span className="text-[8px] font-black uppercase tracking-widest text-amber-800 block">➕ Guardar Nuevo Enlace de Audio Web</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input 
                      type="text" 
                      placeholder="Nombre (ej: Radio Cumbia)" 
                      value={newCustomName}
                      onChange={(e) => setNewCustomName(e.target.value)}
                      className="p-2 bg-white text-[11px] font-bold rounded-lg border border-stone-200 focus:outline-none focus:border-amber-400"
                    />
                    <input 
                      type="url" 
                      placeholder="Enlace URL de audio (.mp3, stream)" 
                      value={newCustomUrl}
                      onChange={(e) => setNewCustomUrl(e.target.value)}
                      className="p-2 bg-white text-[11px] font-bold rounded-lg border border-stone-200 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <div className="flex justify-end">
                    <button 
                      type="submit"
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-black uppercase text-[9px] tracking-wider rounded-lg flex items-center gap-1 transition-all border-none cursor-pointer"
                    >
                      <Plus size={11} /> Guardar Canción
                    </button>
                  </div>
                </form>
              )}

              {selectedGenreTab === "file" && (
                <div className="p-3.5 bg-emerald-50/40 border border-emerald-100 rounded-2xl space-y-3 mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
                      <FolderOpen size={16} />
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wide text-stone-800 block">Cargar Audio desde Celular / PC</span>
                      <span className="text-[8px] text-stone-500 font-bold">Resuelve el problema de selección en Smartphones</span>
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-2.5">
                    <label className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black tracking-wider cursor-pointer uppercase transition-all shadow-sm border-none w-full text-center">
                      <FileAudio size={13} />
                      1. Buscar Solo Audios (.mp3, .wav, .m4a)
                      <input
                        type="file"
                        accept=".mp3,.wav,.m4a,.ogg,.aac,.mp4,audio/mpeg,audio/mp3,audio/wav,audio/x-m4a,audio/x-aac,audio/mpeg3,audio/x-mpeg-3"
                        onChange={handlePrepFileChange}
                        className="hidden"
                      />
                    </label>

                    <label className="flex items-center justify-center gap-2 px-4 py-2.5 bg-stone-900 hover:bg-stone-950 text-white rounded-xl text-[10px] font-black tracking-wider cursor-pointer uppercase transition-all shadow-sm border-none w-full text-center">
                      <FolderOpen size={13} />
                      2. Explorador Completo (Recomendado Celular)
                      <input
                        type="file"
                        accept="*/*"
                        onChange={handlePrepFileChange}
                        className="hidden"
                      />
                    </label>

                    <div className="p-2.5 bg-amber-50/60 border border-amber-200/50 rounded-xl text-left text-[9px] text-stone-600 space-y-1">
                      <p className="font-bold text-amber-800">💡 ¿CÓMO ELEGIR TU MÚSICA EN SMARTPHONES?</p>
                      <ul className="list-disc list-inside space-y-0.5 text-stone-500 font-medium">
                        <li>Usa la opción <b>2. Explorador Completo</b> si el celular solo te abre la grabadora de voz o cámara.</li>
                        <li>En el explorador, toca las 3 líneas arriba a la izquierda y entra a <b>"Descargas"</b>, <b>"Audio"</b> o <b>"Almacenamiento interno"</b>.</li>
                        <li>También puedes usar la pestaña <b>"Enlaces"</b> para escuchar cualquier radio, directo o link de música de internet sin descargar nada.</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Tracks List */}
              <div className="space-y-1.5">
                {getFilteredSongs().length > 0 ? (
                  getFilteredSongs().map(song => {
                    const isSelected = prepSongPreset === song.id;
                    const isPreviewing = previewingSongId === song.id;

                    return (
                      <div
                        key={song.id}
                        className={cn(
                          "p-2.5 rounded-xl border flex items-center justify-between gap-3 transition-all",
                          isSelected 
                            ? "bg-amber-50/60 border-amber-300 shadow-sm" 
                            : "bg-stone-50/55 border-stone-200 hover:bg-stone-50 hover:border-stone-350"
                        )}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          {/* Play Preview button */}
                          <button
                            type="button"
                            onClick={() => handleTogglePreview(song.id, song.url)}
                            className={cn(
                              "w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-none transition-all cursor-pointer shadow-sm",
                              isPreviewing 
                                ? "bg-red-600 text-white animate-pulse" 
                                : isSelected
                                  ? "bg-amber-100 text-amber-800 hover:bg-amber-200"
                                  : "bg-white text-stone-600 hover:bg-stone-100"
                            )}
                            title={isPreviewing ? "Detener vista previa" : "Escuchar vista previa"}
                          >
                            {isPreviewing ? <Pause size={13} /> : <Play className="ml-0.5" size={13} />}
                          </button>

                          {/* Song Details */}
                          <div className="min-w-0 flex-1">
                            <span className={cn(
                              "text-xs block truncate leading-snug",
                              isSelected ? "font-black text-amber-900" : "font-bold text-stone-850"
                            )}>
                              {song.name}
                            </span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[8px] px-1.5 py-0.5 rounded bg-stone-100 font-extrabold uppercase text-stone-500 tracking-wider">
                                {song.genre}
                              </span>
                              {isSelected && (
                                <span className="text-[8px] font-black uppercase text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-md">
                                  🟢 Activo Cocina
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* Choose/Set Active button */}
                          {!isSelected && (
                            <button
                              type="button"
                              onClick={() => handleSelectSong(song)}
                              className="px-2.5 py-1.5 bg-stone-900 hover:bg-stone-950 text-white rounded-lg text-[9px] font-black uppercase tracking-wider transition-all border-none cursor-pointer shadow-sm"
                            >
                              Establecer
                            </button>
                          )}
                          
                          {/* Trash/Delete button for custom library items */}
                          {song.isCustom && (
                            <button
                              type="button"
                              onClick={() => handleDeleteCustomSong(song.id, song.name.replace("🔗 ", ""))}
                              className="p-1.5 rounded-lg hover:bg-red-50 text-red-600 transition-colors cursor-pointer border-none bg-transparent"
                              title="Eliminar de mi biblioteca"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-8 text-center text-stone-400 bg-stone-50 rounded-2xl border border-dashed border-stone-200">
                    <ListMusic className="mx-auto opacity-20 mb-2" size={32} />
                    <p className="text-[10px] font-black uppercase tracking-wider text-stone-500">No se encontraron canciones</p>
                    <p className="text-[9px] text-stone-400 mt-0.5">Prueba buscando otra palabra o selecciona otra pestaña.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Test alert block */}
            <div className="p-3 bg-amber-50/40 border border-amber-100 rounded-2xl space-y-2 shrink-0">
              <span className="text-[8px] font-black uppercase tracking-widest text-amber-700 block">Probar Bocina General de Cocina</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsTestingMusic(!isTestingMusic);
                  }}
                  className={cn(
                    "flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider border-none cursor-pointer transition-all flex items-center justify-center gap-1.5 shadow-sm",
                    isTestingMusic 
                      ? "bg-red-600 hover:bg-red-700 text-white" 
                      : "bg-stone-900 hover:bg-stone-950 text-white"
                  )}
                >
                  {isTestingMusic ? (
                    <>
                      <VolumeX size={12} /> Detener Sonido General
                    </>
                  ) : (
                    <>
                      <Volume2 size={12} /> Iniciar Sonido General
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="mt-4 pt-3 border-t border-stone-100 flex justify-end shrink-0">
              <button
                onClick={() => {
                  setIsTestingMusic(false);
                  if (previewAudioRef.current) {
                    previewAudioRef.current.pause();
                  }
                  setPreviewingSongId(null);
                  setShowMusicSettings(false);
                }}
                className="px-5 py-2.5 bg-stone-900 hover:bg-stone-950 text-white font-black text-[10px] uppercase tracking-wider rounded-xl transition-all border-none cursor-pointer shadow-md"
              >
                Cerrar Explorador
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6 overflow-y-auto pr-1 pb-24 md:pb-8">
        {tickets.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center py-20 text-stone-300">
            <ClipboardList size={80} className="mb-4 opacity-10" />
            <p className="text-xl font-serif opacity-40">No hay comandas pendientes</p>
            <p className="text-sm opacity-30 mt-1 uppercase tracking-tighter">Estación: {activeStation === 'plancha' ? 'Parrilla' : activeStation === 'cocina' ? 'Cocina' : 'Todas'}</p>
          </div>
        ) : (
          tickets.map(ticket => {
            const isTicketAlerting = isAlerting && ticket.stationStatus === 'pending' && !silencedTickets.includes(ticket.id);
            return (
              <Card 
                key={ticket.id} 
                className={cn(
                  "flex flex-col border border-stone-200 shadow-lg transition-all rounded-[1.5rem] overflow-hidden bg-white",
                  isTicketAlerting
                    ? (flashState 
                        ? "ring-4 ring-amber-500 shadow-amber-200 bg-amber-50/10 scale-[1.01] border-amber-400" 
                        : "ring-4 ring-red-600 shadow-red-200 scale-[1.01] border-red-500 bg-red-50/10")
                    : ticket.stationStatus === 'preparing' 
                      ? 'ring-2 ring-blue-600 shadow-blue-50' 
                      : 'hover:shadow-xl'
                )}
              >
                {/* --- TICKET HEADER --- */}
                <CardHeader className="flex flex-row items-center justify-between bg-stone-100/90 p-3 border-b border-stone-200">
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-[8px] text-stone-500 uppercase font-black tracking-widest leading-none">Mesa / Orden</p>
                    <p className={cn(
                      "text-lg font-black tracking-tight px-2 py-0.5 rounded-lg border w-fit leading-none mt-0.5",
                      ticket.order.isTakeaway 
                        ? "text-orange-700 bg-orange-100 border-orange-200" 
                        : "text-mex-brown bg-amber-50 border-amber-200"
                    )}>
                      {ticket.order.isTakeaway ? 'LLEVAR' : `${ticket.order.tableNumber}`}
                    </p>
                    <div className="flex items-center gap-1 mt-1">
                      <span className={cn(
                        "px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider rounded-md border flex items-center gap-0.5",
                        ticket.station === 'plancha' 
                          ? "bg-orange-500 text-white border-orange-600" 
                          : "bg-blue-600 text-white border-blue-700"
                      )}>
                        <span className="w-1 h-1 rounded-full bg-white animate-pulse" />
                        {ticket.station === 'plancha' ? 'Parrilla' : 'Cocina'}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <div className="flex items-center gap-1">
                      {ticket.stationStatus === 'pending' && (
                        <button
                          onClick={() => handleSilenceTicket(ticket.id)}
                          className={cn(
                            "p-1 rounded-lg border transition-all cursor-pointer",
                            silencedTickets.includes(ticket.id)
                              ? "bg-stone-200 text-stone-400 border-stone-300"
                              : isTicketAlerting
                                ? (flashState ? "bg-red-600 text-white border-red-700 animate-bounce" : "bg-amber-500 text-white border-amber-600 animate-bounce")
                                : "bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200"
                          )}
                          title={silencedTickets.includes(ticket.id) ? "Alerta Silenciada" : "Silenciar Alerta"}
                        >
                          {silencedTickets.includes(ticket.id) ? <BellOff size={11} strokeWidth={2.5} /> : <Bell size={11} strokeWidth={2.5} className={isTicketAlerting ? "animate-pulse" : ""} />}
                        </button>
                      )}
                      <div className={cn(
                        "px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider border leading-none", 
                        ticket.stationStatus === 'pending' 
                          ? "bg-amber-100 text-amber-900 border-amber-300 animate-pulse" 
                          : "bg-blue-100 text-blue-900 border-blue-300"
                      )}>
                        {ticket.stationStatus === 'pending' ? 'Pendiente' : 'En Proceso'}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 bg-stone-250/80 px-1.5 py-0.5 rounded-md text-stone-800 font-extrabold text-[9px] border border-stone-300/60 leading-none">
                      <Clock size={10} className="text-stone-500" />
                      {getTimeElapsed(ticket.order.createdAt)}
                    </div>
                  </div>
                </CardHeader>

              {/* --- TICKET CONTENT (ITEMS) --- */}
              <CardContent className="p-3 space-y-1.5 flex-1 bg-stone-50/40">
                {ticket.items.map((item, idx) => (
                  <div 
                    key={idx} 
                    className={cn(
                      "w-full flex justify-between items-center p-2 rounded-xl border transition-all group bg-white shadow-xs", 
                      item.status === 'completed' 
                        ? "bg-stone-50/70 opacity-35 border-stone-200" 
                        : "border-stone-200 hover:border-mex-green/35 hover:scale-[1.01]"
                    )}
                  >
                    <button 
                      type="button"
                      onClick={() => toggleItemStatus(ticket.orderId, item.originalIndex, item.status)}
                      className="flex-1 text-left flex items-start gap-2.5 cursor-pointer"
                    >
                      {/* Checkbox click area */}
                      <div className="flex-shrink-0 mt-0.5">
                        <div className={cn(
                          "w-5 h-5 rounded-md flex items-center justify-center transition-all border shadow-3xs",
                          item.status === 'completed' 
                            ? "bg-green-600 text-white border-green-700" 
                            : "border-stone-300 bg-stone-50 group-hover:border-mex-green"
                        )}>
                          {item.status === 'completed' && <CheckCircle2 size={12} strokeWidth={3} />}
                        </div>
                      </div>

                      {/* Item quantity & text */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-1.5 flex-wrap">
                          <span className={cn(
                            "font-extrabold text-[10px] px-1 py-0.5 rounded-md border tracking-tight shrink-0", 
                            item.status === 'completed' 
                              ? "text-stone-400 bg-stone-100 border-stone-200" 
                              : "text-mex-terracotta bg-red-50 border-red-100"
                          )}>
                            {item.quantity}x
                          </span>
                          <span className={cn(
                            "font-bold text-[11px] leading-tight tracking-tight", 
                            item.status === 'completed' 
                              ? "text-stone-400 line-through" 
                              : "text-stone-900"
                          )}>
                            {item.name}
                          </span>
                        </div>

                        {/* HIGH CONTRAST NOTES ALERT BANNER */}
                        {item.notes && (
                          <div className={cn(
                            "mt-1 text-[9px] font-bold uppercase tracking-tight px-2 py-1 rounded-lg flex items-center gap-1 shadow-3xs border-l-2 border-l-red-600 leading-normal",
                            item.status === 'completed'
                              ? "bg-stone-150 text-stone-500 border-stone-200"
                              : "bg-red-50/90 text-red-950 border border-red-200"
                          )}>
                            <span className="text-red-650 font-extrabold shrink-0 text-[10px]">⚠️ NOTA:</span>
                            <span className="truncate font-black">"{item.notes}"</span>
                          </div>
                        )}
                      </div>
                    </button>

                    {item.status !== 'completed' && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setItemCancellation({
                            orderId: ticket.orderId,
                            originalIndex: item.originalIndex,
                            itemName: item.name
                          });
                        }}
                        className="text-stone-400 hover:text-red-600 p-1.5 hover:bg-red-50 rounded-lg transition-all cursor-pointer shrink-0 ml-1.5 border border-transparent hover:border-red-100"
                        title="Cancelar este producto"
                      >
                        <Ban size={13} strokeWidth={2.5} />
                      </button>
                    )}
                  </div>
                ))}
              </CardContent>

              {/* --- TICKET FOOTER WITH COMPACT ACTION CONTROLS --- */}
              <CardFooter className="p-2 bg-stone-100/90 border-t border-stone-200 flex items-center gap-1.5 shrink-0">
                {/* Cancel comanda button */}
                <Button 
                  type="button"
                  variant="outline"
                  className="flex-1 h-8 p-0 border-red-300 bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-850 rounded-lg shrink-0 cursor-pointer flex items-center justify-center transition-all shadow-3xs active:scale-95 font-bold"
                  onClick={() => setOrderToCancel(ticket.order)}
                  title="Cancelar Comanda Completa"
                >
                  <Trash2 size={15} strokeWidth={2.5} />
                </Button>

                {onEditOrder && (
                  <Button 
                    variant="ghost" 
                    className="flex-1 h-8 p-0 text-emerald-800 hover:text-emerald-900 hover:bg-emerald-100 bg-emerald-50 border border-emerald-300 rounded-lg cursor-pointer transition-all shadow-3xs active:scale-95 flex items-center justify-center font-bold"
                    onClick={() => {
                      setOrderToAddItems(ticket.order);
                      setAddStation(ticket.station);
                      setSelectedProduct(null);
                      setSearchProductQuery("");
                      setAddQuantity(1);
                      setAddNotes("");
                      setShowDirectAddModal(true);
                    }}
                    title="Agregar Producto a Comanda"
                  >
                    <PlusCircle size={15} strokeWidth={2.5} />
                  </Button>
                )}

                {/* Compact active buttons (Comenzar / Completar) */}
                {ticket.stationStatus === 'pending' ? (
                  <Button 
                    variant="primary" 
                    className={cn(
                      "flex-1 h-8 p-0 text-white rounded-lg shadow-3xs cursor-pointer transition-all active:scale-95 flex items-center justify-center gap-1 font-black uppercase text-[10px] tracking-wider",
                      isTicketAlerting
                        ? (flashState 
                            ? "bg-red-600 hover:bg-red-700 ring-2 ring-red-400 text-white scale-[1.03]" 
                            : "bg-amber-500 hover:bg-amber-600 ring-2 ring-amber-300 text-black scale-[1.03]")
                        : "bg-blue-600 hover:bg-blue-700"
                    )}
                    onClick={() => updateOrderStatus(ticket.orderId, 'start_station', ticket.station)}
                    title="Comenzar Preparación y Silenciar Alertas"
                  >
                    {isTicketAlerting ? (
                      <>
                        <span className="animate-pulse">¡INICIAR!</span>
                        <PlayCircle size={14} strokeWidth={3} className="animate-spin" />
                      </>
                    ) : (
                      <>
                        <span>Comenzar</span>
                        <PlayCircle size={14} strokeWidth={2.5} className="animate-pulse" />
                      </>
                    )}
                  </Button>
                ) : (
                  <Button 
                    variant="primary" 
                    className="flex-1 h-8 p-0 bg-mex-green hover:bg-mex-green/90 text-white rounded-lg shadow-3xs cursor-pointer transition-all active:scale-95 flex items-center justify-center"
                    onClick={() => updateOrderStatus(ticket.orderId, 'finish_station', ticket.station)}
                    title="Completar Preparación"
                  >
                    <CheckCircle2 size={15} strokeWidth={2.5} />
                  </Button>
                )}
              </CardFooter>
            </Card>
          );
        }))}
    </div>

      {/* --- MODAL: CONFIRM ORDER CANCELLATION --- */}
      {orderToCancel && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[350] p-4 backdrop-blur-sm">
          <Card className="w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden border border-stone-200 bg-white animate-in zoom-in-95 duration-200">
            <div className="bg-red-600 text-white px-6 py-5 flex items-center justify-between">
              <h3 className="font-serif text-sm font-extrabold flex items-center gap-2 tracking-tight">
                <Trash2 size={18} />
                Cancelar Comanda Completa
              </h3>
              <button
                type="button"
                onClick={() => setOrderToCancel(null)}
                className="text-white/80 hover:text-white transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-stone-600 leading-relaxed">
                ¿Estás seguro de que deseas cancelar la totalidad del pedido para <strong>{orderToCancel.isTakeaway ? 'Llevar' : `Mesa ${orderToCancel.tableNumber}`}</strong>?
              </p>
              <div className="bg-red-50 border border-red-100 p-3 rounded-2xl text-[11px] text-red-800 leading-normal">
                ⚠️ <strong>Advertencia:</strong> Esta acción marcará todo el pedido como cancelado y se notificará en caja y administración.
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-stone-100 mt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOrderToCancel(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-stone-800 bg-stone-105 hover:text-stone-950 hover:bg-stone-200 border border-stone-300 cursor-pointer"
                >
                  No, volver
                </Button>
                <Button
                  onClick={() => cancelEntireOrder(orderToCancel.id)}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white border border-red-700 shadow-sm cursor-pointer"
                >
                  Sí, Cancelar Todo
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* --- MODAL: CONFIRM ITEM CANCELLATION --- */}
      {itemCancellation && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[350] p-4 backdrop-blur-sm">
          <Card className="w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden border border-stone-200 bg-white animate-in zoom-in-95 duration-200">
            <div className="bg-red-600 text-white px-6 py-5 flex items-center justify-between">
              <h3 className="font-serif text-sm font-extrabold flex items-center gap-2 tracking-tight">
                <XCircle size={18} />
                Cancelar Producto
              </h3>
              <button
                type="button"
                onClick={() => setItemCancellation(null)}
                className="text-white/80 hover:text-white transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-stone-600 leading-relaxed">
                ¿Estás seguro de que deseas quitar <strong>{itemCancellation.itemName}</strong> de esta comanda?
              </p>
              <div className="bg-red-50 border border-red-100 p-3 rounded-2xl text-[11px] text-red-800 leading-normal">
                🍳 <strong>Nota:</strong> Se descontará el costo de este producto del total de esta mesa/orden (cancelación parcial).
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-stone-100 mt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setItemCancellation(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-stone-800 bg-stone-105 hover:text-stone-950 hover:bg-stone-200 border border-stone-300 cursor-pointer"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={() => cancelOrderItem(itemCancellation.orderId, itemCancellation.originalIndex)}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white border border-red-700 shadow-sm cursor-pointer"
                >
                  Confirmar Quitar
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* --- MODAL: AGREGAR PLATILLO DIRECTAMENTE --- */}
      {showDirectAddModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[350] p-4 backdrop-blur-sm">
          <Card className="w-full max-w-lg rounded-[2rem] shadow-2xl overflow-hidden border border-stone-200 bg-mex-cream animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="bg-mex-brown text-white px-6 py-4 flex items-center justify-between shrink-0">
              <h3 className="font-serif text-sm font-extrabold flex items-center gap-2 tracking-tight">
                <Plus size={18} strokeWidth={2.5} />
                Agregar Platillo a Comanda
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowDirectAddModal(false);
                  setOrderToAddItems(null);
                  setSelectedProduct(null);
                  setAddQuantity(1);
                  setAddNotes("");
                }}
                className="text-white/80 hover:text-white transition-colors cursor-pointer border-none bg-transparent"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1 scrollbar-thin">
              {/* Table / Order Selector */}
              <div className="space-y-1 text-left">
                <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest block px-1 text-left">
                  Mesa / Orden de Destino
                </label>
                <select
                  value={orderToAddItems?.id || ""}
                  onChange={(e) => {
                    const selected = orders.find(o => o.id === e.target.value);
                    setOrderToAddItems(selected || null);
                  }}
                  className="w-full px-4 py-3 bg-white rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-mex-green/20 text-sm font-bold text-stone-800"
                >
                  <option value="">-- Seleccionar Mesa / Orden --</option>
                  {orders
                    .filter(o => o.status !== 'cancelled' && o.status !== 'paid')
                    .map(o => (
                      <option key={o.id} value={o.id}>
                        {o.isTakeaway ? `Para Llevar (Cliente: ${o.clientName || 'Sin Nombre'})` : `Mesa ${o.tableNumber}`} {o.folio ? `[${o.folio.split('-').pop()}]` : ""}
                      </option>
                    ))
                  }
                </select>
              </div>

              {/* Product search & scroll track */}
              <div className="space-y-2 text-left">
                <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest block px-1 text-left">
                  Buscar Platillo o Bebida
                </label>
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
                  <input
                    type="text"
                    placeholder="Escribe nombre de platillo..."
                    value={searchProductQuery}
                    onChange={(e) => setSearchProductQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-white rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-mex-green/20 text-sm font-bold text-stone-800"
                  />
                </div>

                <div className="max-h-[180px] overflow-y-auto border border-stone-200 rounded-xl divide-y divide-stone-100 bg-white shadow-inner">
                  {products
                    .filter(p => {
                      if (!p.available) return false;
                      if (!searchProductQuery) return true;
                      return p.name.toLowerCase().includes(searchProductQuery.toLowerCase()) || 
                             (p.description && p.description.toLowerCase().includes(searchProductQuery.toLowerCase()));
                    })
                    .map(prod => {
                      const isSelected = selectedProduct?.id === prod.id;
                      return (
                        <button
                          key={prod.id}
                          type="button"
                          onClick={() => {
                            setSelectedProduct(prod);
                            if (prod.station) {
                              setAddStation(prod.station);
                            }
                          }}
                          className={cn(
                            "w-full text-left p-3 flex items-center justify-between text-xs transition-all hover:bg-stone-50 border-none cursor-pointer",
                            isSelected ? "bg-mex-green/10 text-mex-green font-black" : "text-stone-700"
                          )}
                        >
                          <div>
                            <p className="font-extrabold text-sm">{prod.name}</p>
                            <p className="text-[10px] text-stone-400 font-medium truncate max-w-[200px] sm:max-w-[300px]">
                              {prod.description || 'Delicioso platillo tradicional.'}
                            </p>
                          </div>
                          <div className="text-right flex items-center gap-2 shrink-0">
                            <span className="font-bold text-mex-terracotta text-sm">${prod.price}</span>
                            <span className={cn(
                              "text-[9px] font-black uppercase px-2 py-0.5 rounded-full",
                              prod.station === 'plancha' ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"
                            )}>
                              {prod.station === 'plancha' ? 'Parrilla' : 'Cocina'}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                </div>
              </div>

              {/* Selection details (Qty, notes, station) */}
              {selectedProduct && (
                <div className="space-y-4 p-4 bg-white rounded-2xl border border-stone-200 animate-in fade-in duration-200 text-left">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[9px] text-stone-400 font-black uppercase tracking-wider">Platillo seleccionado:</p>
                      <h4 className="font-serif font-black text-mex-brown text-base">{selectedProduct.name}</h4>
                    </div>
                    <div className="flex items-center bg-stone-50 rounded-full p-1 border border-stone-200 shadow-3xs">
                      <button
                        type="button"
                        onClick={() => setAddQuantity(prev => Math.max(1, prev - 1))}
                        className="w-8 h-8 rounded-full bg-white hover:bg-stone-100 text-stone-700 font-black flex items-center justify-center border border-stone-200 transition-all cursor-pointer active:scale-90 select-none text-base"
                      >
                        -
                      </button>
                      <span className="w-10 text-center text-sm font-black text-stone-800">{addQuantity}</span>
                      <button
                        type="button"
                        onClick={() => setAddQuantity(prev => prev + 1)}
                        className="w-8 h-8 rounded-full bg-mex-green hover:bg-emerald-700 text-white font-black flex items-center justify-center border-none transition-all cursor-pointer active:scale-90 select-none text-base"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-stone-500 uppercase tracking-widest block text-left">Notas / Modificaciones</label>
                    <input
                      type="text"
                      placeholder="Ej: Sin cebolla, extra salsa, con queso..."
                      value={addNotes}
                      onChange={(e) => setAddNotes(e.target.value)}
                      className="w-full px-3 py-2 bg-stone-50 rounded-lg border border-stone-200 text-xs font-bold text-stone-800 focus:outline-none focus:ring-1 focus:ring-mex-green"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-stone-500 uppercase tracking-widest block text-left">Destino a Cocinar</label>
                    <div className="grid grid-cols-2 gap-2 bg-stone-50 p-1.5 rounded-xl border border-stone-200">
                      <button
                        type="button"
                        onClick={() => setAddStation('cocina')}
                        className={cn(
                          "py-2 px-3 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border-none cursor-pointer",
                          addStation === 'cocina'
                            ? "bg-blue-600 text-white shadow-sm"
                            : "bg-transparent text-stone-500 hover:text-stone-700"
                        )}
                      >
                        Cocina
                      </button>
                      <button
                        type="button"
                        onClick={() => setAddStation('plancha')}
                        className={cn(
                          "py-2 px-3 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border-none cursor-pointer",
                          addStation === 'plancha'
                            ? "bg-orange-500 text-white shadow-sm"
                            : "bg-transparent text-stone-500 hover:text-stone-700"
                        )}
                      >
                        Parrilla
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 bg-white border-t border-stone-100 flex gap-3 shrink-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowDirectAddModal(false);
                  setOrderToAddItems(null);
                  setSelectedProduct(null);
                  setAddQuantity(1);
                  setAddNotes("");
                }}
                className="flex-1 py-3 bg-stone-55 border-stone-300 hover:bg-stone-100 text-stone-700 font-bold uppercase text-xs rounded-xl"
              >
                Cerrar
              </Button>
              <Button
                type="button"
                disabled={!orderToAddItems || !selectedProduct}
                onClick={() => {
                  if (orderToAddItems && selectedProduct) {
                    addProductToOrderDirectly(orderToAddItems, selectedProduct, addQuantity, addNotes, addStation);
                  }
                }}
                className={cn(
                  "flex-1 py-3 font-bold uppercase text-xs rounded-xl shadow-md",
                  (!orderToAddItems || !selectedProduct)
                    ? "bg-stone-300 cursor-not-allowed text-stone-500"
                    : "bg-mex-green hover:bg-emerald-700 text-white"
                )}
              >
                Confirmar y Agregar
              </Button>
            </div>
          </Card>
        </div>
      )}
      </div>
    </div>
  );
};
