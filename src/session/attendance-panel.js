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

function getStatusLabel(status) {
  const labels = {
    present: "Hadir",
    late: "Terlambat",
    excused: "Izin",
    sick: "Sakit",
    absent: "Alfa"
  };

  return labels[status] || "Belum diisi";
}

function createStatusButton(label, status, onClick, active) {
  const button = createElement("button", active ? "pill-button is-active" : "pill-button", label);
  button.type = "button";
  button.addEventListener("click", () => onClick(status));
  return button;
}

export function renderAttendancePanel(context) {
  const panel = createElement("section", "attendance-panel");
  panel.append(createElement("h2", "section-title", "Absensi"));

  if (!context.session || context.session.status === "planned") {
    panel.append(createElement("p", "empty-copy", "Mulai sesi terlebih dahulu untuk mengisi absensi."));
    return panel;
  }

  const attendanceMap = new Map(
    context.records.map((record) => [record.studentId, record])
  );

  const list = createElement("div", "attendance-list");

  context.students.forEach((student) => {
    const record = attendanceMap.get(student.id) || null;
    const row = createElement("article", "attendance-row");
    const info = createElement("div", "attendance-info");
    info.append(createElement("strong", "", student.name));
    info.append(createElement("span", "", studentNumber(student.studentNumber)));
    info.append(createElement("span", "", getStatusLabel(record?.status)));

    const actions = createElement("div", "attendance-actions");
    actions.append(
      createStatusButton("Hadir", "present", (status) => context.onSetStatus(student.id, status), record?.status === "present"),
      createStatusButton("Izin", "excused", (status) => context.onSetStatus(student.id, status), record?.status === "excused"),
      createStatusButton("Sakit", "sick", (status) => context.onSetStatus(student.id, status), record?.status === "sick"),
      createStatusButton("Alfa", "absent", (status) => context.onSetStatus(student.id, status), record?.status === "absent")
    );

    row.append(info, actions);
    list.append(row);
  });

  panel.append(list);
  return panel;
}

function studentNumber(number) {
  return number ? `NIS ${number}` : "NIS belum diisi";
}
