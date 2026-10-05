import * as xlsxModule from "xlsx";
import {
  ASSESSMENT_PACKAGE_FORMAT,
  ASSESSMENT_PACKAGE_FORMAT_VERSION,
  SUPPORTED_PURPOSES,
  SUPPORTED_ASSESSMENT_TYPES,
  SUPPORTED_METHODS,
  SUPPORTED_RUBRIC_SCALES,
  buildCanonicalAssessmentFromSession,
  createCanonicalAssessmentPackage,
  generateSafeExportFilename
} from "./assessment-package-service.js";

/**
 * Resolves the XLSX library instance across Browser runtime and Node test runner.
 */
export function getXLSX() {
  if (typeof window !== "undefined" && window.XLSX) {
    return window.XLSX;
  }
  if (typeof globalThis !== "undefined" && globalThis.XLSX) {
    return globalThis.XLSX;
  }
  if (xlsxModule && (xlsxModule.read || xlsxModule.default?.read)) {
    return xlsxModule.read ? xlsxModule : xlsxModule.default;
  }
  throw new Error("Library XLSX tidak tersedia.");
}

function normalizeString(val) {
  if (val === undefined || val === null) return "";
  return String(val).trim();
}

/**
 * Parses materials string separated by '|' or ',' into an array of clean strings.
 */
export function parseMaterialsString(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(normalizeString).filter(Boolean);
  const str = String(raw).trim();
  if (!str) return [];
  // Support "|" as primary separator, fallback to ","
  const separator = str.includes("|") ? "|" : ",";
  return str
    .split(separator)
    .map(normalizeString)
    .filter(Boolean);
}

/**
 * Formats materials array into standard pipe-separated string for Excel sheet.
 */
export function formatMaterialsArray(materials) {
  if (!Array.isArray(materials) || materials.length === 0) return "";
  return materials.map(normalizeString).filter(Boolean).join(" | ");
}

/**
 * Expected exact headers for Sheet ASESMEN.
 */
export const ASESMEN_HEADERS = Object.freeze([
  "kode_asesmen",
  "nama_asesmen",
  "versi",
  "kelas_rekomendasi",
  "jenis_asesmen",
  "bentuk_asesmen",
  "kategori",
  "materi",
  "skala_rubrik",
  "instruksi",
  "sumber"
]);

/**
 * Expected exact headers for Sheet BUTIR.
 */
export const BUTIR_HEADERS = Object.freeze([
  "kode_asesmen",
  "no",
  "pertanyaan_instrumen",
  "label_1",
  "rubrik_1",
  "label_2",
  "rubrik_2",
  "label_3",
  "rubrik_3",
  "label_4",
  "rubrik_4",
  "label_5",
  "rubrik_5"
]);

/**
 * Parses workbook object into canonical Assessment Package v1.
 * Validates workbook sheets, required headers, row associations, and returns structured errors on failure.
 */
