// ============================================================
// tracking.js — Precifica3D Login Tracker (Desktop + Mobile)
// Salva no Firestore: dispositivo, browser, OS, IP, histórico
// ============================================================

// ── Detecção de User Agent ────────────────────────────────────

function detectDevice(ua) {
  if (/iPad|tablet|Tablet/i.test(ua)) return "Tablet";
  if (/iPhone|Android.*Mobile|Mobile/i.test(ua)) return "Mobile";
  return "Desktop";
}

function detectBrowser(ua) {
  if (/Edg\//i.test(ua))     return { name: "Edge",    version: ua.match(/Edg\/([\d.]+)/)?.[1] || "" };
  if (/OPR\//i.test(ua))     return { name: "Opera",   version: ua.match(/OPR\/([\d.]+)/)?.[1] || "" };
  if (/Chrome\//i.test(ua))  return { name: "Chrome",  version: ua.match(/Chrome\/([\d.]+)/)?.[1] || "" };
  if (/Firefox\//i.test(ua)) return { name: "Firefox", version: ua.match(/Firefox\/([\d.]+)/)?.[1] || "" };
  if (/Safari\//i.test(ua))  return { name: "Safari",  version: ua.match(/Version\/([\d.]+)/)?.[1] || "" };
  if (/MSIE|Trident/i.test(ua)) return { name: "IE",  version: ua.match(/(?:MSIE |rv:)([\d.]+)/)?.[1] || "" };
  return { name: "Desconhecido", version: "" };
}

function detectOS(ua) {
  if (/Windows NT 10/i.test(ua))  return { name: "Windows", version: "10/11" };
  if (/Windows NT 6\.3/i.test(ua))return { name: "Windows", version: "8.1" };
  if (/Windows NT 6\.1/i.test(ua))return { name: "Windows", version: "7" };
  if (/Windows/i.test(ua))        return { name: "Windows", version: "" };
  if (/iPhone OS ([\d_]+)/i.test(ua)) return { name: "iOS", version: ua.match(/iPhone OS ([\d_]+)/i)?.[1]?.replace(/_/g, ".") || "" };
  if (/iPad.*OS ([\d_]+)/i.test(ua))  return { name: "iPadOS", version: ua.match(/OS ([\d_]+)/i)?.[1]?.replace(/_/g, ".") || "" };
  if (/Android ([\d.]+)/i.test(ua))   return { name: "Android", version: ua.match(/Android ([\d.]+)/i)?.[1] || "" };
  if (/Mac OS X ([\d_]+)/i.test(ua))  return { name: "macOS", version: ua.match(/Mac OS X ([\d_]+)/i)?.[1]?.replace(/_/g, ".") || "" };
  if (/Linux/i.test(ua))  return { name: "Linux", version: "" };
  return { name: "Desconhecido", version: "" };
}

function detectScreenInfo() {
  return {
    width: window.screen?.width || 0,
    height: window.screen?.height || 0,
    pixelRatio: window.devicePixelRatio || 1,
    orientation: screen?.orientation?.type || (window.innerWidth > window.innerHeight ? "landscape" : "portrait")
  };
}

// ── IP público ────────────────────────────────────────────────

async function getPublicIP() {
  try {
    const res = await fetch("https://api.ipify.org?format=json", { signal: AbortSignal.timeout(4000) });
    const data = await res.json();
    return data.ip || "N/A";
  } catch {
    return "N/A";
  }
}

// ── Função principal de tracking ──────────────────────────────

async function trackLogin(db, userId, userEmail) {
  const ua = navigator.userAgent;
  const browser = detectBrowser(ua);
  const os = detectOS(ua);
  const device = detectDevice(ua);
  const screen = detectScreenInfo();
  const ip = await getPublicIP();

  const now = new Date();
  const loginEntry = {
    timestamp: now.toISOString(),
    timestampMs: now.getTime(),
    ip,
    device,
    browser: `${browser.name} ${browser.version}`.trim(),
    browserName: browser.name,
    browserVersion: browser.version,
    os: `${os.name} ${os.version}`.trim(),
    osName: os.name,
    osVersion: os.version,
    screen,
    userAgent: ua,
    language: navigator.language || "N/A",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "N/A",
    online: navigator.onLine,
  };

  try {
    // Referência ao documento do usuário
    const userRef = db.collection("login_tracking").doc(userId);
    const userSnap = await userRef.get();

    if (userSnap.exists) {
      // Usuário já existe — adiciona ao histórico e atualiza último login
      const existing = userSnap.data();
      const history = existing.loginHistory || [];
      history.unshift(loginEntry); // mais recente primeiro

      // Limita histórico a 50 entradas
      const trimmedHistory = history.slice(0, 50);

      await userRef.update({
        email: userEmail,
        lastLogin: loginEntry,
        loginHistory: trimmedHistory,
        loginCount: (existing.loginCount || 0) + 1,
        updatedAt: now.toISOString(),
      });
    } else {
      // Primeiro login do usuário
      await userRef.set({
        userId,
        email: userEmail,
        firstLogin: loginEntry,
        lastLogin: loginEntry,
        loginHistory: [loginEntry],
        loginCount: 1,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      });
    }

    console.log("[Precifica3D] Login tracking salvo com sucesso.");
    return loginEntry;
  } catch (err) {
    console.error("[Precifica3D] Erro ao salvar tracking:", err);
    return null;
  }
}

// ── Listener de Auth para auto-tracking ───────────────────────

function initTracking(firebase) {
  const db = firebase.firestore();
  const auth = firebase.auth();

  auth.onAuthStateChanged(async (user) => {
    if (user) {
      await trackLogin(db, user.uid, user.email);
    }
  });
}

// ── Exportações ───────────────────────────────────────────────
// Para uso modular:
// export { initTracking, trackLogin, detectDevice, detectBrowser, detectOS };

// Para uso via <script> clássico (window global):
window.Precifica3DTracking = { initTracking, trackLogin, detectDevice, detectBrowser, detectOS };
