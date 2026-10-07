import {
  WHO_GROWTH_REFERENCE_META,
  WHO_INDICATOR_RANGES,
  WHO_GROWTH_REFERENCE_DATA
} from "../data/who-growth-reference-2007.js";

/**
 * Parses date string (YYYY-MM-DD or other valid date string) to UTC timestamp (ms).
 * Avoids timezone and DST shifts, and strictly verifies real calendar dates.
 */
export function parseDateUtc(dateStr) {
  if (!dateStr || typeof dateStr !== "string") return null;
  const trimmed = dateStr.trim();
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const day = parseInt(match[3], 10);
    if (month < 1 || month > 12 || day < 1 || day > 31) {
      return null;
    }
    const monthIndex = month - 1;
    const utcTimestamp = Date.UTC(year, monthIndex, day);
    const checkDate = new Date(utcTimestamp);
    if (
      checkDate.getUTCFullYear() !== year ||
      checkDate.getUTCMonth() !== monthIndex ||
      checkDate.getUTCDate() !== day
    ) {
      return null;
    }
    return utcTimestamp;
  }
  const d = new Date(trimmed);
  if (isNaN(d.getTime())) return null;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * Calculates exact age in months from birthDate to measurementDate.
 * Formula: elapsedDays / 30.4375
 * Returns null if dates are invalid or measurementDate < birthDate.
 */
export function calculateExactAgeMonths(birthDateStr, measurementDateStr) {
  const birthUtc = parseDateUtc(birthDateStr);
  const measureUtc = parseDateUtc(measurementDateStr);
  if (birthUtc === null || measureUtc === null) return null;
  const elapsedMs = measureUtc - birthUtc;
  if (elapsedMs < 0) return null;
  const elapsedDays = elapsedMs / (1000 * 60 * 60 * 24);
  return elapsedDays / 30.4375;
}

/**
 * Normalizes sex string to canonical "male" or "female".
 * Returns null if invalid or missing.
 */
export function normalizeSex(sex) {
  if (!sex || typeof sex !== "string") return null;
  const s = sex.trim().toLowerCase();
  if (s === "male" || s === "m" || s === "laki-laki" || s === "laki") return "male";
  if (s === "female" || s === "f" || s === "perempuan" || s === "wanita") return "female";
  return null;
}

/**
 * Interpolates LMS parameters between adjacent month points.
 * Returns { L, M, S } or null if out of range.
 */
export function interpolateLms(dataset, exactAgeMonths) {
  if (!Array.isArray(dataset) || dataset.length === 0) return null;
  if (exactAgeMonths == null || !Number.isFinite(exactAgeMonths)) return null;

  const minMonth = dataset[0].month;
  const maxMonth = dataset[dataset.length - 1].month;

  if (exactAgeMonths < minMonth || exactAgeMonths > maxMonth) {
    return null;
  }

  // Exact boundary match
  if (exactAgeMonths === minMonth) {
    return { L: dataset[0].L, M: dataset[0].M, S: dataset[0].S };
  }
  if (exactAgeMonths === maxMonth) {
    const last = dataset[dataset.length - 1];
    return { L: last.L, M: last.M, S: last.S };
  }

  // Find surrounding rows
  let lowIndex = 0;
  for (let i = 0; i < dataset.length - 1; i++) {
    if (dataset[i].month <= exactAgeMonths && dataset[i + 1].month >= exactAgeMonths) {
      lowIndex = i;
      break;
    }
  }

  const r1 = dataset[lowIndex];
  const r2 = dataset[lowIndex + 1];

  if (r1.month === r2.month) {
    return { L: r1.L, M: r1.M, S: r1.S };
  }

  const f = (exactAgeMonths - r1.month) / (r2.month - r1.month);
  return {
    L: r1.L + f * (r2.L - r1.L),
    M: r1.M + f * (r2.M - r1.M),
    S: r1.S + f * (r2.S - r1.S)
  };
}

/**
 * Calculates WHO LMS z-score with official WHO 2007 extreme tail adjustment.
 */
