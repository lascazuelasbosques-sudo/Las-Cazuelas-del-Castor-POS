import React, { useState, useEffect, useRef } from "react";
import { 
  Mic, 
  Radio, 
  Volume2, 
  VolumeX, 
  ChevronDown, 
  ChevronUp, 
  Send, 
  Clock, 
  User, 
  HelpCircle,
  AlertTriangle,
  Play,
  Trash2
} from "lucide-react";
import { 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  limit, 
  onSnapshot,
  doc,
  writeBatch,
  setDoc,
  where
} from "firebase/firestore";
import { db } from "../firebase";
import toast from "react-hot-toast";

interface WalkieMessage {
  id: string;
  senderName: string;
  senderRole: string;
  channel: 'general' | 'cocina' | 'parrilla' | 'admin' | string;
  targetId?: string;
  targetType?: 'group' | 'individual';
  type: 'audio' | 'preset';
  audioData?: string; // base64 string
  text: string;
  createdAt: string;
}

interface WalkieTarget {
  id: string;
  name: string;
  type: 'group' | 'individual';
  icon: string;
  roleValue?: string;
}

const WALKIE_TARGETS: WalkieTarget[] = [
  { id: 'all', name: 'Todos', type: 'group', icon: '📢' },
  { id: 'waiter', name: 'Mesero', type: 'individual', icon: '🤵', roleValue: 'waiter' },
  { id: 'kitchen', name: 'Cocinero', type: 'individual', icon: '👨‍🍳', roleValue: 'kitchen' },
  { id: 'parrilla', name: 'Parrillero', type: 'individual', icon: '🥩', roleValue: 'parrilla' },
  { id: 'admin', name: 'Administrador', type: 'individual', icon: '👑', roleValue: 'admin' },
];

interface WalkieTalkieProps {
  posUser?: {
    id?: string;
    name: string;
    role: string;
  } | null;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

// Walkie Talkie Preset Messages
const PRESETS = {
  general: [
    "¡Pedido urgente listo en barra!",
    "¡Por favor reportarse a caja!",
    "¡Atención todo el equipo!",
    "¡Cambio de turno listo!"
  ],
  cocina: [
    "¡Platillo de Cocina listo!",
    "¡Ocupo platos limpios!",
    "¡Falta ingrediente en cocina!",
    "¡Orden saliendo caliente!"
  ],
  parrilla: [
    "¡Cortes listos de Parrilla!",
    "¡Necesito carbón urgente!",
    "¡Parrilla al límite de capacidad!",
    "¡Términos listos en barra!"
  ],
  admin: [
    "¡Favor de cobrar mesa!",
    "¡Cliente pregunta por su pedido!",
    "¡Falta refresco o bebida en barra!",
    "¡Mesa desocupada y limpia!"
  ]
};

const getPresetsForTarget = (targetId: string): string[] => {
  if (targetId === 'cocina' || targetId === 'kitchen' || targetId === 'cocina_group') {
    return PRESETS.cocina;
  }
  if (targetId === 'parrilla' || targetId === 'parrilla_group') {
    return PRESETS.parrilla;
  }
  if (targetId === 'admin' || targetId === 'admin_group') {
    return PRESETS.admin;
  }
  return PRESETS.general;
};

// Helper to synthesize authentic radio beeps using Web Audio API (including Nextel high-pitch double-chirp!)
const playRadioBeep = (type: 'activate' | 'receive' | 'deactivate') => {
  if (typeof window === "undefined") return;
  const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContext) return;

  try {
    const ctx = new AudioContext();
    const now = ctx.currentTime;

    if (type === 'activate') {
      // Un solo bip limpio y de tono medio-agudo al activar (tipo Nextel inicio o radio chirp)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1450, now); // 1450 Hz, agudo y claro
      
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.15, now + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(now);
      osc.stop(now + 0.12);
    } else if (type === 'receive') {
      // Doble bip súper agudo y rápido (¡el clásico chirrido Nextel de recepción!)
      // Primer chirrido
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(1850, now); // 1850 Hz es muy agudo, tipo Nextel
      
      gain1.gain.setValueAtTime(0.001, now);
      gain1.gain.linearRampToValueAtTime(0.2, now + 0.005);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.045);

      // Segundo chirrido inmediato (después de 55ms)
      const start2 = now + 0.055;
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1850, start2);
      
