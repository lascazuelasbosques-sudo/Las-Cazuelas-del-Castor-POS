import React, { useState, useEffect } from 'react';
import { Usb, Printer, CheckCircle2, AlertTriangle, RefreshCw, X, ExternalLink, PrinterCheck, Zap } from 'lucide-react';
import { 
  connectWebUsbPrinter, 
  disconnectUsbPrinter, 
  getUsbPrinterDiagnostic, 
  printUsbTestTicket,
  autoConnectUsbPrinter,
  reconnectPrinterService,
  UsbPrinterDiagnostic 
} from '../lib/usbPrinter';
import toast from 'react-hot-toast';

interface UsbPrinterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UsbPrinterModal: React.FC<UsbPrinterModalProps> = ({ isOpen, onClose }) => {
  const [testing, setTesting] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [diag, setDiag] = useState<UsbPrinterDiagnostic>({
    connected: false,
    deviceName: 'No conectada',
    connectionType: 'none',
    isIframeRestricted: typeof window !== 'undefined' && window.self !== window.top
  });

  const isIframe = typeof window !== 'undefined' && window.self !== window.top;

  // Realizar test previo y actualización de diagnóstico al abrir
  useEffect(() => {
    if (isOpen) {
      runInitialCheck();
    }
  }, [isOpen]);

  const runInitialCheck = async () => {
    setTesting(true);
    try {
      let current = getUsbPrinterDiagnostic();
      if (!current.connected || current.connectionType === 'none') {
        current = await autoConnectUsbPrinter();
      }
      setDiag(current);
    } catch (e) {
      setDiag(getUsbPrinterDiagnostic());
    } finally {
      setTesting(false);
    }
  };

  const handleReconnect = async () => {
    setReconnecting(true);
    try {
      const res = await reconnectPrinterService();
      setDiag(res);
      toast.success(
        res.connectionType === 'webusb' || res.connectionType === 'webserial'
          ? "¡Impresora USB reconectada correctamente!"
          : "¡Servicio de impresión reconectado (Driver de sistema)!"
      );
    } catch (err: any) {
      toast.error("Error al reconectar puerto de impresión");
    } finally {
      setReconnecting(false);
    }
  };

  const handlePrintTest = async () => {
    setTesting(true);
    try {
      await printUsbTestTicket();
      toast.success("¡Prueba de impresión enviada exitosamente!");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Error al enviar prueba de impresión");
    } finally {
      setTesting(false);
    }
  };

  const handleConnectDirectUsb = async () => {
    setConnecting(true);
    try {
      const res = await connectWebUsbPrinter();
      setDiag(res);
      toast.success(`¡Conectada a ${res.deviceName}!`);
    } catch (err: any) {
      setDiag(getUsbPrinterDiagnostic());
      toast.success("Modo Driver de Impresión activado");
    } finally {
      setConnecting(false);
    }
  };

  const [connecting, setConnecting] = useState(false);

  if (!isOpen) return null;

  const isDirectUsb = diag.connected && (diag.connectionType === 'webusb' || diag.connectionType === 'webserial');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-stone-200">
        
        {/* Encabezado limpio */}
        <div className="p-5 bg-stone-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-mex-gold/20 text-mex-gold">
              <Printer size={22} />
            </div>
            <div>
              <h2 className="text-base font-black tracking-tight">Impresora USB</h2>
              <p className="text-[10px] text-stone-400 font-mono">Formato 52x90mm (Ticket Térmico)</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-stone-400 hover:text-white p-2 rounded-xl transition-colors cursor-pointer bg-transparent border-none"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          
          {/* Alerta si está en Iframe */}
          {isIframe && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-xs text-amber-950 flex items-start gap-2.5">
              <AlertTriangle size={18} className="text-amber-700 shrink-0 mt-0.5" />
              <div className="flex-1 space-y-1">
                <p className="font-bold text-[11px]">Modo Pestaña Directa Recomendado</p>
                <button
                  onClick={() => window.open(window.location.href, '_blank')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-700 hover:bg-amber-800 text-white rounded-xl text-[10px] font-bold transition-all cursor-pointer shadow-xs"
                >
                  <ExternalLink size={12} />
                  Abrir en Pestaña Nueva para USB Directo
                </button>
              </div>
            </div>
          )}

          {/* Tarjeta de Estado Simple con Test Previo */}
          <div className={`p-4 rounded-2xl border flex items-center justify-between transition-all ${
            isDirectUsb 
              ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
              : diag.connected 
                ? 'bg-blue-50 border-blue-200 text-blue-950'
                : 'bg-amber-50 border-amber-200 text-amber-950'
          }`}>
            <div className="flex items-center gap-3">
              {testing ? (
                <RefreshCw size={24} className="animate-spin text-stone-500 shrink-0" />
              ) : isDirectUsb || diag.connected ? (
                <CheckCircle2 size={26} className="text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle size={26} className="text-amber-600 shrink-0" />
              )}
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-stone-500">
                  {testing ? 'Verificando impresora...' : 'Estado de Impresora'}
                </p>
                <p className="text-sm font-black mt-0.5">
                  {testing 
                    ? 'Ejecutando test previo...' 
                    : isDirectUsb 
                      ? `Conectada (${diag.deviceName || 'USB Directo'})`
                      : diag.connected 
                        ? 'Lista (Driver del Sistema)'
                        : 'No Conectada'}
                </p>
              </div>
            </div>
            
            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
              isDirectUsb
                ? 'bg-emerald-200 text-emerald-800'
                : diag.connected
                  ? 'bg-blue-200 text-blue-800'
                  : 'bg-amber-200 text-amber-800'
            }`}>
              {isDirectUsb ? 'Conectada' : diag.connected ? 'Driver Listo' : 'Sin Conexión'}
            </span>
          </div>

          {/* Botones Principales de Acción */}
          <div className="space-y-3 pt-1">
            
            {/* 1. Botón Reconectar */}
            <button
              onClick={handleReconnect}
              disabled={reconnecting || testing}
              className="w-full h-12 px-4 bg-amber-500 hover:bg-amber-600 text-stone-950 font-black text-xs uppercase tracking-wider rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {reconnecting ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  Reconectando...
                </>
              ) : (
                <>
                  <RefreshCw size={16} />
                  Reconectar Impresora
                </>
              )}
            </button>

            {/* 2. Botón Prueba de Impresión */}
            <button
              onClick={handlePrintTest}
              disabled={testing || reconnecting}
              className="w-full h-12 px-4 bg-mex-green hover:bg-mex-green/90 text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {testing ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  Imprimiendo Prueba...
                </>
              ) : (
                <>
                  <PrinterCheck size={18} />
                  Prueba de Impresión (Ticket 52x90mm)
                </>
              )}
            </button>

            {/* 3. Selección Manual de Impresora USB Directa (Si se desea cambiar de cable/puerto) */}
            <button
              onClick={handleConnectDirectUsb}
              disabled={connecting || testing}
              className="w-full py-2.5 px-4 bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-300 font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Usb size={15} className="text-mex-gold" />
              Seleccionar Puerto USB Físico
            </button>
          </div>

        </div>

        {/* Pie de modal */}
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
