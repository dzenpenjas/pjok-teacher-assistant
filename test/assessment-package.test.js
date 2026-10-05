import test from "node:test";
import assert from "node:assert/strict";

import { createAssessmentDefinition, createAssessmentSession } from "../src/data/models.js";
import {
  ASSESSMENT_PACKAGE_FORMAT,
  ASSESSMENT_PACKAGE_FORMAT_VERSION,
  SUPPORTED_PURPOSES,
  SUPPORTED_ASSESSMENT_TYPES,
  DEDUPE_STATUS,
  IMPORT_ACTION,
  calculateAssessmentFingerprint,
  buildCanonicalAssessmentFromSession,
  createCanonicalAssessmentPackage,
  validateAssessmentPackage,
  classifyAssessment,
  planAssessmentPackageImport,
  generateSafeExportFilename,
  exportAssessmentSessionToJsonFile,
  createDefinitionFromCanonicalAssessment,
  createSessionSnapshotForClass,
  executeAssessmentPackageImport
} from "../src/services/assessment-package-service.js";

test("AssessmentDefinition supports optional sourceMeta without breaking existing definitions", () => {
  // 1. Definition without sourceMeta
  const def1 = createAssessmentDefinition({
    name: "Asesmen Kebugaran Jasmani",
    materials: ["Kebugaran Jasmani"]
  });
  assert.equal(def1.name, "Asesmen Kebugaran Jasmani");
  assert.equal(def1.sourceMeta, undefined);

  // 2. Definition with sourceMeta
  const def2 = createAssessmentDefinition({
    name: "Asesmen Senam Lantai",
    materials: ["Senam"],
    sourceMeta: {
      externalCode: "PJOK-SD-001",
      sourceName: "Bank Soal Kemdikbud",
      sourceVersion: "1.2",
      fingerprint: "fp_12345678abcdef01",
      importedAt: "2026-10-05T09:00:00.000Z"
    }
  });
  assert.equal(def2.name, "Asesmen Senam Lantai");
  assert.deepEqual(def2.sourceMeta, {
    externalCode: "PJOK-SD-001",
    sourceName: "Bank Soal Kemdikbud",
    sourceVersion: "1.2",
    fingerprint: "fp_12345678abcdef01",
    importedAt: "2026-10-05T09:00:00.000Z"
  });
});

test("Export mapping builds canonical assessment using AssessmentSession.itemsSnapshot as authority", () => {
  const session = createAssessmentSession({
    id: "sess-100",
    title: "Praktik Lari Cepat Sprint",
    purpose: "formative",
    materials: ["Sprint 50m"],
    instructions: "Lari secepat mungkin dari garis start.",
    itemsSnapshot: [
      {
        id: "item-snap-1",
        prompt: "Posisi start jongkok",
        rubricScale: 3,
        rubricLevels: [
          { level: 1, label: "Perlu Bimbingan", desc: "Start belum tepat" },
          { level: 2, label: "Cukup", desc: "Start cukup baik" },
          { level: 3, label: "Baik", desc: "Start sangat tepat" }
        ]
      }
    ]
  });

  const definition = createAssessmentDefinition({
    id: "def-50",
    name: "Definisi Lari",
    category: "keterampilan",
    assessmentType: "practice",
    sourceMeta: {
      externalCode: "SPRINT-50M",
      sourceVersion: "2.0"
    },
    items: [
      {
        id: "item-old-1",
        prompt: "Item lama di definisi",
        rubricScale: 5,
        rubricLevels: []
      }
    ]
  });

  const canonical = buildCanonicalAssessmentFromSession(session, definition, {
    gradeLevel: 4
  });

  assert.equal(canonical.externalCode, "SPRINT-50M");
  assert.equal(canonical.sourceVersion, "2.0");
  assert.equal(canonical.name, "Praktik Lari Cepat Sprint");
  assert.equal(canonical.recommendedGrade, 4);
  assert.equal(canonical.purpose, "formative");
  assert.equal(canonical.assessmentType, "practice");
  assert.equal(canonical.category, "keterampilan");
  assert.deepEqual(canonical.materials, ["Sprint 50m"]);
  assert.equal(canonical.items.length, 1);
  assert.equal(canonical.items[0].prompt, "Posisi start jongkok");
  assert.equal(canonical.items[0].rubricScale, 3);
  assert.equal(canonical.items[0].rubricLevels.length, 3);
  assert.equal(canonical.items[0].rubricLevels[0].desc, "Start belum tepat");

  // Verify source objects are not mutated
  assert.equal(session.title, "Praktik Lari Cepat Sprint");
  assert.equal(definition.name, "Definisi Lari");
});

