import { createField, createSelectField, createTextAreaField, formToObject } from "./form-controls.js";
import { createPhotoPickerField } from "./student-photo-field.js";
import { createStudentAvatar } from "./student-avatar.js";
import { ICONS } from "./icons.js";

const SECTIONS = [
  { id: "schools", label: "Sekolah" },
  { id: "teachers", label: "Guru" },
  { id: "academicYears", label: "Tahun Ajaran" },
  { id: "semesters", label: "Semester" },
  { id: "classes", label: "Kelas" },
  { id: "students", label: "Siswa" },
  { id: "studentTags", label: "Tag" },
  { id: "assessments", label: "Definisi Penilaian" }
];

function createElement(tagName, className, textContent) {
  const element = document.createElement(tagName);
  if (className) {
    element.className = className;
  }
  if (textContent) {
    element.textContent = textContent;
  }
  return element;
}

function createOptions(items, placeholder) {
  return [
    { value: "", label: placeholder },
    ...items.map((item) => ({ value: item.id, label: item.name }))
  ];
}

function submitForm(form, action) {
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (typeof action === "function") {
      action(formToObject(form));
    }
    form.reset();
  });
}

function createRowButton(label, onClick, extraClass = "") {
  const button = createElement("button", "text-button danger-button", "Hapus");
  button.type = "button";
  button.className = `text-button ${extraClass}`.trim();
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

function promptValue(label, value) {
  return window.prompt(label, value || "");
}

function renderList(items, describe, onDelete, onEdit, extraActions) {
  const list = createElement("div", "record-list");

  items.forEach((item) => {
    const row = createElement("article", "record-row");
    const content = createElement("div", "");
    content.append(createElement("strong", "", item.name || item.text || "Tanpa nama"));
    content.append(createElement("span", "", describe(item)));
    const rowActions = createElement("div", "record-actions");
    if (typeof extraActions === "function") {
      const extras = extraActions(item);
      if (Array.isArray(extras)) {
        rowActions.append(...extras);
      }
    }
    rowActions.append(
      createRowButton("Edit", () => onEdit(item), ""),
      createRowButton("Hapus", () => onDelete(item.id), "danger-button")
    );
    row.append(content, rowActions);
    list.append(row);
  });

  if (items.length === 0) {
    list.append(createElement("p", "empty-copy", "Belum ada data."));
  }

  return list;
}

function renderCard(title, form, list) {
  const card = createElement("section", "master-card");
  card.append(createElement("h2", "section-title", title), form, list);
  return card;
}

function schoolSection(data, actions) {
  const form = createElement("form", "master-form");
  form.append(
    createField({ label: "Nama Sekolah", name: "name", required: true }),
    createField({ label: "Alamat", name: "address" }),
    createField({ label: "Telepon", name: "phone" }),
    createElement("button", "primary-action compact-action", "Tambah Sekolah")
  );
  submitForm(form, actions.createSchool);
  return renderCard(
    "Sekolah",
    form,
    renderList(
      data.schools,
      (item) => item.address || "Alamat belum diisi",
      actions.deleteSchool,
      (item) => {
        const name = promptValue("Nama sekolah", item.name);
        if (name !== null) {
          actions.updateSchool(item.id, { ...item, name });
        }
      }
    )
  );
}

function teacherSection(data, actions) {
  const form = createElement("form", "master-form");
  form.append(
    createField({ label: "Nama Guru", name: "name", required: true }),
    createField({ label: "NIP / ID", name: "employeeNumber" }),
    createField({ label: "Telepon", name: "phone" }),
    createSelectField({
      label: "Sekolah",
      name: "schoolId",
      options: createOptions(data.schools, "Pilih sekolah")
    }),
    createElement("button", "primary-action compact-action", "Tambah Guru")
  );
  submitForm(form, actions.createTeacher);
  return renderCard(
    "Guru",
    form,
    renderList(
      data.teachers,
      (item) => item.employeeNumber || "Nomor belum diisi",
      actions.deleteTeacher,
      (item) => {
        const name = promptValue("Nama guru", item.name);
        if (name !== null) {
          actions.updateTeacher(item.id, { ...item, name });
        }
      }
    )
  );
}

function academicYearSection(data, actions) {
  const form = createElement("form", "master-form");
  form.append(
    createField({ label: "Tahun Ajaran", name: "name", required: true }),
    createField({ label: "Mulai", name: "startsAt", type: "date" }),
    createField({ label: "Selesai", name: "endsAt", type: "date" }),
    createElement("button", "primary-action compact-action", "Tambah Tahun")
  );
  submitForm(form, actions.createAcademicYear);
  return renderCard(
    "Tahun Ajaran",
    form,
    renderList(
      data.academicYears,
      (item) => `${item.startsAt || "-"} sampai ${item.endsAt || "-"}`,
      actions.deleteAcademicYear,
      (item) => {
        const name = promptValue("Tahun ajaran", item.name);
        if (name !== null) {
          actions.updateAcademicYear(item.id, { ...item, name });
        }
      }
    )
  );
}

function semesterSection(data, actions) {
  const form = createElement("form", "master-form");
  form.append(
    createField({ label: "Nama Semester", name: "name", required: true }),
    createSelectField({
      label: "Tahun Ajaran",
      name: "academicYearId",
      options: createOptions(data.academicYears, "Pilih tahun")
    }),
    createElement("button", "primary-action compact-action", "Tambah Semester")
  );
  submitForm(form, actions.createSemester);
  return renderCard(
    "Semester",
    form,
    renderList(
      data.semesters,
      (item) => data.academicYears.find((year) => year.id === item.academicYearId)?.name || "Tahun belum dipilih",
      actions.deleteSemester,
      (item) => {
        const name = promptValue("Nama semester", item.name);
        if (name !== null) {
          actions.updateSemester(item.id, { ...item, name });
        }
      }
    )
  );
}

function classSection(data, actions) {
  const form = createElement("form", "master-form");
  form.append(
    createField({ label: "Nama Kelas", name: "name", required: true }),
    createField({ label: "Tingkat", name: "grade" }),
    createSelectField({
      label: "Tahun Ajaran",
      name: "academicYearId",
      options: createOptions(data.academicYears, "Pilih tahun")
    }),
    createSelectField({
      label: "Guru",
      name: "teacherId",
      options: createOptions(data.teachers, "Pilih guru")
    }),
    createElement("button", "primary-action compact-action", "Tambah Kelas")
  );
  submitForm(form, actions.createClass);
  return renderCard(
    "Kelas",
    form,
    renderList(
      data.classes,
      (item) => `Tingkat ${item.grade || "-"} - ${data.students.filter((student) => student.classId === item.id).length} siswa`,
      actions.deleteClass,
      (item) => {
        const name = promptValue("Nama kelas", item.name);
        if (name !== null) {
          actions.updateClass(item.id, { ...item, name });
        }
      }
    )
  );
}

function tagSection(data, actions) {
  const form = createElement("form", "master-form");
  form.append(
    createField({ label: "Nama Tag", name: "name", required: true }),
    createField({ label: "Warna", name: "color", type: "color", value: "#116149" }),
    createElement("button", "primary-action compact-action", "Tambah Tag")
  );
  submitForm(form, actions.createTag);
  return renderCard(
    "Tag Siswa",
    form,
    renderList(
      data.studentTags,
      (item) => item.color,
      actions.deleteTag,
      (item) => {
        const name = promptValue("Nama tag", item.name);
        if (name !== null) {
          actions.updateTag(item.id, { ...item, name });
        }
      }
    )
  );
}

function openEditStudentModal(student, data, actions) {
  const backdrop = createElement("div", "camera-modal-backdrop");
  backdrop.setAttribute("role", "dialog");
  backdrop.setAttribute("aria-modal", "true");
  backdrop.setAttribute("aria-label", `Edit Siswa: ${student.name}`);

  const modal = createElement("div", "app-modal edit-student-modal");

  const header = createElement("div", "modal-header-row");
  const title = createElement("h3", "modal-title", `Edit Siswa: ${student.name}`);
  const closeBtn = createElement("button", "modal-close-btn");
  closeBtn.type = "button";
  closeBtn.setAttribute("aria-label", "Tutup modal edit");
  closeBtn.append(ICONS.close(20));
  closeBtn.addEventListener("click", () => backdrop.remove());
  header.append(title, closeBtn);

  const form = createElement("form", "master-form edit-student-form");

  const photoField = createPhotoPickerField({
    label: "Foto Siswa",
    name: "photo",
    value: student.photo || ""
  });

  const nameField = createField({ label: "Nama Siswa", name: "name", value: student.name || "", required: true });
  const nisField = createField({ label: "Nomor Induk", name: "studentNumber", value: student.studentNumber || "" });
  const genderField = createSelectField({
    label: "Jenis Kelamin",
    name: "gender",
    value: student.gender || "",
    options: [
      { value: "", label: "Pilih" },
      { value: "L", label: "Laki-laki" },
      { value: "P", label: "Perempuan" }
    ]
  });
  const classField = createSelectField({
    label: "Kelas",
    name: "classId",
    value: student.classId || "",
    options: createOptions(data.classes, "Pilih kelas")
  });
  const birthField = createField({ label: "Tanggal Lahir", name: "birthDate", type: "date", value: student.birthDate || "" });
  const heightField = createField({ label: "Tinggi (cm)", name: "heightCm", type: "number", value: student.heightCm || "" });
  const weightField = createField({ label: "Berat (kg)", name: "weightKg", type: "number", value: student.weightKg || "" });
  const tagField = createSelectField({
    label: "Tag Utama",
    name: "tagId",
    value: Array.isArray(student.tagIds) && student.tagIds[0] ? student.tagIds[0] : "",
    options: createOptions(data.studentTags, "Tanpa tag")
  });

  const actionsRow = createElement("div", "form-actions-row edit-actions-row");
  const saveBtn = createElement("button", "primary-action compact-action", "Simpan Perubahan");
  saveBtn.type = "submit";
  const cancelBtn = createElement("button", "text-button", "Batal");
  cancelBtn.type = "button";
  cancelBtn.addEventListener("click", () => backdrop.remove());
  actionsRow.append(saveBtn, cancelBtn);

  form.append(
    photoField,
    nameField,
    nisField,
    genderField,
    classField,
    birthField,
    heightField,
    weightField,
    tagField,
    actionsRow
  );

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const values = formToObject(form);
    const updated = {
      ...student,
      ...values,
      tagIds: values.tagId ? [values.tagId] : (student.tagIds || [])
    };
    if (typeof values.photo === "string") {
      updated.photo = values.photo;
    }
    actions.updateStudent(student.id, updated);
    backdrop.remove();
  });

  modal.append(header, form);
  backdrop.append(modal);
  document.body.append(backdrop);
}

