import { getXLSX } from "./xlsx-runtime.js";

/**
 * Normalizes header string to lowercase alphanumeric representation.
 */
function normalizeHeaderKey(str) {
  if (!str) return "";
  return String(str)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Normalizes gender value to standard "male", "female", or "".
 */
export function normalizeGender(val) {
  if (val === undefined || val === null) return "";
  const clean = String(val).toLowerCase().trim();
  if (!clean) return "";

  if (
    clean === "l" ||
    clean === "laki" ||
    clean === "laki-laki" ||
    clean === "laki - laki" ||
    clean === "lakilaki" ||
    clean === "pria" ||
    clean === "m" ||
    clean === "male" ||
    clean.startsWith("l /") ||
    clean.startsWith("l/")
  ) {
    return "male";
  }

  if (
    clean === "p" ||
    clean === "perempuan" ||
    clean === "wanita" ||
    clean === "f" ||
    clean === "female" ||
    clean.startsWith("p /") ||
    clean.startsWith("p/")
  ) {
    return "female";
  }

  return "";
}

const INDO_MONTHS = {
  januari: "01",
  jan: "01",
  februari: "02",
  feb: "02",
  maret: "03",
  mar: "03",
  april: "04",
  apr: "04",
  mei: "05",
  may: "05",
  juni: "06",
  jun: "06",
  juli: "07",
  jul: "07",
  agustus: "08",
  agu: "08",
  ags: "08",
  aug: "08",
  september: "09",
  sep: "09",
  oktober: "10",
  okt: "10",
  oct: "10",
  november: "11",
  nov: "11",
  desember: "12",
  des: "12",
  dec: "12"
};

/**
 * Normalizes birthDate to ISO date format YYYY-MM-DD or empty string if invalid.
 */
export function normalizeBirthDate(val) {
  if (val === undefined || val === null || val === "") return "";

  if (val instanceof Date) {
    if (isNaN(val.getTime())) return "";
    return val.toISOString().slice(0, 10);
  }

  // Handle Excel date serial numbers
  if (typeof val === "number") {
    if (val <= 0 || isNaN(val)) return "";
    // Excel base date: 1899-12-30 (accounting for 1900 leap bug)
    const date = new Date(Math.round((val - 25569) * 86400 * 1000));
    if (!isNaN(date.getTime())) {
      return date.toISOString().slice(0, 10);
    }
  }

  const str = String(val).trim();
  if (!str) return "";

  // YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (isoMatch) {
    const y = isoMatch[1];
    const m = isoMatch[2].padStart(2, "0");
    const d = isoMatch[3].padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  // DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmyMatch) {
    const d = dmyMatch[1].padStart(2, "0");
    const m = dmyMatch[2].padStart(2, "0");
    const y = dmyMatch[3];
    return `${y}-${m}-${d}`;
  }

  // DD Month YYYY (e.g., "17 Agustus 2015" or "12-Mei-2016")
  const textMonthMatch = str.match(/^(\d{1,2})[\s\-_]+([A-Za-z]+)[\s\-_]+(\d{4})$/);
  if (textMonthMatch) {
    const d = textMonthMatch[1].padStart(2, "0");
    const mKey = textMonthMatch[2].toLowerCase();
    const y = textMonthMatch[3];
    const m = INDO_MONTHS[mKey];
    if (m) {
      return `${y}-${m}-${d}`;
    }
  }

  // If already standard date string
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 1900 && parsed.getFullYear() < 2100) {
    return parsed.toISOString().slice(0, 10);
  }

  return "";
}

/**
 * Identifies column type from header cell label.
 */