test("calculateAssessmentFingerprint is deterministic and invariant to local IDs and timestamps", () => {
  const assess1 = {
    id: "local-id-1",
    name: "Operan Bola Basket (Chest Pass)",
    purpose: "formative",
    assessmentType: "practice",
    method: "rubric",
    materials: ["Bola Basket", "Permainan Bola Besar"],
    instructions: "Lakukan lemparan setinggi dada ke teman.",
    rubricScale: 4,
    items: [
      {
        id: "item-local-1",
        number: 1,
        prompt: "Sikap awalan dan pegangan bola",
        rubricScale: 4,
        rubricLevels: [
          { level: 1, label: "L1", desc: "Belum mampu memegang bola dengan benar" },
          { level: 2, label: "L2", desc: "Pegangan bola cukup benar tetapi kaku" },
          { level: 3, label: "L3", desc: "Pegangan bola baik dan siap mendorong" },
          { level: 4, label: "L4", desc: "Pegangan bola sangat baik dan rileks" }
        ]
      }
    ]
  };

  const assess2 = {
    id: "different-local-id-999",
    createdAt: "2026-10-05T00:00:00.000Z",
    updatedAt: "2026-10-05T01:00:00.000Z",
    name: "  Operan Bola Basket (Chest Pass)  ",
    purpose: "formative",
    assessmentType: "practice",
    method: "rubric",
    materials: ["Bola Basket", "Permainan Bola Besar"],
    instructions: "Lakukan lemparan setinggi dada ke teman. ",
    rubricScale: 4,
    items: [
      {
        id: "different-item-id-888",
        number: 1,
        prompt: "Sikap awalan dan pegangan bola",
        rubricScale: 4,
        rubricLevels: [
          // Even if array order was different, it gets sorted by level
          { level: 4, label: "L4", desc: "Pegangan bola sangat baik dan rileks" },
          { level: 2, label: "L2", desc: "Pegangan bola cukup benar tetapi kaku" },
          { level: 1, label: "L1", desc: "Belum mampu memegang bola dengan benar" },
          { level: 3, label: "L3", desc: "Pegangan bola baik dan siap mendorong" }
        ]
      }
    ]
  };

  const fp1 = calculateAssessmentFingerprint(assess1);
  const fp2 = calculateAssessmentFingerprint(assess2);

  assert.equal(fp1, fp2);
  assert.match(fp1, /^fp_[0-9a-f]{16}$/);

  // Different substantive content produces different fingerprint
  const assess3 = {
    ...assess1,
    name: "Operan Pantul (Bounce Pass)"
  };
  const fp3 = calculateAssessmentFingerprint(assess3);
  assert.notEqual(fp1, fp3);
});

