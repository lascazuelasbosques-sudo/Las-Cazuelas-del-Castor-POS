// Web Bluetooth ESC/POS Thermal Printer Service
// Optimized thoroughly for 57mm / 58mm Thermal Bluetooth Printers (32 columns, BLE 20-byte chunks)

export interface BluetoothDiagnostic {
  connected: boolean;
  deviceName: string;
  serviceUuid: string;
  characteristicUuid: string;
  writeType: 'writeWithoutResponse' | 'writeWithResponse' | 'unknown';
  lastError?: string;
  isSimulated?: boolean;
}

let connectedDevice: any | null = null;
let printerCharacteristic: any | null = null;
let currentDiagnostic: BluetoothDiagnostic = {
  connected: false,
  deviceName: 'Desconectada',
  serviceUuid: '',
  characteristicUuid: '',
  writeType: 'unknown',
  isSimulated: false
};

// Comprehensive list of Bluetooth LE thermal printer services across manufacturers (POS-58, MPT, GOOJPRT, PT-210, etc.)
const KNOWN_PRINTER_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb', // Standard POS Printer Service
  '0000ffe0-0000-1000-8000-00805f9b34fb', // HM-10 / CC2540 / POS-58
  '0000ff00-0000-1000-8000-00805f9b34fb', // Common Chinese 58mm BLE
  '0000fee7-0000-1000-8000-00805f9b34fb', // Tencent / Low-cost BLE
  '0000fff0-0000-1000-8000-00805f9b34fb', // FFF0 Generic
  '0000ae00-0000-1000-8000-00805f9b34fb', // AE00 Printer
  '0000af00-0000-1000-8000-00805f9b34fb', // AF00 Printer
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC transparent UART
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // Generic BLE printer
  '6e400001-b5a3-f393-e0a9-e50e24dcca9e', // Nordic UART Service (NUS)
  'd973f2e0-b19e-11e2-9e96-0800200c9a66',
  '00001101-0000-1000-8000-00805f9b34fb', // SPP Serial
  '0000fef5-0000-1000-8000-00805f9b34fb',
  0x18f0,
  0xffe0,
  0xff00,
  0xfee7,
  0xfff0,
  0xae00,
  0xaf00,
  0x180a
];

export function getPrinterDiagnostic(): BluetoothDiagnostic {
  return {
    ...currentDiagnostic,
    connected: !!printerCharacteristic && (currentDiagnostic.isSimulated || !!connectedDevice?.gatt?.connected)
  };
}

