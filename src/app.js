import { SCREENS } from "./data/schema.js";
import { importStateFromJson, exportStateAsJson } from "./storage/backup.js";
import { loadState, saveState } from "./storage/storage.js";
import { createRepositoryContext } from "./repositories/repository-context.js";
import { SessionManager } from "./services/session-manager.js";
import { createNavigation } from "./ui/navigation.js";
import { renderScreen } from "./ui/screens.js";
import { renderStudentDetailModal } from "./ui/student-detail-modal.js";

const appRoot = document.querySelector("#app");
let appState = loadState();
const repositories = createRepositoryContext();
const sessionManager = new SessionManager(repositories.sessions);

let activeModalStudentId = null;
let explicitSessionId = null;

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
  syncSessionPointer();
  renderApp();
}

function syncSessionPointer() {
  const session = sessionManager.getResumeCandidate();
  const activeSessionId = session ? session.id : null;

  if (appState.activeSessionId !== activeSessionId) {
    appState = saveState({
      ...appState,
      activeSessionId
    });
  }
}

function getSessionContext() {
  let session = null;
  if (explicitSessionId) {
    session = repositories.sessions.findById(explicitSessionId);
  }
  if (!session) {
    session = sessionManager.getResumeCandidate() || repositories.sessions.findAll().at(-1) || null;
  }
  const classRoom = session
    ? appState.classes.find((item) => item.id === session.classId) || null
    : null;

  return {
    session,
    className: classRoom ? classRoom.name : "",
    statusLabel: session ? session.status : "",
    resumeAvailable: Boolean(session && (session.status === "active" || session.status === "paused"))
  };
}

function createCrudActions() {
  return {
    // MODAL DIALOG
    openStudentDetail: (studentId) => {
      activeModalStudentId = studentId;
      renderApp();
    },
    closeStudentDetail: () => {
      activeModalStudentId = null;
      renderApp();
    },

    // SESSION SELECTION & LAUNCHER
    selectSession: (sessionId) => {
      explicitSessionId = sessionId;
      setScreen(SCREENS.session);
    },

    quickStartClassSession: (classId) => {
      const existingSessionsForClass = repositories.sessions.findByClass(classId);
      const nextNum = existingSessionsForClass.length + 1;
      const today = new Date().toISOString().slice(0, 10);
      const school = appState.schools[0];
      const teacher = appState.teachers[0];
      const academicYear = appState.academicYears[0];
      const semester = appState.semesters[0];

      const created = repositories.sessions.create({
        schoolId: school?.id || "",
        teacherId: teacher?.id || "",
        academicYearId: academicYear?.id || "",
        semesterId: semester?.id || "",
        classId,
        sessionNumber: nextNum,
        date: today,
        startTime: "07:30",
        topic: `Pertemuan PJOK Ke-${nextNum}`,
        material: "Praktik Kebugaran & Gerak Dasar",
        location: "Lapangan Utama",
        weather: "Cerah",
        status: "active",
        state: "ACTIVE"
      });

      const newSession = created.at(-1);
      if (newSession) {
        explicitSessionId = newSession.id;
        // Auto-load standard PJOK activity stages
        loadDefaultActivitiesForSession(newSession.id);
      }
      setScreen(SCREENS.session);
    },

    // MASTER DATA ACTIONS
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
    },

    // ATTENDANCE ACTIONS
    setAttendanceStatus: (studentId, status) => {
      const sessionContext = getSessionContext();
      const session = sessionContext.session;
      if (!session) return;

      const existing = repositories.attendanceRecords.findBySessionAndStudent(session.id, studentId);
      const payload = {
        sessionId: session.id,
        studentId,
        status,
        recordedAt: new Date().toISOString()
      };

      if (existing) {
        repositories.attendanceRecords.update(existing.id, payload);
      } else {
        repositories.attendanceRecords.create(payload);
      }

      refreshState();
    },

    markAllPresent: (sessionId) => {
      const session = repositories.sessions.findById(sessionId) || getSessionContext().session;
      if (!session) return;

      const classStudents = repositories.students.findByClass(session.classId);
      const now = new Date().toISOString();

      classStudents.forEach((student) => {
        const existing = repositories.attendanceRecords.findBySessionAndStudent(session.id, student.id);
        if (existing) {
          repositories.attendanceRecords.update(existing.id, {
            ...existing,
            status: "present",
            recordedAt: now
          });
        } else {
          repositories.attendanceRecords.create({
            sessionId: session.id,
            studentId: student.id,
            status: "present",
            recordedAt: now
          });
        }
      });

      refreshState();
    },

    // ACTIVITY & TIMER ACTIONS
    loadDefaultActivities: (sessionId) => {
      loadDefaultActivitiesForSession(sessionId);
      refreshState();
    },
    createSessionActivity: (input) => {
      repositories.sessionActivities.create(input);
      refreshState();
    },
    updateSessionActivity: (id, input) => {
      repositories.sessionActivities.update(id, input);
      refreshState();
    },
    deleteSessionActivity: (id) => {
      repositories.sessionActivities.delete(id);
      refreshState();
    },

    // ASSESSMENT ACTIONS
    createAssessmentDefinition: (input) => {
      repositories.assessmentDefinitions.create(input);
      refreshState();
    },
    updateAssessmentDefinition: (id, input) => {
      repositories.assessmentDefinitions.update(id, input);
      refreshState();
    },
    deleteAssessmentDefinition: (id) => {
      if (window.confirm("Hapus definisi tes/penilaian ini?")) {
        repositories.assessmentDefinitions.delete(id);
        refreshState();
      }
    },
    createAssessmentSession: (input) => {
      const res = repositories.assessmentSessions.create(input);
      refreshState();
      return res.at(-1);
    },
    saveAssessmentResult: (input) => {
      const existing = repositories.assessmentResults.findAll().find(
        (r) =>
          r.sessionId === input.sessionId &&
          r.studentId === input.studentId &&
          (input.assessmentSessionId ? r.assessmentSessionId === input.assessmentSessionId : true)
      );

      if (existing) {
        repositories.assessmentResults.update(existing.id, {
          ...existing,
          ...input
        });
      } else {
        repositories.assessmentResults.create(input);
      }
      refreshState();
    },

    // GROWTH RECORDS & MEASUREMENTS
    createGrowthRecord: (input) => {
      repositories.growthRecords.create(input);
      // Sync latest measurements to student entity
      if (input.studentId) {
        const student = repositories.students.findById(input.studentId);
        if (student) {
          repositories.students.update(student.id, {
            ...student,
            heightCm: Number(input.heightCm) || student.heightCm,
            weightKg: Number(input.weightKg) || student.weightKg
          });
        }
      }
      refreshState();
    },
    deleteGrowthRecord: (id) => {
      repositories.growthRecords.delete(id);
      refreshState();
    },

    // OBSERVATIONS
    createObservation: (input) => {
      repositories.studentObservations.create(input);
      refreshState();
    },

    // TEACHING SESSION LIFECYCLE
    createSession: (input) => {
      const created = sessionManager.createSession(input);
      const newSession = Array.isArray(created) ? created.at(-1) : created;
      if (newSession) {
        explicitSessionId = newSession.id;
        loadDefaultActivitiesForSession(newSession.id);
      }
      refreshState();
    },
    startSession: (id) => {
      sessionManager.startSession(id);
      refreshState();
    },
    pauseSession: (id) => {
      sessionManager.pauseSession(id);
      refreshState();
    },
    resumeSession: (id) => {
      sessionManager.resumeSession(id);
      refreshState();
    },
    updateSessionNotes: (id, notes) => {
      repositories.sessions.update(id, { notes });
      refreshState();
    },
    finishSession: (id) => {
      sessionManager.finishSession(id);
      refreshState();
    },
    cancelSession: (id) => {
      if (window.confirm("Batalkan sesi ini?")) {
        sessionManager.cancelSession(id);
        refreshState();
      }
    }
  };
}

