import { createSession } from "../data/models.js";
import { COLLECTIONS } from "../data/schema.js";
import { BaseRepository } from "./base-repository.js";

export class SessionRepository extends BaseRepository {
  constructor(storage) {
    super({
      collectionName: COLLECTIONS.sessions,
      createEntity: createSession,
      ...storage
    });
  }

  findAll() {
    return this.list();
  }

  findByDate(date) {
    return this.list().filter((session) => session.date === date);
  }

  findActive() {
    return this.list().find((session) => session.status === "active") || null;
  }

  findPaused() {
    return this.list().find((session) => session.status === "paused") || null;
  }

  findByClass(classId) {
    return this.list().filter((session) => session.classId === classId);
  }
}
