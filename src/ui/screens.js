import { SCREENS } from "../data/schema.js";
import { renderMasterDataScreen } from "./master-data-screen.js";
import { renderSessionScreen } from "../session/session-screen.js";

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

function createStat(label, value) {
  const item = createElement("div", "stat-item");
  item.append(createElement("strong", "", value));
  item.append(createElement("span", "", label));
  return item;
}

function renderDashboard(state, actions) {
  const screen = createElement("main", "screen wide-screen");
  
  // Date banner
  const todayFormatted = new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(new Date());

  const banner = createElement("header", "dash-welcome-banner");
  banner.append(createElement("p", "eyebrow", `📅 ${todayFormatted}`));
  banner.append(createElement("h1", "screen-title", "PJOK Teacher Assistant"));
  banner.append(
    createElement(
      "p",
      "screen-copy",
      "Kelola pembelajaran lapangan, absensi cepat, timer stopwatch, dan penilaian langsung dari genggaman."
    )
  );
  screen.append(banner);

  // 1. ACTIVE OR CANDIDATE TEACHING SESSION CARD
  const activeSession = state.session || null;
  const activeClass = activeSession
    ? (state.classes || []).find((c) => c.id === activeSession.classId)
    : null;

  const sessionCard = createElement("section", "dash-highlight-card");

  if (activeSession && (activeSession.status === "active" || activeSession.status === "paused" || activeSession.status === "planned")) {
    const cardTop = createElement("div", "dash-card-header");
    const titleGroup = createElement("div");
    
    const statusPill = createElement(
      "span",
      `session-status-badge status-${activeSession.status}`,
      activeSession.status === "active" ? "🟢 Sedang Mengajar" : activeSession.status === "paused" ? "⏸ Dijeda" : "📅 Rencana Sesi"
    );
    const sessionHeading = createElement(
      "h2",
      "dash-session-title",
      `${activeClass?.name || "Kelas PJOK"} - Sesi ${activeSession.sessionNumber || "1"}: ${activeSession.topic || "Materi Lapangan"}`
    );
    const sessionSub = createElement(
      "p",
      "dash-session-meta",
      `Lokasi: ${activeSession.location || "Lapangan"} • Cuaca: ${activeSession.weather || "Cerah"} • Jam: ${activeSession.startTime || "07:30"}`
    );

    titleGroup.append(statusPill, sessionHeading, sessionSub);
    cardTop.append(titleGroup);
    sessionCard.append(cardTop);

    // Quick stats for this session
    const sessionRecords = (state.attendanceRecords || []).filter((r) => r.sessionId === activeSession.id);
    const presentCount = sessionRecords.filter((r) => r.status === "present").length;
    const sessionStudents = (state.students || []).filter((s) => s.classId === activeSession.classId);
    
    const sessStatsRow = createElement("div", "dash-session-stats");
    sessStatsRow.append(
      createMiniStat("Absensi Siswa", `${presentCount}/${sessionStudents.length} Hadir`),
      createMiniStat("Aktivitas", `${(state.sessionActivities || []).filter((a) => a.sessionId === activeSession.id && a.status === "completed").length} Tahap Selesai`),
      createMiniStat("Penilaian", `${(state.assessmentResults || []).filter((r) => r.sessionId === activeSession.id).length} Catatan Nilai`)
    );
    sessionCard.append(sessStatsRow);

    // Action button to enter session workspace
    const openBtn = createElement("button", "primary-action", "▶ Masuk ke Workspace Mengajar");
    openBtn.type = "button";
    openBtn.addEventListener("click", () => actions.navigate(SCREENS.session));
    sessionCard.append(openBtn);

  } else {
    // No active session: Quick launcher to start a new teaching session
    sessionCard.append(createElement("h2", "dash-session-title", "🏃 Mulai Sesi Mengajar Hari Ini"));
    sessionCard.append(
      createElement(
        "p",
        "screen-copy",
        "Pilih kelas untuk langsung membuka lembar absensi, stopwatch, dan penilaian materi."
      )
    );

    const classButtons = createElement("div", "dash-quick-class-grid");
    (state.classes || []).forEach((c) => {
      const cBtn = createElement("button", "btn-quick-class", `+ Kelas ${c.name}`);
      cBtn.type = "button";
      cBtn.addEventListener("click", () => {
        if (actions.quickStartClassSession) {
          actions.quickStartClassSession(c.id);
        } else {
          actions.navigate(SCREENS.session);
        }
      });
      classButtons.append(cBtn);
    });

    if ((state.classes || []).length === 0) {
      classButtons.append(
        createElement("p", "empty-copy", "Belum ada data kelas. Tambahkan kelas di Master Data terlebih dahulu.")
      );
    }

    sessionCard.append(classButtons);
  }

  screen.append(sessionCard);

  // 2. STUDENT ATTENTION / HEALTH RADAR
  const attentionSection = createElement("section", "dash-section-card");
  attentionSection.append(createElement("h3", "dash-section-title", "⚠️ Radar Perhatian & Kesehatan Siswa"));
  attentionSection.append(
    createElement(
      "p",
      "dash-section-desc",
      "Siswa dengan catatan khusus atau riwayat kesehatan (asma, cedera, alergi) yang perlu diperhatikan di lapangan."
    )
  );

  const tags = state.studentTags || [];
  const healthTagIds = new Set(
    tags
      .filter((t) => {
        const n = (t.name || "").toLowerCase();
        return n.includes("asma") || n.includes("cedera") || n.includes("perhatian") || n.includes("sakit") || n.includes("khusus");
      })
      .map((t) => t.id)
  );

  const flaggedStudents = (state.students || []).filter((s) => {
    const hasHealthTag = Array.isArray(s.tagIds) && s.tagIds.some((id) => healthTagIds.has(id));
    return hasHealthTag || (s.noteIds && s.noteIds.length > 0);
  });

  const radarList = createElement("div", "dash-radar-list");

  if (flaggedStudents.length === 0) {
    radarList.append(createElement("p", "empty-copy", "Semua siswa dalam status siap beraktivitas normal."));
  } else {
    flaggedStudents.slice(0, 6).forEach((st) => {
      const cl = (state.classes || []).find((c) => c.id === st.classId);
      const row = createElement("div", "radar-item clickable-card");
      row.title = "Klik untuk lihat profil & perkembangan siswa";

      const left = createElement("div", "radar-item-left");
      left.append(createElement("strong", "radar-student-name", st.name));
      left.append(createElement("span", "radar-student-sub", cl?.name || "Kelas"));

      const tagPills = createElement("div", "student-tags-inline");
      if (Array.isArray(st.tagIds)) {
        st.tagIds.forEach((tId) => {
          const tObj = tags.find((t) => t.id === tId);
          if (tObj) {
            const pill = createElement("span", "mini-tag", tObj.name);
            tagPills.append(pill);
          }
        });
      }

      row.append(left, tagPills);
      row.addEventListener("click", () => {
        if (actions.openStudentDetail) {
          actions.openStudentDetail(st.id);
        }
      });
      radarList.append(row);
    });
  }

  attentionSection.append(radarList);
  screen.append(attentionSection);

  // 3. OVERALL TEACHING STATS
  const stats = createElement("section", "stats-grid");
  stats.setAttribute("aria-label", "Ringkasan data");
  stats.append(createStat("Kelas", String((state.classes || []).length)));
  stats.append(createStat("Siswa", String((state.students || []).length)));
  stats.append(createStat("Total Sesi", String((state.sessions || []).length)));
  stats.append(createStat("Definisi Tes", String((state.assessmentDefinitions || []).length)));
  screen.append(stats);

  // 4. QUICK LINKS
  const quickLinks = createElement("div", "dash-quick-links");
  const masterBtn = createElement("button", "text-button", "⚙️ Master Data & Penilaian");
  masterBtn.type = "button";
  masterBtn.addEventListener("click", () => actions.navigate(SCREENS.masterData));

  const backupBtn = createElement("button", "text-button", "💾 Cadangan & Pengaturan");
  backupBtn.type = "button";
  backupBtn.addEventListener("click", () => actions.navigate(SCREENS.settings));

  quickLinks.append(masterBtn, backupBtn);
  screen.append(quickLinks);

  return screen;
}