export async function connectBluetoothPrinter(): Promise<BluetoothDiagnostic> {
  const nav = navigator as any;
  if (!nav.bluetooth) {
    throw new Error("Web Bluetooth no está soportado en este navegador. Utilice Google Chrome o Edge en Android, Windows o Mac.");
  }

  try {
    console.log("[Bluetooth Printer] Solicitando dispositivo Bluetooth...");
    
    // Request device with all potential thermal printer services in optionalServices
    const device = await nav.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: KNOWN_PRINTER_SERVICES
    });

    if (!device.gatt) {
      throw new Error("El dispositivo Bluetooth seleccionado no soporta perfil GATT.");
    }

    // Auto-disconnect listener
    device.addEventListener('gattserverdisconnected', () => {
      console.warn("[Bluetooth Printer] Dispositivo desconectado físicamente.");
      currentDiagnostic = {
        connected: false,
        deviceName: 'Desconectada',
        serviceUuid: '',
        characteristicUuid: '',
        writeType: 'unknown',
        isSimulated: false
      };
      printerCharacteristic = null;
      connectedDevice = null;
    });

    console.log(`[Bluetooth Printer] Conectando a GATT Server de: ${device.name || 'Sin nombre'}...`);
    const server = await device.gatt.connect();

    let writableChar: any = null;
    let selectedServiceUuid = '';
    let selectedCharUuid = '';
    let writeType: 'writeWithoutResponse' | 'writeWithResponse' | 'unknown' = 'unknown';

    // 1. Try to get all primary services
    let services: any[] = [];
    try {
      services = await server.getPrimaryServices();
    } catch (e) {
      console.warn("[Bluetooth Printer] getPrimaryServices() restringido, buscando servicios individuales...", e);
    }

    // If getPrimaryServices returned nothing, query known services directly
    if (!services || services.length === 0) {
      for (const sUuid of KNOWN_PRINTER_SERVICES) {
        try {
          const s = await server.getPrimaryService(sUuid);
          if (s) services.push(s);
        } catch (e) {
          // not this service
        }
      }
    }

    console.log(`[Bluetooth Printer] Servicios detectados: ${services.length}`);

    // 2. Iterate services to find writable characteristic
    for (const service of services) {
      try {
        const characteristics = await service.getCharacteristics();
        for (const c of characteristics) {
          const props = c.properties;
          console.log(`[Bluetooth Printer] Evaluando característica: ${c.uuid}`, {
            write: props.write,
            writeWithoutResponse: props.writeWithoutResponse,
            notify: props.notify
          });

          // Favor writeWithoutResponse as 95% of 57mm BLE printers use it
          if (props.writeWithoutResponse) {
            writableChar = c;
            selectedServiceUuid = String(service.uuid);
            selectedCharUuid = String(c.uuid);
            writeType = 'writeWithoutResponse';
            break;
          } else if (props.write) {
            writableChar = c;
            selectedServiceUuid = String(service.uuid);
            selectedCharUuid = String(c.uuid);
            writeType = 'writeWithResponse';
            break;
          }
        }
        if (writableChar) break;
      } catch (err) {
        console.warn(`[Bluetooth Printer] No se pudieron leer características del servicio ${service.uuid}:`, err);
      }
    }

    if (!writableChar) {
      throw new Error("Se conectó al dispositivo pero no se encontró un canal de escritura (ESC/POS) compatible.");
    }

    connectedDevice = device;
    printerCharacteristic = writableChar;
    currentDiagnostic = {
      connected: true,
      deviceName: device.name || "Impresora 57mm",
      serviceUuid: selectedServiceUuid,
      characteristicUuid: selectedCharUuid,
      writeType,
      isSimulated: false
    };

    console.log("[Bluetooth Printer] Conexión establecida exitosamente:", currentDiagnostic);
    return currentDiagnostic;
  } catch (error: any) {
    console.error("[Bluetooth Printer] Error al conectar:", error);
    currentDiagnostic.lastError = error.message;
    throw error;
  }
}

export async function disconnectBluetoothPrinter(): Promise<void> {
  if (connectedDevice && connectedDevice.gatt && connectedDevice.gatt.connected) {
    try {
      connectedDevice.gatt.disconnect();
    } catch (e) {
      console.warn("Error disconnecting GATT:", e);
    }
  }
  connectedDevice = null;
  printerCharacteristic = null;
  currentDiagnostic = {
    connected: false,
    deviceName: 'Desconectada',
    serviceUuid: '',
    characteristicUuid: '',
    writeType: 'unknown',
    isSimulated: false
  };
}

// Low-level chunk writer handling properties correctly without throwing NotSupportedError
async function writeChunkToCharacteristic(characteristic: any, chunk: Uint8Array): Promise<void> {
  const props = characteristic.properties || {};

  // 1. Prefer writeWithoutResponse if available
  if (props.writeWithoutResponse && typeof characteristic.writeValueWithoutResponse === 'function') {
    await characteristic.writeValueWithoutResponse(chunk);
    return;
  }

  // 2. Try writeValueWithResponse if supported
  if (props.write && typeof characteristic.writeValueWithResponse === 'function') {
    await characteristic.writeValueWithResponse(chunk);
    return;
  }

  // 3. Fallbacks for standard/older Chromium
  if (typeof characteristic.writeValueWithoutResponse === 'function') {
    try {
      await characteristic.writeValueWithoutResponse(chunk);
      return;
    } catch (e) {}
  }

  if (typeof characteristic.writeValue === 'function') {
    try {
      await characteristic.writeValue(chunk);
      return;
    } catch (e) {}
  }

  if (typeof characteristic.writeValueWithResponse === 'function') {
    await characteristic.writeValueWithResponse(chunk);
    return;
  }

  throw new Error("El canal de la impresora no permite escritura de datos.");
}

