/**
 * Service to manage Progressive Web App (PWA) installation state,
 * browser events (beforeinstallprompt, appinstalled), and device guidance.
 */

let deferredPrompt = null;
let installStatus = "unsupported"; // 'ready' | 'waiting_confirmation' | 'dismissed' | 'installed' | 'unsupported'
let isPrompting = false;
const listeners = new Set();
let isInitialized = false;

function notifyListeners() {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch (err) {
      console.warn("PWA install listener error:", err);
    }
  });
}

export function isStandaloneMode() {
  if (typeof window === "undefined") return false;

  const matchesDisplayMode =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(display-mode: standalone)").matches;

  const navigatorStandalone =
    typeof navigator !== "undefined" &&
    Boolean(navigator.standalone);

  return Boolean(matchesDisplayMode || navigatorStandalone);
}

export function detectDevicePlatform() {
  if (typeof navigator === "undefined") {
    return { isIOS: false, isAndroid: false, isDesktop: true, isChrome: false, isSafari: false };
  }

  const ua = (navigator.userAgent || "").toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isAndroid = /android/.test(ua);
  const isSafari = /safari/.test(ua) && !/chrome|crios|crmo|android/.test(ua);
  const isChrome = /chrome|crios|crmo/.test(ua);
  const isDesktop = !isIOS && !isAndroid;

  return {
    isIOS,
    isAndroid,
    isDesktop,
    isChrome,
    isSafari
  };
}

export function initPwaInstallService() {
  if (typeof window === "undefined" || isInitialized) {
    return;
  }
  isInitialized = true;

  if (isStandaloneMode()) {
    installStatus = "installed";
  }

  window.addEventListener("beforeinstallprompt", (e) => {
    // Prevent the default mini-infobar or browser banner
    e.preventDefault();
    deferredPrompt = e;
    installStatus = "ready";
    notifyListeners();
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    isPrompting = false;
    installStatus = "installed";
    notifyListeners();
  });

  if (typeof window.matchMedia === "function") {
    try {
      const mediaQuery = window.matchMedia("(display-mode: standalone)");
      const onMediaChange = (evt) => {
        if (evt.matches) {
          installStatus = "installed";
          deferredPrompt = null;
        }
        notifyListeners();
      };
      if (typeof mediaQuery.addEventListener === "function") {
        mediaQuery.addEventListener("change", onMediaChange);
      } else if (typeof mediaQuery.addListener === "function") {
        mediaQuery.addListener(onMediaChange);
      }
    } catch {
      // Ignore older matchMedia listener issues
    }
  }
}

export function getPwaInstallState() {
  const isInstalled = isStandaloneMode() || installStatus === "installed";
  let status = installStatus;
  if (isInstalled) {
    status = "installed";
  } else if (isPrompting) {
    status = "waiting_confirmation";
  } else if (deferredPrompt) {
    status = "ready";
  } else if (installStatus === "dismissed") {
    status = "dismissed";
  } else {
    status = "unsupported";
  }

  const canPrompt = Boolean(deferredPrompt && !isInstalled);
  const platform = detectDevicePlatform();

  return {
    isInstalled,
    canPrompt,
    status,
    platform
  };
}

export async function promptPwaInstall() {
  const isInstalled = isStandaloneMode() || installStatus === "installed";
  if (isInstalled) {
    installStatus = "installed";
    notifyListeners();
    return { outcome: "already_installed" };
  }

  if (!deferredPrompt) {
    installStatus = "unsupported";
    notifyListeners();
    return { outcome: "unavailable" };
  }

  const promptEvent = deferredPrompt;
  // Crucial: Clear deferredPrompt so it cannot be used twice
  deferredPrompt = null;
  isPrompting = true;
  installStatus = "waiting_confirmation";
  notifyListeners();

  try {
    await promptEvent.prompt();
    const choiceResult = await promptEvent.userChoice;
    isPrompting = false;

    if (choiceResult && choiceResult.outcome === "accepted") {
      // User accepted the prompt, awaiting actual installation
      installStatus = "waiting_confirmation";
      notifyListeners();
      return { outcome: "accepted" };
    } else {
      installStatus = "dismissed";
      notifyListeners();
      return { outcome: "dismissed" };
    }
  } catch (error) {
    isPrompting = false;
    deferredPrompt = null;
    installStatus = "unsupported";
    notifyListeners();
    console.error("Error triggering PWA prompt:", error);
    return { outcome: "error", error };
  }
}