export function parseAssessmentWorkbook(workbook) {
  if (!workbook || typeof workbook !== "object" || !Array.isArray(workbook.SheetNames)) {
    return {
      success: false,
      errors: [
        {
          sheet: "workbook",
          message: "Format file Excel tidak dapat dibaca atau workbook kosong."
        }
      ]
    };
  }

  const XLSX = getXLSX();
  const errors = [];

  // 1. Verify Sheet ASESMEN existence
  const asesmenSheetName = workbook.SheetNames.find((s) => s.trim().toUpperCase() === "ASESMEN");
  if (!asesmenSheetName) {
    errors.push({
      sheet: "ASESMEN",
      message: "Sheet ASESMEN tidak ditemukan."
    });
  }

  // 2. Verify Sheet BUTIR existence
  const butirSheetName = workbook.SheetNames.find((s) => s.trim().toUpperCase() === "BUTIR");
  if (!butirSheetName) {
    errors.push({
      sheet: "BUTIR",
      message: "Sheet BUTIR tidak ditemukan."
    });
  }

  if (errors.length > 0) {
    return {
      success: false,
      errors
    };
  }

  const asesmenSheet = workbook.Sheets[asesmenSheetName];
  const butirSheet = workbook.Sheets[butirSheetName];

  // Convert sheets to array of row arrays
  const rawAsesmenRows = XLSX.utils.sheet_to_json(asesmenSheet, { header: 1, defval: "" });
  const rawButirRows = XLSX.utils.sheet_to_json(butirSheet, { header: 1, defval: "" });

  if (rawAsesmenRows.length === 0) {
    return {
      success: false,
      errors: [{ sheet: "ASESMEN", message: "Sheet ASESMEN kosong (tidak ada baris header)." }]
    };
  }

  if (rawButirRows.length === 0) {
    return {
      success: false,
      errors: [{ sheet: "BUTIR", message: "Sheet BUTIR kosong (tidak ada baris header)." }]
    };
  }

  // Validate ASESMEN Header
  const asesmenHeaderRow = rawAsesmenRows[0].map((h) => normalizeString(h).toLowerCase());
  const missingAsesmenHeaders = ASESMEN_HEADERS.filter((h) => !asesmenHeaderRow.includes(h));
  if (missingAsesmenHeaders.length > 0) {
    errors.push({
      sheet: "ASESMEN",
      row: 1,
      message: `Sheet ASESMEN: Kolom wajib (${missingAsesmenHeaders.join(", ")}) tidak ditemukan pada header baris 1.`
    });
  }

  // Validate BUTIR Header
  const butirHeaderRow = rawButirRows[0].map((h) => normalizeString(h).toLowerCase());
  const missingButirHeaders = ["kode_asesmen", "pertanyaan_instrumen", "rubrik_1", "rubrik_2", "rubrik_3"].filter(
    (h) => !butirHeaderRow.includes(h)
  );
  if (missingButirHeaders.length > 0) {
    errors.push({
      sheet: "BUTIR",
      row: 1,
      message: `Sheet BUTIR: Kolom wajib (${missingButirHeaders.join(", ")}) tidak ditemukan pada header baris 1.`
    });
  }

  if (errors.length > 0) {
    return {
      success: false,
      errors
    };
  }

  // Parse ASESMEN rows
  const assessmentsMap = new Map();
  let defaultPackageSource = "Paket Asesmen Excel";

  for (let r = 1; r < rawAsesmenRows.length; r++) {
    const row = rawAsesmenRows[r];
    // Skip entirely empty row
    if (!row || row.every((c) => normalizeString(c) === "")) continue;

    const rowObj = {};
    asesmenHeaderRow.forEach((h, idx) => {
      if (h) rowObj[h] = row[idx];
    });

    const humanRowNum = r + 1;
    const externalCode = normalizeString(rowObj.kode_asesmen);
    const name = normalizeString(rowObj.nama_asesmen);
    const sourceVersion = normalizeString(rowObj.versi || "1.0");
    const rawGrade = rowObj.kelas_rekomendasi;
    const parsedGrade = Number(rawGrade);
    const recommendedGrade = !Number.isNaN(parsedGrade) && parsedGrade > 0 ? parsedGrade : null;
    const purpose = normalizeString(rowObj.jenis_asesmen);
    const assessmentType = normalizeString(rowObj.bentuk_asesmen);
    const category = normalizeString(rowObj.kategori || "keterampilan");
    const materials = parseMaterialsString(rowObj.materi);
    const rawScale = rowObj.skala_rubrik;
    const rubricScale = Number(rawScale);
    const instructions = normalizeString(rowObj.instruksi);
    const source = normalizeString(rowObj.sumber);

    if (source && defaultPackageSource === "Paket Asesmen Excel") {
      defaultPackageSource = source;
    }

    if (!externalCode) {
      errors.push({
        sheet: "ASESMEN",
        row: humanRowNum,
        field: "kode_asesmen",
        message: `ASESMEN baris ${humanRowNum}: kode_asesmen belum diisi.`
      });
    } else if (assessmentsMap.has(externalCode)) {
      errors.push({
        sheet: "ASESMEN",
        row: humanRowNum,
        field: "kode_asesmen",
        message: `ASESMEN baris ${humanRowNum}: Duplikasi kode_asesmen "${externalCode}".`
      });
    }

    if (!name) {
      errors.push({
        sheet: "ASESMEN",
        row: humanRowNum,
        field: "nama_asesmen",
        message: `ASESMEN baris ${humanRowNum}: nama_asesmen belum diisi.`
      });
    }

    if (!sourceVersion) {
      errors.push({
        sheet: "ASESMEN",
        row: humanRowNum,
        field: "versi",
        message: `ASESMEN baris ${humanRowNum}: versi belum diisi.`
      });
    }

    if (purpose && !SUPPORTED_PURPOSES.includes(purpose)) {
      errors.push({
        sheet: "ASESMEN",
        row: humanRowNum,
        field: "jenis_asesmen",
        message: `ASESMEN baris ${humanRowNum}: jenis_asesmen "${purpose}" tidak valid. Pilihan: ${SUPPORTED_PURPOSES.join(", ")}.`
      });
    }

    if (assessmentType && !SUPPORTED_ASSESSMENT_TYPES.includes(assessmentType)) {
      errors.push({
        sheet: "ASESMEN",
        row: humanRowNum,
        field: "bentuk_asesmen",
        message: `ASESMEN baris ${humanRowNum}: bentuk_asesmen "${assessmentType}" tidak valid. Pilihan: ${SUPPORTED_ASSESSMENT_TYPES.join(", ")}.`
      });
    }

    if (rawScale === "" || rawScale === undefined || Number.isNaN(rubricScale) || !SUPPORTED_RUBRIC_SCALES.includes(rubricScale)) {
      errors.push({
        sheet: "ASESMEN",
        row: humanRowNum,
        field: "skala_rubrik",
        message: `ASESMEN baris ${humanRowNum}: skala_rubrik (${rowObj.skala_rubrik}) tidak valid. Pilihan: 3, 4, 5.`
      });
    }

    if (materials.length === 0) {
      errors.push({
        sheet: "ASESMEN",
        row: humanRowNum,
        field: "materi",
        message: `ASESMEN baris ${humanRowNum}: materi wajib diisi minimal satu materi.`
      });
    }

    if (externalCode) {
      assessmentsMap.set(externalCode, {
        externalCode,
        sourceVersion: sourceVersion || "1.0",
        name,
        recommendedGrade,
        purpose,
        assessmentType,
        category,
        method: "rubric",
        materials,
        instructions,
        description: "",
        rubricScale: SUPPORTED_RUBRIC_SCALES.includes(rubricScale) ? rubricScale : 5,
        unit: "",
        direction: "higher_better",
        items: []
      });
    }
  }

  if (assessmentsMap.size === 0 && errors.length === 0) {
    errors.push({
      sheet: "ASESMEN",
      message: "Sheet ASESMEN tidak berisi baris data asesmen."
    });
  }

  // Parse BUTIR rows
  for (let r = 1; r < rawButirRows.length; r++) {
    const row = rawButirRows[r];
    if (!row || row.every((c) => normalizeString(c) === "")) continue;

    const rowObj = {};
    butirHeaderRow.forEach((h, idx) => {
      if (h) rowObj[h] = row[idx];
    });

    const humanRowNum = r + 1;
    const kodeAsesmen = normalizeString(rowObj.kode_asesmen);
    const itemNumber = Number(rowObj.no) || r;
    const prompt = normalizeString(rowObj.pertanyaan_instrumen);

    if (!kodeAsesmen) {
      errors.push({
        sheet: "BUTIR",
        row: humanRowNum,
        field: "kode_asesmen",
        message: `BUTIR baris ${humanRowNum}: kode_asesmen belum diisi.`
      });
      continue;
    }

    const targetAssessment = assessmentsMap.get(kodeAsesmen);
    if (!targetAssessment) {
      errors.push({
        sheet: "BUTIR",
        row: humanRowNum,
        field: "kode_asesmen",
        message: `BUTIR baris ${humanRowNum}: kode_asesmen "${kodeAsesmen}" tidak ditemukan pada sheet ASESMEN.`
      });
      continue;
    }

    if (!prompt) {
      errors.push({
        sheet: "BUTIR",
        row: humanRowNum,
        field: "pertanyaan_instrumen",
        message: `BUTIR baris ${humanRowNum}: pertanyaan_instrumen belum diisi.`
      });
    }

    const scale = targetAssessment.rubricScale || 5;
    const rubricLevels = [];

    for (let lvl = 1; lvl <= scale; lvl++) {
      const labelKey = `label_${lvl}`;
      const descKey = `rubrik_${lvl}`;
      const label = normalizeString(rowObj[labelKey]) || `Level ${lvl}`;
      const desc = normalizeString(rowObj[descKey]);

      if (!desc) {
        errors.push({
          sheet: "BUTIR",
          row: humanRowNum,
          field: descKey,
          message: `BUTIR baris ${humanRowNum}: Rubrik level ${lvl} belum diisi untuk asesmen skala ${scale}.`
        });
      }

      rubricLevels.push({
        level: lvl,
        label,
        desc
      });
    }

    targetAssessment.items.push({
      number: itemNumber,
      prompt,
      rubricScale: scale,
      rubricLevels
    });
  }

  // Check each assessment has at least 1 item
  assessmentsMap.forEach((assessment) => {
    if (assessment.items.length === 0) {
      errors.push({
        sheet: "BUTIR",
        message: `Asesmen "${assessment.name || assessment.externalCode}" belum memiliki butir instrumen pada sheet BUTIR.`
      });
    }
  });

  if (errors.length > 0) {
    return {
      success: false,
      errors
    };
  }

  const canonicalPackage = {
    format: ASSESSMENT_PACKAGE_FORMAT,
    formatVersion: ASSESSMENT_PACKAGE_FORMAT_VERSION,
    source: {
      name: defaultPackageSource
    },
    assessments: Array.from(assessmentsMap.values())
  };

  return {
    success: true,
    package: canonicalPackage
  };
}

