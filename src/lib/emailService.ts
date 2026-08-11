import toast from "react-hot-toast";

export interface MovementEmailData {
  id?: string;
  type: 'income' | 'expense' | 'egress' | 'opening' | 'closing' | 'audit' | string;
  amount: number;
  reason: string;
  userName?: string;
  userId?: string;
  timestamp?: string;
  paymentMethod?: string;
  clientName?: string | null;
  itemsSummary?: any[];
  [key: string]: any;
}

const QUEUE_STORAGE_KEY = "pending_movement_emails_queue";

// Helper to get pending queue from localStorage
export function getPendingEmailsQueue(): MovementEmailData[] {
  try {
    const raw = localStorage.getItem(QUEUE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error("Error reading pending emails queue:", e);
    return [];
  }
}

// Helper to save queue
function savePendingEmailsQueue(queue: MovementEmailData[]) {
  try {
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.error("Error saving pending emails queue:", e);
  }
}

/**
 * Sends a movement / payment email notification immediately if online,
 * or queues it if offline or request fails.
 */
export async function sendMovementNotification(
  data: MovementEmailData,
  options: { quiet?: boolean } = {}
): Promise<{ success: boolean; status: 'sent' | 'queued' | 'warning' | 'error'; message: string }> {
  const logId = data.id || `LOG-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const payloadData = { ...data, id: logId, timestamp: data.timestamp || new Date().toISOString() };

  // Check if offline before attempting
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    enqueueEmail(payloadData);
    if (!options.quiet) {
      toast("📶 Sin conexión. Notificación por correo guardada en espera (se enviará al reconectar).", {
        icon: "📬",
        duration: 4000
      });
    }
    return {
      success: true,
      status: 'queued',
      message: 'Sin conexión a internet. Guardado en cola de envío.'
    };
  }

  try {
    const response = await fetch("/api/send-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ logId, data: payloadData })
    });

    if (!response.ok) {
      throw new Error(`Server returned status ${response.status}`);
    }

    const resData = await response.json();
    
    if (resData.success) {
      if (!options.quiet) {
        toast.success("📧 Notificación por correo enviada a lascazuelasbosques@gmail.com", {
          id: `email-sent-${logId}`,
          duration: 3500
        });
      }
      return {
        success: true,
        status: 'sent',
        message: 'Correo enviado satisfactoriamente.'
      };
    } else {
      throw new Error(resData.error || "Error al enviar correo");
    }
  } catch (err: any) {
    console.warn("[EmailService] Failed to send email online, queuing for retry:", err?.message || err);
    enqueueEmail(payloadData);
    if (!options.quiet) {
      toast("📶 Error de envío. Notificación por correo puesta en espera para reintento automático.", {
        icon: "📥",
        duration: 4000
      });
    }
    return {
      success: true,
      status: 'queued',
      message: 'Puesto en cola por fallo de conexión.'
    };
  }
}

// Add item to queue preventing duplicates
function enqueueEmail(data: MovementEmailData) {
  const queue = getPendingEmailsQueue();
  const exists = queue.some(
    item => item.id === data.id || (item.timestamp === data.timestamp && item.amount === data.amount && item.reason === data.reason)
  );
  if (!exists) {
    queue.push(data);
    savePendingEmailsQueue(queue);
  }
}

/**
 * Flush/process all queued emails
 */
export async function processPendingEmails(): Promise<number> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return 0;

  const queue = getPendingEmailsQueue();
  if (queue.length === 0) return 0;

  console.log(`[EmailService] Processing ${queue.length} pending email(s) in queue...`);
  const remainingQueue: MovementEmailData[] = [];
  let successCount = 0;

  for (const item of queue) {
    try {
      const response = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logId: item.id || `LOG-${Date.now()}`, data: item })
      });

      if (response.ok) {
        const resData = await response.json();
        if (resData.success) {
          successCount++;
          continue;
        }
      }
      remainingQueue.push(item);
    } catch (err) {
      console.warn("[EmailService] Retry failed for queued email:", err);
      remainingQueue.push(item);
    }
  }

  savePendingEmailsQueue(remainingQueue);

  if (successCount > 0) {
    toast.success(`📧 Se enviaron ${successCount} correo(s) de notificación que estaban en espera.`, {
      id: "pending-emails-flushed",
      duration: 5000
    });
  }

  return successCount;
}

// Setup automatic online listener
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    console.log("[EmailService] Device reconnected online. Flushing email queue...");
    processPendingEmails();
  });

  // Try processing queue on initial startup
  setTimeout(() => {
    processPendingEmails();
  }, 2500);
}
