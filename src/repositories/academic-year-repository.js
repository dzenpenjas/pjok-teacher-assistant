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
}
