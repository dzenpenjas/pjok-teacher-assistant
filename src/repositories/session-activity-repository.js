import { createSessionActivity } from "../data/models.js";
import { COLLECTIONS } from "../data/schema.js";
import { BaseRepository } from "./base-repository.js";

export class SessionActivityRepository extends BaseRepository {
  constructor(storage) {
    super({
      collectionName: COLLECTIONS.sessionActivities,
      createEntity: createSessionActivity,
      ...storage
    });
  }

  findBySession(sessionId) {
    return this.list().filter((activity) => activity.sessionId === sessionId);
  }
}
