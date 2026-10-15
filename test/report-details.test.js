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
test('detail menampilkan nilai dan deskripsi sesuai evidence', () => {
  const output = report({ enabled: true });
  assert.match(output, /Asesmen 1 — 78\/100/);
  assert.match(output, /Gerakan sudah konsisten/);
  assert.match(output, /Latih keseimbangan/);
});
test('deskripsi dapat disembunyikan tanpa menghilangkan nilai', () => {
  const output = report({ enabled: true, descriptions: false });
  assert.match(output, /Asesmen 1 — 78\/100/);
  assert.doesNotMatch(output, /Gerakan sudah konsisten|Latih keseimbangan/);
});
test('detail menggunakan nilai konversi dan tidak mengganti nilai kosong dengan nilai asli', () => {
  assert.match(report({ enabled: true }, { enabled: true, sessions: { a1: { convertedScore: 85 } } }), /Asesmen 1 — 85\/100/);
  assert.match(report({ enabled: true }, { enabled: true, sessions: {} }), /Asesmen 1 — Nilai belum tersedia/);
});