/**
 * Converts a canonical assessment package into an XLSX workbook object.
 */
export function canonicalAssessmentPackageToWorkbook(canonicalPackage) {
  const XLSX = getXLSX();
  const pkg = canonicalPackage || {};
  const assessments = Array.isArray(pkg.assessments) ? pkg.assessments : [];
  const sourceName = pkg.source?.name || "PJOK Package";

  // 1. Build ASESMEN Sheet rows
  const asesmenRows = [ASESMEN_HEADERS];
  assessments.forEach((as) => {
    asesmenRows.push([
      as.externalCode || "",
      as.name || "",
      as.sourceVersion || "1.0",
      as.recommendedGrade !== undefined && as.recommendedGrade !== null ? as.recommendedGrade : "",
      as.purpose || "formative",
      as.assessmentType || "practice",
      as.category || "keterampilan",
      formatMaterialsArray(as.materials),
      as.rubricScale || 5,
      as.instructions || "",
      sourceName
    ]);
  });

  // 2. Build BUTIR Sheet rows
  const butirRows = [BUTIR_HEADERS];
  assessments.forEach((as) => {
    const items = Array.isArray(as.items) ? as.items : [];
    const scale = as.rubricScale || 5;

    items.forEach((item, idx) => {
      const levelsMap = new Map();
      (item.rubricLevels || []).forEach((lvl) => {
        levelsMap.set(Number(lvl.level), lvl);
      });

      const l1 = levelsMap.get(1) || {};
      const l2 = levelsMap.get(2) || {};
      const l3 = levelsMap.get(3) || {};
      const l4 = levelsMap.get(4) || {};
      const l5 = levelsMap.get(5) || {};

      butirRows.push([
        as.externalCode || "",
        item.number || idx + 1,
        item.prompt || "",
        l1.label || "Level 1",
        l1.desc || "",
        l2.label || "Level 2",
        l2.desc || "",
        l3.label || "Level 3",
        l3.desc || "",
        scale >= 4 ? (l4.label || "Level 4") : "",
        scale >= 4 ? (l4.desc || "") : "",
        scale >= 5 ? (l5.label || "Level 5") : "",
        scale >= 5 ? (l5.desc || "") : ""
      ]);
    });
  });

  const wb = XLSX.utils.book_new();
  const wsAsesmen = XLSX.utils.aoa_to_sheet(asesmenRows);
  const wsButir = XLSX.utils.aoa_to_sheet(butirRows);

  XLSX.utils.book_append_sheet(wb, wsAsesmen, "ASESMEN");
  XLSX.utils.book_append_sheet(wb, wsButir, "BUTIR");

  return wb;
}

