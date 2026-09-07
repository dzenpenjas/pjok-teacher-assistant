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

  const currentResults = assessmentResults.filter((r) => r.sessionId === session.id);
  const assessedCount = students.filter((s) => currentResults.some((r) => r.studentId === s.id && r.value)).length;

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
  notesTitle.append(ICONS.file(18), document.createTextNode(" Catatan & Refleksi Guru"));
  notesCard.append(notesTitle);

  const notesForm = createElement("form", "master-form");
  const notesText = document.createElement("textarea");
  notesText.rows = 3;
  notesText.placeholder = "Catatan evaluasi proses pembelajaran, kendala alat/lapangan, atau tindak lanjut pertemuan berikutnya...";
  notesText.value = session.notes || "";

  const saveNotesBtn = createElement("button", "text-button", "Simpan Catatan");
  saveNotesBtn.type = "button";
  saveNotesBtn.addEventListener("click", () => {
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
  } else {
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
      if (unmarkedCount > 0) {
        if (!window.confirm(`Masih ada ${unmarkedCount} siswa yang belum diabsen. Tetap selesaikan sesi ini?`)) {
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
