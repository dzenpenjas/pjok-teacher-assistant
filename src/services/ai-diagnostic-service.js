/**
 * AI Diagnostic Service for Batch Report Generation.
 * Provides stage constants, user-facing stage labels, and human-readable diagnostic text formatting.
 */

export const BATCH_STAGES = {
  BATCH_STARTED: "BATCH_STARTED",
  STUDENT_SELECTED: "STUDENT_SELECTED",
  CONTEXT_BUILDING: "CONTEXT_BUILDING",
  CONTEXT_READY: "CONTEXT_READY",
  API_REQUEST_START: "API_REQUEST_START",
  API_WAITING: "API_WAITING",
  API_RESPONSE_RECEIVED: "API_RESPONSE_RECEIVED",
  RESPONSE_PARSING: "RESPONSE_PARSING",
  REPORT_SAVING: "REPORT_SAVING",
  STUDENT_DONE: "STUDENT_DONE",
  BATCH_DONE: "BATCH_DONE",
  ERROR: "ERROR"
};

/**
 * Returns human-friendly live label for each stage.
 */
export function getDiagnosticStageLabel(stage) {
  switch (stage) {
    case BATCH_STAGES.CONTEXT_BUILDING:
      return "Menyiapkan data siswa...";
    case BATCH_STAGES.API_WAITING:
      return "Menunggu respons AI...";
    case BATCH_STAGES.RESPONSE_PARSING:
      return "Memproses hasil AI...";
    case BATCH_STAGES.REPORT_SAVING:
      return "Menyimpan laporan...";
    case BATCH_STAGES.BATCH_STARTED:
      return "Memulai proses batch...";
    case BATCH_STAGES.STUDENT_SELECTED:
      return "Memilih data siswa...";
    case BATCH_STAGES.CONTEXT_READY:
      return "Data siswa siap...";
    case BATCH_STAGES.API_REQUEST_START:
      return "Menghubungi layanan AI...";
    case BATCH_STAGES.API_RESPONSE_RECEIVED:
      return "Menerima respons AI...";
    case BATCH_STAGES.STUDENT_DONE:
      return "Selesai memproses siswa...";
    case BATCH_STAGES.BATCH_DONE:
      return "Semua laporan selesai diproses.";
    case BATCH_STAGES.ERROR:
      return "Terjadi kendala pada proses.";
    default:
      return stage || "";
  }
}

/**
 * Formats diagnostic state into a clean, human-readable text block for clipboard.
 * Strictly excludes API keys, request headers, full prompt, and full report contents.
 */
export function formatAiDiagnosticText(diag) {
  if (!diag) return "AI REPORT DIAGNOSTIC\nNo diagnostic data available.";

  const runId = diag.runId || "-";
  const stage = diag.stage || "-";
  const studentName = diag.studentName || "-";
  const progress = (diag.totalStudents != null && diag.totalStudents > 0)
    ? `${diag.studentIndex || 0} / ${diag.totalStudents}`
    : "-";
  const assessments = diag.assessmentCount != null ? diag.assessmentCount : "-";
  const growth = diag.growthCount != null ? diag.growthCount : "-";
  const observations = diag.observationCount != null ? diag.observationCount : "-";
  const requestStarted = diag.requestStartedAt || "-";

  let elapsed = "-";
  if (diag.elapsedMs != null) {
    elapsed = `${diag.elapsedMs}ms`;
  } else if (diag.requestStartedAt) {
    const ms = Date.now() - new Date(diag.requestStartedAt).getTime();
    elapsed = `${Math.max(0, ms)}ms`;
  }

  const httpStatus = diag.httpStatus != null ? String(diag.httpStatus) : "-";
  const lastCompletedStage = diag.lastCompletedStage || "-";
  const errorCode = diag.errorCode || "-";
  const error = diag.errorMessage || "-";

  return [
    "AI REPORT DIAGNOSTIC",
    `Run ID: ${runId}`,
    `Stage: ${stage}`,
    `Student: ${studentName}`,
    `Progress: ${progress}`,
    `Assessments: ${assessments}`,
    `Growth: ${growth}`,
    `Observations: ${observations}`,
    `Request started: ${requestStarted}`,
    `Elapsed: ${elapsed}`,
    `HTTP status: ${httpStatus}`,
    `Last completed stage: ${lastCompletedStage}`,
    `Error code: ${errorCode}`,
    `Error: ${error}`
  ].join("\n");
}