      gain2.gain.setValueAtTime(0.001, start2);
      gain2.gain.linearRampToValueAtTime(0.2, start2 + 0.005);
      gain2.gain.exponentialRampToValueAtTime(0.001, start2 + 0.04);
      
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(start2);
      osc2.stop(start2 + 0.045);
    } else if (type === 'deactivate') {
      // Breve corte de radio / squelch para terminar transmisión de forma realista
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(500, now);
      osc.frequency.exponentialRampToValueAtTime(200, now + 0.06);
      
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(now);
      osc.stop(now + 0.07);
    }
  } catch (e) {
    console.error("Error al reproducir bip sintetizado:", e);
  }
};

export function WalkieTalkie({ posUser, isOpen, setIsOpen }: WalkieTalkieProps) {
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [targetId, setTargetId] = useState<string>('all');
  const [targetType, setTargetType] = useState<'group' | 'individual'>('group');
  const [messages, setMessages] = useState<WalkieMessage[]>([]);
  const [customText, setCustomText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [micPermission, setMicPermission] = useState<'granted' | 'denied' | 'prompt' | 'unsupported'>('prompt');
  const [incomingActive, setIncomingActive] = useState<boolean>(false);
  const [activeSpeaker, setActiveSpeaker] = useState<{ name: string; role: string; text: string } | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [activeOperatorsCount, setActiveOperatorsCount] = useState(0);
  const [signalStrength, setSignalStrength] = useState(4); // 0-4 bars
  const [wakeLock, setWakeLock] = useState<any>(null);
  const [backgroundActive, setBackgroundActive] = useState(false);
  const silentAudioRef = useRef<HTMLAudioElement | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);
  const isFirstLoadRef = useRef(true);
  const playedMessagesRef = useRef<Set<string>>(new Set());

  // Wake Lock implementation to prevent CPU sleep
  const requestWakeLock = async () => {
    if ('wakeLock' in navigator) {
      try {
        const lock = await (navigator as any).wakeLock.request('screen');
        setWakeLock(lock);
        setBackgroundActive(true);

        // Start silent audio loop to keep process alive in background
        if (!silentAudioRef.current) {
          silentAudioRef.current = new Audio('https://www.soundjay.com/buttons/beep-01a.mp3');
          silentAudioRef.current.volume = 0.001;
          silentAudioRef.current.loop = true;
        }
        silentAudioRef.current.play().catch(() => {});

        console.log('Sistema de Radio bloqueó el sueño del dispositivo.');
        
        lock.addEventListener('release', () => {
          setWakeLock(null);
          setBackgroundActive(false);
          console.log('El sistema liberó el bloqueo de sueño.');
        });
      } catch (err) {
        console.warn(`No se pudo activar el modo siempre encendido: ${err}`);
      }
    }
  };

  // Re-request wake lock when app returns to foreground
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && !wakeLock && isOpen) {
        await requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [wakeLock, isOpen]);

  // Sync Wake Lock with isOpen prop
  useEffect(() => {
    if (isOpen) {
      requestWakeLock();
    } else {
      if (wakeLock) {
        wakeLock.release();
        setWakeLock(null);
      }
      if (silentAudioRef.current) {
        silentAudioRef.current.pause();
      }
    }
  }, [isOpen]);

  // Request Notification Permissions on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Set sender identity based on POS user or fallback
  const senderName = posUser?.name || "Personal";
  const senderRole = posUser?.role || "kitchen";

  // Check microphone permissions on mount
  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.enumerateDevices().then(devices => {
        const hasMic = devices.some(d => d.kind === 'audioinput');
        if (!hasMic) {
          setMicPermission('unsupported');
        } else {
          // Check if permission is already granted by querying state
          if (navigator.permissions && navigator.permissions.query) {
            navigator.permissions.query({ name: 'microphone' as any }).then(pStatus => {
              if (pStatus.state === 'granted') {
                setMicPermission('granted');
              } else if (pStatus.state === 'denied') {
                setMicPermission('denied');
              }
            }).catch(() => {});
          }
        }
      }).catch(() => {
        setMicPermission('prompt');
      });
    } else {
      setMicPermission('unsupported');
    }
  }, []);

  // Explicitly request microphone permission
  const requestMicAccess = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicPermission('granted');
      stream.getTracks().forEach(track => track.stop());
      toast.success("¡Micrófono autorizado con éxito!", { icon: "🎤" });
      
      // Play a quick confirmation chime
      if (soundEnabled) {
        playRadioBeep('activate');
      }
    } catch (err) {
      console.warn("Microphone permission denied:", err);
      setMicPermission('denied');
      toast.error("Permiso de micrófono denegado. Configúralo en el candado de tu navegador.");
    }
  };

  // Explicitly test speaker playback (handles Autoplay requirements)
  const testSpeaker = async () => {
    toast.success("Iniciando prueba de audio...", { icon: "🔊" });
    try {
      playRadioBeep('receive');
      
      await new Promise(r => setTimeout(r, 350));
      
      await speakMessage("Prueba de altavoz exitosa. El canal del walkie talkie está activo.");
      
      playRadioBeep('deactivate');
      
      toast.success("¡Altavoz funcionando perfectamente!", { icon: "✅" });
    } catch (err) {
      console.error("Speaker test error:", err);
      toast.error("Error de audio. Haz clic aquí para autorizar el reproductor.");
    }
  };

  // Monitor Online/Offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setSignalStrength(4);
      toast.success("Radio reconectada al sistema.", { id: "radio-online" });
    };
    const handleOffline = () => {
      setIsOnline(false);
      setSignalStrength(0);
      toast.error("Se perdió la señal de radio. Modo Offline.", { id: "radio-offline" });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Presence Heartbeat: Keeps the user "on the air" for others to see
  useEffect(() => {
    const userId = posUser?.id || senderName;
    if (!userId) return;

    const updatePresence = async () => {
      if (!isOnline) return;
      try {
        const presenceRef = doc(db, "radioPresence", userId);
        await setDoc(presenceRef, {
          name: senderName,
          role: senderRole,
          lastSeen: new Date().toISOString(),
          status: 'active'
        }, { merge: true });
      } catch (err) {
        console.warn("Error updating presence:", err);
      }
    };

    updatePresence();
    const interval = setInterval(updatePresence, 20000); // Every 20 seconds

    return () => clearInterval(interval);
  }, [posUser?.id, isOnline, senderName, senderRole]);

  // Monitor Active Operators
  useEffect(() => {
    const q = query(
      collection(db, "radioPresence"),
      where("lastSeen", ">", new Date(Date.now() - 60000).toISOString()) // Active in last minute
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setActiveOperatorsCount(snapshot.size);
    }, (err) => {
      console.warn("Presence listener error:", err);
    });

    return () => unsubscribe();
  }, [isOnline]);

  // Listen for walkie talkie messages in real-time
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    let retryTimeout: number | null = null;

    const setupListener = () => {
      const q = query(
        collection(db, "walkieMessages"),
        orderBy("createdAt", "desc"),
        limit(15)
      );

      unsubscribe = onSnapshot(q, (snapshot) => {
        const fetched: WalkieMessage[] = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as WalkieMessage));

        // Reverse to chronological order for list
        const chronoMessages = [...fetched].reverse();
        setMessages(chronoMessages);

        // On first load, just register existing message IDs as played so they don't blare all at once
        if (isFirstLoadRef.current) {
          chronoMessages.forEach(m => playedMessagesRef.current.add(m.id));
          isFirstLoadRef.current = false;
          return;
        }

        // Check for newly arrived messages
        const latestMsg = fetched[0];
        if (latestMsg && !playedMessagesRef.current.has(latestMsg.id)) {
          playedMessagesRef.current.add(latestMsg.id);
          
          const isFromSelf = latestMsg.senderName === senderName;
          
          const msgTargetId = latestMsg.targetId || latestMsg.channel || 'general';
          const msgTargetType = latestMsg.targetType || 'group';

          const matchesGroup = (id: string) => {
            if (id === 'all' || id === 'general') return true;
            // Match selected group (if we are currently listening/tuned to a group)
            if (targetType === 'group' && (targetId === id || targetId.replace('_group', '') === id.replace('_group', ''))) {
              return true;
            }
            // Default: Cocineros receive Cocina group, Parrilleros receive Parrilla group, Admins receive Admin group
            if ((id === 'cocina_group' || id === 'cocina') && senderRole === 'kitchen') return true;
            if ((id === 'parrilla_group' || id === 'parrilla') && senderRole === 'parrilla') return true;
            if ((id === 'admin_group' || id === 'admin') && senderRole === 'admin') return true;
            return false;
          };

          const matchesIndividual = (id: string) => {
            return id === senderRole;
          };

          const isTargeted = (msgTargetType === 'group' && matchesGroup(msgTargetId)) ||
                             (msgTargetType === 'individual' && matchesIndividual(msgTargetId));

          if (isTargeted && !isFromSelf) {
            handleIncomingMessage(latestMsg);
          }
        }
      }, (error) => {
        console.error("Error fetching walkie-talkie messages:", error);
        // Attempt to reconnect if signal is lost
        if (isOnline) {
          retryTimeout = window.setTimeout(setupListener, 5000);
        }
      });
    };

    setupListener();

    return () => {
      if (unsubscribe) unsubscribe();
      if (retryTimeout) clearTimeout(retryTimeout);
    };
  }, [targetId, targetType, senderName, senderRole, isOnline]);

  // Handle incoming message playback
  const handleIncomingMessage = async (msg: WalkieMessage) => {
    if (!soundEnabled) return;

    setIncomingActive(true);
    setActiveSpeaker({ name: msg.senderName, role: msg.senderRole, text: msg.text });

    // Background notification if app is minimized
    if (document.visibilityState === 'hidden' && 'Notification' in window && Notification.permission === 'granted') {
      const n = new Notification(`Radio: ${msg.senderName}`, {
        body: msg.text,
        icon: '/logo_las_cazuelas_del_castor.jpg',
        tag: 'walkie-talkie',
        silent: false,
        requireInteraction: true // Keep notification until user sees it
      });
      n.onclick = () => { window.focus(); n.close(); };
    }

    try {
      // 1. Play Nextel high-pitch double chirp beep
      playRadioBeep('receive');

      // Snappy short delay after double beep
      await new Promise(r => setTimeout(r, 300));

      // 2. Play actual voice payload or TTS
      if (msg.type === 'audio' && msg.audioData) {
        const voiceAudio = new Audio(msg.audioData);
        voiceAudio.volume = 1.0;
        await voiceAudio.play();
        
        // Wait for audio to finish playing
        await new Promise((resolve) => {
          voiceAudio.onended = resolve;
          // Safety timeout of 8 seconds
          setTimeout(resolve, 8000);
        });
      } else {
        // Use browser text to speech
        await speakMessage(msg.text);
      }

      // 3. Play walkie-talkie closing static click
      playRadioBeep('deactivate');

    } catch (e) {
      console.error("Error playing walkie talkie alert:", e);
    } finally {
      // Small visual delay before turning off receiver lamp
      setTimeout(() => {
        setIncomingActive(false);
        setActiveSpeaker(null);
      }, 1000);
    }
  };

  // Convert text to voice using Speech Synthesis
  const speakMessage = (text: string): Promise<void> => {
    return new Promise((resolve) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        resolve();
        return;
      }

      // Cancel any ongoing speech
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "es-MX";
      utterance.rate = 1.05; // Slightly faster for radio feel
      utterance.pitch = 1.0;

      // Find a premium Spanish voice if possible
      const voices = window.speechSynthesis.getVoices();
      const spanishVoice = voices.find(v => v.lang.startsWith("es-MX") || v.lang.startsWith("es-ES") || v.lang.startsWith("es"));
      if (spanishVoice) {
        utterance.voice = spanishVoice;
      }

      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();

      window.speechSynthesis.speak(utterance);
    });
  };

  // Start Voice Recording
  const startRecording = async () => {
    if (isRecording) return;
    
    // Play local single bip on activation
    if (soundEnabled) {
      playRadioBeep('activate');
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicPermission('granted');
      
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm;codecs=opus' });
        
        // Stop all tracks to release microphone hardware light
        stream.getTracks().forEach(track => track.stop());

        // Process audio to Base64
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64Audio = reader.result as string;
          
          // Verify size under 1MB (usually <100kb for short recording)
          if (base64Audio.length > 900000) {
            toast.error("Audio demasiado largo. Graba mensajes más cortos.");
            return;
          }

          // Save message to Firestore
          await publishMessage({
            senderName,
            senderRole,
            channel: (targetType === 'group' && targetId !== 'general') ? targetId.replace('_group', '') : 'general',
            targetId,
            targetType,
            type: 'audio',
            audioData: base64Audio,
            text: `🎙️ Voz de ${senderName} para ${getTargetLabel(targetId)}`
          });
        };
        reader.readAsDataURL(audioBlob);
      };

      // Start recording
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);

      // Start timer
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingSeconds(prev => {
          if (prev >= 6) { // Max 6 seconds
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);

    } catch (err) {
      console.warn("Microphone access blocked or failed:", err);
      setMicPermission('denied');
      toast.error("Permiso de micrófono denegado. ¡Prueba los mensajes rápidos (TTS)!");
    }
  };

  // Stop Recording
  const stopRecording = () => {
    if (!isRecording) return;

    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    setIsRecording(false);
    
    // Play static end click locally
    if (soundEnabled) {
      playRadioBeep('deactivate');
    }
  };

  // Publish Message to Firestore with Retry Logic
  const publishMessage = async (msgData: Omit<WalkieMessage, 'id' | 'createdAt'>, retries = 3) => {
    if (!isOnline) {
      toast.error("Sin señal. El mensaje se enviará al recuperar conexión.");
      return;
    }

    let attempt = 0;
    while (attempt < retries) {
      try {
        await addDoc(collection(db, "walkieMessages"), {
          ...msgData,
          createdAt: new Date().toISOString()
        });
        return; // Success
      } catch (err) {
        attempt++;
        if (attempt >= retries) {
          console.error("Error saving walkie-talkie message after retries:", err);
          toast.error("Fallo crítico de comunicación. Reintenta en unos momentos.");
        } else {
          console.warn(`Retry attempt ${attempt}...`);
          await new Promise(r => setTimeout(r, 1000 * attempt)); // Exponential backoff
        }
      }
    }
  };

  // Send a quick preset message
  const sendPreset = async (presetText: string) => {
    toast.success(`Emitiendo: "${presetText}"`, { icon: "📻" });
    
    await publishMessage({
      senderName,
      senderRole,
      channel: (targetType === 'group' && targetId !== 'general') ? targetId.replace('_group', '') : 'general',
      targetId,
      targetType,
      type: 'preset',
      text: `¡Atención ${getTargetLabel(targetId)}! ${presetText}`
    });
  };

  // Send custom typed text message
  const sendCustomText = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!customText.trim()) return;

    const textToSend = customText.trim();
    setCustomText('');

    toast.success(`Enviando mensaje de texto...`, { icon: "💬" });

    await publishMessage({
      senderName,
      senderRole,
      channel: (targetType === 'group' && targetId !== 'general') ? targetId.replace('_group', '') : 'general',
      targetId,
      targetType,
      type: 'preset',
      text: `¡Atención ${getTargetLabel(targetId)}! Mensaje de ${senderName}: ${textToSend}`
    });
  };

  // Clear recent communications history
  const clearRecentHistory = async () => {
    if (messages.length === 0) {
      toast.error("El historial ya está vacío.");
      return;
    }
    
    const confirmClear = window.confirm("¿Estás seguro de que deseas limpiar el historial reciente del walkie-talkie para todo el equipo?");
    if (!confirmClear) return;

    try {
      const batch = writeBatch(db);
      messages.forEach((msg) => {
        const docRef = doc(db, "walkieMessages", msg.id);
        batch.delete(docRef);
      });
      await batch.commit();
      toast.success("Historial de walkie-talkie limpiado.", { icon: "🧹" });
    } catch (err) {
      console.error("Error al borrar historial:", err);
      toast.error("No se pudo limpiar el historial.");
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "admin": return "Administrador";
      case "kitchen": return "Cocina";
      case "parrilla": return "Parrilla";
      case "cashier": return "Cajero";
      case "waiter": return "Mesero";
      default: return role;
    }
  };

  const getRoleBg = (role: string) => {
    switch (role) {
      case "admin": return "bg-red-500";
      case "kitchen": return "bg-yellow-500";
      case "parrilla": return "bg-orange-500";
      case "cashier": return "bg-emerald-500";
      default: return "bg-sky-500";
    }
  };

  const getChannelLabel = (ch: string) => {
    switch (ch) {
      case "general": return "📢 GENERAL";
      case "cocina": return "🍳 COCINA";
      case "parrilla": return "🔥 PARRILLA";
      case "admin": return "💼 ADMIN";
      default: return ch;
    }
  };

  const getTargetLabel = (id: string) => {
    switch (id) {
      case "all":
      case "general": return "📢 ENVIAR A TODOS";
      case "cocina_group": return "🍳 GRUPO COCINA";
      case "parrilla_group": return "🔥 GRUPO PARRILLA";
      case "admin_group": return "💼 GRUPO ADMIN";
      case "cashier": return "💵 CAJERO";
      case "waiter": return "🤵 MESERO";
      case "kitchen": return "👨‍🍳 COCINERO";
      case "parrilla": return "🥩 PARRILLERO";
      case "admin": return "👑 ADMINISTRADOR";
      default: return id.toUpperCase();
    }
  };

  return (
    <>
      {/* Floating Walkie Talkie Active Speaker Overlay */}
      {activeSpeaker && (
        <div className="fixed bottom-20 md:bottom-6 left-5 z-[80] flex flex-col items-start gap-2">
          <div className="bg-stone-900 border-2 border-amber-400 text-white p-3 rounded-2xl shadow-2xl max-w-xs md:max-w-md flex flex-col gap-1 items-start text-xs animate-bounce animate-pulse">
            <div className="flex items-center gap-1.5 font-black uppercase text-[10px] text-amber-400">
              <span className="w-2 h-2 rounded-full bg-red-600 animate-ping"></span>
              <span>📻 RECIBIENDO DE {activeSpeaker.name} ({getRoleLabel(activeSpeaker.role)})</span>
            </div>
            <p className="font-extrabold italic text-[11px] text-amber-100">"{activeSpeaker.text}"</p>
          </div>
        </div>
      )}

      {/* Rugged Physical Walkie Talkie Simulator Panel */}
      {isOpen && (
        <div className="fixed bottom-[74px] md:bottom-24 left-4 right-4 md:right-auto md:left-5 z-[90] md:w-72 bg-stone-900 border-4 border-stone-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col border-b-[8px] transform transition-all duration-300 scale-100">
          
          {/* Top Antenna / Volume Knob Representation */}
          <div className="bg-stone-950 px-3 py-1.5 flex items-center justify-between border-b border-stone-800 text-[9px] text-stone-500 font-bold tracking-wider">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-6 bg-stone-800 rounded-t-md mx-auto" title="Antena UHF"></div>
              <span>CAS-500X PRO</span>
              {backgroundActive && (
                <span className="ml-1 px-1 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded text-[7px] animate-pulse">
                  MODO FONDO
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setSoundEnabled(!soundEnabled)} 
                className={`p-1 rounded-md transition-all active:scale-90 ${soundEnabled ? "text-emerald-400 hover:text-emerald-500" : "text-stone-600 hover:text-stone-500"}`}
                title={soundEnabled ? "Silenciar Radio" : "Activar Sonido"}
              >
                {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
              </button>
            </div>
          </div>

          {/* Backlit Display Screen */}
          <div className="m-2 bg-stone-950 border-2 border-stone-800 p-2.5 rounded-xl font-mono text-[10px] text-emerald-400 shadow-inner flex flex-col gap-1 relative overflow-hidden">
            {/* Horizontal scanline simulation */}
            <div className="absolute inset-0 pointer-events-none bg-radial-gradient opacity-10"></div>
            
            <div className="flex items-center justify-between font-black border-b border-emerald-950/40 pb-1">
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${incomingActive ? "bg-red-500 animate-ping" : isRecording ? "bg-red-500 animate-pulse" : !isOnline ? "bg-stone-600" : "bg-emerald-500 animate-pulse"}`}></span>
                <span className="text-stone-300 uppercase text-[8px]">DESTINO:</span>
                <span className="text-white text-[11px] font-bold truncate max-w-[140px]" title={getTargetLabel(targetId)}>{getTargetLabel(targetId)}</span>
              </div>
              <div className="flex items-end gap-0.5 h-3">
                {[1, 2, 3, 4].map(bar => (
                  <div 
                    key={bar} 
                    className={`w-1 rounded-t-[1px] ${bar <= signalStrength ? (isOnline ? "bg-emerald-400" : "bg-amber-600") : "bg-stone-800"}`}
                    style={{ height: `${bar * 25}%` }}
                  />
                ))}
              </div>
            </div>

            {/* Active message display */}
            <div className="bg-emerald-950/30 p-2 rounded text-[10px] text-emerald-300 italic min-h-8 flex items-center justify-center border border-emerald-950/20 text-center font-bold">
              {!isOnline 
                ? "❌ SIN SEÑAL / RECONECTANDO..."
                : incomingActive && activeSpeaker 
                  ? `"${activeSpeaker.text}"`
                  : isRecording 
                    ? `GRABANDO: ${recordingSeconds}s`
                    : `📻 OPERADORES: ${activeOperatorsCount} | LISTO`
              }
            </div>
          </div>

          {/* Rugged Hardware Controls */}
          <div className="px-3 pb-3 flex flex-col gap-2.5">
            
            {/* Target Selector (Simplified to Individuals) */}
            <div className="flex flex-col gap-1.5 bg-stone-950 p-2 rounded-xl border border-stone-850">
              <span className="text-[7px] font-black uppercase text-stone-500 tracking-wider">SELECCIÓN DE CONTACTO:</span>
              <div className="grid grid-cols-5 gap-1.5">
                {WALKIE_TARGETS.map((tgt) => (
                  <button
                    key={tgt.id}
                    onClick={() => {
                      setTargetId(tgt.id);
                      setTargetType(tgt.type);
                    }}
                    className={`py-2 text-[7px] font-black uppercase rounded-lg border transition-all active:scale-95 cursor-pointer flex flex-col items-center justify-center gap-1 ${
                      targetId === tgt.id
                        ? "bg-amber-500 border-amber-400 text-stone-950 shadow-md" 
                        : "bg-stone-900 border-stone-800 text-stone-500 hover:text-stone-300 hover:bg-stone-800"
                    }`}
                  >
                    <span className="text-sm">{tgt.icon}</span>
                    <span className="truncate max-w-full tracking-tighter">{tgt.name.toUpperCase()}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Audio Hardware Activator (Microphone & Speaker) - Very Compact */}
            <div className="bg-stone-950 p-1.5 rounded-xl border border-stone-850 flex gap-2">
              {/* Microphone request */}
              <button
                onClick={requestMicAccess}
                className={`flex-1 py-1.5 text-[8px] font-black uppercase rounded-lg border transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 ${
                  micPermission === "granted"
                    ? "bg-emerald-950/40 border-emerald-800 text-emerald-400"
                    : "bg-stone-850 border-orange-800 text-orange-400"
                }`}
              >
                <Mic size={10} />
                <span>{micPermission === "granted" ? "MIC LISTO" : "ACT MIC"}</span>
              </button>

              {/* Speaker test */}
              <button
                onClick={testSpeaker}
                className="flex-1 py-1.5 text-[8px] font-black uppercase rounded-lg border border-stone-750 bg-stone-850 text-stone-300 hover:bg-stone-800 transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Volume2 size={10} />
                <span>PROBAR AUDIO</span>
              </button>
            </div>

            {/* Single Row Centered Controls */}
            <div className="flex flex-col items-center gap-3 py-2 border-y border-stone-800/80">
              <div className="flex items-center justify-center gap-3 w-full">
                {/* Hold to Talk - Centered and prominent */}
                <button
                  onMouseDown={startRecording}
                  onMouseUp={stopRecording}
                  onMouseLeave={stopRecording}
                  onTouchStart={(e) => { e.preventDefault(); startRecording(); }}
                  onTouchEnd={(e) => { e.preventDefault(); stopRecording(); }}
                  className={`w-16 h-16 rounded-full flex items-center justify-center shadow-xl transition-all active:scale-90 border-4 ${
                    isRecording 
                      ? "bg-red-600 border-red-500 animate-pulse ring-4 ring-red-600/30" 
                      : "bg-amber-500 border-amber-400 text-stone-950"
                  }`}
                >
                  <Mic size={28} strokeWidth={3} className={isRecording ? "text-white" : "text-stone-950"} />
                </button>

                <div className="h-12 w-px bg-stone-800 mx-1" />

                {/* Top 2 Presets in the same row */}
                <div className="flex flex-col gap-1.5 flex-1">
                  {getPresetsForTarget(targetId).slice(0, 2).map((preset, index) => (
                    <button
                      key={index}
                      onClick={() => sendPreset(preset)}
                      className="w-full py-2 bg-stone-800 hover:bg-stone-700 text-white rounded-xl text-[9px] font-black uppercase tracking-tight border border-stone-700 transition-all active:scale-95 flex items-center gap-1.5 px-3"
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      <span className="truncate">{preset}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Text Message Input - Centered Below row */}
              <form onSubmit={sendCustomText} className="flex gap-2 bg-stone-950 p-1.5 rounded-xl border border-stone-850 w-full">
                <input
                  type="text"
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  placeholder={`Voz a ${getTargetLabel(targetId)}...`}
                  className="flex-1 bg-stone-900 border border-stone-800 text-white rounded-lg px-3 py-2 text-[10px] font-bold placeholder-stone-600 focus:outline-none focus:border-amber-500"
                />
                <button
                  type="submit"
                  disabled={!customText.trim()}
                  className="px-4 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-stone-950 font-black rounded-lg text-[10px] flex items-center gap-1 transition-all active:scale-95"
                >
                  <Send size={12} strokeWidth={2.5} />
                  <span>VOZ</span>
                </button>
              </form>
            </div>

            {/* Recent messages log */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-black uppercase text-stone-400 tracking-wider">Comunicaciones Recientes</span>
                {messages.length > 0 && (
                  <button
                    onClick={clearRecentHistory}
                    className="text-[9px] font-black uppercase text-orange-500 hover:text-orange-400 flex items-center gap-1 cursor-pointer transition-colors"
                    title="Limpiar todo el historial reciente de walkie-talkie"
                  >
                    <Trash2 size={9} strokeWidth={2.5} />
                    <span>LIMPIAR</span>
                  </button>
                )}
              </div>
              <div className="bg-stone-950 p-2 rounded-xl max-h-32 overflow-y-auto flex flex-col gap-1.5 border border-stone-850">
                {messages.length === 0 ? (
                  <p className="text-[9px] text-stone-600 text-center font-bold py-2">Sin transmisiones recientes.</p>
                ) : (
                  [...messages].reverse().map((msg) => (
                    <div key={msg.id} className="text-[9px] border-b border-stone-900 pb-1.5 last:border-0 flex flex-col gap-0.5">
                      <div className="flex items-center justify-between font-mono">
                        <span className="text-stone-300 font-bold">
                          {msg.senderName} <span className="text-[8px] text-stone-500">({getRoleLabel(msg.senderRole)})</span>
                        </span>
                        <span className="text-stone-600 font-medium">
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-stone-400">
                        <span className="italic leading-normal font-medium text-stone-400">
                          {msg.text}
                        </span>
                        {msg.type === 'audio' && (
                          <button
                            onClick={() => handleIncomingMessage(msg)}
                            className="p-1 rounded bg-stone-800 hover:bg-stone-700 text-amber-400 active:scale-90 transition-all cursor-pointer flex items-center justify-center"
                            title="Reproducir audio"
                          >
                            <Play size={8} fill="currentColor" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>

          {/* Close Panel Trigger */}
          <button
            onClick={() => setIsOpen(false)}
            className="w-full bg-stone-950 hover:bg-stone-900 border-t border-stone-850 text-stone-400 hover:text-white py-2.5 text-[9px] uppercase font-black tracking-widest cursor-pointer transition-all flex items-center justify-center gap-1"
          >
            <ChevronDown size={14} />
            <span>Ocultar Walkie</span>
          </button>
        </div>
      )}
    </>
  );
}