function renderStudentList(students, data, actions) {
  const list = createElement("div", "record-list student-record-list");

  students.forEach((student) => {
    const row = createElement("article", "record-row student-record-row");

    const left = createElement("div", "student-item-main");
    const avatar = createStudentAvatar(student, "student-list-avatar");
    avatar.style.cursor = "pointer";
    avatar.title = "Buka Profil Siswa";
    avatar.addEventListener("click", () => {
      if (actions.openStudentDetail) {
        actions.openStudentDetail(student.id);
      }
    });

    const details = createElement("div", "student-item-details");
    const nameEl = createElement("strong", "student-item-name clickable-link", student.name);
    nameEl.addEventListener("click", () => {
      if (actions.openStudentDetail) {
        actions.openStudentDetail(student.id);
      }
    });

    const className = data.classes.find((c) => c.id === student.classId)?.name || "Kelas belum dipilih";
    const metaText = `${className}${student.studentNumber ? ` • NIS: ${student.studentNumber}` : ""}`;
    const meta = createElement("span", "student-item-meta", metaText);

    const tagsWrap = createElement("div", "student-tags-inline");
    if (Array.isArray(student.tagIds)) {
      student.tagIds.forEach((tId) => {
        const tag = data.studentTags.find((t) => t.id === tId);
        if (tag) {
          const pill = createElement("span", "mini-tag", tag.name);
          if (tag.color) {
            pill.style.borderColor = tag.color;
            pill.style.color = tag.color;
          }
          tagsWrap.append(pill);
        }
      });
    }

    details.append(nameEl, meta, tagsWrap);
    left.append(avatar, details);

    const rowActions = createElement("div", "record-actions");
    rowActions.append(
      createRowButton("Profil & IMT", () => {
        if (actions.openStudentDetail) {
          actions.openStudentDetail(student.id);
        }
      }, "text-button"),
      createRowButton("Edit", () => {
        openEditStudentModal(student, data, actions);
      }, "text-button"),
      createRowButton("Hapus", () => actions.deleteStudent(student.id), "danger-button")
    );

    row.append(left, rowActions);
    list.append(row);
  });

  if (students.length === 0) {
    list.append(createElement("p", "empty-copy", "Belum ada data siswa."));
  }

  return list;
}

