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
  let showAddClassModal = false;
  let showAddStudentModal = false;
  let activeTab = "students"; // "students" | "sessions"
  let studentSearchQuery = "";

  const container = createElement("div", "classes-hub-container");
  screen.append(container);

  function render() {
    container.replaceChildren();

    if (selectedClassId) {
      renderClassDetail(selectedClassId);
    } else {
      renderClassList();
    }
  }

  function renderClassList() {
    const header = createElement("header", "screen-header-row");
    const titleGroup = createElement("div");
    const eyebrow = createElement("p", "eyebrow");
    eyebrow.append(ICONS.book(15), document.createTextNode(" Pusat Manajemen Kelas"));
    titleGroup.append(eyebrow, createElement("h1", "screen-title", "Kelas & Siswa"));
    titleGroup.append(
      createElement(
        "p",
        "screen-copy",
        "Pilih kelas untuk melihat siswa, menambah anggota kelas, atau langsung mulai sesi mengajar di lapangan."
      )
    );

    const addBtn = createElement("button", "primary-action compact-action");
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
      return;
    }

    const grid = createElement("div", "class-cards-grid");

    classes.forEach((c) => {
      const classStudents = (state.students || []).filter((s) => s.classId === c.id);
      const classSessions = (state.sessions || []).filter((sess) => sess.classId === c.id);
      const activeSession = (state.sessions || []).find((sess) => sess.classId === c.id && (sess.status === "active" || sess.status === "paused"));

      const card = createElement("article", "class-summary-card");

      const topRow = createElement("div", "class-card-top");
      const titleWrap = createElement("div");
      titleWrap.append(
        createElement("h2", "class-card-name", c.name),
        createElement("p", "class-card-meta", `Tingkat ${c.gradeLevel || "-"} ${c.homeroomTeacher ? `• Wali: ${c.homeroomTeacher}` : ""}`)
      );

      if (activeSession) {
        const badge = createElement("span", "session-status-badge status-active", "● Sesi Berjalan");
        topRow.append(titleWrap, badge);
      } else {
        topRow.append(titleWrap);
      }
      card.append(topRow);

      // Stats row
      const statsRow = createElement("div", "class-card-stats");
      statsRow.append(
        createPillStat("Siswa", classStudents.length, ICONS.users(14)),
        createPillStat("Sesi", classSessions.length, ICONS.whistle(14))
      );
      card.append(statsRow);

      // Action Buttons
      const actionsRow = createElement("div", "class-card-actions");
      
      const startBtn = createElement("button", "btn-start-session-card");
      startBtn.type = "button";
      startBtn.append(ICONS.play(16), document.createTextNode(" Mulai Sesi"));
      startBtn.addEventListener("click", () => {
        if (actions?.quickStartClassSession) {
          actions.quickStartClassSession(c.id);
        }
      });

      const openBtn = createElement("button", "btn-open-class-card");
      openBtn.type = "button";
      openBtn.append(ICONS.users(16), document.createTextNode(" Kelola Siswa"));
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

    const actionCluster = createElement("div", "class-header-actions");
    const startSessBtn = createElement("button", "primary-action compact-action");
    startSessBtn.type = "button";
    startSessBtn.append(ICONS.play(16), document.createTextNode(" Mulai Sesi"));
    startSessBtn.addEventListener("click", () => {
      if (actions?.quickStartClassSession) {
        actions.quickStartClassSession(classRoom.id);
      }
    });

    const addStudentBtn = createElement("button", "btn-tool btn-tool-primary");
    addStudentBtn.type = "button";
    addStudentBtn.append(ICONS.plus(15), document.createTextNode(" Tambah Siswa"));
    addStudentBtn.addEventListener("click", () => {
      showAddStudentModal = true;
      render();
    });

    const editClassBtn = createElement("button", "btn-tool");
    editClassBtn.type = "button";
    editClassBtn.append(ICONS.settings(15), document.createTextNode(" Edit"));
    editClassBtn.addEventListener("click", () => {
      const newName = window.prompt("Nama Kelas:", classRoom.name);
      if (newName && newName.trim()) {
        actions.updateClass(classRoom.id, { ...classRoom, name: newName.trim() });
        render();
      }
    });

    const deleteClassBtn = createElement("button", "btn-tool danger-button");
    deleteClassBtn.type = "button";
    deleteClassBtn.append(ICONS.trash(15), document.createTextNode(" Hapus"));
    deleteClassBtn.addEventListener("click", () => {
      actions.deleteClass(classRoom.id);
      selectedClassId = null;
      render();
    });

    actionCluster.append(startSessBtn, addStudentBtn, editClassBtn, deleteClassBtn);
    header.append(titleGroup, actionCluster);
    container.append(header);

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

    tabsRow.append(tabStudents, tabSessions);
    container.append(tabsRow);

    if (activeTab === "students") {
      renderClassStudentsList(classStudents, classRoom);
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

        const infoRow = createElement("div", "student-card-main");
        const avatar = createStudentAvatar(student, "student-card-avatar");
        avatar.style.cursor = "pointer";
        avatar.addEventListener("click", () => actions.openStudentDetail(student.id));

        const textCol = createElement("div", "student-card-meta");
        const nameEl = createElement("strong", "student-card-name", student.name);
        nameEl.style.cursor = "pointer";
        nameEl.addEventListener("click", () => actions.openStudentDetail(student.id));

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
        const profileBtn = createElement("button", "btn-tool", "Profil");
        profileBtn.type = "button";
        profileBtn.addEventListener("click", () => actions.openStudentDetail(student.id));

        const delBtn = createElement("button", "btn-tool danger-button", "Hapus");
        delBtn.type = "button";
        delBtn.addEventListener("click", () => actions.deleteStudent(student.id));

        actionsCol.append(profileBtn, delBtn);

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
      const photo = photoPicker.getPhotoValue();
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
