import { calculateBmi } from "../data/models.js";
import { evaluateStudentWhoGrowth } from "./who-growth-reference-service.js";

export function calculateAgeAtDate(birthDateStr, measurementDateStr) {
  if (!birthDateStr || !measurementDateStr) return null;
  const birth = new Date(birthDateStr);
  const measure = new Date(measurementDateStr);
  if (isNaN(birth.getTime()) || isNaN(measure.getTime()) || measure < birth) {
    return null;
  }
  
  let years = measure.getFullYear() - birth.getFullYear();
  let months = measure.getMonth() - birth.getMonth();
  let days = measure.getDate() - birth.getDate();
  
  if (days < 0) {
    months--;
  }
  if (months < 0) {
    years--;
    months += 12;
  }
  
  const totalMonths = (years * 12) + months;
  return {
    totalMonths,
    years,
    months
  };
}

export function calculateMonthsBetween(dateStr1, dateStr2) {
  if (!dateStr1 || !dateStr2) return null;
  const d1 = new Date(dateStr1);
  const d2 = new Date(dateStr2);
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return null;
  
  const yearsDiff = d2.getFullYear() - d1.getFullYear();
  const monthsDiff = d2.getMonth() - d1.getMonth();
  
  let totalMonths = (yearsDiff * 12) + monthsDiff;
  if (d2.getDate() < d1.getDate()) {
    totalMonths--;
  }
  return Math.max(0, totalMonths);
}

export function buildGrowthSummary(growthSelections = [], student = null, allGrowthRecords = []) {
  const selections = Array.isArray(growthSelections) ? growthSelections : [];

  // Filter only records belonging to this student if student.id is present
  const studentRecords = student?.id
    ? selections.filter((g) => !g.studentId || g.studentId === student.id)
    : selections;

  // Deterministic sort: date desc, then id desc
  const sortedRecords = [...studentRecords].sort((a, b) => {
    const dComp = (b.date || "").localeCompare(a.date || "");
    if (dComp !== 0) return dComp;
    return (b.id || "").localeCompare(a.id || "");
  });

  // Extract valid Height records (positive and finite)
  const validHeightRecords = sortedRecords
    .filter((g) => {
      if (g.heightCm === null || g.heightCm === undefined || g.heightCm === "") return false;
      const num = Number(g.heightCm);
      return Number.isFinite(num) && num > 0;
    })
    .map((g) => ({
      id: g.id || "",
      date: g.date || "",
      heightCm: Number(g.heightCm)
    }));

  // Extract valid Weight records (positive and finite)
  const validWeightRecords = sortedRecords
    .filter((g) => {
      if (g.weightKg === null || g.weightKg === undefined || g.weightKg === "") return false;
      const num = Number(g.weightKg);
      return Number.isFinite(num) && num > 0;
    })
    .map((g) => ({
      id: g.id || "",
      date: g.date || "",
      weightKg: Number(g.weightKg)
    }));

  const latestHeight = validHeightRecords.length > 0 ? validHeightRecords[0] : null;
  const previousHeight = validHeightRecords.length > 1 ? validHeightRecords[1] : null;

  const latestWeight = validWeightRecords.length > 0 ? validWeightRecords[0] : null;
  const previousWeight = validWeightRecords.length > 1 ? validWeightRecords[1] : null;

  let heightChangeCm = null;
  let heightChangeMonths = null;
  if (latestHeight && previousHeight) {
    heightChangeCm = Math.round((latestHeight.heightCm - previousHeight.heightCm) * 10) / 10;
    heightChangeMonths = calculateMonthsBetween(previousHeight.date, latestHeight.date);
  }

  let weightChangeKg = null;
  let weightChangeMonths = null;
  if (latestWeight && previousWeight) {
    weightChangeKg = Math.round((latestWeight.weightKg - previousWeight.weightKg) * 10) / 10;
    weightChangeMonths = calculateMonthsBetween(previousWeight.date, latestWeight.date);
  }

  let bmi = null;
  let bmiDate = null;
  let bmiReason = null;

  if (latestHeight && latestWeight) {
    if (latestHeight.date && latestWeight.date && latestHeight.date === latestWeight.date) {
      const bmiRes = calculateBmi(latestHeight.heightCm, latestWeight.weightKg);
      bmi = bmiRes.bmi;
      bmiDate = latestHeight.date;
      bmiReason = null;
    } else {
      bmi = null;
      bmiDate = null;
      bmiReason = "TANGGAL_PENGUKURAN_BERBEDA";
    }
  } else {
    bmi = null;
    bmiDate = null;
    bmiReason = "DATA_TIDAK_LENGKAP";
  }

  const ageAtHeight = (student?.birthDate && latestHeight?.date)
    ? calculateAgeAtDate(student.birthDate, latestHeight.date)
    : null;

  const ageAtWeight = (student?.birthDate && latestWeight?.date)
    ? calculateAgeAtDate(student.birthDate, latestWeight.date)
    : null;

  return {
    latestHeight,
    previousHeight,
    latestWeight,
    previousWeight,
    heightChangeCm,
    heightChangeMonths,
    weightChangeKg,
    weightChangeMonths,
    bmi,
    bmiDate,
    bmiReason,
    ageAtHeight,
    ageAtWeight,
    hasValidMeasurements: Boolean(latestHeight || latestWeight)
  };
}