export function subscribePwaInstallState(callback) {
  if (typeof callback !== "function") return () => {};
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

export function getPwaListenerCount() {
  return listeners.size;
}

export function getPwaDiagnostics() {
  const isInstalled = isStandaloneMode() || installStatus === "installed";
  const platform = detectDevicePlatform();
  const promptAvailable = Boolean(deferredPrompt && !isInstalled);

  const isSecure = typeof window !== "undefined" && typeof location !== "undefined"
    ? Boolean(
        window.isSecureContext ||
        location.protocol === "https:" ||
        location.hostname === "localhost" ||
        location.hostname === "127.0.0.1"
      )
    : true;

  const swSupported = typeof navigator !== "undefined" && "serviceWorker" in navigator;
  const swActive = Boolean(
    typeof navigator !== "undefined" &&
    navigator.serviceWorker &&
    navigator.serviceWorker.controller
  );

  const manifestLinked = typeof document !== "undefined" && typeof document.querySelector === "function"
    ? Boolean(document.querySelector('link[rel="manifest"]'))
    : true;

  const iconsLinked = typeof document !== "undefined" && typeof document.querySelector === "function"
    ? Boolean(document.querySelector('link[rel*="icon"]'))
    : true;

  const checks = [
    {
      id: "standalone",
      label: "Status Mode Standalone",
      ok: isInstalled,
      detail: isInstalled
        ? "Aplikasi berjalan dalam mode mandiri/terpasang."
        : "Aplikasi sedang dibuka dalam tab browser biasa."
    },
    {
      id: "secure",
      label: "Konteks Aman (HTTPS / Localhost)",
      ok: isSecure,
      detail: isSecure
        ? "Protokol aman aktif, memenuhi syarat instalasi PWA."
        : "Aplikasi tidak diakses melalui protokol aman (HTTPS atau localhost)."
    },
    {
      id: "manifest",
      label: "Web App Manifest",
      ok: manifestLinked,
      detail: manifestLinked
        ? "File manifest.webmanifest terhubung di HTML dengan konfigurasi lengkap."
        : "Tag link manifest tidak ditemukan di dokumen HTML."
    },
    {
      id: "icons",
      label: "Ikon Aplikasi (PNG 192 & 512)",
      ok: iconsLinked,
      detail: iconsLinked
        ? "Tag ikon terdefinisi di header aplikasi untuk tampilan layar utama."
        : "Tag ikon aplikasi tidak ditemukan di header dokumen."
    },
    {
      id: "service_worker",
      label: "Service Worker & Offline",
      ok: swSupported,
      detail: swSupported
        ? (swActive
            ? "Service Worker aktif untuk pengelolaan cache aset offline."
            : "Service Worker didukung oleh browser.")
        : "Browser saat ini tidak mendukung Service Worker."
    },
    {
      id: "prompt",
      label: "Event Pemasangan Browser (beforeinstallprompt)",
      ok: promptAvailable,
      detail: promptAvailable
        ? "Event instalasi browser siap memicu dialog langsung satu-klik."
        : (platform.isIOS
            ? "Safari di iOS tidak menyediakan event pemasangan otomatis. Gunakan tombol Bagikan → Tambah ke Layar Utama."
            : "Browser belum menerbitkan event pemasangan otomatis. Anda dapat memasang melalui menu browser atau mengikuti langkah di bawah.")
    }
  ];

  let reason = "";
  if (isInstalled) {
    reason = "Aplikasi sudah terpasang di perangkat Anda.";
  } else if (!isSecure) {
    reason = "Koneksi tidak menggunakan protokol aman (HTTPS/localhost).";
  } else if (!promptAvailable) {
    if (platform.isIOS) {
      reason = "iOS Safari tidak menyediakan pemicuan dialog otomatis via tombol web. Pemasangan dilakukan melalui menu Bagikan di bilah Safari.";
    } else if (platform.isDesktop) {
      reason = "Browser desktop belum memicu event dialog otomatis. Anda dapat memasangnya lewat ikon di bilah alamat (address bar) atau menu titik tiga browser.";
    } else {
      reason = "Browser belum memicu event dialog otomatis. Anda dapat memasangnya lewat menu titik tiga Chrome → 'Instal aplikasi'.";
    }
  }

  return {
    isInstalled,
    isSecure,
    swSupported,
    swActive,
    manifestLinked,
    iconsLinked,
    promptAvailable,
    platform,
    checks,
    reason
  };
}

// Test hooks
export function _setDeferredPromptForTesting(event) {
  deferredPrompt = event;
  installStatus = event ? "ready" : "unsupported";
  isPrompting = false;
  notifyListeners();
}

export function _setInstalledForTesting(installed) {
  installStatus = installed ? "installed" : "unsupported";
  if (installed) {
    deferredPrompt = null;
  }
  isPrompting = false;
  notifyListeners();
}

export function _resetPwaInstallServiceForTesting() {
  deferredPrompt = null;
  installStatus = "unsupported";
  isPrompting = false;
  listeners.clear();
}
