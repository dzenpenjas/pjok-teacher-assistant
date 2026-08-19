import { renderAttendancePanel } from "./attendance-panel.js";

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

function fieldRow(label, value) {
  const row = createElement("div", "session-field");
  row.append(createElement("span", "session-field-label", label));
  row.append(createElement("strong", "session-field-value", value || "-"));
  return row;
}

function statusLabel(status) {
  if (!status) {
    return "Belum dimulai";
  }

  const mapping = {
    planned: "Planned",
    active: "Active",
    paused: "Paused",
    completed: "Completed",
    cancelled: "Cancelled"
  };

  return mapping[status] || status;
}

export function renderSessionScreen(session, context) {
  const screen = createElement("main", "screen");
  screen.append(createElement("p", "eyebrow", "Teaching Session"));
  screen.append(
    createElement(
      "h1",
      "screen-title",
      session ? `Sesi ${session.sessionNumber || ""}`.trim() : "Belum ada sesi."
    )
  );
  screen.append(
    createElement(
      "p",
      "screen-copy",
      session
        ? "Sesi ini akan menjadi pusat seluruh aktivitas pembelajaran berikutnya."
        : "Buat sesi dulu untuk mulai mengajar."
    )
  );

  if (!session) {
    const createCard = createElement("section", "session-card");
    const form = createElement("form", "master-form");
    const fields = [
      { label: "Nomor Sesi", name: "sessionNumber", placeholder: "1" },
      { label: "Tanggal", name: "date", type: "date" },
      { label: "Topik", name: "topic" },
      { label: "Materi", name: "material" },
      { label: "Lokasi", name: "location" },
      { label: "Cuaca", name: "weather" },
      { label: "Catatan", name: "notes" }
    ];

    fields.forEach((field) => {
      const label = createElement("label", "field");
      const span = createElement("span", "", field.label);
      const input = document.createElement("input");
      input.type = field.type || "text";
      input.name = field.name;
      if (field.placeholder) {
        input.placeholder = field.placeholder;
      }
      label.append(span, input);
      form.append(label);
    });

    const classField = createElement("label", "field");
    classField.append(createElement("span", "", "Kelas"));
    const classSelect = document.createElement("select");
    classSelect.name = "classId";
    classSelect.append(createOption("", "Pilih kelas"));
    context.classOptions.forEach((item) => {
      classSelect.append(createOption(item.id, item.name));
    });
    classField.append(classSelect);
    form.append(classField);

    const teacherField = createElement("label", "field");
    teacherField.append(createElement("span", "", "Guru"));
    const teacherSelect = document.createElement("select");
    teacherSelect.name = "teacherId";
    teacherSelect.append(createOption("", "Pilih guru"));
    context.teacherOptions.forEach((item) => {
      teacherSelect.append(createOption(item.id, item.name));
    });
    teacherField.append(teacherSelect);
    form.append(teacherField);

    const yearField = createElement("label", "field");
    yearField.append(createElement("span", "", "Tahun Ajaran"));
    const yearSelect = document.createElement("select");
    yearSelect.name = "academicYearId";
    yearSelect.append(createOption("", "Pilih tahun"));
    context.academicYearOptions.forEach((item) => {
      yearSelect.append(createOption(item.id, item.name));
    });
    yearField.append(yearSelect);
    form.append(yearField);

    const semesterField = createElement("label", "field");
    semesterField.append(createElement("span", "", "Semester"));
    const semesterSelect = document.createElement("select");
    semesterSelect.name = "semesterId";
    semesterSelect.append(createOption("", "Pilih semester"));
    context.semesterOptions.forEach((item) => {
      semesterSelect.append(createOption(item.id, item.name));
    });
    semesterField.append(semesterSelect);
    form.append(semesterField);

    const createButton = createElement("button", "primary-action compact-action", "Buat Sesi");
    createButton.type = "submit";
    form.append(createButton);

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const values = Object.fromEntries(new FormData(form).entries());
      context.actions.createSession(values);
      form.reset();
    });

    createCard.append(createElement("p", "empty-copy", "Belum ada sesi tersimpan. Buat sesi untuk mulai mengajar."));
    createCard.append(form);
    screen.append(createCard);
    return screen;
  }

  const details = createElement("section", "session-card");
  details.append(fieldRow("Nama Kelas", context.className || "-"));
  details.append(fieldRow("Tanggal", session.date || "-"));
  details.append(fieldRow("Jam Mulai", session.startTime || "-"));
  details.append(fieldRow("Status", statusLabel(session.status)));
  details.append(fieldRow("Materi", session.material || "-"));
  details.append(fieldRow("Catatan", session.notes || "-"));

  const buttonRow = createElement("div", "session-actions");

  const startButton = createElement("button", "primary-action compact-action", "Start");
  startButton.type = "button";
  startButton.disabled = session.status === "active" || session.status === "completed";
  startButton.addEventListener("click", () => context.actions.startSession(session.id));

  const pauseButton = createElement("button", "text-button", "Pause");
  pauseButton.type = "button";
  pauseButton.disabled = session.status !== "active";
  pauseButton.addEventListener("click", () => context.actions.pauseSession(session.id));

  const resumeButton = createElement("button", "text-button", "Resume");
  resumeButton.type = "button";
  resumeButton.disabled = session.status !== "paused";
  resumeButton.addEventListener("click", () => context.actions.resumeSession(session.id));

  const finishButton = createElement("button", "text-button danger-button", "Finish");
  finishButton.type = "button";
  finishButton.disabled = session.status === "completed" || session.status === "cancelled";
  finishButton.addEventListener("click", () => context.actions.finishSession(session.id));

  buttonRow.append(startButton, pauseButton, resumeButton, finishButton);
  details.append(buttonRow);
  screen.append(details);
  screen.append(
    renderAttendancePanel({
      session,
      students: context.students || [],
      records: context.attendanceRecords || [],
      onSetStatus: context.onSetAttendanceStatus || (() => () => {})
    })
  );
  return screen;
}

function createOption(value, label) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = label;
  return option;
}