function identifyColumnType(headerText) {
  const norm = normalizeHeaderKey(headerText);
  if (!norm) return null;

  // Row number / index column
  if (norm === "no" || norm === "nomor" || norm === "num" || norm === "idx" || norm === "index") {
    return null;
  }

  // Gender (checked early so 'jenis' doesn't trigger 'nis')
  if (
    norm.includes("kelamin") ||
    norm.includes("gender") ||
    norm.includes("sex") ||
    norm === "jk" ||
    norm === "lp" ||
    norm === "l p" ||
    norm.includes("l p") ||
    norm.includes("l/p")
  ) {
    return "gender";
  }

  // Name
  if (
    norm.includes("nama") ||
    norm.includes("student name") ||
    norm === "name" ||
    norm.includes("peserta didik") ||
    norm.includes("murid")
  ) {
    return "name";
  }

  // Student number (NIS) - use boundary check
  if (
    /\b(nis|nisn)\b/.test(norm) ||
    norm.includes("nomor induk") ||
    norm.includes("no induk") ||
    norm.includes("student number")
  ) {
    return "studentNumber";
  }

  // Birth Date
  if (
    norm.includes("lahir") ||
    norm.includes("birth") ||
    norm.includes("dob") ||
    norm === "tgl" ||
    norm === "tanggal"
  ) {
    return "birthDate";
  }

  // Note / Catatan
  if (
    norm.includes("catatan") ||
    norm.includes("keterangan") ||
    norm.includes("note")
  ) {
    return "noteText";
  }

  // Height / TB
  if (
    norm.includes("tinggi") ||
    norm === "tb" ||
    norm.startsWith("tb ") ||
    norm.includes("height")
  ) {
    return "heightCm";
  }

  // Weight / BB
  if (
    norm.includes("berat") ||
    norm === "bb" ||
    norm.startsWith("bb ") ||
    norm.includes("weight")
  ) {
    return "weightKg";
  }

  return null;
}

/**
 * Parses an XLSX workbook into structured student import data.
 * Does not mutate input or set classId.
 */
export function parseStudentWorkbook(workbook) {
  if (!workbook || !Array.isArray(workbook.SheetNames) || workbook.SheetNames.length === 0) {
    throw new Error("File Excel tidak memiliki lembar kerja (worksheet).");
  }

  const XLSX = getXLSX();

  // Pick target sheet: prefer "DATA SISWA" or "SISWA", otherwise first sheet
  const targetSheetName =
    workbook.SheetNames.find((name) => {
      const n = name.toUpperCase().trim();
      return n === "DATA SISWA" || n === "SISWA" || n === "DATA_SISWA" || n === "STUDENTS";
    }) || workbook.SheetNames[0];

  const sheet = workbook.Sheets[targetSheetName];
  if (!sheet) {
    throw new Error(`Lembar kerja "${targetSheetName}" tidak dapat dibaca.`);
  }

  const rawRows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    blankrows: false,
    raw: true
  });

  if (!rawRows || rawRows.length === 0) {
    return {
      validStudents: [],
      invalidRows: [],
      totalRows: 0,
      validCount: 0,
      invalidCount: 0,
      sheetName: targetSheetName
    };
  }

  // Find header row by locating the row containing "nama" or "name"
  let headerRowIndex = -1;
  let columnMapping = {}; // colIndex -> fieldKey

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

  // Fallback: If no recognized header row found, assume row 0 is standard template
  if (headerRowIndex === -1) {
    headerRowIndex = 0;
    columnMapping = {
      0: "name",
      1: "studentNumber",
      2: "gender",
      3: "birthDate",
      4: "noteText"
    };
  }

  const validStudents = [];
  const invalidRows = [];
  let processedRows = 0;

  for (let r = headerRowIndex + 1; r < rawRows.length; r++) {
    const row = rawRows[r];
    if (!Array.isArray(row) || row.length === 0) continue;

    // Check if entire row is blank
    const isCompletelyEmpty = row.every((cell) => cell === undefined || cell === null || String(cell).trim() === "");
    if (isCompletelyEmpty) continue;

    processedRows++;
    const rowNumber = r + 1; // 1-indexed Excel row

    const extracted = {
      name: "",
      studentNumber: "",
      gender: "",
      birthDate: "",
      noteText: "",
      heightCm: "",
      weightKg: ""
    };

    const rawData = {};

    row.forEach((cellVal, colIdx) => {
      const field = columnMapping[colIdx];
      const trimmed = cellVal !== undefined && cellVal !== null ? String(cellVal).trim() : "";
      rawData[`col_${colIdx + 1}`] = trimmed;

      if (field === "name") {
        extracted.name = trimmed;
      } else if (field === "studentNumber") {
        extracted.studentNumber = trimmed;
      } else if (field === "gender") {
        extracted.gender = normalizeGender(cellVal);
      } else if (field === "birthDate") {
        extracted.birthDate = normalizeBirthDate(cellVal);
      } else if (field === "noteText") {
        extracted.noteText = trimmed;
      } else if (field === "heightCm") {
        extracted.heightCm = trimmed;
      } else if (field === "weightKg") {
        extracted.weightKg = trimmed;
      }
    });

    // Validation: Name is required
    if (!extracted.name) {
      invalidRows.push({
        rowNumber,
        rawData,
        reason: "Nama siswa wajib diisi (kolom nama kosong)."
      });
      continue;
    }

    validStudents.push(extracted);
  }

  return {
    validStudents,
    invalidRows,
    totalRows: processedRows,
    validCount: validStudents.length,
    invalidCount: invalidRows.length,
    sheetName: targetSheetName
  };
}

