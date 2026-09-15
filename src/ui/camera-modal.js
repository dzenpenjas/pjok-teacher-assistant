import {
  startCameraStream,
  stopCameraStream,
  captureFrameFromVideo,
  compressImageFile,
  getAvailableCameraCount
} from "../services/camera-service.js";
import { ICONS } from "./icons.js";

/**
 * Open camera capture modal.
 *
 * @param {Object} options
 * @param {Function} options.onCapture - callback(base64DataUrl) when photo is confirmed
 * @param {Function} [options.onCancel] - optional callback on cancel
 * @param {string} [options.title] - modal title
 */
export function openCameraModal({ onCapture, onCancel, title = "Ambil Foto Siswa" }) {
  // Prevent duplicate modals
  const existingBackdrop = document.querySelector(".camera-modal-backdrop");
  if (existingBackdrop) {
    existingBackdrop.remove();
  }

  let currentStream = null;
  let currentFacingMode = "environment"; // Default back camera
  let capturedDataUrl = null;
  let isCleaningUp = false;

  // Backdrop & Modal Shell
  const backdrop = document.createElement("div");
  backdrop.className = "camera-modal-backdrop";
  backdrop.setAttribute("role", "dialog");
  backdrop.setAttribute("aria-modal", "true");
  backdrop.setAttribute("aria-label", title);

  const modal = document.createElement("div");
  modal.className = "camera-modal";

  // Header
  const header = document.createElement("div");
  header.className = "camera-modal-header";

  const titleEl = document.createElement("h3");
  titleEl.className = "camera-modal-title";
  titleEl.append(ICONS.camera(20), document.createTextNode(` ${title}`));

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "camera-btn-icon";
  closeBtn.setAttribute("aria-label", "Tutup modal kamera");
  closeBtn.append(ICONS.close(22));
  closeBtn.addEventListener("click", () => handleClose(false));

  header.append(titleEl, closeBtn);

  // Viewport Container (holds video or photo preview or error box)
  const viewport = document.createElement("div");
  viewport.className = "camera-viewport";

  const video = document.createElement("video");
  video.className = "camera-video";
  video.autoplay = true;
  video.playsInline = true;
  video.muted = true;

  // Viewfinder overlay (for framing student's face)
  const overlay = document.createElement("div");
  overlay.className = "camera-viewfinder-overlay";
  const frameGuide = document.createElement("div");
  frameGuide.className = "camera-guide-box";
  const guideTip = document.createElement("span");
  guideTip.className = "camera-guide-tip";
  guideTip.textContent = "Posisikan wajah & bahu siswa";
  frameGuide.append(guideTip);
  overlay.append(frameGuide);

  // Preview Image (shown after capture)
  const previewImg = document.createElement("img");
  previewImg.className = "camera-preview-img";
  previewImg.alt = "Hasil foto siswa";
  previewImg.style.display = "none";

  // Error Alert Container
  const errorBox = document.createElement("div");
  errorBox.className = "camera-error-box";
  errorBox.style.display = "none";

  viewport.append(video, overlay, previewImg, errorBox);

  // Bottom Action Controls Container
  const controls = document.createElement("div");
  controls.className = "camera-controls";

  // Hidden File Input for Gallery Fallback
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "image/*";
  fileInput.className = "camera-file-input-hidden";
  fileInput.addEventListener("change", async (e) => {
    const [file] = e.target.files || [];
    if (!file) return;
    try {
      const dataUrl = await compressImageFile(file);
      showCapturedPreview(dataUrl);
    } catch (err) {
      alert(err.message || "Gagal memproses foto dari galeri.");
    } finally {
      fileInput.value = "";
    }
  });

  modal.append(header, viewport, controls, fileInput);
  backdrop.append(modal);
  document.body.append(backdrop);

  // Escape key handler
  const keyHandler = (e) => {
    if (e.key === "Escape") {
      handleClose(false);
    }
  };
  window.addEventListener("keydown", keyHandler);

  /**
   * Complete teardown: ALWAYS stop camera stream to prevent camera running in background.
   */
  function handleClose(wasCaptured = false) {
    if (isCleaningUp) return;
    isCleaningUp = true;

    window.removeEventListener("keydown", keyHandler);
    stopCameraStream(currentStream);
    currentStream = null;

    if (video.srcObject) {
      video.srcObject = null;
    }

    backdrop.remove();

    if (!wasCaptured && typeof onCancel === "function") {
      onCancel();
    }
  }

  /**
   * Initializes or restarts live camera stream.
   */
  async function initCamera() {
    // Hide preview & errors, show video
    previewImg.style.display = "none";
    errorBox.style.display = "none";
    video.style.display = "block";
    overlay.style.display = "flex";

    stopCameraStream(currentStream);
    currentStream = null;

    try {
      currentStream = await startCameraStream({ facingMode: currentFacingMode });
      video.srcObject = currentStream;
      await video.play().catch(() => {});
      renderLiveControls();
    } catch (err) {
      console.warn("Camera init failed:", err);
      showCameraError();
    }
  }

  /**
   * Displays permission or camera failure with clear Indonesian message and gallery fallback.
   */
  function showCameraError() {
    stopCameraStream(currentStream);
    currentStream = null;
    video.style.display = "none";
    overlay.style.display = "none";
    previewImg.style.display = "none";

    errorBox.style.display = "flex";
    errorBox.replaceChildren();

    const alertIcon = ICONS.alert(44);
    const msg = document.createElement("p");
    msg.className = "camera-error-text";
    msg.textContent = "Kamera tidak dapat digunakan. Periksa izin kamera pada browser/perangkat.";

    const galleryBtn = document.createElement("button");
    galleryBtn.type = "button";
    galleryBtn.className = "primary-action camera-btn-full";
    galleryBtn.append(ICONS.image(20), document.createTextNode(" Pilih Foto dari Galeri"));
    galleryBtn.addEventListener("click", () => fileInput.click());

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "text-button camera-btn-full";
    cancelBtn.textContent = "Batal";
    cancelBtn.addEventListener("click", () => handleClose(false));

    errorBox.append(alertIcon, msg, galleryBtn, cancelBtn);

    // Empty bottom controls in error state
    controls.replaceChildren();
  }

  /**
   * Controls when camera is live:
   * - Batal
   * - Shutter Button (Ambil Foto)
   * - Switch Camera (if available) / Gallery
   */
  async function renderLiveControls() {
    controls.replaceChildren();

    const bottomRow = document.createElement("div");
    bottomRow.className = "camera-actions-row live-actions";

    // 1. Tombol Batal
    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "camera-text-action";
    cancelBtn.textContent = "Batal";
    cancelBtn.addEventListener("click", () => handleClose(false));

    // 2. Shutter Button: Ambil Foto
    const captureBtn = document.createElement("button");
    captureBtn.type = "button";
    captureBtn.className = "camera-shutter-btn";
    captureBtn.setAttribute("aria-label", "Ambil Foto");
    const shutterRing = document.createElement("span");
    shutterRing.className = "shutter-ring";
    captureBtn.append(shutterRing);

    captureBtn.addEventListener("click", () => {
      try {
        if (navigator.vibrate) {
          navigator.vibrate(40);
        }
      } catch {}

      try {
        const dataUrl = captureFrameFromVideo(video);
        showCapturedPreview(dataUrl);
      } catch (err) {
        alert(err.message || "Gagal mengambil foto. Pastikan kamera telah siap.");
      }
    });

    // 3. Right Action: Switch Camera (if multiple) OR Gallery fallback
    const rightActionWrap = document.createElement("div");
    rightActionWrap.className = "camera-secondary-actions";

    const cameraCount = await getAvailableCameraCount();
    if (cameraCount > 1) {
      const switchBtn = document.createElement("button");
      switchBtn.type = "button";
      switchBtn.className = "camera-btn-circle";
      switchBtn.setAttribute("aria-label", "Ganti Kamera Depan/Belakang");
      switchBtn.title = "Ganti kamera";
      switchBtn.append(ICONS.switchCamera(22));
      switchBtn.addEventListener("click", async () => {
        currentFacingMode = currentFacingMode === "environment" ? "user" : "environment";
        await initCamera();
      });
      rightActionWrap.append(switchBtn);
    }

    const galleryBtn = document.createElement("button");
    galleryBtn.type = "button";
    galleryBtn.className = "camera-btn-circle";
    galleryBtn.setAttribute("aria-label", "Pilih dari Galeri");
    galleryBtn.title = "Pilih dari galeri";
    galleryBtn.append(ICONS.image(22));
    galleryBtn.addEventListener("click", () => fileInput.click());
    rightActionWrap.append(galleryBtn);

    bottomRow.append(cancelBtn, captureBtn, rightActionWrap);
    controls.append(bottomRow);
  }

  /**
   * Shows captured photo preview and controls:
   * - Gunakan Foto
   * - Ambil Ulang
   */
  function showCapturedPreview(dataUrl) {
    capturedDataUrl = dataUrl;

    // Stop live stream while viewing captured preview to conserve battery and CPU
    stopCameraStream(currentStream);
    currentStream = null;

    video.style.display = "none";
    overlay.style.display = "none";
    errorBox.style.display = "none";

    previewImg.src = dataUrl;
    previewImg.style.display = "block";

    controls.replaceChildren();

    const previewRow = document.createElement("div");
    previewRow.className = "camera-actions-row preview-actions";

    // Tombol Ambil Ulang
    const retakeBtn = document.createElement("button");
    retakeBtn.type = "button";
    retakeBtn.className = "camera-btn-secondary";
    retakeBtn.append(ICONS.rotateCcw(18), document.createTextNode(" Ambil Ulang"));
    retakeBtn.addEventListener("click", () => {
      capturedDataUrl = null;
      initCamera();
    });

    // Tombol Gunakan Foto
    const useBtn = document.createElement("button");
    useBtn.type = "button";
    useBtn.className = "camera-btn-primary";
    useBtn.append(ICONS.check(18), document.createTextNode(" Gunakan Foto"));
    useBtn.addEventListener("click", () => {
      const finalUrl = capturedDataUrl;
      handleClose(true);
      if (typeof onCapture === "function") {
        onCapture(finalUrl);
      }
    });

    previewRow.append(retakeBtn, useBtn);
    controls.append(previewRow);
  }

  // Start camera on mount
  initCamera();
}
