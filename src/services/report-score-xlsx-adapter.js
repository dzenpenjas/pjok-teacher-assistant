import { getXLSX } from "./xlsx-runtime.js";

export { getXLSX };

/**
 * Headers for Sheet 1: NILAI_AKHIR (1 row per student).
 */
export const FINAL_SCORE_HEADERS = Object.freeze([
  "Nama Siswa",
  "NIS",
  "Nilai Akhir",
  "Rentang Konversi"
]);

/**
 * Headers for Sheet 2: DETAIL_ASESMEN (1 row per student × assessment).
 */
export const DETAIL_ASSESSMENT_HEADERS = Object.freeze([
  "Nama Siswa",
  "NIS",
  "Asesmen",
  "Nilai Asli",
  "Nilai Konversi",
  "Rentang Konversi"
]);

export const REPORT_SCORE_HEADERS = DETAIL_ASSESSMENT_HEADERS;

/**
 * Builds final summary rows from report data.
 * Granularity: 1 row = 1 student.
 *
 * @param {Array} studentReports List of { student, savedReport } or report items
 * @returns {Array<Array>} Array of row arrays matching FINAL_SCORE_HEADERS
 */
export function buildFinalScoreRows(studentReports = []) {
  const rows = [];

  for (const item of studentReports) {
    if (!item) continue;

    const student = item.student || item.savedReport?.student || item.reportContext?.student || {};
    const report = item.savedReport || item.report || item;
    const reportContext = report?.reportContext || item.reportContext || {};

    const studentName = student.name || reportContext.student?.name || "";
    const studentNis = student.studentNumber || reportContext.student?.studentNumber || "";

    const reportScoring = reportContext.reportScoring || null;
    const isConversionEnabled = Boolean(reportScoring && reportScoring.enabled);

    let rentangKonversi = "";
    if (
      isConversionEnabled &&
      reportScoring?.minimum !== null &&
      reportScoring?.minimum !== undefined &&
      reportScoring?.maximum !== null &&
      reportScoring?.maximum !== undefined
    ) {
      rentangKonversi = `${reportScoring.minimum}–${reportScoring.maximum}`;
    }

    const rawFinalScore = reportScoring?.overallReportScore;
    let nilaiAkhir = "";
    if (
      rawFinalScore !== null &&
      rawFinalScore !== undefined &&
      rawFinalScore !== "" &&
      Number.isFinite(Number(rawFinalScore))
    ) {
      nilaiAkhir = Number(rawFinalScore);
    }

    rows.push([
      studentName,
      studentNis,
      nilaiAkhir,
      rentangKonversi
    ]);
  }

  return rows;
}

/**
 * Builds table rows from report data.
 * Granularity: 1 row = 1 student × 1 assessment.
 *
 * @param {Array} studentReports List of { student, savedReport } or report items
 * @returns {Array<Array>} Array of row arrays matching DETAIL_ASSESSMENT_HEADERS
 */
