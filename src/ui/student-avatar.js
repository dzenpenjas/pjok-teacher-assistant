import { ICONS } from "./icons.js";

/**
 * Extract 1-2 letter initials from a person's name.
 */
export function getStudentInitials(name = "") {
  if (!name || typeof name !== "string") return "S";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "S";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Creates an avatar DOM element for a student.
 * If student.photo is present, displays an image with automatic broken-image fallback to initials.
 * If no photo, displays a clean initials badge.
 *
 * @param {Object} student
 * @param {string} extraClass - optional extra CSS classes (e.g. "modal-avatar", "small-avatar")
 * @returns {HTMLElement}
 */
export function createStudentAvatar(student = {}, extraClass = "") {
  const container = document.createElement("div");
  container.className = `student-avatar ${extraClass}`.trim();

  const name = student?.name || "Siswa";
  const initials = getStudentInitials(name);
  const photoUrl = typeof student?.photo === "string" ? student.photo.trim() : "";

  if (photoUrl) {
    container.classList.add("has-photo");

    const img = document.createElement("img");
    img.className = "student-avatar-img";
    img.alt = `Foto ${name}`;
    img.loading = "lazy";
    img.src = photoUrl;

    // Fallback if image data is corrupted or invalid
    img.onerror = () => {
      img.remove();
      container.classList.remove("has-photo");
      container.textContent = initials;
    };

    container.append(img);
  } else {
    container.textContent = initials;
  }

  return container;
}
