// Centralized non-blocking toast feedback and unsaved form guard
let currentDirtyGuard = null;

export function registerDirtyGuard(guardFn) {
  currentDirtyGuard = guardFn;
}

export function unregisterDirtyGuard() {
  currentDirtyGuard = null;
}

export function isFormDirty() {
  if (typeof currentDirtyGuard === "function") {
    try {
      return Boolean(currentDirtyGuard());
    } catch (_) {
      return false;
    }
  }
  return false;
}

export function confirmIfDirty() {
  if (isFormDirty()) {
    const ok = window.confirm("Ada perubahan yang belum disimpan.\n\nKeluar tanpa menyimpan?");
    if (ok) {
      unregisterDirtyGuard();
      return true;
    }
    return false;
  }
  return true;
}

export function showToast(message, durationMs = 2200) {
  if (typeof document === "undefined") return;
  const existing = document.querySelector(".app-toast");
  if (existing) {
    existing.remove();
  }
  const toast = document.createElement("div");
  toast.className = "app-toast";
  toast.setAttribute("role", "status");
  toast.setAttribute("aria-live", "polite");
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => {
    if (toast.parentNode) {
      toast.remove();
    }
  }, durationMs);
}
