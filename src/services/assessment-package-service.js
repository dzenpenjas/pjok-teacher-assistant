/**
 * Assessment Package v1 Foundation
 * Canonical schema, export mapping, validation, fingerprinting, deduplication, and import planning.
 */

export const ASSESSMENT_PACKAGE_FORMAT = "pjok-assessment-package";
export const ASSESSMENT_PACKAGE_FORMAT_VERSION = 1;

export const SUPPORTED_PURPOSES = Object.freeze(["pretest", "formative", "posttest", "midterm", "final"]);
export const SUPPORTED_ASSESSMENT_TYPES = Object.freeze(["oral", "written", "practice", "observation"]);
export const SUPPORTED_METHODS = Object.freeze(["rubric"]);
export const SUPPORTED_RUBRIC_SCALES = Object.freeze([3, 4, 5]);

export const DEDUPE_STATUS = Object.freeze({
  NEW: "NEW",
  EXACT_MATCH: "EXACT_MATCH",
  NEW_VERSION: "NEW_VERSION",
  CONFLICT: "CONFLICT"
});

export const IMPORT_ACTION = Object.freeze({
  CREATE: "create",
  REUSE: "reuse",
  NEW_VERSION: "newVersion",
  CONFLICT: "conflict"
});

function normalizeString(val) {
  return typeof val === "string" ? val.trim() : "";
}

/**
 * Builds the canonical content structure used to compute deterministic content fingerprints.
 * Omits volatile properties: IDs, timestamps, and transient metadata.
 * Covers: name, purpose, assessmentType, method, materials, instructions, rubricScale, items, rubric labels/descriptions.
 */
export function buildAssessmentFingerprintPayload(assessment = {}) {
  const scale = Number(assessment.rubricScale) || 5;
  const rawMaterials = Array.isArray(assessment.materials) ? assessment.materials : [];
  const materials = rawMaterials
    .map(normalizeString)
    .filter(Boolean);

  const rawItems = Array.isArray(assessment.items)
    ? assessment.items
    : (Array.isArray(assessment.itemsSnapshot) ? assessment.itemsSnapshot : []);

  const items = rawItems.map((item, idx) => {
    const itemScale = Number(item.rubricScale) || scale;
    const rawLevels = Array.isArray(item.rubricLevels) ? item.rubricLevels : [];
    const rubricLevels = rawLevels
      .map((lvl) => ({
        level: Number(lvl.level),
        label: normalizeString(lvl.label),
        desc: normalizeString(lvl.desc)
      }))
      .sort((a, b) => a.level - b.level);

    return {
      number: Number(item.number) || (idx + 1),
      prompt: normalizeString(item.prompt),
      rubricScale: itemScale,
      rubricLevels
    };
  });

  return {
    name: normalizeString(assessment.name || assessment.title),
    purpose: normalizeString(assessment.purpose),
    assessmentType: normalizeString(assessment.assessmentType),
    method: normalizeString(assessment.method || "rubric"),
    materials,
    instructions: normalizeString(assessment.instructions),
    rubricScale: scale,
    items
  };
}

/**
 * Computes a deterministic 64-bit FNV-1a hex fingerprint for assessment content.
 */
export function calculateAssessmentFingerprint(assessment) {
  const payload = buildAssessmentFingerprintPayload(assessment);
  const jsonStr = JSON.stringify(payload);

  let h1 = 0x811c9dc5;
  let h2 = 0xcbf29ce4;
  for (let i = 0; i < jsonStr.length; i++) {
    const ch = jsonStr.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 0x01000193);
    h2 = Math.imul(h2 ^ (ch << 1), 0x01000193);
  }
  const hex1 = (h1 >>> 0).toString(16).padStart(8, "0");
  const hex2 = (h2 >>> 0).toString(16).padStart(8, "0");
  return `fp_${hex1}${hex2}`;
}

/**
 * Exports one canonical assessment from AssessmentSession (authority for itemsSnapshot) + AssessmentDefinition (metadata).
 * Pure function: does not mutate source objects.
 */
