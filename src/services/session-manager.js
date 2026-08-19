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

  createSession(input) {
    return this.sessionRepository.create({
      ...input,
      status: SESSION_STATUS.planned,
      state: SESSION_ENGINE_STATE.NOT_STARTED
    });
  }

  startSession(sessionId) {
    const session = this.sessionRepository.findById(sessionId);
    const activeSession = this.getActiveSession();
    if (!session || (activeSession && activeSession.id !== sessionId)) {
      return null;
    }

    if (session.status !== SESSION_STATUS.planned) {
      return null;
    }

    const startedAt = new Date().toISOString();
    const updatedSession = setSessionState(
      session,
      SESSION_STATUS.active,
      SESSION_ENGINE_STATE.ACTIVE,
      "session-started",
      { startTime: session.startTime || startedAt }
    );

    return this.sessionRepository.update(session.id, updatedSession);
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

    return this.sessionRepository.update(session.id, updatedSession);
  }

  resumeSession(sessionId) {
    const session = this.sessionRepository.findById(sessionId);
    const activeSession = this.getActiveSession();
    if (!session || session.status !== SESSION_STATUS.paused || (activeSession && activeSession.id !== sessionId)) {
      return null;
    }

    const updatedSession = setSessionState(
      session,
      SESSION_STATUS.active,
      SESSION_ENGINE_STATE.ACTIVE,
      "session-resumed"
    );

    return this.sessionRepository.update(session.id, updatedSession);
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

    return this.sessionRepository.update(session.id, updatedSession);
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

    return this.sessionRepository.update(session.id, updatedSession);
  }
}
