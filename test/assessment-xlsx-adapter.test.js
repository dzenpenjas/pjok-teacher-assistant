import test from "node:test";
import assert from "node:assert/strict";

import { createAssessmentDefinition, createAssessmentSession } from "../src/data/models.js";
import {
  getXLSX,
  parseMaterialsString,
  formatMaterialsArray,
  parseAssessmentWorkbook,
  canonicalAssessmentPackageToWorkbook,
  generateAssessmentPackageTemplateWorkbook,
  exportAssessmentSessionToExcelFile
} from "../src/services/assessment-xlsx-adapter.js";
import {
  calculateAssessmentFingerprint,
  validateAssessmentPackage
} from "../src/services/assessment-package-service.js";

test("materials string parser and formatter handle pipe, comma, and whitespace correctly", () => {
  assert.deepEqual(parseMaterialsString("Gerak Lokomotor | Gerak Nonlokomotor"), ["Gerak Lokomotor", "Gerak Nonlokomotor"]);
  assert.deepEqual(parseMaterialsString("Senam, Kebugaran, Atletik"), ["Senam", "Kebugaran", "Atletik"]);
  assert.deepEqual(parseMaterialsString("   Sepak Bola   "), ["Sepak Bola"]);
  assert.deepEqual(parseMaterialsString(""), []);
  assert.deepEqual(parseMaterialsString(null), []);

  assert.equal(formatMaterialsArray(["Bola Basket", "Permainan"]), "Bola Basket | Permainan");
  assert.equal(formatMaterialsArray([]), "");
  assert.equal(formatMaterialsArray(null), "");
});

test("canonicalAssessmentPackageToWorkbook converts canonical package to valid 2-sheet workbook (ASESMEN & BUTIR)", () => {
  const canonicalPackage = {
    format: "pjok-assessment-package",
    formatVersion: 1,
    source: {
      name: "Korwil Tangerang"
    },
    assessments: [
      {
        externalCode: "VOLI-01",
        sourceVersion: "1.0",
        name: "Passing Bawah Bola Voli",
        recommendedGrade: 4,
        purpose: "formative",
        assessmentType: "practice",
        category: "keterampilan",
        method: "rubric",
        materials: ["Bola Voli", "Net"],
        instructions: "Lakukan passing bawah 5 kali beruntun.",
        rubricScale: 3,
        items: [
          {
            number: 1,
            prompt: "Perkenaan bola pada lengan",
            rubricScale: 3,
            rubricLevels: [
              { level: 1, label: "Perlu Bimbingan", desc: "Bola tidak memantul stabil" },
              { level: 2, label: "Cukup", desc: "Bola memantul cukup terarah" },
              { level: 3, label: "Baik", desc: "Bola memantul terarah dan stabil" }
            ]
          }
        ]
      }
    ]
  };

  const wb = canonicalAssessmentPackageToWorkbook(canonicalPackage);
  assert.ok(wb.SheetNames.includes("ASESMEN"));
  assert.ok(wb.SheetNames.includes("BUTIR"));

  const XLSX = getXLSX();
  const asesmenRows = XLSX.utils.sheet_to_json(wb.Sheets["ASESMEN"], { header: 1 });
  const butirRows = XLSX.utils.sheet_to_json(wb.Sheets["BUTIR"], { header: 1 });

  assert.equal(asesmenRows[0][0], "kode_asesmen");
  assert.equal(asesmenRows[1][0], "VOLI-01");
  assert.equal(asesmenRows[1][1], "Passing Bawah Bola Voli");
  assert.equal(asesmenRows[1][7], "Bola Voli | Net");
  assert.equal(asesmenRows[1][8], 3);

  assert.equal(butirRows[0][0], "kode_asesmen");
  assert.equal(butirRows[1][0], "VOLI-01");
  assert.equal(butirRows[1][1], 1);
  assert.equal(butirRows[1][2], "Perkenaan bola pada lengan");
  assert.equal(butirRows[1][3], "Perlu Bimbingan");
  assert.equal(butirRows[1][4], "Bola tidak memantul stabil");
});