/**
 * Parses a File or Blob or ArrayBuffer from browser file input.
 */
export async function parseStudentExcelFile(fileOrBuffer) {
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
    cellDates: true,
    cellNF: false,
    cellText: false
  });

  return parseStudentWorkbook(workbook);
}

/**
 * Generates an Excel template workbook for importing students.
 */
export function generateStudentTemplateWorkbook({ className = "", grade = "" } = {}) {
  const XLSX = getXLSX();
  const wb = XLSX.utils.book_new();

  const headers = [
    "Nama Lengkap Siswa *",
    "Nomor Induk Siswa (NIS)",
    "Jenis Kelamin (L/P)",
    "Tanggal Lahir (YYYY-MM-DD)",
    "Catatan Guru (Kesehatan/Karakter)"
  ];

  const sampleRows = [
    ["Ahmad Fauzi", "1001", "L", "2015-04-12", "Asma ringan, perlu istirahat saat lelah"],
    ["Siti Nurhaliza", "1002", "P", "2015-08-25", ""],
    ["Budi Pratama", "1003", "L", "2016-01-10", ""],
    ["Dewi Lestari", "1004", "P", "2015-11-05", "Aktif dalam atletik"],
    ["Rian Saputra", "1005", "L", "2015-06-18", ""]
  ];

  const sheetData = [headers, ...sampleRows];
  const ws = XLSX.utils.aoa_to_sheet(sheetData);

  ws["!cols"] = [
    { wch: 30 }, // Nama
    { wch: 22 }, // NIS
    { wch: 20 }, // JK
    { wch: 26 }, // Tgl Lahir
    { wch: 40 }  // Catatan
  ];

  XLSX.utils.book_append_sheet(wb, ws, "DATA SISWA");
  return wb;
}

/**
 * Generates and downloads student import template directly in browser.
 */
export function downloadStudentTemplateExcel({ className = "", grade = "" } = {}) {
  const XLSX = getXLSX();
  const wb = generateStudentTemplateWorkbook({ className, grade });
  const safeName = (className || "Kelas").replace(/[^a-zA-Z0-9_\-]/g, "_");
  const fileName = `Template_Import_Siswa_${safeName}.xlsx`;

  XLSX.writeFile(wb, fileName);
}

/**
 * Exports existing student list to Excel workbook.
 */
export function exportStudentsToWorkbook(students = [], className = "") {
  const XLSX = getXLSX();
  const wb = XLSX.utils.book_new();

  const headers = [
    "No",
    "Nama Lengkap Siswa",
    "Nomor Induk Siswa (NIS)",
    "Jenis Kelamin",
    "Tanggal Lahir",
    "Tinggi Badan (cm)",
    "Berat Badan (kg)"
  ];

  const rows = (students || []).map((s, idx) => [
    idx + 1,
    s.name || "",
    s.studentNumber || "",
    s.gender === "male" ? "Laki-laki" : s.gender === "female" ? "Perempuan" : "",
    s.birthDate || "",
    s.heightCm || "",
    s.weightKg || ""
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws["!cols"] = [
    { wch: 6 },
    { wch: 30 },
    { wch: 22 },
    { wch: 18 },
    { wch: 16 },
    { wch: 18 },
    { wch: 18 }
  ];

  XLSX.utils.book_append_sheet(wb, ws, "DATA SISWA");
  return wb;
}

/**
 * Exports and downloads current class student roster directly in browser.
 */
export function downloadStudentsExcel(students = [], className = "") {
  const XLSX = getXLSX();
  const wb = exportStudentsToWorkbook(students, className);
  const safeName = (className || "Kelas").replace(/[^a-zA-Z0-9_\-]/g, "_");
  const fileName = `Data_Siswa_${safeName}.xlsx`;

  XLSX.writeFile(wb, fileName);
}
