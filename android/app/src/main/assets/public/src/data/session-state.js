export const SESSION_STATUS = {
  planned: "planned",
  active: "active",
  paused: "paused",
  completed: "completed",
  cancelled: "cancelled"
};

export const SESSION_ENGINE_STATE = {
  NOT_STARTED: "NOT_STARTED",
  ACTIVE: "ACTIVE",
  PAUSED: "PAUSED",
  COMPLETED: "COMPLETED",
  ABANDONED: "ABANDONED"
};

export function createSessionTimelineEvent(type, details = {}) {
  return {
    id: details.id || `event-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    at: details.at || new Date().toISOString(),
    meta: details.meta || {}
  };
}
