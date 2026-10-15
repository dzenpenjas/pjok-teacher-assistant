import test from 'node:test';
import assert from 'node:assert/strict';
import { createFinalReportPage } from '../src/ui/final-report-page-builder.js';

globalThis.document = { createElement: () => ({ children: [], textContent: '', append(...nodes) { this.children.push(...nodes); } }) };
function text(node) { return [node.textContent, ...node.children.map(text)].join(' '); }
function report(details, scoring) {
  return text(createFinalReportPage({ student: { name: 'Siswa' }, draft: {}, reportContext: {
    selectedSections: { learning: true, growth: false }, reportDetails: details, reportScoring: scoring,
    assessments: [{ assessmentSessionId: 'a1', title: 'Asesmen 1', numericScore: 78,
      items: [{ rubricLevel: 3, rubricDescription: 'Gerakan sudah konsisten.' }], teacherNote: 'Latih keseimbangan.' }]
  } }));
}
test('detail nilai default tersembunyi untuk laporan lama', () => {
  assert.doesNotMatch(report(), /Detail Nilai Asesmen|Asesmen 1/);
});
test('detail menampilkan tabel nilai dan deskripsi sesuai evidence', () => {
  const output = report({ enabled: true });
  assert.match(output, /Detail Nilai Asesmen/);
  assert.match(output, /Asesmen/);
  assert.match(output, /Nilai/);
  assert.match(output, /Capaian/);
  assert.match(output, /Asesmen 1/);
  assert.match(output, /78/);
  assert.match(output, /Gerakan sudah konsisten/);
  assert.match(output, /Latih keseimbangan/);
});
test('deskripsi dapat disembunyikan tanpa menghilangkan nilai', () => {
  const output = report({ enabled: true, descriptions: false });
  assert.match(output, /Asesmen 1/);
  assert.match(output, /78/);
  assert.doesNotMatch(output, /Gerakan sudah konsisten|Latih keseimbangan/);
});
test('detail menggunakan nilai konversi dan tidak mengganti nilai kosong dengan nilai asli', () => {
  assert.match(report({ enabled: true }, { enabled: true, sessions: { a1: { convertedScore: 85 } } }), /85/);
  const unavailable = report({ enabled: true }, { enabled: true, sessions: {} });
  assert.match(unavailable, /Asesmen 1\s+-/);
  assert.doesNotMatch(unavailable, /\b78\b/);
});