export function buildReportScoreRows(studentReports = []) {
  const rows = [];

  for (const item of studentReports) {
    if (!item) continue;

    const student = item.student || item.savedReport?.student || item.reportContext?.student || {};
    const report = item.savedReport || item.report || item;
    const reportContext = report?.reportContext || item.reportContext || {};
    const draft = report?.draft || item.draft || {};

    const studentName = student.name || reportContext.student?.name || "";
    const studentNis = student.studentNumber || reportContext.student?.studentNumber || "";

    const reportScoring = reportContext.reportScoring || null;
    const isConversionEnabled = Boolean(reportScoring && reportScoring.enabled);

    let rentangKonversi = "";
    if (
      isConversionEnabled &&
      reportScoring?.minimum !== null &&
      reportScoring?.minimum !== undefined &&
      reportScoring?.maximum !== null &&
      reportScoring?.maximum !== undefined
    ) {
      rentangKonversi = `${reportScoring.minimum}–${reportScoring.maximum}`;
    }

    const assessments = Array.isArray(reportContext.assessments) && reportContext.assessments.length > 0
      ? reportContext.assessments
      : (Array.isArray(draft.learning) ? draft.learning : []);

    for (const as of assessments) {
      if (!as) continue;

      const sessionId = as.assessmentSessionId || as.sessionId || as.id || "";
      const title = as.title || "Asesmen PJOK";

      const rawScore = (as.numericScore !== null && as.numericScore !== undefined && as.numericScore !== "" && Number.isFinite(Number(as.numericScore)))
        ? Number(as.numericScore)
        : "";

      let convertedScore = "";
      if (isConversionEnabled && reportScoring?.sessions && sessionId) {
        const sessionScoring = reportScoring.sessions[sessionId];
        if (
          sessionScoring &&
          sessionScoring.canConvert === true &&
          sessionScoring.convertedScore !== null &&
          sessionScoring.convertedScore !== undefined &&
          sessionScoring.convertedScore !== "" &&
          Number.isFinite(Number(sessionScoring.convertedScore))
        ) {
          convertedScore = Number(sessionScoring.convertedScore);
        }
      }

      rows.push([
        studentName,
        studentNis,
        title,
        rawScore,
        convertedScore,
        rentangKonversi
      ]);
    }
  }

  return rows;
}

/**
 * Generates an XLSX workbook for report scores with 2 sheets:
 * 1. NILAI_AKHIR (1 row per student)
 * 2. DETAIL_ASESMEN (1 row per student × assessment)
 *
 * @param {Array} studentReports List of student report items
 * @returns {object} XLSX workbook
 */
export function generateReportScoreWorkbook(studentReports = []) {
  const XLSX = getXLSX();
  const wb = XLSX.utils.book_new();

  const finalRows = buildFinalScoreRows(studentReports);
  const detailRows = buildReportScoreRows(studentReports);

  // Sheet 1: NILAI_AKHIR
  const finalSheetData = [FINAL_SCORE_HEADERS, ...finalRows];
  const wsFinal = XLSX.utils.aoa_to_sheet(finalSheetData);
  wsFinal["!cols"] = [
    { wch: 28 }, // Nama Siswa
    { wch: 16 }, // NIS
    { wch: 16 }, // Nilai Akhir
    { wch: 18 }  // Rentang Konversi
  ];
  XLSX.utils.book_append_sheet(wb, wsFinal, "NILAI_AKHIR");

  // Sheet 2: DETAIL_ASESMEN
  const detailSheetData = [DETAIL_ASSESSMENT_HEADERS, ...detailRows];
  const wsDetail = XLSX.utils.aoa_to_sheet(detailSheetData);
  wsDetail["!cols"] = [
    { wch: 28 }, // Nama Siswa
    { wch: 16 }, // NIS
    { wch: 30 }, // Asesmen
    { wch: 14 }, // Nilai Asli
    { wch: 16 }, // Nilai Konversi
    { wch: 18 }  // Rentang Konversi
  ];
  XLSX.utils.book_append_sheet(wb, wsDetail, "DETAIL_ASESMEN");

  return wb;
}

/**
 * Generates safe export filename for report scores.
 */
export function generateScoreExportFilename(classRoom = null) {
  const rawName = classRoom?.name || "Kelas";
  const cleanName = rawName.replace(/[^a-zA-Z0-9]/g, "_");
  return `Nilai_Laporan_PJOK_${cleanName}.xlsx`;
}

/**
 * Generates and downloads Excel file directly in browser.
 *
 * @param {object} params
 * @param {object} params.classRoom Class object
 * @param {Array} params.studentReports List of { student, savedReport }
 * @param {string} [params.filename] Optional custom filename
 * @returns {{ success: boolean, filename: string, rowCount: number }}
 */
export function exportReportScoresToExcel({ classRoom = null, studentReports = [], filename = null } = {}) {
  const XLSX = getXLSX();
  const wb = generateReportScoreWorkbook(studentReports);
  const finalFilename = filename || generateScoreExportFilename(classRoom);

  XLSX.writeFile(wb, finalFilename);
  return { success: true, filename: finalFilename, rowCount: studentReports.length };
}
