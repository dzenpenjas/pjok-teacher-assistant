import { SCREENS } from "../data/schema.js";
import { ICONS } from "./icons.js";
import { createStudentAvatar } from "./student-avatar.js";
import { renderClassesScreen } from "./classes-screen.js";
import { renderStudentsScreen } from "./students-screen.js";
import { renderSettingsScreen } from "./settings-screen.js";
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

function createMiniStat(label, value) {
  const box = createElement("div", "dash-mini-stat");
  box.append(createElement("strong", "dash-mini-val", value));
  box.append(createElement("span", "dash-mini-lbl", label));
  return box;
}

function renderDashboard(state, actions = (typeof window !== "undefined" && window.actions) || {}) {
  const screen = createElement("main", "screen wide-screen dashboard-clean-screen");
  
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
      school?.name ? `${school.name} • Asisten Mengajar Lapangan PJOK` : "Asisten Mengajar Lapangan PJOK — Absensi, Aktivitas & Penilaian Praktik Lapangan."
    )
  );
  screen.append(banner);

  // 2. ACTIVE OR RESUME TEACHING SESSION CARD
  const activeSession = state.session || null;
  const activeClass = activeSession
    ? (state.classes || []).find((c) => c.id === activeSession.classId)
    : null;

  if (activeSession && (activeSession.status === "active" || activeSession.status === "paused" || activeSession.status === "planned")) {
    const sessionCard = createElement("section", "dash-active-hero-card");
    
    const cardTop = createElement("div", "dash-card-header");
    const statusText = activeSession.status === "active" ? "SESI SEDANG BERLANGSUNG" : activeSession.status === "paused" ? "SESI SEDANG DIJEDA" : "RENCANA SESI HARI INI";

    const statusPill = createElement(
      "span",
      `session-status-badge status-${activeSession.status}`,
      `● ${statusText}`
    );
    const sessionHeading = createElement(
      "h2",
      "dash-session-title",
      `${activeClass?.name || "Kelas PJOK"} — Sesi ${activeSession.sessionNumber || "1"}: ${activeSession.topic || "Materi Lapangan"}`
    );
    const sessionSub = createElement(
      "p",
      "dash-session-meta",
      `📍 ${activeSession.location || "Lapangan"} • ☀️ ${activeSession.weather || "Cerah"} • ⏰ ${activeSession.startTime || "07:30"}`
    );

    cardTop.append(statusPill, sessionHeading, sessionSub);
    sessionCard.append(cardTop);

    // Live progress stats for this session
    const sessionRecords = (state.attendanceRecords || []).filter((r) => r.sessionId === activeSession.id);
    const presentCount = sessionRecords.filter((r) => r.status === "present").length;
    const sessionStudents = (state.students || []).filter((s) => s.classId === activeSession.classId);
    const assessedStudents = (state.students || []).filter((s) =>
      (state.assessmentResults || []).some((r) => r.sessionId === activeSession.id && r.studentId === s.id && r.value)
    );
    
    const sessStatsRow = createElement("div", "dash-session-stats");
    sessStatsRow.append(
      createMiniStat("Absensi Siswa", `${presentCount}/${sessionStudents.length} Hadir`),
      createMiniStat("Aktivitas", `${(state.sessionActivities || []).filter((a) => a.sessionId === activeSession.id && a.status === "completed").length} Selesai`),
      createMiniStat("Penilaian", `${assessedStudents.length}/${sessionStudents.length} Dinilai`)
    );
    sessionCard.append(sessStatsRow);

    // Primary CTA to continue teaching session
    const openBtn = createElement("button", "primary-action btn-hero-continue");
    openBtn.type = "button";
    openBtn.append(ICONS.play(20), document.createTextNode(" LANJUTKAN SESI MENGAJAR"));
    openBtn.addEventListener("click", () => {
      if (actions?.navigate) {
        actions.navigate(SCREENS.session);
      }
    });
    sessionCard.append(openBtn);
    screen.append(sessionCard);

  } else {
    // No active session: Quick Class Launcher
    const launchSection = createElement("section", "dash-classes-section");
    const launchHeader = createElement("div", "section-header-compact");
    const launchTitle = createElement("h2", "dash-section-title");
    launchTitle.append(ICONS.book(18), document.createTextNode(" Pilih Kelas & Mulai Mengajar"));
    launchHeader.append(launchTitle);
    launchSection.append(launchHeader);

    const tags = state.studentTags || [];
    const healthTagIds = new Set(
      tags
        .filter((t) => {
          const n = (t.name || "").toLowerCase();
          return n.includes("asma") || n.includes("cedera") || n.includes("perhatian") || n.includes("sakit") || n.includes("khusus");
        })
        .map((t) => t.id)
    );

    const classesGrid = createElement("div", "dash-quick-class-grid");
    const classes = state.classes || [];

    if (classes.length === 0) {
      classesGrid.append(
        createElement("p", "empty-copy", "Belum ada kelas terdaftar. Buka menu Kelas untuk menambahkan kelas.")
      );
    } else {
      classes.forEach((c) => {
        const classStudents = (state.students || []).filter((s) => s.classId === c.id);
        const attentionCount = classStudents.filter((st) => {
          return (Array.isArray(st.tagIds) && st.tagIds.some((id) => healthTagIds.has(id))) || (st.noteIds && st.noteIds.length > 0);
        }).length;

        const cCard = createElement("article", "dash-class-card");
        
        const top = createElement("div", "dash-class-card-top");
        const nameEl = createElement("h3", "dash-class-name", c.name);
        const metaEl = createElement("span", "dash-class-meta", `${classStudents.length} Siswa`);
        top.append(nameEl, metaEl);
        cCard.append(top);

        if (attentionCount > 0) {
          const warnBadge = createElement("span", "dash-class-attention-badge", `⚠️ ${attentionCount} siswa perlu perhatian`);
          cCard.append(warnBadge);
        }

        const startBtn = createElement("button", "primary-action compact-action btn-dash-start");
        startBtn.type = "button";
        startBtn.append(ICONS.play(16), document.createTextNode(" Mulai Sesi"));
        startBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          if (actions?.quickStartClassSession) {
            actions.quickStartClassSession(c.id);
          } else if (actions?.navigate) {
            actions.navigate(SCREENS.session);
          }
        });
        cCard.append(startBtn);

        cCard.addEventListener("click", () => {
          if (actions?.navigate) {
            actions.navigate(SCREENS.classes);
          }
        });

        classesGrid.append(cCard);
      });
    }

    launchSection.append(classesGrid);
    screen.append(launchSection);
  }

  // 3. STUDENT HEALTH & ATTENTION RADAR (Compact, focus on safety)
  const attentionSection = createElement("section", "dash-section-card");
  const radarTitle = createElement("h3", "dash-section-title");
  radarTitle.append(ICONS.alert(18), document.createTextNode(" Catatan Kesehatan & Perhatian Siswa"));
  attentionSection.append(radarTitle);

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
    radarList.append(createElement("p", "empty-copy", "Semua siswa tercatat sehat & siap beraktivitas di lapangan."));
  } else {
    flaggedStudents.slice(0, 5).forEach((st) => {
      const cl = (state.classes || []).find((c) => c.id === st.classId);
      const row = createElement("div", "radar-item");
      row.title = "Buka profil siswa";

      const left = createElement("div", "radar-item-left");
      const avatar = createStudentAvatar(st, 36);
      const infoText = createElement("div", "radar-info-text");
      infoText.append(createElement("strong", "radar-student-name", st.name));
      infoText.append(createElement("span", "radar-student-sub", cl?.name ? `Kelas ${cl.name}` : "Siswa PJOK"));
      left.append(avatar, infoText);

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

  if (screenId === SCREENS.classes || screenId === SCREENS.masterData) {
    return renderClassesScreen(state, actions);
  }

  if (screenId === SCREENS.students) {
    return renderStudentsScreen(state, actions);
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
    return renderSettingsScreen(state, actions);
  }

  return renderDashboard(state, actions);
}
