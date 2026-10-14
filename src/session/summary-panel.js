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

export function renderSummaryPanel(context) {
  const panel = createElement("section", "summary-panel");

  if (!context.session) {
    panel.append(createElement("p", "empty-copy", "Pilih atau buat sesi untuk melihat ringkasan pembelajaran."));
    return panel;
  }

  const session = context.session;
  const students = context.students || [];
  const records = context.records || [];
  const activities = context.activities || [];
  const assessmentResults = context.assessmentResults || [];

  const header = createElement("div", "panel-header-row");
  header.append(createElement("h2", "section-title", "Ringkasan & Penutupan Sesi"));
  panel.append(header);

  // 1. Session Information Overview Card
  const infoCard = createElement("div", "summary-card");
  const infoTitle = createElement("h3", "summary-card-title");
  infoTitle.append(ICONS.clipboardCheck(18), document.createTextNode(" Identitas Pembelajaran"));
  infoCard.append(infoTitle);

  const grid = createElement("div", "summary-info-grid");
  grid.append(createSummaryItem("Kelas", context.className || "-"));
  grid.append(createSummaryItem("Nomor Sesi", `Sesi ${session.sessionNumber || "-"}`));
  grid.append(createSummaryItem("Tanggal", session.date || "-"));
  grid.append(createSummaryItem("Status Saat Ini", capitalize(session.status || "planned")));
  grid.append(createSummaryItem("Topik", session.topic || "-"));
  grid.append(createSummaryItem("Materi", session.material || "-"));
  grid.append(createSummaryItem("Lokasi & Cuaca", `${session.location || "Lapangan"} (${session.weather || "Normal"})`));
  infoCard.append(grid);
  panel.append(infoCard);

  // 2. Checklist & Verification Card
  const checkCard = createElement("div", "summary-card");
  const checkTitle = createElement("h3", "summary-card-title");
  checkTitle.append(ICONS.check(18), document.createTextNode(" Checklist Kelengkapan"));
  checkCard.append(checkTitle);

  const attMap = new Map(records.map((r) => [r.studentId, r]));
  const presentCount = students.filter((s) => attMap.get(s.id)?.status === "present").length;
  const absentCount = students.filter((s) => {
    const st = attMap.get(s.id)?.status;
    return st === "late" || st === "excused" || st === "sick" || st === "absent";
  }).length;
  const unmarkedCount = students.length - (presentCount + absentCount);

  const actTotal = activities.length;
  const actCompleted = activities.filter((a) => a.status === "completed").length;

  const assessmentSessionsMap = new Map((context.assessmentSessions || []).map(s => [s.id, s]));
  const assessedStudentsSet = new Set();
  
  assessmentResults.forEach((r) => {
    // Only count if it belongs to this class/students list
    if (!students.some(s => s.id === r.studentId)) return;

    let parentSessionId = r.sessionId;
    
    // Resolve parent session from linked assessment session if needed
    if (!parentSessionId && r.assessmentSessionId) {
      const assessmentSession = assessmentSessionsMap.get(r.assessmentSessionId);
      if (assessmentSession) {
        parentSessionId = assessmentSession.sessionId;
      }
    }

    // Only count if it belongs to current session and has a valid result
    if (parentSessionId === session.id) {
      const isNumeric = (val) => typeof val === 'number' && !isNaN(val);
      
      // Strict validation for itemResults: must be array and contain at least one valid numeric rubricLevel
      const hasValidItemResult = Array.isArray(r.itemResults) && 
                                 r.itemResults.some(ir => {
                                   const val = ir.rubricLevel;
                                   const isStringValid = typeof val === 'string' && val.trim() !== '';
                                   const isNumberValid = typeof val === 'number';
                                   
                                   if (val === null || val === undefined || (typeof val === 'string' && val.trim() === '')) return false;
                                   
                                   const num = Number(val);
                                   return Number.isFinite(num);
                                 });
      
      const hasValue = (r.value !== undefined && r.value !== null && r.value !== "") ||
                       isNumeric(r.rubricLevel) ||
                       isNumeric(r.numericScore) ||
                       isNumeric(r.averageRubricScore) ||
                       hasValidItemResult;
      
      if (hasValue) {
        assessedStudentsSet.add(r.studentId);
      }
    }
  });

  const assessedCount = assessedStudentsSet.size;

  const list = createElement("div", "summary-checklist");

  // Attendance check
  const attCheck = createElement("div", `check-item ${unmarkedCount === 0 ? "is-ok" : "is-warn"}`);
  attCheck.append(
    unmarkedCount === 0 ? ICONS.check(16) : ICONS.alert(16),
    createElement(
      "div",
      "check-text",
      `Absensi Siswa: ${presentCount + absentCount}/${students.length} diabsen (${presentCount} hadir, ${absentCount} tidak hadir, ${unmarkedCount} belum).`
    )
  );
  list.append(attCheck);

  // Activity check
  const actCheck = createElement("div", `check-item ${actCompleted >= actTotal && actTotal > 0 ? "is-ok" : "is-warn"}`);
  actCheck.append(
    actCompleted >= actTotal && actTotal > 0 ? ICONS.check(16) : ICONS.timer(16),
    createElement(
      "div",
      "check-text",
      `Alur Aktivitas: ${actCompleted} dari ${actTotal} tahap diselesaikan.`
    )
  );
  list.append(actCheck);

  // Assessment check
  const assessCheck = createElement("div", `check-item ${assessedCount > 0 ? "is-ok" : "is-warn"}`);
  assessCheck.append(
    assessedCount > 0 ? ICONS.check(16) : ICONS.target(16),
    createElement(
      "div",
      "check-text",
      `Penilaian Siswa: ${assessedCount} dari ${students.length} siswa memiliki catatan nilai.`
    )
  );
  list.append(assessCheck);

  checkCard.append(list);
  panel.append(checkCard);

  // 3. Teacher Reflection & Notes
  const notesCard = createElement("div", "summary-card");
  const notesTitle = createElement("h3", "summary-card-title");
  notesTitle.append(ICONS.book(18), document.createTextNode(" Catatan & Refleksi Guru"));
  notesCard.append(notesTitle);

  const isReadOnly = session.status === "completed" || session.status === "cancelled";
  const notesForm = createElement("form", "master-form");
  const notesText = document.createElement("textarea");
  notesText.rows = 3;
  notesText.placeholder = isReadOnly ? "Tidak ada catatan." : "Catatan evaluasi proses pembelajaran, kendala alat/lapangan, atau tindak lanjut pertemuan berikutnya...";
  notesText.value = session.notes || "";
  if (isReadOnly) {
    notesText.disabled = true;
  }

  const saveNotesBtn = createElement("button", "text-button", "Simpan Catatan");
  saveNotesBtn.type = "button";
  if (isReadOnly) {
    saveNotesBtn.disabled = true;
    saveNotesBtn.style.display = "none";
  }
  saveNotesBtn.addEventListener("click", () => {
    if (isReadOnly) return;
    if (context.onUpdateSessionNotes) {
      context.onUpdateSessionNotes(session.id, notesText.value.trim());
    }
  });

  notesForm.append(notesText, saveNotesBtn);
  notesCard.append(notesForm);
  panel.append(notesCard);

  // 4. Session Finalization Controls
  const finalCard = createElement("div", "summary-card final-action-card");
  const finalTitle = createElement("h3", "summary-card-title");
  finalTitle.append(ICONS.check(18), document.createTextNode(" Selesaikan Sesi"));
  finalCard.append(finalTitle);

  if (session.status === "completed") {
    finalCard.append(
      createElement("p", "summary-done-copy", "✓ Sesi ini telah diselesaikan dan diarsipkan.")
    );
  } else if (session.status === "active") {
    finalCard.append(
      createElement(
        "p",
        "screen-copy",
        "Pastikan absensi dan catatan penting sudah terisi sebelum menyelesaikan sesi mengajar."
      )
    );

    const actionRow = createElement("div", "session-actions");

    const finishBtn = createElement("button", "primary-action");
    finishBtn.type = "button";
    finishBtn.append(ICONS.check(18), document.createTextNode(" Selesaikan & Simpan Pembelajaran"));
    finishBtn.addEventListener("click", () => {
      const warnings = [];
      if (unmarkedCount > 0) warnings.push(`${unmarkedCount} siswa belum diabsen`);
      if (actTotal === 0) {
        warnings.push("Belum ada aktivitas yang dicatat");
      } else if (actTotal - actCompleted > 0) {
        warnings.push(`${actTotal - actCompleted} aktivitas belum selesai`);
      }
      if (students.length - assessedCount > 0) warnings.push(`${students.length - assessedCount} siswa belum dinilai`);

      if (warnings.length > 0) {
        if (!window.confirm(`Peringatan: ${warnings.join(", ")}. Tetap selesaikan sesi ini?`)) {
          return;
        }
      } else {
        if (!window.confirm("Selesaikan sesi pembelajaran ini sekarang?")) {
          return;
        }
      }

      if (context.onFinishSession) {
        context.onFinishSession(session.id);
      }
    });

    const pauseBtn = createElement("button", "text-button");
    pauseBtn.type = "button";
    pauseBtn.append(ICONS.pause(16), document.createTextNode(" Jeda Sesi (Pause)"));
    pauseBtn.addEventListener("click", () => {
      if (context.onPauseSession) {
        context.onPauseSession(session.id);
      }
    });

    actionRow.append(finishBtn, pauseBtn);
    finalCard.append(actionRow);
  } else if (session.status === "planned") {
    finalCard.append(
      createElement("p", "screen-copy", "Sesi ini berstatus Rencana. Gunakan tombol Mulai Mengajar pada toolbar di atas untuk memulai sesi.")
    );
  } else if (session.status === "paused") {
    finalCard.append(
      createElement("p", "screen-copy", "Sesi sedang dijeda. Gunakan tombol Lanjutkan Sesi di atas untuk meneruskan.")
    );
  } else if (session.status === "cancelled") {
    finalCard.append(
      createElement("p", "summary-done-copy", "Sesi ini telah dibatalkan.")
    );
  }

  panel.append(finalCard);
  return panel;
}

function createSummaryItem(label, value) {
  const item = createElement("div", "summary-info-item");
  item.append(createElement("span", "summary-info-label", label));
  item.append(createElement("strong", "summary-info-value", value));
  return item;
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