test("validateAssessmentPackage validates correct package and returns structured errors for invalid package", () => {
  const validPackage = {
    format: ASSESSMENT_PACKAGE_FORMAT,
    formatVersion: 1,
    source: {
      name: "Kurikulum Merdeka PJOK"
    },
    assessments: [
      {
        externalCode: "PJOK-VOLI-01",
        sourceVersion: "1.0",
        name: "Passing Bawah Bola Voli",
        purpose: "formative",
        assessmentType: "practice",
        method: "rubric",
        materials: ["Bola Voli"],
        instructions: "Lakukan passing bawah berulang 5 kali.",
        rubricScale: 3,
        items: [
          {
            number: 1,
            prompt: "Perkenaan bola pada lengan",
            rubricScale: 3,
            rubricLevels: [
              { level: 1, label: "Level 1", desc: "Perkenaan bola belum pas pada lengan bawah" },
              { level: 2, label: "Level 2", desc: "Perkenaan bola cukup pas pada lengan" },
              { level: 3, label: "Level 3", desc: "Perkenaan bola tepat dan stabil" }
            ]
          }
        ]
      }
    ]
  };

  const validResult = validateAssessmentPackage(validPackage);
  assert.equal(validResult.valid, true);
  assert.equal(validResult.errors.length, 0);

  // Invalid package tests
  const invalidPackage = {
    format: "wrong-format",
    formatVersion: 2,
    assessments: [
      {
        externalCode: "",
        sourceVersion: "",
        name: "",
        purpose: "invalid_purpose",
        assessmentType: "invalid_type",
        method: "stopwatch",
        materials: [],
        rubricScale: 6,
        items: [
          {
            prompt: "",
            rubricScale: 4,
            rubricLevels: [
              { level: 1, label: "L1", desc: "" },
              { level: 1, label: "L1 dup", desc: "desc" },
              { level: 5, label: "L5 out of range", desc: "out of range" }
            ]
          }
        ]
      }
    ]
  };

  const invalidResult = validateAssessmentPackage(invalidPackage);
  assert.equal(invalidResult.valid, false);
  assert.ok(invalidResult.errors.length > 5);

  const errorFields = invalidResult.errors.map((e) => e.field);
  assert.ok(errorFields.includes("format"));
  assert.ok(errorFields.includes("formatVersion"));
  assert.ok(errorFields.includes("name"));
  assert.ok(errorFields.includes("externalCode"));
  assert.ok(errorFields.includes("sourceVersion"));
  assert.ok(errorFields.includes("purpose"));
  assert.ok(errorFields.includes("assessmentType"));
  assert.ok(errorFields.includes("method"));
  assert.ok(errorFields.includes("rubricScale"));
  assert.ok(errorFields.includes("materials"));
  assert.ok(errorFields.includes("prompt"));
  assert.ok(errorFields.includes("rubricLevels"));
});

test("Export fallback externalCode does not contain local DB IDs and is deterministic for identical content", () => {
  const session1 = createAssessmentSession({
    id: "local-session-id-111",
    definitionId: "local-def-id-aaa",
    title: "Senam Lantai Guling Depan",
    purpose: "formative",
    materials: ["Matras Senam"],
    instructions: "Lakukan guling depan dengan benar di atas matras.",
    itemsSnapshot: [
      {
        id: "item-snap-1",
        number: 1,
        prompt: "Posisi mendarat",
        rubricScale: 3,
        rubricLevels: [
          { level: 1, label: "L1", desc: "Jatuh miring" },
          { level: 2, label: "L2", desc: "Mendarat cukup tegak" },
          { level: 3, label: "L3", desc: "Mendarat tegak sempurna" }
        ]
      }
    ]
  });

  const definition1 = createAssessmentDefinition({
    id: "local-def-id-aaa",
    name: "Senam Lantai Guling Depan",
    rubricScale: 3,
    items: []
  });

  const session2 = createAssessmentSession({
    id: "different-local-session-999",
    definitionId: "different-local-def-zzz",
    title: "Senam Lantai Guling Depan",
    purpose: "formative",
    materials: ["Matras Senam"],
    instructions: "Lakukan guling depan dengan benar di atas matras.",
    itemsSnapshot: [
      {
        id: "different-item-snap-2",
        number: 1,
        prompt: "Posisi mendarat",
        rubricScale: 3,
        rubricLevels: [
          { level: 1, label: "L1", desc: "Jatuh miring" },
          { level: 2, label: "L2", desc: "Mendarat cukup tegak" },
          { level: 3, label: "L3", desc: "Mendarat tegak sempurna" }
        ]
      }
    ]
  });

  const definition2 = createAssessmentDefinition({
    id: "different-local-def-zzz",
    name: "Senam Lantai Guling Depan",
    rubricScale: 3,
    items: []
  });

  const canonical1 = buildCanonicalAssessmentFromSession(session1, definition1);
  const canonical2 = buildCanonicalAssessmentFromSession(session2, definition2);

  // Both have no externalCode in options or sourceMeta, so they fallback to LOCAL-<fp>
  assert.ok(canonical1.externalCode.startsWith("LOCAL-fp_"));
  assert.ok(canonical2.externalCode.startsWith("LOCAL-fp_"));

  // Ensure no local database IDs leaked into externalCode
  assert.equal(canonical1.externalCode.includes("local-session-id-111"), false);
  assert.equal(canonical1.externalCode.includes("local-def-id-aaa"), false);
  assert.equal(canonical2.externalCode.includes("different-local-session-999"), false);
  assert.equal(canonical2.externalCode.includes("different-local-def-zzz"), false);

  // Identical substantive content produces the exact same generated externalCode
  assert.equal(canonical1.externalCode, canonical2.externalCode);
});

