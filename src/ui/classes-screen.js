import { createField, createSelectField, formToObject } from "./form-controls.js";
import { createPhotoPickerField } from "./student-photo-field.js";
import { createStudentAvatar } from "./student-avatar.js";
import { ICONS } from "./icons.js";
import { generateRubricWithAI } from "../services/rubric-ai-service.js";

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

  const container = createElement("div", "classes-hub-container");
  screen.append(container);

  function render() {
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
      openBtn.append(ICONS.users(16), document.createTextNode(" Buka Siswa"));
      openBtn.addEventListener("click", () => {
        classUi.selectedClassId = c.id;
        classUi.mode = "detail";
        render();
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
      classUi.selectedClassId = null;
      classUi.mode = "list";
      classUi.activeAssessmentSessionId = null;
      render();
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
      classUi.mode = "create-assessment";
      render();
    });

    const growthScreeningBtn = createElement("button", "btn-tool");
    growthScreeningBtn.type = "button";
    growthScreeningBtn.append(ICONS.chart(15), document.createTextNode(" Pemeriksaan Pertumbuhan"));
    growthScreeningBtn.addEventListener("click", () => {
      classUi.mode = "growth";
      render();
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
        const subEl = createElement("span", "student-card-sub", `NIS: ${student.studentNumber || "-"} • ${student.gender === "female" ? "Perempuan" : "Laki-laki"}`);

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
    const header = createElement("div", "results-center-header space-y-1 mb-4");
    header.append(
      createElement("h2", "sub-title font-bold text-base", "Hasil & Laporan"),
      createElement(
        "p",
        "text-subtle text-xs",
        "Lihat seluruh hasil asesmen, pertumbuhan, dan observasi siswa dalam satu tempat. Pilih siswa untuk menyiapkan sumber data laporan."
      )
    );
    container.append(header);

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
          `NIS: ${student.studentNumber || "-"} • ${student.gender === "female" ? "Perempuan" : "Laki-laki"}`
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
        textCol.append(statsRow);

        infoRow.append(avatar, textCol);

        const actionsCol = createElement("div", "results-student-card-actions");
        const openBtn = createElement("button", "btn-tool btn-tool-primary", "Buka Rekap");
        openBtn.type = "button";
        openBtn.addEventListener("click", () => {
          if (classUi.reportStudentId !== student.id) {
            classUi.reportSelection = {
              assessmentSessionIds: [],
              growthRecordIds: [],
              observationIds: []
            };
          }
          classUi.reportStudentId = student.id;
          classUi.mode = "report-student";
          render();
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
      classUi.reportStudentId = null;
      classUi.mode = "detail";
      classUi.activeTab = "reports";
      render();
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
        `${classRoom.name} • NIS: ${student.studentNumber || "-"} • ${student.gender === "female" ? "Perempuan" : "Laki-laki"}`
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
        
        // Left Checkbox & Title
        const leftBox = createElement("div", "flex items-start gap-3 flex-1");
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
        const leftBox = createElement("div", "flex items-center gap-3");
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
        const leftBox = createElement("div", "flex items-start gap-3 flex-1");
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

    const btnRow = createElement("div", "report-summary-btn-row flex flex-wrap gap-3 mt-4 items-center");
    
    const previewToggleBtn = createElement("button", "btn-tool text-xs", "Lihat Data Terpilih");
    previewToggleBtn.type = "button";

    const aiReportBtn = createElement("button", "primary-action compact-action opacity-60 cursor-not-allowed", "✨ Buat Laporan AI");
    aiReportBtn.type = "button";
    aiReportBtn.disabled = true;

    btnRow.append(previewToggleBtn, aiReportBtn);
    summaryPanel.append(btnRow);

    const aiHelperText = createElement(
      "p",
      "text-subtle text-xs mt-2",
      "Fitur pembuatan laporan AI akan diaktifkan setelah sumber data laporan diverifikasi."
    );
    summaryPanel.append(aiHelperText);

    // Preview Container
    const previewContainer = createElement("div", "report-preview-container report-preview-panel mt-4 pt-4 border-t border-slate-200 dark:border-slate-800");
    summaryPanel.append(previewContainer);

    function updateSummaryAndPreview() {
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
        observationSelections: selectedObs
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

    previewToggleBtn.addEventListener("click", () => {
      const aCount = (classUi.reportSelection.assessmentSessionIds || []).length;
      const gCount = (classUi.reportSelection.growthRecordIds || []).length;
      const oCount = (classUi.reportSelection.observationIds || []).length;
      if (aCount + gCount + oCount === 0) return;
      isPreviewOpen = !isPreviewOpen;
      updateSummaryAndPreview();
    });

    updateSummaryAndPreview();
    container.append(summaryPanel);
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

  function renderAddStudentModal(classRoom) {
    const backdrop = createElement("div", "modal-backdrop");
    const modal = createElement("div", "modal-card");

    const header = createElement("div", "modal-header-row");
    header.append(createElement("h2", "modal-title", `Tambah Siswa ke ${classRoom.name}`));
    const closeBtn = createElement("button", "modal-close-btn", "✕");
    closeBtn.addEventListener("click", () => {
      showAddStudentModal = false;
      render();
    });
    header.append(closeBtn);
    modal.append(header);

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
        actions.createStudent({
          ...payload,
          classId: classRoom.id,
          photo
        });
      }
      showAddStudentModal = false;
      render();
    });

    modal.append(form);
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
      classUi.mode = "detail";
      render();
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
        <th style="width: 170px;">Tinggi Badan (cm)</th>
        <th style="width: 170px;">Berat Badan (kg)</th>
        <th style="width: 170px;">Data Terakhir</th>
      </tr>
    `;
    table.append(thead);

    const tbody = createElement("tbody");
    const studentInputs = [];

    classStudents.forEach((student, idx) => {
      const tr = createElement("tr");

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
      const tdIdx = createElement("td", "text-center text-subtle", `${idx + 1}`);

      // Col 2: Student
      const tdStudent = createElement("td");
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
      const tdHeight = createElement("td");
      const hInput = document.createElement("input");
      hInput.type = "number";
      hInput.step = "0.1";
      hInput.min = "0";
      hInput.className = "screening-num-input";
      hInput.placeholder = "TB (cm)";
      if (prevHeight !== "") {
        hInput.defaultValue = prevHeight;
      }
      tdHeight.append(hInput);

      // Col 4: Weight
      const tdWeight = createElement("td");
      const wInput = document.createElement("input");
      wInput.type = "number";
      wInput.step = "0.1";
      wInput.min = "0";
      wInput.className = "screening-num-input";
      wInput.placeholder = "BB (kg)";
      if (prevWeight !== "") {
        wInput.defaultValue = prevWeight;
      }
      tdWeight.append(wInput);

      // Col 5: Last recorded
      const tdPrev = createElement("td", "text-subtle text-xs", prevInfo);

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
      classUi.mode = "detail";
      render();
    });

    actionsBar.append(saveBtn, cancelBtn);
    form.append(actionsBar);

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

      window.alert(`Berhasil menyimpan pemeriksaan pertumbuhan untuk ${recordsToSave.length} siswa.`);
      classUi.mode = "detail";
      render();
    });

    container.append(form);
  }

  function renderClassAssessmentsList(assessments, classRoom, students) {
    if (assessments.length === 0) {
      const emptyCard = createElement("div", "empty-state-card");
      emptyCard.append(
        createElement("p", "empty-copy", `Belum ada asesmen yang dijadwalkan untuk ${classRoom.name}.`),
        createElement(
          "p",
          "screen-copy",
          "Tambahkan instrumen dan rubrik penilaian langsung untuk mulai mengukur capaian pembelajaran siswa di kelas ini."
        )
      );

      const addBtn = createElement("button", "primary-action compact-action");
      addBtn.type = "button";
      addBtn.append(ICONS.plus(15), document.createTextNode(" Tambah Asesmen"));
      addBtn.addEventListener("click", () => {
        classUi.mode = "create-assessment";
        render();
      });
      emptyCard.append(addBtn);

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

    const listHeader = createElement("div", "flex items-center justify-between mb-4");
    const heading = createElement("h3", "section-title", `Daftar Asesmen (${assessments.length})`);
    const addBtn = createElement("button", "primary-action compact-action");
    addBtn.type = "button";
    addBtn.append(ICONS.plus(15), document.createTextNode(" Tambah Asesmen"));
    addBtn.addEventListener("click", () => {
      classUi.mode = "create-assessment";
      render();
    });
    listHeader.append(heading, addBtn);
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

      const actionRow = createElement("div", "assessment-card-actions");
      const startBtn = createElement("button", "primary-action compact-action", scoredCount > 0 ? "Lanjutkan Penilaian" : "Mulai Penilaian");
      startBtn.type = "button";
      startBtn.addEventListener("click", () => {
        classUi.activeAssessmentSessionId = as.id;
        classUi.activeAssessmentStudentIndex = 0;
        classUi.activeAssessmentItemIndex = 0;
        classUi.mode = "scoring";
        render();
      });

      actionRow.append(startBtn);
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
      classUi.mode = "detail";
      render();
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

    const aiKeyField = createElement("div", "field");
    const aiKeyLabel = createElement("label", "font-medium text-xs", "Gemini API Key");

    const aiKeyRow = createElement("div", "ai-rubric-key-row");

    const aiKeyInput = document.createElement("input");
    aiKeyInput.type = "password";
    aiKeyInput.className = "input-text";
    aiKeyInput.placeholder = "Masukkan Gemini API Key";
    aiKeyInput.value = rubricAiApiKey;

    const toggleShowKeyBtn = createElement("button", "btn-tool text-xs", "👁️ Tampilkan");
    toggleShowKeyBtn.type = "button";
    toggleShowKeyBtn.addEventListener("click", () => {
      if (aiKeyInput.type === "password") {
        aiKeyInput.type = "text";
        toggleShowKeyBtn.textContent = "🙈 Sembunyikan";
      } else {
        aiKeyInput.type = "password";
        toggleShowKeyBtn.textContent = "👁️ Tampilkan";
      }
    });

    const saveKeyBtn = createElement("button", "btn-tool btn-tool-primary text-xs", "Simpan Key untuk Sesi Ini");
    saveKeyBtn.type = "button";

    aiKeyRow.append(aiKeyInput, toggleShowKeyBtn, saveKeyBtn);

    const aiKeyHelper = createElement(
      "p",
      "text-subtle text-xs mt-1",
      "API key hanya digunakan pada tab ini dan tidak disimpan ke data aplikasi."
    );

    const aiStatus = createElement(
      "p",
      "ai-rubric-status",
      rubricAiApiKey
        ? "API key siap digunakan pada sesi ini."
        : "Masukkan Gemini API Key untuk menggunakan Generate Rubrik AI."
    );

    saveKeyBtn.addEventListener("click", () => {
      const value = aiKeyInput.value.trim();
      if (!value) {
        window.alert("Masukkan Gemini API Key.");
        return;
      }
      rubricAiApiKey = value;
      try {
        window.sessionStorage.setItem("pjok_gemini_api_key", value);
      } catch (_) {
        // Jangan gagalkan jika sessionStorage tidak tersedia
      }
      aiStatus.textContent = "API key siap digunakan pada sesi ini.";
    });

    aiKeyField.append(aiKeyLabel, aiKeyRow, aiKeyHelper, aiStatus);
    aiConfigPanel.append(aiConfigHeader, aiKeyField);
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

          let apiKey = rubricAiApiKey.trim();
          if (!apiKey) {
            try {
              apiKey = window.sessionStorage.getItem("pjok_gemini_api_key") || "";
            } catch (_) {}
          }

          if (!apiKey) {
            aiStatus.textContent = "Masukkan Gemini API Key terlebih dahulu.";
            aiKeyInput.focus();
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
            aiStatus.textContent = `AI gagal: ${message}`;
            if (err?.isApiKeyError) {
              rubricAiApiKey = "";
              try {
                window.sessionStorage.removeItem("pjok_gemini_api_key");
              } catch (_) {}
              aiKeyInput.value = "";
              aiStatus.textContent = "API key ditolak. Masukkan API key yang valid.";
            }
            window.alert(`Rubrik AI gagal dibuat.\n\nDetail: ${message}`);
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
      classUi.mode = "detail";
      render();
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

      classUi.mode = "detail";
      classUi.activeTab = "assessments";
      render();
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
      classUi.activeAssessmentSessionId = null;
      classUi.mode = "detail";
      classUi.activeTab = "assessments";
      render();
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
      const refBox = createElement("div", "scoring-reference-box");
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
      container.append(refBox);
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
    stepperBar.append(
      createElement("div", "student-stepper-counter", `Siswa ${classUi.activeAssessmentStudentIndex + 1} dari ${classStudents.length}`)
    );

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
      createElement("h2", "font-bold text-lg", currentStudent.name),
      createElement("div", "text-subtle text-xs", `NIS: ${currentStudent.studentNumber || "-"} • ${currentStudent.gender === "female" ? "Perempuan" : "Laki-laki"}`)
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

      const scoreBadgeWrap = createElement("div", "text-right");
      if (allItemsComplete) {
        const scale = Number(currentItem.rubricScale) || 5;
        const finalScore = currentResult?.numericScore !== null && currentResult?.numericScore !== undefined
          ? currentResult.numericScore
          : (currentResult?.averageRubricScore ? Math.round((currentResult.averageRubricScore / scale) * 100) : 0);
        const avgScore = currentResult?.averageRubricScore ? Number(currentResult.averageRubricScore).toFixed(2) : "0.00";

        scoreBadgeWrap.append(
          createElement("span", "assess-score-badge badge-has-score block text-sm font-bold", `Nilai ${finalScore}`),
          createElement("span", "text-xs text-subtle font-medium mt-1 block", `Rata-rata Rubrik ${avgScore} / ${scale}`)
        );
      } else {
        scoreBadgeWrap.append(
          createElement(
            "span",
            `assess-score-badge ${completedItemCount > 0 ? "badge-has-score" : ""}`,
            completedItemCount > 0 ? `${completedItemCount} dari ${assessmentItems.length} pertanyaan selesai` : "Belum dinilai"
          )
        );
      }

      studentHeader.append(profileWrap, scoreBadgeWrap);
      focusCard.append(studentHeader);

      const itemFocusCard = createElement("div", "mt-4 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4");

      const itemMetaRow = createElement("div", "flex items-center justify-between text-xs text-subtle font-medium border-b border-slate-100 dark:border-slate-800 pb-2");
      itemMetaRow.append(
        createElement("span", "font-bold text-slate-700 dark:text-slate-300", `Pertanyaan ${classUi.activeAssessmentItemIndex + 1} dari ${assessmentItems.length}`),
        createElement("span", "badge-subtle", `Skala 1–${currentItem.rubricScale || 5}`)
      );
      itemFocusCard.append(itemMetaRow);

      const promptText = createElement("p", "text-base font-semibold text-slate-900 dark:text-slate-100 leading-snug", currentItem.prompt || "Butir Asesmen");
      itemFocusCard.append(promptText);

      const defaultLevels = [
        { level: 1, label: "Belum Berkembang", desc: "Belum mengetahui atau belum mampu memberikan jawaban yang sesuai." },
        { level: 2, label: "Mulai Berkembang", desc: "Sudah mencoba menjawab, tetapi jawaban masih belum tepat." },
        { level: 3, label: "Cukup Berkembang", desc: "Jawaban belum sepenuhnya benar, tetapi sudah masuk pada konteks yang dinilai." },
        { level: 4, label: "Berkembang Baik", desc: "Mampu memberikan jawaban yang benar secara sederhana." },
        { level: 5, label: "Berkembang Sangat Baik", desc: "Mampu memberikan jawaban yang benar, tepat, dan jelas." }
      ];

      const levels = Array.isArray(currentItem.rubricLevels) && currentItem.rubricLevels.length > 0
        ? currentItem.rubricLevels
        : defaultLevels.slice(0, Number(currentItem.rubricScale) || 5);

      const existingItemResult = currentItemResults.find((ir) => ir.itemId === currentItem.id);
      const selectedRubricLevel = existingItemResult ? existingItemResult.rubricLevel : null;

      const rubricGrid = createElement("div", "scoring-rubric-grid");

      const itemNoteField = createElement("label", "field mt-3");
      itemNoteField.append(createElement("span", "field-label text-xs", "Catatan Jawaban / Observasi (Opsional)"));
      const itemNoteInput = document.createElement("input");
      itemNoteInput.type = "text";
      itemNoteInput.className = "input-text text-xs";
      itemNoteInput.placeholder = "Catatan observasi untuk butir pertanyaan ini...";
      itemNoteInput.value = existingItemResult?.note || "";
      itemNoteField.append(itemNoteInput);

      levels.forEach((lvl) => {
        const isSelected = selectedRubricLevel === lvl.level;
        const rBtn = createElement(
          "button",
          `scoring-rubric-btn level-${lvl.level} ${isSelected ? "is-selected" : ""}`
        );
        rBtn.type = "button";
        if (lvl.desc) rBtn.title = lvl.desc;

        rBtn.append(
          createElement("span", "scoring-rubric-num", String(lvl.level)),
          createElement("span", "scoring-rubric-label", lvl.label || `Level ${lvl.level}`)
        );
        if (lvl.desc) {
          rBtn.append(createElement("span", "text-xs text-subtle mt-1 text-left line-clamp-2", lvl.desc));
        }

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

          // 1. Calculate NEXT index position BEFORE calling saveAssessmentResult
          if (classUi.activeAssessmentItemIndex < assessmentItems.length - 1) {
            classUi.activeAssessmentItemIndex++;
          } else {
            classUi.activeAssessmentItemIndex = 0;
            if (classUi.activeAssessmentStudentIndex < classStudents.length - 1) {
              classUi.activeAssessmentStudentIndex++;
            }
          }

          // 2. Call saveAssessmentResult
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
          }
          // Do NOT call render() here because saveAssessmentResult triggers refreshState -> renderApp
        });

        rubricGrid.append(rBtn);
      });

      itemFocusCard.append(rubricGrid, itemNoteField);
      focusCard.append(itemFocusCard);

      // Bottom Prev / Next Nav for items
      const navButtons = createElement("div", "scoring-nav-buttons mt-4 flex items-center justify-between");
      const prevItemBtn = createElement("button", "btn-tool", "← Pertanyaan Sebelumnya");
      prevItemBtn.type = "button";
      prevItemBtn.disabled = classUi.activeAssessmentItemIndex === 0;
      prevItemBtn.addEventListener("click", () => {
        if (classUi.activeAssessmentItemIndex > 0) {
          classUi.activeAssessmentItemIndex--;
          render();
        }
      });

      const nextItemBtn = createElement("button", "btn-tool", "Pertanyaan Berikutnya →");
      nextItemBtn.type = "button";
      nextItemBtn.disabled = classUi.activeAssessmentItemIndex === assessmentItems.length - 1;
      nextItemBtn.addEventListener("click", () => {
        if (classUi.activeAssessmentItemIndex < assessmentItems.length - 1) {
          classUi.activeAssessmentItemIndex++;
          render();
        }
      });

      navButtons.append(prevItemBtn, nextItemBtn);
      focusCard.append(navButtons);
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
            }
          });

          rubricGrid.append(rBtn);
        });

        focusCard.append(rubricGrid);
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
  observationSelections = []
}) {
  const studentData = {
    id: student?.id || "",
    name: student?.name || "",
    studentNumber: student?.studentNumber || "",
    gender: student?.gender || "",
    birthDate: student?.birthDate || "",
    gradeLevel:
      classRoom?.gradeLevel !== undefined && classRoom?.gradeLevel !== null
        ? Number(classRoom.gradeLevel)
        : null,
    className: classRoom?.name || ""
  };

  const assessments = (assessmentSelections || []).map(({ result, assessmentSession: sess, definition: def }) => {
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

      return {
        itemId: item.id || "",
        prompt: item.prompt || item.title || item.question || "",
        rubricScale: Number(item.rubricScale) || 5,
        rubricLevel,
        rubricLabel,
        rubricDescription,
        teacherNote
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
  });

  const growth = (growthSelections || []).map((g) => ({
    id: g.id || "",
    date: g.date || "",
    heightCm: g.heightCm ? String(g.heightCm) : "",
    weightKg: g.weightKg ? String(g.weightKg) : "",
    bmi: g.bmi !== undefined && g.bmi !== null ? g.bmi : null,
    note: g.note || ""
  }));

  const observations = (observationSelections || []).map((o) => ({
    id: o.id || "",
    recordedAt: o.recordedAt || o.date || "",
    type: o.type || "umum",
    text: o.text || ""
  }));

  return {
    student: studentData,
    assessments,
    growth,
    observations
  };
}

