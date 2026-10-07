import { getXLSX } from "./xlsx-runtime.js";

export { getXLSX };

/**
 * Exact minimal headers and order for Sheet NILAI.
 */
export const REPORT_SCORE_HEADERS = Object.freeze([
  "Nama Siswa",
  "NIS",
  "Asesmen",
  "Nilai Asli",
  "Nilai Konversi",
  "Rentang Konversi"
]);

/**
 * Builds table rows from report data.
 * Granularity: 1 row = 1 student × 1 assessment.
 *
 * @param {Array} studentReports List of { student, savedReport } or report items
 * @returns {Array<Array>} Array of row arrays matching REPORT_SCORE_HEADERS
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
 * Generates an XLSX workbook for report scores.
 *
 * @param {Array} data Either raw rows aoa or studentReports array
 * @returns {object} XLSX workbook
 */
export function generateReportScoreWorkbook(data = []) {
  const XLSX = getXLSX();
  const wb = XLSX.utils.book_new();

  const isAoa = Array.isArray(data) && (data.length === 0 || Array.isArray(data[0]));
  const rows = isAoa ? data : buildReportScoreRows(data);

  const sheetData = [REPORT_SCORE_HEADERS, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(sheetData);

  ws["!cols"] = [
    { wch: 28 }, // Nama Siswa
    { wch: 16 }, // NIS
    { wch: 30 }, // Asesmen
    { wch: 14 }, // Nilai Asli
    { wch: 16 }, // Nilai Konversi
    { wch: 18 }  // Rentang Konversi
  ];

  XLSX.utils.book_append_sheet(wb, ws, "NILAI");
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
  const rows = buildReportScoreRows(studentReports);
  const wb = generateReportScoreWorkbook(rows);
  const finalFilename = filename || generateScoreExportFilename(classRoom);

  XLSX.writeFile(wb, finalFilename);
  return { success: true, filename: finalFilename, rowCount: rows.length };
}
