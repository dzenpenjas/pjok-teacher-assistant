import test from "node:test";
import assert from "node:assert/strict";

// Setup memory storage mock for test environment
const memoryStorage = new Map();
let simulateQuotaError = false;

globalThis.window = {
  localStorage: {
    getItem: (key) => (memoryStorage.has(key) ? memoryStorage.get(key) : null),
    setItem: (key, val) => {
      if (simulateQuotaError) {
        const err = new Error("QuotaExceededError");
        err.name = "QuotaExceededError";
        throw err;
      }
      memoryStorage.set(key, String(val));
    },
    removeItem: (key) => memoryStorage.delete(key),
    clear: () => memoryStorage.clear()
  },
  alert: () => {},
  confirm: () => true
};
globalThis.localStorage = globalThis.window.localStorage;
globalThis.document = {
  querySelector: () => null,
  createElement: () => ({
    append: () => {},
    replaceChildren: () => {},
    addEventListener: () => {}
  })
};

import { saveState, loadState } from "../src/storage/storage.js";
import { createRepositoryContext } from "../src/repositories/repository-context.js";
import { createStudent, createStudentNote, createGrowthRecord } from "../src/data/models.js";

test("A1: createStudent() returns success result contract when persistence succeeds", () => {
  memoryStorage.clear();
  simulateQuotaError = false;
  const repositories = createRepositoryContext();

  const state = repositories.students.loadState();
  const student = createStudent({
    name: "Ahmad Fauzan",
    studentNumber: "001",
    gender: "male",
    birthDate: "2015-01-01",
    classId: "class-1"
  });

  const saveResult = repositories.students.saveState({
    ...state,
    students: [...(state.students || []), student]
  });

  assert.equal(saveResult.success, true);
  assert.ok(student.id);
});

test("A2: createStudent() returns failure result contract when persistence fails", () => {
  memoryStorage.clear();
  simulateQuotaError = true;
  const repositories = createRepositoryContext();

  const state = repositories.students.loadState();
  const student = createStudent({
    name: "Siti Aisyah",
    classId: "class-1"
  });

  const saveResult = repositories.students.saveState({
    ...state,
    students: [...(state.students || []), student]
  });

  assert.equal(saveResult.success, false);
  assert.ok(saveResult.error);
});

test("A3: updateStudent() returns success result contract when persistence succeeds", () => {
  memoryStorage.clear();
  simulateQuotaError = false;
  const repositories = createRepositoryContext();

  const initialState = loadState();
  const st1 = createStudent({ id: "st-100", name: "Original Name", classId: "class-1" });
  saveState({ ...initialState, students: [st1] });

  const state = repositories.students.loadState();
  const studentIndex = state.students.findIndex((s) => s.id === "st-100");
  const updatedStudent = createStudent({
    ...state.students[studentIndex],
    name: "Updated Name"
  });

  const nextStudents = [...state.students];
  nextStudents[studentIndex] = updatedStudent;

  const saveResult = repositories.students.saveState({
    ...state,
    students: nextStudents
  });

  assert.equal(saveResult.success, true);
  assert.equal(updatedStudent.id, "st-100");
  assert.equal(updatedStudent.name, "Updated Name");
});

test("A4: updateStudent() returns failure result contract when persistence fails", () => {
  memoryStorage.clear();
  const initialState = loadState();
  const st1 = createStudent({ id: "st-101", name: "Original Name", classId: "class-1" });
  saveState({ ...initialState, students: [st1] });

  simulateQuotaError = true;
  const repositories = createRepositoryContext();
  const state = repositories.students.loadState();
  const studentIndex = state.students.findIndex((s) => s.id === "st-101");
  const updatedStudent = createStudent({
    ...state.students[studentIndex],
    name: "Failed Update"
  });

  const nextStudents = [...state.students];
  nextStudents[studentIndex] = updatedStudent;

  const saveResult = repositories.students.saveState({
    ...state,
    students: nextStudents
  });

  assert.equal(saveResult.success, false);
});

