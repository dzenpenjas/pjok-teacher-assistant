import test from 'node:test';
import assert from 'node:assert/strict';
import { planReportCanvas, appendReportToPdf, reportPdfFailure } from '../src/ui/report-pdf-layout.js';

const width = 794;
const pageHeight = Math.ceil(width * 297 / 210);
function reportPage(height = 1123, compactHeight = height) {
  let compact = false;
  return { offsetWidth: width, clientWidth: width, scrollWidth: width, isConnected: true, textContent: 'Laporan siswa dengan seluruh catatan dan footer',
    get offsetHeight() { return compact ? compactHeight : height; }, get scrollHeight() { return this.offsetHeight; },
    classList: { remove() { compact = false; }, add() { compact = true; }, contains() { return compact; } }
  };
}
function harness(canvases, { failStage, failCaptureAt } = {}) {
  let pages = 1;
  let captureCount = 0;
  const stored = [], draws = [], mutations = [], rendered = [], images = new Map();
  const pdf = {
    internal: { getNumberOfPages: () => pages },
    addPage() { pages++; mutations.push('addPage'); },
    addImage(data) { if (failStage === 'addImage') throw new Error('Penyusunan gagal'); stored.push({page: pages, draw: images.get(data)}); mutations.push('addImage'); }
  };
  globalThis.document = {
    createElement(type) {
      assert.equal(type, 'canvas');
      let draw;
      return { width: 0, height: 0,
        getContext() { return failStage === 'context' ? null : {
          fillRect() {},
          drawImage(source, sx, sy, sw, sh, dx, dy, dw, dh) {
            assert.equal(source.width, sw); assert.equal(sw, dw); assert.equal(sh, dh);
            assert.equal(sx, 0); assert.equal(dx, 0); assert.equal(dy, 0);
            draw = { id: source.id, y: sy, height: sh }; draws.push(draw);
          }
        }; },
        toDataURL() { if (failStage === 'encode') throw new Error('Encoding gagal'); const id = `image-${images.size}`; images.set(id, draw); return id; }
      };
    }
  };
  globalThis.requestAnimationFrame = (cb) => cb();
  const createWorker = () => {
    let source, mode;
    return { set(options) { assert.deepEqual(options.pagebreak, {mode: []}); return this; }, from(input) { source = input; return this; },
      toCanvas() { mode = 'canvas'; return this; }, toPdf() { mode = 'pdf'; return this; },
      async get(kind) {
        if (mode === 'pdf') { assert.equal(kind, 'pdf'); assert.equal(source.width, 1); assert.equal(source.height, 1); return pdf; }
        assert.equal(kind, 'canvas'); rendered.push(source); captureCount++;
        if (failStage === 'capture' || captureCount === failCaptureAt) throw new Error('Rendering gagal');
        return canvases.shift();
      }
    };
  };
  return { createWorker, pdf, stored, draws, mutations, rendered };
}

