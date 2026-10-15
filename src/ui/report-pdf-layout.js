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
  const pageCount = typeof pdf?.internal?.getNumberOfPages === "function"
    ? pdf.internal.getNumberOfPages()
    : 1;
  if (pageCount < 1 || pageCount > maxPages) {
    throw new Error(`PDF menghasilkan lebih dari ${maxPages} halaman. Ekspor dihentikan tanpa menghapus halaman atau isi laporan. Ringkas isi laporan lalu coba lagi.`);
  }
}
