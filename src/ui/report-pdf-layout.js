// min-height allows the paper to grow, so clientHeight alone is not an A4 limit.
export function reportExceedsA4(page, maxPages = 1) {
  const width = page.offsetWidth;
  return width <= 0 || Math.max(page.scrollHeight, page.offsetHeight) > (width * 297 / 210) * maxPages + 1
    || page.scrollWidth > page.clientWidth + 1;
}

export async function ensureReportFitsA4(page) {
  if (document.fonts?.ready) await document.fonts.ready;
  page.classList.remove("a4-compact");
  await new Promise((resolve) => requestAnimationFrame(resolve));
  if (reportExceedsA4(page, 1)) {
    page.classList.add("a4-compact");
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
  if (reportExceedsA4(page, 2)) {
    throw new Error("Isi laporan masih melebihi batas maksimal 2 halaman A4 setelah dipadatkan. Ekspor dihentikan agar seluruh isi, catatan, dan footer tidak terpotong. Ringkas isi laporan lalu coba lagi.");
  }
}

export function ensureSinglePdfPage(pdf, maxPages = 2) {
  const count = pdf?.internal?.getNumberOfPages?.();
  if (!Number.isInteger(count) || count < 1 || count > maxPages) {
    throw new Error(`Jumlah halaman PDF tidak valid atau melebihi ${maxPages} halaman. Ekspor dihentikan tanpa menghapus halaman atau isi laporan.`);
  }
}

export function reportPdfFailure(studentName, stage, cause) {
  if (cause?.reportPdfFailure) return cause;
  const error = new Error(`Siswa: ${studentName || "Siswa"}\nTahap: ${stage}\nPenyebab: ${cause?.message || String(cause)}`);
  error.reportPdfFailure = true;
  error.cause = cause;
  return error;
}

export function planReportCanvas(canvas) {
  const { width, height } = canvas || {};
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width <= 0 || height <= 0) {
    throw new Error("Ukuran canvas laporan tidak valid atau kosong.");
  }
  // Integer row boundaries preserve every source pixel, including the final row.
  const pageHeight = Math.ceil(width * 297 / 210);
  const pageCount = Math.ceil(height / pageHeight);
  if (pageCount > 2) {
    throw new Error(`Canvas laporan membutuhkan ${pageCount} halaman A4 (${width} × ${height} piksel), melebihi batas 2 halaman. Ekspor dihentikan; tidak ada isi yang dibuang.`);
  }
  return Array.from({ length: pageCount }, (_, index) => ({
    y: index * pageHeight,
    height: Math.min(pageHeight, height - index * pageHeight),
    pageHeight
  }));
}

// All students, including the first, use the same capture and integer-row slicing.
export async function appendReportToPdf({ page, options, pdf = null, studentName, createWorker = () => window.html2pdf() }) {
  let stage = "Validasi layout";
  try {
    await ensureReportFitsA4(page);
    if (!page.isConnected || page.offsetHeight <= 0 || (page.textContent || "").trim().length < 10) {
      throw new Error("Halaman laporan tidak terhubung, kosong, atau ukurannya tidak valid.");
    }
    stage = "Rendering canvas";
    // Manual pagination below owns all page breaks; avoid injected HTML page gaps.
    const renderOptions = { ...options, pagebreak: { mode: [] } };
    const canvas = await createWorker().set(renderOptions).from(page).toCanvas().get("canvas");
    stage = "Validasi tinggi canvas";
    const slices = planReportCanvas(canvas);
    stage = "Pagination canvas";
    const images = slices.map((slice) => {
      const target = document.createElement("canvas");
      target.width = canvas.width;
      target.height = slice.pageHeight;
      const context = target.getContext("2d");
      if (!context) throw new Error("Canvas untuk halaman PDF tidak tersedia.");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, target.width, target.height);
      context.drawImage(canvas, 0, slice.y, canvas.width, slice.height, 0, 0, canvas.width, slice.height);
      return target.toDataURL("image/jpeg", 0.98);
    });

    stage = "Penyusunan PDF";
    const previousPages = pdf ? pdf.internal.getNumberOfPages() : 0;
    if (!pdf) {
      // Obtain a new, blank jsPDF through the existing bundled html2pdf runtime.
      // Actual student content is always inserted using the same slices below.
      const blank = document.createElement("canvas");
      blank.width = blank.height = 1;
      pdf = await createWorker().set(renderOptions).from(blank).toPdf().get("pdf");
      ensureSinglePdfPage(pdf, 1);
    }
    for (let index = 0; index < images.length; index++) {
      if (previousPages + index > 0) pdf.addPage("a4", "portrait");
      pdf.addImage(images[index], "JPEG", 0, 0, 210, 297);
    }
    if (pdf.internal.getNumberOfPages() !== previousPages + images.length) {
      throw new Error("Jumlah halaman hasil tidak sesuai dengan seluruh potongan canvas. Ekspor dihentikan.");
    }
    return pdf;
  } catch (cause) {
    throw reportPdfFailure(studentName, stage, cause);
  }
}
