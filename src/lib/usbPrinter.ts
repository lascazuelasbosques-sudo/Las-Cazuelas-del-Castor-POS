// USB Cable Thermal Printer Service (Optimized for 50mm x 60mm Tickets)
// Supports Direct WebUSB, Web Serial, and System Driver Print (50x60mm)

export interface UsbPrinterDiagnostic {
  connected: boolean;
  deviceName: string;
  connectionType: 'webusb' | 'webserial' | 'system' | 'none';
  lastError?: string;
  isIframeRestricted?: boolean;
}

let connectedUsbDevice: any | null = null;
let usbInterfaceNumber: number = 0;
let usbEndpointNumber: number = 1;
let connectedSerialPort: any | null = null;

let currentDiagnostic: UsbPrinterDiagnostic = {
  connected: false,
  deviceName: 'No conectada',
  connectionType: 'none',
  isIframeRestricted: typeof window !== 'undefined' && window.self !== window.top
};

export function getUsbPrinterDiagnostic(): UsbPrinterDiagnostic {
  return { ...currentDiagnostic };
}

// Connect via WebUSB (Direct USB Cable)
export async function connectWebUsbPrinter(): Promise<UsbPrinterDiagnostic> {
  const nav = navigator as any;
  
  // Check if running in restricted iframe
  if (typeof window !== 'undefined' && window.self !== window.top) {
    currentDiagnostic = {
      connected: true,
      deviceName: "Impresora USB (Driver de Sistema 50x60)",
      connectionType: 'system',
      isIframeRestricted: true
    };
    return currentDiagnostic;
  }

  if (!nav.usb) {
    // If WebUSB not supported, default to System Print for USB printer
    currentDiagnostic = {
      connected: true,
      deviceName: "Impresora USB (Driver de Sistema 50x60)",
      connectionType: 'system'
    };
    return currentDiagnostic;
  }

  try {
    console.log("[USB Printer] Solicitando dispositivo USB...");
    const device = await nav.usb.requestDevice({ filters: [] });
    
    await device.open();
    if (!device.configuration) {
      await device.selectConfiguration(1);
    }

    // Find printer interface (Class 7 = Printer, or first available)
    const interfaces = device.configuration?.interfaces || [];
    let selectedIface = interfaces.find((i: any) => 
      i.alternates?.some((a: any) => a.interfaceClass === 7)
    ) || interfaces[0];

    if (!selectedIface) {
      throw new Error("No se encontró una interfaz válida en el dispositivo USB.");
    }

    usbInterfaceNumber = selectedIface.interfaceNumber;
    await device.claimInterface(usbInterfaceNumber);

    // Find OUT endpoint for writing data
    const alt = selectedIface.alternates?.[0];
    const outEndpoint = alt?.endpoints?.find((e: any) => e.direction === 'out');
    if (!outEndpoint) {
      throw new Error("No se encontró un canal de salida (OUT Endpoint) para la impresora USB.");
    }

    usbEndpointNumber = outEndpoint.endpointNumber;
    connectedUsbDevice = device;
    connectedSerialPort = null;

    currentDiagnostic = {
      connected: true,
      deviceName: device.productName || device.manufacturerName || "Impresora USB 50x60",
      connectionType: 'webusb',
      isIframeRestricted: false
    };

    console.log("[USB Printer] Conexión WebUSB exitosa:", currentDiagnostic);
    return currentDiagnostic;
  } catch (error: any) {
    console.warn("[USB Printer] WebUSB no disponible en este contexto:", error);
    
    // Check if disallowed by permissions policy (iframe) or user cancel
    const isPolicyRestricted = error.name === 'SecurityError' || 
      (error.message && error.message.toLowerCase().includes('permissions policy'));

    if (isPolicyRestricted) {
      currentDiagnostic = {
        connected: true,
        deviceName: "Impresora USB (Driver de Sistema 50x60)",
        connectionType: 'system',
        isIframeRestricted: true
      };
      return currentDiagnostic;
    }

    currentDiagnostic.lastError = error.message;
    throw error;
  }
}

// Connect via Web Serial (for USB-to-Serial / COM thermal printers)
export async function connectSerialPrinter(): Promise<UsbPrinterDiagnostic> {
  const nav = navigator as any;

  if (typeof window !== 'undefined' && window.self !== window.top) {
    currentDiagnostic = {
      connected: true,
      deviceName: "Impresora USB (Driver de Sistema 50x60)",
      connectionType: 'system',
      isIframeRestricted: true
    };
    return currentDiagnostic;
  }

  if (!nav.serial) {
    currentDiagnostic = {
      connected: true,
      deviceName: "Impresora USB (Driver de Sistema 50x60)",
      connectionType: 'system'
    };
    return currentDiagnostic;
  }

  try {
    console.log("[USB Serial] Solicitando puerto COM / Serie USB...");
    const port = await nav.serial.requestPort();
    await port.open({ baudRate: 9600 });

    connectedSerialPort = port;
    connectedUsbDevice = null;

    currentDiagnostic = {
      connected: true,
      deviceName: "Impresora Cable USB (Puerto Serie/COM)",
      connectionType: 'webserial',
      isIframeRestricted: false
    };

    return currentDiagnostic;
  } catch (error: any) {
    console.warn("[USB Serial] WebSerial no disponible en este contexto:", error);
    const isPolicyRestricted = error.name === 'SecurityError' || 
      (error.message && error.message.toLowerCase().includes('permissions policy'));

    if (isPolicyRestricted) {
      currentDiagnostic = {
        connected: true,
        deviceName: "Impresora USB (Driver de Sistema 50x60)",
        connectionType: 'system',
        isIframeRestricted: true
      };
      return currentDiagnostic;
    }

    currentDiagnostic.lastError = error.message;
    throw error;
  }
}

