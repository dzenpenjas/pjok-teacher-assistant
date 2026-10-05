import { ICONS } from "./icons.js";
import {
  validateAssessmentPackage,
  planAssessmentPackageImport,
  executeAssessmentPackageImport,
  DEDUPE_STATUS
} from "../services/assessment-package-service.js";

function createElement(tagName, className, textContent) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  if (textContent !== undefined && textContent !== null) {
    element.textContent = textContent;
  }
  return element;
}

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

  const modalContainer = createElement("div", "assessment-import-dialog");

  let parsedPackage = null;
  let validationResult = null;
  let importPlan = null;
  let currentFile = null;

  function renderContent() {
    modalContainer.replaceChildren();

    // Modal Header
    const header = createElement("div", "assessment-import-header");
    const titleGroup = createElement("div");
    titleGroup.append(
      createElement("h2", "assessment-import-title", "Import Asesmen"),
      createElement("p", "assessment-import-sub", `Pilih file asesmen dari Korwil, sekolah, atau perangkat lain untuk ${classRoom?.name || "kelas"}.`)
    );

    const closeBtn = createElement("button", "assessment-import-close-btn");
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
    const body = createElement("div", "assessment-import-body");

    if (!parsedPackage && !validationResult) {
      // Step 1: File selection
      const introBox = createElement("div", "assessment-import-upload");
      
      const iconWrap = createElement("div", "assessment-import-upload-icon");
      iconWrap.append(ICONS.book(36));

      const heading = createElement("h3", "assessment-import-upload-title", "Pilih file asesmen PJOK");
      const desc = createElement("p", "assessment-import-upload-desc", "Pilih file paket asesmen berformat JSON (.json) yang diekspor dari aplikasi PJOK.");

      const fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.accept = ".json,application/json";
      fileInput.style.display = "none";

      const selectBtn = createElement("button", "primary-action compact-action assessment-import-select-btn", "Pilih File JSON");
      selectBtn.type = "button";
      selectBtn.addEventListener("click", () => fileInput.click());

      fileInput.addEventListener("change", (e) => {
        const file = e.target.files?.[0];
        if (file) {
          handleFileSelected(file);
        }
      });

      const noteBox = createElement("div", "assessment-import-format-note");
      noteBox.append(
        createElement("strong", "", "Format tersedia:"),
        document.createTextNode("• JSON (.json)"),
        createElement("em", "", "Excel akan ditambahkan pada tahap berikutnya.")
      );

      introBox.append(iconWrap, heading, desc, fileInput, selectBtn, noteBox);
      body.append(introBox);

      modalContainer.append(body);
      return;
    }

    if (validationResult && !validationResult.valid) {
      // Validation error state
      const errBox = createElement("div", "assessment-import-error");
      const errHeader = createElement("div", "assessment-import-error-title");
      errHeader.append(ICONS.alert(20), createElement("span", "", "Import belum dapat dilanjutkan."));

      const errList = createElement("ul", "assessment-import-error-list");
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

      const reselectBtn = createElement("button", "btn-tool compact-action", "Pilih File Lain");
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

      const summaryHeader = createElement("div", "assessment-import-summary");
      const summaryLeft = createElement("div");
      summaryLeft.append(
        createElement("h4", "assessment-import-summary-title", `Paket: ${pkgSource}`),
        createElement("p", "assessment-import-summary-sub", `${totalAssessments} asesmen ditemukan dalam file`)
      );

      const changeFileBtn = createElement("button", "assessment-import-change-file-btn");
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

      const previewList = createElement("div", "assessment-import-preview-list");

      let importableCount = 0;

      importPlan.items.forEach((item) => {
        const canonical = item.assessment;
        const card = createElement("article", "assessment-import-preview-card");

        // Status badge
        let badgeModifier = "badge-new";
        let badgeText = "Baru";
        let isImportable = true;
        let noteText = "";

        // Check if already in class for EXACT_MATCH
        const alreadyInClass = item.classification === DEDUPE_STATUS.EXACT_MATCH &&
          (existingSessions || []).some((s) => s.classId === classRoom?.id && s.definitionId === item.existingDefinition?.id);

        if (item.classification === DEDUPE_STATUS.NEW) {
          badgeModifier = "badge-new";
          badgeText = "Baru";
          importableCount++;
        } else if (item.classification === DEDUPE_STATUS.NEW_VERSION) {
          badgeModifier = "badge-new-version";
          badgeText = "Versi baru";
          importableCount++;
        } else if (item.classification === DEDUPE_STATUS.EXACT_MATCH) {
          if (alreadyInClass) {
            badgeModifier = "badge-active";
            badgeText = "Sudah di kelas";
            isImportable = false;
            noteText = "Asesmen ini sudah aktif di kelas ini (dilewati).";
          } else {
            badgeModifier = "badge-master";
            badgeText = "Sudah tersedia (Master)";
            noteText = "Definisi master akan digunakan untuk membuat sesi kelas baru.";
            importableCount++;
          }
        } else if (item.classification === DEDUPE_STATUS.CONFLICT) {
          badgeModifier = "badge-conflict";
          badgeText = "Konflik";
          isImportable = false;
          noteText = "Versi yang sama sudah tersedia, tetapi isi berbeda. Import dibatalkan untuk asesmen ini.";
        }

        const topRow = createElement("div", "assessment-import-card-header");
        const titleText = createElement("h4", "assessment-import-card-title");
        titleText.append(
          isImportable ? createElement("span", "text-success font-bold", "✓") : createElement("span", "text-warning font-bold", "•"),
          document.createTextNode(canonical.name || "Asesmen")
        );

        const badge = createElement("span", `assessment-import-badge ${badgeModifier}`, badgeText);
        topRow.append(titleText, badge);

        // Metadata row
        const pLabel = PURPOSE_LABELS[canonical.purpose] || canonical.purpose || "Asesmen";
        const tLabel = TYPE_LABELS[canonical.assessmentType] || canonical.assessmentType || "Praktik";
        const metaLine = createElement("p", "assessment-import-card-meta", `${pLabel} • ${tLabel}`);

        // Materials & items info
        const materialsStr = Array.isArray(canonical.materials) && canonical.materials.length > 0 ? canonical.materials.join(", ") : "Umum";
        const itemsCount = Array.isArray(canonical.items) ? canonical.items.length : 0;
        const scale = canonical.rubricScale || 5;
        const detailLine = createElement("p", "assessment-import-card-detail", `Materi: ${materialsStr} • ${itemsCount} butir • Skala ${scale}`);

        // Source & Version info
        const sourceLine = createElement("p", "assessment-import-card-source", `Sumber: ${pkgSource} • Versi: ${canonical.sourceVersion || "1.0"}`);

        card.append(topRow, metaLine, detailLine, sourceLine);

        if (noteText) {
          const noteEl = createElement("p", `assessment-import-card-note ${item.classification === DEDUPE_STATUS.CONFLICT ? "note-conflict" : ""}`, noteText);
          card.append(noteEl);
        }

        previewList.append(card);
      });

      body.append(previewList);
      modalContainer.append(body);

      // Modal Footer Actions
      const footer = createElement("div", "assessment-import-footer");
      const cancelBtn = createElement("button", "btn-tool compact-action assessment-import-btn-cancel", "Batal");
      cancelBtn.type = "button";
      cancelBtn.addEventListener("click", () => {
        modalOverlay.remove();
        if (onClose) onClose();
      });

      const confirmBtn = createElement("button", "primary-action compact-action assessment-import-btn-confirm", `Import ke Kelas ${classRoom?.name || ""}`);
      confirmBtn.type = "button";
      if (importableCount === 0) {
        confirmBtn.disabled = true;
        confirmBtn.style.opacity = "0.5";
        confirmBtn.style.cursor = "not-allowed";
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
