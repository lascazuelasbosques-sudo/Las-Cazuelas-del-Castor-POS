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

// Auto-connect to previously authorized WebUSB / WebSerial printer on app load
export async function autoConnectUsbPrinter(): Promise<UsbPrinterDiagnostic> {
  const nav = navigator as any;

  // Try auto-reconnecting existing WebUSB device
  if (nav?.usb?.getDevices) {
    try {
      const devices = await nav.usb.getDevices();
      if (devices && devices.length > 0) {
        const device = devices[0];
        await device.open();
        if (!device.configuration) {
          await device.selectConfiguration(1);
        }
        const interfaces = device.configuration?.interfaces || [];
        let claimedIface: any = null;
        let foundOutEndpoint: any = null;

        for (const iface of interfaces) {
          for (const alt of (iface.alternates || [])) {
            const outEp = alt.endpoints?.find((e: any) => e.direction === 'out');
            if (outEp) {
              try {
                await device.claimInterface(iface.interfaceNumber);
                claimedIface = iface;
                foundOutEndpoint = outEp;
                break;
              } catch (claimErr) {
                console.warn(`[USB Printer] Auto-connect couldn't claim iface ${iface.interfaceNumber}:`, claimErr);
              }
            }
          }
          if (claimedIface && foundOutEndpoint) break;
        }

        if (claimedIface && foundOutEndpoint) {
          usbInterfaceNumber = claimedIface.interfaceNumber;
          usbEndpointNumber = foundOutEndpoint.endpointNumber;
          connectedUsbDevice = device;
          connectedSerialPort = null;
          currentDiagnostic = {
            connected: true,
            deviceName: device.productName || device.manufacturerName || "DeTong DP27 / Impresora USB Directa",
            connectionType: 'webusb',
            isIframeRestricted: false
          };
          console.log("[USB Printer] Re-conexión WebUSB automática exitosa:", currentDiagnostic);
          return currentDiagnostic;
        }
      }
    } catch (err) {
      console.warn("[USB Printer] No se pudo reconectar WebUSB automáticamente:", err);
    }
  }

  // Try auto-reconnecting existing WebSerial port
  if (nav?.serial?.getPorts) {
    try {
      const ports = await nav.serial.getPorts();
      if (ports && ports.length > 0) {
        const port = ports[0];
        await port.open({ baudRate: 9600 });
        connectedSerialPort = port;
        connectedUsbDevice = null;
        currentDiagnostic = {
          connected: true,
          deviceName: "Impresora Cable USB (Puerto Serie/COM)",
          connectionType: 'webserial',
          isIframeRestricted: false
        };
        console.log("[USB Printer] Re-conexión WebSerial automática exitosa");
        return currentDiagnostic;
      }
    } catch (err) {
      console.warn("[USB Printer] No se pudo reconectar WebSerial automáticamente:", err);
    }
  }

  return currentDiagnostic;
}