test("parseAssessmentWorkbook correctly parses scale 3, scale 4, and scale 5 workbooks into canonical packages", () => {
  const XLSX = getXLSX();

  const multiScalePackage = {
    format: "pjok-assessment-package",
    formatVersion: 1,
    source: {
      name: "Dinas Pendidikan"
    },
    assessments: [
      // Scale 3
      {
        externalCode: "SCALE-3-TEST",
        sourceVersion: "1.0",
        name: "Asesmen Skala 3",
        recommendedGrade: 2,
        purpose: "formative",
        assessmentType: "practice",
        category: "keterampilan",
        method: "rubric",
        materials: ["Matras"],
        instructions: "Instruksi skala 3",
        rubricScale: 3,
        items: [
          {
            number: 1,
            prompt: "Gerak 1",
            rubricScale: 3,
            rubricLevels: [
              { level: 1, label: "L1", desc: "D1" },
              { level: 2, label: "L2", desc: "D2" },
              { level: 3, label: "L3", desc: "D3" }
            ]
          }
        ]
      },
      // Scale 4
      {
        externalCode: "SCALE-4-TEST",
        sourceVersion: "1.2",
        name: "Asesmen Skala 4",
        recommendedGrade: 5,
        purpose: "midterm",
        assessmentType: "written",
        category: "pengetahuan",
        method: "rubric",
        materials: ["Kertas Ujian"],
        instructions: "Instruksi skala 4",
        rubricScale: 4,
        items: [
          {
            number: 1,
            prompt: "Soal 1",
            rubricScale: 4,
            rubricLevels: [
              { level: 1, label: "L1", desc: "D1" },
              { level: 2, label: "L2", desc: "D2" },
              { level: 3, label: "L3", desc: "D3" },
              { level: 4, label: "L4", desc: "D4" }
            ]
          }
        ]
      },
      // Scale 5
      {
        externalCode: "SCALE-5-TEST",
        sourceVersion: "2.0",
        name: "Asesmen Skala 5",
        recommendedGrade: 6,
        purpose: "final",
        assessmentType: "oral",
        category: "sikap",
        method: "rubric",
        materials: ["Lapangan"],
        instructions: "Instruksi skala 5",
        rubricScale: 5,
        items: [
          {
            number: 1,
            prompt: "Sikap 1",
            rubricScale: 5,
            rubricLevels: [
              { level: 1, label: "L1", desc: "D1" },
              { level: 2, label: "L2", desc: "D2" },
              { level: 3, label: "L3", desc: "D3" },
              { level: 4, label: "L4", desc: "D4" },
              { level: 5, label: "L5", desc: "D5" }
            ]
          }
        ]
      }
    ]
  };

  const wb = canonicalAssessmentPackageToWorkbook(multiScalePackage);
  const parseResult = parseAssessmentWorkbook(wb);

  assert.equal(parseResult.success, true);
  assert.equal(parseResult.package.assessments.length, 3);

  const a3 = parseResult.package.assessments.find((a) => a.externalCode === "SCALE-3-TEST");
  assert.equal(a3.rubricScale, 3);
  assert.equal(a3.items[0].rubricLevels.length, 3);

  const a4 = parseResult.package.assessments.find((a) => a.externalCode === "SCALE-4-TEST");
  assert.equal(a4.rubricScale, 4);
  assert.equal(a4.items[0].rubricLevels.length, 4);

  const a5 = parseResult.package.assessments.find((a) => a.externalCode === "SCALE-5-TEST");
  assert.equal(a5.rubricScale, 5);
  assert.equal(a5.items[0].rubricLevels.length, 5);

  // Validate resulting package through standard canonical validator
  const validation = validateAssessmentPackage(parseResult.package);
  assert.equal(validation.valid, true);
});

test("Excel Round-Trip: Export canonical -> Import same Excel preserves substantive content equivalence", () => {
  const originalAssessment = {
    externalCode: "BASKET-DRIBBLE-SD",
    sourceVersion: "2026.1",
    name: "Dribble Bola Basket Rendah",
    recommendedGrade: 4,
    purpose: "formative",
    assessmentType: "practice",
    category: "keterampilan",
    method: "rubric",
    materials: ["Bola Basket", "Cone"],
    instructions: "Lakukan dribble zig-zag melewati 5 cone.",
    rubricScale: 4,
    unit: "",
    direction: "higher_better",
    items: [
      {
        number: 1,
        prompt: "Kontrol tinggi pantulan bola",
        rubricScale: 4,
        rubricLevels: [
          { level: 1, label: "L1", desc: "Bola memantul melebihi pinggang" },
          { level: 2, label: "L2", desc: "Bola kadang terkontrol setinggi pinggang" },
          { level: 3, label: "L3", desc: "Bola stabil setinggi pinggang ke bawah" },
          { level: 4, label: "L4", desc: "Kontrol sempurna setinggi lutut sambil bergerak" }
        ]
      },
      {
        number: 2,
        prompt: "Penglihatan saat dribble",
        rubricScale: 4,
        rubricLevels: [
          { level: 1, label: "L1", desc: "Selalu melihat ke bola" },
          { level: 2, label: "L2", desc: "Sesekali melihat ke depan" },
          { level: 3, label: "L3", desc: "Sebagian besar melihat ke depan" },
          { level: 4, label: "L4", desc: "Pandangan luas ke depan tanpa melihat bola" }
        ]
      }
    ]
  };

  const canonicalPackage = {
    format: "pjok-assessment-package",
    formatVersion: 1,
    source: { name: "Bank Soal Kurikulum" },
    assessments: [originalAssessment]
  };

  // 1. Export canonical package to workbook
  const wb = canonicalAssessmentPackageToWorkbook(canonicalPackage);

  // 2. Parse workbook back to canonical package
  const parseResult = parseAssessmentWorkbook(wb);
  assert.equal(parseResult.success, true);

  const importedAssessment = parseResult.package.assessments[0];

  // 3. Compute fingerprints and assert deterministic equivalence
  const originalFp = calculateAssessmentFingerprint(originalAssessment);
  const importedFp = calculateAssessmentFingerprint(importedAssessment);
  assert.equal(originalFp, importedFp);

  assert.equal(importedAssessment.name, originalAssessment.name);
  assert.equal(importedAssessment.externalCode, originalAssessment.externalCode);
  assert.equal(importedAssessment.sourceVersion, originalAssessment.sourceVersion);
  assert.equal(importedAssessment.recommendedGrade, originalAssessment.recommendedGrade);
  assert.deepEqual(importedAssessment.materials, originalAssessment.materials);
  assert.equal(importedAssessment.items.length, 2);
  assert.deepEqual(importedAssessment.items[0].rubricLevels, originalAssessment.items[0].rubricLevels);
});