function createMiniStat(label, value) {
  const box = createElement("div", "dash-mini-stat");
  box.append(createElement("strong", "dash-mini-val", value));
  box.append(createElement("span", "dash-mini-lbl", label));
  return box;
}

function renderSettings(state, actions) {
  const screen = createElement("main", "screen");
  screen.append(createElement("p", "eyebrow", "Data Lokal"));
  screen.append(createElement("h1", "screen-title", "Data tersimpan otomatis."));

  const updatedAt = state.updatedAt
    ? new Intl.DateTimeFormat("id-ID", {
        dateStyle: "medium",
        timeStyle: "short"
      }).format(new Date(state.updatedAt))
    : "Belum ada";

  screen.append(createElement("p", "screen-copy", `Pembaruan terakhir: ${updatedAt}.`));
  screen.append(
    createElement(
      "p",
      "screen-copy",
      "Gunakan export untuk mencadangkan data dan import untuk memulihkan data dari file JSON."
    )
  );

  const actionsRow = createElement("div", "data-actions");
  const exportButton = createElement("button", "primary-action compact-action", "Export Data");
  exportButton.type = "button";
  exportButton.addEventListener("click", actions.exportData);

  const importLabel = createElement("label", "import-action", "Import Data");
  const importInput = document.createElement("input");
  importInput.type = "file";
  importInput.accept = "application/json,.json";
  importInput.addEventListener("change", (event) => {
    const [file] = event.target.files;
    if (file) {
      actions.importData(file);
    }
    event.target.value = "";
  });
  importLabel.append(importInput);
  actionsRow.append(exportButton, importLabel);
  screen.append(actionsRow);
  return screen;
}

