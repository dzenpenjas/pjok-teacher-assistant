import { SCREENS } from "./data/schema.js";
import { importStateFromJson, exportStateAsJson } from "./storage/backup.js";
import { loadState, saveState } from "./storage/storage.js";
import { createRepositoryContext } from "./repositories/repository-context.js";
import { createNavigation } from "./ui/navigation.js";
import { renderScreen } from "./ui/screens.js";

const appRoot = document.querySelector("#app");
let appState = loadState();
const repositories = createRepositoryContext();

function isKnownScreen(screenId) {
  return Object.values(SCREENS).includes(screenId);
}

function setScreen(screenId) {
  appState = saveState({
    ...appState,
    currentScreen: isKnownScreen(screenId) ? screenId : SCREENS.dashboard
  });
  renderApp();
}

function refreshState() {
  appState = loadState();
  renderApp();
}

function createCrudActions() {
  return {
    createSchool: (input) => {
      repositories.schools.create(input);
      refreshState();
    },
    updateSchool: (id, input) => {
      repositories.schools.update(id, input);
      refreshState();
    },
    deleteSchool: (id) => {
      if (window.confirm("Hapus sekolah ini?")) {
        repositories.schools.delete(id);
        refreshState();
      }
    },
    createTeacher: (input) => {
      repositories.teachers.create(input);
      refreshState();
    },
    updateTeacher: (id, input) => {
      repositories.teachers.update(id, input);
      refreshState();
    },
    deleteTeacher: (id) => {
      if (window.confirm("Hapus guru ini?")) {
        repositories.teachers.delete(id);
        refreshState();
      }
    },
    createAcademicYear: (input) => {
      repositories.academicYears.create(input);
      refreshState();
    },
    updateAcademicYear: (id, input) => {
      repositories.academicYears.update(id, input);
      refreshState();
    },
    deleteAcademicYear: (id) => {
      if (window.confirm("Hapus tahun ajaran ini?")) {
        repositories.academicYears.delete(id);
        refreshState();
      }
    },
    createSemester: (input) => {
      repositories.semesters.create(input);
      refreshState();
    },
    updateSemester: (id, input) => {
      repositories.semesters.update(id, input);
      refreshState();
    },
    deleteSemester: (id) => {
      if (window.confirm("Hapus semester ini?")) {
        repositories.semesters.delete(id);
        refreshState();
      }
    },
    createClass: (input) => {
      repositories.classes.create(input);
      refreshState();
    },
    updateClass: (id, input) => {
      repositories.classes.update(id, input);
      refreshState();
    },
    deleteClass: (id) => {
      if (window.confirm("Hapus kelas ini?")) {
        repositories.classes.delete(id);
        refreshState();
      }
    },
    createTag: (input) => {
      repositories.tags.create(input);
      refreshState();
    },
    updateTag: (id, input) => {
      repositories.tags.update(id, input);
      refreshState();
    },
    deleteTag: (id) => {
      if (window.confirm("Hapus tag ini?")) {
        repositories.tags.delete(id);
        refreshState();
      }
    },
    createStudent: (input) => {
      const student = repositories.students.create({
        ...input,
        tagIds: input.tagId ? [input.tagId] : []
      }).at(-1);

      if (input.noteText && student) {
        const notes = repositories.notes.create({
          studentId: student.id,
          text: input.noteText
        });
        repositories.students.update(student.id, {
          ...student,
          noteIds: [notes.at(-1).id]
        });
      }

      refreshState();
    },
    updateStudent: (id, input) => {
      repositories.students.update(id, input);
      refreshState();
    },
    deleteStudent: (id) => {
      if (window.confirm("Hapus siswa ini?")) {
        repositories.students.delete(id);
        refreshState();
      }
    }
  };
}

function exportData() {
  const blob = new Blob([exportStateAsJson()], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "pjok-teacher-assistant-backup.json";
  link.click();
  URL.revokeObjectURL(url);
}

function importData(file) {
  if (!window.confirm("Import data akan mengganti data lokal saat ini. Lanjutkan?")) {
    return;
  }

  file.text()
    .then((text) => {
      appState = importStateFromJson(text);
      renderApp();
    })
    .catch((error) => {
      window.alert("File backup tidak dapat dibaca.");
      console.warn("Import data gagal.", error);
    });
}

function renderApp() {
  appRoot.replaceChildren();

  const header = document.createElement("header");
  header.className = "app-header";

  const title = document.createElement("span");
  title.className = "app-name";
  title.textContent = "PJOK Assistant";

  const status = document.createElement("span");
  status.className = "offline-status";
  status.textContent = navigator.onLine ? "Siap" : "Offline";

  header.append(title, status);

  const actions = {
    navigate: setScreen,
    exportData,
    importData,
    ...createCrudActions()
  };

  appRoot.append(
    header,
    renderScreen(appState.currentScreen, appState, actions),
    createNavigation(appState.currentScreen, setScreen)
  );
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch((error) => {
      console.warn("Service worker gagal didaftarkan.", error);
    });
  });
}

window.addEventListener("online", renderApp);
window.addEventListener("offline", renderApp);

appState = saveState(appState);
renderApp();
registerServiceWorker();
