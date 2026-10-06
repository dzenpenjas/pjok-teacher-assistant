import test from "node:test";
import assert from "node:assert/strict";
import * as xlsxModule from "xlsx";

// Provide XLSX in Node.js test environment
globalThis.XLSX = xlsxModule.read ? xlsxModule : xlsxModule.default || xlsxModule;

import {
  normalizeGender,
  normalizeBirthDate,
  isValidCalendarDate,
  parseStudentWorkbook,
  generateStudentTemplateWorkbook
} from "../src/services/student-xlsx-adapter.js";
import { getXLSX } from "../src/services/xlsx-runtime.js";
import { createStudent } from "../src/data/models.js";

test("getXLSX returns the XLSX instance from global scope", () => {
  const XLSX = getXLSX();
  assert.ok(XLSX);
  assert.equal(typeof XLSX.utils.book_new, "function");
});

test("isValidCalendarDate correctly identifies real calendar dates", () => {
  assert.equal(isValidCalendarDate(2019, 2, 28), true);
  assert.equal(isValidCalendarDate(2019, 2, 31), false); // Feb 31 does not exist
  assert.equal(isValidCalendarDate(2020, 2, 29), true); // 2020 is leap year
  assert.equal(isValidCalendarDate(2019, 2, 29), false); // 2019 is not leap year
  assert.equal(isValidCalendarDate(2019, 4, 31), false); // April has 30 days
  assert.equal(isValidCalendarDate(2019, 99, 99), false);
});

test("normalizeGender handles standard and common Indonesian variants and flags invalid non-empty", () => {
  assert.deepEqual(normalizeGender("L"), { gender: "male", isValid: true, raw: "L" });
  assert.deepEqual(normalizeGender("Laki-laki"), { gender: "male", isValid: true, raw: "Laki-laki" });
  assert.deepEqual(normalizeGender("Laki laki"), { gender: "male", isValid: true, raw: "Laki laki" });
  assert.deepEqual(normalizeGender("male"), { gender: "male", isValid: true, raw: "male" });

  assert.deepEqual(normalizeGender("P"), { gender: "female", isValid: true, raw: "P" });
  assert.deepEqual(normalizeGender("Perempuan"), { gender: "female", isValid: true, raw: "Perempuan" });
  assert.deepEqual(normalizeGender("female"), { gender: "female", isValid: true, raw: "female" });

  assert.deepEqual(normalizeGender(""), { gender: "", isValid: true, raw: "" });
  assert.deepEqual(normalizeGender(null), { gender: "", isValid: true, raw: "" });

  // Unknown non-empty value
  assert.deepEqual(normalizeGender("XYZ"), { gender: "", isValid: false, raw: "XYZ" });
});

test("normalizeBirthDate handles real calendar dates, invalid dates, and Excel serial numbers", () => {
  assert.deepEqual(normalizeBirthDate("2019-03-12"), { birthDate: "2019-03-12", isValid: true, raw: "2019-03-12" });
  assert.deepEqual(normalizeBirthDate("12/03/2019"), { birthDate: "2019-03-12", isValid: true, raw: "12/03/2019" });
  assert.deepEqual(normalizeBirthDate("12 Maret 2019"), { birthDate: "2019-03-12", isValid: true, raw: "12 Maret 2019" });

  // Empty values are valid
  assert.deepEqual(normalizeBirthDate(""), { birthDate: "", isValid: true, raw: "" });
  assert.deepEqual(normalizeBirthDate(null), { birthDate: "", isValid: true, raw: "" });

  // Invalid real calendar dates produce isValid: false
  assert.deepEqual(normalizeBirthDate("2019-02-31"), { birthDate: "", isValid: false, raw: "2019-02-31" });
  assert.deepEqual(normalizeBirthDate("2019-99-99"), { birthDate: "", isValid: false, raw: "2019-99-99" });
  assert.deepEqual(normalizeBirthDate("bukan-tanggal"), { birthDate: "", isValid: false, raw: "bukan-tanggal" });
});

test("parseStudentWorkbook strictly requires sheet SISWA", () => {
  const XLSX = getXLSX();
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([["nama_siswa"], ["Budi"]]);
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1"); // Not named SISWA

  assert.throws(() => {
    parseStudentWorkbook(wb);
  }, /Sheet SISWA tidak ditemukan/);
});

