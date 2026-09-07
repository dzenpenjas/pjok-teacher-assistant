import { SCREENS } from "../data/schema.js";
import { renderMasterDataScreen } from "./master-data-screen.js";
import { renderSessionScreen } from "../session/session-screen.js";

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

function createStat(label, value) {
  const item = createElement("div", "stat-item");
  item.append(createElement("strong", "", value));
  item.append(createElement("span", "", label));
  return item;
}

function renderDashboard(state, actions) {
  const screen = createElement("main", "screen");
  screen.append(createElement("p", "eyebrow", "PJOK Teacher Assistant"));
  screen.append(createElement("h1", "screen-title", "Fokus mengajar, bukan mencatat."));
  screen.append(
    createElement(
      "p",
      "screen-copy",
      "Mulai dari memilih kelas, lanjutkan sesi pembelajaran, lalu biarkan data tersimpan otomatis."
    )
  );

  const stats = createElement("section", "stats-grid");
  stats.setAttribute("aria-label", "Ringkasan data");
  stats.append(createStat("Kelas", String(state.classes.length)));
  stats.append(createStat("Siswa", String(state.students.length)));
  stats.append(createStat("Sesi Aktif", state.activeSessionId ? "Ada" : "Tidak"));
  screen.append(stats);

  const primaryAction = createElement("button", "primary-action", "Kelola Master Data");
  primaryAction.type = "button";
  primaryAction.addEventListener("click", () => actions.navigate(SCREENS.masterData));
  screen.append(primaryAction);

  return screen;
}

function renderSettings(state) {
  const screen = createElement("main", "screen");
  screen.append(createElement("p", "eyebrow", "Data Lokal"));
  screen.append(createElement("h1", "screen-title", "Data tersimpan otomatis."));

  const updatedAt = state.updatedAt
    ? new Intl.DateTimeFormat("id-ID", {
        dateStyle: "medium",
        timeStyle: "short"
      }).format(new Date(state.updatedAt))
    : "Belum ada";

  screen.append(createElement("p", "screen-copy", `Pembaruan terakhir: ${updatedAt}.`));
  screen.append(
    createElement(
      "p",
      "screen-copy",
      "Gunakan export untuk mencadangkan data dan import untuk memulihkan data dari file JSON."
    )
  );

  const actionsRow = createElement("div", "data-actions");
  const exportButton = createElement("button", "primary-action compact-action", "Export Data");
  exportButton.type = "button";
  exportButton.addEventListener("click", actions.exportData);

  const importLabel = createElement("label", "import-action", "Import Data");
  const importInput = document.createElement("input");
  importInput.type = "file";
  importInput.accept = "application/json,.json";
  importInput.addEventListener("change", (event) => {
    const [file] = event.target.files;
    if (file) {
      actions.importData(file);
    }
    event.target.value = "";
  });
  importLabel.append(importInput);
  actionsRow.append(exportButton, importLabel);
  screen.append(actionsRow);
  return screen;
}

export function renderScreen(screenIdOrState, stateOrActions, maybeActions) {
  let screenId;
  let state;
  let actions;

  if (typeof screenIdOrState === "string") {
    screenId = screenIdOrState;
    state = stateOrActions;
    actions = maybeActions;
  } else {
    state = screenIdOrState;
    actions = stateOrActions;
    screenId = state?.currentScreen || SCREENS.dashboard;
  }

  if (screenId === SCREENS.masterData) {
    return renderMasterDataScreen(state, actions);
  }

  if (screenId === SCREENS.session) {
    return renderSessionScreen(state.session || null, {
      actions,
      className: state.session
        ? (state.classes || []).find((item) => item.id === state.session.classId)?.name || ""
        : "",
      students: state.session
        ? (state.students || []).filter((student) => student.classId === state.session.classId)
        : [],
      attendanceRecords: state.session
        ? (state.attendanceRecords || []).filter(
            (record) => record.sessionId === state.session.id
          )
        : [],
      onSetAttendanceStatus: actions.setAttendanceStatus,
      classOptions: state.classes || [],
      teacherOptions: state.teachers || [],
      academicYearOptions: state.academicYears || [],
      semesterOptions: state.semesters || []
    });
  }

  if (screenId === SCREENS.settings) {
    return renderSettings(state, actions);
  }

  return renderDashboard(state, actions);
}