export function calculateReportScoring({ assessmentSelections = [], scoringConfig = null }) {
  const isEnabled = Boolean(scoringConfig && scoringConfig.enabled);
  if (!isEnabled) {
    return {
      enabled: false,
      minimum: null,
      maximum: null,
      roundingRule: "round",
      formulaVersion: "item-proportion-v1",
      overallConvertedScore: null,
      sessions: {}
    };
  }

  if (!scoringConfig || typeof scoringConfig !== "object") {
    throw new Error("Konfigurasi konversi nilai tidak ditemukan.");
  }

  const rawMin = scoringConfig.minScore !== undefined ? scoringConfig.minScore : scoringConfig.minimum;
  const rawMax = scoringConfig.maxScore !== undefined ? scoringConfig.maxScore : scoringConfig.maximum;

  if (rawMin === null || rawMin === undefined || (typeof rawMin === "string" && rawMin.trim() === "")) {
    throw new Error("Nilai minimum konversi tidak boleh kosong.");
  }
  if (rawMax === null || rawMax === undefined || (typeof rawMax === "string" && rawMax.trim() === "")) {
    throw new Error("Nilai maksimum konversi tidak boleh kosong.");
  }

  const minimum = Number(rawMin);
  const maximum = Number(rawMax);

  if (!Number.isFinite(minimum) || !Number.isFinite(maximum) || minimum < 0 || maximum > 100 || minimum >= maximum) {
    throw new Error(`Rentang konversi tidak valid (${minimum} - ${maximum}). Minimum harus >= 0, maksimum <= 100, dan minimum < maksimum.`);
  }

  const sessions = {};
  const convertedScoresList = [];

  for (const item of assessmentSelections) {
    const sess = item.assessmentSession;
    const result = item.result;
    const sessionId = sess?.id || result?.assessmentSessionId || "";
    if (!sessionId) continue;

    const rawScore = (result?.numericScore !== null && result?.numericScore !== undefined && Number.isFinite(Number(result.numericScore)))
      ? Number(result.numericScore)
      : null;

    const rawItems = Array.isArray(sess?.itemsSnapshot)
      ? sess.itemsSnapshot
      : (Array.isArray(sess?.items) ? sess.items : []);

    const itemResults = Array.isArray(result?.itemResults) ? result.itemResults : [];

    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      sessions[sessionId] = {
        assessmentSessionId: sessionId,
        rawScore,
        convertedScore: null,
        canConvert: false,
        reason: "TIDAK_ADA_SNAPSHOT_SOAL"
      };
      continue;
    }

    const itemIds = rawItems.map((it) => it?.id).filter(Boolean);
    const uniqueItemIds = new Set(itemIds);
    if (itemIds.length !== rawItems.length || uniqueItemIds.size !== rawItems.length) {
      sessions[sessionId] = {
        assessmentSessionId: sessionId,
        rawScore,
        convertedScore: null,
        canConvert: false,
        reason: "SNAPSHOT_SOAL_TIDAK_VALID"
      };
      continue;
    }

    let allItemsComplete = true;
    let failureReason = null;
    const proportions = [];

    for (const snapItem of rawItems) {
      if (!snapItem || !snapItem.id) {
        allItemsComplete = false;
        failureReason = "DATA_RUBRIK_BELUM_LENGKAP";
        break;
      }

      const rawScale = snapItem.rubricScale;
      if (rawScale === null || rawScale === undefined || (typeof rawScale === "string" && rawScale.trim() === "")) {
        allItemsComplete = false;
        failureReason = "SKALA_RUBRIK_TIDAK_VALID";
        break;
      }
      const scale = Number(rawScale);
      if (!Number.isInteger(scale) || scale <= 1) {
        allItemsComplete = false;
        failureReason = "SKALA_RUBRIK_TIDAK_VALID";
        break;
      }

      const matchingResults = itemResults.filter((ir) => ir && ir.itemId === snapItem.id);
      if (matchingResults.length !== 1) {
        allItemsComplete = false;
        failureReason = "DATA_RUBRIK_BELUM_LENGKAP";
        break;
      }

      const matchingResult = matchingResults[0];
      const rawLevel = matchingResult.rubricLevel;
      if (rawLevel === null || rawLevel === undefined || (typeof rawLevel === "string" && rawLevel.trim() === "")) {
        allItemsComplete = false;
        failureReason = "DATA_RUBRIK_BELUM_LENGKAP";
        break;
      }
      const score = Number(rawLevel);
      if (!Number.isInteger(score) || score < 1 || score > scale) {
        allItemsComplete = false;
        failureReason = "DATA_RUBRIK_BELUM_LENGKAP";
        break;
      }

      if (Array.isArray(snapItem.rubricLevels) && snapItem.rubricLevels.length > 0) {
        const levelMatches = snapItem.rubricLevels.some((lvl) => Number(lvl.level) === score);
        if (!levelMatches) {
          allItemsComplete = false;
          failureReason = "DATA_RUBRIK_BELUM_LENGKAP";
          break;
        }
      }

      const proportion = (score - 1) / (scale - 1);
      proportions.push(proportion);
    }

    if (!allItemsComplete || proportions.length !== rawItems.length) {
      sessions[sessionId] = {
        assessmentSessionId: sessionId,
        rawScore,
        convertedScore: null,
        canConvert: false,
        reason: failureReason || "DATA_RUBRIK_BELUM_LENGKAP"
      };
      continue;
    }

    const avgProportion = proportions.reduce((acc, curr) => acc + curr, 0) / proportions.length;
    const convertedFloat = minimum + (avgProportion * (maximum - minimum));
    const convertedScore = Math.round(convertedFloat);

    sessions[sessionId] = {
      assessmentSessionId: sessionId,
      rawScore,
      convertedScore,
      canConvert: true,
      reason: null
    };

    convertedScoresList.push(convertedScore);
  }

  const overallConvertedScore = convertedScoresList.length > 0
    ? Math.round(convertedScoresList.reduce((a, b) => a + b, 0) / convertedScoresList.length)
    : null;

  return {
    enabled: true,
    minimum,
    maximum,
    roundingRule: "round",
    formulaVersion: "item-proportion-v1",
    overallConvertedScore,
    sessions
  };
}

