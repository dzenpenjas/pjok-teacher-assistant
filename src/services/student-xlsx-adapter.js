import { getXLSX } from "./xlsx-runtime.js";

/**
 * Normalizes header string to lowercase alphanumeric with underscores.
 */
function normalizeHeaderKey(str) {
  if (!str) return "";
  return String(str)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .trim();
}

/**
 * Normalizes gender value to standard "male", "female", or "".
 * Returns { gender: "male" | "female" | "", isValid: boolean, raw: string }
 */
export function normalizeGender(val) {
  if (val === undefined || val === null) {
    return { gender: "", isValid: true, raw: "" };
  }

  const raw = String(val).trim();
  if (!raw) {
    return { gender: "", isValid: true, raw: "" };
  }

  const clean = raw.toLowerCase().replace(/[\s\-_]+/g, " ");

  if (
    clean === "l" ||
    clean === "laki" ||
    clean === "laki laki" ||
    clean === "lakilaki" ||
    clean === "pria" ||
    clean === "m" ||
    clean === "male"
  ) {
    return { gender: "male", isValid: true, raw };
  }

  if (
    clean === "p" ||
    clean === "perempuan" ||
    clean === "wanita" ||
    clean === "f" ||
    clean === "female"
  ) {
    return { gender: "female", isValid: true, raw };
  }

  return { gender: "", isValid: false, raw };
}

const INDO_MONTHS = {
  januari: 1,
  jan: 1,
  februari: 2,
  feb: 2,
  maret: 3,
  mar: 3,
  april: 4,
  apr: 4,
  mei: 5,
  may: 5,
  juni: 6,
  jun: 6,
  juli: 7,
  jul: 7,
  agustus: 8,
  agu: 8,
  ags: 8,
  aug: 8,
  september: 9,
  sep: 9,
  oktober: 10,
  okt: 10,
  oct: 10,
  november: 11,
  nov: 11,
  desember: 12,
  des: 12,
  dec: 12
};

/**
 * Validates real calendar date (checks leap years, valid days in month).
 */
export function isValidCalendarDate(year, month, day) {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);

  if (isNaN(y) || isNaN(m) || isNaN(d)) return false;
  if (y < 1900 || y > 2100) return false;
  if (m < 1 || m > 12) return false;

  const daysInMonth = new Date(y, m, 0).getDate();
  return d >= 1 && d <= daysInMonth;
}

/**
 * Normalizes birth date to YYYY-MM-DD or empty string.
 * Returns { birthDate: string, isValid: boolean, raw: string }
 */
