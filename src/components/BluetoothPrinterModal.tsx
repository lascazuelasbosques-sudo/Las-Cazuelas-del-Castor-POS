import React, { useState, useEffect } from 'react';
import { Bluetooth, Printer, CheckCircle2, AlertTriangle, RefreshCw, X, Zap, Activity, FileText } from 'lucide-react';
import { 
  connectBluetoothPrinter, 
  disconnectBluetoothPrinter, 
  getPrinterDiagnostic, 
  printTestTicket, 
  printSimpleLineTest,
  BluetoothDiagnostic 
} from '../lib/bluetoothPrinter';
import toast from 'react-hot-toast';

interface BluetoothPrinterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BluetoothPrinterModal: React.FC<BluetoothPrinterModalProps> = ({ isOpen, onClose }) => {
  const [connecting, setConnecting] = useState(false);
  const [diag, setDiag] = useState<BluetoothDiagnostic>({
    connected: false,
    deviceName: 'Desconectada',
    serviceUuid: '',
    characteristicUuid: '',
    writeType: 'unknown',
    isSimulated: false
  });
  const [testing, setTesting] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      setDiag(getPrinterDiagnostic());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConnect = async () => {
    try {
      setConnecting(true);
      const res = await connectBluetoothPrinter();
      setDiag(res);
      toast.success(`¡Conectado a ${res.deviceName}!`);
    } catch (error: any) {
      console.error(error);
      const updated = getPrinterDiagnostic();
      setDiag(updated);
      toast.error(error.message || 'Error al conectar impresora Bluetooth');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnectBluetoothPrinter();
      setDiag(getPrinterDiagnostic());
      toast.success('Impresora desconectada');
    } catch (error: any) {
      toast.error('Error al desconectar');
    }
  };

  const handleQuickTest = async () => {
    try {
      setTesting(true);
      setProgress(50);
      await printSimpleLineTest();
      setProgress(100);
      toast.success('¡Línea de prueba enviada a la impresora!');
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Error al enviar línea a la impresora');
    } finally {
      setTesting(false);
      setTimeout(() => setProgress(null), 1000);
    }
  };

  const handleFullTestPrint = async () => {
    try {
      setTesting(true);
      setProgress(0);
      await printTestTicket((p) => setProgress(p));
      toast.success('¡Ticket de prueba 57mm enviado con éxito!');
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Error al enviar ticket de prueba');
    } finally {
      setTesting(false);
      setTimeout(() => setProgress(null), 1000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-stone-200">
        <div className="p-6 bg-stone-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400">
              <Bluetooth size={24} />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight">Impresora Bluetooth 57mm</h2>
              <p className="text-[10px] text-stone-400 uppercase tracking-widest">Térmica ESC/POS (32 Columnas)</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-stone-400 hover:text-white p-2 rounded-xl transition-colors cursor-pointer bg-transparent border-none"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Status Box */}
          <div className={`p-4 rounded-2xl border flex items-center justify-between ${
            diag.connected 
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
              : 'bg-stone-50 border-stone-200 text-stone-700'
          }`}>
            <div className="flex items-center gap-3">
              {diag.connected ? (
                <CheckCircle2 size={24} className="text-emerald-600 shrink-0" />
              ) : (
                <Printer size={24} className="text-stone-400 shrink-0" />
              )}
              <div>
                <p className="text-xs font-bold uppercase tracking-wider">Dispositivo</p>
                <p className="text-sm font-black mt-0.5">{diag.deviceName}</p>
                {diag.connected && (
                  <p className="text-[10px] text-emerald-700 font-mono mt-0.5">
                    Modo: {diag.writeType === 'writeWithoutResponse' ? 'BLE Rápido (sin ACK)' : 'BLE Estándar'}
                  </p>
                )}
              </div>
            </div>
            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
              diag.connected ? 'bg-emerald-200 text-emerald-800' : 'bg-stone-200 text-stone-600'
            }`}>
              {diag.connected ? 'Conectado' : 'Desconectado'}
            </span>
          </div>

          {/* Diagnostic Info */}
          {diag.connected && (
            <div className="bg-stone-50 border border-stone-200 rounded-2xl p-3 text-[11px] font-mono text-stone-600 space-y-1">
              <div className="flex items-center gap-1.5 text-stone-800 font-bold mb-1">
                <Activity size={13} className="text-amber-600" />
                <span>Canal ESC/POS Activo:</span>
              </div>
              <p className="truncate">Servicio: <span className="text-stone-900 font-bold">{diag.serviceUuid.slice(0, 18)}...</span></p>
              <p className="truncate">Característica: <span className="text-stone-900 font-bold">{diag.characteristicUuid.slice(0, 18)}...</span></p>
            </div>
          )}

          {/* Progress Bar when sending */}
          {progress !== null && (
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3 space-y-1.5">
              <div className="flex justify-between text-xs font-bold text-blue-900">
                <span>Enviando datos en paquetes BLE (20 bytes)...</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-blue-600 h-2 transition-all duration-150 rounded-full" 
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Instructions */}
          {!diag.connected && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-900 space-y-2">
              <div className="flex items-start gap-2">
                <Zap size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Instrucciones para conectar:</p>
                  <ol className="list-decimal list-inside mt-1 space-y-1 text-[11px] text-amber-800/90">
                    <li>Encienda la impresora y verifique que tenga rollo de 57mm.</li>
                    <li>Pulse el botón de abajo y elija su impresora en la lista de Bluetooth.</li>
                    <li>La app detectará automáticamente el canal de escritura térmica (ESC/POS).</li>
                  </ol>
                </div>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="space-y-3">
            {!diag.connected ? (
              <button
                onClick={handleConnect}
                disabled={connecting}
                className="w-full py-3.5 px-4 bg-amber-500 hover:bg-amber-600 text-stone-950 font-black text-xs uppercase tracking-wider rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {connecting ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    Buscando dispositivo Bluetooth...
                  </>
                ) : (
                  <>
                    <Bluetooth size={16} />
                    Vincular Impresora Bluetooth
                  </>
                )}
              </button>
            ) : (
              <div className="space-y-2.5">
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    onClick={handleQuickTest}
                    disabled={testing}
                    className="py-3 px-3 bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-300 font-bold text-[11px] uppercase tracking-wider rounded-2xl transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {testing ? (
                      <RefreshCw size={14} className="animate-spin" />
                    ) : (
                      <Zap size={14} className="text-amber-600" />
                    )}
                    Prueba Rápida (1 Línea)
                  </button>

                  <button
                    onClick={handleFullTestPrint}
                    disabled={testing}
                    className="py-3 px-3 bg-stone-900 hover:bg-stone-800 text-white font-bold text-[11px] uppercase tracking-wider rounded-2xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {testing ? (
                      <RefreshCw size={14} className="animate-spin" />
                    ) : (
                      <Printer size={14} className="text-amber-400" />
                    )}
                    Ticket 57mm Completo
                  </button>
                </div>

                <button
                  onClick={handleDisconnect}
                  className="w-full py-2.5 px-4 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  Desconectar Impresora
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="p-4 bg-stone-50 border-t border-stone-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-white border border-stone-300 text-stone-700 hover:bg-stone-100 text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
