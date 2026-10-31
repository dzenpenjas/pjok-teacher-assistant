/**
 * Camera Service for PJOK Teacher Assistant.
 * Handles Web Camera API (getUserMedia), permission state, stream lifecycle,
 * and high-efficiency image compression for local profile storage.
 */

export const CAMERA_CONFIG = {
  maxDimension: 600,
  quality: 0.75,
  defaultFacingMode: "environment" // Kamera belakang HP
};

/**
 * Check if browser supports getUserMedia.
 */
export function isCameraSupported() {
  return Boolean(
    typeof navigator !== "undefined" &&
    navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === "function"
  );
}

/**
 * Start camera stream with environment (back) camera prioritization.
 * Falls back gracefully if specific facingMode is not accepted by hardware.
 */
export async function startCameraStream({ facingMode = "environment" } = {}) {
  if (!isCameraSupported()) {
    const error = new Error("Kamera tidak dapat digunakan. Periksa izin kamera pada browser/perangkat.");
    error.name = "NotSupportedError";
    throw error;
  }

  // Attempt 1: Ideal facingMode with 720p/1080p target
  try {
    const constraints = {
      video: {
        facingMode: { ideal: facingMode },
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    };
    return await navigator.mediaDevices.getUserMedia(constraints);
  } catch (err) {
    // Attempt 2: Relaxed facingMode
    try {
      return await navigator.mediaDevices.getUserMedia({
        video: { facingMode },
        audio: false
      });
    } catch (err2) {
      // Attempt 3: Any available video device
      try {
        return await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false
        });
      } catch (err3) {
        // Normalize error message for user
        const finalError = new Error("Kamera tidak dapat digunakan. Periksa izin kamera pada browser/perangkat.");
        finalError.name = err3.name || err2.name || err.name || "CameraError";
        finalError.originalError = err3;
        throw finalError;
      }
    }
  }
}

/**
 * Stop all tracks of a media stream cleanly to ensure no camera activity remains in background.
 */
export function stopCameraStream(stream) {
  if (!stream) return;
  try {
    if (typeof stream.getTracks === "function") {
      stream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {
          console.warn("Gagal menghentikan track kamera:", e);
        }
      });
    }
  } catch (e) {
    console.warn("Gagal menghentikan camera stream:", e);
  }
}

/**
 * Enumerate available video inputs to determine if front/back toggle is possible.
 */
export async function getAvailableCameraCount() {
  if (!isCameraSupported() || !navigator.mediaDevices.enumerateDevices) {
    return 1;
  }
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoInputs = devices.filter((d) => d.kind === "videoinput");
    return videoInputs.length;
  } catch {
    return 1;
  }
}

/**
 * Capture current frame from a HTMLVideoElement, crop/resize to max 600px square/portrait,
 * and compress as JPEG data URL.
 *
 * @param {HTMLVideoElement} videoElement
 * @param {Object} options
 * @returns {string} base64 data URL
 */
export function captureFrameFromVideo(
  videoElement,
  { maxDimension = CAMERA_CONFIG.maxDimension, quality = CAMERA_CONFIG.quality } = {}
) {
  if (!videoElement) {
    throw new Error("Video element tidak valid untuk capture frame.");
  }

  const vWidth = videoElement.videoWidth || 640;
  const vHeight = videoElement.videoHeight || 480;

  if (vWidth === 0 || vHeight === 0) {
    throw new Error("Video stream belum siap untuk mengambil foto.");
  }

  // Create an in-memory canvas
  const canvas = document.createElement("canvas");

  // For student profile avatar, square crop (1:1) centering the face/torso gives the most consistent look
  const minSide = Math.min(vWidth, vHeight);
  const sx = (vWidth - minSide) / 2;
  const sy = (vHeight - minSide) / 2;

  const targetSize = Math.min(minSide, maxDimension);
  canvas.width = targetSize;
  canvas.height = targetSize;

  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) {
    throw new Error("Canvas 2D context tidak tersedia.");
  }

  // Draw square cropped image centered
  ctx.drawImage(videoElement, sx, sy, minSide, minSide, 0, 0, targetSize, targetSize);

  // Compress to JPEG with 0.75 quality for optimal compression (<40KB) without losing facial clarity
  return canvas.toDataURL("image/jpeg", quality);
}

/**
 * Process and compress an uploaded image File (from gallery fallback).
 * Resizes to max 600px square-cropped or aspect-ratio fitted and compresses to JPEG.
 *
 * @param {File|Blob} file
 * @param {Object} options
 * @returns {Promise<string>} base64 data URL
 */
export function compressImageFile(
  file,
  { maxDimension = CAMERA_CONFIG.maxDimension, quality = CAMERA_CONFIG.quality } = {}
) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith("image/")) {
      reject(new Error("Berkas yang dipilih bukan gambar valid."));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Gagal membaca berkas gambar."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Gagal memproses data gambar."));
      img.onload = () => {
        const naturalW = img.naturalWidth || img.width;
        const naturalH = img.naturalHeight || img.height;

        if (!naturalW || !naturalH) {
          reject(new Error("Ukuran gambar tidak dapat dibaca."));
          return;
        }

        const canvas = document.createElement("canvas");
        const minSide = Math.min(naturalW, naturalH);
        const sx = (naturalW - minSide) / 2;
        const sy = (naturalH - minSide) / 2;

        const targetSize = Math.min(minSide, maxDimension);
        canvas.width = targetSize;
        canvas.height = targetSize;

        const ctx = canvas.getContext("2d", { alpha: false });
        if (!ctx) {
          reject(new Error("Gagal menginisialisasi canvas pemrosesan."));
          return;
        }

        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, targetSize, targetSize);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
