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

export function showConfirmModal({
  title = "Konfirmasi Tindakan",
  message = "Apakah Anda yakin ingin melanjutkan tindakan ini?",
  confirmText = "Hapus Permanen",
  cancelText = "Batal",
  danger = true
} = {}) {
  return new Promise((resolve) => {
    if (typeof document === "undefined" || !document.body) {
      resolve(true);
      return;
    }

    const existing = document.querySelector(".confirm-dialog-backdrop");
    if (existing) {
      existing.remove();
    }

    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop confirm-dialog-backdrop";
    backdrop.style.zIndex = "99999";
    backdrop.style.position = "fixed";
    backdrop.style.inset = "0";

    const modal = document.createElement("div");
    modal.className = "modal-card confirm-dialog-card";
    modal.style.maxWidth = "460px";
    modal.style.margin = "auto";
    modal.setAttribute("role", "alertdialog");
    modal.setAttribute("aria-modal", "true");

    const headerRow = document.createElement("div");
    headerRow.className = "modal-header-row";

    const titleEl = document.createElement("h3");
    titleEl.className = "modal-title";
    titleEl.style.fontSize = "1.15rem";
    titleEl.style.fontWeight = "800";
    titleEl.style.margin = "0";
    titleEl.style.color = danger ? "var(--color-danger, #DC2626)" : "var(--color-text)";
    titleEl.textContent = title;

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "modal-close-btn";
    closeBtn.textContent = "✕";
    closeBtn.setAttribute("aria-label", "Tutup");

    headerRow.append(titleEl, closeBtn);

    const body = document.createElement("div");
    body.className = "confirm-dialog-body";
    body.style.margin = "14px 0 20px";

    const msgParagraph = document.createElement("p");
    msgParagraph.style.whiteSpace = "pre-line";
    msgParagraph.style.lineHeight = "1.5";
    msgParagraph.style.fontSize = "0.95rem";
    msgParagraph.style.color = "var(--color-text)";
    msgParagraph.textContent = message;
    body.append(msgParagraph);

    const footer = document.createElement("div");
    footer.className = "confirm-dialog-actions";
    footer.style.display = "flex";
    footer.style.gap = "10px";
    footer.style.justifyContent = "flex-end";
    footer.style.flexWrap = "wrap";
    footer.style.marginTop = "16px";

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "btn-tool compact-action";
    cancelBtn.style.minWidth = "90px";
    cancelBtn.style.cursor = "pointer";
    cancelBtn.textContent = cancelText;

    const confirmBtn = document.createElement("button");
    confirmBtn.type = "button";
    confirmBtn.className = danger
      ? "btn-tool btn-tool-danger compact-action"
      : "primary-action compact-action";
    confirmBtn.style.minWidth = "130px";
    confirmBtn.style.cursor = "pointer";
    confirmBtn.textContent = confirmText;

    footer.append(cancelBtn, confirmBtn);

    modal.append(headerRow, body, footer);
    backdrop.append(modal);
    document.body.appendChild(backdrop);

    let isHandled = false;
    let isExecuting = false;

    function cleanup(result) {
      if (isHandled) return;
      isHandled = true;
      if (backdrop.parentNode) {
        backdrop.parentNode.removeChild(backdrop);
      }
      resolve(result);
    }

    cancelBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      cleanup(false);
    });

    closeBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      cleanup(false);
    });

    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) {
        cleanup(false);
      }
    });

    confirmBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (isExecuting) return; // Cegah eksekusi ganda
      isExecuting = true;
      confirmBtn.disabled = true;
      cancelBtn.disabled = true;
      closeBtn.disabled = true;
      confirmBtn.style.opacity = "0.6";
      confirmBtn.style.cursor = "not-allowed";
      confirmBtn.textContent = "Menghapus...";
      cleanup(true);
    });
  });
}
