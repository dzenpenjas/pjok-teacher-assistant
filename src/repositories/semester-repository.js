import { createSemester } from "../data/models.js";
import { COLLECTIONS } from "../data/schema.js";
import { BaseRepository } from "./base-repository.js";

export class SemesterRepository extends BaseRepository {
  constructor(storage) {
    super({
      collectionName: COLLECTIONS.semesters,
      createEntity: createSemester,
      ...storage
    });
  }

  getActive() {
    const state = this.loadState();
    if (state.activeSemesterId) {
      const sem = this.findById(state.activeSemesterId);
      if (sem) return sem;
    }
    const list = this.list();
    return list.find((s) => s.isActive) || list[0] || null;
  }

  setActive(id) {
    const state = this.loadState();
    const list = (state.semesters || []).map((s) => ({
      ...s,
      isActive: s.id === id
    }));
    const nextState = {
      ...state,
      semesters: list,
      activeSemesterId: id
    };
    this.saveState(nextState);
    return list.find((s) => s.id === id) || null;
  }
}
