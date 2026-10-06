import { createField, createSelectField, formToObject } from "./form-controls.js";
import { createPhotoPickerField } from "./student-photo-field.js";
import { createStudentAvatar } from "./student-avatar.js";
import { ICONS } from "./icons.js";
import { generateRubricWithAI } from "../services/rubric-ai-service.js";
import { generateStudentReportWithAI } from "../services/report-ai-service.js";
import { analyzeGrowth } from "../services/growth-analysis-service.js";
import { renderAssessmentImportModal } from "./assessment-import-modal.js";
import { exportAssessmentSessionToJsonFile } from "../services/assessment-package-service.js";
import { exportAssessmentSessionToExcelFile } from "../services/assessment-xlsx-adapter.js";
import {
  parseStudentExcelFile,
  downloadStudentTemplateExcel
} from "../services/student-xlsx-adapter.js";
import {
  showToast,
  registerDirtyGuard,
  unregisterDirtyGuard,
  isFormDirty,
  confirmIfDirty
} from "./feedback.js";
import {
  BATCH_STAGES,
  getDiagnosticStageLabel,
  formatAiDiagnosticText
} from "../services/ai-diagnostic-service.js";
import {
  createFinalReportPage,
  formatClassName
} from "./final-report-page-builder.js";

let isClassHistoryListening = false;
let currentClassUi = null;
let currentRenderCallback = null;
let currentAppScreen = null;
let lastPushedClassState = null;
let isNavigatingBackInternal = false;

function pushClassHistory(mode, classId, extra = {}) {
  if (isNavigatingBackInternal) return;
  const stateData = { pjokClass: { mode, classId, ...extra } };
  lastPushedClassState = stateData;
  try {
    if (typeof window !== "undefined" && window.history?.pushState) {
      window.history.pushState(stateData, "");
    }
  } catch (_) {}
}

function initClassHistoryListener() {
  if (isClassHistoryListening || typeof window === "undefined") return;
  isClassHistoryListening = true;

  window.addEventListener("popstate", () => {
    if (currentAppScreen && currentAppScreen !== "classes") {
      return;
    }

    if (!currentClassUi) return;

    if (isFormDirty()) {
      const ok = window.confirm("Ada perubahan yang belum disimpan.\n\nKeluar tanpa menyimpan?");
      if (!ok) {
        if (lastPushedClassState && window.history?.pushState) {
          try {
            window.history.pushState(lastPushedClassState, "");
          } catch (_) {}
        }
        return;
      }
      unregisterDirtyGuard();
    }

    const currentMode = currentClassUi.mode;
    isNavigatingBackInternal = true;
    try {
      if (currentMode === "scoring") {
        currentClassUi.activeAssessmentSessionId = null;
        currentClassUi.mode = "detail";
        currentClassUi.activeTab = "assessments";
        currentRenderCallback?.();
      } else if (currentMode === "report-student") {
        currentClassUi.reportStudentId = null;
        currentClassUi.mode = "detail";
        currentClassUi.activeTab = "reports";
        currentRenderCallback?.();
      } else if (currentMode === "growth") {
        currentClassUi.mode = "detail";
        currentRenderCallback?.();
      } else if (currentMode === "create-assessment") {
        currentClassUi.mode = "detail";
        currentRenderCallback?.();
      } else if (currentMode === "detail" || currentClassUi.selectedClassId) {
        currentClassUi.selectedClassId = null;
        currentClassUi.mode = "list";
        currentRenderCallback?.();
      }
    } finally {
      isNavigatingBackInternal = false;
    }
  });
}

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

