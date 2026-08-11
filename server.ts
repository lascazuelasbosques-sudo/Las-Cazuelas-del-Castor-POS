import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import nodemailer from "nodemailer";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

dotenv.config();

const PORT = 3000;

// Read Firebase Config safely from project root
const configPath = path.join(process.cwd(), "firebase-applet-config.json");
let firebaseConfig: any = {};
try {
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  } else {
    console.warn("firebase-applet-config.json not found. Firestore background listener disabled.");
  }
} catch (err) {
  console.error("Error reading firebase-applet-config.json:", err);
}

// Format Currency Utility (Match client format)
const formatCurrency = (val: number | string) => {
  const num = typeof val === "number" ? val : parseFloat(val || "0");
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(num);
};

// Start Express Server
async function startServer() {
  const app = express();
  app.use(express.json());

  // API Check/Health route
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", service: "Las Cazuelas Cash Audit Notifier" });
  });

  // API Route to send a test email & create a test cash movement
  app.post("/api/send-test-email", async (req, res) => {
    try {
      const testData = {
        timestamp: new Date().toISOString(),
        userId: "admin-test",
        userName: "Administrador (Prueba)",
        amount: 350.00,
        type: "income",
        reason: "Prueba de notificación por correo en tiempo real",
        paymentMethod: "cash"
      };

      // Add to Firestore cashLogs if available
      let testLogId = "TEST-" + Date.now();
      if (firebaseConfig.projectId) {
        try {
          const db = getFirestore(firebaseConfig.firestoreDatabaseId);
          const docRef = await db.collection("cashLogs").add(testData);
          testLogId = docRef.id;
        } catch (dbErr: any) {
          console.warn("[Test Email] No se pudo escribir en Firestore con Admin SDK, usando ID simulado:", dbErr?.message || dbErr);
        }
      }

      // Trigger email sending
      const result = await sendMovementEmail(testLogId, testData);

      res.json({
        success: true,
        message: "Correo de prueba procesado",
        logId: testLogId,
        details: result
      });
    } catch (err: any) {
      console.error("Error sending test email:", err);
      res.status(500).json({ success: false, error: err?.message || String(err) });
    }
  });

  // --- BACKGROUND ROUTINE: FIRESTORE LIVE AUDIT LISTENER ---
  if (firebaseConfig.projectId) {
    try {
      // Initialize Firebase Admin App if not already initialized
      if (getApps().length === 0) {
        initializeApp({
          projectId: firebaseConfig.projectId,
        });
      }
      // Use firestore database ID from configuration
      const db = getFirestore(firebaseConfig.firestoreDatabaseId);

      // We establish a marker time when the server booted to ignore old transactions.
      const serverStartTime = new Date().toISOString();
      console.log(`[Segundo Plano] Rutina iniciada a las ${new Date().toLocaleString("es-MX")}. Ignorando movimientos anteriores a: ${serverStartTime}`);

      const processedLogs = new Set<string>();

      // Listen to cashLogs collection
      const cashLogsCol = db.collection("cashLogs");
      const logsQuery = cashLogsCol.orderBy("timestamp", "desc").limit(10);

      logsQuery.onSnapshot((snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === "added") {
            const docId = change.doc.id;
            const data = change.doc.data();
            
            // Skip if already processed
            if (processedLogs.has(docId)) return;
            processedLogs.add(docId);

            // Skip records that were created before the server started
            if (!data.timestamp || data.timestamp < serverStartTime) {
              return;
            }

            console.log(`[Segundo Plano] ¡Nuevo movimiento detectado! ID: ${docId}, Tipo: ${data.type}, Monto: ${data.amount}`);
            
            // Execute email dispatch in the background
            sendMovementEmail(docId, data).catch((err) => {
              console.warn(`[Segundo Plano] Advertencia procesando correo para ${docId}:`, err);
            });
          }
        });
      }, (err) => {
        console.error("[Segundo Plano] Error en el listener de Firestore:", err);
      });

    } catch (fbErr) {
      console.error("[Segundo Plano] Error inicializando listener de Firebase:", fbErr);
    }
  }

  // Vite middleware setup (Required for AI Studio Preview Routing)
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