test("parseStudentWorkbook strictly requires header nama_siswa", () => {
  const XLSX = getXLSX();
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([["catatan", "nis"], ["Catatan", "1001"]]);
  XLSX.utils.book_append_sheet(wb, ws, "SISWA");

  assert.throws(() => {
    parseStudentWorkbook(wb);
  }, /Kolom nama_siswa tidak ditemukan/);
});

test("parseStudentWorkbook handles valid rows, optional blank fields, and name-only row", () => {
  const XLSX = getXLSX();
  const wb = XLSX.utils.book_new();
  const headers = ["nama_siswa", "nis", "jenis_kelamin", "tanggal_lahir"];
  const rows = [
    ["Ahmad Fauzan", "00101", "L", "2019-03-12"],
    ["Siti Aisyah", "", "P", ""],
    ["Muhammad Fikri", "", "", ""] // Name only
  ];
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  XLSX.utils.book_append_sheet(wb, ws, "SISWA");

  const result = parseStudentWorkbook(wb, { existingStudents: [], targetClassId: "class-1" });

  assert.equal(result.summary.total, 3);
  assert.equal(result.summary.valid, 3);
  assert.equal(result.summary.warning, 0);
  assert.equal(result.summary.duplicate, 0);
  assert.equal(result.summary.invalid, 0);
  assert.equal(result.summary.importable, 3);

  assert.deepEqual(result.rows[0].student, {
    name: "Ahmad Fauzan",
    studentNumber: "00101",
    gender: "male",
    birthDate: "2019-03-12"
  });
  assert.equal(result.rows[0].status, "valid");

  assert.deepEqual(result.rows[1].student, {
    name: "Siti Aisyah",
    studentNumber: "",
    gender: "female",
    birthDate: ""
  });
  assert.equal(result.rows[1].status, "valid");

  assert.deepEqual(result.rows[2].student, {
    name: "Muhammad Fikri",
    studentNumber: "",
    gender: "",
    birthDate: ""
  });
  assert.equal(result.rows[2].status, "valid");
});

test("parseStudentWorkbook flags invalid row when name is empty without blocking other valid rows", () => {
  const XLSX = getXLSX();
  const wb = XLSX.utils.book_new();
  const headers = ["nama_siswa", "nis", "jenis_kelamin", "tanggal_lahir"];
  const rows = [
    ["Ahmad Fauzan", "00101", "L", "2019-03-12"],
    ["", "00102", "P", "2019-04-10"], // Missing name
    ["Rian Pratama", "00103", "L", ""]
  ];
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  XLSX.utils.book_append_sheet(wb, ws, "SISWA");

  const result = parseStudentWorkbook(wb, { existingStudents: [], targetClassId: "class-1" });

  assert.equal(result.summary.total, 3);
  assert.equal(result.summary.valid, 2);
  assert.equal(result.summary.invalid, 1);
  assert.equal(result.summary.importable, 2);

  assert.equal(result.rows[1].status, "invalid");
  assert.ok(result.rows[1].messages[0].includes("Nama siswa wajib diisi"));
});

test("parseStudentWorkbook produces warning for unknown gender and invalid real date", () => {
  const XLSX = getXLSX();
  const wb = XLSX.utils.book_new();
  const headers = ["nama_siswa", "nis", "jenis_kelamin", "tanggal_lahir"];
  const rows = [
    ["Bayu", "00104", "XYZ", "2019-02-31"] // Unknown gender & invalid date (Feb 31)
  ];
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  XLSX.utils.book_append_sheet(wb, ws, "SISWA");

  const result = parseStudentWorkbook(wb, { existingStudents: [], targetClassId: "class-1" });

  assert.equal(result.summary.total, 1);
  assert.equal(result.summary.valid, 0);
  assert.equal(result.summary.warning, 1);
  assert.equal(result.summary.importable, 1);

  const r = result.rows[0];
  assert.equal(r.status, "warning");
  assert.equal(r.student.gender, "");
  assert.equal(r.student.birthDate, "");
  assert.ok(r.messages.some((m) => m.includes('Jenis kelamin "XYZ" tidak dikenali')));
  assert.ok(r.messages.some((m) => m.includes("Tanggal lahir tidak dikenali")));
});