test("Multi-version dedupe correctly handles existing historical versions (v1 + v2)", () => {
  const v1Def = createAssessmentDefinition({
    id: "def-v1",
    name: "Dribble Bola Tangan",
    purpose: "formative",
    assessmentType: "practice",
    method: "rubric",
    materials: ["Bola Tangan"],
    rubricScale: 3,
    sourceMeta: {
      externalCode: "HANDBALL-DRIBBLE",
      sourceVersion: "1.0"
    },
    items: [
      {
        number: 1,
        prompt: "Dribble dasar v1",
        rubricScale: 3,
        rubricLevels: [
          { level: 1, label: "L1", desc: "V1 desc 1" },
          { level: 2, label: "L2", desc: "V1 desc 2" },
          { level: 3, label: "L3", desc: "V1 desc 3" }
        ]
      }
    ]
  });
  v1Def.sourceMeta.fingerprint = calculateAssessmentFingerprint(v1Def);

  const v2Def = createAssessmentDefinition({
    id: "def-v2",
    name: "Dribble Bola Tangan v2",
    purpose: "formative",
    assessmentType: "practice",
    method: "rubric",
    materials: ["Bola Tangan"],
    rubricScale: 3,
    sourceMeta: {
      externalCode: "HANDBALL-DRIBBLE",
      sourceVersion: "2.0"
    },
    items: [
      {
        number: 1,
        prompt: "Dribble lanjutan v2",
        rubricScale: 3,
        rubricLevels: [
          { level: 1, label: "L1", desc: "V2 desc 1" },
          { level: 2, label: "L2", desc: "V2 desc 2" },
          { level: 3, label: "L3", desc: "V2 desc 3" }
        ]
      }
    ]
  });
  v2Def.sourceMeta.fingerprint = calculateAssessmentFingerprint(v2Def);

  const existingDefinitions = [v1Def, v2Def];

  // Case 1: incoming is identical to existing v2 -> MUST be EXACT_MATCH on v2 (not NEW_VERSION)
  const incomingV2Identical = {
    externalCode: "HANDBALL-DRIBBLE",
    sourceVersion: "2.0",
    name: "Dribble Bola Tangan v2",
    purpose: "formative",
    assessmentType: "practice",
    method: "rubric",
    materials: ["Bola Tangan"],
    rubricScale: 3,
    items: v2Def.items
  };
  const resV2Match = classifyAssessment(incomingV2Identical, existingDefinitions);
  assert.equal(resV2Match.classification, DEDUPE_STATUS.EXACT_MATCH);
  assert.equal(resV2Match.existingDefinition.id, "def-v2");

  // Case 2: incoming is identical to existing v1 -> MUST be EXACT_MATCH on v1
  const incomingV1Identical = {
    externalCode: "HANDBALL-DRIBBLE",
    sourceVersion: "1.0",
    name: "Dribble Bola Tangan",
    purpose: "formative",
    assessmentType: "practice",
    method: "rubric",
    materials: ["Bola Tangan"],
    rubricScale: 3,
    items: v1Def.items
  };
  const resV1Match = classifyAssessment(incomingV1Identical, existingDefinitions);
  assert.equal(resV1Match.classification, DEDUPE_STATUS.EXACT_MATCH);
  assert.equal(resV1Match.existingDefinition.id, "def-v1");

  // Case 3: incoming has unseen version v3 -> MUST be NEW_VERSION
  const incomingV3 = {
    externalCode: "HANDBALL-DRIBBLE",
    sourceVersion: "3.0",
    name: "Dribble Bola Tangan v3",
    purpose: "formative",
    assessmentType: "practice",
    method: "rubric",
    materials: ["Bola Tangan"],
    rubricScale: 3,
    items: [
      {
        number: 1,
        prompt: "Dribble zigzag v3",
        rubricScale: 3,
        rubricLevels: [
          { level: 1, label: "L1", desc: "V3 desc 1" },
          { level: 2, label: "L2", desc: "V3 desc 2" },
          { level: 3, label: "L3", desc: "V3 desc 3" }
        ]
      }
    ]
  };
  const resV3 = classifyAssessment(incomingV3, existingDefinitions);
  assert.equal(resV3.classification, DEDUPE_STATUS.NEW_VERSION);

  // Case 4: incoming is v2 but content is changed -> MUST be CONFLICT
  const incomingV2Conflict = {
    ...incomingV2Identical,
    name: "Dribble Bola Tangan v2 Perubahan Konten"
  };
  const resV2Conflict = classifyAssessment(incomingV2Conflict, existingDefinitions);
  assert.equal(resV2Conflict.classification, DEDUPE_STATUS.CONFLICT);
  assert.equal(resV2Conflict.existingDefinition.id, "def-v2");
});

