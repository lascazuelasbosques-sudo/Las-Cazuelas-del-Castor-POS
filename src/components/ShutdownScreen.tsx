import React, { useState } from "react";
import { Power, RotateCcw, ShieldCheck, MonitorOff, ExternalLink, Terminal, RefreshCw, CheckCircle2 } from "lucide-react";
import { Button } from "./Button";
import toast from "react-hot-toast";

interface ShutdownScreenProps {
  onReboot: () => void;
}

export const ShutdownScreen: React.FC<ShutdownScreenProps> = ({ onReboot }) => {
  const [shuttingDown, setShuttingDown] = useState(false);
  const [shutdownSent, setShutdownSent] = useState(false);

  const handleCloseWindow = () => {
    try {
      window.close();
    } catch (e) {
      console.log("Could not close window via JS", e);
    }
  };

  const handleDirectLinuxShutdown = async () => {
    setShuttingDown(true);
    try {
      const res = await fetch("/api/system/shutdown", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (data.success) {
        setShutdownSent(true);
        toast.success("Comando de apagado enviado a Linux Mint");
      } else {
        toast.error("No se pudo apagar automáticamente desde el navegador");
      }
    } catch (e) {
      console.warn("Shutdown request error:", e);
      toast.error("Comando enviado. Si no apaga, usa el botón físico de la PC.");
    } finally {
      setShuttingDown(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] bg-stone-950 text-white flex flex-col items-center justify-center p-6 select-none font-sans overflow-y-auto">
      {/* Background glow animation */}
      <div className="absolute inset-0 bg-radial from-red-950/40 via-stone-950 to-stone-950 pointer-events-none" />

      <div className="relative max-w-md w-full bg-stone-900/95 border-2 border-stone-800 rounded-3xl p-7 shadow-2xl text-center space-y-5 backdrop-blur-md my-auto">
        {/* Power Off Icon Visual */}
        <div className="relative mx-auto w-20 h-20 rounded-full bg-stone-950 border-2 border-red-500/40 flex items-center justify-center shadow-inner group">
          <div className="absolute inset-0 rounded-full bg-red-500/20 animate-ping opacity-75" />
          <Power className="w-10 h-10 text-red-500 transition-transform group-hover:scale-110" />
        </div>

        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-950 border border-red-800 text-red-400 text-[11px] font-black uppercase tracking-widest">
            <ShieldCheck size={14} />
            Datos Guardados con Éxito
          </div>
          <h1 className="text-2xl font-serif font-black tracking-tight text-stone-100">
            Apagado del Sistema
          </h1>
          <p className="text-xs text-stone-400 leading-relaxed">
            Todos los pedidos, comandas, caja e historial local han sido resguardados en Linux Mint.
          </p>
        </div>

        {/* Linux Mint direct trigger button */}
        <div className="space-y-2">
          <Button
            onClick={handleDirectLinuxShutdown}
            disabled={shuttingDown}
            className="w-full h-12 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-red-900/40 cursor-pointer border-none"
          >
            {shuttingDown ? (
              <RefreshCw className="animate-spin" size={16} />
            ) : shutdownSent ? (
              <CheckCircle2 size={16} className="text-mex-green" />
            ) : (
              <Power size={16} />
            )}
            {shutdownSent ? "Comando de Apagado Enviado" : "Apagar Computadora Ahora"}
          </Button>
        </div>

        {/* Instructions Box for Linux Mint */}
        <div className="bg-stone-950 rounded-2xl p-4 border border-stone-800 text-left space-y-2">
          <div className="flex items-center gap-2 text-stone-300 font-bold text-xs">
            <MonitorOff size={15} className="text-amber-500 shrink-0" />
            <span>Opciones de apagado en Linux Mint:</span>
          </div>
          <ul className="text-[11px] text-stone-400 space-y-1.5 list-disc pl-4 font-medium">
            <li>Presiona el <strong>botón físico de encendido</strong> de tu gabinete/laptop.</li>
            <li>O presiona en el menú de Linux Mint: <strong>Inicio ➔ Apagar</strong>.</li>
            <li className="font-mono text-[10px] text-stone-300">
              En terminal: <code className="bg-stone-800 px-1 py-0.5 rounded text-red-400">sudo poweroff</code>
            </li>
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="pt-1 space-y-2">
          <Button
            onClick={handleCloseWindow}
            variant="outline"
            className="w-full bg-stone-800 hover:bg-stone-700 text-stone-200 border-stone-700 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <ExternalLink size={14} />
            Cerrar Ventana del Navegador
          </Button>

          <Button
            onClick={onReboot}
            className="w-full bg-mex-green hover:bg-mex-green/90 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 shadow-md shadow-mex-green/20 cursor-pointer"
          >
            <RotateCcw size={14} />
            Volver al Inicio de Sesión
          </Button>
        </div>
      </div>

      {/* Footer Info */}
      <div className="absolute bottom-4 text-[9px] text-stone-600 font-mono tracking-wider uppercase">
        SISTEMA POS CAZUELAS • LINUX MINT / COMPATIBLE
      </div>
    </div>
  );
};
