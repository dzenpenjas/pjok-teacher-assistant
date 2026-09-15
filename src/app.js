import { SCREENS } from "./data/schema.js";
import { importStateFromJson, exportStateAsJson, inspectBackupJson } from "./storage/backup.js";
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

// Export and expose actions globally early so external/test environments have access
export let actions = {};
if (typeof window !== "undefined") {
  window.actions = actions;
}
if (typeof globalThis !== "undefined") {
  globalThis.actions = actions;
}

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
      // 1. If this class already has an active or paused session, resume it directly
      const existingActiveForClass = repositories.sessions.findByClass(classId).find((s) => s.status === "active" || s.status === "paused");
      if (existingActiveForClass) {
        explicitSessionId = existingActiveForClass.id;
        refreshState();
        setScreen(SCREENS.session);
        return;
      }

      // 2. If another class has an active session, prompt teacher before auto-pausing
      const currentActive = sessionManager.getResumeCandidate();
      if (currentActive && currentActive.classId !== classId && (currentActive.status === "active" || currentActive.status === "paused")) {
        const currentClassObj = (appState.classes || []).find((c) => c.id === currentActive.classId);
        const targetClassObj = (appState.classes || []).find((c) => c.id === classId);
        const currentName = currentClassObj ? currentClassObj.name : "sebelumnya";
        const targetName = targetClassObj ? targetClassObj.name : "baru";

        const proceed = window.confirm(
          `Anda sedang memiliki sesi mengajar aktif untuk Kelas ${currentName}.\n\n` +
          `Mulai sesi untuk Kelas ${targetName}?\n` +
          `Sesi Kelas ${currentName} akan otomatis dijeda (pause) dan dapat dilanjutkan kembali kapan saja.`
        );
        if (!proceed) {
          return;
        }
      }

      const existingSessionsForClass = repositories.sessions.findByClass(classId);
      const nextNum = existingSessionsForClass.length + 1;
      const today = new Date().toISOString().slice(0, 10);
      const school = repositories.schools.get();
      const teacher = repositories.teachers.get();
      const academicYear = appState.academicYears[0];
      const semester = appState.semesters[0];

      const newSession = sessionManager.createSession(
        {
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
          weather: "Cerah"
        },
        { startImmediately: true, autoPauseOther: true }
      );

      if (newSession) {
        explicitSessionId = newSession.id;
        loadDefaultActivitiesForSession(newSession.id);
      }
      refreshState();
      setScreen(SCREENS.session);
    },

    // SINGLETON PROFILES
    saveSchool: (input) => {
      repositories.schools.save(input);
      refreshState();
    },
    saveSchoolProfile: (input) => {
      repositories.schools.save(input);
      refreshState();
    },
    saveTeacher: (input) => {
      repositories.teachers.save(input);
      refreshState();
    },
    saveTeacherProfile: (input) => {
      repositories.teachers.save(input);
      refreshState();
    },

    // MASTER DATA ACTIONS
    createSchool: (input) => {
      repositories.schools.save(input);
      refreshState();
    },
    updateSchool: (id, input) => {
      repositories.schools.save(input);
      refreshState();
    },
    deleteSchool: () => {
      window.alert("Data sekolah merupakan profil utama dan tidak dapat dihapus.");
    },
    createTeacher: (input) => {
      repositories.teachers.save(input);
      refreshState();
    },
    updateTeacher: (id, input) => {
      repositories.teachers.save(input);
      refreshState();
    },
    deleteTeacher: () => {
      window.alert("Data guru merupakan profil utama dan tidak dapat dihapus.");
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
      const classStudents = repositories.students.findByClass(id);
      const classSessions = repositories.sessions.findByClass(id);
      const msg = `Hapus kelas ini?\n` +
        `Terdapat ${classStudents.length} siswa dan ${classSessions.length} sesi mengajar yang akan dihapus.\n` +
        `Semua data absensi dan penilaian terkait kelas ini akan dibersihkan. Lanjutkan?`;
      if (window.confirm(msg)) {
        repositories.classes.deleteCascade(id);
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
      const student = repositories.students.findById(id);
      const studentName = student?.name ? `"${student.name}"` : "siswa ini";
      const msg = `Hapus ${studentName}?\n` +
        `Semua data riwayat absensi, hasil tes penilaian fisik, grafik pertumbuhan, dan observasi siswa ini akan dihapus secara permanen. Lanjutkan?`;
      if (window.confirm(msg)) {
        repositories.students.deleteCascade(id);
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
      const session = repositories.sessions.findById(input.sessionId);
      if (session && sessionManager.isReadOnly(session)) {
        return;
      }

      const allResults = repositories.assessmentResults.findAll();
      const existing = allResults.find((r) => {
        if (r.studentId !== input.studentId) return false;
        if (input.assessmentSessionId && r.assessmentSessionId) {
          return r.assessmentSessionId === input.assessmentSessionId;
        }
        if (input.definitionId && r.definitionId) {
          return r.sessionId === input.sessionId && r.definitionId === input.definitionId;
        }
        return r.sessionId === input.sessionId;
      });

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

function importData(fileOrText) {
  const getTextPromise = typeof fileOrText === "string"
    ? Promise.resolve(fileOrText)
    : (fileOrText && typeof fileOrText.text === "function" ? fileOrText.text() : Promise.reject(new Error("Invalid file or text")));

  getTextPromise
    .then((text) => {
      const check = inspectBackupJson(text);
      if (!check.valid) {
        window.alert(`Data cadangan tidak valid:\n${check.error}`);
        return;
      }

      appState = importStateFromJson(text);
      refreshState();
      window.alert("Data cadangan berhasil dipulihkan.");
    })
    .catch((error) => {
      window.alert("File backup tidak dapat diproses.");
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

  const appActions = {
    navigate: setScreen,
    exportData,
    importData,
    ...sessionContext,
    ...createCrudActions()
  };

  actions = appActions;
  if (typeof window !== "undefined") {
    window.actions = appActions;
  }
  if (typeof globalThis !== "undefined") {
    globalThis.actions = appActions;
  }

  const sessionNotice = sessionContext.resumeAvailable && appState.currentScreen !== SCREENS.session
    ? createResumeBanner(sessionContext.session)
    : null;

  appRoot.append(header);
  if (sessionNotice) {
    appRoot.append(sessionNotice);
  }
  appRoot.append(
    renderScreen(
      {
        ...appState,
        session: sessionContext.session,
        sessionContext
      },
      appActions
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
          actions: appActions
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
