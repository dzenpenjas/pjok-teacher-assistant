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

export function renderStudentsScreen(state, actions) {
  const screen = createElement("main", "screen wide-screen students-directory-screen");

  let searchQuery = "";
  let selectedClassId = "";
  let selectedTagId = "";
  let showAddModal = false;

  const container = createElement("div", "students-dir-container");
  screen.append(container);

  function render() {
    container.replaceChildren();

    // 1. Header
    const header = createElement("header", "screen-header-row");
    const titleGroup = createElement("div");
    const eyebrow = createElement("p", "eyebrow");
    eyebrow.append(ICONS.users(15), document.createTextNode(" Direktori Siswa PJOK"));
    titleGroup.append(eyebrow, createElement("h1", "screen-title", "Data Siswa"));
    titleGroup.append(
      createElement(
        "p",
        "screen-copy",
        "Pencarian cepat siswa, pantau kondisi kesehatan, grafik pertumbuhan fisik, dan riwayat penilaian."
      )
    );

    const addBtn = createElement("button", "primary-action compact-action");
    addBtn.type = "button";
    addBtn.append(ICONS.plus(16), document.createTextNode(" Tambah Siswa"));
    addBtn.addEventListener("click", () => {
      showAddModal = true;
      render();
    });

    header.append(titleGroup, addBtn);
    container.append(header);

    // 2. Filter & Search Toolbar
    const toolbar = createElement("div", "students-filter-toolbar");

    // Search bar
    const searchInput = document.createElement("input");
    searchInput.type = "search";
    searchInput.className = "search-input";
    searchInput.placeholder = "Ketik nama siswa atau NIS...";
    searchInput.value = searchQuery;
    searchInput.addEventListener("input", (e) => {
      searchQuery = e.target.value.toLowerCase();
      renderStudentsGrid();
    });
    toolbar.append(searchInput);

    // Class Filter
    const classFilter = document.createElement("select");
    classFilter.className = "filter-select";
    const allClassOpt = document.createElement("option");
    allClassOpt.value = "";
    allClassOpt.textContent = "Semua Kelas";
    classFilter.append(allClassOpt);
    (state.classes || []).forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.name;
      if (selectedClassId === c.id) opt.selected = true;
      classFilter.append(opt);
    });
    classFilter.addEventListener("change", (e) => {
      selectedClassId = e.target.value;
      renderStudentsGrid();
    });
    toolbar.append(classFilter);

    // Tag Filter
    const tagFilter = document.createElement("select");
    tagFilter.className = "filter-select";
    const allTagOpt = document.createElement("option");
    allTagOpt.value = "";
    allTagOpt.textContent = "Semua Tag Kondisi";
    tagFilter.append(allTagOpt);
    (state.studentTags || []).forEach((t) => {
      const opt = document.createElement("option");
      opt.value = t.id;
      opt.textContent = t.name;
      if (selectedTagId === t.id) opt.selected = true;
      tagFilter.append(opt);
    });
    tagFilter.addEventListener("change", (e) => {
      selectedTagId = e.target.value;
      renderStudentsGrid();
    });
    toolbar.append(tagFilter);

    container.append(toolbar);

    // 3. Grid Container
    const gridContainer = createElement("div", "students-cards-container");
    container.append(gridContainer);

    function renderStudentsGrid() {
      gridContainer.replaceChildren();

      const allStudents = state.students || [];
      const filtered = allStudents.filter((student) => {
        if (selectedClassId && student.classId !== selectedClassId) {
          return false;
        }
        if (selectedTagId && !(student.tagIds || []).includes(selectedTagId)) {
          return false;
        }
        if (searchQuery) {
          const matchName = (student.name || "").toLowerCase().includes(searchQuery);
          const matchNis = (student.studentNumber || "").toLowerCase().includes(searchQuery);
          if (!matchName && !matchNis) return false;
        }
        return true;
      });

      if (filtered.length === 0) {
        gridContainer.append(
          createElement(
            "p",
            "empty-copy",
            allStudents.length === 0
              ? "Belum ada siswa terdaftar. Klik '+ Tambah Siswa' untuk memulai."
              : "Tidak ada siswa yang sesuai dengan filter pencarian."
          )
        );
        return;
      }

      const grid = createElement("div", "students-grid");

      filtered.forEach((student) => {
        const classRoom = (state.classes || []).find((c) => c.id === student.classId);
        const card = createElement("article", "student-dir-card");

        // Identity Row
        const idRow = createElement("div", "student-dir-id-row");
        const avatar = createStudentAvatar(student, "student-dir-avatar");
        avatar.style.cursor = "pointer";
        avatar.addEventListener("click", () => actions.openStudentDetail(student.id));

        const infoCol = createElement("div", "student-dir-info");
        const nameBtn = createElement("button", "student-dir-name-btn", student.name);
        nameBtn.type = "button";
        nameBtn.addEventListener("click", () => actions.openStudentDetail(student.id));

        const subMeta = createElement("p", "student-dir-sub", `NIS: ${student.studentNumber || "-"} • ${student.gender === "female" ? "Perempuan" : "Laki-laki"}`);
        infoCol.append(nameBtn, subMeta);

        if (classRoom) {
          infoCol.append(createElement("span", "class-tag-badge", classRoom.name));
        }

        idRow.append(avatar, infoCol);
        card.append(idRow);

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
          card.append(tagRow);
        }

        // Quick growth / BMI snippet if available
        const latestGrowth = (state.growthRecords || [])
          .filter((g) => g.studentId === student.id)
          .sort((a, b) => (a.date > b.date ? -1 : 1))[0];

        if (latestGrowth && (latestGrowth.heightCm || latestGrowth.weightKg)) {
          const growthSnippet = createElement("div", "student-growth-snippet");
          growthSnippet.append(
            createElement("span", "", `📏 ${latestGrowth.heightCm || "-"} cm • ⚖️ ${latestGrowth.weightKg || "-"} kg`),
            latestGrowth.bmi ? createElement("span", "bmi-mini-pill", `BMI ${latestGrowth.bmi}`) : document.createTextNode("")
          );
          card.append(growthSnippet);
        }

        // Card Action Footer
        const footer = createElement("div", "student-dir-footer");
        const profileBtn = createElement("button", "btn-tool btn-tool-primary", "Buka Profil Lengkap");
        profileBtn.type = "button";
        profileBtn.addEventListener("click", () => actions.openStudentDetail(student.id));

        const delBtn = createElement("button", "btn-tool danger-button", "Hapus");
        delBtn.type = "button";
        delBtn.addEventListener("click", () => actions.deleteStudent(student.id));

        footer.append(profileBtn, delBtn);
        card.append(footer);

        grid.append(card);
      });

      gridContainer.append(grid);
    }

    renderStudentsGrid();

    if (showAddModal) {
      container.append(renderAddStudentModal());
    }
  }

  function renderAddStudentModal() {
    const backdrop = createElement("div", "modal-backdrop");
    const modal = createElement("div", "modal-card");

    const header = createElement("div", "modal-header-row");
    header.append(createElement("h2", "modal-title", "Tambah Siswa Baru"));
    const closeBtn = createElement("button", "modal-close-btn", "✕");
    closeBtn.addEventListener("click", () => {
      showAddModal = false;
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
        label: "Pilih Kelas",
        name: "classId",
        required: true,
        options: (state.classes || []).map((c) => ({ value: c.id, label: c.name }))
      }),
      createSelectField({
        label: "Jenis Kelamin",
        name: "gender",
        options: [
          { value: "male", label: "Laki-laki" },
          { value: "female", label: "Perempuan" }
        ]
      }),
      createSelectField({
        label: "Tag Kondisi / Kebugaran",
        name: "tagId",
        options: [
          { value: "", label: "-- Tanpa Tag Khusus --" },
          ...(state.studentTags || []).map((t) => ({ value: t.id, label: t.name }))
        ]
      }),
      createField({ label: "Tinggi Badan Awal (cm)", name: "heightCm", type: "number" }),
      createField({ label: "Berat Badan Awal (kg)", name: "weightKg", type: "number" }),
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
          photo
        });
      }
      showAddModal = false;
      render();
    });

    modal.append(form);
    backdrop.append(modal);
    return backdrop;
  }

  render();
  return screen;
}