/**
 * Generates and downloads template XLSX workbook containing sample assessment and sample item.
 */
export function generateAssessmentPackageTemplateWorkbook() {
  const samplePackage = {
    format: ASSESSMENT_PACKAGE_FORMAT,
    formatVersion: ASSESSMENT_PACKAGE_FORMAT_VERSION,
    source: {
      name: "Contoh Template"
    },
    assessments: [
      {
        externalCode: "CONTOH-UTS-G1-LISAN",
        sourceVersion: "1.0",
        name: "UTS PJOK Kelas 1 - Lisan",
        recommendedGrade: 1,
        purpose: "midterm",
        assessmentType: "oral",
        category: "pengetahuan",
        method: "rubric",
        materials: ["Gerak Lokomotor"],
        rubricScale: 5,
        instructions: "Jawab pertanyaan secara lisan.",
        items: [
          {
            number: 1,
            prompt: "Apa itu gerak lokomotor?",
            rubricScale: 5,
            rubricLevels: [
              { level: 1, label: "Perlu Bimbingan", desc: "Belum mampu menjelaskan pengertian gerak lokomotor" },
              { level: 2, label: "Mulai Berkembang", desc: "Mampu menyebutkan 1 contoh gerak lokomotor" },
              { level: 3, label: "Cukup", desc: "Mampu menjelaskan gerak lokomotor dengan bantuan" },
              { level: 4, label: "Baik", desc: "Mampu menjelaskan gerak lokomotor (gerak berpindah tempat) dengan benar" },
              { level: 5, label: "Sangat Baik", desc: "Mampu menjelaskan definisi dan menyebutkan lebih dari 3 contoh dengan sangat tepat" }
            ]
          }
        ]
      }
    ]
  };

  return canonicalAssessmentPackageToWorkbook(samplePackage);
}

