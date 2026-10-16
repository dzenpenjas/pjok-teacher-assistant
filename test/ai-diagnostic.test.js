import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BATCH_STAGES,
  getDiagnosticStageLabel,
  getFriendlyErrorMessage,
  formatAiDiagnosticText
} from '../src/services/ai-diagnostic-service.js';

test('getDiagnosticStageLabel returns appropriate Indonesian labels', () => {
  assert.equal(getDiagnosticStageLabel(BATCH_STAGES.BATCH_HALTED), 'Batch dihentikan: permintaan AI ditolak berulang');
  assert.equal(getDiagnosticStageLabel(BATCH_STAGES.API_WAITING), 'Menunggu respons AI...');
  assert.equal(getDiagnosticStageLabel(BATCH_STAGES.RESPONSE_PARSING), 'Memproses hasil AI...');
});

test('getFriendlyErrorMessage classifies HTTP 400 INVALID_ARGUMENT accurately', () => {
  const msg = getFriendlyErrorMessage('INVALID_ARGUMENT', 'Request contains an invalid argument', 400, 'INVALID_ARGUMENT');
  assert.match(msg, /Permintaan AI ditolak \(HTTP 400 — INVALID_ARGUMENT\)/);
});

test('getFriendlyErrorMessage distinguishes 401/403, 404, 429, timeout, network', () => {
  assert.match(getFriendlyErrorMessage('AUTH_ERROR', '', 401), /Izin akses AI tidak valid/);
  assert.match(getFriendlyErrorMessage('MODEL_NOT_FOUND', '', 404), /Model AI tidak tersedia/);
  assert.match(getFriendlyErrorMessage('RATE_LIMIT_EXCEEDED', '', 429), /Terlalu banyak permintaan/);
  assert.match(getFriendlyErrorMessage('AI_REQUEST_TIMEOUT', ''), /Timeout/);
  assert.match(getFriendlyErrorMessage('NETWORK_ERROR', 'Network error'), /koneksi internet/);
});

test('formatAiDiagnosticText formats safe metadata without leaking API keys or full prompts', () => {
  const diag = {
    runId: 'run-123',
    stage: BATCH_STAGES.BATCH_HALTED,
    lastCompletedStage: BATCH_STAGES.API_REQUEST_START,
    failureStage: BATCH_STAGES.ERROR,
    studentName: 'Ahmad Siswa',
    studentIndex: 3,
    totalStudents: 10,
    apiModel: 'gemini-3.8-flash',
    apiEndpoint: 'v1beta/models/gemini-3.8-flash:generateContent',
    requestBytes: 1540,
    requestChars: 1540,
    elapsedMs: 240,
    assessmentCount: 2,
    growthCount: 1,
    observationCount: 0,
    httpStatus: 400,
    googleStatus: 'INVALID_ARGUMENT',
    consecutiveHttp400Count: 3,
    errorCode: 'INVALID_ARGUMENT',
    errorMessage: 'Request contains an invalid argument',
    lastFailure: {
      studentName: 'Ahmad Siswa',
      studentIndex: 3,
      stage: BATCH_STAGES.ERROR,
      errorCode: 'INVALID_ARGUMENT',
      errorMessage: 'Request contains an invalid argument',
      httpStatus: 400,
      googleStatus: 'INVALID_ARGUMENT',
      consecutiveHttp400Count: 3,
      apiModel: 'gemini-3.8-flash',
      apiEndpoint: 'v1beta/models/gemini-3.8-flash:generateContent',
      requestBytes: 1540,
      requestChars: 1540,
      elapsedMs: 240
    }
  };

  const text = formatAiDiagnosticText(diag);
  assert.match(text, /AI REPORT DIAGNOSTIC/);
  assert.match(text, /Run ID: run-123/);
  assert.match(text, /Tahap: Batch dihentikan: permintaan AI ditolak berulang/);
  assert.match(text, /Model API: gemini-3.8-flash/);
  assert.match(text, /Ukuran Request: 1540 bytes/);
  assert.match(text, /HTTP Status: 400/);
  assert.match(text, /Google Error Status: INVALID_ARGUMENT/);
  assert.match(text, /Kegagalan HTTP 400 Berturut-turut: 3/);
  assert.match(text, /LAST FAILURE/);

  // Security checks: no API keys or private headers
  assert.doesNotMatch(text, /AIza/i);
  assert.doesNotMatch(text, /x-goog-api-key/i);
  assert.doesNotMatch(text, /Bearer/i);
});