function studentSection(data, actions) {
  const form = createElement("form", "master-form");
  form.append(
    createField({ label: "Nama Siswa", name: "name", required: true }),
    createField({ label: "Nomor Induk", name: "studentNumber" }),
    createSelectField({
      label: "Jenis Kelamin",
      name: "gender",
      options: [
        { value: "", label: "Pilih" },
        { value: "L", label: "Laki-laki" },
        { value: "P", label: "Perempuan" }
      ]
    }),
    createSelectField({
      label: "Kelas",
      name: "classId",
      options: createOptions(data.classes, "Pilih kelas")
    }),
    createPhotoPickerField({ label: "Foto Siswa", name: "photo" }),
    createField({ label: "Tanggal Lahir", name: "birthDate", type: "date" }),
    createField({ label: "Tinggi (cm)", name: "heightCm", type: "number" }),
    createField({ label: "Berat (kg)", name: "weightKg", type: "number" }),
    createTextAreaField({ label: "Catatan", name: "noteText" }),
    createSelectField({
      label: "Tag Utama",
      name: "tagId",
      options: createOptions(data.studentTags, "Tanpa tag")
    }),
    createElement("button", "primary-action compact-action", "Tambah Siswa")
  );
  submitForm(form, actions.createStudent);

  return renderCard(
    "Siswa",
    form,
    renderStudentList(data.students, data, actions)
  );
}