test("A5: batchCreateStudents() returns success result contract when batch import succeeds", () => {
  memoryStorage.clear();
  simulateQuotaError = false;
  const repositories = createRepositoryContext();

  const state = repositories.students.loadState();
  const inputs = [
    { name: "Student 1", studentNumber: "01", classId: "class-1" },
    { name: "Student 2", studentNumber: "02", classId: "class-1" }
  ];

  const createdList = inputs.map((inp) => createStudent(inp));
  const saveResult = repositories.students.saveState({
    ...state,
    students: [...(state.students || []), ...createdList]
  });

  assert.equal(saveResult.success, true);
  assert.equal(createdList.length, 2);
});

test("A7: deleteCascade() removes student and all related data (cascading delete)", () => {
  memoryStorage.clear();
  simulateQuotaError = false;
  const repositories = createRepositoryContext();
  
  // Seed data
  const student = createStudent({ id: "st-999", name: "Target Student", classId: "class-1" });
  const otherStudent = createStudent({ id: "st-other", name: "Keep Me", classId: "class-1" });
  
  const state = loadState();
  saveState({
    ...state,
    students: [student, otherStudent],
    attendanceRecords: [{ id: "att-1", studentId: student.id, status: "present" }],
    assessmentResults: [{ id: "res-1", studentId: student.id, value: 85 }],
    growthRecords: [{ id: "grow-1", studentId: student.id, heightCm: "150" }],
    studentObservations: [{ id: "obs-1", studentId: student.id, text: "Good" }],
    studentNotes: [{ id: "note-1", studentId: student.id, text: "Note" }],
    studentReports: [{ id: "rep-1", studentId: student.id, draft: {} }]
  });

  const result = repositories.students.deleteCascade(student.id);
  
  assert.equal(result.success, true);
  assert.equal(result.data.id, student.id);
  
  const nextState = loadState();
  assert.equal(nextState.students.length, 1);
  assert.equal(nextState.students[0].id, "st-other");
  assert.equal(nextState.attendanceRecords.length, 0);
  assert.equal(nextState.assessmentResults.length, 0);
  assert.equal(nextState.growthRecords.length, 0);
  assert.equal(nextState.studentObservations.length, 0);
  assert.equal(nextState.studentNotes.length, 0);
  assert.equal(nextState.studentReports.length, 0);
});

test("A8: updateStudent() correctly preserves other properties and updates gender/birthDate/classId", () => {
  memoryStorage.clear();
  const repositories = createRepositoryContext();
  
  const original = createStudent({ 
    id: "st-update", 
    name: "Original Name", 
    classId: "old-class",
    gender: "male",
    birthDate: "2010-01-01",
    photo: "photo-data"
  });
  
  const state = loadState();
  saveState({ ...state, students: [original] });
  
  // Perform update via repository
  const updateInput = {
    gender: "female",
    birthDate: "2011-02-02",
    classId: "new-class"
  };
  
  const result = repositories.students.update(original.id, updateInput);
  
  const updated = result.find(s => s.id === original.id);
  assert.equal(updated.gender, "female");
  assert.equal(updated.birthDate, "2011-02-02");
  assert.equal(updated.classId, "new-class");
  assert.equal(updated.name, "Original Name"); // Preserved
  assert.equal(updated.photo, "photo-data"); // Preserved
});

test("A9: deleteCascade() returns failure contract when saveState fails", () => {
  memoryStorage.clear();
  const repositories = createRepositoryContext();
  
  const student = createStudent({ id: "st-fail", name: "Fail Delete" });
  saveState({ ...loadState(), students: [student] });
  
  simulateQuotaError = true;
  const result = repositories.students.deleteCascade(student.id);
  
  assert.equal(result.success, false);
  assert.ok(result.error);
  
  // Verify data still exists in storage (not deleted because save failed)
  simulateQuotaError = false;
  const state = loadState();
  assert.ok(state.students.find(s => s.id === student.id));
});
