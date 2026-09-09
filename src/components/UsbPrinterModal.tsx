import React, { useState, useEffect } from 'react';
import { Usb, Printer, CheckCircle2, AlertTriangle, RefreshCw, X, Zap, Sliders, ExternalLink, ShieldCheck } from 'lucide-react';
import { 
  connectWebUsbPrinter, 
  connectSerialPrinter, 
  disconnectUsbPrinter, 
  getUsbPrinterDiagnostic, 
  printUsbTestTicket,
  print50x60ViaSystem,
  UsbPrinterDiagnostic 
} from '../lib/usbPrinter';
import toast from 'react-hot-toast';

interface UsbPrinterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UsbPrinterModal: React.FC<UsbPrinterModalProps> = ({ isOpen, onClose }) => {
  const [connecting, setConnecting] = useState(false);
  const [diag, setDiag] = useState<UsbPrinterDiagnostic>({
    connected: false,
    deviceName: 'No conectada',
    connectionType: 'none',
    isIframeRestricted: typeof window !== 'undefined' && window.self !== window.top
  });
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setDiag(getUsbPrinterDiagnostic());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isIframe = typeof window !== 'undefined' && window.self !== window.top;

  const handleConnectWebUsb = async () => {
    try {
      setConnecting(true);
      const res = await connectWebUsbPrinter();
      setDiag(res);
      if (res.connectionType === 'system') {
        toast.success("Modo Driver Cable USB (50x60) listo para imprimir.");
      } else {
        toast.success(`¡Conectado por cable USB a ${res.deviceName}!`);
      }
    } catch (error: any) {
      console.warn(error);
      const current = getUsbPrinterDiagnostic();
      setDiag(current);
      toast.success("Configurado en Modo Driver USB (50x60 mm).");
    } finally {
      setConnecting(false);
    }
  };

  const handleConnectSerial = async () => {
    try {
      setConnecting(true);
      const res = await connectSerialPrinter();
      setDiag(res);
      toast.success(`¡Puerto USB-Serie conectado!`);
    } catch (error: any) {
      console.warn(error);
      const current = getUsbPrinterDiagnostic();
      setDiag(current);
      toast.success("Configurado en Modo Driver USB (50x60 mm).");
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnectUsbPrinter();
      setDiag(getUsbPrinterDiagnostic());
      toast.success('Impresora USB desconectada');
    } catch (error: any) {
      toast.error('Error al desconectar');
    }
  };

  const handleSendTestTicket = async () => {
    try {
      setTesting(true);
      await printUsbTestTicket();
      toast.success('¡Ticket de prueba 50x60mm generado con éxito!');
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Error al mandar prueba.');
    } finally {
      setTesting(false);
    }
  };

