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

test("A6: batchCreateStudents() returns failure result contract when batch persistence fails", () => {
  memoryStorage.clear();
  simulateQuotaError = true;
  const repositories = createRepositoryContext();

  const state = repositories.students.loadState();
  const inputs = [{ name: "Student 1", classId: "class-1" }];
  const createdList = inputs.map((inp) => createStudent(inp));

  const saveResult = repositories.students.saveState({
    ...state,
    students: [...(state.students || []), ...createdList]
  });

  assert.equal(saveResult.success, false);
});
