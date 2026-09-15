import React, { useState } from 'react';
import { HelpCircle, X, BookOpen, ShieldCheck, Sparkles, Printer, Utensils, CreditCard, MessageSquare, ChefHat, Settings, Wifi, Calendar, User, Code2 } from 'lucide-react';

interface HelpManualModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpManualModal: React.FC<HelpManualModalProps> = ({ isOpen, onClose }) => {
  const [activeSection, setActiveSection] = useState<'info' | 'manual' | 'hardware'>('manual');

  if (!isOpen) return null;

  const lastUpdateDate = "15 de Septiembre de 2026";

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden text-stone-800 animate-scaleUp">
        
        {/* Header Modal */}
        <div className="bg-stone-900 text-white p-4 sm:p-5 flex items-center justify-between border-b border-stone-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-mex-gold/20 text-mex-gold rounded-xl border border-mex-gold/30">
              <HelpCircle size={26} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-bold font-serif text-white tracking-wide">
                  Manual de Operación & Ayuda
                </h2>
                <span className="bg-mex-green text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                  v2.0
                </span>
              </div>
              <p className="text-xs text-stone-400">
                Sistema de Punto de Venta Cazuelas Para Llevar
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-white hover:bg-stone-800 rounded-xl transition-colors cursor-pointer"
            title="Cerrar ventana"
          >
            <X size={22} />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="bg-stone-100 p-2 flex gap-2 border-b border-stone-200 shrink-0">
          <button
            onClick={() => setActiveSection('manual')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeSection === 'manual'
                ? 'bg-white text-stone-900 shadow-sm border border-stone-200'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/60'
            }`}
          >
            <BookOpen size={16} className="text-mex-green" />
            <span>Manual de Operación</span>
          </button>
          <button
            onClick={() => setActiveSection('hardware')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeSection === 'hardware'
                ? 'bg-white text-stone-900 shadow-sm border border-stone-200'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/60'
            }`}
          >
            <Printer size={16} className="text-amber-600" />
            <span>Impresión & Red</span>
          </button>
          <button
            onClick={() => setActiveSection('info')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeSection === 'info'
                ? 'bg-white text-stone-900 shadow-sm border border-stone-200'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/60'
            }`}
          >
            <Sparkles size={16} className="text-mex-gold" />
            <span>Acerca del Sistema</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 text-sm custom-scrollbar">
          
          {/* Section: Manual de Operación */}
          {activeSection === 'manual' && (
            <div className="space-y-6">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-900">
                <h3 className="font-bold text-amber-950 flex items-center gap-2 text-base mb-1">
                  <BookOpen size={18} className="text-amber-700" />
                  Guía Rápida de Uso del Sistema v2.0
                </h3>
                <p className="text-xs text-amber-800 leading-relaxed">
                  El sistema está estructurado por módulos según su rol de usuario (Administrador, Cajero, Mesero, Cocina).
                </p>
              </div>

              {/* Módulo 1 */}
              <div className="border border-stone-200 rounded-xl p-4 bg-stone-50/50 space-y-2">
                <h4 className="font-bold text-stone-900 flex items-center gap-2 text-base border-b border-stone-200 pb-2">
                  <Utensils className="text-mex-green" size={20} />
                  1. Módulo de Pedidos (Meseros / Caja)
                </h4>
                <ul className="list-disc list-inside space-y-1.5 text-xs text-stone-700 leading-relaxed">
                  <li><strong>Toma de Pedidos:</strong> Seleccione los productos por categoría. Puede añadir notas especiales o modificar ingredientes.</li>
                  <li><strong>Tipo de Orden:</strong> Seleccione si es para <em>Comer Aquí (Mesa)</em>, <em>Para Llevar</em> o <em>A Domicilio</em>.</li>
                  <li><strong>Envío a Cocina:</strong> Al confirmar el pedido, la comanda se envía inmediatamente al panel de Cocina/Parrilla y se puede imprimir el ticket de cocina.</li>
                  <li><strong>Crédito / Cuenta:</strong> Puede guardar pedidos a nombre de un cliente para cobro posterior.</li>
                </ul>
              </div>

              {/* Módulo 2 */}
              <div className="border border-stone-200 rounded-xl p-4 bg-stone-50/50 space-y-2">
                <h4 className="font-bold text-stone-900 flex items-center gap-2 text-base border-b border-stone-200 pb-2">
                  <CreditCard className="text-blue-600" size={20} />
                  2. Módulo de Caja & Cobro Directo
                </h4>
                <ul className="list-disc list-inside space-y-1.5 text-xs text-stone-700 leading-relaxed">
                  <li><strong>Apertura y Cierre:</strong> Registre el fondo inicial al iniciar el turno y realice el corte de caja al finalizar.</li>
                  <li><strong>Procesamiento de Pagos:</strong> Acepta Efectivo, Tarjeta de Débito/Crédito, Transferencia bancaria o Abono a Créditos pendientes.</li>
                  <li><strong>Impresión Inmediata:</strong> Al confirmar el cobro, la comanda/ticket de 54mm abre la ventana de impresión al instante.</li>
                  <li><strong>Reportes de Ventas:</strong> Genere reportes detallados por día, semana o mes con desglose exacto de efectivo, tarjeta y transferencias.</li>
                </ul>
              </div>

              {/* Módulo 3 */}
              <div className="border border-stone-200 rounded-xl p-4 bg-stone-50/50 space-y-2">
                <h4 className="font-bold text-stone-900 flex items-center gap-2 text-base border-b border-stone-200 pb-2">
                  <MessageSquare className="text-emerald-600" size={20} />
                  3. Pedidos por WhatsApp
                </h4>
                <ul className="list-disc list-inside space-y-1.5 text-xs text-stone-700 leading-relaxed">
                  <li><strong>Recepción Centralizada:</strong> Reciba los pedidos solicitados directamente desde WhatsApp en tiempo real.</li>
                  <li><strong>Sincronización de Comandas:</strong> Convierte mensajes de clientes en órdenes para cocina con un solo clic.</li>
                  <li><strong>Notificaciones:</strong> Notifique al cliente automáticamente cuando su pedido esté en preparación o listo para entrega.</li>
                </ul>
              </div>

              {/* Módulo 4 */}
              <div className="border border-stone-200 rounded-xl p-4 bg-stone-50/50 space-y-2">
                <h4 className="font-bold text-stone-900 flex items-center gap-2 text-base border-b border-stone-200 pb-2">
                  <ChefHat className="text-orange-600" size={20} />
                  4. Monitor de Cocina & Parrilla
                </h4>
                <ul className="list-disc list-inside space-y-1.5 text-xs text-stone-700 leading-relaxed">
                  <li><strong>Pantalla KDS:</strong> Monitor en vivo para los preparadores dividiendo comensales, bebidas y platillos de parrilla.</li>
                  <li><strong>Alertas Audibles:</strong> Timbre sonoro configurable al momento en que ingresa un nuevo pedido.</li>
                  <li><strong>Despacho de Comandas:</strong> Marque productos individualmente como "Listos" para alertar al mesero.</li>
                </ul>
              </div>

              {/* Módulo 5 */}
              <div className="border border-stone-200 rounded-xl p-4 bg-stone-50/50 space-y-2">
                <h4 className="font-bold text-stone-900 flex items-center gap-2 text-base border-b border-stone-200 pb-2">
                  <Settings className="text-stone-700" size={20} />
                  5. Administración e Inventario
                </h4>
                <ul className="list-disc list-inside space-y-1.5 text-xs text-stone-700 leading-relaxed">
                  <li><strong>Catálogo de Menú:</strong> Agregue, edite precios, fotos y existencias de platillos y bebidas.</li>
                  <li><strong>Auditoría de Caja:</strong> Control de gastos de caja chica, entradas y cancelaciones con PIN de Administrador.</li>
                </ul>
              </div>
            </div>
          )}

          {/* Section: Impresión & Red */}
          {activeSection === 'hardware' && (
            <div className="space-y-5">
              <div className="border border-stone-200 rounded-xl p-4 bg-stone-50 space-y-3">
                <h4 className="font-bold text-stone-900 flex items-center gap-2 text-base border-b border-stone-200 pb-2">
                  <Printer className="text-amber-700" size={20} />
                  Impresoras Térmicas USB de 54mm (ESC/POS Directo)
                </h4>
                <p className="text-xs text-stone-700 leading-relaxed">
                  El sistema cuenta con soporte para impresión en térmicas estándar de 54mm (como DeTong DP27, POS-58, etc.):
                </p>
                <ol className="list-decimal list-inside space-y-1.5 text-xs text-stone-700 leading-relaxed">
                  <li>Haga clic en el botón <strong>Impresora USB (54mm)</strong> en el menú lateral.</li>
                  <li>Conecte la impresora mediante el cable USB e inserte el papel térmico de 54mm.</li>
                  <li>Haga clic en <strong>Conectar Impresora USB</strong> y seleccione el dispositivo en la lista emergente de Chrome.</li>
                  <li>En caso de desconexión fortuita, presione el botón <strong>Reset</strong> para restablecer el servicio.</li>
                </ol>
              </div>

              <div className="border border-stone-200 rounded-xl p-4 bg-stone-50 space-y-3">
                <h4 className="font-bold text-stone-900 flex items-center gap-2 text-base border-b border-stone-200 pb-2">
                  <Wifi className="text-emerald-700" size={20} />
                  Operación Offline (Sin Internet)
                </h4>
                <p className="text-xs text-stone-700 leading-relaxed">
                  Si se interrumpe la conexión a Internet, el sistema activa automáticamente el almacenamiento local:
                </p>
                <ul className="list-disc list-inside space-y-1.5 text-xs text-stone-700 leading-relaxed">
                  <li>Todas las ventas y movimientos se guardan en la memoria local del dispositivo.</li>
                  <li>Al restablecer la red, el indicador mostrará los cambios pendientes y podrá presionar <strong>Subir / Sincronizar</strong>.</li>
                  <li>Puede instalar la aplicación en su pantalla de inicio usando el botón <strong>Instalar / Offline</strong>.</li>
                </ul>
              </div>
            </div>
          )}

          {/* Section: Acerca del Sistema / Créditos */}
          {activeSection === 'info' && (
            <div className="space-y-6">
              <div className="bg-gradient-to-br from-stone-900 via-stone-800 to-stone-900 text-white rounded-2xl p-6 shadow-lg border border-stone-700 text-center space-y-4">
                <div className="w-16 h-16 bg-mex-gold/20 text-mex-gold rounded-2xl mx-auto flex items-center justify-center border border-mex-gold/40 shadow-inner">
                  <ShieldCheck size={36} />
                </div>
                
                <div>
                  <h3 className="text-xl font-serif font-bold text-mex-gold tracking-wide">
                    Cazuelas Para Llevar POS
                  </h3>
                  <p className="text-xs text-stone-300 font-semibold mt-1">
                    Sistema de Gestión Integral de Restaurante & Punto de Venta
                  </p>
                </div>

                <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/15 text-xs font-mono text-stone-200">
                  <span>Versión 2.0</span>
                  <span>•</span>
                  <span className="text-mex-gold">Edición Producción</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 border-t border-stone-700 text-left">
                  <div className="bg-stone-800/80 p-3 rounded-xl border border-stone-700/80 flex items-start gap-3">
                    <User size={20} className="text-mex-gold shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[10px] text-stone-400 uppercase tracking-wider font-bold">Desarrollado Por</p>
                      <p className="text-xs font-bold text-white">Rafael J. Rosales</p>
                      <p className="text-[10px] text-stone-300 flex items-center gap-1 mt-0.5">
                        <Code2 size={12} className="text-mex-green" /> & IA Google
                      </p>
                    </div>
                  </div>

                  <div className="bg-stone-800/80 p-3 rounded-xl border border-stone-700/80 flex items-start gap-3">
                    <Calendar size={20} className="text-mex-green shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[10px] text-stone-400 uppercase tracking-wider font-bold">Última Actualización</p>
                      <p className="text-xs font-bold text-white">{lastUpdateDate}</p>
                      <p className="text-[10px] text-stone-300 mt-0.5">Soporte & Mantenimiento Activo</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 text-xs text-stone-600 space-y-2">
                <p className="font-bold text-stone-800">Notas de la Versión 2.0:</p>
                <ul className="list-disc list-inside space-y-1 text-stone-600">
                  <li>Impresión inmediata de tickets al cobrar pedidos o créditos.</li>
                  <li>Reportes de ventas compactos y precisos con soporte multiformato.</li>
                  <li>Motor offline optimizado para sincronización en background.</li>
                  <li>Limpieza de controladores de voz para mayor estabilidad en dispositivos móviles.</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer Modal */}
        <div className="bg-stone-100 p-3 sm:p-4 border-t border-stone-200 flex items-center justify-between shrink-0 text-xs">
          <div className="text-stone-500 text-[11px]">
            © 2026 Cazuelas Para Llevar • POS v2.0
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-stone-900 text-white font-bold rounded-xl hover:bg-stone-800 transition-colors cursor-pointer"
          >
            Entendido
          </button>
        </div>

      </div>
    </div>
  );
};