function assessmentSection(data, actions) {
  const form = createElement("form", "master-form");
  form.append(
    createField({ label: "Nama Aspek / Tes Penilaian", name: "name", required: true }),
    createSelectField({
      label: "Kategori",
      name: "category",
      options: [
        { value: "Keterampilan", label: "Keterampilan Gerak" },
        { value: "Kebugaran Jasmani", label: "Kebugaran Jasmani" },
        { value: "Sikap/Perilaku", label: "Sikap / Perilaku" },
        { value: "Pengetahuan", label: "Pengetahuan" }
      ]
    }),
    createSelectField({
      label: "Metode Penilaian",
      name: "method",
      options: [
        { value: "numeric", label: "Angka / Nilai Terukur" },
        { value: "stopwatch", label: "Stopwatch (Waktu / Detik)" },
        { value: "rubric", label: "Rubrik Skala 1 - 4" }
      ]
    }),
    createField({ label: "Satuan (misal: detik, cm, kali)", name: "unit" }),
    createTextAreaField({ label: "Deskripsi / Petunjuk Pengujian", name: "description" }),
    createElement("button", "primary-action compact-action", "Tambah Definisi Penilaian")
  );

  submitForm(form, (values) => {
    if (actions.createAssessmentDefinition) {
      actions.createAssessmentDefinition(values);
    }
  });

  return renderCard(
    "Definisi Penilaian",
    form,
    renderList(
      data.assessmentDefinitions || [],
      (item) => `[${item.category}] Metode: ${item.method} • Satuan: ${item.unit || "-"}`,
      actions.deleteAssessmentDefinition || (() => {}),
      (item) => {
        const name = promptValue("Nama penilaian", item.name);
        if (name !== null && actions.updateAssessmentDefinition) {
          actions.updateAssessmentDefinition(item.id, { ...item, name });
        }
      }
    )
  );
}

export function renderMasterDataScreen(data, actions = (typeof window !== "undefined" && window.actions) || {}) {
  const screen = createElement("main", "screen wide-screen");
  const eyebrow = createElement("p", "eyebrow");
  eyebrow.append(ICONS.database(15), document.createTextNode(" Master Data PJOK"));
  screen.append(eyebrow);
  screen.append(createElement("h1", "screen-title", "Kelola Data Dasar"));
  screen.append(
    createElement(
      "p",
      "screen-copy",
      "Data ini menjadi dasar kelas, profil siswa, dan sesi pembelajaran pada sprint berikutnya."
    )
  );

  const tabs = createElement("div", "section-tabs");
  const content = createElement("div", "master-content");
  let activeSection = "schools";

  function renderActiveSection() {
    content.replaceChildren();
    tabs.querySelectorAll("button").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.section === activeSection);
    });

    const safeActions = actions || (typeof window !== "undefined" && window.actions) || {};
    const sectionMap = {
      schools: () => schoolSection(data, safeActions),
      teachers: () => teacherSection(data, safeActions),
      academicYears: () => academicYearSection(data, safeActions),
      semesters: () => semesterSection(data, safeActions),
      classes: () => classSection(data, safeActions),
      students: () => studentSection(data, safeActions),
      studentTags: () => tagSection(data, safeActions),
      assessments: () => assessmentSection(data, safeActions)
    };

    content.append(sectionMap[activeSection]());
  }

  SECTIONS.forEach((section) => {
    const button = createElement("button", "tab-button", section.label);
    button.type = "button";
    button.dataset.section = section.id;
    button.addEventListener("click", () => {
      activeSection = section.id;
      renderActiveSection();
    });
    tabs.append(button);
  });

  screen.append(tabs, content);
  renderActiveSection();
  return screen;
}
