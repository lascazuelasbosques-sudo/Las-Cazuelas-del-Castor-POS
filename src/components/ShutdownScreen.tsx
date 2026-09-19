import React from "react";
import { Power, RotateCcw, ShieldCheck, MonitorOff, ExternalLink } from "lucide-react";
import { Button } from "./Button";

interface ShutdownScreenProps {
  onReboot: () => void;
}

export const ShutdownScreen: React.FC<ShutdownScreenProps> = ({ onReboot }) => {
  const handleCloseWindow = () => {
    try {
      window.close();
    } catch (e) {
      console.log("Could not close window via JS", e);
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] bg-stone-950 text-white flex flex-col items-center justify-center p-6 select-none font-sans">
      {/* Background glow animation */}
      <div className="absolute inset-0 bg-radial from-red-950/40 via-stone-950 to-stone-950 pointer-events-none" />

      <div className="relative max-w-md w-full bg-stone-900/95 border-2 border-stone-800 rounded-3xl p-8 shadow-2xl text-center space-y-6 backdrop-blur-md">
        {/* Power Off Icon Visual */}
        <div className="relative mx-auto w-24 h-24 rounded-full bg-stone-950 border-2 border-red-500/40 flex items-center justify-center shadow-inner group">
          <div className="absolute inset-0 rounded-full bg-red-500/20 animate-ping opacity-75" />
          <Power className="w-12 h-12 text-red-500 transition-transform group-hover:scale-110" />
        </div>

        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-950 border border-red-800 text-red-400 text-xs font-black uppercase tracking-widest">
            <ShieldCheck size={14} />
            Sistema Apagado
          </div>
          <h1 className="text-2xl font-serif font-black tracking-tight text-stone-100">
            Sesión Cerrada con Éxito
          </h1>
          <p className="text-xs text-stone-400 leading-relaxed">
            Todos los pedidos, comandas, caja e historial local han sido resguardados de forma segura.
          </p>
        </div>

        {/* Instructions Box */}
        <div className="bg-stone-950 rounded-2xl p-4 border border-stone-800 text-left space-y-2">
          <div className="flex items-center gap-2 text-stone-300 font-bold text-xs">
            <MonitorOff size={16} className="text-amber-500 shrink-0" />
            <span>Listo para apagar su computadora</span>
          </div>
          <p className="text-[11px] text-stone-400 leading-normal">
            Ya puede presionar el botón físico de encendido/apagado de su computadora o cerrar la ventana del sistema.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="pt-2 space-y-3">
          <Button
            onClick={handleCloseWindow}
            variant="outline"
            className="w-full bg-stone-800 hover:bg-stone-700 text-stone-200 border-stone-700 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <ExternalLink size={16} />
            Cerrar Ventana del Sistema
          </Button>

          <Button
            onClick={onReboot}
            className="w-full bg-mex-green hover:bg-mex-green/90 text-white font-bold py-3 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-mex-green/20 cursor-pointer"
          >
            <RotateCcw size={16} />
            Reiniciar / Volver a Iniciar Sesión
          </Button>
        </div>
      </div>

      {/* Footer Info */}
      <div className="absolute bottom-6 text-[10px] text-stone-600 font-mono tracking-wider uppercase">
        SISTEMA POS CAZUELAS • MODO SEGURO
      </div>
    </div>
  );
};
