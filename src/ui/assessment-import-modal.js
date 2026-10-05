import { createElement } from "./form-controls.js";
import { ICONS } from "./icons.js";
import {
  validateAssessmentPackage,
  planAssessmentPackageImport,
  executeAssessmentPackageImport,
  DEDUPE_STATUS
} from "../services/assessment-package-service.js";

const PURPOSE_LABELS = {
  pretest: "Pretest / Asesmen Awal",
  formative: "Formatif / Harian",
  posttest: "Posttest",
  summative: "Sumatif Materi",
  midterm: "UTS / STS",
  final: "UAS / SAS"
};

const TYPE_LABELS = {
  written: "Tes Tertulis",
  oral: "Tes Lisan",
  practice: "Praktik",
  observation: "Observasi"
};

/**
 * Mobile-friendly assessment JSON import modal with file selection, validation,
 * deduplication analysis, preview cards, and single-step batch persistence.
 */
export function renderAssessmentImportModal({
  classRoom,
  existingDefinitions = [],
  existingSessions = [],
  onImport,
  onClose
}) {
  const modalOverlay = createElement("div", "modal-backdrop is-active");
  modalOverlay.setAttribute("role", "dialog");
  modalOverlay.setAttribute("aria-modal", "true");

  const modalContainer = createElement("div", "modal-dialog modal-dialog-lg assessment-import-dialog");

  let parsedPackage = null;
  let validationResult = null;
  let importPlan = null;
  let currentFile = null;

  function renderContent() {
    modalContainer.replaceChildren();

    // Modal Header
    const header = createElement("div", "modal-header flex items-center justify-between pb-3 border-b border-gray-200");
    const titleGroup = createElement("div");
    titleGroup.append(
      createElement("h2", "modal-title font-bold text-lg text-gray-900", "Import Asesmen"),
      createElement("p", "text-subtle text-xs mt-0.5", `Pilih file asesmen dari Korwil, sekolah, atau perangkat lain untuk ${classRoom?.name || "kelas"}.`)
    );

    const closeBtn = createElement("button", "btn-icon-close text-gray-500 hover:text-gray-800 p-1");
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", "Tutup");
    closeBtn.append(ICONS.close(20));
    closeBtn.addEventListener("click", () => {
      modalOverlay.remove();
      if (onClose) onClose();
    });

    header.append(titleGroup, closeBtn);
    modalContainer.append(header);

    // Modal Body
    const body = createElement("div", "modal-body py-4 space-y-4 max-h-[75vh] overflow-y-auto");

    if (!parsedPackage && !validationResult) {
      // Step 1: File selection
      const introBox = createElement("div", "import-upload-container text-center py-6 px-4 border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 space-y-3");
      
      const iconWrap = createElement("div", "mx-auto text-primary-600 flex justify-center");
      iconWrap.append(ICONS.book(36));

      const heading = createElement("h3", "font-semibold text-gray-800 text-base", "Pilih file asesmen PJOK");
      const desc = createElement("p", "text-xs text-gray-600 max-w-sm mx-auto", "Pilih file paket asesmen berformat JSON (.json) yang diekspor dari aplikasi PJOK.");

      const fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.accept = ".json,application/json";
      fileInput.className = "hidden";
      fileInput.style.display = "none";

      const selectBtn = createElement("button", "primary-action compact-action font-semibold cursor-pointer", "Pilih File JSON");
      selectBtn.type = "button";
      selectBtn.addEventListener("click", () => fileInput.click());

      fileInput.addEventListener("change", (e) => {
        const file = e.target.files?.[0];
        if (file) {
          handleFileSelected(file);
        }
      });

      const noteBox = createElement("div", "text-xs text-gray-500 bg-white p-3 rounded-lg border border-gray-200 mt-3 text-left space-y-1");
      noteBox.append(
        createElement("p", "font-medium text-gray-700", "Format tersedia:"),
        createElement("p", "", "• JSON (.json)"),
        createElement("p", "text-gray-400 italic text-[11px] mt-1", "Excel akan ditambahkan pada tahap berikutnya.")
      );

      introBox.append(iconWrap, heading, desc, fileInput, selectBtn, noteBox);
      body.append(introBox);

      modalContainer.append(body);
      return;
    }

    if (validationResult && !validationResult.valid) {
      // Validation error state
      const errBox = createElement("div", "import-error-box bg-red-50 border border-red-200 rounded-xl p-4 space-y-3");
      const errHeader = createElement("div", "flex items-start gap-2 text-red-800 font-semibold");
      errHeader.append(ICONS.alert(20), createElement("span", "", "Import belum dapat dilanjutkan."));

      const errList = createElement("ul", "list-disc pl-5 text-xs text-red-700 space-y-1 mt-2");
      (validationResult.errors || []).forEach((err) => {
        let prefix = "";
        if (err.assessmentIndex !== undefined && err.itemIndex !== undefined) {
          prefix = `Asesmen ${err.assessmentIndex + 1}, Butir ${err.itemIndex + 1}: `;
        } else if (err.assessmentIndex !== undefined) {
          prefix = `Asesmen ${err.assessmentIndex + 1}: `;
        }
        const li = createElement("li", "", `${prefix}${err.message}`);
        errList.append(li);
      });

      const reselectBtn = createElement("button", "btn-tool mt-2", "Pilih File Lain");
      reselectBtn.type = "button";
      reselectBtn.addEventListener("click", () => {
        parsedPackage = null;
        validationResult = null;
        importPlan = null;
        currentFile = null;
        renderContent();
      });

      errBox.append(errHeader, errList, reselectBtn);
      body.append(errBox);
      modalContainer.append(body);
      return;
    }

    // Step 2 & 3: Valid package preview
    if (parsedPackage && importPlan) {
      const pkgSource = parsedPackage.source?.name || "Asesmen PJOK";
      const totalAssessments = parsedPackage.assessments?.length || 0;

      const summaryHeader = createElement("div", "import-summary-banner bg-blue-50 border border-blue-200 rounded-xl p-3.5 flex items-center justify-between flex-wrap gap-2");
      const summaryLeft = createElement("div");
      summaryLeft.append(
        createElement("h4", "font-bold text-blue-950 text-sm", `Paket: ${pkgSource}`),
        createElement("p", "text-xs text-blue-700", `${totalAssessments} asesmen ditemukan dalam file`)
      );

      const changeFileBtn = createElement("button", "text-xs font-semibold text-blue-700 hover:text-blue-900 underline");
      changeFileBtn.type = "button";
      changeFileBtn.textContent = "Ganti File";
      changeFileBtn.addEventListener("click", () => {
        parsedPackage = null;
        validationResult = null;
        importPlan = null;
        currentFile = null;
        renderContent();
      });

      summaryHeader.append(summaryLeft, changeFileBtn);
      body.append(summaryHeader);

      const previewList = createElement("div", "import-preview-cards-list space-y-3");

      let importableCount = 0;

      importPlan.items.forEach((item) => {
        const canonical = item.assessment;
        const card = createElement("article", "import-preview-card bg-white border border-gray-200 rounded-xl p-3.5 shadow-sm space-y-2.5");

        // Status badge
        let badgeClass = "bg-gray-100 text-gray-700";
        let badgeText = "Baru";
        let isImportable = true;
        let noteText = "";

        // Check if already in class for EXACT_MATCH
        const alreadyInClass = item.classification === DEDUPE_STATUS.EXACT_MATCH &&
          (existingSessions || []).some((s) => s.classId === classRoom?.id && s.definitionId === item.existingDefinition?.id);

        if (item.classification === DEDUPE_STATUS.NEW) {
          badgeClass = "bg-green-100 text-green-800 border border-green-200";
          badgeText = "Baru";
          importableCount++;
        } else if (item.classification === DEDUPE_STATUS.NEW_VERSION) {
          badgeClass = "bg-purple-100 text-purple-800 border border-purple-200";
          badgeText = "Versi baru";
          importableCount++;
        } else if (item.classification === DEDUPE_STATUS.EXACT_MATCH) {
          if (alreadyInClass) {
            badgeClass = "bg-gray-100 text-gray-600 border border-gray-200";
            badgeText = "Sudah di kelas";
            isImportable = false;
            noteText = "Asesmen ini sudah aktif di kelas ini (dilewati).";
          } else {
            badgeClass = "bg-blue-100 text-blue-800 border border-blue-200";
            badgeText = "Sudah tersedia (Master)";
            noteText = "Definisi master akan digunakan untuk membuat sesi kelas baru.";
            importableCount++;
          }
        } else if (item.classification === DEDUPE_STATUS.CONFLICT) {
          badgeClass = "bg-amber-100 text-amber-900 border border-amber-300";
          badgeText = "Konflik";
          isImportable = false;
          noteText = "Versi yang sama sudah tersedia, tetapi isi berbeda. Import dibatalkan untuk asesmen ini.";
        }

        const topRow = createElement("div", "flex items-start justify-between gap-2");
        const titleText = createElement("h4", "font-bold text-gray-900 text-sm flex items-center gap-1.5");
        titleText.append(
          isImportable ? createElement("span", "text-green-600 font-bold", "✓") : createElement("span", "text-amber-500 font-bold", "•"),
          document.createTextNode(canonical.name || "Asesmen")
        );

        const badge = createElement("span", `text-[11px] font-semibold px-2 py-0.5 rounded-full ${badgeClass}`, badgeText);
        topRow.append(titleText, badge);

        // Metadata row
        const pLabel = PURPOSE_LABELS[canonical.purpose] || canonical.purpose || "Asesmen";
        const tLabel = TYPE_LABELS[canonical.assessmentType] || canonical.assessmentType || "Praktik";
        const metaLine = createElement("p", "text-xs text-gray-600 font-medium", `${pLabel} • ${tLabel}`);

        // Materials & items info
        const materialsStr = Array.isArray(canonical.materials) && canonical.materials.length > 0 ? canonical.materials.join(", ") : "Umum";
        const itemsCount = Array.isArray(canonical.items) ? canonical.items.length : 0;
        const scale = canonical.rubricScale || 5;
        const detailLine = createElement("p", "text-xs text-gray-500", `Materi: ${materialsStr} • ${itemsCount} butir • Skala ${scale}`);

        // Source & Version info
        const sourceLine = createElement("p", "text-[11px] text-gray-400", `Sumber: ${pkgSource} • Versi: ${canonical.sourceVersion || "1.0"}`);

        card.append(topRow, metaLine, detailLine, sourceLine);

        if (noteText) {
          const noteEl = createElement("p", `text-[11px] rounded p-1.5 ${item.classification === DEDUPE_STATUS.CONFLICT ? "bg-amber-50 text-amber-800" : "bg-gray-50 text-gray-600"}`, noteText);
          card.append(noteEl);
        }

        previewList.append(card);
      });

      body.append(previewList);
      modalContainer.append(body);

      // Modal Footer Actions
      const footer = createElement("div", "modal-footer flex items-center justify-end gap-2 pt-3 border-t border-gray-200");
      const cancelBtn = createElement("button", "btn-tool compact-action", "Batal");
      cancelBtn.type = "button";
      cancelBtn.addEventListener("click", () => {
        modalOverlay.remove();
        if (onClose) onClose();
      });

      const confirmBtn = createElement("button", "primary-action compact-action", `Import ke Kelas ${classRoom?.name || ""}`);
      confirmBtn.type = "button";
      if (importableCount === 0) {
        confirmBtn.disabled = true;
        confirmBtn.classList.add("opacity-50", "cursor-not-allowed");
      }

      confirmBtn.addEventListener("click", () => {
        const result = executeAssessmentPackageImport({
          packageData: parsedPackage,
          targetClassId: classRoom?.id,
          existingDefinitions,
          existingSessions
        });

        if (result.success && onImport) {
          onImport({
            newDefinitions: result.newDefinitions,
            newSessions: result.newSessions,
            count: result.importedCount,
            results: result.results
          });
        }
        modalOverlay.remove();
      });

      footer.append(cancelBtn, confirmBtn);
      modalContainer.append(footer);
    }
  }

  function handleFileSelected(file) {
    currentFile = file;
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const text = e.target?.result;
        const parsed = JSON.parse(text);

        const validation = validateAssessmentPackage(parsed);
        if (!validation.valid) {
          parsedPackage = null;
          validationResult = validation;
          importPlan = null;
          renderContent();
          return;
        }

        parsedPackage = parsed;
        validationResult = validation;
        importPlan = planAssessmentPackageImport(parsed, existingDefinitions);
        renderContent();
      } catch (err) {
        parsedPackage = null;
        validationResult = {
          valid: false,
          errors: [
            {
              field: "file",
              message: "File tidak dapat dibaca sebagai format JSON yang valid. Pastikan file tidak rusak."
            }
          ]
        };
        importPlan = null;
        renderContent();
      }
    };

    reader.onerror = () => {
      parsedPackage = null;
      validationResult = {
        valid: false,
        errors: [
          {
            field: "file",
            message: "Gagal membaca file dari perangkat."
          }
        ]
      };
      importPlan = null;
      renderContent();
    };

    reader.readAsText(file);
  }

  renderContent();
  modalOverlay.append(modalContainer);

  modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) {
      modalOverlay.remove();
      if (onClose) onClose();
    }
  });

  return modalOverlay;
}