export function renderScreen(screenIdOrState, stateOrActions, maybeActions) {
  let screenId;
  let state;
  let actions;

  if (typeof screenIdOrState === "string") {
    screenId = screenIdOrState;
    state = stateOrActions;
    actions = maybeActions;
  } else {
    state = screenIdOrState;
    actions = stateOrActions;
    screenId = state?.currentScreen || SCREENS.dashboard;
  }

  if (screenId === SCREENS.masterData) {
    return renderMasterDataScreen(state, actions);
  }

  if (screenId === SCREENS.session) {
    const currentSession = state.session || null;
    const sessionStudents = currentSession
      ? (state.students || []).filter((s) => s.classId === currentSession.classId)
      : [];

    return renderSessionScreen(currentSession, {
      actions,
      className: currentSession
        ? (state.classes || []).find((item) => item.id === currentSession.classId)?.name || ""
        : "",
      students: sessionStudents,
      attendanceRecords: currentSession
        ? (state.attendanceRecords || []).filter((r) => r.sessionId === currentSession.id)
        : [],
      studentTags: state.studentTags || [],
      sessionActivities: currentSession
        ? (state.sessionActivities || []).filter((a) => a.sessionId === currentSession.id)
        : [],
      assessmentDefinitions: state.assessmentDefinitions || [],
      assessmentSessions: state.assessmentSessions || [],
      assessmentResults: currentSession
        ? (state.assessmentResults || []).filter((r) => r.sessionId === currentSession.id)
        : [],
      growthRecords: state.growthRecords || [],
      observations: state.studentObservations || [],
      allSessions: state.sessions || [],
      classOptions: state.classes || [],
      teacherOptions: state.teachers || [],
      academicYearOptions: state.academicYears || [],
      semesterOptions: state.semesters || []
    });
  }

  if (screenId === SCREENS.settings) {
    return renderSettings(state, actions);
  }

  return renderDashboard(state, actions);
}