test("parseStudentWorkbook detects duplicate NIS in target class", () => {
  const XLSX = getXLSX();
  const wb = XLSX.utils.book_new();
  const headers = ["nama_siswa", "nis", "jenis_kelamin", "tanggal_lahir"];
  const rows = [["Ahmad Fauzan", "00101", "L", "2019-03-12"]];
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  XLSX.utils.book_append_sheet(wb, ws, "SISWA");

  const existing = [
    createStudent({ id: "st-1", name: "Ahmad Lama", studentNumber: "00101", classId: "class-1" })
  ];

  const result = parseStudentWorkbook(wb, { existingStudents: existing, targetClassId: "class-1" });

  assert.equal(result.summary.duplicate, 1);
  assert.equal(result.summary.importable, 0);
  assert.equal(result.rows[0].status, "duplicate");
  assert.ok(result.rows[0].messages[0].includes("sudah terdaftar di kelas ini"));
});

test("parseStudentWorkbook detects duplicate NIS in another class", () => {
  const XLSX = getXLSX();
  const wb = XLSX.utils.book_new();
  const headers = ["nama_siswa", "nis", "jenis_kelamin", "tanggal_lahir"];
  const rows = [["Ahmad Fauzan", "00101", "L", "2019-03-12"]];
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  XLSX.utils.book_append_sheet(wb, ws, "SISWA");

  const existing = [
    createStudent({ id: "st-1", name: "Ahmad di Kelas 2", studentNumber: "00101", classId: "class-2" })
  ];

  const result = parseStudentWorkbook(wb, { existingStudents: existing, targetClassId: "class-1" });

  assert.equal(result.summary.duplicate, 1);
  assert.equal(result.summary.importable, 0);
  assert.equal(result.rows[0].status, "duplicate");
  assert.ok(result.rows[0].messages[0].includes("sudah terdaftar di kelas lain"));
});

test("parseStudentWorkbook detects same-file duplicate NIS", () => {
  const XLSX = getXLSX();
  const wb = XLSX.utils.book_new();
  const headers = ["nama_siswa", "nis", "jenis_kelamin", "tanggal_lahir"];
  const rows = [
    ["Ahmad Satu", "00101", "L", "2019-03-12"],
    ["Ahmad Dua", "00101", "L", "2019-05-14"] // Same NIS in same file
  ];
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  XLSX.utils.book_append_sheet(wb, ws, "SISWA");

  const result = parseStudentWorkbook(wb, { existingStudents: [], targetClassId: "class-1" });

  assert.equal(result.summary.valid, 1);
  assert.equal(result.summary.duplicate, 1);
  assert.equal(result.summary.importable, 1);

  assert.equal(result.rows[0].status, "valid");
  assert.equal(result.rows[1].status, "duplicate");
  assert.ok(result.rows[1].messages[0].includes("muncul lebih dari satu kali"));
});

test("parseStudentWorkbook produces warning for same name without NIS in target class but remains importable", () => {
  const XLSX = getXLSX();
  const wb = XLSX.utils.book_new();
  const headers = ["nama_siswa", "nis", "jenis_kelamin", "tanggal_lahir"];
  const rows = [["Muhammad Rizky", "", "L", "2019-03-12"]];
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  XLSX.utils.book_append_sheet(wb, ws, "SISWA");

  const existing = [
    createStudent({ id: "st-1", name: "Muhammad Rizky", studentNumber: "", classId: "class-1" })
  ];

  const result = parseStudentWorkbook(wb, { existingStudents: existing, targetClassId: "class-1" });

  assert.equal(result.summary.warning, 1);
  assert.equal(result.summary.importable, 1);
  assert.equal(result.rows[0].status, "warning");
  assert.ok(result.rows[0].messages[0].includes("Ada siswa dengan nama yang sama"));
});

test("generateStudentTemplateWorkbook creates exact V1 template format", () => {
  const wb = generateStudentTemplateWorkbook();
  assert.deepEqual(wb.SheetNames, ["SISWA"]);

  const XLSX = getXLSX();
  const sheet = wb.Sheets["SISWA"];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  assert.deepEqual(data[0], ["nama_siswa", "nis", "jenis_kelamin", "tanggal_lahir"]);
  assert.equal(data.length, 4); // header + 3 sample rows
});
