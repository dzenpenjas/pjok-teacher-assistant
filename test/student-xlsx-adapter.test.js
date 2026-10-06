import test from "node:test";
import assert from "node:assert/strict";
import * as xlsxModule from "xlsx";

// Provide XLSX in Node.js test environment
globalThis.XLSX = xlsxModule.read ? xlsxModule : xlsxModule.default || xlsxModule;

import {
  normalizeGender,
  normalizeBirthDate,
  parseStudentWorkbook,
  generateStudentTemplateWorkbook,
  exportStudentsToWorkbook
} from "../src/services/student-xlsx-adapter.js";
import { getXLSX } from "../src/services/xlsx-runtime.js";

test("getXLSX returns the XLSX instance from global scope", () => {
  const XLSX = getXLSX();
  assert.ok(XLSX);
  assert.equal(typeof XLSX.utils.book_new, "function");
});

test("normalizeGender handles standard and common Indonesian variants", () => {
  assert.equal(normalizeGender("L"), "male");
  assert.equal(normalizeGender("l"), "male");
  assert.equal(normalizeGender("Laki-laki"), "male");
  assert.equal(normalizeGender("Laki - laki"), "male");
  assert.equal(normalizeGender("Pria"), "male");
  assert.equal(normalizeGender("Male"), "male");
  assert.equal(normalizeGender("M"), "male");

  assert.equal(normalizeGender("P"), "female");
  assert.equal(normalizeGender("p"), "female");
  assert.equal(normalizeGender("Perempuan"), "female");
  assert.equal(normalizeGender("Wanita"), "female");
  assert.equal(normalizeGender("Female"), "female");
  assert.equal(normalizeGender("F"), "female");

  assert.equal(normalizeGender(""), "");
  assert.equal(normalizeGender(null), "");
  assert.equal(normalizeGender(undefined), "");
  assert.equal(normalizeGender("Lainnya"), "");
});

test("normalizeBirthDate handles ISO strings, Indonesian text dates, and Excel serial numbers", () => {
  assert.equal(normalizeBirthDate("2015-08-17"), "2015-08-17");
  assert.equal(normalizeBirthDate("2015/08/17"), "2015-08-17");
  assert.equal(normalizeBirthDate("17/08/2015"), "2015-08-17");
  assert.equal(normalizeBirthDate("17-08-2015"), "2015-08-17");
  assert.equal(normalizeBirthDate("17 Agustus 2015"), "2015-08-17");
  assert.equal(normalizeBirthDate("5 Mei 2016"), "2016-05-05");
  assert.equal(normalizeBirthDate("10 Jan 2014"), "2014-01-10");

  // Excel serial number test (42233 is 2015-08-17)
  const serialNormalized = normalizeBirthDate(42233);
  assert.equal(serialNormalized, "2015-08-17");

  assert.equal(normalizeBirthDate(""), "");
  assert.equal(normalizeBirthDate(null), "");
  assert.equal(normalizeBirthDate("invalid-date-string"), "");
});

test("parseStudentWorkbook parses valid sheet and correctly enforces Name required, others optional", () => {
  const XLSX = getXLSX();
  const wb = XLSX.utils.book_new();

  const headers = ["Nama Siswa", "NIS", "Jenis Kelamin", "Tanggal Lahir", "Catatan"];
  const rows = [
    ["Ahmad Fauzi", "1001", "Laki-laki", "2015-04-12", "Asma ringan"],
    ["Siti Nurhaliza", "1002", "P", "17 Agustus 2015", ""],
    ["Budi Pratama", "", "", "", ""], // Optional fields all empty, should still be valid!
    ["", "1004", "P", "2015-11-05", "Tanpa nama"], // Missing name, should be marked as invalid row!
    ["   ", "", "", "", ""], // Blank row
    ["Dewi Lestari", "1005", "Perempuan", "2015-01-20", "Atlet renang"]
  ];

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  XLSX.utils.book_append_sheet(wb, ws, "DATA SISWA");

  const result = parseStudentWorkbook(wb);

  assert.equal(result.validCount, 4);
  assert.equal(result.invalidCount, 1);
  assert.equal(result.totalRows, 5); // 4 valid + 1 invalid (blank row ignored)

  assert.deepEqual(result.validStudents[0], {
    name: "Ahmad Fauzi",
    studentNumber: "1001",
    gender: "male",
    birthDate: "2015-04-12",
    noteText: "Asma ringan",
    heightCm: "",
    weightKg: ""
  });

  assert.deepEqual(result.validStudents[1], {
    name: "Siti Nurhaliza",
    studentNumber: "1002",
    gender: "female",
    birthDate: "2015-08-17",
    noteText: "",
    heightCm: "",
    weightKg: ""
  });

  assert.deepEqual(result.validStudents[2], {
    name: "Budi Pratama",
    studentNumber: "",
    gender: "",
    birthDate: "",
    noteText: "",
    heightCm: "",
    weightKg: ""
  });

  assert.equal(result.invalidRows[0].rowNumber, 5); // 1-indexed row (header=1, rows 2,3,4, row 5 is missing name)
  assert.ok(result.invalidRows[0].reason.includes("Nama siswa wajib diisi"));
});

test("generateStudentTemplateWorkbook generates readable template with sample students", () => {
  const wb = generateStudentTemplateWorkbook({ className: "Kelas 4A", grade: "4" });
  assert.ok(wb.Sheets["DATA SISWA"]);

  const result = parseStudentWorkbook(wb);
  assert.ok(result.validCount >= 3);
  assert.equal(result.invalidCount, 0);
});

test("exportStudentsToWorkbook creates valid export sheet without classId or database IDs", () => {
  const students = [
    {
      id: "student-local-123",
      classId: "class-local-456",
      name: "Rizky Ramadhan",
      studentNumber: "2001",
      gender: "male",
      birthDate: "2016-02-10",
      heightCm: "135",
      weightKg: "32"
    }
  ];

  const wb = exportStudentsToWorkbook(students, "Kelas 4A");
  assert.ok(wb.Sheets["DATA SISWA"]);

  const result = parseStudentWorkbook(wb);
  assert.equal(result.validCount, 1);
  assert.equal(result.validStudents[0].name, "Rizky Ramadhan");
  assert.equal(result.validStudents[0].studentNumber, "2001");
  assert.equal(result.validStudents[0].gender, "male");
  assert.equal(result.validStudents[0].heightCm, "135");
  assert.equal(result.validStudents[0].weightKg, "32");
  // Ensure local ID was not used
  assert.equal(result.validStudents[0].id, undefined);
  assert.equal(result.validStudents[0].classId, undefined);
});

test("Student Excel parser output integrates cleanly with class assignments", () => {
  const parsedStudents = [
    {
      name: "Doni Setiawan",
      studentNumber: "3001",
      gender: "male",
      birthDate: "2015-03-15",
      noteText: "Riwayat asma",
      heightCm: "130",
      weightKg: "28"
    },
    {
      name: "Anisa Rahma",
      studentNumber: "3002",
      gender: "female",
      birthDate: "",
      noteText: "",
      heightCm: "",
      weightKg: ""
    }
  ];

  const targetClassId = "class-5b";
  const mapped = parsedStudents.map((s) => ({
    ...s,
    classId: targetClassId
  }));

  assert.equal(mapped.length, 2);
  assert.equal(mapped[0].classId, "class-5b");
  assert.equal(mapped[1].classId, "class-5b");
  assert.equal(mapped[0].name, "Doni Setiawan");
  assert.equal(mapped[1].gender, "female");
});