export function renderClassesScreen(state, actions) {
  const screen = createElement("main", "screen wide-screen classes-hub-screen");

  const classUi = state?.uiState?.classes || {
    selectedClassId: null,
    mode: "list",
    activeTab: "students",
    activeAssessmentSessionId: null,
    activeAssessmentStudentIndex: 0,
    activeAssessmentItemIndex: 0,
    studentSearchQuery: "",
    reportStudentId: null,
    reportSelection: {
      assessmentSessionIds: [],
      growthRecordIds: [],
      observationIds: []
    }
  };

  if (!classUi.reportSelection) {
    classUi.reportSelection = {
      assessmentSessionIds: [],
      growthRecordIds: [],
      observationIds: []
    };
  }
  if (!Array.isArray(classUi.reportSelection.assessmentSessionIds)) {
    classUi.reportSelection.assessmentSessionIds = [];
  }
  if (!Array.isArray(classUi.reportSelection.growthRecordIds)) {
    classUi.reportSelection.growthRecordIds = [];
  }
  if (!Array.isArray(classUi.reportSelection.observationIds)) {
    classUi.reportSelection.observationIds = [];
  }

  let showAddClassModal = false;
  let showAddStudentModal = false;

  currentClassUi = classUi;
  currentAppScreen = state?.currentScreen || "classes";
  initClassHistoryListener();

  const container = createElement("div", "classes-hub-container");
  screen.append(container);

  function render() {
    currentRenderCallback = render;
    container.replaceChildren();

    if (classUi.mode === "growth" && classUi.selectedClassId) {
      renderClassGrowthScreening(classUi.selectedClassId);
    } else if (classUi.mode === "create-assessment" && classUi.selectedClassId) {
      renderCreateAssessmentView(classUi.selectedClassId);
    } else if (classUi.mode === "scoring" && classUi.selectedClassId && classUi.activeAssessmentSessionId) {
      renderScoringWorkflowView(classUi.selectedClassId, classUi.activeAssessmentSessionId);
    } else if (classUi.mode === "report-student" && classUi.selectedClassId && classUi.reportStudentId) {
      renderStudentResultsReportView(classUi.selectedClassId, classUi.reportStudentId);
    } else if (classUi.selectedClassId) {
      renderClassDetail(classUi.selectedClassId);
    } else {
      classUi.mode = "list";
      classUi.selectedClassId = null;
      classUi.activeAssessmentSessionId = null;
      classUi.reportStudentId = null;
      renderClassList();
    }
  }

  function openClassDetail(classId) {
    classUi.selectedClassId = classId;
    classUi.mode = "detail";
    pushClassHistory("detail", classId);
    render();
  }

  function openGrowthScreening(classId) {
    classUi.selectedClassId = classId;
    classUi.mode = "growth";
    pushClassHistory("growth", classId);
    render();
  }

  function openCreateAssessment(classId) {
    classUi.selectedClassId = classId;
    classUi.mode = "create-assessment";
    pushClassHistory("create-assessment", classId);
    render();
  }

  function openScoring(classId, sessionId) {
    classUi.selectedClassId = classId;
    classUi.activeAssessmentSessionId = sessionId;
    classUi.activeAssessmentStudentIndex = 0;
    classUi.activeAssessmentItemIndex = 0;
    classUi.mode = "scoring";
    pushClassHistory("scoring", classId, { sessionId });
    render();
  }

  function openStudentReport(classId, studentId) {
    if (classUi.reportStudentId !== studentId) {
      classUi.reportSelection = {
        assessmentSessionIds: [],
        growthRecordIds: [],
        observationIds: []
      };
    }
    classUi.selectedClassId = classId;
    classUi.reportStudentId = studentId;
    classUi.mode = "report-student";
    pushClassHistory("report-student", classId, { studentId });
    render();
  }

  function navigateBackToClassList() {
    if (typeof window !== "undefined" && window.history.state?.pjokClass) {
      window.history.back();
    } else {
      classUi.selectedClassId = null;
      classUi.mode = "list";
      classUi.activeAssessmentSessionId = null;
      render();
    }
  }

  function navigateBackToClassDetail(targetTab = null, skipDirtyCheck = false) {
    if (!skipDirtyCheck && isFormDirty()) {
      if (!confirmIfDirty()) return;
    } else {
      unregisterDirtyGuard();
    }

    if (typeof window !== "undefined" && window.history.state?.pjokClass) {
      if (targetTab) {
        classUi.activeTab = targetTab;
      }
      window.history.back();
    } else {
      classUi.mode = "detail";
      if (targetTab) {
        classUi.activeTab = targetTab;
      }
      render();
    }
  }

  function navigateBackFromScoring() {
    if (typeof window !== "undefined" && window.history.state?.pjokClass) {
      window.history.back();
    } else {
      classUi.activeAssessmentSessionId = null;
      classUi.mode = "detail";
      classUi.activeTab = "assessments";
      render();
    }
  }

  function navigateBackFromStudentReport() {
    if (typeof window !== "undefined" && window.history.state?.pjokClass) {
      window.history.back();
    } else {
      classUi.reportStudentId = null;
      classUi.mode = "detail";
      classUi.activeTab = "reports";
      render();
    }
  }

  function renderClassList() {
    const header = createElement("header", "screen-header-row");
    const titleGroup = createElement("div");
    const eyebrow = createElement("p", "eyebrow");
    eyebrow.append(ICONS.book(15), document.createTextNode(" Pusat Mengajar & Kelas"));
    titleGroup.append(eyebrow, createElement("h1", "screen-title", "Daftar Kelas"));
    titleGroup.append(
      createElement(
        "p",
        "screen-copy",
        "Pilih kelas untuk langsung mulai mengajar di lapangan atau kelola siswa."
      )
    );

    const addBtn = createElement("button", "btn-tool btn-tool-primary compact-action");
    addBtn.type = "button";
    addBtn.append(ICONS.plus(16), document.createTextNode(" Tambah Kelas"));
    addBtn.addEventListener("click", () => {
      showAddClassModal = true;
      render();
    });

    header.append(titleGroup, addBtn);
    container.append(header);

    const classes = state.classes || [];
    if (classes.length === 0) {
      const emptyCard = createElement("div", "empty-state-card");
      emptyCard.append(
        createElement("p", "empty-copy", "Belum ada kelas yang terdaftar."),
        createElement("p", "screen-copy", "Klik tombol 'Tambah Kelas' di atas untuk memulai.")
      );
      container.append(emptyCard);

      if (showAddClassModal) {
        container.append(renderAddClassModal());
      }
      return;
    }

    const tags = state.studentTags || [];
    const healthTagIds = new Set(
      tags
        .filter((t) => {
          const n = (t.name || "").toLowerCase();
          return n.includes("asma") || n.includes("cedera") || n.includes("perhatian") || n.includes("sakit") || n.includes("khusus");
        })
        .map((t) => t.id)
    );

    const grid = createElement("div", "class-cards-grid");

    classes.forEach((c) => {
      const classStudents = (state.students || []).filter((s) => s.classId === c.id);
      const classSessions = (state.sessions || []).filter((sess) => sess.classId === c.id);
      const activeSession = (state.sessions || []).find((sess) => sess.classId === c.id && (sess.status === "active" || sess.status === "paused"));
      
      const attentionCount = classStudents.filter((st) => {
        return (Array.isArray(st.tagIds) && st.tagIds.some((id) => healthTagIds.has(id))) || (st.noteIds && st.noteIds.length > 0);
      }).length;

      const card = createElement("article", "class-summary-card");
      card.addEventListener("click", () => {
        openClassDetail(c.id);
      });

      const topRow = createElement("div", "class-card-top");
      const titleWrap = createElement("div");
      titleWrap.append(
        createElement("h2", "class-card-name", c.name),
        createElement("p", "class-card-meta", `${classStudents.length} Siswa ${c.homeroomTeacher ? `• Wali: ${c.homeroomTeacher}` : ""}`)
      );

      if (activeSession) {
        const badge = createElement("span", "session-status-badge status-active", "● Sesi Berjalan");
        topRow.append(titleWrap, badge);
      } else {
        topRow.append(titleWrap);
      }
      card.append(topRow);

      if (attentionCount > 0) {
        const warnBadge = createElement("div", "class-attention-row", `⚠️ ${attentionCount} siswa memiliki catatan kesehatan khusus`);
        card.append(warnBadge);
      }

      // Action Buttons
      const actionsRow = createElement("div", "class-card-actions");
      
      const startBtn = createElement("button", "primary-action btn-start-session-card");
      startBtn.type = "button";
      startBtn.append(ICONS.play(18), document.createTextNode(activeSession ? " Lanjutkan Sesi" : " Mulai Sesi"));
      startBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (actions?.quickStartClassSession) {
          actions.quickStartClassSession(c.id);
        }
      });

      const openBtn = createElement("button", "btn-tool btn-open-class-card");
      openBtn.type = "button";
      openBtn.append(ICONS.users(16), document.createTextNode(" Buka Kelas"));
      openBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        openClassDetail(c.id);
      });

      actionsRow.append(startBtn, openBtn);
      card.append(actionsRow);

      grid.append(card);
    });

    container.append(grid);

    // Modal Add Class
    if (showAddClassModal) {
      container.append(renderAddClassModal());
    }
  }

  function renderClassDetail(classId) {
    const classRoom = (state.classes || []).find((c) => c.id === classId);
    if (!classRoom) {
      classUi.selectedClassId = null;
      classUi.mode = "list";
      render();
      return;
    }

    const classStudents = (state.students || []).filter((s) => s.classId === classId);
    const classSessions = (state.sessions || []).filter((sess) => sess.classId === classId);

    // Header with back button
    const backBtn = createElement("button", "btn-back-nav");
    backBtn.type = "button";
    backBtn.append(document.createTextNode("← Kembali ke Daftar Kelas"));
    backBtn.addEventListener("click", () => {
      navigateBackToClassList();
    });
    container.append(backBtn);

    const header = createElement("header", "class-detail-header");
    const titleGroup = createElement("div");
    titleGroup.append(
      createElement("h1", "screen-title", classRoom.name),
      createElement("p", "screen-copy", `Tingkat ${classRoom.gradeLevel || "-"} • Total ${classStudents.length} Siswa • ${classSessions.length} Sesi Terlaksana`)
    );

    // Big Primary Start Session CTA
    const mainStartBtn = createElement("button", "primary-action btn-detail-start-session");
    mainStartBtn.type = "button";
    mainStartBtn.append(ICONS.play(18), document.createTextNode(" Mulai Sesi Mengajar Kelas Ini"));
    mainStartBtn.addEventListener("click", () => {
      if (actions?.quickStartClassSession) {
        actions.quickStartClassSession(classRoom.id);
      }
    });

    // Secondary Admin Toolbar
    const adminCluster = createElement("div", "class-admin-cluster");
    const createAssessBtn = createElement("button", "btn-tool btn-tool-primary");
    createAssessBtn.type = "button";
    createAssessBtn.append(ICONS.plus(15), document.createTextNode(" Tambah Asesmen"));
    createAssessBtn.addEventListener("click", () => {
      openCreateAssessment(classRoom.id);
    });

    const growthScreeningBtn = createElement("button", "btn-tool");
    growthScreeningBtn.type = "button";
    growthScreeningBtn.append(ICONS.chart(15), document.createTextNode(" Pemeriksaan Pertumbuhan"));
    growthScreeningBtn.addEventListener("click", () => {
      openGrowthScreening(classRoom.id);
    });

    const addStudentBtn = createElement("button", "btn-tool");
    addStudentBtn.type = "button";
    addStudentBtn.append(ICONS.plus(15), document.createTextNode(" Tambah Siswa"));
    addStudentBtn.addEventListener("click", () => {
      showAddStudentModal = true;
      render();
    });

    const editClassBtn = createElement("button", "btn-tool");
    editClassBtn.type = "button";
    editClassBtn.append(ICONS.settings(15), document.createTextNode(" Edit Nama"));
    editClassBtn.addEventListener("click", () => {
      const newName = window.prompt("Nama Kelas:", classRoom.name);
      if (newName && newName.trim()) {
        actions.updateClass(classRoom.id, { ...classRoom, name: newName.trim() });
        render();
      }
    });

    const deleteClassBtn = createElement("button", "btn-tool text-subtle");
    deleteClassBtn.type = "button";
    deleteClassBtn.append(ICONS.trash(15), document.createTextNode(" Hapus Kelas"));
    deleteClassBtn.addEventListener("click", () => {
      if (window.confirm(`Hapus Kelas "${classRoom.name}" beserta seluruh data siswa dan riwayat sesinya?\nTindakan ini tidak dapat dibatalkan.`)) {
        actions.deleteClass(classRoom.id);
        classUi.selectedClassId = null;
        classUi.mode = "list";
        classUi.activeAssessmentSessionId = null;
        render();
      }
    });

    adminCluster.append(createAssessBtn, growthScreeningBtn, addStudentBtn, editClassBtn, deleteClassBtn);
    header.append(titleGroup, mainStartBtn, adminCluster);
    container.append(header);

    const classAssessments = (state.assessmentSessions || []).filter((as) => as.classId === classRoom.id);

    // Tab Switcher
    const tabsRow = createElement("div", "subnav-tabs-row");
    const tabStudents = createElement(
      "button",
      `subnav-tab ${classUi.activeTab === "students" ? "is-active" : ""}`,
      `Daftar Siswa (${classStudents.length})`
    );
    tabStudents.type = "button";
    tabStudents.addEventListener("click", () => {
      classUi.activeTab = "students";
      render();
    });

    const tabAssessments = createElement(
      "button",
      `subnav-tab ${classUi.activeTab === "assessments" ? "is-active" : ""}`,
      `Asesmen (${classAssessments.length})`
    );
    tabAssessments.type = "button";
    tabAssessments.addEventListener("click", () => {
      classUi.activeTab = "assessments";
      render();
    });

    const tabReports = createElement(
      "button",
      `subnav-tab ${classUi.activeTab === "reports" ? "is-active" : ""}`,
      "Hasil & Laporan"
    );
    tabReports.type = "button";
    tabReports.addEventListener("click", () => {
      classUi.activeTab = "reports";
      render();
    });

    const tabSessions = createElement(
      "button",
      `subnav-tab ${classUi.activeTab === "sessions" ? "is-active" : ""}`,
      `Riwayat Sesi (${classSessions.length})`
    );
    tabSessions.type = "button";
    tabSessions.addEventListener("click", () => {
      classUi.activeTab = "sessions";
      render();
    });

    tabsRow.append(tabStudents, tabAssessments, tabReports, tabSessions);
    container.append(tabsRow);

    if (classUi.activeTab === "students") {
      renderClassStudentsList(classStudents, classRoom);
    } else if (classUi.activeTab === "assessments") {
      renderClassAssessmentsList(classAssessments, classRoom, classStudents);
    } else if (classUi.activeTab === "reports") {
      renderClassResultsCenter(classRoom, classStudents);
    } else {
      renderClassSessionsList(classSessions, classRoom);
    }

    if (showAddStudentModal) {
      container.append(renderAddStudentModal(classRoom));
    }
  }

  function renderClassStudentsList(students, classRoom) {
    const searchBar = createElement("div", "search-filter-bar");
    const searchInput = document.createElement("input");
    searchInput.type = "search";
    searchInput.className = "search-input";
    searchInput.placeholder = "Cari nama atau NIS siswa...";
    searchInput.value = classUi.studentSearchQuery || "";
    searchInput.addEventListener("input", (e) => {
      classUi.studentSearchQuery = e.target.value.toLowerCase();
      renderClassStudentsCards();
    });
    searchBar.append(searchInput);
    container.append(searchBar);

    const listContainer = createElement("div", "class-students-container");
    container.append(listContainer);

    function renderClassStudentsCards() {
      listContainer.replaceChildren();

      const filtered = students.filter((s) => {
        if (!classUi.studentSearchQuery) return true;
        return (
          (s.name || "").toLowerCase().includes(classUi.studentSearchQuery) ||
          (s.studentNumber || "").toLowerCase().includes(classUi.studentSearchQuery)
        );
      });

      if (filtered.length === 0) {
        listContainer.append(createElement("p", "empty-copy", "Tidak ada siswa yang cocok."));
        return;
      }

      const grid = createElement("div", "students-grid");
      filtered.forEach((student) => {
        const card = createElement("article", "student-card-item");
        card.setAttribute("role", "button");
        card.tabIndex = 0;
        card.addEventListener("click", () => actions.openStudentDetail(student.id));

        const infoRow = createElement("div", "student-card-main");
        const avatar = createStudentAvatar(student, 46);

        const textCol = createElement("div", "student-card-meta");
        const nameEl = createElement("strong", "student-card-name", student.name);
        const subEl = createElement("span", "student-card-sub", `NIS: ${student.studentNumber || "-"} • ${student.gender === "female" ? "Perempuan" : (student.gender === "male" ? "Laki-laki" : "-")}`);

        textCol.append(nameEl, subEl);

        // Tags
        const tags = (student.tagIds || [])
          .map((id) => (state.studentTags || []).find((t) => t.id === id))
          .filter(Boolean);

        if (tags.length > 0) {
          const tagRow = createElement("div", "student-tags-row");
          tags.forEach((t) => {
            const pill = createElement("span", "student-tag-pill", t.name);
            pill.style.backgroundColor = t.color ? `${t.color}25` : "#e2e8f0";
            pill.style.color = t.color || "#334155";
            tagRow.append(pill);
          });
          textCol.append(tagRow);
        }

        infoRow.append(avatar, textCol);

        // Actions on student
        const actionsCol = createElement("div", "student-card-actions");
        const profileBtn = createElement("button", "btn-tool", "Lihat Profil");
        profileBtn.type = "button";
        profileBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          actions.openStudentDetail(student.id);
        });

        actionsCol.append(profileBtn);
        card.append(infoRow, actionsCol);
        grid.append(card);
      });

      listContainer.append(grid);
    }

    renderClassStudentsCards();
  }

  function renderClassSessionsList(sessions, classRoom) {
    if (sessions.length === 0) {
      container.append(createElement("p", "empty-copy", "Belum ada sesi mengajar yang dilaksanakan untuk kelas ini."));
      return;
    }

    const list = createElement("div", "sessions-history-list");
    sessions.forEach((sess) => {
      const card = createElement("article", "session-history-card");

      const topRow = createElement("div", "session-hist-top");
      const title = createElement("strong", "session-hist-title", `Sesi ${sess.sessionNumber || "1"}: ${sess.topic || "Pembelajaran Lapangan"}`);
      const statusBadge = createElement("span", `session-status-badge status-${sess.status}`, sess.status);
      topRow.append(title, statusBadge);

      const meta = createElement(
        "p",
        "session-hist-meta",
        `📅 ${sess.date || "-"} • ⏰ ${sess.startTime || "-"} • 📍 ${sess.location || "Lapangan"}`
      );

      const btn = createElement("button", "btn-tool btn-tool-primary", "Buka Sesi");
      btn.type = "button";
      btn.addEventListener("click", () => {
        if (actions?.selectSession) {
          actions.selectSession(sess.id);
        }
      });

      card.append(topRow, meta, btn);
      list.append(card);
    });

    container.append(list);
  }

  function renderClassResultsCenter(classRoom, students) {
    if (!classUi.batchState) {
      classUi.batchState = {
        isBatchGenerating: false,
        currentStudentIndex: 0,
        totalStudents: 0,
        currentStudentName: "",
        successCount: 0,
        failedCount: 0,
        skippedCount: 0,
        failedStudentIds: [],
        statusSummary: null,
        studentStatuses: {},
        diagnostic: null
      };
    }
    if (!classUi.batchReportSelection) {
      classUi.batchReportSelection = {
        assessmentSessionIds: [],
        includeGrowth: false,
        includeObservations: false
      };
    }
    if (!Array.isArray(classUi.batchReportSelection.assessmentSessionIds)) {
      classUi.batchReportSelection.assessmentSessionIds = [];
    }
    if (!classUi.reportDrafts) {
      classUi.reportDrafts = {};
    }

    const header = createElement("div", "results-center-header space-y-1 mb-4");
    header.append(
      createElement("h2", "sub-title font-bold text-base", "Hasil & Laporan"),
      createElement(
        "p",
        "text-subtle text-xs",
        "Lihat seluruh hasil asesmen, pertumbuhan, dan observasi siswa dalam satu tempat. Pilih sumber data dan buat draf laporan AI sekaligus."
      )
    );
    container.append(header);

    // ==========================================
    // BATCH AI REPORT GENERATION CONTROL PANEL
    // ==========================================
    const batchPanel = createElement("section", "batch-report-panel bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 mb-6 shadow-sm space-y-4");

    const batchHeader = createElement("div", "flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3 border-slate-100 dark:border-slate-800");
    const headerTitleGroup = createElement("div");
    headerTitleGroup.append(
      createElement("h3", "font-bold text-base text-slate-900 dark:text-slate-100 flex items-center gap-2", "✨ Generate Semua Laporan AI Siswa"),
      createElement("p", "text-subtle text-xs mt-0.5", "Buat draf narasi laporan AI untuk seluruh siswa di kelas ini secara berurutan.")
    );
    batchHeader.append(headerTitleGroup);

    // Class Source Configuration Controls
    const sourceConfigBox = createElement("div", "space-y-3 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-lg text-xs");
    sourceConfigBox.append(
      createElement("p", "font-semibold text-slate-800 dark:text-slate-200", "Sumber Data Laporan Kelas:")
    );

    const classSessions = (state.assessmentSessions || []).filter((as) => as.classId === classRoom.id);
    if (classSessions.length === 0) {
      sourceConfigBox.append(createElement("p", "text-subtle italic", "Belum ada sesi asesmen di kelas ini."));
    } else {
      const sessList = createElement("div", "flex flex-wrap gap-3 mt-1");
      classSessions.forEach((sess) => {
        const isChecked = (classUi.batchReportSelection.assessmentSessionIds || []).includes(sess.id);
        const lbl = createElement("label", "flex items-center gap-1.5 cursor-pointer font-medium text-slate-700 dark:text-slate-300");
        const chk = document.createElement("input");
        chk.type = "checkbox";
        chk.className = "report-source-check";
        chk.checked = isChecked;
        chk.disabled = classUi.batchState.isBatchGenerating;
        chk.addEventListener("change", (e) => {
          if (!classUi.batchReportSelection.assessmentSessionIds) {
            classUi.batchReportSelection.assessmentSessionIds = [];
          }
          if (e.target.checked) {
            if (!classUi.batchReportSelection.assessmentSessionIds.includes(sess.id)) {
              classUi.batchReportSelection.assessmentSessionIds.push(sess.id);
            }
          } else {
            classUi.batchReportSelection.assessmentSessionIds = classUi.batchReportSelection.assessmentSessionIds.filter(
              (id) => id !== sess.id
            );
          }
          renderCards();
        });
        lbl.append(chk, document.createTextNode(sess.title || `Pertemuan ${sess.sessionNumber}`));
        sessList.append(lbl);
      });
      sourceConfigBox.append(sessList);
    }

    const extraOptionsWrap = createElement("div", "flex flex-wrap gap-4 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 mt-2");
    
    const growthLbl = createElement("label", "flex items-center gap-1.5 cursor-pointer font-medium text-slate-700 dark:text-slate-300");
    const growthChk = document.createElement("input");
    growthChk.type = "checkbox";
    growthChk.className = "report-source-check";
    growthChk.checked = Boolean(classUi.batchReportSelection?.includeGrowth);
    growthChk.disabled = classUi.batchState.isBatchGenerating;
    growthChk.addEventListener("change", (e) => {
      if (!classUi.batchReportSelection) classUi.batchReportSelection = {};
      classUi.batchReportSelection.includeGrowth = e.target.checked;
    });
    growthLbl.append(growthChk, document.createTextNode("Sertakan Pertumbuhan Fisik"));

    const obsLbl = createElement("label", "flex items-center gap-1.5 cursor-pointer font-medium text-slate-700 dark:text-slate-300");
    const obsChk = document.createElement("input");
    obsChk.type = "checkbox";
    obsChk.className = "report-source-check";
    obsChk.checked = Boolean(classUi.batchReportSelection?.includeObservations);
    obsChk.disabled = classUi.batchState.isBatchGenerating;
    obsChk.addEventListener("change", (e) => {
      if (!classUi.batchReportSelection) classUi.batchReportSelection = {};
      classUi.batchReportSelection.includeObservations = e.target.checked;
    });
    obsLbl.append(obsChk, document.createTextNode("Sertakan Catatan Sikap & Observasi"));

    extraOptionsWrap.append(growthLbl, obsLbl);
    sourceConfigBox.append(extraOptionsWrap);

    batchPanel.append(batchHeader, sourceConfigBox);

    // Action Row
    const batchActionRow = createElement("div", "flex flex-wrap items-center gap-3");

    const runBatchBtn = createElement("button", "primary-action compact-action", "✨ Generate Semua Laporan");
    runBatchBtn.type = "button";
    runBatchBtn.disabled = classUi.batchState.isBatchGenerating;
    if (classUi.batchState.isBatchGenerating) {
      runBatchBtn.classList.add("opacity-50", "cursor-not-allowed");
    }

    runBatchBtn.addEventListener("click", () => {
      runBatchReportGeneration(students);
    });

    batchActionRow.append(runBatchBtn);

    if (classUi.batchState.failedStudentIds && classUi.batchState.failedStudentIds.length > 0 && !classUi.batchState.isBatchGenerating) {
      const retryBtn = createElement("button", "btn-tool btn-tool-primary text-xs", `🔄 Coba Lagi yang Gagal (${classUi.batchState.failedStudentIds.length})`);
      retryBtn.type = "button";
      retryBtn.addEventListener("click", () => {
        const failedStudents = students.filter((s) => classUi.batchState.failedStudentIds.includes(s.id));
        runBatchReportGeneration(failedStudents);
      });
      batchActionRow.append(retryBtn);
    }

    const activeAcademicYearId = state.activeAcademicYearId || null;
    const activeSemesterId = state.activeSemesterId || null;

    const readyStudentsWithReports = students
      .map((student) => {
        const savedReport = (state.studentReports || []).find(
          (r) =>
            r &&
            r.studentId === student.id &&
            r.classId === classRoom.id &&
            (r.academicYearId || null) === activeAcademicYearId &&
            (r.semesterId || null) === activeSemesterId &&
            r.draft &&
            typeof r.draft === "object" &&
            r.reportContext &&
            typeof r.reportContext === "object"
        );
        if (!savedReport) return null;
        return { student, savedReport };
      })
      .filter(Boolean);

    const downloadAllBtn = createElement(
      "button",
      "btn-tool btn-tool-primary text-xs flex items-center gap-1.5 font-bold",
      `📥 Unduh Semua Laporan (${readyStudentsWithReports.length}/${students.length})`
    );
    downloadAllBtn.type = "button";
    downloadAllBtn.disabled = classUi.batchState.isBatchGenerating || readyStudentsWithReports.length === 0;
    if (downloadAllBtn.disabled) {
      downloadAllBtn.classList.add("opacity-50", "cursor-not-allowed");
    }

    downloadAllBtn.addEventListener("click", async () => {
      if (!window.html2pdf) {
        window.alert("Mesin PDF belum tersedia. Muat ulang aplikasi lalu coba lagi.");
        return;
      }
      if (readyStudentsWithReports.length === 0) {
        window.alert("Belum ada laporan yang disimpan untuk kelas ini.");
        return;
      }

      const cleanClassName = (classRoom.name || "Kelas").replace(/[^a-zA-Z0-9]/g, "_");
      const pdfFilename = `Laporan_PJOK_${cleanClassName}.pdf`;

      downloadAllBtn.disabled = true;
      downloadAllBtn.textContent = `⏳ Menyiapkan PDF (${readyStudentsWithReports.length} siswa)...`;

      const exportContainer = document.createElement("div");
      exportContainer.className = "batch-pdf-export-container";
      exportContainer.style.position = "fixed";
      exportContainer.style.left = "-9999px";
      exportContainer.style.top = "0";
      exportContainer.style.width = "210mm";
      exportContainer.style.background = "#ffffff";
      document.body.appendChild(exportContainer);

      try {
        let renderedPageCount = 0;

        for (let i = 0; i < readyStudentsWithReports.length; i++) {
          const { student, savedReport } = readyStudentsWithReports[i];
          if (
            !savedReport ||
            !savedReport.draft ||
            typeof savedReport.draft !== "object" ||
            !savedReport.reportContext ||
            typeof savedReport.reportContext !== "object"
          ) {
            continue;
          }

          const pageEl = createFinalReportPage({
            student,
            classRoom,
            draft: savedReport.draft,
            reportContext: savedReport.reportContext,
            school: state.school || { name: state.schoolName, address: state.schoolAddress }
          });

          if (renderedPageCount > 0) {
            pageEl.style.pageBreakBefore = "always";
            pageEl.style.breakBefore = "page";
          }
          pageEl.style.pageBreakInside = "avoid";
          pageEl.style.breakInside = "avoid";
          pageEl.style.marginBottom = "0";

          exportContainer.appendChild(pageEl);

          if (pageEl.scrollHeight > pageEl.clientHeight) {
            pageEl.classList.add("a4-compact");
          }

          renderedPageCount++;
        }

        if (renderedPageCount === 0) {
          window.alert("Tidak ada laporan valid yang dapat diekspor.");
          return;
        }

        const opt = {
          margin: 0,
          filename: pdfFilename,
          image: {
            type: "jpeg",
            quality: 0.98
          },
          html2canvas: {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: "#ffffff"
          },
          jsPDF: {
            unit: "mm",
            format: "a4",
            orientation: "portrait"
          },
          pagebreak: {
            mode: ["css", "legacy"]
          }
        };

        downloadAllBtn.textContent = `⏳ Mengekspor PDF (${renderedPageCount} siswa)...`;
        await window.html2pdf().set(opt).from(exportContainer).save();
        showToast(`Berhasil mengunduh semua laporan kelas (${renderedPageCount} siswa)`);
      } catch (pdfErr) {
        console.error("[BATCH PDF GENERATION ERROR]", pdfErr);
        window.alert("Terjadi kendala saat membuat PDF gabungan kelas: " + (pdfErr?.message || ""));
      } finally {
        if (exportContainer && exportContainer.parentNode) {
          exportContainer.parentNode.removeChild(exportContainer);
        }
        downloadAllBtn.disabled = false;
        downloadAllBtn.textContent = `📥 Unduh Semua Laporan (${readyStudentsWithReports.length}/${students.length})`;
      }
    });

    batchActionRow.append(downloadAllBtn);

    batchPanel.append(batchActionRow);

    // Batch Status / Progress Indicator Box
    const hasDiagError = Boolean(
      classUi.batchState.diagnostic?.lastFailure ||
      classUi.batchState.diagnostic?.errorCode ||
      classUi.batchState.diagnostic?.errorMessage ||
      (classUi.batchState.failedCount && classUi.batchState.failedCount > 0)
    );
    const showProgressBox = Boolean(classUi.batchState.isBatchGenerating || classUi.batchState.statusSummary || hasDiagError);

    if (showProgressBox) {
      const isGenerating = Boolean(classUi.batchState.isBatchGenerating);
      const progressBox = createElement("div", "p-3 rounded-lg border text-xs space-y-2 mt-2 " +
        (isGenerating
          ? "bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-200"
          : (hasDiagError && classUi.batchState.failedCount > 0
              ? "bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-200"
              : "bg-slate-50 border-slate-200 text-slate-800 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"))
      );

      if (isGenerating) {
        const progressP = createElement("p", "font-bold", `Membuat laporan ${classUi.batchState.currentStudentIndex || 0} dari ${classUi.batchState.totalStudents || 0}`);
        const currentStudentP = createElement("p", "text-subtle", `Sedang diproses: ${classUi.batchState.currentStudentName || "-"}`);
        
        const stageLabel = getDiagnosticStageLabel(classUi.batchState.diagnostic?.stage);
        const stageP = stageLabel ? createElement("p", "font-medium text-xs text-primary flex items-center gap-1", `⏳ ${stageLabel}`) : null;

        const progressBarWrap = createElement("div", "w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden mt-1");
        const pct = classUi.batchState.totalStudents > 0
          ? Math.round((classUi.batchState.currentStudentIndex / classUi.batchState.totalStudents) * 100)
          : 0;
        const progressBarFill = createElement("div", "bg-primary h-full transition-all duration-300");
        progressBarFill.style.width = `${pct}%`;
        progressBarWrap.append(progressBarFill);

        progressBox.append(progressP, currentStudentP);
        if (stageP) progressBox.append(stageP);
        progressBox.append(progressBarWrap);
      } else if (classUi.batchState.statusSummary) {
        const summaryP = createElement("p", "font-semibold", classUi.batchState.statusSummary);
        progressBox.append(summaryP);
      }

      // Copy Diagnostic Button: Tampil saat batch berjalan atau batch gagal/ada diagnostic error
      if (isGenerating || hasDiagError) {
        const copyDiagRow = createElement("div", "pt-1 flex items-center justify-between gap-2");
        const copyDiagBtn = createElement("button", "btn-tool text-xs text-subtle hover:text-foreground flex items-center gap-1", "📋 Salin Diagnostik AI");
        copyDiagBtn.type = "button";
        copyDiagBtn.addEventListener("click", async () => {
          const text = formatAiDiagnosticText(classUi.batchState.diagnostic);
          try {
            if (navigator?.clipboard?.writeText) {
              await navigator.clipboard.writeText(text);
            } else {
              const ta = document.createElement("textarea");
              ta.value = text;
              document.body.appendChild(ta);
              ta.select();
              document.execCommand("copy");
              document.body.removeChild(ta);
            }
            showToast("Diagnostik AI berhasil disalin");
            copyDiagBtn.textContent = "✓ Diagnostik Tersalin";
            setTimeout(() => {
              copyDiagBtn.textContent = "📋 Salin Diagnostik AI";
            }, 2500);
          } catch (e) {
            console.error("Gagal menyalin diagnostik:", e);
            window.alert(text);
          }
        });
        copyDiagRow.append(copyDiagBtn);
        progressBox.append(copyDiagRow);
      }

      batchPanel.append(progressBox);
    }

    container.append(batchPanel);

    async function runBatchReportGeneration(targetStudents) {
      let apiKey = "";
      try {
        apiKey = (window.sessionStorage.getItem("pjok_gemini_api_key") || "").trim();
      } catch (_) {}

      if (!apiKey) {
        window.alert("AI belum dikonfigurasi. Atur Gemini API Key di Pengaturan → AI.");
        return;
      }

      if (classUi.batchState.isBatchGenerating) return;

      const runId = `batch_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const startedAt = new Date().toISOString();

      classUi.batchState.classId = classRoom.id;
      classUi.batchState.className = classRoom.name;
      classUi.batchState.isBatchGenerating = true;
      classUi.batchState.totalStudents = targetStudents.length;
      classUi.batchState.currentStudentIndex = 0;
      classUi.batchState.currentStudentName = "";
      classUi.batchState.successCount = 0;
      classUi.batchState.failedCount = 0;
      classUi.batchState.skippedCount = 0;
      classUi.batchState.failedStudentIds = [];
      classUi.batchState.statusSummary = null;
      classUi.batchState.diagnostic = {
        runId,
        startedAt,
        stage: BATCH_STAGES.BATCH_STARTED,
        studentId: null,
        studentName: null,
        studentIndex: 0,
        totalStudents: targetStudents.length,
        assessmentCount: 0,
        growthCount: 0,
        observationCount: 0,
        requestStartedAt: null,
        responseReceivedAt: null,
        elapsedMs: null,
        httpStatus: null,
        lastCompletedStage: null,
        errorCode: null,
        errorMessage: null,
        lastFailure: null
      };

      function updateDiag(newStage, updates = {}) {
        if (!classUi.batchState.diagnostic) return;
        const diag = classUi.batchState.diagnostic;
        if (diag.stage !== newStage) {
          diag.lastCompletedStage = diag.stage;
          diag.stage = newStage;
        }
        Object.assign(diag, updates);
      }

      try {
        render();
        if (actions?.requestAppRender) {
          actions.requestAppRender();
        }

        for (let i = 0; i < targetStudents.length; i++) {
          const student = targetStudents[i];
          classUi.batchState.currentStudentIndex = i + 1;
          classUi.batchState.currentStudentName = student.name;

          updateDiag(BATCH_STAGES.STUDENT_SELECTED, {
            studentId: student.id,
            studentName: student.name,
            studentIndex: i + 1,
            requestStartedAt: null,
            responseReceivedAt: null,
            elapsedMs: null,
            httpStatus: null,
            errorCode: null,
            errorMessage: null
          });

          render();
          if (actions?.requestAppRender) {
            actions.requestAppRender();
          }

          updateDiag(BATCH_STAGES.CONTEXT_BUILDING);
          render();
          if (actions?.requestAppRender) {
            actions.requestAppRender();
          }

          // Build data selections for student
          const selectedAssessments = (state.assessmentResults || [])
            .map((r) => {
              if (r.studentId !== student.id) return null;
              const sess = (state.assessmentSessions || []).find((as) => as.id === r.assessmentSessionId);
              if (!sess || sess.classId !== classRoom.id) return null;
              const batchAssessmentIds = classUi.batchReportSelection?.assessmentSessionIds || [];
              if (batchAssessmentIds.length > 0 && !batchAssessmentIds.includes(sess.id)) {
                return null;
              }
              const def = (state.assessmentDefinitions || []).find((d) => d.id === (sess.definitionId || r.definitionId));
              return { result: r, assessmentSession: sess, definition: def, date: sess.date || r.recordedAt || "" };
            })
            .filter(Boolean);

          const selectedGrowth = classUi.batchReportSelection?.includeGrowth
            ? (state.growthRecords || []).filter((g) => g.studentId === student.id)
            : [];

          const selectedObs = classUi.batchReportSelection?.includeObservations
            ? (state.studentObservations || []).filter((o) => o.studentId === student.id)
            : [];

          updateDiag(BATCH_STAGES.CONTEXT_READY, {
            assessmentCount: selectedAssessments.length,
            growthCount: selectedGrowth.length,
            observationCount: selectedObs.length
          });

          const totalSources = selectedAssessments.length + selectedGrowth.length + selectedObs.length;

          if (totalSources === 0) {
            classUi.batchState.skippedCount++;
            classUi.batchState.studentStatuses[student.id] = "Dilewati — data tidak tersedia";
            updateDiag(BATCH_STAGES.STUDENT_DONE);
            continue;
          }

          const reportContext = buildSelectedReportContext({
            student,
            classRoom,
            assessmentSelections: selectedAssessments,
            growthSelections: selectedGrowth,
            observationSelections: selectedObs,
            allGrowthRecords: state.growthRecords || []
          });

          try {
            let reqStartTime = null;
            const draft = await generateStudentReportWithAI({
              apiKey,
              reportContext,
              onDiagnosticStage: (stageName, meta = {}) => {
                if (stageName === "API_REQUEST_START") {
                  reqStartTime = Date.now();
                  updateDiag(BATCH_STAGES.API_REQUEST_START, {
                    requestStartedAt: new Date(reqStartTime).toISOString(),
                    responseReceivedAt: null,
                    elapsedMs: null,
                    httpStatus: null
                  });
                } else if (stageName === "API_WAITING") {
                  updateDiag(BATCH_STAGES.API_WAITING);
                } else if (stageName === "API_RESPONSE_RECEIVED") {
                  const now = Date.now();
                  updateDiag(BATCH_STAGES.API_RESPONSE_RECEIVED, {
                    responseReceivedAt: new Date(now).toISOString(),
                    elapsedMs: reqStartTime ? (now - reqStartTime) : null,
                    httpStatus: meta?.httpStatus ?? null
                  });
                } else if (stageName === "RESPONSE_PARSING") {
                  updateDiag(BATCH_STAGES.RESPONSE_PARSING);
                }
                render();
                if (actions?.requestAppRender) {
                  actions.requestAppRender();
                }
              }
            });

            if (draft && typeof draft === "object") {
              updateDiag(BATCH_STAGES.REPORT_SAVING);
              render();
              if (actions?.requestAppRender) {
                actions.requestAppRender();
              }

              if (!classUi.reportDrafts) classUi.reportDrafts = {};
              classUi.reportDrafts[student.id] = draft;

              if (actions?.saveStudentReport) {
                actions.saveStudentReport({
                  studentId: student.id,
                  classId: classRoom.id,
                  academicYearId: state.activeAcademicYearId || null,
                  semesterId: state.activeSemesterId || null,
                  reportContext,
                  draft
                });
              }

              classUi.batchState.successCount++;
              classUi.batchState.studentStatuses[student.id] = "Berhasil";
              updateDiag(BATCH_STAGES.STUDENT_DONE);
            } else {
              classUi.batchState.failedCount++;
              classUi.batchState.failedStudentIds.push(student.id);
              classUi.batchState.studentStatuses[student.id] = "Gagal — respon AI tidak valid";
              updateDiag(BATCH_STAGES.ERROR, {
                errorCode: "INVALID_AI_RESPONSE",
                errorMessage: "Format respon AI tidak valid"
              });
              classUi.batchState.diagnostic.lastFailure = {
                studentId: student.id,
                studentName: student.name,
                studentIndex: i + 1,
                stage: BATCH_STAGES.ERROR,
                lastCompletedStage: classUi.batchState.diagnostic.lastCompletedStage,
                errorCode: "INVALID_AI_RESPONSE",
                errorMessage: "Format respon AI tidak valid",
                httpStatus: classUi.batchState.diagnostic.httpStatus,
                requestStartedAt: classUi.batchState.diagnostic.requestStartedAt,
                responseReceivedAt: classUi.batchState.diagnostic.responseReceivedAt,
                elapsedMs: classUi.batchState.diagnostic.elapsedMs
              };
            }
          } catch (err) {
            console.error("[BATCH REPORT AI ERROR for student]", student.name, err);
            const isKeyError = err?.isApiKeyError || (err?.message && (err.message.includes("API key") || err.message.includes("API_KEY")));
            const isTimeout = err?.code === "AI_REQUEST_TIMEOUT" || (err?.message && err.message.includes("timed out"));
            const errorCode = isKeyError ? "AUTH_ERROR" : (isTimeout ? "AI_REQUEST_TIMEOUT" : (err?.code || "AI_REQUEST_ERROR"));
            const errorMessage = err?.message || "Error network/API";

            updateDiag(BATCH_STAGES.ERROR, {
              errorCode,
              errorMessage
            });

            classUi.batchState.diagnostic.lastFailure = {
              studentId: student.id,
              studentName: student.name,
              studentIndex: i + 1,
              stage: BATCH_STAGES.ERROR,
              lastCompletedStage: classUi.batchState.diagnostic.lastCompletedStage,
              errorCode,
              errorMessage,
              httpStatus: classUi.batchState.diagnostic.httpStatus,
              requestStartedAt: classUi.batchState.diagnostic.requestStartedAt,
              responseReceivedAt: classUi.batchState.diagnostic.responseReceivedAt,
              elapsedMs: classUi.batchState.diagnostic.elapsedMs
            };

            if (isKeyError) {
              classUi.batchState.isBatchGenerating = false;
              classUi.batchState.statusSummary = "API key tidak valid. Periksa di Pengaturan → AI.";
              window.alert("API key tidak valid. Periksa di Pengaturan → AI.");
              render();
              if (actions?.requestAppRender) {
                actions.requestAppRender();
              }
              return;
            }

            classUi.batchState.failedCount++;
            classUi.batchState.failedStudentIds.push(student.id);
            classUi.batchState.studentStatuses[student.id] = `Gagal — ${errorMessage}`;
          }
        }

        updateDiag(BATCH_STAGES.BATCH_DONE);
        classUi.batchState.statusSummary = `Ringkasan: ${classUi.batchState.successCount} berhasil, ${classUi.batchState.failedCount} gagal, ${classUi.batchState.skippedCount} dilewati`;
      } catch (outerErr) {
        console.error("[BATCH REPORT OUTER ERROR]", outerErr);
        updateDiag(BATCH_STAGES.ERROR, {
          errorCode: outerErr?.code || "FATAL_BATCH_ERROR",
          errorMessage: outerErr?.message || String(outerErr)
        });
        if (classUi.batchState.diagnostic) {
          classUi.batchState.diagnostic.lastFailure = {
            studentId: classUi.batchState.diagnostic.studentId,
            studentName: classUi.batchState.diagnostic.studentName,
            studentIndex: classUi.batchState.diagnostic.studentIndex,
            stage: BATCH_STAGES.ERROR,
            lastCompletedStage: classUi.batchState.diagnostic.lastCompletedStage,
            errorCode: outerErr?.code || "FATAL_BATCH_ERROR",
            errorMessage: outerErr?.message || String(outerErr),
            httpStatus: classUi.batchState.diagnostic.httpStatus,
            requestStartedAt: classUi.batchState.diagnostic.requestStartedAt,
            responseReceivedAt: classUi.batchState.diagnostic.responseReceivedAt,
            elapsedMs: classUi.batchState.diagnostic.elapsedMs
          };
        }
        classUi.batchState.statusSummary = `Terjadi kendala pada proses batch: ${outerErr?.message || "Gagal memproses batch"}`;
      } finally {
        classUi.batchState.isBatchGenerating = false;
        render();
        if (actions?.requestAppRender) {
          actions.requestAppRender();
        }
      }
    }

    const searchBar = createElement("div", "search-filter-bar");
    const searchInput = document.createElement("input");
    searchInput.type = "search";
    searchInput.className = "search-input";
    searchInput.placeholder = "Cari nama atau NIS siswa...";
    searchInput.value = classUi.studentSearchQuery || "";
    searchInput.addEventListener("input", (e) => {
      classUi.studentSearchQuery = e.target.value.toLowerCase();
      renderCards();
    });
    searchBar.append(searchInput);
    container.append(searchBar);

    const listContainer = createElement("div", "class-results-students-container mt-4");
    container.append(listContainer);

    function renderCards() {
      listContainer.replaceChildren();

      const filtered = students.filter((s) => {
        if (!classUi.studentSearchQuery) return true;
        return (
          (s.name || "").toLowerCase().includes(classUi.studentSearchQuery) ||
          (s.studentNumber || "").toLowerCase().includes(classUi.studentSearchQuery)
        );
      });

      if (filtered.length === 0) {
        listContainer.append(createElement("p", "empty-copy", "Tidak ada siswa yang cocok."));
        return;
      }

      const grid = createElement("div", "results-students-grid");

      filtered.forEach((student) => {
        // Calculate student metrics
        const studentResults = (state.assessmentResults || []).filter((r) => {
          if (r.studentId !== student.id) return false;
          const sess = (state.assessmentSessions || []).find(
            (as) => as.id === r.assessmentSessionId
          );
          return sess && sess.classId === classRoom.id;
        });

        const assessmentCount = studentResults.length;
        const completedResults = studentResults.filter(
          (r) => r.numericScore !== null && r.numericScore !== undefined
        );
        const completedCount = completedResults.length;

        const growthCount = (state.growthRecords || []).filter(
          (g) => g.studentId === student.id
        ).length;

        const observationCount = (state.studentObservations || []).filter(
          (o) => o.studentId === student.id
        ).length;

        // Latest completed score by session date
        let latestScoreText = "Belum ada nilai lengkap";
        if (completedResults.length > 0) {
          const sortedCompleted = completedResults
            .map((r) => {
              const sess = (state.assessmentSessions || []).find(
                (as) => as.id === r.assessmentSessionId
              );
              return {
                result: r,
                date: sess?.date || r.recordedAt || ""
              };
            })
            .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

          if (sortedCompleted.length > 0 && sortedCompleted[0].result.numericScore !== null && sortedCompleted[0].result.numericScore !== undefined) {
            latestScoreText = String(sortedCompleted[0].result.numericScore);
          }
        }

        const card = createElement("article", "results-student-card");

        const infoRow = createElement("div", "results-student-card-main");
        const avatar = createStudentAvatar(student, 46);

        const textCol = createElement("div", "results-student-card-meta");
        const nameEl = createElement("strong", "student-card-name", student.name);
        const subEl = createElement(
          "span",
          "student-card-sub",
          `NIS: ${student.studentNumber || "-"} • ${student.gender === "female" ? "Perempuan" : (student.gender === "male" ? "Laki-laki" : "-")}`
        );
        textCol.append(nameEl, subEl);

        const statsRow = createElement("div", "results-student-stats-row");
        statsRow.append(
          createElement("span", "results-stat-pill", `Asesmen selesai: ${completedCount}`),
          createElement("span", "results-stat-pill", `Pertumbuhan: ${growthCount}`),
          createElement("span", "results-stat-pill", `Observasi: ${observationCount}`),
          createElement(
            "span",
            `results-stat-pill ${latestScoreText !== "Belum ada nilai lengkap" ? "is-score-badge" : ""}`,
            `Nilai terbaru: ${latestScoreText}`
          )
        );

        const activeAcademicYearId = state.activeAcademicYearId || null;
        const activeSemesterId = state.activeSemesterId || null;
        const studentSavedReport = (state.studentReports || []).find(
          (r) =>
            r &&
            r.studentId === student.id &&
            r.classId === classRoom.id &&
            (r.academicYearId || null) === activeAcademicYearId &&
            (r.semesterId || null) === activeSemesterId &&
            r.draft
        );

        let reportStatusPill = null;
        if (classUi.batchState?.studentStatuses?.[student.id]) {
          const st = classUi.batchState.studentStatuses[student.id];
          const isOk = st.startsWith("Berhasil");
          const isSkip = st.startsWith("Dilewati");
          reportStatusPill = createElement(
            "span",
            `results-stat-pill ${isOk ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-semibold" : isSkip ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-semibold" : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 font-semibold"}`,
            st
          );
        } else if (studentSavedReport) {
          reportStatusPill = createElement("span", "results-stat-pill bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-semibold", "✨ Laporan AI Tersimpan");
        }

        if (reportStatusPill) {
          statsRow.append(reportStatusPill);
        }

        textCol.append(statsRow);

        infoRow.append(avatar, textCol);

        const actionsCol = createElement("div", "results-student-card-actions");
        const openBtn = createElement("button", "btn-tool btn-tool-primary", "Buka Rekap");
        openBtn.type = "button";
        openBtn.addEventListener("click", () => {
          openStudentReport(classRoom.id, student.id);
        });

        actionsCol.append(openBtn);
        card.append(infoRow, actionsCol);
        grid.append(card);
      });

      listContainer.append(grid);
    }

    renderCards();
  }

  function renderStudentResultsReportView(classId, studentId) {
    const classRoom = (state.classes || []).find((c) => c.id === classId);
    const student = (state.students || []).find((s) => s.id === studentId);

    if (!classRoom || !student) {
      classUi.reportStudentId = null;
      classUi.mode = "detail";
      classUi.activeTab = "reports";
      render();
      return;
    }

    // Back Button
    const backBtn = createElement("button", "btn-back-nav mb-4");
    backBtn.type = "button";
    backBtn.append(document.createTextNode("← Kembali ke Hasil & Laporan"));
    backBtn.addEventListener("click", () => {
      navigateBackFromStudentReport();
    });
    container.append(backBtn);

    // Student Header Card
    const headerCard = createElement("header", "report-student-header-card");
    const avatar = createStudentAvatar(student, 56);
    const headerMeta = createElement("div", "report-student-header-meta");
    headerMeta.append(
      createElement("h1", "screen-title text-xl", "Rekap Hasil Siswa"),
      createElement("h2", "sub-title text-lg font-bold mt-1", student.name),
      createElement(
        "p",
        "screen-copy text-sm",
        `${classRoom.name} • NIS: ${student.studentNumber || "-"} • ${student.gender === "female" ? "Perempuan" : (student.gender === "male" ? "Laki-laki" : "-")}`
      ),
      createElement(
        "p",
        "text-subtle text-xs mt-1",
        "Pilih data asesmen, pertumbuhan, dan observasi di bawah ini menggunakan checkbox sebagai sumber penyusunan laporan."
      )
    );
    headerCard.append(avatar, headerMeta);
    container.append(headerCard);

    // Track local expanded states for assessments
    const expandedAssessmentIds = new Set();
    let isPreviewOpen = false;
    let isRcJsonOpen = false;

    const activeAcademicYearId = state.activeAcademicYearId || null;
    const activeSemesterId = state.activeSemesterId || null;

    const savedReport = (state.studentReports || []).find(
      (r) =>
        r &&
        r.studentId === student.id &&
        r.classId === classId &&
        (r.academicYearId || null) === activeAcademicYearId &&
        (r.semesterId || null) === activeSemesterId
    );

    let activeReportContext = savedReport ? savedReport.reportContext : null;
    let reportAiDraft = savedReport ? savedReport.draft : null;
    let isAiDraftLoading = false;

    function persistCurrentDraft() {
      if (actions?.saveStudentReport && reportAiDraft && (activeReportContext || savedReport?.reportContext)) {
        actions.saveStudentReport({
          id: savedReport?.id,
          studentId: student.id,
          classId: classId,
          academicYearId: activeAcademicYearId,
          semesterId: activeSemesterId,
          reportContext: activeReportContext || savedReport.reportContext,
          draft: reportAiDraft
        });
      }
    }

    // Build Data Sets
    // 1. Assessments
    const studentAssessments = (state.assessmentResults || [])
      .map((r) => {
        if (r.studentId !== student.id) return null;
        const sess = (state.assessmentSessions || []).find(
          (as) => as.id === r.assessmentSessionId
        );
        if (!sess || sess.classId !== classId) return null;
        const def = (state.assessmentDefinitions || []).find(
          (d) => d.id === (sess.definitionId || r.definitionId)
        );
        return {
          result: r,
          assessmentSession: sess,
          definition: def,
          date: sess.date || r.recordedAt || ""
        };
      })
      .filter(Boolean)
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

    // 2. Growth Records
    const studentGrowth = (state.growthRecords || [])
      .filter((g) => g.studentId === student.id)
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

    // 3. Observations
    const studentObservations = (state.studentObservations || [])
      .filter((o) => o.studentId === student.id)
      .sort((a, b) => (b.recordedAt || b.date || "").localeCompare(a.recordedAt || a.date || ""));

    const PURPOSE_MAP = {
      pretest: "Pretest / Asesmen Awal",
      formative: "Harian / Formatif",
      posttest: "Posttest",
      summative: "Sumatif Materi",
      midterm: "UTS / STS",
      final: "UAS / SAS"
    };

    const OBS_TYPE_MAP = {
      umum: "Umum",
      positif: "Positif",
      evaluasi: "Evaluasi",
      cedera: "Cedera / Kondisi",
      potensi: "Potensi"
    };

    // Main Sections Container
    const sectionsWrap = createElement("div", "report-sections-wrap space-y-6 mt-6");

    // ==========================================
    // SECTION 1: HASIL ASESMEN
    // ==========================================
    const assessSection = createElement("section", "report-source-section");
    const assessHeader = createElement("div", "report-section-header");
    assessHeader.append(
      createElement("h2", "report-section-title", `Hasil Asesmen (${studentAssessments.length})`),
      createElement("span", "text-subtle text-xs", "Pilih asesmen yang ingin dimasukkan ke laporan")
    );
    assessSection.append(assessHeader);

    if (studentAssessments.length === 0) {
      assessSection.append(createElement("p", "empty-copy", "Belum ada hasil asesmen."));
    } else {
      const assessList = createElement("div", "report-source-list space-y-3 mt-3");
      studentAssessments.forEach(({ result, assessmentSession: sess, definition: def }) => {
        const isChecked = (classUi.reportSelection.assessmentSessionIds || []).includes(sess.id);
        const card = createElement("article", `report-source-card ${isChecked ? "is-selected-source" : ""}`);

        // Card Top Row
        const topRow = createElement("div", "report-card-top-row");
        
        // Left Checkbox & Title (wrapped in label for large touch target)
        const leftBox = createElement("label", "report-source-card-main");
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.className = "report-source-check mt-1";
        checkbox.checked = isChecked;
        checkbox.addEventListener("change", (e) => {
          if (e.target.checked) {
            if (!classUi.reportSelection.assessmentSessionIds.includes(sess.id)) {
              classUi.reportSelection.assessmentSessionIds.push(sess.id);
            }
          } else {
            classUi.reportSelection.assessmentSessionIds = classUi.reportSelection.assessmentSessionIds.filter(
              (id) => id !== sess.id
            );
          }
          if (e.target.checked) {
            card.classList.add("is-selected-source");
          } else {
            card.classList.remove("is-selected-source");
          }
          updateSummaryAndPreview();
        });

        const titleCol = createElement("div", "report-source-meta flex-1");
        const titleText = createElement("strong", "report-card-title text-sm", sess.title || "Asesmen PJOK");
        
        const metaRow = createElement("div", "report-card-meta-row flex flex-wrap gap-2 text-xs text-subtle mt-1");
        const purposeText = PURPOSE_MAP[sess.purpose] || sess.purpose || "Asesmen";
        metaRow.append(
          createElement("span", "badge badge-neutral text-xs", purposeText),
          createElement("span", "", `📅 ${sess.date || "-"}`),
          createElement("span", "", `📚 ${Array.isArray(sess.materials) ? sess.materials.join(", ") : (sess.materials || def?.materials || "-")}`)
        );

        titleCol.append(titleText, metaRow);
        leftBox.append(checkbox, titleCol);

        // Right Score Badge & Expand Button
        const rightCol = createElement("div", "flex flex-col items-end gap-2");
        let scoreBadge;
        if (result.numericScore !== null && result.numericScore !== undefined) {
          scoreBadge = createElement("span", "badge badge-success font-bold text-xs", `Nilai ${result.numericScore} / 100`);
        } else {
          const items = sess.itemsSnapshot || [];
          const completedCount = items.filter((it) =>
            (result.itemResults || []).some((ir) => ir.itemId === it.id && ir.rubricLevel !== null && ir.rubricLevel !== undefined && !Number.isNaN(Number(ir.rubricLevel)) && Number(ir.rubricLevel) > 0)
          ).length;
          scoreBadge = createElement("span", "badge badge-warning text-xs", `${completedCount} dari ${items.length} butir selesai`);
        }

        const detailToggleBtn = createElement("button", "btn-tool text-xs", "Lihat Detail");
        detailToggleBtn.type = "button";

        rightCol.append(scoreBadge, detailToggleBtn);
        topRow.append(leftBox, rightCol);
        card.append(topRow);

        if (result.note) {
          const generalNote = createElement("p", "text-xs text-subtle mt-2 italic bg-slate-50 dark:bg-slate-800 p-2 rounded", `Catatan Asesmen: ${result.note}`);
          card.append(generalNote);
        }

        // Expandable Detail Container
        const detailContainer = createElement("div", "report-assessment-detail report-item-detail-container mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2");
        detailContainer.style.display = expandedAssessmentIds.has(sess.id) ? "block" : "none";
        detailToggleBtn.textContent = expandedAssessmentIds.has(sess.id) ? "Tutup Detail" : "Lihat Detail";

        detailToggleBtn.addEventListener("click", () => {
          if (expandedAssessmentIds.has(sess.id)) {
            expandedAssessmentIds.delete(sess.id);
            detailContainer.style.display = "none";
            detailToggleBtn.textContent = "Lihat Detail";
          } else {
            expandedAssessmentIds.add(sess.id);
            detailContainer.style.display = "block";
            detailToggleBtn.textContent = "Tutup Detail";
          }
        });

        const items = sess.itemsSnapshot || [];
        if (items.length === 0) {
          detailContainer.append(createElement("p", "text-xs text-subtle", "Tidak ada rincian butir instrumen."));
        } else {
          items.forEach((item, itemIdx) => {
            const itemBox = createElement("div", "report-item-detail-box bg-slate-50 dark:bg-slate-800 p-3 rounded-md space-y-1 text-xs");
            const itemResult = (result.itemResults || []).find((ir) => ir.itemId === item.id);
            
            const promptRow = createElement("div", "font-medium text-slate-800 dark:text-slate-200");
            promptRow.append(
              createElement("span", "font-bold mr-1", `Pertanyaan / Instrumen (Butir ${itemIdx + 1}):`),
              document.createTextNode(item.prompt || item.title || item.question || "-")
            );
            itemBox.append(promptRow);

            const rubricScaleTotal = (item.rubricLevels || []).length || item.rubricScale || 5;
            const hasScore = itemResult?.rubricLevel !== null && itemResult?.rubricLevel !== undefined && !Number.isNaN(Number(itemResult.rubricLevel));
            
            const rubricScoreRow = createElement("div", "flex flex-col gap-1 mt-1");
            rubricScoreRow.append(
              createElement(
                "span",
                "font-semibold text-primary",
                hasScore ? `Skor Rubrik: ${itemResult.rubricLevel} / ${rubricScaleTotal}` : "Belum dinilai"
              )
            );

            if (hasScore) {
              const matchedLevel = (item.rubricLevels || []).find(
                (lvl) => Number(lvl.level) === Number(itemResult.rubricLevel)
              );
              if (matchedLevel?.desc) {
                const descP = createElement("p", "text-subtle text-xs pl-2 border-l-2 border-primary", `Deskripsi: ${matchedLevel.desc}`);
                rubricScoreRow.append(descP);
              }
            }
            itemBox.append(rubricScoreRow);

            if (itemResult?.note && itemResult.note.trim()) {
              itemBox.append(createElement("p", "text-subtle text-xs mt-1", `Catatan Guru: ${itemResult.note}`));
            }

            detailContainer.append(itemBox);
          });
        }

        card.append(detailContainer);
        assessList.append(card);
      });
      assessSection.append(assessList);
    }
    sectionsWrap.append(assessSection);

    // ==========================================
    // SECTION 2: PERTUMBUHAN
    // ==========================================
    const growthSection = createElement("section", "report-source-section");
    const growthHeader = createElement("div", "report-section-header");
    growthHeader.append(
      createElement("h2", "report-section-title", `Pertumbuhan (${studentGrowth.length})`),
      createElement("span", "text-subtle text-xs", "Pilih data fisik / antropometri yang relevan")
    );
    growthSection.append(growthHeader);

    if (studentGrowth.length === 0) {
      growthSection.append(createElement("p", "empty-copy", "Belum ada data pertumbuhan."));
    } else {
      const growthList = createElement("div", "report-source-list space-y-2 mt-3");
      studentGrowth.forEach((g) => {
        const isChecked = (classUi.reportSelection.growthRecordIds || []).includes(g.id);
        const card = createElement("article", `report-source-card ${isChecked ? "is-selected-source" : ""}`);

        const row = createElement("div", "flex items-center justify-between gap-3");
        const leftBox = createElement("label", "report-source-card-main report-source-card-main-center");
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.className = "report-source-check";
        checkbox.checked = isChecked;
        checkbox.addEventListener("change", (e) => {
          if (e.target.checked) {
            if (!classUi.reportSelection.growthRecordIds.includes(g.id)) {
              classUi.reportSelection.growthRecordIds.push(g.id);
            }
          } else {
            classUi.reportSelection.growthRecordIds = classUi.reportSelection.growthRecordIds.filter(
              (id) => id !== g.id
            );
          }
          if (e.target.checked) {
            card.classList.add("is-selected-source");
          } else {
            card.classList.remove("is-selected-source");
          }
          updateSummaryAndPreview();
        });

        const textWrap = createElement("div", "report-source-meta");
        textWrap.append(
          createElement("strong", "text-sm", `📅 ${g.date || "-"}`),
          createElement(
            "p",
            "text-xs text-subtle mt-0.5",
            `Tinggi: ${g.heightCm ? `${g.heightCm} cm` : "-"} • Berat: ${g.weightKg ? `${g.weightKg} kg` : "-"}`
          )
        );

        leftBox.append(checkbox, textWrap);
        row.append(leftBox);
        card.append(row);

        if (g.note) {
          card.append(createElement("p", "text-xs text-subtle mt-1.5 italic", `Catatan: ${g.note}`));
        }

        growthList.append(card);
      });
      growthSection.append(growthList);

      const docPanel = createElement("details", "mt-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-lg text-xs p-3 cursor-pointer");
      const docSummary = createElement("summary", "font-semibold text-slate-700 dark:text-slate-300 focus:outline-none", "Dasar Analisis Pertumbuhan");
      
      const docContent = createElement("div", "mt-2 space-y-2 text-subtle text-xs cursor-default");
      docContent.innerHTML = `
        <p><strong>Data yang digunakan:</strong></p>
        <ul class="list-disc pl-4 space-y-1">
          <li>Tanggal lahir</li>
          <li>Jenis kelamin</li>
          <li>Tanggal pengukuran</li>
          <li>Tinggi badan</li>
          <li>Berat badan</li>
        </ul>
        <p class="mt-2"><strong>Keterangan perhitungan:</strong></p>
        <ul class="list-disc pl-4 space-y-1">
          <li>BMI dihitung dari perbandingan berat badan dan tinggi badan kuadrat.</li>
          <li>Usia siswa dihitung secara presisi pada tanggal pengukuran (bukan usia hari ini).</li>
          <li>Tren berasal dari perbandingan hasil pengukuran terbaru dengan sebelumnya.</li>
          <li>Tahap pemantauan ini belum menentukan diagnosis atau status medis klinis apa pun.</li>
        </ul>
      `;
      docPanel.append(docSummary, docContent);
      growthSection.append(docPanel);
    }
    sectionsWrap.append(growthSection);

    // ==========================================
    // SECTION 3: SIKAP & OBSERVASI
    // ==========================================
    const obsSection = createElement("section", "report-source-section");
    const obsHeader = createElement("div", "report-section-header");
    obsHeader.append(
      createElement("h2", "report-section-title", `Sikap & Observasi (${studentObservations.length})`),
      createElement("span", "text-subtle text-xs", "Pilih catatan perilaku, kerja sama, dan catatan khusus")
    );
    obsSection.append(obsHeader);

    if (studentObservations.length === 0) {
      obsSection.append(createElement("p", "empty-copy", "Belum ada observasi siswa."));
    } else {
      const obsList = createElement("div", "report-source-list space-y-2 mt-3");
      studentObservations.forEach((o) => {
        const isChecked = (classUi.reportSelection.observationIds || []).includes(o.id);
        const card = createElement("article", `report-source-card ${isChecked ? "is-selected-source" : ""}`);

        const row = createElement("div", "flex items-start justify-between gap-3");
        const leftBox = createElement("label", "report-source-card-main");
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.className = "report-source-check mt-1";
        checkbox.checked = isChecked;
        checkbox.addEventListener("change", (e) => {
          if (e.target.checked) {
            if (!classUi.reportSelection.observationIds.includes(o.id)) {
              classUi.reportSelection.observationIds.push(o.id);
            }
          } else {
            classUi.reportSelection.observationIds = classUi.reportSelection.observationIds.filter(
              (id) => id !== o.id
            );
          }
          if (e.target.checked) {
            card.classList.add("is-selected-source");
          } else {
            card.classList.remove("is-selected-source");
          }
          updateSummaryAndPreview();
        });

        const typeLabel = OBS_TYPE_MAP[o.type] || o.type || "Observasi";
        const contentWrap = createElement("div", "report-source-meta flex-1 text-xs");
        const metaLine = createElement("div", "flex items-center gap-2 mb-1");
        metaLine.append(
          createElement("span", "badge badge-neutral text-xs", typeLabel),
          createElement("span", "text-subtle", `📅 ${o.date || (o.recordedAt ? o.recordedAt.slice(0, 10) : "-")}`)
        );
        const textP = createElement("p", "text-slate-800 dark:text-slate-200 mt-1", o.text || "-");

        contentWrap.append(metaLine, textP);
        leftBox.append(checkbox, contentWrap);
        row.append(leftBox);
        card.append(row);

        obsList.append(card);
      });
      obsSection.append(obsList);
    }
    sectionsWrap.append(obsSection);

    container.append(sectionsWrap);

    // ==========================================
    // SECTION 4: REPORT SOURCE SUMMARY & PREVIEW
    // ==========================================
    const summaryPanel = createElement("section", "report-summary-panel report-selected-summary mt-8");
    const summaryHeader = createElement("div", "report-summary-header");
    summaryHeader.append(
      createElement("h2", "sub-title font-bold text-sm", "Data Terpilih untuk Laporan"),
      createElement("span", "text-subtle text-xs", "Rekap sumber data yang telah dicentang")
    );
    summaryPanel.append(summaryHeader);

    const summaryCountP = createElement("p", "report-summary-count-text text-sm font-medium mt-2");
    summaryPanel.append(summaryCountP);

    // Action buttons row
    const btnRow = createElement("div", "report-summary-btn-row flex flex-wrap gap-3 mt-4 items-center");
    
    const previewToggleBtn = createElement("button", "btn-tool text-xs", "Lihat Data Terpilih");
    previewToggleBtn.type = "button";

    const aiReportBtn = createElement("button", "primary-action compact-action", "✨ Buat Laporan AI");
    aiReportBtn.type = "button";

    btnRow.append(previewToggleBtn, aiReportBtn);
    summaryPanel.append(btnRow);

    const aiHelperText = createElement("p", "text-subtle text-xs mt-2");
    summaryPanel.append(aiHelperText);

    // Preview Container
    const previewContainer = createElement("div", "report-preview-container report-preview-panel mt-4 pt-4 border-t border-slate-200 dark:border-slate-800");
    summaryPanel.append(previewContainer);

    // AI Report Draft Container
    const aiDraftContainer = createElement("section", "report-ai-draft-container");
    aiDraftContainer.style.display = "none";

    function updateSummaryAndPreview() {
      let storedApiKey = "";
      try {
        storedApiKey = window.sessionStorage.getItem("pjok_gemini_api_key") || "";
      } catch (_) {}

      const aCount = (classUi.reportSelection.assessmentSessionIds || []).length;
      const gCount = (classUi.reportSelection.growthRecordIds || []).length;
      const oCount = (classUi.reportSelection.observationIds || []).length;
      const totalCount = aCount + gCount + oCount;

      if (totalCount > 0) {
        const parts = [];
        if (aCount > 0) parts.push(`${aCount} asesmen`);
        if (gCount > 0) parts.push(`${gCount} pengukuran pertumbuhan`);
        if (oCount > 0) parts.push(`${oCount} observasi`);
        summaryCountP.textContent = parts.join(", ") || `${aCount} asesmen, ${gCount} pengukuran pertumbuhan, ${oCount} observasi`;
        previewToggleBtn.disabled = false;
        previewToggleBtn.classList.remove("opacity-50", "cursor-not-allowed");
      } else {
        summaryCountP.textContent = "Belum ada data yang dipilih.";
        previewToggleBtn.disabled = true;
        previewToggleBtn.classList.add("opacity-50", "cursor-not-allowed");
        isPreviewOpen = false;
      }

      previewToggleBtn.textContent = isPreviewOpen ? "Tutup Preview Data Terpilih" : "Lihat Data Terpilih";
      renderPreviewContent();

      const hasApiKey = Boolean(storedApiKey && storedApiKey.trim());

      const canGenerate = totalCount > 0 && hasApiKey && !isAiDraftLoading;

      aiReportBtn.disabled = !canGenerate;
      if (canGenerate) {
        aiReportBtn.classList.remove("opacity-60", "cursor-not-allowed");
      } else {
        aiReportBtn.classList.add("opacity-60", "cursor-not-allowed");
      }

      if (isAiDraftLoading) {
        aiHelperText.textContent = "✨ AI sedang menyusun draf narasi laporan...";
        aiHelperText.className = "text-primary text-xs mt-2 font-medium";
      } else if (!hasApiKey) {
        aiHelperText.textContent = "AI belum dikonfigurasi. Atur Gemini API Key di Pengaturan → AI.";
        aiHelperText.className = "text-amber-600 dark:text-amber-400 text-xs mt-2";
      } else if (totalCount === 0) {
        aiHelperText.textContent = "Pilih minimal satu sumber data untuk membuat laporan AI.";
        aiHelperText.className = "text-subtle text-xs mt-2";
      } else {
        aiHelperText.textContent = "Siap membuat draf laporan AI berdasarkan sumber data terpilih.";
        aiHelperText.className = "text-emerald-600 dark:text-emerald-400 text-xs mt-2";
      }
    }

    function renderPreviewContent() {
      previewContainer.replaceChildren();

      const aCount = (classUi.reportSelection.assessmentSessionIds || []).length;
      const gCount = (classUi.reportSelection.growthRecordIds || []).length;
      const oCount = (classUi.reportSelection.observationIds || []).length;
      const totalCount = aCount + gCount + oCount;

      if (!isPreviewOpen || totalCount === 0) {
        previewContainer.style.display = "none";
        return;
      }

      previewContainer.style.display = "block";

      const previewTitle = createElement("h3", "font-bold text-xs uppercase tracking-wider text-subtle mb-3", `Preview Sumber Data Terpilih (${totalCount} item)`);
      previewContainer.append(previewTitle);

      const previewList = createElement("div", "space-y-4");

      // 1. Selected Assessments Preview
      const selectedAssessments = studentAssessments.filter(({ assessmentSession: sess }) =>
        (classUi.reportSelection.assessmentSessionIds || []).includes(sess.id)
      );
      if (selectedAssessments.length > 0) {
        const box = createElement("div", "preview-block bg-slate-50 dark:bg-slate-800/60 p-3 rounded-lg space-y-2");
        box.append(createElement("h4", "font-semibold text-xs text-primary", `Asesmen (${selectedAssessments.length}):`));
        const list = createElement("ul", "space-y-1.5 text-xs pl-2");
        selectedAssessments.forEach(({ result, assessmentSession: sess, definition: def }) => {
          const li = createElement("li", "border-b border-slate-200 dark:border-slate-700 pb-1 last:border-b-0");
          const scoreStr = result.numericScore !== null && result.numericScore !== undefined
            ? `Nilai ${result.numericScore} / 100`
            : "Progres belum lengkap";
          const purpose = PURPOSE_MAP[sess.purpose] || sess.purpose || "Asesmen";
          const mat = Array.isArray(sess.materials) ? sess.materials.join(", ") : (sess.materials || def?.materials || "-");
          li.append(
            createElement("strong", "", sess.title),
            document.createTextNode(` • 📅 ${sess.date || "-"} • ${purpose} • ${scoreStr} • Materi: ${mat}`)
          );
          list.append(li);
        });
        box.append(list);
        previewList.append(box);
      }

      // 2. Selected Growth Preview
      const selectedGrowth = studentGrowth.filter((g) =>
        (classUi.reportSelection.growthRecordIds || []).includes(g.id)
      );
      if (selectedGrowth.length > 0) {
        const box = createElement("div", "preview-block bg-slate-50 dark:bg-slate-800/60 p-3 rounded-lg space-y-2");
        box.append(createElement("h4", "font-semibold text-xs text-primary", `Pertumbuhan (${selectedGrowth.length}):`));
        const list = createElement("ul", "space-y-1 text-xs pl-2");
        selectedGrowth.forEach((g) => {
          const li = createElement("li");
          li.append(
            createElement("strong", "", `📅 ${g.date || "-"}: `),
            document.createTextNode(`Tinggi ${g.heightCm || "-"} cm, Berat ${g.weightKg || "-"} kg`)
          );
          list.append(li);
        });
        box.append(list);
        previewList.append(box);
      }

      // 3. Selected Observations Preview
      const selectedObs = studentObservations.filter((o) =>
        (classUi.reportSelection.observationIds || []).includes(o.id)
      );
      if (selectedObs.length > 0) {
        const box = createElement("div", "preview-block bg-slate-50 dark:bg-slate-800/60 p-3 rounded-lg space-y-2");
        box.append(createElement("h4", "font-semibold text-xs text-primary", `Observasi & Sikap (${selectedObs.length}):`));
        const list = createElement("ul", "space-y-1.5 text-xs pl-2");
        selectedObs.forEach((o) => {
          const li = createElement("li", "border-b border-slate-200 dark:border-slate-700 pb-1 last:border-b-0");
          const typeLabel = OBS_TYPE_MAP[o.type] || o.type || "Observasi";
          const dateStr = o.date || (o.recordedAt ? o.recordedAt.slice(0, 10) : "-");
          li.append(
            createElement("strong", "", `[${typeLabel}] 📅 ${dateStr}: `),
            document.createTextNode(o.text || "-")
          );
          list.append(li);
        });
        box.append(list);
        previewList.append(box);
      }

      previewContainer.append(previewList);

      // 4. ReportContext JSON Preview Section
      const reportContext = buildSelectedReportContext({
        student,
        classRoom,
        assessmentSelections: selectedAssessments,
        growthSelections: selectedGrowth,
        observationSelections: selectedObs,
        allGrowthRecords: state.growthRecords || []
      });

      const rcSection = createElement("div", "report-context-section mt-4 pt-3 border-t border-slate-200 dark:border-slate-700");
      const rcToggleBtn = createElement("button", "btn-tool text-xs flex items-center gap-1", isRcJsonOpen ? "Sembunyikan ReportContext" : "Lihat ReportContext");
      rcToggleBtn.type = "button";

      const rcJsonBox = createElement("div", "report-context-json-box mt-2 p-3 bg-slate-900 text-slate-100 rounded-lg text-xs font-mono overflow-auto max-h-96");
      rcJsonBox.style.display = isRcJsonOpen ? "block" : "none";
      
      const rcTitle = createElement("h4", "font-bold text-xs uppercase tracking-wider text-slate-400 mb-2", "Preview ReportContext");
      const pre = document.createElement("pre");
      const code = document.createElement("code");
      code.textContent = JSON.stringify(reportContext, null, 2);
      pre.append(code);
      rcJsonBox.append(rcTitle, pre);

      rcToggleBtn.addEventListener("click", () => {
        isRcJsonOpen = !isRcJsonOpen;
        rcToggleBtn.textContent = isRcJsonOpen ? "Sembunyikan ReportContext" : "Lihat ReportContext";
        rcJsonBox.style.display = isRcJsonOpen ? "block" : "none";
      });

      rcSection.append(rcToggleBtn, rcJsonBox);
      previewContainer.append(rcSection);
    }

    function renderAiDraftContent() {
      aiDraftContainer.replaceChildren();

      if (isAiDraftLoading) {
        aiDraftContainer.style.display = "block";
        const loadingCard = createElement("div", "p-6 text-center space-y-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700");
        loadingCard.append(
          createElement("div", "font-bold text-primary text-sm", "✨ AI sedang menyusun draf narasi laporan..."),
          createElement("p", "text-xs text-subtle", "Menginterpretasikan capaian asesmen, data pertumbuhan fisik, dan observasi sikap siswa...")
        );
        aiDraftContainer.append(loadingCard);
        return;
      }

      if (!reportAiDraft) {
        aiDraftContainer.style.display = "none";
        return;
      }

      aiDraftContainer.style.display = "block";

      // Header
      const draftHeader = createElement("div", "report-ai-draft-header flex items-center justify-between flex-wrap gap-2");
      const leftHeader = createElement("div");
      const titleEl = createElement("h3", "sub-title font-bold text-base flex items-center gap-2");
      titleEl.append(
        document.createTextNode("Draf Narasi Laporan AI"),
        createElement("span", "report-ai-badge", "DRAFT")
      );
      leftHeader.append(
        titleEl,
        createElement("p", "text-subtle text-xs mt-0.5", "Hasil interpretasi data oleh AI. Guru dapat mengedit seluruh teks di bawah ini.")
      );
      draftHeader.append(leftHeader);
      aiDraftContainer.append(draftHeader);

      const sectionsList = createElement("div", "space-y-4");

      // 1. Ringkasan
      const summaryBox = createElement("div", "report-ai-draft-section space-y-2");
      const summaryLabel = createElement("label", "block font-semibold text-xs text-slate-800 dark:text-slate-200", "1. Ringkasan");
      const summaryTextarea = document.createElement("textarea");
      summaryTextarea.className = "input-text text-xs w-full";
      summaryTextarea.rows = 3;
      summaryTextarea.value = reportAiDraft.summary || "";
      summaryTextarea.placeholder = "Tuliskan ringkasan perkembangan umum siswa...";
      summaryTextarea.addEventListener("input", (e) => {
        reportAiDraft.summary = e.target.value;
        persistCurrentDraft();
      });
      summaryBox.append(summaryLabel, summaryTextarea);
      sectionsList.append(summaryBox);

      // 2. Hasil Belajar
      const currentSelectedAssessments = studentAssessments.filter(({ assessmentSession: sess }) =>
        (classUi.reportSelection.assessmentSessionIds || []).includes(sess.id)
      );
      const currentSelectedGrowth = studentGrowth.filter((g) =>
        (classUi.reportSelection.growthRecordIds || []).includes(g.id)
      );
      const currentSelectedObs = studentObservations.filter((o) =>
        (classUi.reportSelection.observationIds || []).includes(o.id)
      );

      const currentContext = activeReportContext || savedReport?.reportContext || buildSelectedReportContext({
        student,
        classRoom,
        assessmentSelections: currentSelectedAssessments,
        growthSelections: currentSelectedGrowth,
        observationSelections: currentSelectedObs,
        allGrowthRecords: state.growthRecords || []
      });

      const {
        learning: isLearningActive,
        understanding: isUnderstandingActive,
        attitude: isAttitudeActive,
        growth: isGrowthActive
      } = currentContext.selectedSections || {};

      if (isLearningActive) {
        const validLearningItems = (reportAiDraft.learning || [])
          .map((item) => {
            const matchSource = (currentContext.assessments || []).find(
              (a) => a.assessmentSessionId === item.assessmentSessionId
            );
            if (!matchSource) return null;
            return { item, matchSource };
          })
          .filter(Boolean);

        const learningBox = createElement("div", "report-ai-draft-section space-y-3");
        learningBox.append(
          createElement("label", "block font-semibold text-xs text-slate-800 dark:text-slate-200", `2. Hasil Belajar (${validLearningItems.length})`)
        );

        if (validLearningItems.length === 0) {
          learningBox.append(createElement("p", "empty-copy text-xs", "Belum ada capaian hasil belajar dari asesmen terpilih."));
        } else {
          validLearningItems.forEach(({ item, matchSource }) => {
            const itemCard = createElement("div", "report-ai-learning-card space-y-2");
            
            const itemHeader = createElement("div", "flex items-center justify-between gap-2");
            const titleEl = createElement("strong", "text-xs text-slate-900 dark:text-slate-100 flex-1", matchSource.title || "Asesmen PJOK");

            const scoreText =
              matchSource.numericScore !== null && matchSource.numericScore !== undefined
                ? `Nilai: ${matchSource.numericScore}`
                : "Belum ada nilai final";

            const scoreBadge = createElement(
              "span",
              "badge badge-success text-xs font-bold whitespace-nowrap",
              scoreText
            );

            itemHeader.append(titleEl, scoreBadge);

            const descTextarea = document.createElement("textarea");
            descTextarea.className = "input-text text-xs w-full";
            descTextarea.rows = 3;
            descTextarea.value = item.description || "";
            descTextarea.placeholder = "Deskripsi capaian belajar siswa...";
            descTextarea.addEventListener("input", (e) => {
              item.description = e.target.value;
              persistCurrentDraft();
            });

            itemCard.append(itemHeader, descTextarea);
            learningBox.append(itemCard);
          });
        }
        sectionsList.append(learningBox);
      }

      // 3. Pemahaman
      if (isUnderstandingActive) {
        const understandBox = createElement("div", "report-ai-draft-section space-y-2");
        const understandLabel = createElement("label", "block font-semibold text-xs text-slate-800 dark:text-slate-200", "3. Pemahaman");
        const understandTextarea = document.createElement("textarea");
        understandTextarea.className = "input-text text-xs w-full";
        understandTextarea.rows = 3;
        understandTextarea.value = reportAiDraft.understanding || "";
        understandTextarea.placeholder = "Deskripsi pemahaman konsep materi...";
        understandTextarea.addEventListener("input", (e) => {
          reportAiDraft.understanding = e.target.value;
          persistCurrentDraft();
        });
        understandBox.append(understandLabel, understandTextarea);
        sectionsList.append(understandBox);
      }

      // 4. Sikap
      if (isAttitudeActive) {
        const attitudeBox = createElement("div", "report-ai-draft-section space-y-2");
        const attitudeLabel = createElement("label", "block font-semibold text-xs text-slate-800 dark:text-slate-200", "4. Sikap");
        const attitudeTextarea = document.createElement("textarea");
        attitudeTextarea.className = "input-text text-xs w-full";
        attitudeTextarea.rows = 3;
        attitudeTextarea.value = reportAiDraft.attitude || "";
        attitudeTextarea.placeholder = "Deskripsi sikap dan partisipasi siswa...";
        attitudeTextarea.addEventListener("input", (e) => {
          reportAiDraft.attitude = e.target.value;
          persistCurrentDraft();
        });
        attitudeBox.append(attitudeLabel, attitudeTextarea);
        sectionsList.append(attitudeBox);
      }

      // 5. Pertumbuhan
      if (isGrowthActive) {
        const growthBox = createElement("div", "report-ai-draft-section space-y-2");
        const growthLabel = createElement("label", "block font-semibold text-xs text-slate-800 dark:text-slate-200", "5. Pertumbuhan");
        const growthTextarea = document.createElement("textarea");
        growthTextarea.className = "input-text text-xs w-full";
        growthTextarea.rows = 3;
        growthTextarea.value = reportAiDraft.growth || "";
        growthTextarea.placeholder = "Deskripsi pertumbuhan fisik siswa...";
        growthTextarea.addEventListener("input", (e) => {
          reportAiDraft.growth = e.target.value;
          persistCurrentDraft();
        });
        growthBox.append(growthLabel, growthTextarea);
        sectionsList.append(growthBox);
      }

      // 6. Aktivitas di Rumah
      const homeBox = createElement("div", "report-ai-draft-section space-y-2");
      const homeLabel = createElement("label", "block font-semibold text-xs text-slate-800 dark:text-slate-200", "6. Aktivitas di Rumah");
      const homeTextarea = document.createElement("textarea");
      homeTextarea.className = "input-text text-xs w-full";
      homeTextarea.rows = 3;
      homeTextarea.value = reportAiDraft.homeActivity || "";
      homeTextarea.placeholder = "Rekomendasi aktivitas gerak di rumah...";
      homeTextarea.addEventListener("input", (e) => {
        reportAiDraft.homeActivity = e.target.value;
        persistCurrentDraft();
      });
      homeBox.append(homeLabel, homeTextarea);
      sectionsList.append(homeBox);

      // 7. Saran Makanan
      if (isGrowthActive) {
        const nutritionBox = createElement("div", "report-ai-draft-section space-y-2");
        const nutritionLabel = createElement("label", "block font-semibold text-xs text-slate-800 dark:text-slate-200", "7. Saran Makanan");
        const nutritionTextarea = document.createElement("textarea");
        nutritionTextarea.className = "input-text text-xs w-full";
        nutritionTextarea.rows = 3;
        nutritionTextarea.value = reportAiDraft.nutritionAdvice || "";
        nutritionTextarea.placeholder = "Saran makanan sehat dan kebiasaan gizi...";
        nutritionTextarea.addEventListener("input", (e) => {
          reportAiDraft.nutritionAdvice = e.target.value;
          persistCurrentDraft();
        });
        nutritionBox.append(nutritionLabel, nutritionTextarea);
        sectionsList.append(nutritionBox);
      }

      // 8. Tindak Lanjut
      if (isGrowthActive) {
        const followUpBox = createElement("div", "report-ai-draft-section space-y-2");
        const followUpLabel = createElement("label", "block font-semibold text-xs text-slate-800 dark:text-slate-200", "8. Tindak Lanjut");
        const followUpTextarea = document.createElement("textarea");
        followUpTextarea.className = "input-text text-xs w-full";
        followUpTextarea.rows = 3;
        followUpTextarea.value = reportAiDraft.followUp || "";
        followUpTextarea.placeholder = "Rencana tindak lanjut bimbingan guru...";
        followUpTextarea.addEventListener("input", (e) => {
          reportAiDraft.followUp = e.target.value;
          persistCurrentDraft();
        });
        followUpBox.append(followUpLabel, followUpTextarea);
        sectionsList.append(followUpBox);
      }

      // Final Action Bar for 1-Page A4 Preview
      const finalActionPanel = createElement("div", "mt-6 pt-4 border-t border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl");
      const finalNote = createElement("p", "text-xs text-subtle flex-1", "💡 Setelah memeriksa dan mengedit narasi di atas, klik 'Lihat Laporan Akhir' untuk membuka pratinjau dokumen 1 lembar A4 dan mengunduh PDF.");
      
      const openFinalReportBtn = createElement("button", "primary-action flex items-center gap-2 text-sm font-bold");
      openFinalReportBtn.type = "button";
      openFinalReportBtn.append(ICONS.book(16), document.createTextNode("Lihat Laporan Akhir"));

      openFinalReportBtn.addEventListener("click", () => {
        openFinalReportPreviewModal();
      });

      finalActionPanel.append(finalNote, openFinalReportBtn);
      sectionsList.append(finalActionPanel);

      aiDraftContainer.append(sectionsList);
    }

    function openFinalReportPreviewModal() {
      const currentSelectedAssessments = studentAssessments.filter(({ assessmentSession: sess }) =>
        (classUi.reportSelection.assessmentSessionIds || []).includes(sess.id)
      );
      const currentSelectedGrowth = studentGrowth.filter((g) =>
        (classUi.reportSelection.growthRecordIds || []).includes(g.id)
      );
      const currentSelectedObs = studentObservations.filter((o) =>
        (classUi.reportSelection.observationIds || []).includes(o.id)
      );

      const currentContext = activeReportContext || savedReport?.reportContext || buildSelectedReportContext({
        student,
        classRoom,
        assessmentSelections: currentSelectedAssessments,
        growthSelections: currentSelectedGrowth,
        observationSelections: currentSelectedObs,
        allGrowthRecords: state.growthRecords || []
      });

      const a4Paper = createFinalReportPage({
        student,
        classRoom,
        draft: reportAiDraft,
        reportContext: currentContext,
        school: state.school || { name: state.schoolName, address: state.schoolAddress }
      });
      a4Paper.id = "a4-report-preview-document";

      const modalBackdrop = createElement("div", "final-report-modal-backdrop");
      const modalCard = createElement("div", "final-report-modal-card");

      // Modal Header Toolbar
      const modalToolbar = createElement("div", "modal-header-row mb-3 border-b pb-3 flex items-center justify-between gap-3");
      const toolbarLeft = createElement("div", "flex items-center gap-2");
      toolbarLeft.append(
        createElement("h2", "modal-title text-base font-bold", "Preview Laporan Final (1 Halaman A4)"),
        createElement("span", "report-ai-badge text-xs", "SIAP CETAK")
      );

      const toolbarRight = createElement("div", "flex items-center gap-2");
      
      const downloadPdfBtn = createElement("button", "primary-action compact-action font-bold text-xs flex items-center gap-1.5");
      downloadPdfBtn.type = "button";
      downloadPdfBtn.append(document.createTextNode("📥 Unduh PDF"));

      const closeBtn = createElement("button", "modal-close-btn text-base", "✕");
      closeBtn.type = "button";

      toolbarRight.append(downloadPdfBtn, closeBtn);
      modalToolbar.append(toolbarLeft, toolbarRight);
      modalCard.append(modalToolbar);

      // A4 Preview Viewport & Scaler for Mobile Responsiveness
      const previewViewport = createElement("div", "a4-preview-viewport");
      const previewScaler = createElement("div", "a4-preview-scaler");
      previewScaler.id = "a4-preview-scaler";

      previewScaler.append(a4Paper);
      previewViewport.append(previewScaler);
      modalCard.append(previewViewport);
      modalBackdrop.append(modalCard);
      document.body.append(modalBackdrop);

      let isExportingPdf = false;

      function updatePreviewScale() {
        if (!a4Paper || !previewViewport || !previewScaler || isExportingPdf) return;
        const availableWidth = previewViewport.clientWidth;
        const paperWidth = a4Paper.offsetWidth || 794;
        const paperHeight = a4Paper.offsetHeight || 1123;

        if (availableWidth > 0 && availableWidth < paperWidth) {
          const scale = availableWidth / paperWidth;
          previewScaler.style.transform = `scale(${scale})`;
          previewScaler.style.transformOrigin = "top center";
          previewScaler.style.width = `${paperWidth}px`;
          previewScaler.style.height = `${paperHeight}px`;
          previewViewport.style.height = `${Math.ceil(paperHeight * scale + 8)}px`;
        } else {
          previewScaler.style.transform = "none";
          previewScaler.style.width = "auto";
          previewScaler.style.height = "auto";
          previewViewport.style.height = "auto";
        }
      }

      // Verify whether content exceeds the actual A4 element height and apply compact mode if needed
      requestAnimationFrame(() => {
        // 1. remove a4-compact first
        a4Paper.classList.remove("a4-compact");

        // 2. measure content against actual A4 element height
        if (a4Paper.scrollHeight > a4Paper.clientHeight) {
          // 3. if content exceeds the A4 element height, add a4-compact
          a4Paper.classList.add("a4-compact");
          // 4. measure again
          void a4Paper.scrollHeight;
        }

        // 5. scale visually for mobile viewport
        updatePreviewScale();
      });

      const onResize = () => {
        requestAnimationFrame(updatePreviewScale);
      };
      window.addEventListener("resize", onResize);

      const closeModal = () => {
        window.removeEventListener("resize", onResize);
        modalBackdrop.remove();
      };

      closeBtn.addEventListener("click", closeModal);
      modalBackdrop.addEventListener("click", (e) => {
        if (e.target === modalBackdrop) {
          closeModal();
        }
      });

      // Download PDF Handler
      downloadPdfBtn.addEventListener("click", () => {
        const cleanStudentName = (student?.name || "Siswa").replace(/[^a-zA-Z0-9]/g, "_");
        const formattedDateKey = new Date().toISOString().slice(0, 10);
        const pdfFilename = `Laporan_PJOK_${cleanStudentName}_${formattedDateKey}.pdf`;

        if (!window.html2pdf) {
          window.alert("Mesin PDF belum tersedia. Muat ulang aplikasi lalu coba lagi.");
          return;
        }

        downloadPdfBtn.disabled = true;
        downloadPdfBtn.textContent = "⏳ Memproses PDF...";

        isExportingPdf = true;
        const prevTransform = previewScaler.style.transform;
        const prevViewportHeight = previewViewport.style.height;
        const prevScalerWidth = previewScaler.style.width;
        const prevScalerHeight = previewScaler.style.height;

        // Reset visual transform during PDF export so html2pdf renders unscaled 210mm A4
        previewScaler.style.transform = "none";
        previewScaler.style.width = "auto";
        previewScaler.style.height = "auto";
        previewViewport.style.height = "auto";

        const opt = {
          margin: 0,
          filename: pdfFilename,
          image: {
            type: "jpeg",
            quality: 0.98
          },
          html2canvas: {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: "#ffffff"
          },
          jsPDF: {
            unit: "mm",
            format: "a4",
            orientation: "portrait"
          },
          pagebreak: {
            mode: ["avoid-all", "css", "legacy"]
          }
        };

        window.html2pdf().set(opt).from(a4Paper).save().then(() => {
          downloadPdfBtn.disabled = false;
          downloadPdfBtn.textContent = "📥 Unduh PDF";
        }).catch((pdfErr) => {
          console.error("[PDF GENERATION ERROR]", pdfErr);
          downloadPdfBtn.disabled = false;
          downloadPdfBtn.textContent = "📥 Unduh PDF";
          window.alert("PDF gagal dibuat. Silakan coba kembali.");
        }).finally(() => {
          isExportingPdf = false;
          previewScaler.style.transform = prevTransform;
          previewScaler.style.width = prevScalerWidth;
          previewScaler.style.height = prevScalerHeight;
          previewViewport.style.height = prevViewportHeight;
        });
      });
    }

    aiReportBtn.addEventListener("click", async () => {
      let currentApiKey = "";
      try {
        currentApiKey = window.sessionStorage.getItem("pjok_gemini_api_key") || "";
      } catch (_) {}

      if (!currentApiKey || !currentApiKey.trim()) {
        updateSummaryAndPreview();
        return;
      }

      const selectedAssessments = studentAssessments.filter(({ assessmentSession: sess }) =>
        (classUi.reportSelection.assessmentSessionIds || []).includes(sess.id)
      );
      const selectedGrowth = studentGrowth.filter((g) =>
        (classUi.reportSelection.growthRecordIds || []).includes(g.id)
      );
      const selectedObs = studentObservations.filter((o) =>
        (classUi.reportSelection.observationIds || []).includes(o.id)
      );

      if (selectedAssessments.length + selectedGrowth.length + selectedObs.length === 0) {
        window.alert("Pilih minimal satu sumber data (asesmen, pertumbuhan, atau observasi).");
        return;
      }

      const reportContext = buildSelectedReportContext({
        student,
        classRoom,
        assessmentSelections: selectedAssessments,
        growthSelections: selectedGrowth,
        observationSelections: selectedObs,
        allGrowthRecords: state.growthRecords || []
      });

      isAiDraftLoading = true;
      aiReportBtn.disabled = true;
      aiReportBtn.textContent = "✨ Menyusun Laporan AI...";
      updateSummaryAndPreview();
      renderAiDraftContent();

      try {
        const draft = await generateStudentReportWithAI({
          apiKey: currentApiKey,
          reportContext
        });
        reportAiDraft = draft;
        activeReportContext = reportContext;
        if (!classUi.reportDrafts) classUi.reportDrafts = {};
        classUi.reportDrafts[student.id] = draft;

        if (actions?.saveStudentReport) {
          actions.saveStudentReport({
            studentId: student.id,
            classId: classRoom.id,
            academicYearId: state.activeAcademicYearId || null,
            semesterId: state.activeSemesterId || null,
            reportContext,
            draft
          });
        }
      } catch (err) {
        console.error("[AI REPORT GENERATION ERROR]", err);
        if (err?.isApiKeyError || (err?.message && (err.message.includes("API key") || err.message.includes("API_KEY")))) {
          window.alert("Periksa Gemini API Key di Pengaturan → AI.");
        } else {
          const message = err?.message || "Gagal membuat laporan AI";
          window.alert(`Pembuatan laporan AI gagal.\n\nDetail: ${message}`);
        }
      } finally {
        isAiDraftLoading = false;
        aiReportBtn.textContent = "✨ Buat Laporan AI";
        updateSummaryAndPreview();
        renderAiDraftContent();
      }
    });

    previewToggleBtn.addEventListener("click", () => {
      const aCount = (classUi.reportSelection.assessmentSessionIds || []).length;
      const gCount = (classUi.reportSelection.growthRecordIds || []).length;
      const oCount = (classUi.reportSelection.observationIds || []).length;
      if (aCount + gCount + oCount === 0) return;
      isPreviewOpen = !isPreviewOpen;
      updateSummaryAndPreview();
    });

    updateSummaryAndPreview();
    renderAiDraftContent();
    container.append(summaryPanel, aiDraftContainer);
  }

  function renderAddClassModal() {
    const backdrop = createElement("div", "modal-backdrop");
    const modal = createElement("div", "modal-card");

    const header = createElement("div", "modal-header-row");
    header.append(createElement("h2", "modal-title", "Tambah Kelas Baru"));
    const closeBtn = createElement("button", "modal-close-btn", "✕");
    closeBtn.addEventListener("click", () => {
      showAddClassModal = false;
      render();
    });
    header.append(closeBtn);
    modal.append(header);

    const form = createElement("form", "master-form");
    form.append(
      createField({ label: "Nama Kelas (misal: Kelas 5A)", name: "name", required: true }),
      createField({ label: "Tingkat Kelas (1-6)", name: "gradeLevel", type: "number", required: true }),
      createField({ label: "Nama Wali Kelas", name: "homeroomTeacher" }),
      createSelectField({
        label: "Tahun Ajaran",
        name: "academicYearId",
        options: (state.academicYears || []).map((y) => ({ value: y.id, label: y.name }))
      }),
      createSelectField({
        label: "Semester",
        name: "semesterId",
        options: (state.semesters || []).map((s) => ({ value: s.id, label: s.name }))
      })
    );

    const btnRow = createElement("div", "modal-btn-row");
    const submitBtn = createElement("button", "primary-action", "Simpan Kelas");
    submitBtn.type = "submit";
    btnRow.append(submitBtn);
    form.append(btnRow);

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const payload = formToObject(form);
      if (actions?.createClass) {
        actions.createClass(payload);
      }
      showAddClassModal = false;
      render();
    });

    modal.append(form);
    backdrop.append(modal);
    return backdrop;
  }

  function formatIndoDate(dateStr) {
    if (!dateStr) return "-";
    const parts = String(dateStr).split("-");
    if (parts.length !== 3) return dateStr;
    const [y, m, d] = parts;
    const months = [
      "Januari", "Februari", "Maret", "April", "Mei", "Juni",
      "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ];
    const mIdx = Number(m) - 1;
    if (months[mIdx]) {
      return `${Number(d)} ${months[mIdx]} ${y}`;
    }
    return dateStr;
  }

  function renderAddStudentModal(classRoom) {
    const backdrop = createElement("div", "modal-backdrop");
    const modal = createElement("div", "modal-card modal-card-wide");

    let currentTab = "manual"; // "manual" | "excel"
    let parsedExcelData = null;
    let isParsingExcel = false;
    let excelError = null;

    const header = createElement("div", "modal-header-row");
    header.append(createElement("h2", "modal-title", `Tambah Siswa ke ${classRoom.name}`));
    const closeBtn = createElement("button", "modal-close-btn", "✕");
    closeBtn.addEventListener("click", () => {
      showAddStudentModal = false;
      render();
    });
    header.append(closeBtn);
    modal.append(header);

    // Sub-tab Navigation
    const tabNav = createElement("div", "sub-tabs-row");
    const manualTabBtn = createElement("button", "sub-tab-btn active", "✏️ Input Manual");
    manualTabBtn.type = "button";
    const excelTabBtn = createElement("button", "sub-tab-btn", "📊 Import Excel (.xlsx)");
    excelTabBtn.type = "button";

    tabNav.append(manualTabBtn, excelTabBtn);
    modal.append(tabNav);

    const bodyContainer = createElement("div", "modal-tab-body");
    modal.append(bodyContainer);

    function renderModalBody() {
      bodyContainer.replaceChildren();
      manualTabBtn.className = `sub-tab-btn ${currentTab === "manual" ? "active" : ""}`;
      excelTabBtn.className = `sub-tab-btn ${currentTab === "excel" ? "active" : ""}`;

      if (currentTab === "manual") {
        renderManualForm();
      } else {
        renderExcelImport();
      }
    }

    manualTabBtn.addEventListener("click", () => {
      currentTab = "manual";
      renderModalBody();
    });

    excelTabBtn.addEventListener("click", () => {
      currentTab = "excel";
      renderModalBody();
    });

    function renderManualForm() {
      const form = createElement("form", "master-form");
      const photoPicker = createPhotoPickerField();

      form.append(
        photoPicker,
        createField({ label: "Nama Lengkap Siswa", name: "name", required: true }),
        createField({ label: "Nomor Induk Siswa (NIS)", name: "studentNumber" }),
        createSelectField({
          label: "Jenis Kelamin",
          name: "gender",
          options: [
            { value: "male", label: "Laki-laki" },
            { value: "female", label: "Perempuan" }
          ]
        }),
        createField({ label: "Tanggal Lahir", name: "birthDate", type: "date" }),
        createSelectField({
          label: "Tag Kesehatan / Kebugaran",
          name: "tagId",
          options: [
            { value: "", label: "-- Tanpa Tag Khusus --" },
            ...(state.studentTags || []).map((t) => ({ value: t.id, label: t.name }))
          ]
        }),
        createField({ label: "Catatan Guru (Kesehatan/Karakter)", name: "noteText" })
      );

      const btnRow = createElement("div", "modal-btn-row");
      const submitBtn = createElement("button", "primary-action", "Simpan Siswa");
      submitBtn.type = "submit";
      btnRow.append(submitBtn);
      form.append(btnRow);

      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const payload = formToObject(form);
        const photo = photoPicker.getPhoto();
        if (actions?.createStudent) {
          const result = actions.createStudent({
            ...payload,
            classId: classRoom.id,
            photo
          });
          if (result?.success === true) {
            showAddStudentModal = false;
            render();
            return;
          }
        }
        showToast("Penyimpanan gagal.\n\nData belum berhasil disimpan ke perangkat.\nKemungkinan ruang penyimpanan browser penuh atau tidak tersedia.");
      });

      bodyContainer.append(form);
    }

    function renderExcelImport() {
      const wrapper = createElement("div", "excel-import-panel");

      // Guidance Note
      const infoBox = createElement("div", "notice-box");
      const infoTitle = createElement("strong", null, "Petunjuk Import Excel");
      const infoList = createElement("ul", "text-xs text-subtle");
      const li1 = createElement("li", null, "• Nama siswa wajib.");
      const li2 = createElement("li", null, "• NIS, jenis kelamin, dan tanggal lahir boleh dikosongkan.");
      const li3 = createElement("li", null, `• Siswa otomatis dimasukkan ke kelas: ${classRoom.name}.`);
      infoList.append(li1, li2, li3);
      infoBox.append(infoTitle, infoList);
      wrapper.append(infoBox);

      // Template Download Toolbar
      const templateRow = createElement("div", "template-download-row");
      const dlBtn = createElement("button", "btn-tool");
      dlBtn.type = "button";
      dlBtn.append(ICONS.download(15), document.createTextNode(" Download Template Excel"));
      dlBtn.addEventListener("click", () => {
        try {
          downloadStudentTemplateExcel();
          showToast("Template Excel siswa berhasil diunduh.");
        } catch (err) {
          showToast(`Gagal mengunduh template: ${err.message}`);
        }
      });
      templateRow.append(dlBtn);
      wrapper.append(templateRow);

      if (isParsingExcel) {
        const loadingBox = createElement("div", "empty-copy text-sm", "Sedang memproses dan membaca file Excel...");
        wrapper.append(loadingBox);
        bodyContainer.append(wrapper);
        return;
      }

      if (excelError) {
        const errBox = createElement("div", "invalid-rows-warning");
        errBox.append(
          createElement("strong", "block text-xs font-semibold", "Gagal Membaca File:"),
          createElement("p", "text-xs mt-1", excelError)
        );
        const retryBtn = createElement("button", "btn-tool text-xs mt-2", "Pilih File Lain");
        retryBtn.type = "button";
        retryBtn.addEventListener("click", () => {
          excelError = null;
          parsedExcelData = null;
          renderModalBody();
        });
        errBox.append(retryBtn);
        wrapper.append(errBox);
      }

      if (!parsedExcelData) {
        // Upload Dropzone
        const dropzone = createElement("div", "file-dropzone");
        const dropIcon = ICONS.upload(28);
        const dropTitle = createElement("p", "dropzone-title", "Pilih atau Tarik File Excel (.xlsx) ke sini");
        const dropHint = createElement("p", "dropzone-sub", "Format file: Sheet SISWA dengan kolom nama_siswa, nis, jenis_kelamin, tanggal_lahir");

        const fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.accept = ".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel";
        fileInput.style.display = "none";

        const chooseBtn = createElement("button", "primary-action compact-action mt-2", "Pilih File Excel");
        chooseBtn.type = "button";
        chooseBtn.addEventListener("click", () => fileInput.click());

        fileInput.addEventListener("change", async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;

          isParsingExcel = true;
          excelError = null;
          renderModalBody();

          try {
            const result = await parseStudentExcelFile(file, {
              existingStudents: state.students || [],
              targetClassId: classRoom.id
            });
            parsedExcelData = result;
          } catch (err) {
            excelError = err.message || "Terjadi kesalahan saat membaca file Excel.";
          } finally {
            isParsingExcel = false;
            renderModalBody();
          }
        });

        dropzone.addEventListener("dragover", (e) => {
          e.preventDefault();
          dropzone.classList.add("dragover");
        });
        dropzone.addEventListener("dragleave", () => {
          dropzone.classList.remove("dragover");
        });
        dropzone.addEventListener("drop", async (e) => {
          e.preventDefault();
          dropzone.classList.remove("dragover");
          const file = e.dataTransfer?.files?.[0];
          if (!file) return;

          isParsingExcel = true;
          excelError = null;
          renderModalBody();

          try {
            const result = await parseStudentExcelFile(file, {
              existingStudents: state.students || [],
              targetClassId: classRoom.id
            });
            parsedExcelData = result;
          } catch (err) {
            excelError = err.message || "Terjadi kesalahan saat membaca file Excel.";
          } finally {
            isParsingExcel = false;
            renderModalBody();
          }
        });

        dropzone.append(dropIcon, dropTitle, dropHint, chooseBtn, fileInput);
        wrapper.append(dropzone);
      } else {
        // Preview state with Vertical Cards
        const { rows, summary } = parsedExcelData;

        // Summary Header Box
        const summaryBox = createElement("div", "import-summary-header");
        const countTitle = createElement("p", "summary-title-count", `${summary.total} siswa ditemukan`);
        const pillsWrap = createElement("div", "import-summary-badges");

        const readyPill = createElement("span", "summary-pill pill-success", `✓ ${summary.valid} siap`);
        pillsWrap.append(readyPill);

        if (summary.warning > 0) {
          const warnPill = createElement("span", "summary-pill pill-warning", `⚠ ${summary.warning} peringatan`);
          pillsWrap.append(warnPill);
        }

        const skippedCount = (summary.duplicate || 0) + (summary.invalid || 0);
        if (skippedCount > 0) {
          const skipPill = createElement("span", "summary-pill pill-error", `⛔ ${skippedCount} dilewati`);
          pillsWrap.append(skipPill);
        }

        summaryBox.append(countTitle, pillsWrap);
        wrapper.append(summaryBox);

        if (summary.total === 0) {
          wrapper.append(
            createElement(
              "p",
              "empty-copy text-sm",
              "Tidak ditemukan baris data siswa pada sheet SISWA."
            )
          );
        } else {
          // Vertical Cards Container
          const cardsContainer = createElement("div", "import-cards-scroll");

          rows.forEach((r) => {
            const { rowNumber, student, status, messages } = r;
            const card = createElement("article", `student-preview-card card-status-${status}`);

            const topRow = createElement("div", "preview-card-top");
            let iconText = "✓";
            if (status === "warning") iconText = "⚠";
            else if (status === "duplicate" || status === "invalid") iconText = "⛔";

            const nameHeader = createElement(
              "strong",
              "preview-student-name",
              `${iconText} ${student.name || `(Tanpa Nama - Baris ${rowNumber})`}`
            );
            topRow.append(nameHeader);

            const metaRow = createElement("div", "preview-student-meta text-xs text-subtle");
            const nisText = `NIS: ${student.studentNumber || "-"}`;
            const genderText =
              student.gender === "male"
                ? "Laki-laki"
                : student.gender === "female"
                  ? "Perempuan"
                  : "-";
            const birthText = student.birthDate ? formatIndoDate(student.birthDate) : "-";

            if (status === "warning" && !student.gender) {
              metaRow.append(createElement("p", null, nisText));
              metaRow.append(createElement("p", null, `Jenis kelamin: ${genderText} • ${birthText}`));
            } else {
              metaRow.append(createElement("p", null, nisText));
              metaRow.append(createElement("p", null, `${genderText} • ${birthText}`));
            }

            card.append(topRow, metaRow);

            if (Array.isArray(messages) && messages.length > 0) {
              const msgBox = createElement("div", "preview-card-messages");
              messages.forEach((msg) => {
                const msgClass = status === "warning" ? "preview-msg-warning" : "preview-msg-error";
                msgBox.append(createElement("p", msgClass, msg));
              });
              card.append(msgBox);
            }

            cardsContainer.append(card);
          });

          wrapper.append(cardsContainer);
        }

        const actionRow = createElement("div", "modal-btn-row mt-3");
        const changeFileBtn = createElement("button", "btn-tool", "Ganti File");
        changeFileBtn.type = "button";
        changeFileBtn.addEventListener("click", () => {
          parsedExcelData = null;
          excelError = null;
          renderModalBody();
        });

        const importBtn = createElement(
          "button",
          "primary-action",
          `Simpan ${summary.importable} Siswa ke ${classRoom.name}`
        );
        importBtn.type = "button";
        importBtn.disabled = summary.importable === 0;
        importBtn.addEventListener("click", () => {
          const importableRows = rows.filter(
            (r) => r.status === "valid" || r.status === "warning"
          );
          const studentsToImport = importableRows.map((r) => ({
            name: r.student.name,
            studentNumber: r.student.studentNumber || "",
            gender: r.student.gender || "",
            birthDate: r.student.birthDate || "",
            classId: classRoom.id
          }));

          const result = actions?.batchCreateStudents
            ? actions.batchCreateStudents(studentsToImport)
            : null;

          if (result?.success === true) {
            showToast(`✓ ${studentsToImport.length} siswa berhasil ditambahkan ke ${classRoom.name}`);
            showAddStudentModal = false;
            render();
          } else {
            showToast("Penyimpanan gagal.\n\nData belum berhasil disimpan ke perangkat.\nKemungkinan ruang penyimpanan browser penuh atau tidak tersedia.");
          }
        });

        actionRow.append(changeFileBtn, importBtn);
        wrapper.append(actionRow);
      }

      bodyContainer.append(wrapper);
    }

    renderModalBody();
    backdrop.append(modal);
    return backdrop;
  }

  function renderClassGrowthScreening(classId) {
    const classRoom = (state.classes || []).find((c) => c.id === classId);
    if (!classRoom) {
      classUi.selectedClassId = null;
      classUi.mode = "list";
      render();
      return;
    }

    const classStudents = (state.students || []).filter((s) => s.classId === classRoom.id);

    const backBtn = createElement("button", "btn-back-nav");
    backBtn.type = "button";
    backBtn.append(document.createTextNode(`← Kembali ke Detail ${classRoom.name}`));
    backBtn.addEventListener("click", () => {
      navigateBackToClassDetail();
    });
    container.append(backBtn);

    const header = createElement("header", "screen-header-row");
    const titleGroup = createElement("div");
    const eyebrow = createElement("p", "eyebrow");
    eyebrow.append(ICONS.chart(15), document.createTextNode(" Pemeriksaan Berkala"));
    titleGroup.append(
      eyebrow,
      createElement("h1", "screen-title", `Pemeriksaan Pertumbuhan: ${classRoom.name}`),
      createElement("p", "screen-copy", `Catat pengukuran tinggi badan (TB) dan berat badan (BB) seluruh siswa kelas ${classRoom.name}. Data akan otomatis tersimpan sebagai riwayat GrowthRecord.`)
    );
    header.append(titleGroup);
    container.append(header);

    if (classStudents.length === 0) {
      const emptyCard = createElement("div", "empty-state-card");
      emptyCard.append(
        createElement("p", "empty-copy", "Belum ada siswa di kelas ini."),
        createElement("p", "screen-copy", "Tambahkan siswa terlebih dahulu sebelum melakukan pemeriksaan pertumbuhan.")
      );
      container.append(emptyCard);
      return;
    }

    const form = createElement("form", "growth-screening-form");

    // Top Controls
    const topBar = createElement("div", "growth-screening-top");
    const dateField = createElement("label", "screening-date-field");
    dateField.append(createElement("span", "field-label", "Tanggal Pengukuran:"));
    const dateInput = document.createElement("input");
    dateInput.type = "date";
    dateInput.className = "screening-date-input";
    dateInput.required = true;
    dateInput.value = new Date().toISOString().slice(0, 10);
    dateField.append(dateInput);
    topBar.append(dateField);
    form.append(topBar);

    // Table of students
    const tableCard = createElement("div", "growth-screening-card");
    const table = createElement("table", "growth-screening-table");
    const thead = createElement("thead");
    thead.innerHTML = `
      <tr>
        <th style="width: 44px; text-align: center;">No</th>
        <th>Nama Siswa</th>
        <th style="min-width: 130px;">Tinggi Badan (cm)</th>
        <th style="min-width: 130px;">Berat Badan (kg)</th>
        <th style="min-width: 140px;">Data Terakhir</th>
      </tr>
    `;
    table.append(thead);

    const tbody = createElement("tbody");
    const studentInputs = [];

    classStudents.forEach((student, idx) => {
      const tr = createElement("tr", "growth-screening-row");

      // Find latest growth record
      const records = (state.growthRecords || [])
        .filter((g) => g.studentId === student.id)
        .sort((a, b) => (a.date > b.date ? 1 : -1));
      const latest = records.length > 0 ? records[records.length - 1] : null;

      const prevHeight = latest?.heightCm ?? student.heightCm ?? "";
      const prevWeight = latest?.weightKg ?? student.weightKg ?? "";
      const prevInfo = latest
        ? `${latest.date}: ${latest.heightCm || "-"}cm / ${latest.weightKg || "-"}kg`
        : (student.heightCm || student.weightKg
            ? `Awal: ${student.heightCm || "-"}cm / ${student.weightKg || "-"}kg`
            : "Belum ada");

      // Col 1: Index
      const tdIdx = createElement("td", "screening-col-idx text-center text-subtle", `${idx + 1}`);

      // Col 2: Student
      const tdStudent = createElement("td", "screening-col-student");
      const studentCell = createElement("div", "screening-student-cell");
      const avatar = createStudentAvatar(student, "screening-student-avatar");
      const meta = createElement("div");
      meta.append(
        createElement("strong", "student-name-text", student.name),
        createElement("div", "text-subtle text-xs", `NIS: ${student.studentNumber || "-"} • ${student.gender === "female" ? "P" : "L"}`)
      );
      studentCell.append(avatar, meta);
      tdStudent.append(studentCell);

      // Col 3: Height
      const tdHeight = createElement("td", "screening-col-height");
      const hLabel = createElement("label", "screening-input-label", "Tinggi Badan (cm)");
      const hInput = document.createElement("input");
      hInput.type = "number";
      hInput.step = "0.1";
      hInput.min = "0";
      hInput.inputMode = "decimal";
      hInput.className = "screening-num-input";
      hInput.placeholder = "TB (cm)";
      tdHeight.append(hLabel, hInput);

      // Col 4: Weight
      const tdWeight = createElement("td", "screening-col-weight");
      const wLabel = createElement("label", "screening-input-label", "Berat Badan (kg)");
      const wInput = document.createElement("input");
      wInput.type = "number";
      wInput.step = "0.1";
      wInput.min = "0";
      wInput.inputMode = "decimal";
      wInput.className = "screening-num-input";
      wInput.placeholder = "BB (kg)";
      tdWeight.append(wLabel, wInput);

      // Col 5: Last recorded
      const tdPrev = createElement("td", "screening-col-prev");
      const prevLabel = createElement("span", "screening-prev-label", "Data terakhir:");
      const prevVal = createElement("span", "screening-prev-val", prevInfo);
      tdPrev.append(prevLabel, prevVal);

      tr.append(tdIdx, tdStudent, tdHeight, tdWeight, tdPrev);
      tbody.append(tr);

      studentInputs.push({
        student,
        hInput,
        wInput
      });
    });

    table.append(tbody);
    tableCard.append(table);
    form.append(tableCard);

    // Bottom Action buttons
    const actionsBar = createElement("div", "screening-actions-bar");
    const saveBtn = createElement("button", "primary-action", "Simpan Pemeriksaan Kelas");
    saveBtn.type = "submit";

    const cancelBtn = createElement("button", "btn-tool", "Batal");
    cancelBtn.type = "button";
    cancelBtn.addEventListener("click", () => {
      navigateBackToClassDetail();
    });

    actionsBar.append(saveBtn, cancelBtn);
    form.append(actionsBar);

    let isGrowthDirty = false;
    form.addEventListener("input", () => {
      isGrowthDirty = studentInputs.some(({ hInput, wInput }) => hInput.value.trim() !== "" || wInput.value.trim() !== "");
    });
    registerDirtyGuard(() => isGrowthDirty);

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const measureDate = dateInput.value || new Date().toISOString().slice(0, 10);
      const recordsToSave = [];

      studentInputs.forEach(({ student, hInput, wInput }) => {
        const hVal = hInput.value.trim();
        const wVal = wInput.value.trim();

        const hasH = hVal !== "" && !isNaN(Number(hVal));
        const hasW = wVal !== "" && !isNaN(Number(wVal));

        if (hasH || hasW) {
          recordsToSave.push({
            studentId: student.id,
            date: measureDate,
            heightCm: hasH ? Number(hVal) : null,
            weightKg: hasW ? Number(wVal) : null,
            note: `Pemeriksaan Kelas ${classRoom.name}`
          });
        }
      });

      if (recordsToSave.length === 0) {
        window.alert("Tidak ada data tinggi atau berat badan yang diisi untuk disimpan.");
        return;
      }

      if (actions?.createGrowthRecord) {
        actions.createGrowthRecord(recordsToSave);
      }

      isGrowthDirty = false;
      unregisterDirtyGuard();
      showToast("Pemeriksaan tersimpan");
      navigateBackToClassDetail(null, true);
    });

    container.append(form);
  }

  function renderClassAssessmentsList(assessments, classRoom, students) {
    function openImportAssessment(targetClass) {
      const modal = renderAssessmentImportModal({
        classRoom: targetClass,
        existingDefinitions: state.assessmentDefinitions || [],
        existingSessions: state.assessmentSessions || [],
        onImport: ({ newDefinitions, newSessions, count }) => {
          if (count > 0 || (newDefinitions && newDefinitions.length > 0)) {
            if (actions?.batchImportAssessmentPackage) {
              actions.batchImportAssessmentPackage({ newDefinitions, newSessions });
            }
            showToast(`✓ ${count} asesmen berhasil ditambahkan.`);
            render();
          } else {
            showToast("Tidak ada asesmen baru yang diimport.");
          }
        }
      });
      container.append(modal);
    }

    if (assessments.length === 0) {
      const emptyCard = createElement("div", "empty-state-card");
      emptyCard.append(
        createElement("p", "empty-copy", `Belum ada asesmen yang dijadwalkan untuk ${classRoom.name}.`),
        createElement(
          "p",
          "screen-copy",
          "Tambahkan instrumen dan rubrik penilaian langsung atau import paket asesmen untuk mulai mengukur capaian pembelajaran siswa di kelas ini."
        )
      );

      const actionGroup = createElement("div", "flex flex-wrap gap-2 justify-center mt-3");

      const addBtn = createElement("button", "primary-action compact-action min-h-[44px]");
      addBtn.type = "button";
      addBtn.append(ICONS.plus(16), document.createTextNode(" + Buat Asesmen"));
      addBtn.addEventListener("click", () => {
        openCreateAssessment(classRoom.id);
      });

      const importBtn = createElement("button", "btn-tool compact-action min-h-[44px]");
      importBtn.type = "button";
      importBtn.append(ICONS.download(16), document.createTextNode(" ↓ Import Asesmen"));
      importBtn.addEventListener("click", () => {
        openImportAssessment(classRoom);
      });

      actionGroup.append(addBtn, importBtn);
      emptyCard.append(actionGroup);

      container.append(emptyCard);
      return;
    }

    const purposeMap = {
      pretest: "Pretest / Asesmen Awal",
      formative: "Harian / Formatif",
      posttest: "Posttest",
      summative: "Sumatif Materi",
      midterm: "UTS / STS",
      final: "UAS / SAS"
    };

    const typeMap = {
      written: "Tes Tertulis",
      oral: "Tes Lisan",
      practice: "Praktik",
      observation: "Observasi"
    };

    const listHeader = createElement("div", "flex items-center justify-between flex-wrap gap-2 mb-4");
    const heading = createElement("h3", "section-title font-bold text-base", `Daftar Asesmen (${assessments.length})`);

    const headerActions = createElement("div", "flex items-center flex-wrap gap-2");
    const createBtn = createElement("button", "primary-action compact-action min-h-[44px]");
    createBtn.type = "button";
    createBtn.append(ICONS.plus(16), document.createTextNode(" + Buat Asesmen"));
    createBtn.addEventListener("click", () => {
      openCreateAssessment(classRoom.id);
    });

    const importBtn = createElement("button", "btn-tool compact-action min-h-[44px]");
    importBtn.type = "button";
    importBtn.append(ICONS.download(16), document.createTextNode(" ↓ Import Asesmen"));
    importBtn.addEventListener("click", () => {
      openImportAssessment(classRoom);
    });

    headerActions.append(createBtn, importBtn);
    listHeader.append(heading, headerActions);
    container.append(listHeader);

    const grid = createElement("div", "assessment-sessions-grid");

    assessments.forEach((as) => {
      const def = (state.assessmentDefinitions || []).find((d) => d.id === as.definitionId);
      const card = createElement("article", "assessment-item-card");

      const topRow = createElement("div", "assessment-card-header");
      const titleGroup = createElement("div");

      const pLabel = purposeMap[as.purpose] || as.purpose || "Asesmen";
      const tLabel = typeMap[def?.assessmentType] || (def?.assessmentType || "Praktik");
      const mLabel = def?.method === "numeric" ? "Nilai Angka" : def?.method === "stopwatch" ? "Stopwatch" : (def?.rubricScale ? `Rubrik 1–${def.rubricScale}` : (as.rubricSnapshot?.scale ? `Rubrik 1–${as.rubricSnapshot.scale}` : "Rubrik 1–5"));

      titleGroup.append(
        createElement("h3", "assessment-card-title", as.title),
        createElement("p", "assessment-card-meta", `${pLabel} • ${tLabel} • ${mLabel}${as.date ? ` • ${as.date}` : ""}`)
      );
      topRow.append(titleGroup);
      card.append(topRow);

      if (Array.isArray(as.materials) && as.materials.length > 0) {
        const matRow = createElement("div", "assessment-materials-row");
        matRow.append(createElement("span", "", `Materi: ${as.materials.join(", ")}`));
        card.append(matRow);
      }

      // Helper to check if student is completely scored
      const isStudentComplete = (studentId) => {
        const res = (state.assessmentResults || []).find(
          (r) => r.assessmentSessionId === as.id && r.studentId === studentId
        );
        if (!res) return false;
        const items = Array.isArray(as.itemsSnapshot) ? as.itemsSnapshot : [];
        if (items.length > 0) {
          const itemResList = Array.isArray(res.itemResults) ? res.itemResults : [];
          return items.every((it) => {
            const match = itemResList.find((ir) => ir.itemId === it.id);
            return match && match.rubricLevel !== undefined && match.rubricLevel !== null && !Number.isNaN(Number(match.rubricLevel));
          });
        }
        return res.value !== "" && res.value !== undefined && res.value !== null;
      };

      // Progress calculation per assessmentSessionId
      const scoredCount = students.filter((st) => isStudentComplete(st.id)).length;

      const total = students.length;
      const pct = total > 0 ? Math.round((scoredCount / total) * 100) : 0;

      const progressSection = createElement("div", "assessment-progress-section");
      progressSection.append(
        createElement("div", "assessment-progress-text", `${scoredCount} dari ${total} siswa dinilai (${pct}%)`)
      );

      const progWrap = createElement("div", "att-progress-wrap");
      const progBar = createElement("div", "att-progress-bar");
      progBar.style.width = `${pct}%`;
      progWrap.append(progBar);
      progressSection.append(progWrap);
      card.append(progressSection);

      const actionRow = createElement("div", "assessment-card-actions flex items-center justify-between gap-2 pt-2");
      const startBtn = createElement("button", "primary-action compact-action flex-1 min-h-[44px]", scoredCount > 0 ? "Lanjutkan Penilaian" : "Mulai Penilaian");
      startBtn.type = "button";
      startBtn.addEventListener("click", () => {
        openScoring(classRoom.id, as.id);
      });

      // ⋯ menu for card actions (Export Asesmen Choice)
      const menuWrap = createElement("div", "relative assessment-card-menu");
      const menuBtn = createElement("button", "btn-tool compact-action min-h-[44px] min-w-[44px] flex items-center justify-center");
      menuBtn.type = "button";
      menuBtn.setAttribute("aria-label", "Menu opsi asesmen");
      menuBtn.append(ICONS.moreHorizontal(18));

      const dropdown = createElement("div", "assessment-card-dropdown");
      
      const menuTitle = createElement("p", "assessment-card-menu-title", "Export Asesmen");
      
      const exportExcelBtn = createElement("button", "assessment-card-menu-item");
      exportExcelBtn.type = "button";
      exportExcelBtn.append(ICONS.download(16), document.createTextNode("Excel (.xlsx)"));
      exportExcelBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        dropdown.classList.remove("dropdown-open");
        const expResult = exportAssessmentSessionToExcelFile(as, def);
        showToast(`✓ Asesmen diekspor: ${expResult.filename}`);
      });

      const exportJsonBtn = createElement("button", "assessment-card-menu-item");
      exportJsonBtn.type = "button";
      exportJsonBtn.append(ICONS.download(16), document.createTextNode("JSON (.json)"));
      exportJsonBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        dropdown.classList.remove("dropdown-open");
        const expResult = exportAssessmentSessionToJsonFile(as, def);
        showToast(`✓ Asesmen diekspor: ${expResult.filename}`);
      });

      const cancelMenuBtn = createElement("button", "assessment-card-menu-item item-cancel");
      cancelMenuBtn.type = "button";
      cancelMenuBtn.textContent = "Batal";
      cancelMenuBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        dropdown.classList.remove("dropdown-open");
      });

      dropdown.append(menuTitle, exportExcelBtn, exportJsonBtn, cancelMenuBtn);
      menuBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const isOpen = dropdown.classList.contains("dropdown-open");
        document.querySelectorAll(".assessment-card-dropdown.dropdown-open").forEach((el) => {
          el.classList.remove("dropdown-open");
        });
        if (!isOpen) {
          dropdown.classList.add("dropdown-open");
        }
      });

      menuWrap.append(menuBtn, dropdown);
      actionRow.append(startBtn, menuWrap);
      card.append(actionRow);

      grid.append(card);
    });

    container.append(grid);
  }

  function renderCreateAssessmentView(classId) {
    const classRoom = (state.classes || []).find((c) => c.id === classId);
    if (!classRoom) {
      classUi.selectedClassId = null;
      classUi.mode = "list";
      render();
      return;
    }

    function getDefaultRubricLevels(scale) {
      if (scale === 3) {
        return [
          { level: 1, label: "Level 1", desc: "Belum mengetahui atau belum mampu memberikan jawaban yang sesuai." },
          { level: 2, label: "Level 2", desc: "Sudah memahami sebagian dan mampu memberikan jawaban yang cukup sesuai." },
          { level: 3, label: "Level 3", desc: "Mampu memberikan jawaban yang benar dan jelas." }
        ];
      }
      if (scale === 4) {
        return [
          { level: 1, label: "Level 1", desc: "Belum mengetahui atau belum mampu memberikan jawaban yang sesuai." },
          { level: 2, label: "Level 2", desc: "Sudah mencoba menjawab, tetapi masih memerlukan banyak arahan." },
          { level: 3, label: "Level 3", desc: "Mampu memberikan jawaban yang benar secara sederhana." },
          { level: 4, label: "Level 4", desc: "Mampu memberikan jawaban yang benar, tepat, dan jelas." }
        ];
      }
      return [
        { level: 1, label: "Level 1", desc: "Belum mengetahui atau belum mampu memberikan jawaban yang sesuai." },
        { level: 2, label: "Level 2", desc: "Sudah mencoba menjawab, tetapi jawaban masih belum tepat." },
        { level: 3, label: "Level 3", desc: "Jawaban belum sepenuhnya benar, tetapi sudah masuk pada konteks yang dinilai." },
        { level: 4, label: "Level 4", desc: "Mampu memberikan jawaban yang benar secara sederhana." },
        { level: 5, label: "Level 5", desc: "Mampu memberikan jawaban yang benar, tepat, dan jelas." }
      ];
    }

    const backBtn = createElement("button", "btn-back-nav");
    backBtn.type = "button";
    backBtn.append(document.createTextNode(`← Kembali ke Detail ${classRoom.name}`));
    backBtn.addEventListener("click", () => {
      navigateBackToClassDetail();
    });
    container.append(backBtn);

    const header = createElement("header", "screen-header-row");
    const titleGroup = createElement("div");
    const eyebrow = createElement("p", "eyebrow");
    eyebrow.append(ICONS.target(15), document.createTextNode(" Buat Asesmen Baru"));
    titleGroup.append(
      eyebrow,
      createElement("h1", "screen-title", `Tambah Asesmen: ${classRoom.name}`),
      createElement(
        "p",
        "screen-copy",
        "Rancang instrumen penilaian, butir pertanyaan, dan rubrik evaluasi capaian siswa."
      )
    );
    header.append(titleGroup);
    container.append(header);

    const form = createElement("form", "master-form");

    let isCreateDirty = false;
    form.addEventListener("input", () => {
      isCreateDirty = true;
    });
    registerDirtyGuard(() => {
      if (!isCreateDirty) return false;
      const payload = formToObject(form);
      return Boolean(
        (payload.name && payload.name.trim()) ||
        (payload.material && payload.material.trim()) ||
        itemsData.some((it) => it.prompt && it.prompt.trim())
      );
    });

    const nameField = createField({
      label: "Nama Asesmen *",
      name: "name",
      placeholder: "Contoh: Asesmen Kebugaran & Gerak Dasar",
      required: true
    });

    const materialField = createField({
      label: "Materi *",
      name: "material",
      placeholder: "Contoh: Gerak Lokomotor & Kebugaran Jasmani",
      required: true
    });

    const purposeField = createSelectField({
      label: "Jenis Asesmen *",
      name: "purpose",
      value: "formative",
      options: [
        { value: "pretest", label: "Pretest" },
        { value: "formative", label: "Harian / Formatif" },
        { value: "posttest", label: "Posttest" },
        { value: "midterm", label: "UTS / STS" },
        { value: "final", label: "UAS / SAS" }
      ],
      required: true
    });

    const typeField = createSelectField({
      label: "Bentuk Asesmen *",
      name: "assessmentType",
      value: "practice",
      options: [
        { value: "oral", label: "Lisan" },
        { value: "written", label: "Tertulis" },
        { value: "practice", label: "Praktik" },
        { value: "observation", label: "Observasi" }
      ],
      required: true
    });

    const scaleField = createSelectField({
      label: "Skala Rubrik *",
      name: "rubricScale",
      value: "5",
      options: [
        { value: "3", label: "3" },
        { value: "4", label: "4" },
        { value: "5", label: "5" }
      ],
      required: true
    });

    form.append(nameField, materialField, purposeField, typeField, scaleField);

    // AI Config Panel
    let rubricAiApiKey = "";
    try {
      rubricAiApiKey = window.sessionStorage.getItem("pjok_gemini_api_key") || "";
    } catch (_) {
      rubricAiApiKey = "";
    }

    const aiConfigPanel = createElement("div", "ai-rubric-config");
    const aiConfigHeader = createElement("div", "ai-rubric-config-header");
    aiConfigHeader.append(
      createElement("strong", "ai-rubric-title", "🤖 AI Pembuat Rubrik"),
      createElement("span", "text-subtle text-xs", "Gemini AI")
    );

    const aiStatus = createElement(
      "p",
      "ai-rubric-status",
      rubricAiApiKey.trim()
        ? "AI siap digunakan."
        : "AI belum dikonfigurasi. Atur Gemini API Key di Pengaturan → AI."
    );

    aiConfigPanel.append(aiConfigHeader, aiStatus);
    form.append(aiConfigPanel);

    let currentScale = 5;
    let itemsData = [
      {
        prompt: "",
        rubricLevels: getDefaultRubricLevels(currentScale)
      }
    ];

    const itemsSection = createElement("div", "mt-6 space-y-4");
    const itemsTitleGroup = createElement("div", "flex items-center justify-between");
    itemsTitleGroup.append(
      createElement("h3", "sub-title font-semibold", "Butir Asesmen"),
      createElement("span", "text-subtle text-xs", "Minimal 1 butir pertanyaan")
    );
    itemsSection.append(itemsTitleGroup);

    const itemsListEl = createElement("div", "space-y-4");
    itemsSection.append(itemsListEl);

    function renderItems() {
      itemsListEl.replaceChildren();

      itemsData.forEach((item, itemIdx) => {
        const itemCard = createElement("div", "border border-slate-200 dark:border-slate-800 rounded-lg p-4 bg-white dark:bg-slate-900 space-y-3");

        const itemHeader = createElement("div", "flex items-center justify-between border-b pb-2 border-slate-100 dark:border-slate-800");
        itemHeader.append(
          createElement("strong", "text-sm text-slate-800 dark:text-slate-200", `Pertanyaan ${itemIdx + 1}`)
        );

        if (itemsData.length > 1) {
          const delItemBtn = createElement("button", "text-button danger-button text-xs", "Hapus Pertanyaan");
          delItemBtn.type = "button";
          delItemBtn.addEventListener("click", () => {
            itemsData.splice(itemIdx, 1);
            renderItems();
          });
          itemHeader.append(delItemBtn);
        }

        itemCard.append(itemHeader);

        // Prompt field
        const promptLabel = createElement("label", "field");
        promptLabel.append(createElement("span", "font-medium text-sm", "Pertanyaan / Instrumen *"));
        const promptTextarea = document.createElement("textarea");
        promptTextarea.className = "input-text";
        promptTextarea.rows = 2;
        promptTextarea.placeholder = "Tuliskan pertanyaan atau butir instrumen...";
        promptTextarea.value = item.prompt || "";
        promptTextarea.required = true;
        promptTextarea.addEventListener("input", (e) => {
          item.prompt = e.target.value;
        });
        promptLabel.append(promptTextarea);
        itemCard.append(promptLabel);

        // AI Generate Rubric button
        const aiBtn = createElement("button", "btn-tool ai-rubric-btn", "✨ Generate Rubrik AI");
        aiBtn.type = "button";
        aiBtn.disabled = false;
        aiBtn.style.cursor = "pointer";

        let aiBusy = false;

        aiBtn.addEventListener("pointerdown", () => {
          aiBtn.classList.add("is-ai-pressed");
        });

        aiBtn.addEventListener("pointerup", () => {
          aiBtn.classList.remove("is-ai-pressed");
        });

        aiBtn.addEventListener("pointercancel", () => {
          aiBtn.classList.remove("is-ai-pressed");
        });

        aiBtn.addEventListener("click", async (event) => {
          event.preventDefault();
          event.stopPropagation();

          if (aiBusy) return;

          const material = (materialField.querySelector("input")?.value || "").trim();
          const purpose = purposeField.querySelector("select")?.value;
          const assessmentType = typeField.querySelector("select")?.value;
          const question = (item.prompt || "").trim();
          const rubricScale = currentScale;
          const gradeLevel = Number(classRoom.gradeLevel);

          let phase = "Fase tidak diketahui";
          if (gradeLevel === 1 || gradeLevel === 2) {
            phase = "Fase A";
          } else if (gradeLevel === 3 || gradeLevel === 4) {
            phase = "Fase B";
          } else if (gradeLevel === 5 || gradeLevel === 6) {
            phase = "Fase C";
          }

          if (!material) {
            window.alert("Isi materi terlebih dahulu agar AI dapat membuat rubrik yang sesuai.");
            return;
          }

          if (!question) {
            window.alert("Tulis pertanyaan atau instrumen terlebih dahulu.");
            return;
          }

          let apiKey = "";
          try {
            apiKey = (window.sessionStorage.getItem("pjok_gemini_api_key") || "").trim();
          } catch (_) {}

          if (!apiKey) {
            aiStatus.textContent = "AI belum dikonfigurasi. Atur Gemini API Key di Pengaturan → AI.";
            window.alert("AI belum dikonfigurasi. Atur Gemini API Key di Pengaturan → AI.");
            return;
          }

          aiBusy = true;
          aiBtn.classList.add("is-ai-loading");
          aiBtn.textContent = "Membuat Rubrik...";
          aiStatus.textContent = `AI sedang membuat rubrik untuk Pertanyaan ${itemIdx + 1}...`;

          try {
            const result = await generateRubricWithAI({
              apiKey,
              gradeLevel,
              phase,
              material,
              purpose,
              assessmentType,
              question,
              rubricScale
            });

            if (result && Array.isArray(result.rubricLevels)) {
              item.rubricLevels = result.rubricLevels.map((level) => ({
                level: Number(level.level),
                label: level.label || `Level ${level.level}`,
                desc: level.desc
              }));
              aiStatus.textContent = `Rubrik Pertanyaan ${itemIdx + 1} berhasil dibuat. Silakan periksa dan edit jika diperlukan.`;
              renderItems();
            }
          } catch (err) {
            console.error("[AI RUBRIC GENERATION ERROR]", err);
            const message = err?.message || "Unknown AI error";
            if (err?.isApiKeyError || (message && (message.includes("API key") || message.includes("API_KEY")))) {
              aiStatus.textContent = "Periksa Gemini API Key di Pengaturan → AI.";
              window.alert("Periksa Gemini API Key di Pengaturan → AI.");
            } else {
              aiStatus.textContent = `AI gagal: ${message}`;
              window.alert(`Rubrik AI gagal dibuat.\n\nDetail: ${message}`);
            }
          } finally {
            aiBusy = false;
            aiBtn.classList.remove("is-ai-loading");
            aiBtn.textContent = "✨ Generate Rubrik AI";
          }
        });
        itemCard.append(aiBtn);

        // Rubric fields
        const rubricHeader = createElement("div", "mt-2 pt-2 border-t border-slate-100 dark:border-slate-800");
        rubricHeader.append(
          createElement("span", "font-medium text-xs text-subtle", `Kriteria Rubrik (Skala ${currentScale}):`)
        );
        itemCard.append(rubricHeader);

        const rubricWrap = createElement("div", "space-y-2 mt-1");
        item.rubricLevels.forEach((levelObj) => {
          const lvlField = createElement("div", "field text-xs");
          const lvlLabel = createElement("span", "font-semibold text-slate-700 dark:text-slate-300", `Rubrik ${levelObj.level}`);
          const lvlTextarea = document.createElement("textarea");
          lvlTextarea.className = "input-text text-xs";
          lvlTextarea.rows = 2;
          lvlTextarea.value = levelObj.desc || "";
          lvlTextarea.placeholder = `Deskripsi level ${levelObj.level}...`;
          lvlTextarea.addEventListener("input", (e) => {
            levelObj.desc = e.target.value;
          });
          lvlField.append(lvlLabel, lvlTextarea);
          rubricWrap.append(lvlField);
        });
        itemCard.append(rubricWrap);

        itemsListEl.append(itemCard);
      });
    }

    renderItems();

    const addItemBtn = createElement("button", "btn-tool mt-2");
    addItemBtn.type = "button";
    addItemBtn.append(ICONS.plus(14), document.createTextNode(" Tambah Pertanyaan"));
    addItemBtn.addEventListener("click", () => {
      isCreateDirty = true;
      itemsData.push({
        prompt: "",
        rubricLevels: getDefaultRubricLevels(currentScale)
      });
      renderItems();
    });
    itemsSection.append(addItemBtn);

    form.append(itemsSection);

    const scaleSelectEl = scaleField.querySelector("select");
    if (scaleSelectEl) {
      scaleSelectEl.addEventListener("change", (e) => {
        const newScale = Number(e.target.value) || 5;
        currentScale = newScale;
        itemsData.forEach((item) => {
          const prevLevels = item.rubricLevels || [];
          const defaultNewLevels = getDefaultRubricLevels(newScale);
          item.rubricLevels = defaultNewLevels.map((defLvl, idx) => {
            const existing = prevLevels[idx];
            return {
              level: defLvl.level,
              label: defLvl.label,
              desc: existing && existing.desc ? existing.desc : defLvl.desc
            };
          });
        });
        renderItems();
      });
    }

    // Action buttons
    const btnRow = createElement("div", "modal-btn-row mt-6");
    const submitBtn = createElement("button", "primary-action", "Simpan Asesmen");
    submitBtn.type = "submit";

    const cancelBtn = createElement("button", "btn-tool", "Batal");
    cancelBtn.type = "button";
    cancelBtn.addEventListener("click", () => {
      navigateBackToClassDetail();
    });

    btnRow.append(submitBtn, cancelBtn);
    form.append(btnRow);

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const payload = formToObject(form);
      const name = (payload.name || "").trim();
      const material = (payload.material || "").trim();
      const purpose = payload.purpose || "formative";
      const assessmentType = payload.assessmentType || "practice";

      if (!name) {
        window.alert("Nama Asesmen harus diisi.");
        return;
      }
      if (!material) {
        window.alert("Materi harus diisi.");
        return;
      }
      if (itemsData.length === 0) {
        window.alert("Minimal satu butir pertanyaan harus ada.");
        return;
      }

      for (let i = 0; i < itemsData.length; i++) {
        const item = itemsData[i];
        if (!item.prompt || !item.prompt.trim()) {
          window.alert(`Pertanyaan pada butir ${i + 1} tidak boleh kosong.`);
          return;
        }
        for (let j = 0; j < item.rubricLevels.length; j++) {
          const lvl = item.rubricLevels[j];
          if (!lvl.desc || !lvl.desc.trim()) {
            window.alert(`Deskripsi Rubrik ${lvl.level} pada Pertanyaan ${i + 1} tidak boleh kosong.`);
            return;
          }
        }
      }

      const definitionPayload = {
        name,
        category: "pengetahuan",
        purpose,
        assessmentType,
        method: "rubric",
        materials: [material],
        rubricScale: currentScale,
        rubricLevels: [],
        questions: itemsData.map((it) => it.prompt.trim()),
        items: itemsData.map((it) => ({
          prompt: it.prompt.trim(),
          rubricScale: currentScale,
          rubricLevels: it.rubricLevels.map((l) => ({
            level: Number(l.level),
            label: l.label || `Level ${l.level}`,
            desc: l.desc.trim()
          }))
        }))
      };

      const createdDef = actions?.createAssessmentDefinition
        ? actions.createAssessmentDefinition(definitionPayload)
        : null;

      const defToUse = createdDef || {
        id: "",
        name: definitionPayload.name,
        purpose: definitionPayload.purpose,
        materials: definitionPayload.materials,
        questions: definitionPayload.questions,
        instructions: "",
        items: definitionPayload.items,
        rubricScale: definitionPayload.rubricScale
      };

      const today = new Date().toISOString().slice(0, 10);
      if (actions?.createAssessmentSession) {
        actions.createAssessmentSession({
          classId: classRoom.id,
          definitionId: defToUse.id,
          date: today,
          title: defToUse.name,
          purpose: defToUse.purpose,
          materials: defToUse.materials,
          questions: defToUse.questions,
          instructions: defToUse.instructions || "",
          itemsSnapshot: defToUse.items,
          rubricSnapshot: {
            scale: defToUse.rubricScale || currentScale || 5,
            levels: []
          }
        });
      }

      isCreateDirty = false;
      unregisterDirtyGuard();
      navigateBackToClassDetail("assessments", true);
    });

    container.append(form);
  }

  function renderScoringWorkflowView(classId, assessSessId) {
    const classRoom = (state.classes || []).find((c) => c.id === classId);
    const as = (state.assessmentSessions || []).find((s) => s.id === assessSessId);
    if (!classRoom || !as) {
      classUi.activeAssessmentSessionId = null;
      classUi.mode = "detail";
      render();
      return;
    }

    const classStudents = (state.students || []).filter((s) => s.classId === classRoom.id);
    const def = (state.assessmentDefinitions || []).find((d) => d.id === as.definitionId);

    const backBtn = createElement("button", "btn-back-nav");
    backBtn.type = "button";
    backBtn.append(document.createTextNode(`← Kembali ke Asesmen ${classRoom.name}`));
    backBtn.addEventListener("click", () => {
      navigateBackFromScoring();
    });
    container.append(backBtn);

    const purposeMap = {
      pretest: "Pretest / Asesmen Awal",
      formative: "Harian / Formatif",
      posttest: "Posttest",
      summative: "Sumatif Materi",
      midterm: "UTS / STS",
      final: "UAS / SAS"
    };

    const typeMap = {
      written: "Tes Tertulis",
      oral: "Tes Lisan",
      practice: "Praktik",
      observation: "Observasi"
    };

    const header = createElement("header", "screen-header-row");
    const titleGroup = createElement("div");
    const eyebrow = createElement("p", "eyebrow");
    eyebrow.append(ICONS.target(15), document.createTextNode(" Penilaian Asesmen Terfokus"));
    titleGroup.append(
      eyebrow,
      createElement("h1", "screen-title", as.title),
      createElement(
        "p",
        "screen-copy",
        `${purposeMap[as.purpose] || as.purpose} • ${typeMap[def?.assessmentType] || "Praktik"} • Kelas ${classRoom.name}${as.materials?.length ? ` • Materi: ${as.materials.join(", ")}` : ""}`
      )
    );
    header.append(titleGroup);
    container.append(header);

    // Reference box if questions or instructions exist
    const hasQuestions = Array.isArray(as.questions) && as.questions.length > 0;
    const hasInstructions = Boolean(as.instructions);

    if (hasQuestions || hasInstructions) {
      const refDisclosure = createElement("details", "scoring-reference-disclosure");
      const refSummary = createElement("summary", "scoring-reference-summary", "Panduan Asesmen ▾");

      const refBox = createElement("div", "scoring-reference-box mt-2");
      if (hasInstructions) {
        refBox.append(
          createElement("div", "scoring-reference-title", "📋 Panduan / Instruksi Gerak:"),
          createElement("p", "screen-copy mb-2", as.instructions)
        );
      }
      if (hasQuestions) {
        refBox.append(createElement("div", "scoring-reference-title", "❓ Butir Pertanyaan / Instrumen:"));
        const qList = createElement("div", "scoring-questions-list");
        as.questions.forEach((q, idx) => {
          qList.append(createElement("div", "scoring-question-item", `${idx + 1}. ${q}`));
        });
        refBox.append(qList);
      }
      refDisclosure.append(refSummary, refBox);
      container.append(refDisclosure);
    }

    if (classStudents.length === 0) {
      const emptyCard = createElement("div", "empty-state-card");
      emptyCard.append(
        createElement("p", "empty-copy", "Belum ada siswa di kelas ini."),
        createElement("p", "screen-copy", "Tambahkan siswa terlebih dahulu sebelum melakukan penilaian.")
      );
      container.append(emptyCard);
      return;
    }

    // Clamp active student index
    if (classUi.activeAssessmentStudentIndex < 0) classUi.activeAssessmentStudentIndex = 0;
    if (classUi.activeAssessmentStudentIndex >= classStudents.length) classUi.activeAssessmentStudentIndex = classStudents.length - 1;

    const currentStudent = classStudents[classUi.activeAssessmentStudentIndex];

    // Stepper & Jump Bar
    const stepperBar = createElement("div", "student-stepper-bar");

    const isStudentComplete = (studentId) => {
      const res = (state.assessmentResults || []).find(
        (r) => r.assessmentSessionId === as.id && r.studentId === studentId
      );
      if (!res) return false;
      const items = Array.isArray(as.itemsSnapshot) ? as.itemsSnapshot : [];
      if (items.length > 0) {
        const itemResList = Array.isArray(res.itemResults) ? res.itemResults : [];
        return items.every((it) => {
          const match = itemResList.find((ir) => ir.itemId === it.id);
          return match && match.rubricLevel !== undefined && match.rubricLevel !== null && !Number.isNaN(Number(match.rubricLevel));
        });
      }
      return res.value !== "" && res.value !== undefined && res.value !== null;
    };

    const jumpPills = createElement("div", "student-jump-pills");
    classStudents.forEach((st, idx) => {
      const hasScore = isStudentComplete(st.id);
      const pill = createElement(
        "button",
        `student-jump-pill ${idx === classUi.activeAssessmentStudentIndex ? "is-active" : ""} ${hasScore ? "is-scored" : ""}`,
        hasScore ? `✓ ${idx + 1}` : `${idx + 1}`
      );
      pill.type = "button";
      pill.title = `${st.name} (${hasScore ? "Sudah dinilai" : "Belum dinilai"})`;
      pill.addEventListener("click", () => {
        classUi.activeAssessmentStudentIndex = idx;
        classUi.activeAssessmentItemIndex = 0;
        classUi.completedStudentId = null;
        render();
      });
      jumpPills.append(pill);
    });
    stepperBar.append(jumpPills);
    container.append(stepperBar);

    // Current Student Result for this assessmentSessionId
    const currentResult = (state.assessmentResults || []).find(
      (r) => r.assessmentSessionId === as.id && r.studentId === currentStudent.id
    );

    // Main Focus Card
    const focusCard = createElement("div", "scoring-focus-card");

    // Student Header
    const studentHeader = createElement("div", "scoring-student-header");
    const profileWrap = createElement("div", "scoring-student-profile");
    const avatar = createStudentAvatar(currentStudent, "scoring-student-avatar");
    const nameWrap = createElement("div");
    nameWrap.append(
      createElement("p", "text-xs font-bold text-brand uppercase tracking-wider mb-0.5", `SISWA ${classUi.activeAssessmentStudentIndex + 1} / ${classStudents.length}`),
      createElement("h2", "font-bold text-xl leading-tight text-slate-900 dark:text-slate-100", currentStudent.name),
      createElement("div", "text-subtle text-xs mt-0.5", `NIS ${currentStudent.studentNumber || "-"} • ${currentStudent.gender === "female" ? "Perempuan" : (currentStudent.gender === "male" ? "Laki-laki" : "-")}`)
    );
    profileWrap.append(avatar, nameWrap);

    const assessmentItems = Array.isArray(as.itemsSnapshot) ? as.itemsSnapshot : [];
    const isItemBased = (def?.method === "rubric" || !def?.method) && assessmentItems.length > 0;

    if (isItemBased) {
      if (classUi.activeAssessmentItemIndex < 0) classUi.activeAssessmentItemIndex = 0;
      if (classUi.activeAssessmentItemIndex >= assessmentItems.length) classUi.activeAssessmentItemIndex = assessmentItems.length - 1;

      const currentItem = assessmentItems[classUi.activeAssessmentItemIndex];
      const currentItemResults = Array.isArray(currentResult?.itemResults) ? currentResult.itemResults : [];
      const completedItemCount = assessmentItems.filter((it) => {
        const r = currentItemResults.find((ir) => ir.itemId === it.id);
        return r && r.rubricLevel !== undefined && r.rubricLevel !== null && !Number.isNaN(Number(r.rubricLevel));
      }).length;
      const allItemsComplete = assessmentItems.length > 0 && completedItemCount === assessmentItems.length;

      const scoreBadgeWrap = createElement("div", "text-right flex-shrink-0");
      if (allItemsComplete) {
        const scale = Number(currentItem.rubricScale) || 5;
        const finalScore = currentResult?.numericScore !== null && currentResult?.numericScore !== undefined
          ? currentResult.numericScore
          : (currentResult?.averageRubricScore ? Math.round((currentResult.averageRubricScore / scale) * 100) : 0);

        scoreBadgeWrap.append(
          createElement("span", "assess-score-badge badge-has-score block text-xs font-bold", `${completedItemCount} / ${assessmentItems.length} selesai`),
          createElement("span", "text-xs text-subtle font-medium mt-0.5 block", `Nilai ${finalScore}`)
        );
      } else {
        scoreBadgeWrap.append(
          createElement(
            "span",
            `assess-score-badge ${completedItemCount > 0 ? "badge-has-score" : ""}`,
            completedItemCount > 0 ? `${completedItemCount} / ${assessmentItems.length} selesai` : "Belum dinilai"
          )
        );
      }

      studentHeader.append(profileWrap, scoreBadgeWrap);
      focusCard.append(studentHeader);

      const isStudentShowingCompletion = classUi.completedStudentId === currentStudent.id;

      if (isStudentShowingCompletion) {
        const isLastStudent = classUi.activeAssessmentStudentIndex === classStudents.length - 1;
        const completionPanel = createElement("div", `student-completion-panel ${isLastStudent ? "class-complete" : ""}`);

        const checkIcon = createElement("div", "completion-badge-icon", "✓");
        const titleText = createElement("h3", "completion-title", isLastStudent ? "Penilaian kelas selesai" : `${currentStudent.name} selesai`);

        const scale = Number(currentItem.rubricScale) || 5;
        const finalScore = currentResult?.numericScore !== null && currentResult?.numericScore !== undefined
          ? currentResult.numericScore
          : (currentResult?.averageRubricScore ? Math.round((currentResult.averageRubricScore / scale) * 100) : 0);

        const summaryText = createElement(
          "p",
          "completion-summary",
          isLastStudent
            ? `${classStudents.length} dari ${classStudents.length} siswa telah dinilai`
            : `${assessmentItems.length} dari ${assessmentItems.length} butir telah dinilai • Nilai ${finalScore}`
        );

        completionPanel.append(checkIcon, titleText, summaryText);

        if (!isLastStudent) {
          const nextStudent = classStudents[classUi.activeAssessmentStudentIndex + 1];
          const nextSection = createElement("div", "completion-next-box");
          nextSection.append(
            createElement("p", "text-xs text-subtle font-medium uppercase tracking-wider", "Berikutnya:"),
            createElement("p", "font-bold text-base text-slate-900 dark:text-slate-100 mt-0.5", nextStudent.name)
          );

          const continueBtn = createElement("button", "primary-action completion-continue-btn", `Lanjut ke ${nextStudent.name} →`);
          continueBtn.type = "button";
          continueBtn.addEventListener("click", () => {
            classUi.activeAssessmentStudentIndex++;
            classUi.activeAssessmentItemIndex = 0;
            classUi.completedStudentId = null;
            render();
          });

          const editLinkBtn = createElement("button", "btn-tool text-xs mt-2", `✏ Lihat / Edit Nilai ${currentStudent.name}`);
          editLinkBtn.type = "button";
          editLinkBtn.addEventListener("click", () => {
            classUi.completedStudentId = null;
            classUi.activeAssessmentItemIndex = assessmentItems.length - 1;
            render();
          });

          completionPanel.append(nextSection, continueBtn, editLinkBtn);
        } else {
          const finishBtn = createElement("button", "primary-action completion-continue-btn", "Kembali ke Asesmen");
          finishBtn.type = "button";
          finishBtn.addEventListener("click", () => {
            classUi.completedStudentId = null;
            classUi.activeAssessmentSessionId = null;
            render();
          });

          const editLinkBtn = createElement("button", "btn-tool text-xs mt-2", `✏ Lihat / Edit Nilai ${currentStudent.name}`);
          editLinkBtn.type = "button";
          editLinkBtn.addEventListener("click", () => {
            classUi.completedStudentId = null;
            classUi.activeAssessmentItemIndex = assessmentItems.length - 1;
            render();
          });

          completionPanel.append(finishBtn, editLinkBtn);
        }

        focusCard.append(completionPanel);
      } else {
        const itemFocusCard = createElement("div", "item-focus-card");

        const itemMetaRow = createElement("div", "item-number-header");
        itemMetaRow.append(
          createElement("span", "item-number-tag", "SOAL"),
          createElement("strong", "item-number-value", `${classUi.activeAssessmentItemIndex + 1} / ${assessmentItems.length}`)
        );
        itemFocusCard.append(itemMetaRow);

        const promptText = createElement("p", "item-prompt-text", currentItem.prompt || "Butir Asesmen");
        itemFocusCard.append(promptText);

        const defaultLevels = [
          { level: 1, label: "Perlu Bimbingan", desc: "Belum mengetahui atau belum mampu memberikan jawaban yang sesuai." },
          { level: 2, label: "Mulai Berkembang", desc: "Sudah mencoba menjawab, tetapi jawaban masih belum tepat." },
          { level: 3, label: "Cukup", desc: "Jawaban belum sepenuhnya benar, tetapi sudah masuk pada konteks yang dinilai." },
          { level: 4, label: "Baik", desc: "Mampu memberikan jawaban yang benar secara sederhana." },
          { level: 5, label: "Sangat Baik", desc: "Mampu memberikan jawaban yang benar, tepat, dan jelas." }
        ];

        const levels = Array.isArray(currentItem.rubricLevels) && currentItem.rubricLevels.length > 0
          ? currentItem.rubricLevels
          : defaultLevels.slice(0, Number(currentItem.rubricScale) || 5);

        const existingItemResult = currentItemResults.find((ir) => ir.itemId === currentItem.id);
        const selectedRubricLevel = existingItemResult ? existingItemResult.rubricLevel : null;

        const compactRubricWrap = createElement("div", "compact-rubric-wrap");
        const scoreActionHeader = createElement("p", "score-action-label", "PILIH SKOR");
        const rubricBar = createElement("div", "compact-rubric-bar");

        const helpBox = createElement("div", "compact-rubric-help-box");

        function getHelpTextContent(lvl) {
          if (lvl) {
            return `${lvl.level} — ${lvl.label || `Level ${lvl.level}`}: ${lvl.desc || "Tidak ada deskripsi."}`;
          }
          if (selectedRubricLevel) {
            const selLvl = levels.find((l) => l.level === selectedRubricLevel);
            if (selLvl) {
              return `${selLvl.level} — ${selLvl.label || `Level ${selLvl.level}`}: ${selLvl.desc || ""}`;
            }
          }
          return "Pilih skor 1–5 berdasarkan rubrik penilaian di atas.";
        }

        const helpText = createElement("p", "text-xs text-subtle leading-normal font-medium", getHelpTextContent(null));
        helpBox.append(helpText);

        const noteDisclosure = createElement("details", "item-note-disclosure");
        const noteSummary = createElement("summary", "item-note-summary", "+ Tambah Catatan");

        if (existingItemResult?.note) {
          noteDisclosure.open = true;
          noteSummary.textContent = "📝 Catatan Observasi";
        }

        const itemNoteInput = document.createElement("input");
        itemNoteInput.type = "text";
        itemNoteInput.className = "input-text text-xs mt-2";
        itemNoteInput.placeholder = "Catatan observasi untuk butir pertanyaan ini...";
        itemNoteInput.value = existingItemResult?.note || "";

        noteDisclosure.append(noteSummary, itemNoteInput);

        levels.forEach((lvl) => {
          const isSelected = selectedRubricLevel === lvl.level;
          const rBtn = createElement(
            "button",
            `compact-rubric-btn level-${lvl.level} ${isSelected ? "is-selected" : ""}`
          );
          rBtn.type = "button";
          if (lvl.desc) rBtn.title = lvl.desc;

          rBtn.append(
            createElement("span", "compact-rubric-num", String(lvl.level)),
            createElement("span", "compact-rubric-short-label", lvl.label || `Level ${lvl.level}`)
          );

          rBtn.addEventListener("mouseenter", () => {
            helpText.textContent = getHelpTextContent(lvl);
          });
          rBtn.addEventListener("mouseleave", () => {
            helpText.textContent = getHelpTextContent(null);
          });

          rBtn.addEventListener("click", () => {
            const chosenLevel = Number(lvl.level);
            const noteVal = itemNoteInput.value.trim();

            const nextItemResults = [...currentItemResults];
            const existingIdx = nextItemResults.findIndex((ir) => ir.itemId === currentItem.id);
            const itemPayload = {
              itemId: currentItem.id,
              rubricLevel: chosenLevel,
              note: noteVal
            };
            if (existingIdx >= 0) {
              nextItemResults[existingIdx] = itemPayload;
            } else {
              nextItemResults.push(itemPayload);
            }

            const validResults = nextItemResults.filter(
              (ir) => ir.rubricLevel !== undefined && ir.rubricLevel !== null && !Number.isNaN(Number(ir.rubricLevel))
            );

            const sum = validResults.reduce((acc, curr) => acc + Number(curr.rubricLevel), 0);
            const avg = validResults.length > 0 ? Math.round((sum / validResults.length) * 100) / 100 : null;

            const isAllComplete = assessmentItems.length > 0 && assessmentItems.every((it) =>
              nextItemResults.some((ir) => ir.itemId === it.id && ir.rubricLevel !== undefined && ir.rubricLevel !== null && !Number.isNaN(Number(ir.rubricLevel)))
            );

            const scale = Number(currentItem.rubricScale) || 5;
            const numericScore = isAllComplete && avg !== null
              ? Math.round((avg / scale) * 100)
              : null;

            const formattedValue = isAllComplete
              ? `Nilai ${numericScore}`
              : `${validResults.length}/${assessmentItems.length} butir`;

            const currentItemIdx = classUi.activeAssessmentItemIndex;
            const isLastItem = currentItemIdx === assessmentItems.length - 1;

            if (isLastItem) {
              classUi.completedStudentId = currentStudent.id;
            } else {
              classUi.activeAssessmentItemIndex++;
              classUi.completedStudentId = null;
            }

            if (actions?.saveAssessmentResult) {
              actions.saveAssessmentResult({
                assessmentSessionId: as.id,
                definitionId: as.definitionId || "",
                studentId: currentStudent.id,
                itemResults: nextItemResults,
                averageRubricScore: avg,
                numericScore,
                value: isAllComplete ? String(numericScore) : "",
                numericValue: isAllComplete ? numericScore : null,
                formattedValue,
                note: currentResult?.note || ""
              });
              if (!isLastItem) {
                showToast(`✓ Butir ${currentItemIdx + 1} tersimpan • lanjut ke Butir ${currentItemIdx + 2}`, 1800);
              }
            }
          });

          rubricBar.append(rBtn);
        });

        compactRubricWrap.append(scoreActionHeader, rubricBar, helpBox);
        itemFocusCard.append(compactRubricWrap, noteDisclosure);
        focusCard.append(itemFocusCard);

        // Bottom Prev / Next Nav for items
        const navButtons = createElement("div", "scoring-nav-buttons mt-4 flex items-center justify-between");
        const prevItemBtn = createElement("button", "btn-tool", "← Pertanyaan Sebelumnya");
        prevItemBtn.type = "button";
        prevItemBtn.disabled = classUi.activeAssessmentItemIndex === 0;
        prevItemBtn.addEventListener("click", () => {
          if (classUi.activeAssessmentItemIndex > 0) {
            classUi.activeAssessmentItemIndex--;
            classUi.completedStudentId = null;
            render();
          }
        });

        const nextItemBtn = createElement("button", "btn-tool", "Pertanyaan Berikutnya →");
        nextItemBtn.type = "button";
        nextItemBtn.disabled = classUi.activeAssessmentItemIndex === assessmentItems.length - 1;
        nextItemBtn.addEventListener("click", () => {
          if (classUi.activeAssessmentItemIndex < assessmentItems.length - 1) {
            classUi.activeAssessmentItemIndex++;
            classUi.completedStudentId = null;
            render();
          }
        });

        navButtons.append(prevItemBtn, nextItemBtn);
        focusCard.append(navButtons);
      }
    } else {
      // Legacy Scoring Controls
      const scoreBadge = createElement(
        "span",
        `assess-score-badge ${currentResult?.value ? "badge-has-score" : ""}`,
        currentResult?.formattedValue || "Belum dinilai"
      );
      studentHeader.append(profileWrap, scoreBadge);
      focusCard.append(studentHeader);

      const noteField = createElement("label", "field");
      noteField.append(createElement("span", "field-label", "Catatan Evaluasi Guru (Opsional)"));
      const noteInput = document.createElement("input");
      noteInput.type = "text";
      noteInput.className = "input-text";
      noteInput.placeholder = "Catatan evaluasi khusus...";
      if (currentResult?.note) {
        noteInput.value = currentResult.note;
      }
      noteField.append(noteInput);

      const method = def?.method || "rubric";
      if (method === "rubric") {
        const defaultRubricLevels = [
          { level: 1, label: "Belum Berkembang", desc: "Belum menunjukkan kemampuan yang dinilai dan masih memerlukan bimbingan penuh." },
          { level: 2, label: "Mulai Berkembang", desc: "Mulai menunjukkan kemampuan tetapi masih memerlukan banyak arahan atau bantuan." },
          { level: 3, label: "Cukup Berkembang", desc: "Mampu menunjukkan kemampuan utama dengan cukup baik, meskipun belum konsisten." },
          { level: 4, label: "Berkembang Baik", desc: "Mampu menunjukkan kemampuan dengan baik dan relatif mandiri." },
          { level: 5, label: "Berkembang Sangat Baik", desc: "Mampu menunjukkan kemampuan dengan sangat baik, mandiri, dan konsisten." }
        ];

        const levels = as.rubricSnapshot?.levels?.length > 0
          ? as.rubricSnapshot.levels
          : (def?.rubricLevels?.length > 0 ? def.rubricLevels : defaultRubricLevels);

        const rubricGrid = createElement("div", "scoring-rubric-grid");

        levels.forEach((lvl) => {
          const isSelected = currentResult?.rubricLevel === lvl.level;
          const rBtn = createElement(
            "button",
            `scoring-rubric-btn level-${lvl.level} ${isSelected ? "is-selected" : ""}`
          );
          rBtn.type = "button";
          if (lvl.desc) rBtn.title = lvl.desc;

          rBtn.append(
            createElement("span", "scoring-rubric-num", String(lvl.level)),
            createElement("span", "scoring-rubric-label", lvl.label)
          );

          rBtn.addEventListener("click", () => {
            if (classUi.activeAssessmentStudentIndex < classStudents.length - 1) {
              classUi.activeAssessmentStudentIndex++;
            }

            if (actions?.saveAssessmentResult) {
              actions.saveAssessmentResult({
                assessmentSessionId: as.id,
                definitionId: as.definitionId || "",
                studentId: currentStudent.id,
                value: String(lvl.level),
                numericValue: lvl.level,
                rubricLevel: lvl.level,
                formattedValue: `Skala ${lvl.level} (${lvl.label})`,
                note: noteInput.value.trim()
              });
              showToast("✓ Nilai tersimpan", 1800);
            }
          });

          rubricGrid.append(rBtn);
        });

        const rubricInstruction = createElement(
          "p",
          "text-xs text-subtle font-medium mt-3 mb-1",
          "Ketuk nilai untuk menyimpan dan lanjut otomatis."
        );
        focusCard.append(rubricInstruction, rubricGrid);
      } else {
        const numRow = createElement("div", "assess-num-row");
        const valInput = document.createElement("input");
        valInput.type = "number";
        valInput.step = method === "stopwatch" ? "0.01" : "1";
        valInput.className = "assess-num-input";
        valInput.placeholder = `Nilai (${def?.unit || ""})`;
        if (currentResult?.value !== undefined && currentResult?.value !== null) {
          valInput.value = currentResult.value;
        }

        const saveBtn = createElement("button", "primary-action compact-action", "Simpan Nilai");
        saveBtn.type = "button";
        saveBtn.addEventListener("click", () => {
          const val = valInput.value.trim();
          if (!val) return;
          const num = parseFloat(val);
          if (classUi.activeAssessmentStudentIndex < classStudents.length - 1) {
            classUi.activeAssessmentStudentIndex++;
          }
          if (actions?.saveAssessmentResult) {
            actions.saveAssessmentResult({
              assessmentSessionId: as.id,
              definitionId: as.definitionId || "",
              studentId: currentStudent.id,
              value: val,
              numericValue: isNaN(num) ? null : num,
              formattedValue: `${val} ${def?.unit || ""}`.trim(),
              note: noteInput.value.trim()
            });
          }
        });

        numRow.append(valInput, saveBtn);
        focusCard.append(numRow);
      }

      focusCard.append(noteField);

      // Bottom Prev / Next Nav for Students
      const navButtons = createElement("div", "scoring-nav-buttons");
      const prevBtn = createElement("button", "btn-tool", "← Siswa Sebelumnya");
      prevBtn.type = "button";
      prevBtn.disabled = classUi.activeAssessmentStudentIndex === 0;
      prevBtn.addEventListener("click", () => {
        if (classUi.activeAssessmentStudentIndex > 0) {
          classUi.activeAssessmentStudentIndex--;
          render();
        }
      });

      const nextBtn = createElement("button", "btn-tool", "Siswa Berikutnya →");
      nextBtn.type = "button";
      nextBtn.disabled = classUi.activeAssessmentStudentIndex === classStudents.length - 1;
      nextBtn.addEventListener("click", () => {
        if (classUi.activeAssessmentStudentIndex < classStudents.length - 1) {
          classUi.activeAssessmentStudentIndex++;
          render();
        }
      });

      navButtons.append(prevBtn, nextBtn);
      focusCard.append(navButtons);
    }

    container.append(focusCard);
  }

  render();
  return screen;
}