export function normalizeBirthDate(val) {
  if (val === undefined || val === null || val === "") {
    return { birthDate: "", isValid: true, raw: "" };
  }

  if (val instanceof Date) {
    if (isNaN(val.getTime())) {
      return { birthDate: "", isValid: false, raw: String(val) };
    }
    const y = val.getUTCFullYear();
    const m = val.getUTCMonth() + 1;
    const d = val.getUTCDate();
    if (isValidCalendarDate(y, m, d)) {
      const formatted = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      return { birthDate: formatted, isValid: true, raw: formatted };
    }
    return { birthDate: "", isValid: false, raw: String(val) };
  }

  // Handle Excel date serial numbers
  if (typeof val === "number") {
    if (val <= 0 || isNaN(val)) {
      return { birthDate: "", isValid: false, raw: String(val) };
    }
    // Excel date base 1899-12-30
    const date = new Date(Math.round((val - 25569) * 86400 * 1000));
    if (!isNaN(date.getTime())) {
      const y = date.getUTCFullYear();
      const m = date.getUTCMonth() + 1;
      const d = date.getUTCDate();
      if (isValidCalendarDate(y, m, d)) {
        const formatted = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        return { birthDate: formatted, isValid: true, raw: String(val) };
      }
    }
    return { birthDate: "", isValid: false, raw: String(val) };
  }

  const str = String(val).trim();
  if (!str) {
    return { birthDate: "", isValid: true, raw: "" };
  }

  // YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (isoMatch) {
    const y = Number(isoMatch[1]);
    const m = Number(isoMatch[2]);
    const d = Number(isoMatch[3]);
    if (isValidCalendarDate(y, m, d)) {
      const formatted = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      return { birthDate: formatted, isValid: true, raw: str };
    }
    return { birthDate: "", isValid: false, raw: str };
  }

  // DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmyMatch) {
    const d = Number(dmyMatch[1]);
    const m = Number(dmyMatch[2]);
    const y = Number(dmyMatch[3]);
    if (isValidCalendarDate(y, m, d)) {
      const formatted = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      return { birthDate: formatted, isValid: true, raw: str };
    }
    return { birthDate: "", isValid: false, raw: str };
  }

  // DD Month YYYY (e.g., "12 Maret 2019", "17 Agustus 2015")
  const textMonthMatch = str.match(/^(\d{1,2})[\s\-_]+([A-Za-z]+)[\s\-_]+(\d{4})$/);
  if (textMonthMatch) {
    const d = Number(textMonthMatch[1]);
    const mKey = textMonthMatch[2].toLowerCase();
    const y = Number(textMonthMatch[3]);
    const m = INDO_MONTHS[mKey];
    if (m && isValidCalendarDate(y, m, d)) {
      const formatted = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      return { birthDate: formatted, isValid: true, raw: str };
    }
    return { birthDate: "", isValid: false, raw: str };
  }

  return { birthDate: "", isValid: false, raw: str };
}

/**
 * Identifies column type from normalized header text.
 * Strictly recognizes only: nama_siswa, nis, jenis_kelamin, tanggal_lahir.
 */
function identifyColumnType(headerText) {
  const norm = normalizeHeaderKey(headerText);
  if (!norm) return null;

  if (
    norm === "nama_siswa" ||
    norm === "nama" ||
    norm === "nama_lengkap" ||
    norm === "nama_lengkap_siswa"
  ) {
    return "name";
  }

  if (
    norm === "nis" ||
    norm === "nisn" ||
    norm === "nomor_induk" ||
    norm === "nomor_induk_siswa" ||
    norm === "no_induk"
  ) {
    return "studentNumber";
  }

  if (
    norm === "jenis_kelamin" ||
    norm === "jk" ||
    norm === "gender" ||
    norm === "kelamin"
  ) {
    return "gender";
  }

  if (
    norm === "tanggal_lahir" ||
    norm === "tgl_lahir" ||
    norm === "tgl" ||
    norm === "tanggal" ||
    norm === "birth_date"
  ) {
    return "birthDate";
  }

  return null;
}

/**
 * Parses and analyzes an Excel workbook for student import according to V1 contract.
 *
 * @param {object} workbook - XLSX workbook object
 * @param {object} [options] - { existingStudents = [], targetClassId = "" }
 * @returns {object} { rows: Array, summary: object, sheetName: string }
 */
