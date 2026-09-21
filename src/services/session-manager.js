import { SESSION_ENGINE_STATE, SESSION_STATUS, createSessionTimelineEvent } from "../data/session-state.js";

function setSessionState(session, status, state, eventType, extra = {}) {
  const event = createSessionTimelineEvent(eventType, { meta: extra });
  return {
    ...session,
    status,
    state,
    startTime: extra.startTime || session.startTime,
    endTime: extra.endTime || session.endTime,
    timeline: [...(session.timeline || []), event]
  };
}

export class SessionManager {
  constructor(sessionRepository, stateAccessor) {
    this.sessionRepository = sessionRepository;
    this.stateAccessor = stateAccessor;
  }

  getActiveSession() {
    return this.sessionRepository.findActive();
  }

  getPausedSession() {
    return this.sessionRepository.findPaused();
  }

  getResumeCandidate() {
    return this.getActiveSession() || this.getPausedSession();
  }

  isEditable(session) {
    if (!session) return false;
    return (
      session.status === SESSION_STATUS.planned ||
      session.status === SESSION_STATUS.active ||
      session.status === SESSION_STATUS.paused
    );
  }

  isReadOnly(session) {
    if (!session) return true;
    return (
      session.status === SESSION_STATUS.completed ||
      session.status === SESSION_STATUS.cancelled
    );
  }

  createSession(input, options = {}) {
    const created = this.sessionRepository.create({
      ...input,
      status: SESSION_STATUS.planned,
      state: SESSION_ENGINE_STATE.NOT_STARTED
    });
    const newSession = Array.isArray(created) ? created.at(-1) : created;

    if (options.startImmediately && newSession) {
      return this.startSession(newSession.id, { autoPauseOther: true });
    }

    return newSession;
  }

  startSession(sessionId, options = { autoPauseOther: true }) {
    const session = this.sessionRepository.findById(sessionId);
    if (!session) {
      return null;
    }

    // Enforce invariant: Only 1 ACTIVE session at a time
    const activeSession = this.getActiveSession();
    if (activeSession && activeSession.id !== sessionId) {
      if (options.autoPauseOther) {
        this.pauseSession(activeSession.id);
      } else {
        return null;
      }
    }

    if (session.status !== SESSION_STATUS.planned && session.status !== SESSION_STATUS.paused) {
      return null;
    }

    const startedAt = new Date().toISOString();
    const updatedSession = setSessionState(
      session,
      SESSION_STATUS.active,
      SESSION_ENGINE_STATE.ACTIVE,
      session.status === SESSION_STATUS.paused ? "session-resumed" : "session-started",
      { startTime: session.startTime || startedAt }
    );

    this.sessionRepository.update(session.id, updatedSession);
    return this.sessionRepository.findById(session.id);
  }

  pauseSession(sessionId) {
    const session = this.sessionRepository.findById(sessionId);
    if (!session || session.status !== SESSION_STATUS.active) {
      return null;
    }

    const updatedSession = setSessionState(
      session,
      SESSION_STATUS.paused,
      SESSION_ENGINE_STATE.PAUSED,
      "session-paused"
    );

    this.sessionRepository.update(session.id, updatedSession);
    return this.sessionRepository.findById(session.id);
  }

  resumeSession(sessionId) {
    return this.startSession(sessionId, { autoPauseOther: true });
  }

  updateSession(sessionId, updates) {
    const session = this.sessionRepository.findById(sessionId);
    if (!session) {
      throw new Error("Sesi tidak ditemukan.");
    }
    if (this.isReadOnly(session)) {
      throw new Error("Sesi yang sudah Selesai atau Dibatalkan tidak dapat diubah.");
    }
    const updated = {
      ...session,
      ...updates,
      updatedAt: new Date().toISOString()
    };
    this.sessionRepository.update(sessionId, updated);
    return this.sessionRepository.findById(sessionId);
  }

  finishSession(sessionId) {
    const session = this.sessionRepository.findById(sessionId);
    if (!session) {
      return null;
    }
    if (this.isReadOnly(session)) {
      return session; // Immutable
    }

    const finishedAt = new Date().toISOString();
    const updatedSession = setSessionState(
      session,
      SESSION_STATUS.completed,
      SESSION_ENGINE_STATE.COMPLETED,
      "session-finished",
      { endTime: finishedAt }
    );

    this.sessionRepository.update(session.id, updatedSession);
    return this.sessionRepository.findById(session.id);
  }

  cancelSession(sessionId) {
    const session = this.sessionRepository.findById(sessionId);
    if (!session) {
      return null;
    }
    if (this.isReadOnly(session)) {
      return session; // Immutable
    }

    const updatedSession = setSessionState(
      session,
      SESSION_STATUS.cancelled,
      SESSION_ENGINE_STATE.ABANDONED,
      "session-cancelled",
      { endTime: new Date().toISOString() }
    );

    this.sessionRepository.update(session.id, updatedSession);
    return this.sessionRepository.findById(session.id);
  }

  startSessionForClass(classId, contextInfo = {}) {
    if (!classId) throw new Error("Kelas tidak valid.");

    const classSessions = this.sessionRepository.findByClass(classId);
    const existingActive = classSessions.find((s) => s.status === SESSION_STATUS.active);
    if (existingActive) {
      return existingActive;
    }

    const existingPaused = classSessions.find((s) => s.status === SESSION_STATUS.paused);
    if (existingPaused) {
      return this.resumeSession(existingPaused.id);
    }

    const today = contextInfo.date || new Date().toISOString().slice(0, 10);
    const existingPlannedToday = classSessions.find(
      (s) => s.status === SESSION_STATUS.planned && s.date === today
    );
    if (existingPlannedToday) {
      return this.startSession(existingPlannedToday.id, { autoPauseOther: true });
    }

    const activeState = typeof this.stateAccessor === "function" ? this.stateAccessor() : {};
    const academicYearId = contextInfo.academicYearId || activeState.activeAcademicYearId || (activeState.academicYears?.[0]?.id || "");
    const semesterId = contextInfo.semesterId || activeState.activeSemesterId || (activeState.semesters?.[0]?.id || "");
    const teacherId = contextInfo.teacherId || (activeState.teachers?.[0]?.id || "");

    const now = new Date();
    const startTime = contextInfo.startTime || `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    const newSessionInput = {
      classId,
      academicYearId,
      semesterId,
      teacherId,
      date: today,
      startTime,
      sessionNumber: contextInfo.sessionNumber || String(classSessions.length + 1),
      topic: contextInfo.topic || "Pembelajaran Praktik PJOK",
      material: contextInfo.material || "",
      location: contextInfo.location || "Lapangan Sekolah",
      weather: contextInfo.weather || "Cerah"
    };

    return this.createSession(newSessionInput, { startImmediately: true });
  }
}