function loadDefaultActivitiesForSession(sessionId) {
  const existing = repositories.sessionActivities.findBySession(sessionId);
  if (existing.length > 0) return;

  const defaults = [
    {
      sessionId,
      name: "Pemanasan Dinamis & Peregangan",
      type: "pemanasan",
      durationMinutes: 10,
      notes: "Jogging keliling lapangan 2 putaran + peregangan kepala ke kaki",
      status: "pending"
    },
    {
      sessionId,
      name: "Materi & Demonstrasi Teknik",
      type: "materi",
      durationMinutes: 15,
      notes: "Penjelasan aba-aba, posisi tubuh, dan peragaan guru",
      status: "pending"
    },
    {
      sessionId,
      name: "Praktik & Drill Berpasangan / Kelompok",
      type: "latihan",
      durationMinutes: 20,
      notes: "Pengulangan gerakan mandiri dengan koreksi langsung",
      status: "pending"
    },
    {
      sessionId,
      name: "Aplikasi / Permainan Lapangan",
      type: "permainan",
      durationMinutes: 20,
      notes: "Game sederhana yang mempraktikkan keterampilan materi",
      status: "pending"
    },
    {
      sessionId,
      name: "Pendinginan, Evaluasi & Doa",
      type: "pendinginan",
      durationMinutes: 10,
      notes: "Pelepasan otot, evaluasi bersama, dan rekap kehadiran",
      status: "pending"
    }
  ];

  defaults.forEach((d) => repositories.sessionActivities.create(d));
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
  const sessionContext = getSessionContext();

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
    ...sessionContext,
    ...createCrudActions()
  };

  const sessionNotice = sessionContext.resumeAvailable && appState.currentScreen !== SCREENS.session
    ? createResumeBanner(sessionContext.session)
    : null;

  appRoot.append(
    header,
    sessionNotice,
    renderScreen(
      {
        ...appState,
        session: sessionContext.session,
        sessionContext
      },
      actions
    ),
    createNavigation(appState.currentScreen, setScreen)
  );

  // Render modal on top if active
  if (activeModalStudentId) {
    appRoot.append(
      renderStudentDetailModal(
        activeModalStudentId,
        {
          ...appState,
          growthRecords: repositories.growthRecords.findAll(),
          attendanceRecords: repositories.attendanceRecords.findAll(),
          assessmentResults: repositories.assessmentResults.findAll(),
          assessmentDefinitions: repositories.assessmentDefinitions.findAll(),
          observations: repositories.studentObservations.findAll(),
          sessions: repositories.sessions.findAll(),
          classes: appState.classes,
          students: appState.students,
          tags: appState.studentTags,
          actions
        },
        () => {
          activeModalStudentId = null;
          renderApp();
        }
      )
    );
  }
}

function createResumeBanner(session) {
  const banner = document.createElement("section");
  banner.className = "resume-banner";

  const text = document.createElement("div");
  const title = document.createElement("strong");
  title.textContent = "Lanjutkan sesi mengajar aktif?";
  const subtitle = document.createElement("span");
  subtitle.textContent = session ? `Sesi ${session.sessionNumber || ""} (${session.topic || "PJOK"}) masih ${session.status}.` : "";
  text.append(title, subtitle);

  const button = document.createElement("button");
  button.type = "button";
  button.className = "text-button";
  button.textContent = "Buka";
  button.addEventListener("click", () => setScreen(SCREENS.session));

  banner.append(text, button);
  return banner;
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
