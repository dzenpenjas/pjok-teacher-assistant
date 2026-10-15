import test from 'node:test';
import assert from 'node:assert/strict';
import { snapshotBatchReportSelection } from '../src/services/batch-report-selection.js';
import { calculateReportAge, createFinalReportPage } from '../src/ui/final-report-page-builder.js';
import { ensureReportFitsA4, reportExceedsA4, ensureSinglePdfPage } from '../src/ui/report-pdf-layout.js';

test('empty assessment selection stays empty with growth or observations selected', () => {
  for (const flags of [{includeGrowth:true}, {includeObservations:true}, {}]) {
    const snapshot = snapshotBatchReportSelection({assessmentSessionIds:[], ...flags}, new Set(['a1']));
    assert.deepEqual(snapshot.assessmentSessionIds, []);
    assert.equal(snapshot.includeGrowth, flags.includeGrowth === true);
    assert.equal(snapshot.includeObservations, flags.includeObservations === true);
  }
});
test('snapshot retains original IDs and flags after UI mutation and excludes other classes', () => {
  const ui = {assessmentSessionIds:['a1','other'], includeGrowth:true, includeObservations:false};
  const snapshot = snapshotBatchReportSelection(ui, new Set(['a1','a2']));
  ui.assessmentSessionIds.splice(0,2,'a2');
  ui.includeGrowth=false; ui.includeObservations=true;
  assert.deepEqual(snapshot, {assessmentSessionIds:['a1'], includeGrowth:true, includeObservations:false});
  assert.throws(() => snapshot.assessmentSessionIds.push('a2'), TypeError);
});
test('report age uses report date around birthday and year boundaries', () => {
  assert.equal(calculateReportAge('2016-10-15','2026-10-14'),9);
  assert.equal(calculateReportAge('2016-10-15','2026-10-15'),10);
  assert.equal(calculateReportAge('2016-10-15','2026-10-16'),10);
  assert.equal(calculateReportAge('2016-12-31','2026-01-01'),9);
  assert.equal(calculateReportAge('2016-10-15','14 Oktober 2026'),9);
  assert.equal(calculateReportAge('2016-10-15',new Date(2026,9,15)),10);
});
test('report age rejects missing, invalid and future birth dates', () => {
  for (const birth of ['', undefined, 'invalid', '2016-02-30','2027-01-01']) {
    assert.equal(calculateReportAge(birth,'2026-10-15'),null);
  }
  assert.equal(calculateReportAge('2016-10-15','invalid'),null);
  assert.equal(calculateReportAge('2016-02-29','2026-02-28'),9);
  assert.equal(calculateReportAge('2016-02-29','2026-03-01'),10);
});
function page(normalHeight, compactHeight=normalHeight) {
  let compact=false;
  return {offsetWidth:794, clientWidth:794, scrollWidth:794,
    get offsetHeight() {return compact ? compactHeight : normalHeight;},
    get clientHeight() {return this.offsetHeight;},
    get scrollHeight() {return this.offsetHeight;},
    classList:{remove(){compact=false;},add(){compact=true;},contains(){return compact;}}
  };
}
globalThis.document = {createElement:()=>({textContent:'',children:[],append(...nodes){this.children.push(...nodes);}})};
globalThis.requestAnimationFrame = (callback) => callback();
test('PDF detects growing min-height paper even without scroll overflow', () => {
  assert.equal(reportExceedsA4(page(1500)),true);
  assert.equal(reportExceedsA4(page(1123)),false);
});
test('PDF uses compact layout then revalidates; persistent overflow aborts', async () => {
  const fitting=page(1500,1100); await ensureReportFitsA4(fitting);
  assert.equal(fitting.classList.contains(),true);
  const twoPage=page(1800,1400); await ensureReportFitsA4(twoPage);
  assert.equal(twoPage.classList.contains(),true);
  const overflowing=page(2800,2400);
  await assert.rejects(ensureReportFitsA4(overflowing),/Ekspor dihentikan/);
  const horizontal=page(1100);horizontal.scrollWidth=900;
  await assert.rejects(ensureReportFitsA4(horizontal),/Ekspor dihentikan/);
});
test('PDF rejects extra output pages without deleting them', () => {
  let deleted=false;
  const pdf={internal:{getNumberOfPages:()=>3},deletePage(){deleted=true;}};
  assert.throws(()=>ensureSinglePdfPage(pdf),/tanpa menghapus halaman/);
  assert.equal(deleted,false);
  assert.doesNotThrow(()=>ensureSinglePdfPage({internal:{getNumberOfPages:()=>1}}));
  assert.doesNotThrow(()=>ensureSinglePdfPage({internal:{getNumberOfPages:()=>2}}));
});
function contents(node){return [node.textContent,...node.children.map(contents)].join(' ');}
test('PDF uses generic score label and age at report date instead of stale context age', () => {
  const output=contents(createFinalReportPage({student:{name:'Uji',birthDate:'2016-10-15'},reportDate:'14 Oktober 2026',
    reportContext:{studentAgeText:'10 Tahun', selectedSections:{learning:true,growth:false},assessments:[{numericScore:78}]},draft:{}}));
  assert.match(output,/NILAI PJOK/);assert.doesNotMatch(output,/TENGAH SEMESTER/);
  assert.match(output,/9 Tahun/);assert.match(output,/78/);
});
