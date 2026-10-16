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
  BATCH_HALTED: "BATCH_HALTED",
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
    case BATCH_STAGES.BATCH_HALTED:
      return "Batch dihentikan: permintaan AI ditolak berulang";
    case BATCH_STAGES.ERROR:
      return "Terjadi kendala pada proses.";
    default:
      return stage || "";
  }
}

/**
 * Categorizes AI diagnostic errors into teacher-friendly labels.
 */
export function getFriendlyErrorMessage(errorCode, originalError, httpStatus, googleStatus) {
  if (httpStatus === 401 || httpStatus === 403 || errorCode === "AUTH_ERROR") {
    return "Izin akses AI tidak valid (Periksa API Key).";
  }
  if (httpStatus === 404 || errorCode === "MODEL_NOT_FOUND") {
    return "Model AI tidak tersedia untuk project/kunci ini.";
  }
  if (httpStatus === 429 || errorCode === "RATE_LIMIT_EXCEEDED") {
    return "Terlalu banyak permintaan (Rate limit). Tunggu sebentar.";
  }
  if (
    httpStatus === 400 ||
    errorCode === "INVALID_ARGUMENT" ||
    googleStatus === "INVALID_ARGUMENT" ||
    (typeof originalError === "string" && originalError.includes("INVALID_ARGUMENT"))
  ) {
    return "Permintaan AI ditolak (HTTP 400 — INVALID_ARGUMENT). Parameter atau struktur request tidak valid.";
  }
  if (httpStatus >= 500 || errorCode === "AI_SERVER_ERROR") {
    return "Kendala teknis pada server AI.";
  }

  switch (errorCode) {
    case "AI_REQUEST_TIMEOUT":
      return "Permintaan AI terlalu lama (Timeout).";
    case "INVALID_AI_RESPONSE":
      return "Format jawaban AI tidak sesuai yang diharapkan.";
    case "SAVE_ERROR":
      return "Gagal menyimpan laporan ke penyimpanan.";
    case "AI_REQUEST_ERROR":
      return "Kendala teknis pada layanan AI.";
    case "NETWORK_ERROR":
      return "Kendala jaringan. Pastikan koneksi internet stabil.";
    default:
      if (originalError && typeof originalError === "string" && originalError.includes("Network")) {
        return "Kendala jaringan. Pastikan koneksi internet stabil.";
      }
      return originalError || "Kendala tidak dikenal.";
  }
}

/**
 * Sanitizes error messages for clipboard diagnostic export.
 * Strips API keys, auth headers, raw payload echoes, raw HTML responses, and oversized text.
 */