export function analyzeGrowth(student, growthSelections = [], allGrowthRecords = []) {
  const studentAllRecords = [...(allGrowthRecords || [])]
    .filter((g) => g.studentId === student?.id)
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  const historyCount = studentAllRecords.length;

  const growthSummary = buildGrowthSummary(growthSelections, student, allGrowthRecords);

  const selectedSorted = [...(growthSelections || [])]
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""));

  if (selectedSorted.length === 0) {
    const whoReference = evaluateStudentWhoGrowth({ student, growthSummary });
    return {
      latest: null,
      previous: null,
      trend: null,
      historyCount,
      growthSummary,
      whoReference
    };
  }

  const latestRecord = selectedSorted[selectedSorted.length - 1];
  
  const latestBmiInfo = calculateBmi(latestRecord.heightCm, latestRecord.weightKg);
  const latestBmi = latestRecord.bmi !== undefined && latestRecord.bmi !== null ? latestRecord.bmi : latestBmiInfo.bmi;

  const ageInfo = student?.birthDate ? calculateAgeAtDate(student.birthDate, latestRecord.date) : null;

  const latest = {
    date: latestRecord.date || "",
    ageMonths: ageInfo ? ageInfo.totalMonths : null,
    ageYears: ageInfo ? ageInfo.years : null,
    ageRemainingMonths: ageInfo ? ageInfo.months : null,
    heightCm: latestRecord.heightCm ? parseFloat(latestRecord.heightCm) : null,
    weightKg: latestRecord.weightKg ? parseFloat(latestRecord.weightKg) : null,
    bmi: latestBmi
  };

  let previous = null;
  let trend = null;

  if (selectedSorted.length > 1) {
    const previousRecord = selectedSorted[selectedSorted.length - 2];
    const prevBmiInfo = calculateBmi(previousRecord.heightCm, previousRecord.weightKg);
    const prevBmi = previousRecord.bmi !== undefined && previousRecord.bmi !== null ? previousRecord.bmi : prevBmiInfo.bmi;

    previous = {
      date: previousRecord.date || "",
      heightCm: previousRecord.heightCm ? parseFloat(previousRecord.heightCm) : null,
      weightKg: previousRecord.weightKg ? parseFloat(previousRecord.weightKg) : null,
      bmi: prevBmi
    };

    const monthsBetween = calculateMonthsBetween(previousRecord.date, latestRecord.date);
    
    let heightChangeCm = null;
    if (latest.heightCm !== null && previous.heightCm !== null) {
      heightChangeCm = Math.round((latest.heightCm - previous.heightCm) * 10) / 10;
    }

    let weightChangeKg = null;
    if (latest.weightKg !== null && previous.weightKg !== null) {
      weightChangeKg = Math.round((latest.weightKg - previous.weightKg) * 10) / 10;
    }

    let bmiChange = null;
    if (latest.bmi !== null && previous.bmi !== null) {
      bmiChange = Math.round((latest.bmi - previous.bmi) * 10) / 10;
    }

    trend = {
      monthsBetween,
      heightChangeCm,
      weightChangeKg,
      bmiChange
    };
  }

  const whoReference = evaluateStudentWhoGrowth({ student, growthSummary });

  return {
    latest,
    previous,
    trend,
    historyCount,
    growthSummary,
    whoReference
  };
}
