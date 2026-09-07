import { SCREENS } from "../data/schema.js";
import { ICONS } from "./icons.js";
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

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 11) return "Selamat Pagi";
  if (hour < 15) return "Selamat Siang";
  if (hour < 18) return "Selamat Sore";
  return "Selamat Malam";
}

function createStat(label, value, iconFn) {
  const item = createElement("div", "stat-item");
  if (iconFn) {
    item.append(iconFn());
  }
  item.append(createElement("strong", "", value));
  item.append(createElement("span", "", label));
  return item;
}

function renderDashboard(state, actions = (typeof window !== "undefined" && window.actions) || {}) {
  const screen = createElement("main", "screen wide-screen");
  
  // 1. Contextual Header with Date & Greeting
  const todayFormatted = new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(new Date());

  const banner = createElement("header", "dash-welcome-banner");
  const eyebrow = createElement("p", "eyebrow");
  eyebrow.append(ICONS.calendar(15), document.createTextNode(` ${todayFormatted}`));
  banner.append(eyebrow);

  const school = (state.schools || [])[0];
  const teacher = (state.teachers || [])[0];
  const greetingText = `${getGreeting()}${teacher?.name ? `, ${teacher.name}` : ", Guru PJOK"}`;

  banner.append(createElement("h1", "screen-title", greetingText));
  banner.append(
    createElement(
      "p",
      "screen-copy",
      school?.name ? `${school.name} • Workspace Pembelajaran PJOK Lapangan` : "Kelola pembelajaran lapangan, absensi cepat, timer stopwatch, dan penilaian langsung dari genggaman."
    )
  );
  screen.append(banner);

  // 2. ACTIVE OR CANDIDATE TEACHING SESSION CARD
  const activeSession = state.session || null;
  const activeClass = activeSession
    ? (state.classes || []).find((c) => c.id === activeSession.classId)
    : null;

  const sessionCard = createElement("section", "dash-highlight-card");

  if (activeSession && (activeSession.status === "active" || activeSession.status === "paused" || activeSession.status === "planned")) {
    const cardTop = createElement("div", "dash-card-header");
    const titleGroup = createElement("div");
    
    let statusText = "Rencana Sesi";
    if (activeSession.status === "active") statusText = "Sedang Mengajar";
    if (activeSession.status === "paused") statusText = "Sesi Dijeda";

    const statusPill = createElement(
      "span",
      `session-status-badge status-${activeSession.status}`,
      `● ${statusText}`
    );
    const sessionHeading = createElement(
      "h2",
      "dash-session-title",
      `${activeClass?.name || "Kelas PJOK"} - Sesi ${activeSession.sessionNumber || "1"}: ${activeSession.topic || "Materi Lapangan"}`
    );
    const sessionSub = createElement(
      "p",
      "dash-session-meta",
      `📍 ${activeSession.location || "Lapangan"} • ☀️ ${activeSession.weather || "Cerah"} • ⏰ ${activeSession.startTime || "07:30"}`
    );

    titleGroup.append(statusPill, sessionHeading, sessionSub);
    cardTop.append(titleGroup);
    sessionCard.append(cardTop);

    // Live progress stats for this session
    const sessionRecords = (state.attendanceRecords || []).filter((r) => r.sessionId === activeSession.id);
    const presentCount = sessionRecords.filter((r) => r.status === "present").length;
    const sessionStudents = (state.students || []).filter((s) => s.classId === activeSession.classId);
    
    const sessStatsRow = createElement("div", "dash-session-stats");
    sessStatsRow.append(
      createMiniStat("Absensi Siswa", `${presentCount}/${sessionStudents.length} Hadir`),
      createMiniStat("Aktivitas", `${(state.sessionActivities || []).filter((a) => a.sessionId === activeSession.id && a.status === "completed").length} Selesai`),
      createMiniStat("Penilaian", `${(state.assessmentResults || []).filter((r) => r.sessionId === activeSession.id).length} Catatan`)
    );
    sessionCard.append(sessStatsRow);

    // Primary CTA to enter session workspace
    const openBtn = createElement("button", "primary-action");
    openBtn.type = "button";
    openBtn.append(ICONS.whistle(18), document.createTextNode(" Masuk ke Sesi Mengajar"));
    openBtn.addEventListener("click", () => {
      if (actions?.navigate) {
        actions.navigate(SCREENS.session);
      }
    });
    sessionCard.append(openBtn);

  } else {
    // No active session: Quick launcher to start a new teaching session
    const emptyTitle = createElement("h2", "dash-session-title");
    emptyTitle.append(ICONS.whistle(20), document.createTextNode(" Mulai Sesi Mengajar Hari Ini"));
    sessionCard.append(emptyTitle);
    sessionCard.append(
      createElement(
        "p",
        "screen-copy",
        "Pilih kelas untuk langsung membuka lembar absensi, stopwatch, dan penilaian materi lapangan:"
      )
    );

    const classButtons = createElement("div", "dash-quick-class-grid");
    (state.classes || []).forEach((c) => {
      const cBtn = createElement("button", "btn-quick-class");
      cBtn.type = "button";
      cBtn.append(ICONS.plus(16), document.createTextNode(` Kelas ${c.name}`));
      cBtn.addEventListener("click", () => {
        if (actions?.quickStartClassSession) {
          actions.quickStartClassSession(c.id);
        } else if (actions?.navigate) {
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

  // 3. STUDENT ATTENTION / HEALTH RADAR
  const attentionSection = createElement("section", "dash-section-card");
  const radarTitle = createElement("h3", "dash-section-title");
  radarTitle.append(ICONS.alert(18), document.createTextNode(" Radar Perhatian & Kesehatan Siswa"));
  attentionSection.append(radarTitle);
  attentionSection.append(
    createElement(
      "p",
      "dash-section-desc",
      "Siswa dengan catatan khusus atau riwayat kesehatan (asma, cedera, alergi) yang perlu dipantau saat praktik lapangan."
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
    radarList.append(createElement("p", "empty-copy", "Semua siswa dalam status siap beraktivitas normal di lapangan."));
  } else {
    flaggedStudents.slice(0, 6).forEach((st) => {
      const cl = (state.classes || []).find((c) => c.id === st.classId);
      const row = createElement("div", "radar-item");
      row.title = "Buka profil & riwayat siswa";

      const left = createElement("div", "radar-item-left");
      left.append(createElement("strong", "radar-student-name", st.name));
      left.append(createElement("span", "radar-student-sub", cl?.name ? `Kelas ${cl.name}` : "Siswa PJOK"));

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
        if (actions?.openStudentDetail) {
          actions.openStudentDetail(st.id);
        }
      });
      radarList.append(row);
    });
  }

  attentionSection.append(radarList);
  screen.append(attentionSection);

  // 4. OVERALL DATA STATS
  const stats = createElement("section", "stats-grid");
  stats.setAttribute("aria-label", "Ringkasan data");
  stats.append(createStat("Kelas", String((state.classes || []).length)));
  stats.append(createStat("Siswa", String((state.students || []).length)));
  stats.append(createStat("Total Sesi", String((state.sessions || []).length)));
  stats.append(createStat("Definisi Tes", String((state.assessmentDefinitions || []).length)));
  screen.append(stats);

  // 5. QUICK ACTIONS
  const quickLinks = createElement("div", "dash-quick-links");
  const masterBtn = createElement("button", "text-button");
  masterBtn.type = "button";
  masterBtn.append(ICONS.users(18), document.createTextNode(" Master Data"));
  masterBtn.addEventListener("click", () => {
    if (actions?.navigate) {
      actions.navigate(SCREENS.masterData);
    }
  });

  const backupBtn = createElement("button", "text-button");
  backupBtn.type = "button";
  backupBtn.append(ICONS.settings(18), document.createTextNode(" Cadangan & Pengaturan"));
  backupBtn.addEventListener("click", () => {
    if (actions?.navigate) {
      actions.navigate(SCREENS.settings);
    }
  });

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

function renderSettings(state, actions = (typeof window !== "undefined" && window.actions) || {}) {
  const screen = createElement("main", "screen");
  const eyebrow = createElement("p", "eyebrow");
  eyebrow.append(ICONS.database(15), document.createTextNode(" Data Lokal & Cadangan"));
  screen.append(eyebrow);
  screen.append(createElement("h1", "screen-title", "Pengaturan & Data"));

  const updatedAt = state.updatedAt
    ? new Intl.DateTimeFormat("id-ID", {
        dateStyle: "medium",
        timeStyle: "short"
      }).format(new Date(state.updatedAt))
    : "Belum ada";

  screen.append(createElement("p", "screen-copy", `Pembaruan terakhir: ${updatedAt}. Data tersimpan secara offline di perangkat.`));
  screen.append(
    createElement(
      "p",
      "screen-copy",
      "Gunakan Export untuk mengunduh cadangan JSON ke penyimpanan HP, dan Import untuk memulihkan data kapan saja tanpa perlu internet."
    )
  );

  const actionsRow = createElement("div", "data-actions");
  const exportButton = createElement("button", "primary-action compact-action");
  exportButton.type = "button";
  exportButton.append(ICONS.copy(18), document.createTextNode(" Export Cadangan Data"));
  exportButton.addEventListener("click", () => {
    if (actions?.exportData) {
      actions.exportData();
    }
  });

  const importLabel = createElement("label", "import-action");
  importLabel.append(ICONS.database(18), document.createTextNode(" Import Cadangan Data"));
  const importInput = document.createElement("input");
  importInput.type = "file";
  importInput.accept = "application/json,.json";
  importInput.addEventListener("change", (event) => {
    const [file] = event.target.files;
    if (file && actions?.importData) {
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

  const fallbackActions = (typeof window !== "undefined" && window.actions) || (typeof globalThis !== "undefined" && globalThis.actions) || {};

  if (typeof screenIdOrState === "string") {
    screenId = screenIdOrState;
    state = stateOrActions || {};
    actions = maybeActions || state?.actions || fallbackActions;
  } else {
    state = screenIdOrState || {};
    actions = stateOrActions || state?.actions || fallbackActions;
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