export function parseStudentWorkbook(workbook, options = {}) {
  if (!workbook || !Array.isArray(workbook.SheetNames) || workbook.SheetNames.length === 0) {
    throw new Error("File Excel tidak memiliki lembar kerja (worksheet).");
  }

  const XLSX = getXLSX();
  const { existingStudents = [], targetClassId = "" } = options;

  // Strict sheet requirement: sheet "SISWA" MUST exist
  const exactSheetName = workbook.SheetNames.find(
    (name) => name.trim().toUpperCase() === "SISWA"
  );

  if (!exactSheetName) {
    throw new Error("Sheet SISWA tidak ditemukan.");
  }

  const sheet = workbook.Sheets[exactSheetName];
  if (!sheet) {
    throw new Error("Sheet SISWA tidak dapat dibaca.");
  }

  const rawRows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    blankrows: false,
    raw: false // Use formatted text when possible to preserve leading zeros in text cells
  });

  if (!rawRows || rawRows.length === 0) {
    return {
      rows: [],
      summary: {
        total: 0,
        valid: 0,
        warning: 0,
        duplicate: 0,
        invalid: 0,
        importable: 0
      },
      sheetName: exactSheetName
    };
  }

  // Find header row containing nama_siswa
  let headerRowIndex = -1;
  let columnMapping = {}; // colIdx -> fieldKey

  for (let r = 0; r < Math.min(rawRows.length, 10); r++) {
    const row = rawRows[r];
    if (!Array.isArray(row)) continue;

    const mapping = {};
    let hasNameCol = false;

    row.forEach((cellVal, colIdx) => {
      const field = identifyColumnType(cellVal);
      if (field) {
        mapping[colIdx] = field;
        if (field === "name") {
          hasNameCol = true;
        }
      }
    });

    if (hasNameCol) {
      headerRowIndex = r;
      columnMapping = mapping;
      break;
    }
  }

  if (headerRowIndex === -1) {
    throw new Error("Kolom nama_siswa tidak ditemukan pada sheet SISWA.");
  }

  const rows = [];
  const seenNisInFile = new Set();

  for (let r = headerRowIndex + 1; r < rawRows.length; r++) {
    const row = rawRows[r];
    if (!Array.isArray(row) || row.length === 0) continue;

    // Check if entire row is completely empty
    const isCompletelyEmpty = row.every(
      (cell) => cell === undefined || cell === null || String(cell).trim() === ""
    );
    if (isCompletelyEmpty) continue;

    const rowNumber = r + 1; // 1-indexed Excel row

    let rawName = "";
    let rawNis = "";
    let rawGender = "";
    let rawBirthDate = "";

    row.forEach((cellVal, colIdx) => {
      const field = columnMapping[colIdx];
      const strVal = cellVal !== undefined && cellVal !== null ? String(cellVal).trim() : "";

      if (field === "name") {
        rawName = strVal;
      } else if (field === "studentNumber") {
        rawNis = strVal;
      } else if (field === "gender") {
        rawGender = strVal;
      } else if (field === "birthDate") {
        rawBirthDate = cellVal; // keep raw cell value for date parsing
      }
    });

    let status = "valid";
    const messages = [];

    // 1. NAME RULE (Strict: Required)
    const name = rawName.trim();
    if (!name) {
      status = "invalid";
      messages.push(`SISWA baris ${rowNumber}: Nama siswa wajib diisi.`);
    }

    // 2. NIS RULE (Optional, stringified, preserves leading zeros)
    const studentNumber = rawNis.trim();

    // 3. GENDER RULE (Optional, standardizes or warns)
    const genderResult = normalizeGender(rawGender);
    const gender = genderResult.gender;
    if (!genderResult.isValid && rawGender) {
      if (status === "valid") {
        status = "warning";
      }
      messages.push(`Jenis kelamin "${rawGender}" tidak dikenali dan akan dikosongkan.`);
    }

    // 4. BIRTH DATE RULE (Optional, validates real calendar date or warns)
    const birthResult = normalizeBirthDate(rawBirthDate);
    const birthDate = birthResult.birthDate;
    if (!birthResult.isValid && rawBirthDate !== "" && rawBirthDate !== undefined && rawBirthDate !== null) {
      if (status === "valid") {
        status = "warning";
      }
      messages.push("Tanggal lahir tidak dikenali dan akan dikosongkan.");
    }

    // 5. DUPLICATE ANALYSIS (Only if student is otherwise valid/warning)
    if (status !== "invalid") {
      // 5a. Duplicates inside the same Excel file
      if (studentNumber) {
        if (seenNisInFile.has(studentNumber)) {
          status = "duplicate";
          messages.push(`NIS ${studentNumber} muncul lebih dari satu kali pada file Excel.`);
        } else {
          seenNisInFile.add(studentNumber);
        }
      }

      // 5b. Duplicates against existing database students
      if (studentNumber && status !== "duplicate") {
        const matchSameClass = existingStudents.find(
          (s) => (s.studentNumber || "").trim() === studentNumber && s.classId === targetClassId
        );
        const matchOtherClass = existingStudents.find(
          (s) => (s.studentNumber || "").trim() === studentNumber && s.classId !== targetClassId
        );

        if (matchSameClass) {
          status = "duplicate";
          messages.push(`NIS ${studentNumber} sudah terdaftar di kelas ini.`);
        } else if (matchOtherClass) {
          status = "duplicate";
          messages.push(`NIS ${studentNumber} sudah terdaftar di kelas lain. Data tidak dipindahkan otomatis.`);
        }
      }

      // 5c. Same normalized name with empty NIS in target class -> Warning (still importable!)
      if (!studentNumber && status === "valid") {
        const matchNameInClass = existingStudents.find(
          (s) =>
            s.classId === targetClassId &&
            (s.name || "").trim().toLowerCase() === name.toLowerCase()
        );
        if (matchNameInClass) {
          status = "warning";
          messages.push("Ada siswa dengan nama yang sama di kelas ini.");
        }
      }
    }

    rows.push({
      rowNumber,
      student: {
        name,
        studentNumber,
        gender,
        birthDate
      },
      status,
      messages
    });
  }

  const validCount = rows.filter((r) => r.status === "valid").length;
  const warningCount = rows.filter((r) => r.status === "warning").length;
  const duplicateCount = rows.filter((r) => r.status === "duplicate").length;
  const invalidCount = rows.filter((r) => r.status === "invalid").length;
  const importableCount = validCount + warningCount;

  return {
    rows,
    summary: {
      total: rows.length,
      valid: validCount,
      warning: warningCount,
      duplicate: duplicateCount,
      invalid: invalidCount,
      importable: importableCount
    },
    sheetName: exactSheetName
  };
}