export function buildCanonicalAssessmentFromSession(assessmentSession, assessmentDefinition, options = {}) {
  const session = assessmentSession || {};
  const definition = assessmentDefinition || {};

  const sourceMeta = definition.sourceMeta || {};
  const sourceVersion = normalizeString(options.sourceVersion || sourceMeta.sourceVersion || "1.0");
  const name = normalizeString(session.title || definition.name || "");

  let recommendedGrade = null;
  if (options.recommendedGrade !== undefined && options.recommendedGrade !== null) {
    const parsed = Number(options.recommendedGrade);
    recommendedGrade = !Number.isNaN(parsed) && parsed > 0 ? parsed : null;
  } else if (options.gradeLevel !== undefined && options.gradeLevel !== null) {
    const parsed = Number(options.gradeLevel);
    recommendedGrade = !Number.isNaN(parsed) && parsed > 0 ? parsed : null;
  } else if (definition.recommendedGrade !== undefined && definition.recommendedGrade !== null) {
    const parsed = Number(definition.recommendedGrade);
    recommendedGrade = !Number.isNaN(parsed) && parsed > 0 ? parsed : null;
  }

  const purpose = session.purpose || definition.purpose || "formative";
  const assessmentType = definition.assessmentType || "practice";
  const category = definition.category || "pengetahuan";
  const method = definition.method || "rubric";

  const rawMaterials = Array.isArray(session.materials) && session.materials.length > 0
    ? session.materials
    : (Array.isArray(definition.materials) ? definition.materials : []);
  const materials = rawMaterials.map(normalizeString).filter(Boolean);

  const instructions = normalizeString(session.instructions || definition.instructions || "");
  const description = normalizeString(definition.description || "");

  const sessionScale = session.rubricSnapshot?.scale ? Number(session.rubricSnapshot.scale) : null;
  const defScale = definition.rubricScale ? Number(definition.rubricScale) : null;
  const rubricScale = sessionScale || defScale || 5;

  const unit = normalizeString(definition.unit || "");
  const direction = normalizeString(definition.direction || "");

  // Authority for items: session.itemsSnapshot, fallback to definition.items
  const rawItems = Array.isArray(session.itemsSnapshot) && session.itemsSnapshot.length > 0
    ? session.itemsSnapshot
    : (Array.isArray(definition.items) ? definition.items : []);

  const items = rawItems.map((item, idx) => {
    const itemScale = Number(item.rubricScale) || rubricScale;
    const rawLevels = Array.isArray(item.rubricLevels) ? item.rubricLevels : [];
    const rubricLevels = rawLevels.map((lvl) => ({
      level: Number(lvl.level),
      label: normalizeString(lvl.label) || `Level ${lvl.level}`,
      desc: normalizeString(lvl.desc)
    })).sort((a, b) => a.level - b.level);

    return {
      number: Number(item.number) || (idx + 1),
      prompt: normalizeString(item.prompt),
      rubricScale: itemScale,
      rubricLevels
    };
  });

  // Priority: options.externalCode -> sourceMeta.externalCode -> deterministic portable code (LOCAL-<fingerprint>)
  // Local DB IDs (definition.id, session.definitionId, session.id) must NEVER be used as externalCode
  let externalCode = normalizeString(options.externalCode || sourceMeta.externalCode);
  if (!externalCode) {
    const fp = calculateAssessmentFingerprint({
      name,
      purpose,
      assessmentType,
      method,
      materials,
      instructions,
      rubricScale,
      items
    });
    externalCode = `LOCAL-${fp}`;
  }

  return {
    externalCode,
    sourceVersion,
    name,
    recommendedGrade,

    purpose,
    assessmentType,
    category,
    method,

    materials,
    instructions,
    description,

    rubricScale,
    unit,
    direction,

    items
  };
}

/**
 * Builds a full canonical package object from an array of canonical assessments.
 */
export function createCanonicalAssessmentPackage({ sourceName = "PJOK Assistant", assessments = [] } = {}) {
  return {
    format: ASSESSMENT_PACKAGE_FORMAT,
    formatVersion: ASSESSMENT_PACKAGE_FORMAT_VERSION,
    source: {
      name: normalizeString(sourceName) || "PJOK Assistant"
    },
    assessments: Array.isArray(assessments) ? assessments : []
  };
}