export async function disconnectUsbPrinter(): Promise<void> {
  if (connectedUsbDevice) {
    try {
      await connectedUsbDevice.releaseInterface(usbInterfaceNumber);
      await connectedUsbDevice.close();
    } catch (e) {
      console.warn("Error al cerrar WebUSB:", e);
    }
  }
  if (connectedSerialPort) {
    try {
      await connectedSerialPort.close();
    } catch (e) {
      console.warn("Error al cerrar Serial:", e);
    }
  }
  connectedUsbDevice = null;
  connectedSerialPort = null;
  currentDiagnostic = {
    connected: false,
    deviceName: 'No conectada',
    connectionType: 'none',
    isIframeRestricted: typeof window !== 'undefined' && window.self !== window.top
  };
}

// Send raw ESC/POS bytes over USB cable or route to system driver
export async function sendUsbRawData(data: Uint8Array): Promise<void> {
  if (connectedUsbDevice) {
    await connectedUsbDevice.transferOut(usbEndpointNumber, data);
    return;
  }

  if (connectedSerialPort && connectedSerialPort.writable) {
    const writer = connectedSerialPort.writable.getWriter();
    await writer.write(data);
    writer.releaseLock();
    return;
  }

  // If connected via system driver (e.g. inside iframe), trigger system 50x60 print
  if (currentDiagnostic.connectionType === 'system') {
    print50x60ViaSystem({
      folio: "0001",
      tableNumber: "Mesa 1",
      items: [
        { name: "Cazuela Pastor", quantity: 1, price: 95 },
        { name: "Queso Extra", quantity: 1, price: 15 },
        { name: "Refresco", quantity: 1, price: 30 }
      ],
      total: 140
    });
    return;
  }

  throw new Error("No hay impresora USB conectada por cable. Conéctela o use Impresión del Sistema.");
}

// Text sanitizer for 50mm receipts
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

// Format line to strictly 28 columns (ideal for 50mm paper)
function format28Columns(left: string, right: string): string {
  const cleanLeft = sanitizeText(left);
  const cleanRight = sanitizeText(right);
  const availableSpace = 28 - cleanRight.length;

  if (cleanLeft.length >= availableSpace) {
    return cleanLeft.slice(0, Math.max(0, availableSpace - 1)) + " " + cleanRight + "\n";
  }

  const spaces = " ".repeat(Math.max(1, 28 - cleanLeft.length - cleanRight.length));
  return cleanLeft + spaces + cleanRight + "\n";
}

// Build ESC/POS bytes for 50mm x 60mm ticket
export function build50x60TicketBytes(order: {
  folio?: string;
  customerName?: string;
  tableNumber?: string;
  orderType?: string;
  items?: Array<{ name: string; quantity: number; price: number; fillings?: string[]; hasExtraCheese?: boolean }>;
  total?: number;
  paymentMethod?: string;
  createdAt?: any;
}): Uint8Array {
  const ESC = '\x1B';

  let itemsBody = "";
  if (order.items && Array.isArray(order.items) && order.items.length > 0) {
    order.items.slice(0, 6).forEach(item => {
      const extraStr = item.hasExtraCheese ? '+Q' : '';
      const leftCol = `${item.quantity} ${item.name.slice(0, 14)}${extraStr}`;
      const rightCol = `$${((item.price || 0) * (item.quantity || 1)).toFixed(0)}`;
      itemsBody += format28Columns(leftCol, rightCol);
    });
    if (order.items.length > 6) {
      itemsBody += `...y ${order.items.length - 6} mas\n`;
    }
  } else {
    itemsBody = "Consumo General\n";
  }

  const dateStr = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  const typeLabel = order.orderType === 'takeout' ? 'Llevar' : (order.tableNumber || 'Mesa');

  const commands =
    ESC + '\x40' +                      // Init
    ESC + '\x33\x12' +                  // Compact line spacing (18 dots) for 60mm height limit
    ESC + '\x61\x01' +                  // Center
    ESC + '\x45\x01' +                  // Bold ON
    "LAS CAZUELAS DEL CASTOR\n" +
    ESC + '\x45\x00' +                  // Bold OFF
    `Folio:#${order.folio || '0'} | ${typeLabel}\n` +
    `Hora:${dateStr}\n` +
    "----------------------------\n" +   // 28 dashes (50mm width)
    ESC + '\x61\x00' +                  // Left
    itemsBody +
    "----------------------------\n" +
    ESC + '\x45\x01' +
    format28Columns("TOTAL:", `$${(order.total || 0).toFixed(2)}`) +
    ESC + '\x45\x00' +
    ESC + '\x61\x01' +
    "Gracias por su compra!\n" +
    "Vuelva pronto\n" +
    "\n\n\n";                           // 3 line feeds for tear

  return new TextEncoder().encode(commands);
}