// Connect via WebUSB (Direct USB Cable - Bypasses OS Print Spooler)
export async function connectWebUsbPrinter(): Promise<UsbPrinterDiagnostic> {
  const nav = navigator as any;

  if (!nav.usb) {
    throw new Error("Su navegador no soporta WebUSB. Utilice Google Chrome o Microsoft Edge.");
  }

  try {
    console.log("[USB Printer] Solicitando dispositivo USB directo (DeTong DP27 / Térmica)...");
    const device = await nav.usb.requestDevice({ filters: [] });
    
    await device.open();
    if (!device.configuration) {
      await device.selectConfiguration(1);
    }

    const interfaces = device.configuration?.interfaces || [];
    let claimedIface: any = null;
    let foundOutEndpoint: any = null;

    // 1. Try finding interface with Printer Class (7) or Vendor Class (255 / 0xFF) or any interface with an OUT endpoint
    for (const iface of interfaces) {
      for (const alt of (iface.alternates || [])) {
        const outEp = alt.endpoints?.find((e: any) => e.direction === 'out');
        if (outEp) {
          try {
            await device.claimInterface(iface.interfaceNumber);
            claimedIface = iface;
            foundOutEndpoint = outEp;
            break;
          } catch (claimErr) {
            console.warn(`[USB Printer] No se pudo reclamar interfaz ${iface.interfaceNumber}:`, claimErr);
          }
        }
      }
      if (claimedIface && foundOutEndpoint) break;
    }

    if (!claimedIface || !foundOutEndpoint) {
      // If WebUSB interface claim failed due to OS driver lock (e.g. DeTong Windows Driver active)
      console.warn("[USB Printer] Interfaz bloqueada por el driver del SO. Usando modo Driver de Sistema.");
      currentDiagnostic = {
        connected: true,
        deviceName: device.productName || device.manufacturerName || "DeTong DP27 (Driver del Sistema)",
        connectionType: 'system',
        isIframeRestricted: false
      };
      return currentDiagnostic;
    }

    usbInterfaceNumber = claimedIface.interfaceNumber;
    usbEndpointNumber = foundOutEndpoint.endpointNumber;
    connectedUsbDevice = device;
    connectedSerialPort = null;

    currentDiagnostic = {
      connected: true,
      deviceName: device.productName || device.manufacturerName || "DeTong DP27 / Impresora USB Directa",
      connectionType: 'webusb',
      isIframeRestricted: false
    };

    console.log("[USB Printer] Conexión WebUSB directa exitosa con DeTong DP27 / Impresora:", currentDiagnostic);
    return currentDiagnostic;
  } catch (error: any) {
    console.warn("[USB Printer] Error al conectar WebUSB:", error);
    
    const isPolicyRestricted = error.name === 'SecurityError' || 
      (error.message && error.message.toLowerCase().includes('permissions policy'));

    if (isPolicyRestricted) {
      currentDiagnostic = {
        connected: false,
        deviceName: "Acceso USB restringido en vista previa",
        connectionType: 'none',
        lastError: "Abra la aplicación en una pestaña nueva para otorgar permiso al puerto USB de DeTong DP27.",
        isIframeRestricted: true
      };
      throw new Error("El navegador bloquea el acceso USB dentro del marco de vista previa. Haga clic en 'Abrir en Nueva Pestaña' para conectar directamente con DeTong DP27.");
    }

    currentDiagnostic.lastError = error.message;
    throw error;
  }
}