test("parseAssessmentWorkbook returns helpful teacher-readable errors for malformed workbooks", () => {
  const XLSX = getXLSX();

  // 1. Missing Sheet ASESMEN
  const wbMissingAsesmen = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wbMissingAsesmen, XLSX.utils.aoa_to_sheet([["kode_asesmen"]]), "BUTIR");
  const res1 = parseAssessmentWorkbook(wbMissingAsesmen);
  assert.equal(res1.success, false);
  assert.ok(res1.errors.some((e) => e.message.includes("Sheet ASESMEN tidak ditemukan.")));

  // 2. Missing Sheet BUTIR
  const wbMissingButir = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wbMissingButir, XLSX.utils.aoa_to_sheet([["kode_asesmen"]]), "ASESMEN");
  const res2 = parseAssessmentWorkbook(wbMissingButir);
  assert.equal(res2.success, false);
  assert.ok(res2.errors.some((e) => e.message.includes("Sheet BUTIR tidak ditemukan.")));

  // 3. Missing required headers in ASESMEN
  const wbBadHeader = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wbBadHeader, XLSX.utils.aoa_to_sheet([["nama_asesmen", "versi"]]), "ASESMEN");
  XLSX.utils.book_append_sheet(wbBadHeader, XLSX.utils.aoa_to_sheet([["kode_asesmen", "pertanyaan_instrumen", "rubrik_1", "rubrik_2", "rubrik_3"]]), "BUTIR");
  const res3 = parseAssessmentWorkbook(wbBadHeader);
  assert.equal(res3.success, false);
  assert.ok(res3.errors.some((e) => e.message.includes("Kolom wajib")));

  // 4. Unknown kode_asesmen in BUTIR row
  const wbUnknownCode = XLSX.utils.book_new();
  const asesmenRows = [
    ["kode_asesmen", "nama_asesmen", "versi", "kelas_rekomendasi", "jenis_asesmen", "bentuk_asesmen", "kategori", "materi", "skala_rubrik", "instruksi", "sumber"],
    ["CODE-A", "Asesmen A", "1.0", 3, "formative", "practice", "keterampilan", "Senam", 3, "", ""]
  ];
  const butirRows = [
    ["kode_asesmen", "no", "pertanyaan_instrumen", "label_1", "rubrik_1", "label_2", "rubrik_2", "label_3", "rubrik_3"],
    ["UNKNOWN-CODE-Z", 1, "Tugas 1", "L1", "Desc 1", "L2", "Desc 2", "L3", "Desc 3"]
  ];
  XLSX.utils.book_append_sheet(wbUnknownCode, XLSX.utils.aoa_to_sheet(asesmenRows), "ASESMEN");
  XLSX.utils.book_append_sheet(wbUnknownCode, XLSX.utils.aoa_to_sheet(butirRows), "BUTIR");

  const res4 = parseAssessmentWorkbook(wbUnknownCode);
  assert.equal(res4.success, false);
  assert.ok(res4.errors.some((e) => e.message.includes('kode_asesmen "UNKNOWN-CODE-Z" tidak ditemukan pada sheet ASESMEN')));

  // 5. Incomplete rubric description for scale 5
  const wbIncompleteRubric = XLSX.utils.book_new();
  const asesmenRows5 = [
    ["kode_asesmen", "nama_asesmen", "versi", "kelas_rekomendasi", "jenis_asesmen", "bentuk_asesmen", "kategori", "materi", "skala_rubrik", "instruksi", "sumber"],
    ["CODE-5", "Asesmen 5", "1.0", 5, "formative", "practice", "keterampilan", "Senam", 5, "", ""]
  ];
  const butirRowsIncomplete = [
    ["kode_asesmen", "no", "pertanyaan_instrumen", "label_1", "rubrik_1", "label_2", "rubrik_2", "label_3", "rubrik_3", "label_4", "rubrik_4", "label_5", "rubrik_5"],
    ["CODE-5", 1, "Tugas 1", "L1", "Desc 1", "L2", "Desc 2", "L3", "Desc 3", "L4", "", "L5", "Desc 5"]
  ];
  XLSX.utils.book_append_sheet(wbIncompleteRubric, XLSX.utils.aoa_to_sheet(asesmenRows5), "ASESMEN");
  XLSX.utils.book_append_sheet(wbIncompleteRubric, XLSX.utils.aoa_to_sheet(butirRowsIncomplete), "BUTIR");

  const res5 = parseAssessmentWorkbook(wbIncompleteRubric);
  assert.equal(res5.success, false);
  assert.ok(res5.errors.some((e) => e.message.includes("Rubrik level 4 belum diisi untuk asesmen skala 5")));
});

