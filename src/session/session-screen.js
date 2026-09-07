import { renderAttendancePanel } from "./attendance-panel.js";
import { renderActivityPanel } from "./activity-panel.js";
import { renderAssessmentPanel } from "./assessment-panel.js";
import { renderSummaryPanel } from "./summary-panel.js";

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

export function renderSessionScreen(session, context) {
  const screen = createElement("main", "screen wide-screen");

  // If no session exists or user wants to create a new session
  if (!session) {
    screen.append(createElement("p", "eyebrow", "Teaching Session"));
    screen.append(createElement("h1", "screen-title", "Mulai Sesi Mengajar"));
    screen.append(
      createElement(
        "p",
        "screen-copy",
        "Pilih kelas dan tentukan topik materi pembelajaran PJOK hari ini."
      )
    );

    const createCard = createElement("section", "session-card");
    const form = createElement("form", "master-form");

    // Class selection
    const classField = createElement("label", "field");
    classField.append(createElement("span", "", "Kelas *"));
    const classSelect = document.createElement("select");
    classSelect.name = "classId";
    classSelect.required = true;
    classSelect.append(createOption("", "Pilih kelas sasaran"));
    (context.classOptions || []).forEach((c) => {
      classSelect.append(createOption(c.id, c.name));
    });
    classField.append(classSelect);
    form.append(classField);

    // Session Number
    const numField = createElement("label", "field");
    numField.append(createElement("span", "", "Nomor Pertemuan / Sesi"));
    const numInput = document.createElement("input");
    numInput.name = "sessionNumber";
    numInput.type = "number";
    numInput.defaultValue = "1";
    numField.append(numInput);
    form.append(numField);

    // Date
    const dateField = createElement("label", "field");
    dateField.append(createElement("span", "", "Tanggal"));
    const dateInput = document.createElement("input");
    dateInput.name = "date";
    dateInput.type = "date";
    dateInput.defaultValue = new Date().toISOString().slice(0, 10);
    dateField.append(dateInput);
    form.append(dateField);

    // Start time
    const timeField = createElement("label", "field");
    timeField.append(createElement("span", "", "Jam Mulai"));
    const timeInput = document.createElement("input");
    timeInput.name = "startTime";
    timeInput.type = "time";
    timeInput.defaultValue = "07:30";
    timeField.append(timeInput);
    form.append(timeField);

    // Topic
    const topicField = createElement("label", "field");
    topicField.append(createElement("span", "", "Topik / Materi Pokok *"));
    const topicInput = document.createElement("input");
    topicInput.name = "topic";
    topicInput.required = true;
    topicInput.placeholder = "Misal: Kebugaran Jasmani / Atletik Lari";
    topicField.append(topicInput);
    form.append(topicField);

    // Material Details
    const matField = createElement("label", "field");
    matField.append(createElement("span", "", "Rincian Materi"));
    const matInput = document.createElement("input");
    matInput.name = "material";
    matInput.placeholder = "Misal: Lari sprint 40m, kelincahan zig-zag";
    matField.append(matInput);
    form.append(matField);

    // Location
    const locField = createElement("label", "field");
    locField.append(createElement("span", "", "Lokasi"));
    const locInput = document.createElement("input");
    locInput.name = "location";
    locInput.defaultValue = "Lapangan Utama";
    locField.append(locInput);
    form.append(locField);

    // Weather
    const wthField = createElement("label", "field");
    wthField.append(createElement("span", "", "Kondisi Cuaca"));
    const wthInput = document.createElement("input");
    wthInput.name = "weather";
    wthInput.defaultValue = "Cerah";
    wthField.append(wthInput);
    form.append(wthField);

    // Teacher & Year
    if ((context.teacherOptions || []).length > 0) {
      const teacherSelect = document.createElement("input");
      teacherSelect.type = "hidden";
      teacherSelect.name = "teacherId";
      teacherSelect.value = context.teacherOptions[0].id;
      form.append(teacherSelect);
    }

    if ((context.academicYearOptions || []).length > 0) {
      const yearInput = document.createElement("input");
      yearInput.type = "hidden";
      yearInput.name = "academicYearId";
      yearInput.value = context.academicYearOptions[0].id;
      form.append(yearInput);
    }

    if ((context.semesterOptions || []).length > 0) {
      const semInput = document.createElement("input");
      semInput.type = "hidden";
      semInput.name = "semesterId";
      semInput.value = context.semesterOptions[0].id;
      form.append(semInput);
    }

    const submitBtn = createElement("button", "primary-action", "Mulai Sesi Pembelajaran");
    submitBtn.type = "submit";
    form.append(submitBtn);

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const vals = Object.fromEntries(new FormData(form).entries());
      vals.status = "active";
      vals.state = "ACTIVE";
      if (context.actions?.createSession) {
        context.actions.createSession(vals);
      }
    });

    createCard.append(form);
    screen.append(createCard);
    return screen;
  }

  // --- TEACHING SESSION WORKSPACE (ACTIVE OR PLANNED) ---

  // Top Session Header Card
  const headerCard = createElement("section", "session-workspace-header");

  const topMetaRow = createElement("div", "session-top-meta");
  const sessionTitleCol = createElement("div", "session-title-col");
  
  const classBadge = createElement("span", "session-class-pill", context.className || "Kelas PJOK");
  const sessionH1 = createElement("h1", "workspace-session-title", `Sesi ${session.sessionNumber || "1"}: ${session.topic || "Pembelajaran Lapangan"}`);
  const metaDetail = createElement(
    "p",
    "workspace-meta-line",
    `📅 ${session.date || "-"} • ⏰ ${session.startTime || "-"} • 📍 ${session.location || "Lapangan"} (${session.weather || "Cerah"})`
  );

  sessionTitleCol.append(classBadge, sessionH1, metaDetail);

  // Status badge
  const statusBadge = createElement(
    "span",
    `session-status-badge status-${session.status || "planned"}`,
    getStatusDisplay(session.status)
  );

  topMetaRow.append(sessionTitleCol, statusBadge);
  headerCard.append(topMetaRow);

  // Quick Action Controls Toolbar
  const controlToolbar = createElement("div", "session-control-toolbar");

  if (session.status === "planned") {
    const startBtn = createElement("button", "btn-tool btn-tool-primary", "▶ Mulai Mengajar");
    startBtn.type = "button";
    startBtn.addEventListener("click", () => context.actions.startSession(session.id));
    controlToolbar.append(startBtn);
  } else if (session.status === "active") {
    const pauseBtn = createElement("button", "btn-tool btn-tool-warning", "⏸ Jeda Sesi");
    pauseBtn.type = "button";
    pauseBtn.addEventListener("click", () => context.actions.pauseSession(session.id));
    controlToolbar.append(pauseBtn);
  } else if (session.status === "paused") {
    const resumeBtn = createElement("button", "btn-tool btn-tool-primary", "▶ Lanjutkan Sesi");
    resumeBtn.type = "button";
    resumeBtn.addEventListener("click", () => context.actions.resumeSession(session.id));
    controlToolbar.append(resumeBtn);
  }

  // Session selector if there are multiple sessions
  const allSessions = context.allSessions || [];
  if (allSessions.length > 1) {
    const switchLabel = createElement("label", "session-switcher-label");
    switchLabel.append(createElement("span", "switcher-caption", "Pilih Sesi:"));
    const switchSelect = document.createElement("select");
    switchSelect.className = "session-select-control";
    allSessions.forEach((s) => {
      const cl = (context.classOptions || []).find((c) => c.id === s.classId);
      const opt = document.createElement("option");
      opt.value = s.id;
      opt.textContent = `${cl?.name || "Kelas"} - Sesi ${s.sessionNumber || "1"} (${s.status})`;
      if (s.id === session.id) opt.selected = true;
      switchSelect.append(opt);
    });
    switchSelect.addEventListener("change", () => {
      if (context.actions.selectSession) {
        context.actions.selectSession(switchSelect.value);
      }
    });
    switchLabel.append(switchSelect);
    controlToolbar.append(switchLabel);
  }

  // New Session Button
  const newSessBtn = createElement("button", "text-button", "+ Sesi Baru");
  newSessBtn.type = "button";
  newSessBtn.addEventListener("click", () => {
    if (context.actions.selectSession) {
      context.actions.selectSession(null);
    }
  });
  controlToolbar.append(newSessBtn);

  headerCard.append(controlToolbar);
  screen.append(headerCard);

  // WORKSPACE TABS NAVIGATION
  const tabsContainer = createElement("div", "workspace-tabs-row");
  const tabContent = createElement("div", "workspace-tab-content");

  let activeTab = context.initialTab || "attendance"; // attendance, activity, assessment, summary
  let lastCapturedStopwatchTime = null;

  const tabs = [
    { id: "attendance", label: "👥 1. Absensi", desc: "Kehadiran Siswa" },
    { id: "activity", label: "⏱️ 2. Aktivitas & Timer", desc: "Alur & Stopwatch" },
    { id: "assessment", label: "🎯 3. Penilaian", desc: "Rubrik & Tes" },
    { id: "summary", label: "🏁 4. Ringkasan & Selesai", desc: "Evaluasi Sesi" }
  ];

  tabs.forEach((tab) => {
    const btn = createElement(
      "button",
      `workspace-tab-btn ${tab.id === activeTab ? "is-active" : ""}`
    );
    btn.type = "button";
    btn.dataset.tab = tab.id;
    btn.append(createElement("strong", "tab-title", tab.label));
    btn.addEventListener("click", () => {
      activeTab = tab.id;
      renderTab();
    });
    tabsContainer.append(btn);
  });

  screen.append(tabsContainer, tabContent);

  function renderTab() {
    tabContent.replaceChildren();
    tabsContainer.querySelectorAll(".workspace-tab-btn").forEach((b) => {
      b.classList.toggle("is-active", b.dataset.tab === activeTab);
    });

    if (activeTab === "attendance") {
      tabContent.append(
        renderAttendancePanel({
          session,
          students: context.students || [],
          records: context.attendanceRecords || [],
          tags: context.studentTags || [],
          onSetStatus: (studentId, status) => {
            context.actions.setAttendanceStatus(studentId, status);
          },
          onMarkAllPresent: (sessionId) => {
            context.actions.markAllPresent(sessionId);
          },
          onViewStudent: (studentId) => {
            if (context.actions.openStudentDetail) {
              context.actions.openStudentDetail(studentId);
            }
          }
        })
      );
    } else if (activeTab === "activity") {
      tabContent.append(
        renderActivityPanel({
          session,
          activities: context.sessionActivities || [],
          onLoadDefaultActivities: (sessionId) => {
            context.actions.loadDefaultActivities(sessionId);
          },
          onCreateActivity: (input) => {
            context.actions.createSessionActivity(input);
          },
          onUpdateActivity: (id, input) => {
            context.actions.updateSessionActivity(id, input);
          },
          onDeleteActivity: (id) => {
            context.actions.deleteSessionActivity(id);
          },
          onCaptureStopwatch: (seconds) => {
            lastCapturedStopwatchTime = seconds;
            activeTab = "assessment";
            renderTab();
          }
        })
      );
    } else if (activeTab === "assessment") {
      tabContent.append(
        renderAssessmentPanel({
          session,
          students: context.students || [],
          definitions: context.assessmentDefinitions || [],
          assessmentSessions: context.assessmentSessions || [],
          assessmentResults: context.assessmentResults || [],
          lastCapturedStopwatch: lastCapturedStopwatchTime,
          onCreateAssessmentSession: (input) => {
            return context.actions.createAssessmentSession(input);
          },
          onSaveAssessmentResult: (input) => {
            context.actions.saveAssessmentResult(input);
          }
        })
      );
    } else if (activeTab === "summary") {
      tabContent.append(
        renderSummaryPanel({
          session,
          className: context.className,
          students: context.students || [],
          records: context.attendanceRecords || [],
          activities: context.sessionActivities || [],
          assessmentResults: context.assessmentResults || [],
          onUpdateSessionNotes: (sessionId, notes) => {
            context.actions.updateSessionNotes(sessionId, notes);
          },
          onFinishSession: (sessionId) => {
            context.actions.finishSession(sessionId);
          },
          onPauseSession: (sessionId) => {
            context.actions.pauseSession(sessionId);
          }
        })
      );
    }
  }

  renderTab();
  return screen;
}

function createOption(value, label) {
  const opt = document.createElement("option");
  opt.value = value;
  opt.textContent = label;
  return opt;
}

function getStatusDisplay(status) {
  const map = {
    planned: "Rencana",
    active: "Sedang Berlangsung",
    paused: "Dijeda",
    completed: "Selesai",
    cancelled: "Dibatalkan"
  };
  return map[status] || status || "Rencana";
}
