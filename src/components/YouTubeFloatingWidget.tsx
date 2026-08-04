import React, { useState, useEffect, useRef } from "react";
import { Youtube, ExternalLink, Pin, PinOff, Move, X, Minus, ChevronUp, ChevronDown, HelpCircle, Info, Sparkles, Check } from "lucide-react";
import { Button } from "./Button";

interface YouTubeFloatingWidgetProps {
  isOpen: boolean;
  onClose: () => void;
}

// Preset popular background video options for easy access
const PRESET_VIDEOS = [
  { id: "5qap5aO4i9A", label: "Lofi Hip Hop Radio" },
  { id: "bclX_9436v8", label: "Música de Restaurante Café" },
  { id: "C3m1HAnU6E4", label: "Música Mexicana Instrumental" },
  { id: "DWcJFNfaw9c", label: "Lofi Chill Beats" }
];

export const YouTubeFloatingWidget: React.FC<YouTubeFloatingWidgetProps> = ({ isOpen, onClose }) => {
  const [videoUrlOrId, setVideoUrlOrId] = useState<string>("5qap5aO4i9A"); // Default lofi
  const [currentVideoId, setCurrentVideoId] = useState<string>("5qap5aO4i9A");
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [isAlwaysOnTop, setIsAlwaysOnTop] = useState<boolean>(true); // Keeps it in-app overlay
  const [showPresets, setShowPresets] = useState<boolean>(false);
  const [showHelp, setShowHelp] = useState<boolean>(false);

  // Dragging state
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 20, y: 80 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStart = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const widgetRef = useRef<HTMLDivElement>(null);

  // Reset coordinates or keep inside bounds on mount or window resize
  useEffect(() => {
    if (isOpen && widgetRef.current) {
      // Position bottom right of container
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const widgetWidth = 380;
      const widgetHeight = isMinimized ? 50 : 340;
      
      setPosition({
        x: Math.max(10, viewportWidth - widgetWidth - 20),
        y: Math.max(10, viewportHeight - widgetHeight - 80)
      });
    }
  }, [isOpen]);

  // Extract YouTube ID from various URL formats
  const extractVideoId = (input: string): string => {
    const trimmed = input.trim();
    if (!trimmed) return "";
    
    // Check if it's already a simple 11-character video ID
    if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
      return trimmed;
    }

    // Try standard YouTube URL matchers
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = trimmed.match(regExp);

    if (match && match[2].length === 11) {
      return match[2];
    }

    // Check for YouTube Shorts
    const shortsRegExp = /\/shorts\/([a-zA-Z0-9_-]{11})/;
    const shortsMatch = trimmed.match(shortsRegExp);
    if (shortsMatch && shortsMatch[1]) {
      return shortsMatch[1];
    }

    return trimmed; // Fallback to raw string
  };

  const handleLoadVideo = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const id = extractVideoId(videoUrlOrId);
    if (id) {
      setCurrentVideoId(id);
      setShowPresets(false);
    }
  };

  // Automatically open external YouTube window with the active account when widget opens
  const hasAutoOpened = useRef<boolean>(false);

  const openExternalYouTubeWindow = () => {
    const targetAccount = "lascazuelasbosques@gmail.com";
    const url = `https://www.youtube.com/?authuser=${targetAccount}`;
    const width = 1000;
    const height = 700;
    const left = (window.screen.width - width) / 2;
    const top = (window.screen.height - height) / 2;
    
    window.open(
      url, 
      "YouTubeActiveAccountWindow", 
      `width=${width},height=${height},top=${top},left=${left},menubar=no,status=no,toolbar=no,location=yes,scrollbars=yes,resizable=yes`
    );
  };

  useEffect(() => {
    if (isOpen && !hasAutoOpened.current) {
      hasAutoOpened.current = true;
      openExternalYouTubeWindow();
    } else if (!isOpen) {
      hasAutoOpened.current = false;
    }
  }, [isOpen]);

  // Dragging event handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only drag on header, not on inputs, buttons or iframe
    if ((e.target as HTMLElement).closest("button") || (e.target as HTMLElement).closest("input")) {
      return;
    }
    
    setIsDragging(true);
    dragStart.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };
    e.preventDefault();
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button") || (e.target as HTMLElement).closest("input")) {
      return;
    }
    
    const touch = e.touches[0];
    setIsDragging(true);
    dragStart.current = {
      x: touch.clientX - position.x,
      y: touch.clientY - position.y
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      
      const newX = e.clientX - dragStart.current.x;
      const newY = e.clientY - dragStart.current.y;
      
      // Keep widget partially within viewport bounds
      const minX = 10;
      const maxX = window.innerWidth - 60;
      const minY = 10;
      const maxY = window.innerHeight - 50;
      
      setPosition({
        x: Math.min(Math.max(minX, newX), maxX),
        y: Math.min(Math.max(minY, newY), maxY)
      });
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging) return;
      if (e.touches.length === 0) return;
      
      const touch = e.touches[0];
      const newX = touch.clientX - dragStart.current.x;
      const newY = touch.clientY - dragStart.current.y;
      
      const minX = 10;
      const maxX = window.innerWidth - 60;
      const minY = 10;
      const maxY = window.innerHeight - 50;
      
      setPosition({
        x: Math.min(Math.max(minX, newX), maxX),
        y: Math.min(Math.max(minY, newY), maxY)
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      window.addEventListener("touchmove", handleTouchMove);
      window.addEventListener("touchend", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleMouseUp);
    };
  }, [isDragging]);

  if (!isOpen) return null;

  return (
    <div
      ref={widgetRef}
      style={{
        position: isAlwaysOnTop ? "fixed" : "absolute",
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: isAlwaysOnTop ? 9999 : 40,
      }}
      className={`w-[360px] md:w-[380px] bg-white border-2 border-stone-800 rounded-xl shadow-2xl overflow-hidden transition-shadow duration-150 select-none ${
        isDragging ? "shadow-stone-500/50 cursor-grabbing border-mex-gold" : "cursor-grab"
      }`}
    >
      {/* Header bar */}
      <div
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        className="bg-stone-900 text-white px-3 py-2 flex items-center justify-between border-b border-stone-800"
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <Move size={14} className="text-stone-400 shrink-0" />
          <Youtube size={16} className="text-red-500 shrink-0 fill-red-500" />
          <span className="text-xs font-black tracking-wider truncate">YOUTUBE POPUP</span>
        </div>
        
        <div className="flex items-center gap-1 shrink-0">
          {/* Always on top toggle icon button */}
          <button
            onClick={() => setIsAlwaysOnTop(!isAlwaysOnTop)}
            className={`p-1 rounded hover:bg-stone-800 transition-colors ${
              isAlwaysOnTop ? "text-mex-gold" : "text-stone-400"
            }`}
            title={isAlwaysOnTop ? "Anclado: Siempre visible sobre la aplicación" : "Flotante básico"}
          >
            {isAlwaysOnTop ? <Pin size={14} className="fill-mex-gold" /> : <PinOff size={14} />}
          </button>

          {/* Minimize button */}
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 rounded hover:bg-stone-800 text-stone-400 hover:text-white transition-colors"
            title={isMinimized ? "Expandir" : "Minimizar"}
          >
            {isMinimized ? <ChevronUp size={14} /> : <Minus size={14} />}
          </button>

          {/* Close button */}
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-red-600 text-stone-400 hover:text-white transition-colors"
            title="Cerrar"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Main player / controls panel */}
      <div className={`transition-all duration-200 ${isMinimized ? "h-0 overflow-hidden" : "p-3 bg-stone-50"}`}>
        
        {/* Active account info bar */}
        <div className="mb-2.5 px-2.5 py-1.5 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-1.5 min-w-0">
            <Youtube size={14} className="text-red-600 shrink-0 fill-red-600" />
            <span className="text-[10px] font-black text-red-900 truncate">lascazuelasbosques@gmail.com</span>
          </div>
          <button
            onClick={openExternalYouTubeWindow}
            className="text-[9px] font-bold text-red-700 hover:text-red-900 underline shrink-0 flex items-center gap-1"
            title="Reabrir ventana externa de YouTube"
          >
            <ExternalLink size={10} /> Reabrir
          </button>
        </div>

        {/* Input to change video/playlist ID */}
        <form onSubmit={handleLoadVideo} className="flex gap-1.5 mb-2.5">
          <input
            type="text"
            placeholder="Pegar enlace o ID de video YouTube..."
            value={videoUrlOrId}
            onChange={(e) => setVideoUrlOrId(e.target.value)}
            className="flex-1 bg-white border-2 border-stone-300 text-stone-800 rounded-lg px-2 py-1 text-xs font-bold outline-none focus:border-stone-800"
          />
          <Button
            type="submit"
            variant="outline"
            className="border-stone-300 hover:bg-stone-200 h-[28px] px-2.5 text-xs font-bold rounded-lg shrink-0"
          >
            Cargar
          </Button>
        </form>

        {/* Quick presets & help toggles */}
        <div className="flex justify-between items-center mb-3">
          <button
            type="button"
            onClick={() => {
              setShowPresets(!showPresets);
              setShowHelp(false);
            }}
            className="text-[10px] text-stone-600 font-black hover:text-stone-900 flex items-center gap-1"
          >
            <Sparkles size={11} className="text-mex-gold fill-mex-gold" />
            {showPresets ? "Ocultar Sugerencias" : "Sugerencias de Música"}
          </button>

          <button
            type="button"
            onClick={() => {
              setShowHelp(!showHelp);
              setShowPresets(false);
            }}
            className="text-[10px] text-stone-600 font-black hover:text-stone-900 flex items-center gap-1"
          >
            <HelpCircle size={11} />
            Ayuda Siempre Al Top
          </button>
        </div>

        {/* Presets lists */}
        {showPresets && (
          <div className="mb-3 p-2 bg-amber-50/50 border-2 border-amber-200 rounded-lg flex flex-col gap-1.5 animate-fadeIn">
            <span className="text-[9px] uppercase font-black text-amber-800">Música de Fondo Recomendada:</span>
            <div className="grid grid-cols-2 gap-1.5">
              {PRESET_VIDEOS.map((vid) => (
                <button
                  key={vid.id}
                  type="button"
                  onClick={() => {
                    setVideoUrlOrId(vid.id);
                    setCurrentVideoId(vid.id);
                  }}
                  className={`px-1.5 py-1 text-[9px] font-bold rounded border text-left flex items-center justify-between ${
                    currentVideoId === vid.id
                      ? "bg-stone-900 text-white border-stone-900"
                      : "bg-white text-stone-700 hover:bg-stone-100 border-stone-200"
                  }`}
                >
                  <span className="truncate mr-1">{vid.label}</span>
                  {currentVideoId === vid.id && <Check size={8} className="text-mex-gold shrink-0" />}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Help panel for always on top */}
        {showHelp && (
          <div className="mb-3 p-2.5 bg-sky-50 border border-sky-200 rounded-lg text-[9px] text-sky-800 leading-normal animate-fadeIn">
            <div className="flex gap-1.5 mb-1 items-center font-black">
              <Info size={12} className="text-sky-600 shrink-0" />
              <span>CÓMO LOGRAR PANTALLA SIEMPRE ARRIBA (OS):</span>
            </div>
            <ul className="list-disc pl-3.5 space-y-1 font-bold">
              <li>
                <strong className="text-sky-950">En la ventana de Youtube:</strong> Haz clic derecho <strong className="text-sky-950">dos veces</strong> seguidas sobre el video de YouTube y selecciona <span className="underline">"Imagen en imagen"</span> (Picture-in-Picture). ¡Flotará en tu escritorio!
              </li>
              <li>
                <strong className="text-sky-950">En Windows:</strong> Si usas PowerToys, presiona <strong className="text-sky-950">Win + Ctrl + T</strong> sobre la ventana externa de YouTube para anclarla permanentemente.
              </li>
              <li>
                <strong className="text-sky-950">En Chrome:</strong> Existen extensiones gratuitas como "Always on Top" o "Keep on Top" en la Chrome Web Store.
              </li>
            </ul>
          </div>
        )}

        {/* YouTube Embedded Player (Safe iFrame with same cookie jar) */}
        {currentVideoId && (
          <div className="aspect-video w-full rounded-lg border-2 border-stone-800 bg-black overflow-hidden shadow-md">
            <iframe
              className="w-full h-full"
              src={`https://www.youtube.com/embed/${currentVideoId}?autoplay=0&mute=0&rel=0&showinfo=0`}
              title="YouTube Integrated Player"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        )}

        {/* Footnote */}
        <div className="mt-2.5 flex items-center justify-between text-[8px] text-stone-400 font-extrabold tracking-wider uppercase">
          <span>Modo Anclado: {isAlwaysOnTop ? "SIEMPRE ARRIBA" : "ESTÁNDAR"}</span>
          <span>Arrastra desde la barra negra</span>
        </div>

      </div>
    </div>
  );
};
