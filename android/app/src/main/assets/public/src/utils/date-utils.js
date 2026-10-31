/**
 * Centralized Date & Time Utilities for Local Timezone Handling
 */

export function localDate(dateInput = new Date()) {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function localTime(dateInput = new Date()) {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) return "07:30";
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

/**
 * Returns day of week:
 * 1 = Senin, 2 = Selasa, 3 = Rabu, 4 = Kamis, 5 = Jumat, 6 = Sabtu, 7 = Minggu
 */
export function localDayOfWeek(dateInput = new Date()) {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) return 1;
  const jsDay = d.getDay(); // 0=Sunday, 1=Monday...6=Saturday
  return jsDay === 0 ? 7 : jsDay;
}

export function compareTime(time1, time2) {
  if (!time1 || !time2) return 0;
  return time1.localeCompare(time2);
}

export function isToday(dateStr) {
  if (!dateStr) return false;
  return dateStr === localDate();
}

export function getDayNameIndonesian(dayOfWeekNumber) {
  const map = {
    1: "Senin",
    2: "Selasa",
    3: "Rabu",
    4: "Kamis",
    5: "Jumat",
    6: "Sabtu",
    7: "Minggu"
  };
  return map[dayOfWeekNumber] || "Hari";
}

export function formatDateIndonesian(dateStr) {
  if (!dateStr) return "-";
  try {
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      const year = parts[0];
      const monthIdx = parseInt(parts[1], 10) - 1;
      const day = parts[2];
      const months = [
        "Januari", "Februari", "Maret", "April", "Mei", "Juni",
        "Juli", "Agustus", "September", "Oktober", "November", "Desember"
      ];
      const d = new Date(parseInt(year, 10), monthIdx, parseInt(day, 10));
      const dayName = getDayNameIndonesian(localDayOfWeek(d));
      return `${dayName}, ${parseInt(day, 10)} ${months[monthIdx]} ${year}`;
    }
  } catch (e) {
    // fallback
  }
  return dateStr;
}