export function sanitizeDiagnosticErrorMessage(rawMsg) {
  if (!rawMsg || typeof rawMsg !== "string") return "-";
  let str = rawMsg;

  // Redact API keys and authorization headers
  str = str.replace(/AIza[0-9A-Za-z_-]{35}/g, "[REDACTED_API_KEY]");
  str = str.replace(/key=[^&\s"'`]+/gi, "key=[REDACTED]");
  str = str.replace(/x-goog-api-key\s*:\s*[^,\s"'`]+/gi, "x-goog-api-key: [REDACTED]");
  str = str.replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]");
  str = str.replace(/authorization\s*:\s*[^,\s"'`]+/gi, "authorization: [REDACTED]");

  // Strip raw JSON payloads / contents / prompts / student private data
  if (str.includes('"contents"') || str.includes('"parts"') || str.includes('"text"')) {
    str = str.replace(/\{[\s\S]*"contents"[\s\S]*\}/g, "[PAYLOAD_REDACTED]");
  }

  // Strip raw HTML error pages (e.g. <html>...</html> or <!DOCTYPE...)
  if (/<(!DOCTYPE|html|body|script)[\s\S]*>/i.test(str)) {
    str = "[RAW_HTML_RESPONSE_FILTERED]";
  }

  // If the message still looks like an unsanitized raw JSON response body
  if (str.trim().startsWith("{") && str.trim().endsWith("}")) {
    try {
      const parsed = JSON.parse(str);
      if (parsed?.error?.message) {
        str = parsed.error.message;
      } else {
        str = "[FILTERED_RAW_RESPONSE]";
      }
    } catch {
      str = "[FILTERED_RAW_RESPONSE]";
    }
  }

  // Ensure message is trimmed and not excessively long (max 180 chars) to prevent prompt leakage
  str = str.trim();
  if (str.length > 180) {
    str = str.slice(0, 180) + "...";
  }

  return str || "-";
}

/**
 * Formats diagnostic state into a clean, human-readable text block for clipboard.
 * Strictly excludes API keys, request headers, full prompt, and full report contents.
 */
export function formatAiDiagnosticText(diag) {
  if (!diag) return "AI REPORT DIAGNOSTIC\nNo diagnostic data available.";

  const runId = diag.runId || "-";
  const stageLabel = getDiagnosticStageLabel(diag.stage) || "-";
  const studentName = diag.studentName || "-";
  const progress = (diag.totalStudents != null && diag.totalStudents > 0)
    ? `${diag.studentIndex || 0} / ${diag.totalStudents}`
    : "-";

  let elapsed = "-";
  if (diag.elapsedMs != null) {
    elapsed = `${diag.elapsedMs}ms`;
  } else if (diag.requestStartedAt) {
    const ms = Date.now() - new Date(diag.requestStartedAt).getTime();
    elapsed = `${Math.max(0, ms)}ms`;
  }

  const httpStatus = diag.httpStatus != null ? String(diag.httpStatus) : "-";
  const googleStatus = diag.googleStatus || (diag.lastFailure?.googleStatus) || "-";
  const errorCode = diag.errorCode || "-";
  const rawError = diag.errorMessage || "-";
  const friendlyError = getFriendlyErrorMessage(diag.errorCode, diag.errorMessage, diag.httpStatus, diag.googleStatus);
  const sanitizedError = sanitizeDiagnosticErrorMessage(rawError);

  const apiModel = diag.apiModel || (diag.lastFailure?.apiModel) || "gemini-3.8-flash";
  const apiEndpoint = diag.apiEndpoint || (diag.lastFailure?.apiEndpoint) || "v1beta/models/gemini-3.8-flash:generateContent";
  const requestBytes = diag.requestBytes != null
    ? `${diag.requestBytes} bytes (${diag.requestChars || diag.requestBytes} karakter)`
    : (diag.lastFailure?.requestBytes != null
        ? `${diag.lastFailure.requestBytes} bytes (${diag.lastFailure.requestChars || diag.lastFailure.requestBytes} karakter)`
        : "-");
  const failureStage = diag.failureStage || (diag.lastFailure?.stage) || (diag.stage === BATCH_STAGES.ERROR || diag.stage === BATCH_STAGES.BATCH_HALTED ? diag.stage : "-");
  const consecutiveCount = diag.consecutiveHttp400Count != null
    ? diag.consecutiveHttp400Count
    : (diag.lastFailure?.consecutiveHttp400Count != null ? diag.lastFailure.consecutiveHttp400Count : 0);

  const lines = [
    "AI REPORT DIAGNOSTIC",
    `Run ID: ${runId}`,
    `Tahap: ${stageLabel} (${diag.stage || "-"})`,
    `Tahap Terakhir: ${diag.lastCompletedStage || "-"}`,
    `Tahap Kegagalan: ${failureStage}`,
    `Siswa: ${studentName}`,
    `Progres: ${progress}`,
    `Model API: ${apiModel}`,
    `Endpoint API: ${apiEndpoint}`,
    `Ukuran Request: ${requestBytes}`,
    `Waktu Tunggu: ${elapsed}`,
    `Waktu Mulai Request: ${diag.requestStartedAt ? new Date(diag.requestStartedAt).toLocaleTimeString() : "-"}`,
    `Data: ${diag.assessmentCount || 0} asesmen, ${diag.growthCount || 0} pertumbuhan, ${diag.observationCount || 0} observasi`,
    `HTTP Status: ${httpStatus}`,
    `Google Error Status: ${googleStatus}`,
    `Kegagalan HTTP 400 Berturut-turut: ${consecutiveCount}`,
    `Kode Error: ${errorCode}`,
    `Kategori Kegagalan: ${friendlyError}`,
    `Deskripsi Error: ${friendlyError}`,
    `Detail Error: ${sanitizedError}`
  ];

  if (diag.lastFailure) {
    const lf = diag.lastFailure;
    const lfProgress = (diag.totalStudents != null && diag.totalStudents > 0)
      ? `${lf.studentIndex || 0} / ${diag.totalStudents}`
      : (lf.studentIndex != null ? String(lf.studentIndex) : "-");
    const lfElapsed = lf.elapsedMs != null ? `${lf.elapsedMs}ms` : "-";
    const lfRequestBytes = lf.requestBytes != null
      ? `${lf.requestBytes} bytes (${lf.requestChars || lf.requestBytes} karakter)`
      : "-";
    const lfFriendlyError = getFriendlyErrorMessage(lf.errorCode, lf.errorMessage, lf.httpStatus, lf.googleStatus);
    const sanitizedLfError = sanitizeDiagnosticErrorMessage(lf.errorMessage);

    lines.push(
      "",
      "LAST FAILURE",
      `Siswa: ${lf.studentName || "-"}`,
      `Progres: ${lfProgress}`,
      `Tahap Kegagalan: ${getDiagnosticStageLabel(lf.stage) || lf.stage || "-"}`,
      `Tahap Sebelumnya: ${lf.lastCompletedStage || "-"}`,
      `Model API: ${lf.apiModel || apiModel}`,
      `Endpoint API: ${lf.apiEndpoint || apiEndpoint}`,
      `Ukuran Request: ${lfRequestBytes}`,
      `HTTP Status: ${lf.httpStatus != null ? String(lf.httpStatus) : "-"}`,
      `Google Error Status: ${lf.googleStatus || "-"}`,
      `Kegagalan HTTP 400 Berturut-turut: ${lf.consecutiveHttp400Count != null ? lf.consecutiveHttp400Count : consecutiveCount}`,
      `Waktu Tunggu: ${lfElapsed}`,
      `Kode Error: ${lf.errorCode || "-"}`,
      `Kategori Kegagalan: ${lfFriendlyError}`,
      `Deskripsi Error: ${lfFriendlyError}`,
      `Detail Error: ${sanitizedLfError}`
    );
  }

  return lines.join("\n");
}
