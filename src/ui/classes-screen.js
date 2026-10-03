import { createField, createSelectField, formToObject } from "./form-controls.js";
import { createPhotoPickerField } from "./student-photo-field.js";
import { createStudentAvatar } from "./student-avatar.js";
import { ICONS } from "./icons.js";

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

  // State local to screen for selected class
  let selectedClassId = null;
  let isGrowthScreening = false;
  let isCreatingAssessment = false;
  let activeAssessmentSessionId = null;
  let activeAssessmentStudentIndex = 0;
  let showAddClassModal = false;
  let showAddStudentModal = false;
  let activeTab = "students"; // "students" | "assessments" | "sessions"
  let studentSearchQuery = "";

  const container = createElement("div", "classes-hub-container");
  screen.append(container);

  function render() {
    container.replaceChildren();

    if (selectedClassId) {
      if (isGrowthScreening) {
        renderClassGrowthScreening(selectedClassId);
      } else if (isCreatingAssessment) {
        renderCreateAssessmentView(selectedClassId);
      } else if (activeAssessmentSessionId) {
        renderScoringWorkflowView(selectedClassId, activeAssessmentSessionId);
      } else {
        renderClassDetail(selectedClassId);
      }
    } else {
      isGrowthScreening = false;
      isCreatingAssessment = false;
      activeAssessmentSessionId = null;
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
        selectedClassId = c.id;
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
      selectedClassId = null;
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
      selectedClassId = null;
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
    createAssessBtn.append(ICONS.target(15), document.createTextNode(" Terapkan Rencana Asesmen"));
    createAssessBtn.addEventListener("click", () => {
      isCreatingAssessment = true;
      render();
    });

    const growthScreeningBtn = createElement("button", "btn-tool");
    growthScreeningBtn.type = "button";
    growthScreeningBtn.append(ICONS.chart(15), document.createTextNode(" Pemeriksaan Pertumbuhan"));
    growthScreeningBtn.addEventListener("click", () => {
      isGrowthScreening = true;
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
        selectedClassId = null;
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
      `subnav-tab ${activeTab === "students" ? "is-active" : ""}`,
      `Daftar Siswa (${classStudents.length})`
    );
    tabStudents.type = "button";
    tabStudents.addEventListener("click", () => {
      activeTab = "students";
      render();
    });

    const tabAssessments = createElement(
      "button",
      `subnav-tab ${activeTab === "assessments" ? "is-active" : ""}`,
      `Asesmen (${classAssessments.length})`
    );
    tabAssessments.type = "button";
    tabAssessments.addEventListener("click", () => {
      activeTab = "assessments";
      render();
    });

    const tabSessions = createElement(
      "button",
      `subnav-tab ${activeTab === "sessions" ? "is-active" : ""}`,
      `Riwayat Sesi (${classSessions.length})`
    );
    tabSessions.type = "button";
    tabSessions.addEventListener("click", () => {
      activeTab = "sessions";
      render();
    });

    tabsRow.append(tabStudents, tabAssessments, tabSessions);
    container.append(tabsRow);

    if (activeTab === "students") {
      renderClassStudentsList(classStudents, classRoom);
    } else if (activeTab === "assessments") {
      renderClassAssessmentsList(classAssessments, classRoom, classStudents);
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
    searchInput.value = studentSearchQuery;
    searchInput.addEventListener("input", (e) => {
      studentSearchQuery = e.target.value.toLowerCase();
      renderClassStudentsCards();
    });
    searchBar.append(searchInput);
    container.append(searchBar);

    const listContainer = createElement("div", "class-students-container");
    container.append(listContainer);

    function renderClassStudentsCards() {
      listContainer.replaceChildren();

      const filtered = students.filter((s) => {
        if (!studentSearchQuery) return true;
        return (
          (s.name || "").toLowerCase().includes(studentSearchQuery) ||
          (s.studentNumber || "").toLowerCase().includes(studentSearchQuery)
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
      isGrowthScreening = false;
      renderClassList();
      return;
    }

    const classStudents = (state.students || []).filter((s) => s.classId === classRoom.id);

    const backBtn = createElement("button", "btn-back-nav");
    backBtn.type = "button";
    backBtn.append(document.createTextNode(`← Kembali ke Detail ${classRoom.name}`));
    backBtn.addEventListener("click", () => {
      isGrowthScreening = false;
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
      isGrowthScreening = false;
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
      isGrowthScreening = false;
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
          "Pilih rencana asesmen dari menu Perencanaan Asesmen untuk mulai menilai siswa di kelas ini."
        )
      );

      const addBtn = createElement("button", "primary-action compact-action");
      addBtn.type = "button";
      addBtn.append(ICONS.target(15), document.createTextNode(" Terapkan Rencana Asesmen"));
      addBtn.addEventListener("click", () => {
        isCreatingAssessment = true;
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

    const grid = createElement("div", "assessment-sessions-grid");

    assessments.forEach((as) => {
      const def = (state.assessmentDefinitions || []).find((d) => d.id === as.definitionId);
      const card = createElement("article", "assessment-item-card");

      const topRow = createElement("div", "assessment-card-header");
      const titleGroup = createElement("div");

      const pLabel = purposeMap[as.purpose] || as.purpose || "Asesmen";
      const tLabel = typeMap[def?.assessmentType] || (def?.assessmentType || "Praktik");
      const mLabel = def?.method === "numeric" ? "Nilai Angka" : def?.method === "stopwatch" ? "Stopwatch" : (def?.rubricScale ? `Rubrik 1–${def.rubricScale}` : "Rubrik 1–5");

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

      // Progress calculation per assessmentSessionId
      const scoredCount = students.filter((st) =>
        (state.assessmentResults || []).some(
          (r) => r.assessmentSessionId === as.id && r.studentId === st.id && r.value !== "" && r.value !== undefined && r.value !== null
        )
      ).length;

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
        activeAssessmentSessionId = as.id;
        activeAssessmentStudentIndex = 0;
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
      isCreatingAssessment = false;
      renderClassList();
      return;
    }

    const backBtn = createElement("button", "btn-back-nav");
    backBtn.type = "button";
    backBtn.append(document.createTextNode(`← Kembali ke Detail ${classRoom.name}`));
    backBtn.addEventListener("click", () => {
      isCreatingAssessment = false;
      render();
    });
    container.append(backBtn);

    const header = createElement("header", "screen-header-row");
    const titleGroup = createElement("div");
    const eyebrow = createElement("p", "eyebrow");
    eyebrow.append(ICONS.target(15), document.createTextNode(" Pelaksanaan Asesmen Kelas"));
    titleGroup.append(
      eyebrow,
      createElement("h1", "screen-title", `Terapkan Asesmen: ${classRoom.name}`),
      createElement(
        "p",
        "screen-copy",
        `Pilih rencana asesmen yang telah dirancang untuk dilaksanakan dan dinilai pada siswa kelas ${classRoom.name}.`
      )
    );
    header.append(titleGroup);
    container.append(header);

    const plans = state.assessmentDefinitions || [];
    if (plans.length === 0) {
      const emptyCard = createElement("div", "empty-state-card");
      emptyCard.append(
        createElement("p", "empty-copy", "Belum ada Rencana Asesmen yang tersedia."),
        createElement(
          "p",
          "screen-copy",
          "Silakan buat rencana asesmen terlebih dahulu di menu Pengaturan → Perencanaan Asesmen untuk menentukan materi, bentuk tes, dan rubrik penilaian."
        )
      );
      container.append(emptyCard);
      return;
    }

    const purposeMap = {
      pretest: "Pretest",
      formative: "Formatif",
      posttest: "Posttest",
      midterm: "UTS",
      final: "UAS"
    };

    const typeMap = {
      written: "Tertulis",
      oral: "Lisan",
      practice: "Praktik",
      observation: "Observasi"
    };

    const form = createElement("form", "master-form");

    // Plan selector
    const planOptions = plans.map((p) => {
      const pLabel = purposeMap[p.purpose] || p.purpose || "Formatif";
      const tLabel = typeMap[p.assessmentType] || (p.assessmentType !== "unspecified" ? p.assessmentType : "Praktik");
      const mLabel = p.method === "numeric" ? "Nilai Angka" : p.method === "stopwatch" ? "Stopwatch" : `Rubrik 1–${p.rubricScale || 5}`;
      return {
        value: p.id,
        label: `${p.name} [${pLabel} • ${tLabel} • ${mLabel}]`
      };
    });

    let selectedPlanId = plans[0].id;
    let selectedPlan = plans[0];

    const planField = createSelectField({
      label: "Pilih Rencana Asesmen *",
      name: "definitionId",
      value: selectedPlanId,
      options: planOptions,
      required: true
    });

    const titleField = createField({
      label: "Judul Pelaksanaan di Kelas *",
      name: "title",
      value: selectedPlan.name,
      required: true
    });

    const dateField = createField({
      label: "Tanggal Pelaksanaan *",
      name: "date",
      type: "date",
      value: new Date().toISOString().slice(0, 10),
      required: true
    });

    form.append(planField, titleField, dateField);

    // Plan Details Preview Box
    const previewBox = createElement("div", "activity-template-preview");
    
    function updatePreview(plan) {
      previewBox.replaceChildren();
      if (!plan) return;

      const pLabel = purposeMap[plan.purpose] || plan.purpose || "Formatif";
      const tLabel = typeMap[plan.assessmentType] || plan.assessmentType || "Praktik";
      const mLabel = plan.method === "numeric" ? "Nilai Angka" : plan.method === "stopwatch" ? "Stopwatch" : `Rubrik Skala 1–${plan.rubricScale || 5}`;

      previewBox.append(
        createElement("h4", "sub-title text-sm font-semibold", "Rincian Rencana Terpilih:"),
        createElement("p", "screen-copy text-xs", `📋 Jenis & Bentuk: ${pLabel} • ${tLabel} • ${mLabel}`)
      );

      if (plan.materials && plan.materials.length > 0) {
        previewBox.append(
          createElement("p", "screen-copy text-xs", `🎯 Materi Pokok: ${plan.materials.join(", ")}`)
        );
      }

      if (plan.instructions) {
        previewBox.append(
          createElement("p", "screen-copy text-xs", `💡 Panduan: ${plan.instructions}`)
        );
      }

      if (plan.questions && plan.questions.length > 0) {
        const qList = createElement("div", "screen-copy text-xs");
        qList.append(createElement("strong", "", `📝 Butir Soal / Instrumen (${plan.questions.length}):`));
        const ul = document.createElement("ul");
        ul.className = "list-disc pl-5 mt-1 space-y-0.5";
        plan.questions.forEach((q) => {
          const li = document.createElement("li");
          li.textContent = q;
          ul.append(li);
        });
        qList.append(ul);
        previewBox.append(qList);
      }
    }

    updatePreview(selectedPlan);
    form.append(previewBox);

    const planSelectEl = planField.querySelector("select");
    if (planSelectEl) {
      planSelectEl.addEventListener("change", (e) => {
        selectedPlanId = e.target.value;
        selectedPlan = plans.find((p) => p.id === selectedPlanId) || plans[0];
        const titleInput = titleField.querySelector("input");
        if (titleInput) {
          titleInput.value = selectedPlan.name;
        }
        updatePreview(selectedPlan);
      });
    }

    // Action buttons
    const btnRow = createElement("div", "modal-btn-row");
    const submitBtn = createElement("button", "primary-action", "Terapkan & Jadwalkan Asesmen");
    submitBtn.type = "submit";

    const cancelBtn = createElement("button", "btn-tool", "Batal");
    cancelBtn.type = "button";
    cancelBtn.addEventListener("click", () => {
      isCreatingAssessment = false;
      render();
    });

    btnRow.append(submitBtn, cancelBtn);
    form.append(btnRow);

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const payload = formToObject(form);
      const chosenPlan = plans.find((p) => p.id === payload.definitionId) || selectedPlan;
      if (!chosenPlan) {
        window.alert("Pilih rencana asesmen terlebih dahulu.");
        return;
      }

      const title = (payload.title || chosenPlan.name).trim();
      const dateVal = payload.date || new Date().toISOString().slice(0, 10);

      if (actions?.createAssessmentSession) {
        actions.createAssessmentSession({
          classId: classRoom.id,
          definitionId: chosenPlan.id,
          date: dateVal,
          title,
          purpose: chosenPlan.purpose || "formative",
          materials: Array.isArray(chosenPlan.materials) ? chosenPlan.materials : [],
          questions: Array.isArray(chosenPlan.questions) ? chosenPlan.questions : [],
          instructions: chosenPlan.instructions || "",
          rubricSnapshot: {
            scale: chosenPlan.rubricScale || 5,
            levels: Array.isArray(chosenPlan.rubricLevels) ? chosenPlan.rubricLevels : []
          }
        });
      }

      isCreatingAssessment = false;
      activeTab = "assessments";
      render();
    });

    container.append(form);
  }

  function renderScoringWorkflowView(classId, assessSessId) {
    const classRoom = (state.classes || []).find((c) => c.id === classId);
    const as = (state.assessmentSessions || []).find((s) => s.id === assessSessId);
    if (!classRoom || !as) {
      activeAssessmentSessionId = null;
      render();
      return;
    }

    const classStudents = (state.students || []).filter((s) => s.classId === classRoom.id);
    const def = (state.assessmentDefinitions || []).find((d) => d.id === as.definitionId);

    const backBtn = createElement("button", "btn-back-nav");
    backBtn.type = "button";
    backBtn.append(document.createTextNode(`← Kembali ke Asesmen ${classRoom.name}`));
    backBtn.addEventListener("click", () => {
      activeAssessmentSessionId = null;
      activeTab = "assessments";
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
    if (activeAssessmentStudentIndex < 0) activeAssessmentStudentIndex = 0;
    if (activeAssessmentStudentIndex >= classStudents.length) activeAssessmentStudentIndex = classStudents.length - 1;

    const currentStudent = classStudents[activeAssessmentStudentIndex];

    // Stepper & Jump Bar
    const stepperBar = createElement("div", "student-stepper-bar");
    stepperBar.append(
      createElement("div", "student-stepper-counter", `Siswa ${activeAssessmentStudentIndex + 1} dari ${classStudents.length}`)
    );

    const jumpPills = createElement("div", "student-jump-pills");
    classStudents.forEach((st, idx) => {
      const hasScore = (state.assessmentResults || []).some(
        (r) => r.assessmentSessionId === as.id && r.studentId === st.id && r.value !== "" && r.value !== undefined && r.value !== null
      );
      const pill = createElement(
        "button",
        `student-jump-pill ${idx === activeAssessmentStudentIndex ? "is-active" : ""} ${hasScore ? "is-scored" : ""}`,
        hasScore ? `✓ ${idx + 1}` : `${idx + 1}`
      );
      pill.type = "button";
      pill.title = `${st.name} (${hasScore ? "Sudah dinilai" : "Belum dinilai"})`;
      pill.addEventListener("click", () => {
        activeAssessmentStudentIndex = idx;
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

    const scoreBadge = createElement(
      "span",
      `assess-score-badge ${currentResult?.value ? "badge-has-score" : ""}`,
      currentResult?.formattedValue || "Belum dinilai"
    );

    studentHeader.append(profileWrap, scoreBadge);
    focusCard.append(studentHeader);

    // Note Input
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

    // Rubric / Scoring Controls
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

          if (activeAssessmentStudentIndex < classStudents.length - 1) {
            activeAssessmentStudentIndex++;
          }
          render();
        });

        rubricGrid.append(rBtn);
      });

      focusCard.append(rubricGrid);
    } else {
      // Numeric or Stopwatch
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
        if (activeAssessmentStudentIndex < classStudents.length - 1) {
          activeAssessmentStudentIndex++;
        }
        render();
      });

      numRow.append(valInput, saveBtn);
      focusCard.append(numRow);
    }

    focusCard.append(noteField);

    // Bottom Prev / Next Nav
    const navButtons = createElement("div", "scoring-nav-buttons");
    const prevBtn = createElement("button", "btn-tool", "← Siswa Sebelumnya");
    prevBtn.type = "button";
    prevBtn.disabled = activeAssessmentStudentIndex === 0;
    prevBtn.addEventListener("click", () => {
      if (activeAssessmentStudentIndex > 0) {
        activeAssessmentStudentIndex--;
        render();
      }
    });

    const nextBtn = createElement("button", "btn-tool", "Siswa Berikutnya →");
    nextBtn.type = "button";
    nextBtn.disabled = activeAssessmentStudentIndex === classStudents.length - 1;
    nextBtn.addEventListener("click", () => {
      if (activeAssessmentStudentIndex < classStudents.length - 1) {
        activeAssessmentStudentIndex++;
        render();
      }
    });

    navButtons.append(prevBtn, nextBtn);
    focusCard.append(navButtons);

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