/**
 * Validates a canonical assessment package before persistence.
 * Returns structured validation result with detailed error messages.
 * Strict validation: requires externalCode, sourceVersion, name, purpose, assessmentType, method, materials, rubricScale, items.
 */
export function validateAssessmentPackage(packageData) {
  const errors = [];

  if (!packageData || typeof packageData !== "object") {
    return {
      valid: false,
      errors: [
        {
          field: "package",
          message: "Data paket asesmen tidak valid (harus berupa objek)."
        }
      ]
    };
  }

  if (packageData.format !== ASSESSMENT_PACKAGE_FORMAT) {
    errors.push({
      field: "format",
      message: `Format paket '${packageData.format}' tidak valid. Harus '${ASSESSMENT_PACKAGE_FORMAT}'.`
    });
  }

  if (Number(packageData.formatVersion) !== ASSESSMENT_PACKAGE_FORMAT_VERSION) {
    errors.push({
      field: "formatVersion",
      message: `Versi format paket '${packageData.formatVersion}' tidak didukung. Versi yang didukung adalah ${ASSESSMENT_PACKAGE_FORMAT_VERSION}.`
    });
  }

  if (!Array.isArray(packageData.assessments) || packageData.assessments.length === 0) {
    errors.push({
      field: "assessments",
      message: "Paket asesmen harus berisi minimal satu instrumen asesmen."
    });
    return {
      valid: errors.length === 0,
      errors
    };
  }

  packageData.assessments.forEach((assessment, assessmentIndex) => {
    if (!assessment || typeof assessment !== "object") {
      errors.push({
        assessmentIndex,
        field: "assessment",
        message: `Asesmen pada indeks ${assessmentIndex} tidak valid.`
      });
      return;
    }

    const name = normalizeString(assessment.name);
    if (!name) {
      errors.push({
        assessmentIndex,
        field: "name",
        message: "Nama asesmen wajib diisi."
      });
    }

    const externalCode = normalizeString(assessment.externalCode);
    if (!externalCode) {
      errors.push({
        assessmentIndex,
        field: "externalCode",
        message: "Kode eksternal (externalCode) wajib diisi."
      });
    }

    const sourceVersion = normalizeString(assessment.sourceVersion);
    if (!sourceVersion) {
      errors.push({
        assessmentIndex,
        field: "sourceVersion",
        message: "Versi sumber (sourceVersion) wajib diisi."
      });
    }

    if (!assessment.purpose || !SUPPORTED_PURPOSES.includes(assessment.purpose)) {
      errors.push({
        assessmentIndex,
        field: "purpose",
        message: `Jenis asesmen '${assessment.purpose}' tidak didukung. Pilihan: ${SUPPORTED_PURPOSES.join(", ")}.`
      });
    }

    if (!assessment.assessmentType || !SUPPORTED_ASSESSMENT_TYPES.includes(assessment.assessmentType)) {
      errors.push({
        assessmentIndex,
        field: "assessmentType",
        message: `Bentuk asesmen '${assessment.assessmentType}' tidak didukung. Pilihan: ${SUPPORTED_ASSESSMENT_TYPES.join(", ")}.`
      });
    }

    if (!assessment.method || !SUPPORTED_METHODS.includes(assessment.method)) {
      errors.push({
        assessmentIndex,
        field: "method",
        message: `Metode '${assessment.method}' tidak didukung. Hanya '${SUPPORTED_METHODS.join(", ")}' yang didukung pada v1.`
      });
    }

    const rawScale = assessment.rubricScale;
    const assessmentScale = Number(rawScale);
    if (rawScale === undefined || rawScale === null || !SUPPORTED_RUBRIC_SCALES.includes(assessmentScale)) {
      errors.push({
        assessmentIndex,
        field: "rubricScale",
        message: `Skala rubrik asesmen '${assessment.rubricScale}' tidak valid. Pilihan: ${SUPPORTED_RUBRIC_SCALES.join(", ")}.`
      });
    }

    const materials = Array.isArray(assessment.materials)
      ? assessment.materials.map(normalizeString).filter(Boolean)
      : [];
    if (materials.length === 0) {
      errors.push({
        assessmentIndex,
        field: "materials",
        message: "Materi asesmen wajib diisi minimal satu materi."
      });
    }

    const items = Array.isArray(assessment.items) ? assessment.items : [];
    if (items.length === 0) {
      errors.push({
        assessmentIndex,
        field: "items",
        message: "Asesmen harus memiliki minimal satu butir pertanyaan/tugas."
      });
    }

    items.forEach((item, itemIndex) => {
      if (!item || typeof item !== "object") {
        errors.push({
          assessmentIndex,
          itemIndex,
          field: "items",
          message: `Butir pertanyaan pada indeks ${itemIndex} tidak valid.`
        });
        return;
      }

      const prompt = normalizeString(item.prompt);
      if (!prompt) {
        errors.push({
          assessmentIndex,
          itemIndex,
          field: "prompt",
          message: `Pertanyaan butir ${itemIndex + 1} tidak boleh kosong.`
        });
      }

      const rawItemScale = item.rubricScale;
      const itemScale = Number(rawItemScale);
      if (rawItemScale === undefined || rawItemScale === null || !SUPPORTED_RUBRIC_SCALES.includes(itemScale)) {
        errors.push({
          assessmentIndex,
          itemIndex,
          field: "rubricScale",
          message: `Skala rubrik butir ${itemIndex + 1} (${item.rubricScale}) tidak valid. Pilihan: ${SUPPORTED_RUBRIC_SCALES.join(", ")}.`
        });
      }

      const rubricLevels = Array.isArray(item.rubricLevels) ? item.rubricLevels : [];
      const presentLevels = new Set();
      const validItemScale = SUPPORTED_RUBRIC_SCALES.includes(itemScale) ? itemScale : null;

      rubricLevels.forEach((lvl) => {
        const lvlNum = Number(lvl.level);
        if (Number.isNaN(lvlNum) || (validItemScale && (lvlNum < 1 || lvlNum > validItemScale))) {
          errors.push({
            assessmentIndex,
            itemIndex,
            field: "rubricLevels",
            message: `Level rubrik ${lvl.level} pada butir ${itemIndex + 1} berada di luar rentang 1..${validItemScale || item.rubricScale}.`
          });
        } else if (presentLevels.has(lvlNum)) {
          errors.push({
            assessmentIndex,
            itemIndex,
            field: "rubricLevels",
            message: `Terdapat duplikasi rubrik level ${lvlNum} pada butir ${itemIndex + 1}.`
          });
        } else {
          presentLevels.add(lvlNum);
        }

        const desc = normalizeString(lvl.desc);
        if (!desc) {
          errors.push({
            assessmentIndex,
            itemIndex,
            field: "rubricLevels",
            message: `Deskripsi rubrik level ${lvl.level} pada butir ${itemIndex + 1} belum diisi.`
          });
        }
      });

      // Verify all levels 1..validItemScale are present
      if (validItemScale) {
        for (let l = 1; l <= validItemScale; l++) {
          if (!presentLevels.has(l)) {
            errors.push({
              assessmentIndex,
              itemIndex,
              field: "rubricLevels",
              message: `Rubrik level ${l} pada butir ${itemIndex + 1} belum tersedia.`
            });
          }
        }
      }
    });
  });

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Deduplicates and classifies an incoming canonical assessment against existing AssessmentDefinitions.
 * Considers ALL existing definitions matching externalCode across historical versions.
 * Returns classification: NEW | EXACT_MATCH | NEW_VERSION | CONFLICT.
 */
export function classifyAssessment(incomingAssessment, existingDefinitions = []) {
  if (!incomingAssessment || typeof incomingAssessment !== "object") {
    return {
      classification: DEDUPE_STATUS.NEW,
      incomingFingerprint: "",
      existingDefinition: null,
      reason: "Asesmen baru"
    };
  }

  const incomingCode = normalizeString(incomingAssessment.externalCode);
  const incomingVersion = normalizeString(incomingAssessment.sourceVersion);
  const incomingFingerprint = calculateAssessmentFingerprint(incomingAssessment);

  if (!incomingCode) {
    return {
      classification: DEDUPE_STATUS.NEW,
      incomingFingerprint,
      existingDefinition: null,
      reason: "Asesmen baru tanpa externalCode."
    };
  }

  // Find ALL matching definitions with same externalCode
  const matchingDefs = (Array.isArray(existingDefinitions) ? existingDefinitions : []).filter((def) => {
    const defCode = normalizeString(def?.sourceMeta?.externalCode || def?.externalCode);
    return defCode && defCode === incomingCode;
  });

  if (matchingDefs.length === 0) {
    return {
      classification: DEDUPE_STATUS.NEW,
      incomingFingerprint,
      existingDefinition: null,
      reason: "Tidak ditemukan asesmen dengan externalCode yang sama (baru)."
    };
  }

  // Filter existing definitions that share the same sourceVersion (legacy defs default to "1.0" in comparison)
  const sameVersionDefs = matchingDefs.filter((def) => {
    const defVersion = normalizeString(def?.sourceMeta?.sourceVersion || def?.sourceVersion || "1.0");
    return defVersion === (incomingVersion || "1.0");
  });

  if (sameVersionDefs.length > 0) {
    // Check if any existing definition of the same version has the exact same fingerprint
    const exactMatchDef = sameVersionDefs.find((def) => {
      const defFingerprint = def?.sourceMeta?.fingerprint || calculateAssessmentFingerprint(def);
      return defFingerprint === incomingFingerprint;
    });

    if (exactMatchDef) {
      return {
        classification: DEDUPE_STATUS.EXACT_MATCH,
        incomingFingerprint,
        existingDefinition: exactMatchDef,
        reason: "Asesmen identik (externalCode, versi, dan konten sama persis)."
      };
    }

    // Same version exists, but content differs -> CONFLICT
    return {
      classification: DEDUPE_STATUS.CONFLICT,
      incomingFingerprint,
      existingDefinition: sameVersionDefs[0],
      reason: `Konflik: versi sama (${incomingVersion || "1.0"}) tetapi konten asesmen berbeda.`
    };
  }

  // Same externalCode exists across definitions, but not with this sourceVersion -> NEW_VERSION
  return {
    classification: DEDUPE_STATUS.NEW_VERSION,
    incomingFingerprint,
    existingDefinition: matchingDefs[0],
    reason: `Versi baru: externalCode '${incomingCode}' ditemukan dengan versi lain.`
  };
}

/**
 * Plans the import of a validated canonical package against existing definitions.
 * Returns structured plan with summary and per-item classifications/actions.
 * Pure function: performs NO database writes.
 */
export function planAssessmentPackageImport(validatedPackage, existingDefinitions = []) {
  const assessments = Array.isArray(validatedPackage?.assessments) ? validatedPackage.assessments : [];

  const summary = {
    total: assessments.length,
    create: 0,
    reuse: 0,
    newVersion: 0,
    conflict: 0
  };

  const items = assessments.map((assessment, index) => {
    const { classification, incomingFingerprint, existingDefinition, reason } = classifyAssessment(
      assessment,
      existingDefinitions
    );

    let action = IMPORT_ACTION.CREATE;
    if (classification === DEDUPE_STATUS.EXACT_MATCH) {
      action = IMPORT_ACTION.REUSE;
      summary.reuse++;
    } else if (classification === DEDUPE_STATUS.NEW_VERSION) {
      action = IMPORT_ACTION.NEW_VERSION;
      summary.newVersion++;
    } else if (classification === DEDUPE_STATUS.CONFLICT) {
      action = IMPORT_ACTION.CONFLICT;
      summary.conflict++;
    } else {
      action = IMPORT_ACTION.CREATE;
      summary.create++;
    }

    return {
      index,
      assessment,
      classification,
      action,
      existingDefinition: existingDefinition || null,
      fingerprint: incomingFingerprint,
      reason
    };
  });

  return {
    summary,
    items
  };
}
