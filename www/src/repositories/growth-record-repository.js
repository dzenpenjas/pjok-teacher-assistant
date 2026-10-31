import { createGrowthRecord } from "../data/models.js";
import { COLLECTIONS } from "../data/schema.js";
import { BaseRepository } from "./base-repository.js";

export class GrowthRecordRepository extends BaseRepository {
  constructor(storage) {
    super({
      collectionName: COLLECTIONS.growthRecords,
      createEntity: createGrowthRecord,
      ...storage
    });
  }

  findByStudent(studentId) {
    return this.list()
      .filter((record) => record.studentId === studentId)
      .sort((a, b) => (a.date > b.date ? 1 : -1));
  }

  findLatestByStudent(studentId) {
    const list = this.findByStudent(studentId);
    return list.length > 0 ? list[list.length - 1] : null;
  }
}