/**
 * Triggers client-side browser download for an XLSX workbook.
 */
export function triggerWorkbookDownload(workbook, filename = "Paket_Asesmen_PJOK.xlsx") {
  const XLSX = getXLSX();
  if (typeof window !== "undefined" && typeof document !== "undefined") {
    XLSX.writeFile(workbook, filename);
  }
}

/**
 * Downloads the Assessment Package Excel template file.
 */
export function downloadAssessmentPackageTemplate(filename = "Template_Import_Asesmen_PJOK.xlsx") {
  const wb = generateAssessmentPackageTemplateWorkbook();
  triggerWorkbookDownload(wb, filename);
  return {
    filename,
    workbook: wb
  };
}

/**
 * Exports one assessment session + definition to an Excel (.xlsx) file download.
 * Does NOT export classId, studentId, assessment results, or local database IDs.
 */
export function exportAssessmentSessionToExcelFile(assessmentSession, assessmentDefinition, options = {}) {
  const canonicalAssessment = buildCanonicalAssessmentFromSession(assessmentSession, assessmentDefinition, options);
  const canonicalPackage = createCanonicalAssessmentPackage({
    sourceName: options.sourceName || "PJOK Assistant",
    assessments: [canonicalAssessment]
  });

  const wb = canonicalAssessmentPackageToWorkbook(canonicalPackage);
  const rawTitle = canonicalAssessment.name || assessmentSession?.title || "Asesmen_PJOK";
  const sanitizedTitle = generateSafeExportFilename(rawTitle).replace(/\.json$/i, "");
  const filename = `${sanitizedTitle || "Asesmen_PJOK"}.xlsx`;

  triggerWorkbookDownload(wb, filename);

  return {
    filename,
    package: canonicalPackage,
    workbook: wb
  };
}
