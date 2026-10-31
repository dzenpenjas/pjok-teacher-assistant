import { createTeachingSchedule } from "../data/models.js";
import { COLLECTIONS } from "../data/schema.js";
import { BaseRepository } from "./base-repository.js";
import { compareTime } from "../utils/date-utils.js";

export class ScheduleRepository extends BaseRepository {
  constructor(storage) {
    super({
      collectionName: COLLECTIONS.schedules,
      createEntity: createTeachingSchedule,
      ...storage
    });
  }

  getAll() {
    return this.list();
  }

  getById(id) {
    return this.findById(id);
  }

  getByClassId(classId) {
    return this.list().filter((s) => s.classId === classId);
  }

  getByDay(dayOfWeek, activeOnly = true) {
    const day = Number(dayOfWeek);
    return this.list().filter((s) => s.dayOfWeek === day && (!activeOnly || s.active));
  }

  getActive() {
    return this.list().filter((s) => s.active);
  }

  validateScheduleInput(input, excludeId = null) {
    const dayOfWeek = Number(input.dayOfWeek);
    if (isNaN(dayOfWeek) || dayOfWeek < 1 || dayOfWeek > 6) {
      throw new Error("Jadwal mengajar hanya berlaku untuk hari Senin s/d Sabtu (hari 1 - 6).");
    }

    if (!input.startTime || !input.endTime) {
      throw new Error("Jam mulai dan jam selesai wajib diisi.");
    }

    if (compareTime(input.endTime, input.startTime) <= 0) {
      throw new Error("Jam selesai harus lebih akhir dari jam mulai.");
    }

    if (!input.classId) {
      throw new Error("Kelas wajib dipilih.");
    }

    // Check if class exists and is active
    const state = this.loadState();
    const targetClass = (state.classes || []).find((c) => c.id === input.classId);
    if (!targetClass) {
      throw new Error("Kelas tidak ditemukan.");
    }
    if (targetClass.status === "archived") {
      throw new Error("Tidak dapat membuat jadwal untuk kelas yang sudah diarsipkan.");
    }

    // Check for schedule overlaps on the same day for active schedules
    const active = input.active !== undefined ? Boolean(input.active) : true;
    if (active) {
      const existing = (state.schedules || []).filter(
        (s) => s.id !== excludeId && s.dayOfWeek === dayOfWeek && s.active
      );

      for (const sched of existing) {
        // Overlap condition: start < existing.end && end > existing.start
        if (
          compareTime(input.startTime, sched.endTime) < 0 &&
          compareTime(input.endTime, sched.startTime) > 0
        ) {
          const overlapClass = (state.classes || []).find((c) => c.id === sched.classId);
          throw new Error(
            `Jadwal bentrok dengan kelas ${overlapClass?.name || "lain"} (${sched.startTime} - ${sched.endTime}).`
          );
        }
      }
    }
  }

  create(input) {
    this.validateScheduleInput(input);
    const schedule = createTeachingSchedule(input);
    const list = [...this.list(), schedule];
    const state = this.loadState();
    this.persistCollection(state, list);
    return schedule;
  }

  update(id, updates) {
    const existing = this.findById(id);
    if (!existing) {
      throw new Error("Jadwal tidak ditemukan.");
    }

    const merged = { ...existing, ...updates };
    this.validateScheduleInput(merged, id);

    const updated = createTeachingSchedule(merged);
    const list = this.list().map((s) => (s.id === id ? updated : s));
    const state = this.loadState();
    this.persistCollection(state, list);
    return updated;
  }

  deactivateForClass(classId) {
    const list = this.list().map((s) =>
      s.classId === classId ? { ...s, active: false } : s
    );
    const state = this.loadState();
    this.persistCollection(state, list);
    return list;
  }

  delete(id) {
    const list = this.list().filter((s) => s.id !== id);
    const state = this.loadState();
    this.persistCollection(state, list);
    return list;
  }
}