export function calculateWhoZScore({ measurement, ageMonths, sex, indicator }) {
  const normSex = normalizeSex(sex);
  if (!normSex) {
    return { available: false, reason: "MISSING_OR_INVALID_SEX" };
  }

  const range = WHO_INDICATOR_RANGES[indicator];
  if (!range) {
    return { available: false, reason: "UNKNOWN_INDICATOR" };
  }

  if (ageMonths == null || !Number.isFinite(ageMonths) || ageMonths < range.minMonth || ageMonths > range.maxMonth) {
    return { available: false, reason: "AGE_OUT_OF_REFERENCE_RANGE" };
  }

  const numVal = Number(measurement);
  if (!Number.isFinite(numVal) || numVal <= 0) {
    return { available: false, reason: "INVALID_MEASUREMENT" };
  }

  const dataset = WHO_GROWTH_REFERENCE_DATA[indicator]?.[normSex];
  if (!dataset) {
    return { available: false, reason: "REFERENCE_DATA_NOT_FOUND" };
  }

  const lms = interpolateLms(dataset, ageMonths);
  if (!lms) {
    return { available: false, reason: "AGE_OUT_OF_REFERENCE_RANGE" };
  }

  const { L, M, S } = lms;
  if (M <= 0 || S <= 0) {
    return { available: false, reason: "INVALID_LMS_PARAMETERS" };
  }

  let zInd;
  if (Math.abs(L) < 1e-10) {
    zInd = Math.log(numVal / M) / S;
  } else {
    zInd = (Math.pow(numVal / M, L) - 1) / (L * S);
  }

  let finalZ = zInd;

  // Weight-based indicators (BMI-for-age, weight-for-age) use restricted LMS tail handling beyond ±3 SD
  if (indicator === "BMI-for-age" || indicator === "weight-for-age") {
    if (Math.abs(zInd) > 3) {
      const calcCut = (k) => Math.abs(L) < 1e-10
        ? M * Math.exp(S * k)
        : M * Math.pow(1 + L * S * k, 1 / L);

      const sd3pos = calcCut(3);
      const sd2pos = calcCut(2);
      const sd3neg = calcCut(-3);
      const sd2neg = calcCut(-2);

      const sd23pos = sd3pos - sd2pos;
      const sd23neg = sd2neg - sd3neg;

      if (zInd > 3 && sd23pos > 0) {
        finalZ = 3 + (numVal - sd3pos) / sd23pos;
      } else if (zInd < -3 && sd23neg > 0) {
        finalZ = -3 + (numVal - sd3neg) / sd23neg;
      }
    }
  }

  if (!Number.isFinite(finalZ)) {
    return {
      available: false,
      reason: "INVALID_Z_SCORE"
    };
  }

  const roundedZ = Math.round(finalZ * 100) / 100;
  const normalizedZ = roundedZ === 0 ? 0 : roundedZ;

  return {
    available: true,
    zScore: normalizedZ,
    lms
  };
}

/**
 * Returns structured interpretation code for Height-for-age.
 */
export function interpretHeightForAge(zScore) {
  if (zScore < -3) return "VERY_LOW_FOR_AGE";
  if (zScore < -2) return "LOW_FOR_AGE";
  return "REFERENCE_RANGE";
}

/**
 * Returns structured interpretation code for BMI-for-age.
 */
export function interpretBmiForAge(zScore) {
  if (zScore < -3) return "VERY_LOW_BMI_FOR_AGE";
  if (zScore < -2) return "LOW_BMI_FOR_AGE";
  if (zScore <= 1) return "REFERENCE_RANGE";
  if (zScore <= 2) return "HIGH_BMI_FOR_AGE";
  return "VERY_HIGH_BMI_FOR_AGE";
}

/**
 * Returns structured interpretation code for Weight-for-age.
 */
export function interpretWeightForAge(zScore) {
  if (zScore < -3) return "VERY_LOW_FOR_AGE";
  if (zScore < -2) return "LOW_FOR_AGE";
  return "REFERENCE_RANGE";
}

/**
 * Evaluates full WHO 2007 growth reference snapshot for a student given growthSummary.
 */