// Send raw ESC/POS bytes safely:
// - Paced in 20-byte chunks (Bluetooth LE standard payload MTU)
// - 25ms delay between chunks to prevent microcontroller buffer overflow
export async function sendRawData(data: Uint8Array, onProgress?: (percent: number) => void): Promise<void> {
  if (!printerCharacteristic) {
    throw new Error("No hay ninguna impresora Bluetooth conectada. Vincúlela en el menú.");
  }

  if (currentDiagnostic.isSimulated) {
    console.log("🖨️ [SIMULADOR 57mm] Datos recibidos:", new TextDecoder().decode(data));
    if (onProgress) onProgress(100);
    return;
  }

  // Ensure GATT is still connected
  if (connectedDevice && connectedDevice.gatt && !connectedDevice.gatt.connected) {
    console.log("[Bluetooth Printer] Reconectando GATT...");
    await connectedDevice.gatt.connect();
  }

  const CHUNK_SIZE = 20; // 20 bytes is universally safe for all BLE thermal printers
  const total = data.length;

  for (let i = 0; i < total; i += CHUNK_SIZE) {
    const chunk = data.slice(i, i + CHUNK_SIZE);
    await writeChunkToCharacteristic(printerCharacteristic, chunk);

    // Critical pacing delay: allows the thermal printer's serial buffer to process bytes
    await new Promise(resolve => setTimeout(resolve, 25));

    if (onProgress) {
      const progress = Math.min(100, Math.round(((i + chunk.length) / total) * 100));
      onProgress(progress);
    }
  }

  // Final wait to ensure buffer is emptied onto thermal paper
  await new Promise(resolve => setTimeout(resolve, 100));
  if (onProgress) onProgress(100);
}

// Text sanitizer: removes accents/diacritics and converts to clean single-byte ASCII
// This avoids UTF-8 multi-byte corruptions on 57mm thermal printer character sets
function sanitizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[áàäâ]/gi, 'a')
    .replace(/[éèëê]/gi, 'e')
    .replace(/[íìïî]/gi, 'i')
    .replace(/[óòöô]/gi, 'o')
    .replace(/[úùüû]/gi, 'u')
    .replace(/[ñ]/g, 'n')
    .replace(/[Ñ]/g, 'N')
    .replace(/[¿¡]/g, '')
    .replace(/[^\x20-\x7E\n\r\t]/g, ' ');
}

// 57mm Thermal printers are strictly 32 characters wide.
// Helper to create a 2-column line (Left text, Right text) padded to exactly 32 columns.
function format32Columns(left: string, right: string): string {
  const cleanLeft = sanitizeText(left);
  const cleanRight = sanitizeText(right);
  const availableSpace = 32 - cleanRight.length;

  if (cleanLeft.length >= availableSpace) {
    return cleanLeft.slice(0, Math.max(0, availableSpace - 1)) + " " + cleanRight + "\n";
  }

  const spaces = " ".repeat(Math.max(1, 32 - cleanLeft.length - cleanRight.length));
  return cleanLeft + spaces + cleanRight + "\n";
}

// Single line rapid motor test (to verify Bluetooth physical transmission instantly)
export async function printSimpleLineTest(): Promise<void> {
  const ESC = '\x1B';
  const init = ESC + '\x40';
  const text = "PRUEBA 57MM OK - LAS CAZUELAS\n\n\n\n";
  const encoder = new TextEncoder();
  await sendRawData(encoder.encode(init + text));
}

// Full 57mm test ticket
export async function printTestTicket(onProgress?: (percent: number) => void): Promise<void> {
  const ESC = '\x1B';

  const commands =
    ESC + '\x40' +                 // Initialize printer
    ESC + '\x61\x01' +             // Center alignment
    ESC + '\x45\x01' +             // Bold ON
    "LAS CAZUELAS DE LOS BOSQUES\n" +
    ESC + '\x45\x00' +             // Bold OFF
    "SISTEMA POS (57MM / 32 COL)\n" +
    "--------------------------------\n" +
    ESC + '\x61\x00' +             // Left alignment
    "PRUEBA DE IMPRESION BLUETOOTH\n" +
    `Fecha: ${new Date().toLocaleDateString('es-MX')} ${new Date().toLocaleTimeString('es-MX')}\n` +
    format32Columns("Canal:", currentDiagnostic.writeType === 'writeWithoutResponse' ? "BLE Directo" : "BLE Std") +
    format32Columns("Dispositivo:", currentDiagnostic.deviceName.slice(0, 18)) +
    "--------------------------------\n" +
    ESC + '\x61\x01' +             // Center
    ESC + '\x45\x01' +
    "COMUNICACION EXITOSA\n" +
    ESC + '\x45\x00' +
    "Impresora termica lista para\n" +
    "imprimir comandas y cobros.\n" +
    "--------------------------------\n" +
    "¡Gracias por su preferencia!\n" +
    "\n\n\n\n\n";                 // 5 line feeds to push past manual tear bar (no cut command)

  const encoder = new TextEncoder();
  await sendRawData(encoder.encode(commands), onProgress);
}

