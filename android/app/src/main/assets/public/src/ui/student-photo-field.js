import { openCameraModal } from "./camera-modal.js";
import { compressImageFile } from "../services/camera-service.js";
import { ICONS } from "./icons.js";

/**
 * Creates an interactive student photo field for forms.
 * Replaces the old plain "Foto URL" input with a live camera capture & gallery flow.
 *
 * @param {Object} options
 * @param {string} [options.label] - Field label (default: "Foto Siswa")
 * @param {string} [options.name] - Form input name (default: "photo")
 * @param {string} [options.value] - Initial photo data URL or existing URL
 * @param {Function} [options.onChange] - Optional callback when photo changes
 * @returns {HTMLElement}
 */
export function createPhotoPickerField({
  label = "Foto Siswa",
  name = "photo",
  value = "",
  onChange
} = {}) {
  const container = document.createElement("div");
  container.className = "field student-photo-picker-field";

  const labelEl = document.createElement("span");
  labelEl.className = "field-label";
  labelEl.textContent = label;

  // Hidden input storing data URL or empty string for form submission
  const hiddenInput = document.createElement("input");
  hiddenInput.type = "hidden";
  hiddenInput.name = name;
  hiddenInput.value = value || "";

  // Hidden file input for direct gallery fallback
  const galleryInput = document.createElement("input");
  galleryInput.type = "file";
  galleryInput.accept = "image/*";
  galleryInput.className = "hidden-file-input";
  galleryInput.style.display = "none";
  galleryInput.addEventListener("change", async (e) => {
    const [file] = e.target.files || [];
    if (!file) return;
    try {
      const dataUrl = await compressImageFile(file);
      updatePhoto(dataUrl);
    } catch (err) {
      alert(err.message || "Gagal memproses gambar.");
    } finally {
      galleryInput.value = "";
    }
  });

  // Photo Display + Action Controls
  const contentRow = document.createElement("div");
  contentRow.className = "photo-picker-content";

  // Avatar / Photo Preview
  const previewBox = document.createElement("div");
  previewBox.className = "photo-picker-preview";

  const actionsBox = document.createElement("div");
  actionsBox.className = "photo-picker-actions";

  function renderUI() {
    previewBox.replaceChildren();
    actionsBox.replaceChildren();

    const currentPhoto = hiddenInput.value;

    if (currentPhoto) {
      previewBox.classList.add("has-photo");
      const img = document.createElement("img");
      img.className = "photo-preview-img";
      img.alt = "Preview Foto Siswa";
      img.src = currentPhoto;
      img.onerror = () => {
        img.remove();
        previewBox.classList.remove("has-photo");
        previewBox.append(ICONS.user(36));
      };
      previewBox.append(img);

      // Buttons for existing photo: Ganti Foto & Hapus
      const changeBtn = document.createElement("button");
      changeBtn.type = "button";
      changeBtn.className = "secondary-action photo-action-btn";
      changeBtn.append(ICONS.camera(18), document.createTextNode(" Ganti Foto"));
      changeBtn.addEventListener("click", () => {
        openCameraModal({
          title: "Ganti Foto Siswa",
          onCapture: (newUrl) => updatePhoto(newUrl)
        });
      });

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "text-button danger-button photo-action-btn";
      removeBtn.append(ICONS.trash(16), document.createTextNode(" Hapus Foto"));
      removeBtn.addEventListener("click", () => updatePhoto(""));

      actionsBox.append(changeBtn, removeBtn);
    } else {
      previewBox.classList.remove("has-photo");
      previewBox.append(ICONS.user(36));

      // Buttons for no photo: Ambil Foto & Pilih dari Galeri
      const captureBtn = document.createElement("button");
      captureBtn.type = "button";
      captureBtn.className = "primary-action compact-action photo-action-btn";
      captureBtn.append(ICONS.camera(18), document.createTextNode(" Ambil Foto"));
      captureBtn.addEventListener("click", () => {
        openCameraModal({
          title: "Ambil Foto Siswa",
          onCapture: (newUrl) => updatePhoto(newUrl)
        });
      });

      const galleryBtn = document.createElement("button");
      galleryBtn.type = "button";
      galleryBtn.className = "text-button photo-action-btn";
      galleryBtn.append(ICONS.image(16), document.createTextNode(" Dari Galeri"));
      galleryBtn.addEventListener("click", () => galleryInput.click());

      actionsBox.append(captureBtn, galleryBtn);
    }
  }

  function updatePhoto(newVal) {
    hiddenInput.value = newVal || "";
    renderUI();
    if (typeof onChange === "function") {
      onChange(hiddenInput.value);
    }
  }

  // Allow external control (e.g. form.reset)
  container.setPhoto = updatePhoto;
  container.getPhoto = () => hiddenInput.value;

  // Listen for reset events on parent form
  setTimeout(() => {
    const parentForm = container.closest("form");
    if (parentForm) {
      parentForm.addEventListener("reset", () => {
        setTimeout(() => updatePhoto(""), 0);
      });
    }
  }, 0);

  renderUI();
  contentRow.append(previewBox, actionsBox);
  container.append(labelEl, contentRow, hiddenInput, galleryInput);

  return container;
}
