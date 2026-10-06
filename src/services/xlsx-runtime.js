/**
 * Unified XLSX runtime resolver for browser & test environments.
 * Uses globalThis.XLSX loaded via vendor/xlsx.full.min.js in the browser.
 */
export function getXLSX() {
  const XLSX =
    typeof globalThis !== "undefined" && globalThis.XLSX
      ? globalThis.XLSX
      : typeof window !== "undefined" && window.XLSX
        ? window.XLSX
        : undefined;

  if (!XLSX) {
    throw new Error("Library XLSX tidak tersedia.");
  }

  return XLSX;
}