// Print full Order/Receipt ticket for 57mm
export async function printOrderTicket(order: {
  folio?: string;
  customerName?: string;
  tableNumber?: string;
  orderType?: string;
  items?: Array<{ name: string; quantity: number; price: number; fillings?: string[]; hasExtraCheese?: boolean }>;
  total?: number;
  amountPaid?: number;
  changeDue?: number;
  paymentMethod?: string;
  waiterName?: string;
  createdAt?: any;
}, onProgress?: (percent: number) => void): Promise<void> {
  const ESC = '\x1B';

  let itemsBody = "";
  if (order.items && Array.isArray(order.items) && order.items.length > 0) {
    order.items.forEach(item => {
      const fillingsStr = item.fillings && item.fillings.length > 0 ? ` [${item.fillings.join(', ')}]` : '';
      const extraStr = item.hasExtraCheese ? ' (+Queso Extra)' : '';
      const leftCol = `${item.quantity}x ${item.name}${extraStr}`;
      const rightCol = `$${((item.price || 0) * (item.quantity || 1)).toFixed(2)}`;

      itemsBody += format32Columns(leftCol, rightCol);
      if (fillingsStr) {
        itemsBody += `  ${sanitizeText(fillingsStr).slice(0, 30)}\n`;
      }
    });
  } else {
    itemsBody = "Sin articulos desglosados\n";
  }

  const orderTypeLabel = order.orderType === 'takeout' 
    ? 'Para Llevar' 
    : order.orderType === 'delivery' 
    ? 'WhatsApp/Envio' 
    : (order.tableNumber ? `Mesa: ${order.tableNumber}` : 'Comer Aqui');

  const methodLabel = order.paymentMethod === 'card' 
    ? 'Tarjeta' 
    : order.paymentMethod === 'transfer' 
    ? 'Transferencia' 
    : order.paymentMethod === 'credit' 
    ? 'Credito' 
    : 'Efectivo';

  const dateStr = order.createdAt?.seconds 
    ? new Date(order.createdAt.seconds * 1000).toLocaleString('es-MX')
    : new Date().toLocaleString('es-MX');

  const commands =
    ESC + '\x40' +                     // Init
    ESC + '\x61\x01' +                 // Center
    ESC + '\x45\x01' +                 // Bold ON
    "LAS CAZUELAS DE LOS BOSQUES\n" +
    ESC + '\x45\x00' +                 // Bold OFF
    "TICKET DE VENTA\n" +
    "--------------------------------\n" +
    ESC + '\x61\x00' +                 // Left
    format32Columns("Folio:", `#${order.folio || '0000'}`) +
    format32Columns("Tipo:", orderTypeLabel) +
    format32Columns("Cliente:", (order.customerName || 'General').slice(0, 22)) +
    format32Columns("Mesero:", (order.waiterName || 'Caja').slice(0, 22)) +
    `Fecha: ${dateStr}\n` +
    "--------------------------------\n" +
    "CANT PRODUCTO              IMPORTE\n" +
    "--------------------------------\n" +
    itemsBody +
    "--------------------------------\n" +
    ESC + '\x45\x01' +                 // Bold ON
    format32Columns("TOTAL:", `$${(order.total || 0).toFixed(2)}`) +
    ESC + '\x45\x00' +                 // Bold OFF
    format32Columns("Metodo de Pago:", methodLabel) +
    (order.amountPaid && order.amountPaid > 0 ? format32Columns("Pagado:", `$${order.amountPaid.toFixed(2)}`) : "") +
    (order.changeDue && order.changeDue > 0 ? format32Columns("Cambio:", `$${order.changeDue.toFixed(2)}`) : "") +
    "--------------------------------\n" +
    ESC + '\x61\x01' +                 // Center
    "¡GRACIAS POR SU COMPRA!\n" +
    "Conserve este ticket\n" +
    "\n\n\n\n\n";                     // 5 line feeds to push past manual tear bar

  const encoder = new TextEncoder();
  await sendRawData(encoder.encode(commands), onProgress);
}