// Connect via Web Serial (for USB-to-Serial / COM thermal printers)
export async function connectSerialPrinter(): Promise<UsbPrinterDiagnostic> {
  const nav = navigator as any;

  if (!nav.serial) {
    throw new Error("Su navegador no soporta WebSerial. Utilice Google Chrome o Microsoft Edge.");
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
    console.warn("[USB Serial] WebSerial no disponible:", error);
    const isPolicyRestricted = error.name === 'SecurityError' || 
      (error.message && error.message.toLowerCase().includes('permissions policy'));

    if (isPolicyRestricted) {
      currentDiagnostic = {
        connected: false,
        deviceName: "Acceso USB/Serie restringido en vista previa",
        connectionType: 'none',
        lastError: "Abra la aplicación en una pestaña nueva para otorgar permiso al puerto USB físico.",
        isIframeRestricted: true
      };
      throw new Error("El navegador bloquea el acceso Serie/USB dentro del marco de vista previa. Haga clic en 'Abrir en Nueva Pestaña' para conectar.");
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

// Send raw ESC/POS bytes over USB cable with auto-recovery and system fallback
export async function sendUsbRawData(data: Uint8Array): Promise<void> {
  // 1. Try sending via active WebUSB
  if (connectedUsbDevice) {
    try {
      await connectedUsbDevice.transferOut(usbEndpointNumber, data);
      console.log("[USB Printer] Datos enviados exitosamente por WebUSB.");
      return;
    } catch (usbErr) {
      console.warn("[USB Printer] Falló transferencia WebUSB. Intentando autorecupereación...", usbErr);
      try {
        const autoRes = await autoConnectUsbPrinter();
        if (autoRes.connected && connectedUsbDevice) {
          await connectedUsbDevice.transferOut(usbEndpointNumber, data);
          console.log("[USB Printer] Transferencia exitosa tras autorecuperación WebUSB.");
          return;
        }
      } catch (retryErr) {
        console.warn("[USB Printer] Falló reintento de autorecuperación WebUSB:", retryErr);
      }
    }
  }

  // 2. Try sending via active WebSerial
  if (connectedSerialPort && connectedSerialPort.writable) {
    try {
      const writer = connectedSerialPort.writable.getWriter();
      await writer.write(data);
      writer.releaseLock();
      console.log("[USB Printer] Datos enviados exitosamente por Puerto Serie.");
      return;
    } catch (serialErr) {
      console.warn("[USB Printer] Falló envío por Puerto Serie. Intentando autorecupereación...", serialErr);
      try {
        const autoRes = await autoConnectUsbPrinter();
        if (autoRes.connected && connectedSerialPort && connectedSerialPort.writable) {
          const writer = connectedSerialPort.writable.getWriter();
          await writer.write(data);
          writer.releaseLock();
          console.log("[USB Printer] Transferencia exitosa tras autorecuperación Serie.");
          return;
        }
      } catch (retryErr) {
        console.warn("[USB Printer] Falló reintento de autorecuperación Serie:", retryErr);
      }
    }
  }

  // 3. If direct USB or serial transfer is unavailable or failed, throw error to trigger caller fallback
  throw new Error("Impresora USB no conectada por cable directo. Se usará el driver del sistema.");
}

// Test printer communication by sending a ping command
export async function testPrinterCommunication(): Promise<{ success: boolean; message: string; connectionType: string }> {
  let diag = getUsbPrinterDiagnostic();
  if (!diag.connected || diag.connectionType === 'none') {
    diag = await autoConnectUsbPrinter();
  }

  const testBytes = build50x60TicketBytes({
    folio: "TEST",
    tableNumber: "TEST COMUNICACIÓN",
    items: [{ name: "Test de Respuesta USB OK", quantity: 1, price: 0 }],
    total: 0
  });

  try {
    await sendUsbRawData(testBytes);
    return {
      success: true,
      message: "¡Test de comunicación exitoso! La impresora respondió correctamente.",
      connectionType: currentDiagnostic.connectionType
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Error de comunicación: ${err.message || "Sin respuesta del puerto de impresión."}`,
      connectionType: currentDiagnostic.connectionType
    };
  }
}

// Reconnect printer service by resetting interfaces and re-detecting ports
export async function reconnectPrinterService(): Promise<UsbPrinterDiagnostic> {
  console.log("[USB Printer] Reiniciando servicio de impresora USB...");
  await disconnectUsbPrinter();
  
  try {
    const autoRes = await autoConnectUsbPrinter();
    if (autoRes.connected) {
      console.log("[USB Printer] Servicio reconectado exitosamente:", autoRes);
      return autoRes;
    }
  } catch (e) {
    console.warn("[USB Printer] Re-conexión directa no encontró puerto previo:", e);
  }

  currentDiagnostic = {
    connected: true,
    deviceName: "Impresora por Driver de Sistema (CUPS / Spooler)",
    connectionType: 'system',
    isIframeRestricted: typeof window !== 'undefined' && window.self !== window.top
  };
  return currentDiagnostic;
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

// Format line to strictly 30 columns (ideal for 54mm paper)
function format30Columns(left: string, right: string): string {
  const cleanLeft = sanitizeText(left);
  const cleanRight = sanitizeText(right);
  const availableSpace = 30 - cleanRight.length;

  if (cleanLeft.length >= availableSpace) {
    return cleanLeft.slice(0, Math.max(0, availableSpace - 1)) + " " + cleanRight + "\n";
  }

  const spaces = " ".repeat(Math.max(1, 30 - cleanLeft.length - cleanRight.length));
  return cleanLeft + spaces + cleanRight + "\n";
}

// Build ESC/POS bytes for 54mm ticket
export function build50x60TicketBytes(order: {
  folio?: string;
  customerName?: string;
  tableNumber?: string;
  orderType?: string;
  items?: Array<{ name: string; quantity: number; price: number; fillings?: string[]; hasExtraCheese?: boolean }>;
  total?: number;
  subtotal?: number;
  cardFee?: number;
  paymentMethod?: string;
  createdAt?: any;
  isPreAccount?: boolean;
}): Uint8Array {
  const ESC = '\x1B';

  let itemsBody = "";
  let itemsSum = 0;
  if (order.items && Array.isArray(order.items) && order.items.length > 0) {
    order.items.slice(0, 10).forEach(item => {
      const extraStr = item.hasExtraCheese ? '+Q' : '';
      const lineTotal = (item.price || 0) * (item.quantity || 1);
      itemsSum += lineTotal;
      const leftCol = `${item.quantity} ${item.name.slice(0, 16)}${extraStr}`;
      const rightCol = `$${lineTotal.toFixed(0)}`;
      itemsBody += format30Columns(leftCol, rightCol);
    });
    if (order.items.length > 10) {
      itemsBody += `...y ${order.items.length - 10} mas\n`;
    }
  } else {
    itemsBody = "Consumo General\n";
    itemsSum = order.total || 0;
  }

  const subtotalVal = order.subtotal !== undefined ? order.subtotal : itemsSum;
  const calculatedCardFee = order.cardFee !== undefined 
    ? order.cardFee 
    : Math.round(subtotalVal * 0.04);
  const cardTotalVal = subtotalVal + calculatedCardFee;

  const now = new Date();
  const dateStr = now.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  const typeLabel = order.orderType === 'takeout' ? 'Llevar' : (order.tableNumber || 'Mesa');

  const headerTitle = order.isPreAccount ? "PRE-CUENTA / PENDIENTE\n" : "";
  const footerText = order.isPreAccount 
    ? "CUENTA PENDIENTE DE COBRO\nFavor liquidar en caja\n" 
    : "Gracias por su compra!\nVuelva pronto\n";

  let totalsBlock = "";
  if (order.isPreAccount) {
    totalsBlock += format30Columns("Subtotal (Efectivo):", `$${subtotalVal.toFixed(2)}`);
    totalsBlock += format30Columns("Comision Tarjeta (4%):", `+$${calculatedCardFee.toFixed(2)}`);
    totalsBlock += format30Columns("TOTAL C/TARJETA:", `$${cardTotalVal.toFixed(2)}`);
    totalsBlock += "------------------------------\n";
    totalsBlock += ESC + '\x45\x01' + format30Columns("TOTAL A PAGAR:", `$${(order.total || subtotalVal).toFixed(2)}`) + ESC + '\x45\x00';
  } else if (order.paymentMethod === 'card' || (order.cardFee && order.cardFee > 0)) {
    totalsBlock += format30Columns("Subtotal:", `$${subtotalVal.toFixed(2)}`);
    totalsBlock += format30Columns("Comision Tarjeta (4%):", `+$${calculatedCardFee.toFixed(2)}`);
    totalsBlock += "------------------------------\n";
    totalsBlock += ESC + '\x45\x01' + format30Columns("TOTAL TARJETA:", `$${(order.total || cardTotalVal).toFixed(2)}`) + ESC + '\x45\x00';
  } else {
    totalsBlock += ESC + '\x45\x01' + format30Columns("TOTAL:", `$${(order.total || subtotalVal).toFixed(2)}`) + ESC + '\x45\x00';
  }

  const commands =
    ESC + '\x40' +                      // Init
    ESC + '\x33\x12' +                  // Compact line spacing (18 dots)
    ESC + '\x61\x01' +                  // Center
    ESC + '\x45\x01' +                  // Bold ON
    "LAS CAZUELAS DEL CASTOR\n" +
    ESC + '\x45\x00' +                  // Bold OFF
    headerTitle +
    `Folio:#${order.folio || '0'} | ${typeLabel}\n` +
    `Fecha: ${dateStr} ${timeStr}\n` +
    "------------------------------\n" +   // 30 dashes (54mm width)
    ESC + '\x61\x00' +                  // Left
    itemsBody +
    "------------------------------\n" +
    totalsBlock +
    ESC + '\x61\x01' +
    footerText +
    "\n\n";                            // 2 line feeds (~1cm bottom tolerance)

  return new TextEncoder().encode(commands);
}

// Send 54mm Test Ticket over USB Cable
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
      "PRUEBA USB 54MM\n" +
      `Fecha: ${new Date().toLocaleDateString('es-MX')}\n` +
      "------------------------------\n" +   // 30 dashes
      ESC + '\x61\x00' +                  // Left
      format30Columns("Canal:", "Cable USB") +
      format30Columns("Ancho:", "54 mm") +
      format30Columns("Estado:", "Conectado OK") +
      "------------------------------\n" +
      ESC + '\x45\x01' +
      format30Columns("TOTAL:", "$0.00") +
      ESC + '\x45\x00' +
      ESC + '\x61\x01' +
      "Gracias por su compra!\n" +
      "Vuelva pronto\n" +
      "\n\n";

    const bytes = new TextEncoder().encode(commands);
    await sendUsbRawData(bytes);
    return;
  }

  // System print fallback for 54mm
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

// System print helper for 54mm receipt
export function print50x60ViaSystem(ticketData: {
  folio?: string;
  customerName?: string;
  tableNumber?: string;
  orderType?: string;
  items?: Array<{ name: string; quantity: number; price: number; fillings?: string[]; hasExtraCheese?: boolean }>;
  total?: number;
  subtotal?: number;
  cardFee?: number;
  paymentMethod?: string;
  isPreAccount?: boolean;
}): void {
  // Ensure the single active print container exists in document
  let printEl = document.getElementById('print-ticket-active');
  if (!printEl) {
    printEl = document.createElement('div');
    printEl.id = 'print-ticket-active';
    document.body.appendChild(printEl);
  }

  let itemsSum = 0;
  const itemsList = ticketData.items && ticketData.items.length > 0 
    ? ticketData.items.map(it => {
        const lineTotal = (it.price || 0) * (it.quantity || 1);
        itemsSum += lineTotal;
        const extraNote = it.hasExtraCheese ? ' (+Q)' : '';
        return `
          <div style="display: flex; justify-content: space-between; font-size: 11.5px; margin: 3px 0; line-height: 1.25;">
            <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 35mm; font-weight: 600;">${it.quantity} ${it.name}${extraNote}</span>
            <span style="font-weight: bold; font-size: 11.5px;">$${lineTotal.toFixed(0)}</span>
          </div>
        `;
      }).join('')
    : '<div style="text-align: center; font-size: 11px; font-style: italic;">Consumo General</div>';

  if (!itemsSum) itemsSum = ticketData.total || 0;

  const subtotalVal = ticketData.subtotal !== undefined ? ticketData.subtotal : itemsSum;
  const calculatedCardFee = ticketData.cardFee !== undefined 
    ? ticketData.cardFee 
    : Math.round(subtotalVal * 0.04);
  const cardTotalVal = subtotalVal + calculatedCardFee;

  const preAccountHeader = ticketData.isPreAccount 
    ? '<div style="font-weight: 900; font-size: 11px; margin-top: 2px; text-transform: uppercase; border: 1.5px solid #000; padding: 2px 4px; display: inline-block;">PRE-CUENTA / PENDIENTE</div>'
    : '';

  const footerNote = ticketData.isPreAccount
    ? 'Cuenta pendiente de cobro<br/>Favor de liquidar en caja'
    : '¡Gracias por su compra!<br/>Vuelva pronto';

  let totalsHtml = "";
  if (ticketData.isPreAccount) {
    totalsHtml = `
      <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 3px;">
        <span>Subtotal (Efectivo):</span>
        <span>$${subtotalVal.toFixed(2)}</span>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 11px; color: #b45309; margin-bottom: 3px;">
        <span>Comisión Tarjeta (4%):</span>
        <span>+$${calculatedCardFee.toFixed(2)}</span>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 11.5px; font-weight: bold; color: #92400e; margin-bottom: 3px; border-bottom: 1px dashed #000; padding-bottom: 3px;">
        <span>TOTAL CON TARJETA:</span>
        <span>$${cardTotalVal.toFixed(2)}</span>
      </div>
      <div style="display: flex; justify-content: space-between; font-weight: 900; font-size: 13.5px; margin-top: 4px;">
        <span>TOTAL A PAGAR:</span>
        <span>$${(ticketData.total || subtotalVal).toFixed(2)}</span>
      </div>
    `;
  } else if (ticketData.paymentMethod === 'card' || (ticketData.cardFee && ticketData.cardFee > 0)) {
    totalsHtml = `
      <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 3px;">
        <span>Subtotal:</span>
        <span>$${subtotalVal.toFixed(2)}</span>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 3px;">
        <span>Comisión Tarjeta (4%):</span>
        <span>+$${calculatedCardFee.toFixed(2)}</span>
      </div>
      <div style="display: flex; justify-content: space-between; font-weight: 900; font-size: 13.5px; border-top: 1.5px dashed #000; padding-top: 4px;">
        <span>TOTAL TARJETA:</span>
        <span>$${(ticketData.total || cardTotalVal).toFixed(2)}</span>
      </div>
    `;
  } else {
    totalsHtml = `
      <div style="display: flex; justify-content: space-between; font-weight: 900; font-size: 13.5px;">
        <span>TOTAL:</span>
        <span>$${(ticketData.total || subtotalVal).toFixed(2)}</span>
      </div>
    `;
  }

  const now = new Date();
  const dateStr = now.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

  printEl.innerHTML = `
    <div style="text-align: center; margin-bottom: 3px;">
      <img src="/logo_las_cazuelas_del_castor.jpg" alt="Logo Las Cazuelas del Castor" style="width: 22mm; height: 22mm; border-radius: 50%; object-fit: cover; margin: 0 auto 3px auto; display: block; filter: grayscale(100%) contrast(150%); -webkit-filter: grayscale(100%) contrast(150%);" />
      <div style="font-weight: 900; font-size: 12.5px; line-height: 1.2; letter-spacing: -0.2px;">LAS CAZUELAS DEL CASTOR</div>
      ${preAccountHeader}
    </div>
    <div style="text-align: center; font-size: 11.5px; font-weight: bold; margin-top: 2px;">Folio:#${ticketData.folio || '0001'} | ${ticketData.tableNumber || 'Mesa'}</div>
    <div style="text-align: center; font-size: 11px; font-weight: 600; margin-top: 1px;">Fecha: ${dateStr} ${timeStr}</div>
    <div style="border-top: 1.5px dashed #000; margin: 5px 0;"></div>
    <div>${itemsList}</div>
    <div style="border-top: 1.5px dashed #000; margin: 5px 0;"></div>
    ${totalsHtml}
    <div style="text-align: center; font-size: 10.5px; margin-top: 6px; font-style: italic; font-weight: bold; line-height: 1.2;">${footerNote}</div>
  `;

  setTimeout(() => {
    window.print();
  }, 100);
}

// Build ESC/POS bytes for 54mm Sales Report ticket (Daily / Weekly / Monthly)
export function build54mmSalesReportBytes(report: {
  periodLabel: string;
  totalSales: number;
  totalExpenses: number;
  totalTransactions: number;
  averageTicket?: number;
  totalCash?: number;
  totalCard?: number;
  totalTransfer?: number;
}): Uint8Array {
  const ESC = '\x1B';
  const timeStr = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  const dateStr = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const net = (report.totalSales || 0) - (report.totalExpenses || 0);

  let body = "";
  body += format30Columns("Ventas Totales:", `$${(report.totalSales || 0).toFixed(2)}`);
  body += format30Columns("Gastos/Egresos:", `-$${(report.totalExpenses || 0).toFixed(2)}`);
  body += "------------------------------\n";
  body += format30Columns("FLUJO NETO:", `$${net.toFixed(2)}`);
  body += format30Columns("Transacciones:", `${report.totalTransactions || 0}`);
  if (report.averageTicket !== undefined) {
    body += format30Columns("Ticket Promed:", `$${report.averageTicket.toFixed(2)}`);
  }

  if (report.totalCash !== undefined || report.totalCard !== undefined || report.totalTransfer !== undefined) {
    body += "------------------------------\n";
    body += "METODOS DE PAGO:\n";
    if (report.totalCash !== undefined) body += format30Columns("  Efectivo:", `$${report.totalCash.toFixed(2)}`);
    if (report.totalCard !== undefined) body += format30Columns("  Tarjeta:", `$${report.totalCard.toFixed(2)}`);
    if (report.totalTransfer !== undefined) body += format30Columns("  Transfer:", `$${report.totalTransfer.toFixed(2)}`);
  }

  const commands =
    ESC + '\x40' +                      // Init
    ESC + '\x33\x12' +                  // Compact line spacing
    ESC + '\x61\x01' +                  // Center
    ESC + '\x45\x01' +                  // Bold ON
    "LAS CAZUELAS DEL CASTOR\n" +
    ESC + '\x45\x00' +
    "REPORTE GENERAL DE VENTAS\n" +
    `${report.periodLabel}\n` +
    `Emision: ${dateStr} ${timeStr}\n` +
    "------------------------------\n" +
    ESC + '\x61\x00' +                  // Left
    body +
    "------------------------------\n" +
    ESC + '\x61\x01' +                  // Center
    "Fin de Reporte de Ventas\n" +
    "\n\n";                            // 2 line feeds (~1cm bottom tolerance)

  return new TextEncoder().encode(commands);
}

// Print 54mm Sales Report via System Driver
export function print54mmSalesReportViaSystem(report: {
  periodLabel: string;
  totalSales: number;
  totalExpenses: number;
  totalTransactions: number;
  averageTicket?: number;
  totalCash?: number;
  totalCard?: number;
  totalTransfer?: number;
}): void {
  let printEl = document.getElementById('print-ticket-active');
  if (!printEl) {
    printEl = document.createElement('div');
    printEl.id = 'print-ticket-active';
    document.body.appendChild(printEl);
  }

  const net = (report.totalSales || 0) - (report.totalExpenses || 0);
  const timeStr = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  const dateStr = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });

  let breakdownHtml = "";
  if (report.totalCash !== undefined || report.totalCard !== undefined || report.totalTransfer !== undefined) {
    breakdownHtml = `
      <div style="border-top: 1px dashed #000; margin: 4px 0;"></div>
      <div style="font-weight: bold; font-size: 9px; margin-bottom: 2px;">MÉTODOS DE PAGO:</div>
      ${report.totalCash !== undefined ? `<div style="display:flex; justify-content:space-between; font-size:9px;"><span>Efectivo:</span><b>$${report.totalCash.toFixed(2)}</b></div>` : ''}
      ${report.totalCard !== undefined ? `<div style="display:flex; justify-content:space-between; font-size:9px;"><span>Tarjeta:</span><b>$${report.totalCard.toFixed(2)}</b></div>` : ''}
      ${report.totalTransfer !== undefined ? `<div style="display:flex; justify-content:space-between; font-size:9px;"><span>Transfer:</span><b>$${report.totalTransfer.toFixed(2)}</b></div>` : ''}
    `;
  }

  printEl.innerHTML = `
    <div style="text-align: center; margin-bottom: 3px;">
      <img src="/logo_las_cazuelas_del_castor.jpg" alt="Logo" style="width: 22mm; height: 22mm; border-radius: 50%; object-fit: cover; margin: 0 auto 3px auto; display: block; filter: grayscale(100%) contrast(150%);" />
      <div style="font-weight: 900; font-size: 12px; line-height: 1.2;">LAS CAZUELAS DEL CASTOR</div>
      <div style="font-weight: bold; font-size: 11px; margin-top: 2px;">REPORTE GENERAL DE VENTAS</div>
      <div style="font-size: 10.5px; font-weight: bold; color: #111;">${report.periodLabel}</div>
      <div style="font-size: 10px; color: #222; font-weight: 600;">Emisión: ${dateStr} ${timeStr}</div>
    </div>
    <div style="border-top: 1.5px dashed #000; margin: 4px 0;"></div>
    <div style="font-size: 11px; line-height: 1.35;">
      <div style="display: flex; justify-content: space-between;"><span>Ventas Totales:</span><b>$${(report.totalSales || 0).toFixed(2)}</b></div>
      <div style="display: flex; justify-content: space-between;"><span>Gastos / Egresos:</span><b>-$${(report.totalExpenses || 0).toFixed(2)}</b></div>
      <div style="display: flex; justify-content: space-between; font-weight: 900; border-top: 1px solid #000; margin-top: 3px; padding-top: 3px; font-size: 12px;"><span>FLUJO NETO:</span><b>$${net.toFixed(2)}</b></div>
      <div style="display: flex; justify-content: space-between; margin-top: 3px;"><span>Transacciones:</span><b>${report.totalTransactions || 0}</b></div>
      ${report.averageTicket !== undefined ? `<div style="display: flex; justify-content: space-between;"><span>Ticket Promed:</span><b>$${report.averageTicket.toFixed(2)}</b></div>` : ''}
    </div>
    ${breakdownHtml}
    <div style="border-top: 1.5px dashed #000; margin: 4px 0;"></div>
    <div style="text-align: center; font-size: 10px; font-weight: bold;">Fin de Reporte de Ventas</div>
  `;

  setTimeout(() => {
    window.print();
  }, 100);
}
