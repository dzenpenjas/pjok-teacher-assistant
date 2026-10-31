import { COLLECTIONS } from "../data/schema.js";
import { createSchool } from "../data/models.js";
import { BaseRepository } from "./base-repository.js";

export class SchoolRepository extends BaseRepository {
  constructor(storage) {
    super({
      collectionName: COLLECTIONS.schools,
      createEntity: createSchool,
      ...storage
    });
  }

  get() {
    const list = this.list();
    if (list.length > 0) {
      return list[0];
    }
    return null;
  }

  save(data) {
    const state = this.loadState();
    const existing = (state[this.collectionName] || [])[0];
    const updated = createSchool({
      ...existing,
      ...data,
      id: existing?.id || data.id || "school-singleton",
      createdAt: existing?.createdAt
    });
    this.persistCollection(state, [updated]);
    return updated;
  }
}