/**
 * Parses a File or Blob or ArrayBuffer from browser file input.
 */
export async function parseStudentExcelFile(fileOrBuffer, options = {}) {
  const XLSX = getXLSX();
  let buffer;

  if (fileOrBuffer instanceof ArrayBuffer) {
    buffer = fileOrBuffer;
  } else if (fileOrBuffer && typeof fileOrBuffer.arrayBuffer === "function") {
    buffer = await fileOrBuffer.arrayBuffer();
  } else if (fileOrBuffer && fileOrBuffer.buffer instanceof ArrayBuffer) {
    buffer = fileOrBuffer.buffer;
  } else {
    throw new Error("Format file input tidak valid.");
  }

  const workbook = XLSX.read(buffer, {
    type: "array",
    cellDates: false,
    cellNF: false,
    cellText: false,
    raw: false
  });

  return parseStudentWorkbook(workbook, options);
}

/**
 * Generates an Excel template workbook for importing students (V1 Exact Format).
 * Contains exactly one sheet named 'SISWA' and only the 4 identity columns.
 */
export function generateStudentTemplateWorkbook() {
  const XLSX = getXLSX();
  const wb = XLSX.utils.book_new();

  const headers = ["nama_siswa", "nis", "jenis_kelamin", "tanggal_lahir"];

  const sampleRows = [
    ["Ahmad Fauzan", "00101", "L", "2019-03-12"],
    ["Siti Aisyah", "", "P", ""],
    ["Muhammad Fikri", "", "", ""]
  ];

  const sheetData = [headers, ...sampleRows];
  const ws = XLSX.utils.aoa_to_sheet(sheetData);

  ws["!cols"] = [
    { wch: 28 }, // nama_siswa
    { wch: 16 }, // nis
    { wch: 18 }, // jenis_kelamin
    { wch: 20 }  // tanggal_lahir
  ];

  XLSX.utils.book_append_sheet(wb, ws, "SISWA");
  return wb;
}

/**
 * Generates and downloads student import template directly in browser.
 */
export function downloadStudentTemplateExcel() {
  const XLSX = getXLSX();
  const wb = generateStudentTemplateWorkbook();
  const fileName = "Template_Import_Siswa.xlsx";

  XLSX.writeFile(wb, fileName);
}
