/**
 * Service to manage Progressive Web App (PWA) installation state,
 * browser events (beforeinstallprompt, appinstalled), and device guidance.
 */

let deferredPrompt = null;
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

  window.addEventListener("beforeinstallprompt", (e) => {
    // Prevent the default mini-infobar or browser banner
    e.preventDefault();
    deferredPrompt = e;
    notifyListeners();
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    notifyListeners();
  });

  if (typeof window.matchMedia === "function") {
    try {
      const mediaQuery = window.matchMedia("(display-mode: standalone)");
      if (typeof mediaQuery.addEventListener === "function") {
        mediaQuery.addEventListener("change", () => notifyListeners());
      } else if (typeof mediaQuery.addListener === "function") {
        mediaQuery.addListener(() => notifyListeners());
      }
    } catch {
      // Ignore older matchMedia listener issues
    }
  }
}

export function getPwaInstallState() {
  const isInstalled = isStandaloneMode();
  const canPrompt = Boolean(deferredPrompt && !isInstalled);
  const platform = detectDevicePlatform();

  return {
    isInstalled,
    canPrompt,
    platform
  };
}

export async function promptPwaInstall() {
  if (!deferredPrompt) {
    return { outcome: "unavailable" };
  }

  try {
    const promptEvent = deferredPrompt;
    await promptEvent.prompt();
    const choiceResult = await promptEvent.userChoice;
    
    if (choiceResult && choiceResult.outcome === "accepted") {
      deferredPrompt = null;
      notifyListeners();
      return { outcome: "accepted" };
    }

    notifyListeners();
    return { outcome: "dismissed" };
  } catch (error) {
    console.error("Error triggering PWA prompt:", error);
    return { outcome: "error", error };
  }
}

export function subscribePwaInstallState(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}
