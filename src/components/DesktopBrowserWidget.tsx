import React, { useState, useEffect, useRef } from 'react';
import { Globe, Minus, Square, Maximize2, X, RotateCw, ExternalLink, Search, ShieldCheck, GripHorizontal, Move } from 'lucide-react';

interface DesktopBrowserWidgetProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

const DEFAULT_BOOKMARKS = [
  { name: 'Google', url: 'https://www.google.com/search?igu=1' },
  { name: 'WhatsApp Web', url: 'https://web.whatsapp.com' },
  { name: 'Google Maps', url: 'https://www.google.com/maps' },
  { name: 'SAT', url: 'https://www.sat.gob.mx' },
  { name: 'Calculadora Online', url: 'https://www.google.com/search?q=calculadora&igu=1' },
];

export const DesktopBrowserWidget: React.FC<DesktopBrowserWidgetProps> = ({
  isOpen,
  setIsOpen,
}) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [url, setUrl] = useState('https://www.google.com/search?igu=1');
  const [inputUrl, setInputUrl] = useState('https://www.google.com/search?igu=1');
  const [iframeKey, setIframeKey] = useState(0);

  // Window position & size states
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [size, setSize] = useState<{ width: number; height: number }>({
    width: Math.min(840, typeof window !== 'undefined' ? window.innerWidth - 32 : 840),
    height: Math.min(600, typeof window !== 'undefined' ? window.innerHeight - 80 : 600),
  });

  // Dragging and Resizing flags & refs
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; posX: number; posY: number }>({ x: 0, y: 0, posX: 0, posY: 0 });
  const resizeStartRef = useRef<{ x: number; y: number; startW: number; startH: number }>({ x: 0, y: 0, startW: 0, startH: 0 });

  // Initialize default position centered or top-right on desktop
  useEffect(() => {
    if (typeof window !== 'undefined' && position === null) {
      const defaultW = Math.min(840, window.innerWidth - 32);
      const defaultH = Math.min(600, window.innerHeight - 80);
      const initialX = Math.max(16, window.innerWidth - defaultW - 24);
      const initialY = Math.max(16, (window.innerHeight - defaultH) / 2);
      setPosition({ x: initialX, y: initialY });
      setSize({ width: defaultW, height: defaultH });
    }
  }, [position]);

  // Handle Dragging
  const handleMouseDownDrag = (e: React.MouseEvent) => {
    if (isMaximized) return;
    // Prevent drag if clicking on buttons or inputs
    if ((e.target as HTMLElement).closest('button, input, form')) return;
    
    setIsDragging(true);
    const currentX = position ? position.x : 20;
    const currentY = position ? position.y : 20;
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      posX: currentX,
      posY: currentY,
    };
  };

  // Handle Resizing
  const handleMouseDownResize = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (isMaximized) return;
    
    setIsResizing(true);
    resizeStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      startW: size.width,
      startH: size.height,
    };
  };

  // Attach window mousemove and mouseup listeners
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const deltaX = e.clientX - dragStartRef.current.x;
        const deltaY = e.clientY - dragStartRef.current.y;
        
        const maxX = window.innerWidth - 100;
        const maxY = window.innerHeight - 80;
        
        const newX = Math.max(-200, Math.min(maxX, dragStartRef.current.posX + deltaX));
        const newY = Math.max(0, Math.min(maxY, dragStartRef.current.posY + deltaY));
        
        setPosition({ x: newX, y: newY });
      }

      if (isResizing) {
        const deltaX = e.clientX - resizeStartRef.current.x;
        const deltaY = e.clientY - resizeStartRef.current.y;

        const newW = Math.max(360, Math.min(window.innerWidth - 16, resizeStartRef.current.startW + deltaX));
        const newH = Math.max(280, Math.min(window.innerHeight - 16, resizeStartRef.current.startH + deltaY));

        setSize({ width: newW, height: newH });
      }
    };

    const handleMouseUp = () => {
      if (isDragging) setIsDragging(false);
      if (isResizing) setIsResizing(false);
    };

    if (isDragging || isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing]);

  if (!isOpen) return null;

  const handleNavigate = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    let finalUrl = inputUrl.trim();
    if (!finalUrl) return;

    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
      if (finalUrl.includes('.') && !finalUrl.includes(' ')) {
        finalUrl = 'https://' + finalUrl;
      } else {
        finalUrl = `https://www.google.com/search?q=${encodeURIComponent(finalUrl)}&igu=1`;
      }
    }
    setUrl(finalUrl);
    setInputUrl(finalUrl);
    setIframeKey(prev => prev + 1);
  };

  const loadBookmark = (bUrl: string) => {
    setUrl(bUrl);
    setInputUrl(bUrl);
    setIframeKey(prev => prev + 1);
  };

  // Minimized Floating Access Launcher
  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-20 z-50 animate-in fade-in slide-in-from-bottom-3 duration-200">
        <div className="bg-stone-900/95 text-white border-2 border-amber-500/80 rounded-2xl p-1.5 shadow-2xl flex items-center gap-2 backdrop-blur-md hover:scale-105 transition-all">
          <button
            onClick={() => setIsMinimized(false)}
            className="flex items-center gap-2.5 px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-amber-400 font-bold text-xs rounded-xl transition-all cursor-pointer"
            title="Maximizar Ventana de Navegador Web"
          >
            <Globe size={16} className="animate-spin-slow text-amber-400" />
            <span className="truncate max-w-[150px]">Navegador Activo</span>
            <span className="bg-amber-500 text-stone-950 text-[9px] px-1.5 py-0.2 rounded-md font-black uppercase">
              Minimizado
            </span>
          </button>

          <button
            onClick={() => setIsMinimized(false)}
            className="p-1.5 hover:bg-stone-800 text-stone-300 hover:text-white rounded-lg transition-colors cursor-pointer"
            title="Restaurar Tamaño"
          >
            <Maximize2 size={14} />
          </button>

          <button
            onClick={() => setIsOpen(false)}
            className="p-1.5 hover:bg-red-900/80 text-stone-400 hover:text-red-200 rounded-lg transition-colors cursor-pointer"
            title="Cerrar Navegador"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    );
  }

  // Active Window Position & Size styles
  const windowStyle: React.CSSProperties = isMaximized
    ? {
        position: 'fixed',
        top: '1rem',
        left: '1rem',
        right: '1rem',
        bottom: '1rem',
        width: 'calc(100vw - 2rem)',
        height: 'calc(100vh - 2rem)',
      }
    : {
        position: 'fixed',
        top: position ? `${position.y}px` : '4rem',
        left: position ? `${position.x}px` : 'auto',
        right: position ? 'auto' : '2rem',
        width: `${size.width}px`,
        height: `${size.height}px`,
      };

  return (
    <div
      style={windowStyle}
      className={`z-50 flex flex-col bg-stone-900 text-white rounded-2xl shadow-2xl border border-stone-700/80 overflow-hidden select-none transition-shadow ${
        isDragging ? 'shadow-amber-500/20 border-amber-500/60' : ''
      }`}
    >
      {/* Window Titlebar (Draggable Handle) */}
      <div
        onMouseDown={handleMouseDownDrag}
        className={`bg-stone-950 px-3 py-2 border-b border-stone-800 flex items-center justify-between shrink-0 ${
          isMaximized ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'
        }`}
      >
        <div className="flex items-center gap-2">
          <GripHorizontal size={16} className="text-stone-500 hover:text-amber-400" />
          <div className="p-1 bg-amber-500/10 text-amber-400 rounded-lg border border-amber-500/20">
            <Globe size={15} />
          </div>
          <div>
            <span className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              Navegador Web PC
              <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[8px] px-1.5 py-0.2 rounded font-bold hidden sm:inline-block">
                Arrastra para Mover
              </span>
            </span>
          </div>
        </div>

        {/* Window Action Controls */}
        <div className="flex items-center gap-1" onMouseDown={(e) => e.stopPropagation()}>
          <button
            onClick={() => window.open(url, '_blank')}
            className="p-1.5 hover:bg-stone-800 text-stone-400 hover:text-stone-200 rounded-lg text-xs flex items-center gap-1 transition-colors cursor-pointer mr-1"
            title="Abrir en pestaña nueva del sistema"
          >
            <ExternalLink size={13} />
            <span className="hidden sm:inline text-[10px] font-bold">Pestaña Nueva</span>
          </button>

          <button
            onClick={() => setIsMinimized(true)}
            className="p-1.5 hover:bg-stone-800 text-stone-300 hover:text-amber-400 rounded-lg transition-colors cursor-pointer"
            title="Minimizar Navegador"
          >
            <Minus size={15} />
          </button>

          <button
            onClick={() => setIsMaximized(!isMaximized)}
            className="p-1.5 hover:bg-stone-800 text-stone-300 hover:text-amber-400 rounded-lg transition-colors cursor-pointer"
            title={isMaximized ? "Restaurar tamaño" : "Maximizar a pantalla completa"}
          >
            {isMaximized ? <Square size={13} className="scale-90" /> : <Maximize2 size={13} />}
          </button>

          <button
            onClick={() => setIsOpen(false)}
            className="p-1.5 hover:bg-rose-900/80 text-stone-300 hover:text-rose-200 rounded-lg transition-colors cursor-pointer ml-1"
            title="Cerrar Navegador"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Browser Toolbar */}
      <div className="bg-stone-900 p-2 border-b border-stone-800 flex flex-col gap-2 shrink-0">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setIframeKey(prev => prev + 1)}
            className="p-1.5 bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-amber-400 rounded-lg transition-colors cursor-pointer"
            title="Recargar página"
          >
            <RotateCw size={14} />
          </button>

          <form onSubmit={handleNavigate} className="flex-1 flex items-center gap-1 bg-stone-950 border border-stone-700/80 rounded-xl px-2.5 py-1">
            <Search size={13} className="text-stone-400 shrink-0" />
            <input
              type="text"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              placeholder="Escribe una URL o buscar en Google..."
              className="w-full bg-transparent text-xs text-stone-200 placeholder-stone-500 focus:outline-hidden py-1 select-text"
            />
            <button type="submit" className="p-1 text-xs bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold px-2 rounded-lg transition-colors shrink-0">
              Ir
            </button>
          </form>

          <button
            onClick={() => window.open(url, '_blank')}
            className="p-1.5 bg-stone-800 hover:bg-stone-700 text-amber-400 rounded-lg transition-colors cursor-pointer"
            title="Abrir URL directamente en el navegador"
          >
            <ExternalLink size={14} />
          </button>
        </div>

        {/* Quick Bookmarks */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
          <span className="text-[10px] font-bold text-stone-500 uppercase shrink-0">Accesos:</span>
          {DEFAULT_BOOKMARKS.map((b) => (
            <button
              key={b.name}
              onClick={() => loadBookmark(b.url)}
              className="text-[10px] font-semibold bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-amber-300 px-2 py-0.5 rounded-lg transition-colors whitespace-nowrap shrink-0 border border-stone-700/50 cursor-pointer"
            >
              {b.name}
            </button>
          ))}
        </div>
      </div>

      {/* Browser Frame */}
      <div className="flex-1 bg-white relative overflow-hidden">
        {/* Transparent overlay during dragging or resizing so iframe doesn't intercept mouse events */}
        {(isDragging || isResizing) && (
          <div className="absolute inset-0 bg-transparent z-50 cursor-move" />
        )}

        <iframe
          key={iframeKey}
          src={url}
          className="w-full h-full border-none"
          title="Navegador Integrado PC"
          sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-modals"
        />
      </div>

      {/* Footer Info & Resizer Handle */}
      <div className="bg-stone-950 px-3 py-1.5 border-t border-stone-800 flex items-center justify-between text-[10px] text-stone-400 shrink-0 relative">
        <div className="flex items-center gap-1 text-stone-400">
          <ShieldCheck size={12} className="text-emerald-400 shrink-0" />
          <span className="truncate max-w-[280px]">Página activa: {url}</span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => window.open(url, '_blank')}
            className="text-amber-400 hover:underline font-bold"
          >
            Abrir ventana externa ↗
          </button>

          {!isMaximized && (
            <div
              onMouseDown={handleMouseDownResize}
              className="w-4 h-4 text-stone-500 hover:text-amber-400 cursor-se-resize flex items-center justify-center -mr-1"
              title="Arrastra para redimensionar la ventana"
            >
              <Move size={12} className="rotate-45" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

