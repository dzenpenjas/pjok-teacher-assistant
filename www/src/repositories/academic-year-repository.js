import { createAcademicYear } from "../data/models.js";
import { COLLECTIONS } from "../data/schema.js";
import { BaseRepository } from "./base-repository.js";

export class AcademicYearRepository extends BaseRepository {
  constructor(storage) {
    super({
      collectionName: COLLECTIONS.academicYears,
      createEntity: createAcademicYear,
      ...storage
    });
  }

  getActive() {
    const state = this.loadState();
    if (state.activeAcademicYearId) {
      const year = this.findById(state.activeAcademicYearId);
      if (year) return year;
    }
    const list = this.list();
    return list.find((y) => y.isActive) || list[0] || null;
  }

  setActive(id) {
    const state = this.loadState();
    const list = (state.academicYears || []).map((y) => ({
      ...y,
      isActive: y.id === id
    }));
    const nextState = {
      ...state,
      academicYears: list,
      activeAcademicYearId: id
    };
    this.saveState(nextState);
    return list.find((y) => y.id === id) || null;
  }
}
