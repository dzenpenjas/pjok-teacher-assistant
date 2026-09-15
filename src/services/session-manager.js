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

  finishSession(sessionId) {
    const session = this.sessionRepository.findById(sessionId);
    if (!session) {
      return null;
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
}