test('canvas pagination retains every row at exact one/two page boundaries', () => {
  for (const height of [1, pageHeight - 1, pageHeight, pageHeight + 1, pageHeight * 2]) {
    const slices = planReportCanvas({width, height});
    assert.equal(slices.length, Math.ceil(height / pageHeight));
    assert.equal(slices.reduce((sum, slice) => sum + slice.height, 0), height);
    assert.equal(slices[0].y, 0);
    for (let i = 1; i < slices.length; i++) assert.equal(slices[i].y, slices[i-1].y + slices[i-1].height);
    assert.equal(slices.at(-1).y + slices.at(-1).height, height);
  }
  assert.throws(() => planReportCanvas({width, height: pageHeight * 2 + 1}), /melebihi batas 2/);
  for (const canvas of [{width:0,height:1},{width:1,height:0},{width:NaN,height:100},{width:10,height:Infinity},{width:1.5,height:2}]) {
    assert.throws(() => planReportCanvas(canvas), /tidak valid/);
  }
});
test('first, middle, and last students share identical rendering and slicing without overwritten pages', async () => {
  const h = harness([{id:'first',width,height:pageHeight*2},{id:'middle',width,height:pageHeight},{id:'last',width,height:pageHeight*2}]);
  let pdf = null;
  for (const studentName of ['first','middle','last']) {
    pdf = await appendReportToPdf({page:reportPage(1800,1400), options:{}, pdf, studentName, createWorker:h.createWorker});
  }
  assert.equal(pdf.internal.getNumberOfPages(), 5);
  assert.deepEqual(h.stored.map(item => item.page), [1,2,3,4,5]);
  assert.deepEqual(h.stored.map(item => item.draw.id), ['first','first','middle','last','last']);
  assert.deepEqual(h.stored[0].draw, {...h.stored[3].draw,id:'first'});
  assert.deepEqual(h.stored[1].draw, {...h.stored[4].draw,id:'first'});
  assert.equal(h.rendered.length, 3);
});
test('compact mode is attempted before rendering and preserves the final canvas row on page two', async () => {
  const h = harness([{id:'uji',width,height:pageHeight+7}]);
  const page = reportPage(1700,1400);
  await appendReportToPdf({page,options:{},studentName:'Kelas 4 Uji',createWorker:h.createWorker});
  assert.equal(page.classList.contains(),true);
  assert.deepEqual(h.draws,[{id:'uji',y:0,height:pageHeight},{id:'uji',y:pageHeight,height:7}]);
});
test('overlong canvas fails before slicing or mutating an existing batch PDF', async () => {
  const h = harness([{id:'too-tall',width,height:pageHeight*2+1}]);
  await assert.rejects(appendReportToPdf({page:reportPage(),options:{},pdf:h.pdf,studentName:'Budi',createWorker:h.createWorker}), /Siswa: Budi\nTahap: Validasi tinggi canvas\nPenyebab:.*melebihi batas 2/);
  assert.deepEqual(h.draws,[]); assert.deepEqual(h.mutations,[]);
});
test('canvas failure on a later student retains prior pages and aborts with the correct name', async () => {
  const h = harness([{id:'first',width,height:pageHeight}],{failCaptureAt:2});
  const pdf = await appendReportToPdf({page:reportPage(),options:{},studentName:'Andi',createWorker:h.createWorker});
  await assert.rejects(appendReportToPdf({page:reportPage(),options:{},pdf,studentName:'Citra',createWorker:h.createWorker}), /Siswa: Citra\nTahap: Rendering canvas\nPenyebab: Rendering gagal/);
  assert.equal(h.stored.length,1); assert.equal(pdf.internal.getNumberOfPages(),1);
});
test('layout, encoding, and assembly failures expose student, stage, and cause', async () => {
  for (const [failStage, expected] of [['context','Pagination canvas'],['encode','Pagination canvas'],['addImage','Penyusunan PDF']]) {
    const h = harness([{id:'uji',width,height:pageHeight}],{failStage});
    await assert.rejects(appendReportToPdf({page:reportPage(),options:{},studentName:'Dewi',createWorker:h.createWorker}), (error) => {
      assert.match(error.message,/Siswa: Dewi/); assert.ok(error.message.includes(`Tahap: ${expected}`)); assert.match(error.message,/Penyebab:/); return true;
    });
    if (failStage !== 'addImage') assert.deepEqual(h.mutations,[]);
  }
  const h = harness([]);
  await assert.rejects(appendReportToPdf({page:reportPage(3000),options:{},studentName:'Eka',createWorker:h.createWorker}), /Siswa: Eka\nTahap: Validasi layout\nPenyebab:.*2 halaman/);
});
test('save failure formatting preserves the original failing student and stage', () => {
  const original=reportPdfFailure('Fajar','Menyimpan PDF',new Error('Unduhan gagal'));
  assert.match(original.message,/Fajar\nTahap: Menyimpan PDF\nPenyebab: Unduhan gagal/);
  assert.equal(reportPdfFailure('Other','Other',original),original);
});