export function evaluateStudentWhoGrowth({ student, growthSummary }) {
  if (!student?.birthDate) {
    return {
      available: false,
      reason: "MISSING_BIRTH_DATE"
    };
  }

  const normSex = normalizeSex(student?.gender);
  if (!normSex) {
    return {
      available: false,
      reason: "MISSING_OR_INVALID_SEX"
    };
  }

  if (!growthSummary || !growthSummary.hasValidMeasurements) {
    return {
      available: false,
      reason: "INVALID_MEASUREMENT"
    };
  }

  const latestHeight = growthSummary.latestHeight;
  const latestWeight = growthSummary.latestWeight;

  // 1. Height-for-age
  let heightForAge;
  if (latestHeight && latestHeight.heightCm) {
    const ageMonthsExact = calculateExactAgeMonths(student.birthDate, latestHeight.date);
    if (ageMonthsExact === null) {
      heightForAge = { available: false, reason: "INVALID_MEASUREMENT_DATE" };
    } else {
      const zRes = calculateWhoZScore({
        measurement: latestHeight.heightCm,
        ageMonths: ageMonthsExact,
        sex: normSex,
        indicator: "height-for-age"
      });
      if (zRes.available) {
        heightForAge = {
          available: true,
          measurement: latestHeight.heightCm,
          ageMonthsExact: Math.round(ageMonthsExact * 100) / 100,
          zScore: zRes.zScore,
          interpretationCode: interpretHeightForAge(zRes.zScore)
        };
      } else {
        heightForAge = { available: false, reason: zRes.reason };
      }
    }
  } else {
    heightForAge = { available: false, reason: "INVALID_MEASUREMENT" };
  }

  // 2. BMI-for-age
  let bmiForAge;
  if (growthSummary.bmi !== null && growthSummary.bmi !== undefined && growthSummary.bmiDate) {
    const ageMonthsExact = calculateExactAgeMonths(student.birthDate, growthSummary.bmiDate);
    if (ageMonthsExact === null) {
      bmiForAge = { available: false, reason: "INVALID_MEASUREMENT_DATE" };
    } else {
      const zRes = calculateWhoZScore({
        measurement: growthSummary.bmi,
        ageMonths: ageMonthsExact,
        sex: normSex,
        indicator: "BMI-for-age"
      });
      if (zRes.available) {
        bmiForAge = {
          available: true,
          bmi: growthSummary.bmi,
          ageMonthsExact: Math.round(ageMonthsExact * 100) / 100,
          zScore: zRes.zScore,
          interpretationCode: interpretBmiForAge(zRes.zScore)
        };
      } else {
        bmiForAge = { available: false, reason: zRes.reason };
      }
    }
  } else if (growthSummary.bmiReason === "TANGGAL_PENGUKURAN_BERBEDA") {
    bmiForAge = { available: false, reason: "NO_PAIRED_HEIGHT_WEIGHT_MEASUREMENT" };
  } else {
    bmiForAge = { available: false, reason: "NO_PAIRED_HEIGHT_WEIGHT_MEASUREMENT" };
  }

  // 3. Weight-for-age (61 to 120 months)
  let weightForAge;
  if (latestWeight && latestWeight.weightKg) {
    const ageMonthsExact = calculateExactAgeMonths(student.birthDate, latestWeight.date);
    if (ageMonthsExact === null) {
      weightForAge = { available: false, reason: "INVALID_MEASUREMENT_DATE" };
    } else {
      const zRes = calculateWhoZScore({
        measurement: latestWeight.weightKg,
        ageMonths: ageMonthsExact,
        sex: normSex,
        indicator: "weight-for-age"
      });
      if (zRes.available) {
        weightForAge = {
          available: true,
          measurement: latestWeight.weightKg,
          ageMonthsExact: Math.round(ageMonthsExact * 100) / 100,
          zScore: zRes.zScore,
          interpretationCode: interpretWeightForAge(zRes.zScore)
        };
      } else {
        weightForAge = { available: false, reason: zRes.reason };
      }
    }
  } else {
    weightForAge = { available: false, reason: "INVALID_MEASUREMENT" };
  }

  const latestDate = growthSummary.bmiDate || latestHeight?.date || latestWeight?.date || "";
  const exactAgeAtLatest = latestDate ? calculateExactAgeMonths(student.birthDate, latestDate) : null;

  return {
    available: true,
    reference: WHO_GROWTH_REFERENCE_META,
    sex: normSex,
    age: {
      measurementDate: latestDate,
      exactMonths: exactAgeAtLatest !== null ? Math.round(exactAgeAtLatest * 100) / 100 : null
    },
    heightForAge,
    bmiForAge,
    weightForAge
  };
}
