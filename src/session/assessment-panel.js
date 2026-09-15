import { ICONS } from "../ui/icons.js";

function createElement(tagName, className, textContent) {
  const element = document.createElement(tagName);
  if (className) {
    element.className = className;
  }
  if (textContent !== undefined && textContent !== null) {
    element.textContent = textContent;
  }
  return element;
}

export function renderAssessmentPanel(context) {
  const panel = createElement("section", "assessment-panel");

  if (!context.session) {
    panel.append(createElement("p", "empty-copy", "Pilih atau buat sesi untuk melakukan penilaian siswa."));
    return panel;
  }

  const session = context.session;
  const students = context.students || [];
  const definitions = context.definitions || [];
  const assessmentSessions = context.assessmentSessions || [];
  const assessmentResults = context.assessmentResults || [];
  const isReadOnly = session.status === "completed" || session.status === "cancelled";

  // Active definition selection
  let activeDefinition = definitions[0] || null;
  
  // Find or create assessment session for selected definition
  function getOrCreateAssessSess(defId) {
    if (!defId) return null;
    let found = assessmentSessions.find(
      (as) => as.sessionId === session.id && as.definitionId === defId
    );
    if (!found && !isReadOnly && context.onCreateAssessmentSession) {
      const defObj = definitions.find((d) => d.id === defId);
      if (defObj) {
        found = context.onCreateAssessmentSession({
          sessionId: session.id,
          definitionId: defObj.id,
          classId: session.classId,
          date: session.date,
          title: `Penilaian ${defObj.name}`
        });
      }
    }
    return found || null;
  }

  let activeAssessSess = activeDefinition ? getOrCreateAssessSess(activeDefinition.id) : null;

  // Header
  const header = createElement("div", "panel-header-row");
  header.append(createElement("h2", "section-title", "Penilaian Pembelajaran"));
  if (isReadOnly) {
    header.append(createElement("span", "session-status-badge status-completed", "🔒 Arsip (Hanya Baca)"));
  }
  panel.append(header);

  // Selector Bar
  const selectorCard = createElement("div", "assess-selector-card");
  const selectorLabel = createElement("label", "field");
  selectorLabel.append(createElement("span", "", "Pilih Aspek / Tes Penilaian:"));

  const defSelect = document.createElement("select");
  definitions.forEach((def) => {
    const opt = document.createElement("option");
    opt.value = def.id;
    opt.textContent = `[${def.category}] ${def.name} (${def.method === "rubric" ? "Rubrik 1-4" : def.unit || def.method})`;
    if (activeDefinition && def.id === activeDefinition.id) {
      opt.selected = true;
    }
    defSelect.append(opt);
  });

  defSelect.addEventListener("change", () => {
    const selectedDefId = defSelect.value;
    activeDefinition = definitions.find((d) => d.id === selectedDefId) || null;
    activeAssessSess = activeDefinition ? getOrCreateAssessSess(activeDefinition.id) : null;
    renderScoringArea();
  });

  selectorLabel.append(defSelect);
  selectorCard.append(selectorLabel);

  if (activeDefinition && activeDefinition.description) {
    selectorCard.append(createElement("p", "assess-desc", `ℹ️ ${activeDefinition.description}`));
  }

  panel.append(selectorCard);

  // Scoring Area Container
  const scoringContainer = createElement("div", "assess-scoring-container");
  panel.append(scoringContainer);

  function renderScoringArea() {
    scoringContainer.replaceChildren();

    if (!activeDefinition) {
      scoringContainer.append(createElement("p", "empty-copy", "Belum ada definisi penilaian tersedia."));
      return;
    }

    // Results mapping strictly isolated for the active assessment session or definition
    const currentResults = assessmentResults.filter(
      (r) =>
        (activeAssessSess && r.assessmentSessionId === activeAssessSess.id) ||
        (!activeAssessSess && r.sessionId === session.id && r.definitionId === activeDefinition.id)
    );
    const resultMap = new Map(currentResults.map((r) => [r.studentId, r]));

    // Progress counter
    const assessedCount = students.filter((s) => resultMap.has(s.id) && resultMap.get(s.id)?.value).length;
    const total = students.length;
    const pct = total > 0 ? Math.round((assessedCount / total) * 100) : 0;

    const progressCard = createElement("div", "att-stats-card");
    const progressSummary = createElement("div", "att-badges-wrap");
    progressSummary.append(
      createAssessBadge("Sudah Dinilai", assessedCount, "badge-present"),
      createAssessBadge("Belum Dinilai", total - assessedCount, "badge-unmarked"),
      createAssessBadge("Metode", activeDefinition.method === "rubric" ? "Rubrik" : activeDefinition.method === "stopwatch" ? "Stopwatch" : "Angka", "badge-late")
    );

    const progressWrap = createElement("div", "att-progress-wrap");
    const progressBar = createElement("div", "att-progress-bar");
    progressBar.style.width = `${pct}%`;
    progressWrap.append(progressBar);

    const progressLabel = createElement(
      "div",
      "att-progress-label",
      `${assessedCount} dari ${total} siswa telah dinilai (${pct}%)`
    );

    progressCard.append(progressSummary, progressWrap, progressLabel);
    scoringContainer.append(progressCard);

    // Student scoring list
    const studentList = createElement("div", "assess-student-list");

    students.forEach((student) => {
      const existingResult = resultMap.get(student.id) || null;
      const card = createElement("article", `assess-student-card ${existingResult?.value ? "is-scored" : ""}`);

      // Header row with student info and current score badge
      const headerRow = createElement("div", "assess-card-header");
      const nameCol = createElement("div", "assess-name-col");
      nameCol.append(createElement("strong", "student-name", student.name));
      nameCol.append(
        createElement(
          "span",
          "student-nis",
          student.studentNumber ? `NIS: ${student.studentNumber}` : ""
        )
      );

      const scoreBadge = createElement(
        "span",
        `assess-score-badge ${existingResult?.value ? "badge-has-score" : ""}`,
        existingResult?.formattedValue || (existingResult?.value ? `${existingResult.value} ${activeDefinition.unit || ""}` : "Belum dinilai")
      );

      headerRow.append(nameCol, scoreBadge);
      card.append(headerRow);

      // Scoring input controls based on method
      const inputSection = createElement("div", "assess-input-section");

      if (activeDefinition.method === "rubric") {
        // Rubric Level Buttons 1 - 4
        const rubricWrap = createElement("div", "rubric-buttons-wrap");
        const levels = activeDefinition.rubricLevels || [
          { level: 1, label: "Perlu Bimbingan" },
          { level: 2, label: "Cukup" },
          { level: 3, label: "Baik" },
          { level: 4, label: "Sangat Baik" }
        ];

        levels.forEach((lvl) => {
          const isSelected = existingResult?.rubricLevel === lvl.level;
          const rBtn = createElement(
            "button",
            `rubric-level-btn level-${lvl.level} ${isSelected ? "is-selected" : ""}`,
            `${lvl.level}. ${lvl.label}`
          );
          rBtn.type = "button";
          if (isReadOnly) {
            rBtn.disabled = true;
          }
          if (lvl.desc) {
            rBtn.title = lvl.desc;
          }
          rBtn.addEventListener("click", () => {
            if (isReadOnly) return;
            saveResult({
              studentId: student.id,
              value: String(lvl.level),
              numericValue: lvl.level,
              rubricLevel: lvl.level,
              formattedValue: `Skala ${lvl.level} (${lvl.label})`,
              note: existingResult?.note || ""
            });
          });
          rubricWrap.append(rBtn);
        });
        inputSection.append(rubricWrap);

      } else {
        // Numeric or Stopwatch input
        const numRow = createElement("div", "assess-num-row");
        const valInput = document.createElement("input");
        valInput.type = "number";
        valInput.step = activeDefinition.method === "stopwatch" ? "0.01" : "1";
        valInput.className = "assess-num-input";
        valInput.placeholder = `Nilai (${activeDefinition.unit || ""})`;
        if (isReadOnly) {
          valInput.disabled = true;
        }
        if (existingResult?.value !== undefined && existingResult?.value !== null) {
          valInput.value = existingResult.value;
        }

        const unitLabel = createElement("span", "assess-unit-tag", activeDefinition.unit || "");

        // Quick Save Button
        const saveBtn = createElement("button", "btn-tool btn-tool-primary", "Simpan");
        saveBtn.type = "button";
        if (isReadOnly) {
          saveBtn.disabled = true;
        }
        saveBtn.addEventListener("click", () => {
          if (isReadOnly) return;
          const val = valInput.value.trim();
          if (!val) return;
          const num = parseFloat(val);
          saveResult({
            studentId: student.id,
            value: val,
            numericValue: isNaN(num) ? null : num,
            formattedValue: `${val} ${activeDefinition.unit || ""}`.trim(),
            note: noteInput.value.trim()
          });
        });

        numRow.append(valInput, unitLabel, saveBtn);

        // If context has last captured stopwatch time, offer quick button
        if (!isReadOnly && context.lastCapturedStopwatch && activeDefinition.method === "stopwatch") {
          const pasteSwBtn = createElement("button", "btn-tool btn-tool-send");
          pasteSwBtn.type = "button";
          pasteSwBtn.append(ICONS.timer(14), document.createTextNode(` Tempel ${context.lastCapturedStopwatch}s`));
          pasteSwBtn.addEventListener("click", () => {
            valInput.value = context.lastCapturedStopwatch;
            saveBtn.click();
          });
          numRow.append(pasteSwBtn);
        }

        inputSection.append(numRow);
      }

      // Quick note input
      const noteInput = document.createElement("input");
      noteInput.type = "text";
      noteInput.className = "assess-note-input";
      noteInput.placeholder = isReadOnly ? "Catatan evaluasi" : "Catatan evaluasi guru (misal: start bagus, lentur)...";
      if (isReadOnly) {
        noteInput.disabled = true;
      }
      if (existingResult?.note) {
        noteInput.value = existingResult.note;
      }
      noteInput.addEventListener("change", () => {
        if (isReadOnly) return;
        if (existingResult) {
          saveResult({
            ...existingResult,
            note: noteInput.value.trim()
          });
        }
      });

      inputSection.append(noteInput);
      card.append(inputSection);
      studentList.append(card);
    });

    scoringContainer.append(studentList);
  }

  function saveResult(payload) {
    if (isReadOnly) return;
    if (context.onSaveAssessmentResult) {
      context.onSaveAssessmentResult({
        ...payload,
        sessionId: session.id,
        definitionId: activeDefinition?.id || "",
        assessmentSessionId: activeAssessSess?.id || "",
        recordedAt: new Date().toISOString()
      });
      renderScoringArea();
    }
  }

  renderScoringArea();
  return panel;
}

function createAssessBadge(label, count, className) {
  const badge = createElement("div", `att-badge ${className}`);
  badge.append(createElement("span", "att-badge-num", String(count)));
  badge.append(createElement("span", "att-badge-lbl", label));
  return badge;
}