test("classifyAssessment correctly identifies NEW, EXACT_MATCH, NEW_VERSION, and CONFLICT", () => {
  const existingDef = createAssessmentDefinition({
    id: "def-existing-1",
    name: "Dribble Bola Basket",
    purpose: "formative",
    assessmentType: "practice",
    materials: ["Bola Basket"],
    sourceMeta: {
      externalCode: "BASKET-DRIBBLE",
      sourceVersion: "1.0",
      fingerprint: "" // will be auto-calculated
    },
    items: [
      {
        number: 1,
        prompt: "Kontrol dribble bola rendah",
        rubricScale: 3,
        rubricLevels: [
          { level: 1, label: "L1", desc: "Kontrol bola belum stabil" },
          { level: 2, label: "L2", desc: "Kontrol bola cukup stabil" },
          { level: 3, label: "L3", desc: "Kontrol bola sangat stabil dan lentur" }
        ]
      }
    ]
  });
  existingDef.sourceMeta.fingerprint = calculateAssessmentFingerprint(existingDef);

  const existingDefinitions = [existingDef];

  // 1. NEW assessment (different externalCode)
  const incomingNew = {
    externalCode: "BASKET-SHOOT",
    sourceVersion: "1.0",
    name: "Shooting Basket",
    purpose: "formative",
    assessmentType: "practice",
    materials: ["Bola Basket"],
    items: [
      {
        number: 1,
        prompt: "Teknik shooting",
        rubricScale: 3,
        rubricLevels: [
          { level: 1, label: "L1", desc: "Kurang" },
          { level: 2, label: "L2", desc: "Cukup" },
          { level: 3, label: "L3", desc: "Baik" }
        ]
      }
    ]
  };
  const resNew = classifyAssessment(incomingNew, existingDefinitions);
  assert.equal(resNew.classification, DEDUPE_STATUS.NEW);

  // 2. EXACT_MATCH (same externalCode, same version, same content)
  const incomingExact = {
    externalCode: "BASKET-DRIBBLE",
    sourceVersion: "1.0",
    name: "Dribble Bola Basket",
    purpose: "formative",
    assessmentType: "practice",
    materials: ["Bola Basket"],
    items: [
      {
        number: 1,
        prompt: "Kontrol dribble bola rendah",
        rubricScale: 3,
        rubricLevels: [
          { level: 1, label: "L1", desc: "Kontrol bola belum stabil" },
          { level: 2, label: "L2", desc: "Kontrol bola cukup stabil" },
          { level: 3, label: "L3", desc: "Kontrol bola sangat stabil dan lentur" }
        ]
      }
    ]
  };
  const resExact = classifyAssessment(incomingExact, existingDefinitions);
  assert.equal(resExact.classification, DEDUPE_STATUS.EXACT_MATCH);
  assert.equal(resExact.existingDefinition.id, "def-existing-1");

  // 3. NEW_VERSION (same externalCode, different version)
  const incomingNewVersion = {
    ...incomingExact,
    sourceVersion: "2.0",
    instructions: "Instruksi diperbarui pada revisi 2.0"
  };
  const resNewVersion = classifyAssessment(incomingNewVersion, existingDefinitions);
  assert.equal(resNewVersion.classification, DEDUPE_STATUS.NEW_VERSION);

  // 4. CONFLICT (same externalCode, same version 1.0, but different content/fingerprint)
  const incomingConflict = {
    ...incomingExact,
    sourceVersion: "1.0",
    name: "Dribble Bola Basket Cepat (Berubah Isi)",
    items: [
      {
        number: 1,
        prompt: "Pertanyaan baru berbeda",
        rubricScale: 3,
        rubricLevels: [
          { level: 1, label: "L1", desc: "Deskripsi berbeda 1" },
          { level: 2, label: "L2", desc: "Deskripsi berbeda 2" },
          { level: 3, label: "L3", desc: "Deskripsi berbeda 3" }
        ]
      }
    ]
  };
  const resConflict = classifyAssessment(incomingConflict, existingDefinitions);
  assert.equal(resConflict.classification, DEDUPE_STATUS.CONFLICT);
});

