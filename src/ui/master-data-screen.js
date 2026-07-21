import { createField, createSelectField, createTextAreaField, formToObject } from "./form-controls.js";

const SECTIONS = [
  { id: "schools", label: "Sekolah" },
  { id: "teachers", label: "Guru" },
  { id: "academicYears", label: "Tahun Ajaran" },
  { id: "semesters", label: "Semester" },
  { id: "classes", label: "Kelas" },
  { id: "students", label: "Siswa" },
  { id: "studentTags", label: "Tag" }
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
    action(formToObject(form));
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

function renderList(items, describe, onDelete, onEdit) {
  const list = createElement("div", "record-list");

  items.forEach((item) => {
    const row = createElement("article", "record-row");
    const content = createElement("div", "");
    content.append(createElement("strong", "", item.name || item.text || "Tanpa nama"));
    content.append(createElement("span", "", describe(item)));
    const rowActions = createElement("div", "record-actions");
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
    createField({ label: "Foto URL", name: "photo" }),
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
    renderList(
      data.students,
      (item) => {
        const className = data.classes.find((classRoom) => classRoom.id === item.classId)?.name || "Kelas belum dipilih";
        const tags = item.tagIds
          .map((tagId) => data.studentTags.find((tag) => tag.id === tagId)?.name)
          .filter(Boolean)
          .join(", ");
        return `${className}${tags ? ` - ${tags}` : ""}`;
      },
      actions.deleteStudent
      ,
      (item) => {
        const name = promptValue("Nama siswa", item.name);
        if (name !== null) {
          actions.updateStudent(item.id, { ...item, name });
        }
      }
    )
  );
}

export function renderMasterDataScreen(data, actions) {
  const screen = createElement("main", "screen wide-screen");
  screen.append(createElement("p", "eyebrow", "Master Data"));
  screen.append(createElement("h1", "screen-title", "Kelola data dasar."));
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

    const sectionMap = {
      schools: () => schoolSection(data, actions),
      teachers: () => teacherSection(data, actions),
      academicYears: () => academicYearSection(data, actions),
      semesters: () => semesterSection(data, actions),
      classes: () => classSection(data, actions),
      students: () => studentSection(data, actions),
      studentTags: () => tagSection(data, actions)
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