// Send Email Utility
async function sendMovementEmail(logId: string, data: any) {
  const mailTo = "lascazuelasbosques@gmail.com";
  
  // SMTP credentials
  const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
  const smtpPort = parseInt(process.env.SMTP_PORT || "587");
  const smtpUser = process.env.SMTP_USER || "lascazuelasbosques@gmail.com";
  const passInput = process.env.SMTP_PASS || "voptetcuaoyyinul";
  const smtpPass = (passInput.length === 16 || !passInput.includes("@") ? passInput : "voptetcuaoyyinul").replace(/\s+/g, "");

  // Pretty Type Title
  let typeDisplay = "Movimiento General";
  let typeBadgeColor = "#78716c"; // stone
  let isPositive = false;

  const rawType = String(data.type || "").toLowerCase();
  if (rawType === "income") {
    typeDisplay = "Entrada de Caja (Ingreso)";
    typeBadgeColor = "#15803d"; // green-700
    isPositive = true;
  } else if (rawType === "expense" || rawType === "egress") {
    typeDisplay = "Salida de Caja (Egreso)";
    typeBadgeColor = "#b91c1c"; // red-700
  } else if (rawType === "opening") {
    typeDisplay = "Apertura de Caja";
    typeBadgeColor = "#0369a1"; // sky-700
    isPositive = true;
  } else if (rawType === "closing") {
    typeDisplay = "Cierre de Caja";
    typeBadgeColor = "#0f172a"; // slate-900
  }

  const formattedAmount = formatCurrency(data.amount || 0);
  const formattedDate = data.timestamp 
    ? new Date(data.timestamp).toLocaleString("es-MX", { timeZone: "America/Mexico_City" }) 
    : new Date().toLocaleString("es-MX");

  const subject = `[Las Cazuelas] ${typeDisplay} - ${formattedAmount}`;

  // Build clean, highly professional HTML template (Elegant Rústico/Mexicano modern scheme)
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          background-color: #f5f5f4;
          margin: 0;
          padding: 20px;
          color: #292524;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          background-color: #ffffff;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
          border: 1px solid #e7e5e4;
        }
        .header {
          background-color: #5c1d1a; /* Warm premium maroon */
          color: #ffffff;
          padding: 24px;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 22px;
          font-weight: 700;
          letter-spacing: 0.5px;
        }
        .header p {
          margin: 4px 0 0 0;
          font-size: 13px;
          opacity: 0.85;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .content {
          padding: 30px;
        }
        .badge {
          display: inline-block;
          padding: 6px 12px;
          border-radius: 50px;
          color: #ffffff;
          font-size: 11px;
          font-weight: bold;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          background-color: ${typeBadgeColor};
          margin-bottom: 20px;
        }
        .amount-card {
          background-color: #fafaf9;
          border-radius: 12px;
          padding: 20px;
          border: 1px solid #e7e5e4;
          text-align: center;
          margin-bottom: 25px;
        }
        .amount-card .label {
          font-size: 11px;
          text-transform: uppercase;
          color: #78716c;
          font-weight: bold;
          letter-spacing: 1px;
        }
        .amount-card .value {
          font-size: 32px;
          font-weight: 800;
          color: ${isPositive ? "#15803d" : "#b91c1c"};
          margin: 6px 0 0 0;
        }
        .details-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
        }
        .details-table td {
          padding: 12px 0;
          border-bottom: 1px solid #f5f5f4;
          font-size: 14px;
        }
        .details-table td.label {
          color: #78716c;
          font-weight: 600;
          width: 140px;
        }
        .details-table td.value {
          color: #1c1917;
          font-weight: 500;
          text-align: right;
        }
        .reason-box {
          background-color: #fef3c7; /* Subtle elegant amber */
          border-left: 4px solid #d97706;
          padding: 14px;
          border-radius: 4px 12px 12px 4px;
          margin-top: 15px;
          font-size: 13.5px;
          line-height: 1.5;
          color: #78350f;
        }
        .reason-title {
          font-weight: bold;
          margin-bottom: 4px;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .footer {
          background-color: #fafaf9;
          padding: 20px;
          text-align: center;
          border-top: 1px solid #e7e5e4;
          font-size: 11px;
          color: #a8a29e;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Las Cazuelas Bosques</h1>
          <p>Control de Auditoría y Flujo de Caja</p>
        </div>
        <div class="content">
          <div style="text-align: center;">
            <span class="badge">${typeDisplay}</span>
          </div>
          
          <div class="amount-card">
            <div class="label">Monto del Movimiento</div>
            <div class="value">${formattedAmount}</div>
          </div>

          <table class="details-table">
            <tr>
              <td class="label">Concepto</td>
              <td class="value" style="font-weight: bold; color: #5c1d1a;">${data.reason || "Movimiento registrado"}</td>
            </tr>
            <tr>
              <td class="label">Fecha y Hora</td>
              <td class="value">${formattedDate}</td>
            </tr>
            <tr>
              <td class="label">Registrado por</td>
              <td class="value">${data.userName || "Usuario del Sistema"}</td>
            </tr>
            ${data.paymentMethod ? `
            <tr>
              <td class="label">Método de Pago</td>
              <td class="value" style="text-transform: capitalize;">${data.paymentMethod === "cash" ? "Efectivo" : data.paymentMethod === "card" ? "Tarjeta" : data.paymentMethod === "transfer" ? "Transferencia" : data.paymentMethod}</td>
            </tr>
            ` : ""}
            <tr>
              <td class="label">ID de Registro</td>
              <td class="value" style="font-family: monospace; font-size: 11px; color: #a8a29e;">${logId}</td>
            </tr>
          </table>

          ${data.reason ? `
            <div class="reason-box">
              <div class="reason-title">Detalle / Motivo del Movimiento</div>
              <div>${data.reason}</div>
            </div>
          ` : ""}
        </div>
        <div class="footer">
          Este es un correo de notificación automática enviado en tiempo real por el sistema de control de caja de Las Cazuelas Bosques.<br>
          Por favor, no respondas a este mensaje.
        </div>
      </div>
    </body>
    </html>
  `;

  if (!smtpUser || !smtpPass) {
    const simMsg = `Credenciales SMTP no configuradas en .env. Simulación de correo generada para ${mailTo} (${subject}).`;
    console.log(`[Segundo Plano] [SIMULACIÓN CORREO] ${simMsg}`);
    return {
      status: "simulated",
      recipient: mailTo,
      subject: subject,
      note: "Para realizar envíos reales, configura SMTP_USER y SMTP_PASS en el panel de Secrets / .env"
    };
  }

  // Initialize SMTP Transporter
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  const mailOptions = {
    from: `"Las Cazuelas Bosques Audits" <${smtpUser}>`,
    to: mailTo,
    subject: subject,
    html: htmlContent,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[Segundo Plano] Correo enviado exitosamente para log ${logId}. MessageId: ${info.messageId}`);
    return {
      status: "sent",
      recipient: mailTo,
      subject: subject,
      messageId: info.messageId
    };
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      console.warn(`[Segundo Plano] Advertencia al enviar correo SMTP:`, errMsg);
      if (errMsg.includes("534") || errMsg.includes("Application-specific password required") || errMsg.includes("InvalidSecondFactor")) {
        return {
          status: "warning",
          errorType: "GMAIL_APP_PASSWORD_REQUIRED",
          recipient: mailTo,
          subject: subject,
          message: "Notificación procesada en servidor. Para envíos reales por Gmail, activa la 'Contraseña de aplicación' de 16 caracteres en myaccount.google.com -> Seguridad.",
          rawError: errMsg
        };
      }
      return {
        status: "warning",
        recipient: mailTo,
        subject: subject,
        rawError: errMsg
      };
    }
}

startServer();