test("planAssessmentPackageImport returns structured plan with correct summary counts and actions", () => {
  const existingDef = createAssessmentDefinition({
    id: "def-existing-1",
    name: "Lari Sprint",
    purpose: "formative",
    assessmentType: "practice",
    materials: ["Sprint"],
    sourceMeta: {
      externalCode: "SPRINT-01",
      sourceVersion: "1.0"
    },
    items: [
      {
        number: 1,
        prompt: "Start lari",
        rubricScale: 3,
        rubricLevels: [
          { level: 1, label: "L1", desc: "Desc 1" },
          { level: 2, label: "L2", desc: "Desc 2" },
          { level: 3, label: "L3", desc: "Desc 3" }
        ]
      }
    ]
  });
  existingDef.sourceMeta.fingerprint = calculateAssessmentFingerprint(existingDef);

  const existingDefinitions = [existingDef];

  const packageData = createCanonicalAssessmentPackage({
    sourceName: "Bank Soal Uji",
    assessments: [
      // 1. EXACT_MATCH
      {
        externalCode: "SPRINT-01",
        sourceVersion: "1.0",
        name: "Lari Sprint",
        purpose: "formative",
        assessmentType: "practice",
        materials: ["Sprint"],
        items: existingDef.items
      },
      // 2. NEW
      {
        externalCode: "RENANG-01",
        sourceVersion: "1.0",
        name: "Renang Gaya Dada",
        purpose: "formative",
        assessmentType: "practice",
        materials: ["Kolam Renang"],
        items: [
          {
            number: 1,
            prompt: "Gerakan kaki gaya dada",
            rubricScale: 3,
            rubricLevels: [
              { level: 1, label: "L1", desc: "D1" },
              { level: 2, label: "L2", desc: "D2" },
              { level: 3, label: "L3", desc: "D3" }
            ]
          }
        ]
      },
      // 3. NEW_VERSION
      {
        externalCode: "SPRINT-01",
        sourceVersion: "2.0",
        name: "Lari Sprint 60m",
        purpose: "formative",
        assessmentType: "practice",
        materials: ["Sprint 60m"],
        items: existingDef.items
      },
      // 4. CONFLICT
      {
        externalCode: "SPRINT-01",
        sourceVersion: "1.0",
        name: "Lari Sprint (Isi Dimodifikasi)",
        purpose: "formative",
        assessmentType: "practice",
        materials: ["Sprint Berbeda"],
        items: existingDef.items
      }
    ]
  });

  const plan = planAssessmentPackageImport(packageData, existingDefinitions);

  assert.equal(plan.summary.total, 4);
  assert.equal(plan.summary.reuse, 1);
  assert.equal(plan.summary.create, 1);
  assert.equal(plan.summary.newVersion, 1);
  assert.equal(plan.summary.conflict, 1);

  assert.equal(plan.items[0].action, IMPORT_ACTION.REUSE);
  assert.equal(plan.items[1].action, IMPORT_ACTION.CREATE);
  assert.equal(plan.items[2].action, IMPORT_ACTION.NEW_VERSION);
  assert.equal(plan.items[3].action, IMPORT_ACTION.CONFLICT);
});

