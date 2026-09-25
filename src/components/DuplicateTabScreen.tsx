import React from 'react';
import { AlertTriangle, Layers, RefreshCw, XCircle } from 'lucide-react';
import { Button } from './Button';

interface DuplicateTabScreenProps {
  onForceTakeover?: () => void;
}

export const DuplicateTabScreen: React.FC<DuplicateTabScreenProps> = ({ onForceTakeover }) => {
  return (
    <div className="fixed inset-0 z-[99999] bg-stone-950 flex items-center justify-center p-4 select-none">
      <div className="bg-stone-900 border-2 border-red-500/40 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
        <div className="w-20 h-20 mx-auto rounded-full bg-red-950/60 border-2 border-red-500/50 flex items-center justify-center text-red-400 shadow-inner shadow-red-950">
          <Layers className="w-10 h-10 animate-pulse text-red-400" />
        </div>

        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-950/80 border border-red-500/30 text-red-400 text-xs font-black tracking-wider uppercase">
            <AlertTriangle className="w-3.5 h-3.5" />
            Acceso Restringido por Seguridad
          </div>
          <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">
            Ventana Duplicada Detectada
          </h2>
          <p className="text-sm text-stone-300 leading-relaxed">
            Por política de seguridad y consistencia de caja, <strong className="text-amber-400">solo se permite 1 ventana abierta</strong> de la aplicación en este dispositivo.
          </p>
          <p className="text-xs text-stone-400">
            Cierra esta pestaña y continúa trabajando en la ventana original, o toma el control en esta ventana.
          </p>
        </div>

        <div className="pt-2 flex flex-col gap-2.5">
          {onForceTakeover && (
            <Button
              onClick={onForceTakeover}
              className="w-full bg-gradient-to-r from-mex-red to-amber-700 hover:from-mex-red/90 hover:to-amber-600 text-white font-black py-3 rounded-xl shadow-lg border border-red-400/30 flex items-center justify-center gap-2 text-sm uppercase tracking-wider"
            >
              <RefreshCw className="w-4 h-4" />
              Usar en esta ventana
            </Button>
          )}

          <Button
            variant="outline"
            onClick={() => {
              window.close();
              // If window.close is blocked by browser policy:
              setTimeout(() => {
                location.reload();
              }, 300);
            }}
            className="w-full border-stone-700 hover:bg-stone-800 text-stone-300 font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2"
          >
            <XCircle className="w-4 h-4 text-stone-400" />
            Cerrar esta pestaña
          </Button>
        </div>

        <div className="text-[11px] text-stone-500 font-mono">
          ID de Seguridad: POS-SINGLE-INSTANCE-GUARD
        </div>
      </div>
    </div>
  );
};
