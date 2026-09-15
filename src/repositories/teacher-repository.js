import { createTeacher } from "../data/models.js";
import { COLLECTIONS } from "../data/schema.js";
import { BaseRepository } from "./base-repository.js";

export class TeacherRepository extends BaseRepository {
  constructor(storage) {
    super({
      collectionName: COLLECTIONS.teachers,
      createEntity: createTeacher,
      ...storage
    });
  }

  get() {
    const list = this.list();
    if (list.length > 0) {
      return list[0];
    }
    const defaultTeacher = createTeacher({
      name: "Bapak Dzen",
      employeeNumber: "PJOK-001",
      phone: "081234567890"
    });
    this.save(defaultTeacher);
    return defaultTeacher;
  }

  save(data) {
    const state = this.loadState();
    const existing = (state[this.collectionName] || [])[0];
    const updated = createTeacher({
      ...existing,
      ...data,
      id: existing?.id || data.id || "teacher-singleton",
      createdAt: existing?.createdAt
    });
    this.persistCollection(state, [updated]);
    return updated;
  }
}