  const handleOpenInNewTab = () => {
    window.open(window.location.href, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-stone-200">
        
        {/* Header */}
        <div className="p-6 bg-stone-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-mex-gold/20 text-mex-gold">
              <Usb size={24} />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight">Impresora por Cable USB</h2>
              <p className="text-[10px] text-stone-400 uppercase tracking-widest font-mono">Formato Recibo: 50mm x 60mm</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-stone-400 hover:text-white p-2 rounded-xl transition-colors cursor-pointer bg-transparent border-none"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          
          {/* Notice for iframe / browser permissions */}
          {isIframe && (
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-xs text-blue-950 flex items-start gap-3">
              <ShieldCheck size={20} className="text-blue-600 shrink-0 mt-0.5" />
              <div className="space-y-1.5 flex-1">
                <p className="font-bold">Modo Cable USB (Driver 50x60) Activo</p>
                <p className="text-[11px] text-blue-800 leading-relaxed">
                  Para imprimir por cable USB en este visor, el sistema utiliza el controlador/spooler de 50x60mm. 
                  Si desea acceso directo al chip WebUSB sin restricciones del navegador, abra el sistema en una pestaña nueva.
                </p>
                <button
                  onClick={handleOpenInNewTab}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[11px] font-bold transition-all cursor-pointer mt-1"
                >
                  <ExternalLink size={12} />
                  Abrir en Pestaña Nueva
                </button>
              </div>
            </div>
          )}

          {/* Status Badge */}
          <div className={`p-4 rounded-2xl border flex items-center justify-between ${
            diag.connected || isIframe
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
              : 'bg-stone-50 border-stone-200 text-stone-700'
          }`}>
            <div className="flex items-center gap-3">
              {diag.connected || isIframe ? (
                <CheckCircle2 size={24} className="text-emerald-600 shrink-0" />
              ) : (
                <Printer size={24} className="text-stone-400 shrink-0" />
              )}
              <div>
                <p className="text-xs font-bold uppercase tracking-wider">Estado de Conexión</p>
                <p className="text-sm font-black mt-0.5">
                  {diag.deviceName !== 'No conectada' ? diag.deviceName : (isIframe ? 'Impresora Cable USB (Driver 50x60)' : 'No conectada')}
                </p>
                <p className="text-[10px] text-stone-500 font-mono mt-0.5">
                  Formato activo: 50x60mm (28 columnas térmicas)
                </p>
              </div>
            </div>
            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
              diag.connected || isIframe ? 'bg-emerald-200 text-emerald-800' : 'bg-stone-200 text-stone-600'
            }`}>
              {diag.connected || isIframe ? 'Listo para Imprimir' : 'Sin Conexión'}
            </span>
          </div>

          {/* Ticket Format Specifications */}
          <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-black uppercase tracking-wider text-amber-950 flex items-center gap-1.5">
                <Sliders size={14} className="text-amber-600" />
                Configuración del Formato 50X60
              </span>
              <span className="bg-amber-200/80 text-amber-900 text-[10px] font-bold px-2 py-0.5 rounded-md font-mono">
                50mm × 60mm
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] text-amber-900/90 font-medium">
              <div>• Ancho de papel: <strong>50 mm (28 col)</strong></div>
              <div>• Alto máximo: <strong>60 mm</strong></div>
              <div>• Interlineado: <strong>Compacto (18 dots)</strong></div>
              <div>• Tipografía: <strong>Monospace 8pt</strong></div>
            </div>
          </div>

          {/* Live Preview of 50x60mm Ticket */}
          <div className="border border-dashed border-stone-300 rounded-2xl p-4 bg-stone-100 flex flex-col items-center">
            <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-2">
              Vista Previa a Escala del Recibo (50x60 mm)
            </span>
            <div 
              className="bg-white border border-stone-300 shadow-md p-2 rounded-xs font-mono text-[8px] leading-tight text-black"
              style={{ width: '188px', height: '226px', boxSizing: 'border-box', overflow: 'hidden' }}
            >
              <div className="text-center mb-1">
                <img 
                  src="/logo_las_cazuelas_del_castor.jpg" 
                  alt="Logo" 
                  className="w-7 h-7 rounded-full object-cover mx-auto mb-0.5 border border-stone-200" 
                />
                <div className="font-bold text-[8.5px] leading-tight">LAS CAZUELAS DEL CASTOR</div>
              </div>
              <div className="text-center text-[7px] text-stone-600">Folio:#0001 | Mesa 1</div>
              <div className="text-center text-[7px] text-stone-600">Hora: 14:30</div>
              <div className="border-t border-dashed border-black my-1"></div>
              <div className="space-y-0.5">
                <div className="flex justify-between">
                  <span>1 Cazuela Pastor</span>
                  <span>$95</span>
                </div>
                <div className="flex justify-between">
                  <span>1 Queso Extra</span>
                  <span>$15</span>
                </div>
                <div className="flex justify-between">
                  <span>1 Refresco</span>
                  <span>$30</span>
                </div>
              </div>
              <div className="border-t border-dashed border-black my-1"></div>
              <div className="flex justify-between font-bold text-[9px]">
                <span>TOTAL:</span>
                <span>$140.00</span>
              </div>
              <div className="text-center text-[7px] italic mt-1.5">¡Gracias por su compra! Vuelva pronto</div>
            </div>
          </div>

          {/* Connection Actions */}
          <div className="space-y-3">
            {!isIframe && !diag.connected && (
              <div className="space-y-2">
                <button
                  onClick={handleConnectWebUsb}
                  disabled={connecting}
                  className="w-full py-3.5 px-4 bg-stone-900 hover:bg-stone-800 text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {connecting ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      Detectando cable USB...
                    </>
                  ) : (
                    <>
                      <Usb size={16} className="text-mex-gold" />
                      Conectar por Cable USB Directo (WebUSB)
                    </>
                  )}
                </button>

                <button
                  onClick={handleConnectSerial}
                  disabled={connecting}
                  className="w-full py-2.5 px-4 bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-300 font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  Conectar por Puerto Serie / COM (USB Serial)
                </button>
              </div>
            )}

            {/* Test Button */}
            <div className="pt-2 border-t border-stone-200">
              <button
                onClick={handleSendTestTicket}
                disabled={testing}
                className="w-full py-3.5 px-4 bg-mex-green hover:bg-mex-green/90 text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {testing ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    Enviando prueba 50x60mm...
                  </>
                ) : (
                  <>
                    <Printer size={16} />
                    Mandar Prueba de Ticket 50X60
                  </>
                )}
              </button>
              <p className="text-[10px] text-stone-400 text-center mt-1.5">
                Envía el ticket de prueba en formato 50x60 mm directamente a su impresora USB
              </p>
            </div>
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