test("generateAssessmentPackageTemplateWorkbook creates valid template with complete sample data", () => {
  const wb = generateAssessmentPackageTemplateWorkbook();
  assert.ok(wb.SheetNames.includes("ASESMEN"));
  assert.ok(wb.SheetNames.includes("BUTIR"));

  const parseResult = parseAssessmentWorkbook(wb);
  assert.equal(parseResult.success, true);
  assert.equal(parseResult.package.assessments.length, 1);

  const sample = parseResult.package.assessments[0];
  assert.equal(sample.externalCode, "CONTOH-UTS-G1-LISAN");
  assert.equal(sample.name, "UTS PJOK Kelas 1 - Lisan");
  assert.equal(sample.rubricScale, 5);
  assert.equal(sample.items.length, 1);
  assert.equal(sample.items[0].rubricLevels.length, 5);

  const validation = validateAssessmentPackage(parseResult.package);
  assert.equal(validation.valid, true);
});

test("exportAssessmentSessionToExcelFile does not leak student data or database IDs", () => {
  const session = createAssessmentSession({
    id: "sess-local-id-12345",
    classId: "class-local-id-67890",
    definitionId: "def-local-id-54321",
    title: "Praktik Renang Gaya Bebas",
    purpose: "formative",
    materials: ["Kolam Renang 25m"],
    instructions: "Lakukan renang 25 meter gaya bebas.",
    itemsSnapshot: [
      {
        id: "item-snap-111",
        number: 1,
        prompt: "Gerakan meluncur",
        rubricScale: 3,
        rubricLevels: [
          { level: 1, label: "L1", desc: "Meluncur belum lurus" },
          { level: 2, label: "L2", desc: "Meluncur cukup lurus" },
          { level: 3, label: "L3", desc: "Meluncur lurus dan streamline" }
        ]
      }
    ]
  });

  const definition = createAssessmentDefinition({
    id: "def-local-id-54321",
    name: "Praktik Renang Gaya Bebas",
    assessmentType: "practice",
    method: "rubric",
    rubricScale: 3,
    sourceMeta: {
      externalCode: "RENANG-BEBAS-01",
      sourceVersion: "1.0"
    }
  });

  const exportResult = exportAssessmentSessionToExcelFile(session, definition, {
    sourceName: "SD Negeri 01"
  });

  assert.equal(exportResult.filename, "Praktik_Renang_Gaya_Bebas.xlsx");
  assert.ok(exportResult.workbook.SheetNames.includes("ASESMEN"));
  assert.ok(exportResult.workbook.SheetNames.includes("BUTIR"));

  const XLSX = getXLSX();
  const rawAsesmen = JSON.stringify(XLSX.utils.sheet_to_json(exportResult.workbook.Sheets["ASESMEN"]));
  const rawButir = JSON.stringify(XLSX.utils.sheet_to_json(exportResult.workbook.Sheets["BUTIR"]));

  // Ensure no local database IDs leaked into Excel sheets
  assert.equal(rawAsesmen.includes("sess-local-id-12345"), false);
  assert.equal(rawAsesmen.includes("class-local-id-67890"), false);
  assert.equal(rawAsesmen.includes("def-local-id-54321"), false);
  assert.equal(rawButir.includes("sess-local-id-12345"), false);
  assert.equal(rawButir.includes("class-local-id-67890"), false);
  assert.equal(rawButir.includes("def-local-id-54321"), false);
});