test("exportAssessmentSessionToJsonFile produces canonical package without local IDs and generates safe filename", () => {
  const session = createAssessmentSession({
    id: "sess-secret-local-id-888",
    classId: "class-secret-local-999",
    definitionId: "def-secret-local-777",
    title: "UTS PJOK / Kelas 1 : Praktik",
    purpose: "midterm",
    materials: ["Senam Ketangkasan"],
    instructions: "Lakukan rangkaian gerak berurutan.",
    itemsSnapshot: [
      {
        id: "item-snap-1",
        number: 1,
        prompt: "Keseimbangan satu kaki",
        rubricScale: 3,
        rubricLevels: [
          { level: 1, label: "L1", desc: "Belum mampu seimbang" },
          { level: 2, label: "L2", desc: "Mampu bertahan 3 detik" },
          { level: 3, label: "L3", desc: "Mampu bertahan > 5 detik" }
        ]
      }
    ]
  });

  const definition = createAssessmentDefinition({
    id: "def-secret-local-777",
    name: "UTS PJOK / Kelas 1 : Praktik",
    assessmentType: "practice",
    method: "rubric",
    rubricScale: 3,
    sourceMeta: {
      externalCode: "UTS-SD-01",
      sourceVersion: "2026.1"
    }
  });

  const filename = generateSafeExportFilename(session.title);
  assert.equal(filename, "UTS_PJOK_Kelas_1_Praktik.json");

  const exportResult = exportAssessmentSessionToJsonFile(session, definition, {
    sourceName: "Korwil Tangerang"
  });

  assert.equal(exportResult.filename, "UTS_PJOK_Kelas_1_Praktik.json");
  assert.equal(exportResult.package.format, ASSESSMENT_PACKAGE_FORMAT);
  assert.equal(exportResult.package.formatVersion, 1);
  assert.equal(exportResult.package.source.name, "Korwil Tangerang");
  assert.equal(exportResult.package.assessments.length, 1);

  const exportedAssessment = exportResult.package.assessments[0];
  assert.equal(exportedAssessment.externalCode, "UTS-SD-01");
  assert.equal(exportedAssessment.sourceVersion, "2026.1");
  assert.equal(exportedAssessment.name, "UTS PJOK / Kelas 1 : Praktik");
  assert.equal(exportedAssessment.purpose, "midterm");
  assert.equal(exportedAssessment.assessmentType, "practice");

  // Verify json string does not leak secret local database IDs or class IDs
  assert.equal(exportResult.jsonString.includes("sess-secret-local-id-888"), false);
  assert.equal(exportResult.jsonString.includes("class-secret-local-999"), false);
  assert.equal(exportResult.jsonString.includes("def-secret-local-777"), false);
});