function createPillStat(label, value, icon) {
  const pill = createElement("div", "class-pill-stat");
  if (icon) pill.append(icon);
  pill.append(createElement("strong", "", String(value)));
  pill.append(createElement("span", "", label));
  return pill;
}

export function buildSelectedReportContext({
  student,
  classRoom,
  assessmentSelections = [],
  growthSelections = [],
  observationSelections = [],
  allGrowthRecords = []
}) {
  const rawGrade = classRoom?.grade;
  const gradeNumber =
    rawGrade !== "" &&
    rawGrade !== null &&
    rawGrade !== undefined
      ? Number(rawGrade)
      : null;

  const hasAssessments = (assessmentSelections || []).length > 0;
  const hasObservations = (observationSelections || []).length > 0;
  const hasGrowth = (growthSelections || []).length > 0;

  const selectedSections = {
    learning: hasAssessments,
    understanding: hasAssessments,
    attitude: hasObservations,
    growth: hasGrowth
  };

  let normalizedGender = null;
  const rawGender = typeof student?.gender === "string" ? student.gender.trim().toLowerCase() : "";
  if (rawGender === "male" || rawGender === "female") {
    normalizedGender = rawGender;
  }

  const studentData = {
    id: student?.id || "",
    name: student?.name || "",
    studentNumber: student?.studentNumber || "",
    gender: normalizedGender,
    birthDate: student?.birthDate || "",
    gradeLevel:
      gradeNumber !== null && Number.isFinite(gradeNumber)
        ? gradeNumber
        : null,
    className: classRoom?.name || ""
  };

  const assessments = hasAssessments
    ? (assessmentSelections || []).map(({ result, assessmentSession: sess, definition: def }) => {
        const isComplete = result?.numericScore !== null && result?.numericScore !== undefined;
        
        const items = (sess?.itemsSnapshot || []).map((item) => {
          const itemResult = (result?.itemResults || []).find((ir) => ir.itemId === item.id);
          const hasRating =
            itemResult?.rubricLevel !== null &&
            itemResult?.rubricLevel !== undefined &&
            !Number.isNaN(Number(itemResult.rubricLevel));

          let rubricLevel = null;
          let rubricLabel = "";
          let rubricDescription = "";
          let teacherNote = "";

          if (hasRating) {
            rubricLevel = Number(itemResult.rubricLevel);
            const matchedLevel = (item.rubricLevels || []).find(
              (lvl) => Number(lvl.level) === rubricLevel
            );
            rubricLabel = matchedLevel?.label || `Level ${rubricLevel}`;
            rubricDescription = matchedLevel?.desc || "";
            teacherNote = itemResult.note || "";
          }

          const itemRubricLevels = Array.isArray(item.rubricLevels)
            ? item.rubricLevels.map((lvl) => ({
                level: Number(lvl.level),
                label: lvl.label || `Level ${lvl.level}`,
                description: lvl.desc || lvl.description || ""
              }))
            : [];

          return {
            itemId: item.id || "",
            prompt: item.prompt || item.title || item.question || "",
            rubricScale: Number(item.rubricScale) || 5,
            rubricLevel,
            rubricLabel,
            rubricDescription,
            teacherNote,
            rubricLevels: itemRubricLevels
          };
        });

        return {
          assessmentSessionId: sess?.id || "",
          title: sess?.title || "",
          date: sess?.date || result?.recordedAt || "",
          purpose: sess?.purpose || "",
          materials: sess?.materials || def?.materials || [],
          assessmentType: def?.assessmentType || sess?.assessmentType || "",
          numericScore: isComplete ? Number(result.numericScore) : null,
          averageRubricScore:
            result?.averageRubricScore !== null &&
            result?.averageRubricScore !== undefined &&
            !Number.isNaN(Number(result.averageRubricScore))
              ? Number(result.averageRubricScore)
              : null,
          complete: isComplete,
          items,
          teacherNote: result?.note || ""
        };
      })
    : [];

  const growth = hasGrowth
    ? (growthSelections || []).map((g) => ({
        id: g.id || "",
        date: g.date || "",
        heightCm: g.heightCm ? String(g.heightCm) : "",
        weightKg: g.weightKg ? String(g.weightKg) : "",
        bmi: g.bmi !== undefined && g.bmi !== null ? g.bmi : null,
        note: g.note || ""
      }))
    : [];

  const observations = hasObservations
    ? (observationSelections || []).map((o) => ({
        id: o.id || "",
        recordedAt: o.recordedAt || o.date || "",
        type: o.type || "umum",
        text: o.text || ""
      }))
    : [];

  const growthAnalysis = analyzeGrowth(student, growthSelections, allGrowthRecords);

  return {
    student: studentData,
    selectedSections,
    assessments,
    growth,
    observations,
    growthAnalysis,
    growthSummary: growthAnalysis.growthSummary
  };
}