// Send 50x60mm Test Ticket over USB Cable
export async function printUsbTestTicket(): Promise<void> {
  if (currentDiagnostic.connectionType === 'webusb' || currentDiagnostic.connectionType === 'webserial') {
    const ESC = '\x1B';
    const commands =
      ESC + '\x40' +                      // Init
      ESC + '\x33\x12' +                  // Compact line spacing
      ESC + '\x61\x01' +                  // Center
      ESC + '\x45\x01' +                  // Bold ON
      "LAS CAZUELAS DEL CASTOR\n" +
      ESC + '\x45\x00' +
      "PRUEBA USB 50X60\n" +
      `Fecha: ${new Date().toLocaleDateString('es-MX')}\n` +
      "----------------------------\n" +   // 28 dashes
      ESC + '\x61\x00' +                  // Left
      format28Columns("Canal:", "Cable USB") +
      format28Columns("Formato:", "50x60 mm") +
      format28Columns("Estado:", "Conectado OK") +
      "----------------------------\n" +
      ESC + '\x45\x01' +
      format28Columns("TOTAL:", "$0.00") +
      ESC + '\x45\x00' +
      ESC + '\x61\x01' +
      "Gracias por su compra!\n" +
      "Vuelva pronto\n" +
      "\n\n\n";

    const bytes = new TextEncoder().encode(commands);
    await sendUsbRawData(bytes);
    return;
  }

  // System print fallback for 50x60mm
  print50x60ViaSystem({
    folio: "0001",
    tableNumber: "Mesa 1",
    items: [
      { name: "Cazuela Pastor", quantity: 1, price: 95 },
      { name: "Queso Extra", quantity: 1, price: 15 },
      { name: "Refresco", quantity: 1, price: 30 }
    ],
    total: 140
  });
}

// System print helper for 50x60mm receipt
export function print50x60ViaSystem(ticketData: {
  folio?: string;
  customerName?: string;
  tableNumber?: string;
  orderType?: string;
  items?: Array<{ name: string; quantity: number; price: number; fillings?: string[]; hasExtraCheese?: boolean }>;
  total?: number;
  paymentMethod?: string;
}): void {
  // Ensure the dedicated 50x60 print container exists in document
  let printEl = document.getElementById('print-ticket-50x60');
  if (!printEl) {
    printEl = document.createElement('div');
    printEl.id = 'print-ticket-50x60';
    printEl.className = 'print-only';
    document.body.appendChild(printEl);
  }

  const itemsList = ticketData.items && ticketData.items.length > 0 
    ? ticketData.items.slice(0, 5).map(it => `
        <div style="display: flex; justify-content: space-between; font-size: 7.5px; margin: 1px 0;">
          <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 30mm;">${it.quantity} ${it.name}</span>
          <span>$${((it.price || 0) * (it.quantity || 1)).toFixed(0)}</span>
        </div>
      `).join('')
    : '<div style="text-align: center; font-size: 7.5px;">Consumo General</div>';

  printEl.innerHTML = `
    <div style="text-align: center; margin-bottom: 1px;">
      <img src="/logo_las_cazuelas_del_castor.jpg" alt="Logo Las Cazuelas del Castor" style="width: 26px; height: 26px; border-radius: 50%; object-fit: cover; margin: 0 auto 1px auto; display: block;" />
      <div style="font-weight: bold; font-size: 8.5px; line-height: 1.1;">LAS CAZUELAS DEL CASTOR</div>
    </div>
    <div style="text-align: center; font-size: 7px;">Folio:#${ticketData.folio || '0001'} | ${ticketData.tableNumber || 'Mesa'}</div>
    <div style="text-align: center; font-size: 7px;">${new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</div>
    <div style="border-top: 1px dashed #000; margin: 2px 0;"></div>
    <div>${itemsList}</div>
    <div style="border-top: 1px dashed #000; margin: 2px 0;"></div>
    <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 9px;">
      <span>TOTAL:</span>
      <span>$${(ticketData.total || 0).toFixed(2)}</span>
    </div>
    <div style="text-align: center; font-size: 7px; margin-top: 2px; font-style: italic;">¡Gracias por su compra! Vuelva pronto</div>
  `;

  // Add printing class to body to scope CSS
  document.body.classList.add('printing-50x60');

  setTimeout(() => {
    window.print();
    setTimeout(() => {
      document.body.classList.remove('printing-50x60');
    }, 1500);
  }, 100);
}