test("executeAssessmentPackageImport blocks writes on invalid package and performs correct batch importing", () => {
  const targetClassId = "class-target-101";

  // 1. Invalid package validation failure blocks import
  const invalidPackage = {
    format: "invalid-format",
    formatVersion: 1,
    assessments: []
  };

  const failResult = executeAssessmentPackageImport({
    packageData: invalidPackage,
    targetClassId,
    existingDefinitions: [],
    existingSessions: []
  });

  assert.equal(failResult.success, false);
  assert.equal(failResult.importedCount, 0);
  assert.equal(failResult.newDefinitions.length, 0);
  assert.equal(failResult.newSessions.length, 0);

  // 2. Valid package with mixed NEW, EXACT_MATCH (new to class), EXACT_MATCH (already in class), NEW_VERSION, CONFLICT
  const existingDef1 = createAssessmentDefinition({
    id: "def-exist-1",
    name: "Lari 50m",
    purpose: "formative",
    assessmentType: "practice",
    method: "rubric",
    materials: ["Sprint"],
    rubricScale: 3,
    sourceMeta: {
      externalCode: "SPRINT-50M",
      sourceVersion: "1.0"
    },
    items: [
      {
        number: 1,
        prompt: "Start sprint",
        rubricScale: 3,
        rubricLevels: [
          { level: 1, label: "L1", desc: "Kurang" },
          { level: 2, label: "L2", desc: "Cukup" },
          { level: 3, label: "L3", desc: "Baik" }
        ]
      }
    ]
  });
  existingDef1.sourceMeta.fingerprint = calculateAssessmentFingerprint(existingDef1);

  const existingDef2 = createAssessmentDefinition({
    id: "def-exist-2",
    name: "Lompat Jauh",
    purpose: "formative",
    assessmentType: "practice",
    method: "rubric",
    materials: ["Bak Pasir"],
    rubricScale: 3,
    sourceMeta: {
      externalCode: "LOMPAT-JAUH",
      sourceVersion: "1.0"
    },
    items: [
      {
        number: 1,
        prompt: "Tolakan",
        rubricScale: 3,
        rubricLevels: [
          { level: 1, label: "L1", desc: "D1" },
          { level: 2, label: "L2", desc: "D2" },
          { level: 3, label: "L3", desc: "D3" }
        ]
      }
    ]
  });
  existingDef2.sourceMeta.fingerprint = calculateAssessmentFingerprint(existingDef2);

  // Suppose existingDef1 is ALREADY attached to targetClassId as an active session
  const existingSessionForClass = createAssessmentSession({
    id: "sess-existing-class-1",
    classId: targetClassId,
    definitionId: existingDef1.id,
    title: "Lari 50m"
  });

  const validBatchPackage = createCanonicalAssessmentPackage({
    sourceName: "Korwil Jakarta",
    assessments: [
      // 1. EXACT_MATCH but already in target class -> should be skipped to prevent duplication
      {
        externalCode: "SPRINT-50M",
        sourceVersion: "1.0",
        name: "Lari 50m",
        purpose: "formative",
        assessmentType: "practice",
        method: "rubric",
        materials: ["Sprint"],
        rubricScale: 3,
        items: existingDef1.items
      },
      // 2. EXACT_MATCH and NOT yet in target class -> should reuse definition and create new session
      {
        externalCode: "LOMPAT-JAUH",
        sourceVersion: "1.0",
        name: "Lompat Jauh",
        purpose: "formative",
        assessmentType: "practice",
        method: "rubric",
        materials: ["Bak Pasir"],
        rubricScale: 3,
        items: existingDef2.items
      },
      // 3. NEW assessment -> creates new definition and new session
      {
        externalCode: "RENANG-DADA",
        sourceVersion: "1.0",
        name: "Renang Gaya Dada",
        purpose: "formative",
        assessmentType: "practice",
        method: "rubric",
        materials: ["Kolam"],
        rubricScale: 3,
        items: [
          {
            number: 1,
            prompt: "Pernapasan renang",
            rubricScale: 3,
            rubricLevels: [
              { level: 1, label: "L1", desc: "Belum teratur" },
              { level: 2, label: "L2", desc: "Cukup teratur" },
              { level: 3, label: "L3", desc: "Sangat teratur" }
            ]
          }
        ]
      },
      // 4. NEW_VERSION -> creates new definition with sourceMeta and new session
      {
        externalCode: "SPRINT-50M",
        sourceVersion: "2.0",
        name: "Lari 50m Edisi 2",
        purpose: "formative",
        assessmentType: "practice",
        method: "rubric",
        materials: ["Sprint 50m"],
        rubricScale: 3,
        items: existingDef1.items
      },
      // 5. CONFLICT (same version 1.0, modified content) -> skipped
      {
        externalCode: "LOMPAT-JAUH",
        sourceVersion: "1.0",
        name: "Lompat Jauh Isi Berubah",
        purpose: "formative",
        assessmentType: "practice",
        method: "rubric",
        materials: ["Bak Pasir Berbeda"],
        rubricScale: 3,
        items: existingDef2.items
      }
    ]
  });

  const batchResult = executeAssessmentPackageImport({
    packageData: validBatchPackage,
    targetClassId,
    existingDefinitions: [existingDef1, existingDef2],
    existingSessions: [existingSessionForClass]
  });

  assert.equal(batchResult.success, true);
  // Item 1: skipped duplicate in class (0 new sessions)
  // Item 2: EXACT_MATCH reused definition (1 new session, 0 new defs)
  // Item 3: NEW (1 new session, 1 new def)
  // Item 4: NEW_VERSION (1 new session, 1 new def)
  // Item 5: CONFLICT (0 new sessions, 0 new defs)
  assert.equal(batchResult.importedCount, 3);
  assert.equal(batchResult.newDefinitions.length, 2);
  assert.equal(batchResult.newSessions.length, 3);

  // Verify all new sessions belong to targetClassId and have 0 student score records
  batchResult.newSessions.forEach((sess) => {
    assert.equal(sess.classId, targetClassId);
    assert.ok(sess.itemsSnapshot.length > 0);
  });
});
