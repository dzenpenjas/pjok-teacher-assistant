import hfaBoys from "../data/growth-reference/who2007/hfa-boys.js";
import hfaGirls from "../data/growth-reference/who2007/hfa-girls.js";
import bfaBoys from "../data/growth-reference/who2007/bfa-boys.js";
import bfaGirls from "../data/growth-reference/who2007/bfa-girls.js";
import wfaBoys from "../data/growth-reference/who2007/wfa-boys.js";
import wfaGirls from "../data/growth-reference/who2007/wfa-girls.js";

/**
 * Standard normal CDF approximation (Abramowitz & Stegun, formula 26.2.17).
 * Maximum error: 7.5e-8.
 */
export function normalCdf(z) {
  if (z < -12) return 0;
  if (z > 12) return 1;
  const absZ = Math.abs(z);
  const t = 1 / (1 + 0.2316419 * absZ);
  const d = 0.3989422804014327; // 1/sqrt(2*PI)
  const p = d *
    Math.exp((-absZ * absZ) / 2) *
    (t *
      (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429)))));
  return z > 0 ? 1 - p : p;
}

/**
 * Compute the z-score from measurement value and LMS parameters.
 * Handles L = 0 safely and applies WHO extrapolation for extreme values beyond ±3 SD.
 */
export function computeZScore(value, lms) {
  const { L, M, S } = lms;
  if (value <= 0 || M <= 0 || S <= 0) return NaN;

  let z;
  if (Math.abs(L) < 1e-10) {
    z = Math.log(value / M) / S;
  } else {
    z = (Math.pow(value / M, L) - 1) / (L * S);
  }

  // WHO extrapolation for extreme values outside ±3 SD
  if (Math.abs(z) > 3) {
    const sdValue = (k) => Math.abs(L) < 1e-10 
      ? M * Math.exp(S * k) 
      : M * Math.pow(1 + L * S * k, 1 / L);

    const sd3pos = sdValue(3);
    const sd2pos = sdValue(2);
    const sd3neg = sdValue(-3);
    const sd2neg = sdValue(-2);

    const sd23pos = sd3pos - sd2pos;
    const sd23neg = sd2neg - sd3neg;

    if (z > 3) {
      z = 3 + (value - sd3pos) / sd23pos;
    } else {
      z = -3 + (value - sd3neg) / sd23neg;
    }
  }

  // Round z-score to 2 decimal places and normalize -0 to 0
  return Math.round(z * 100) / 100 || 0;
}

/**
 * Normalizes sex string to "male" or "female".
 * Returns null if the sex string is invalid or missing.
 */
export function normalizeSex(sex) {
  if (!sex || typeof sex !== "string") return null;
  const s = sex.trim().toLowerCase();
  if (s === "male" || s === "m" || s === "laki-laki" || s === "laki") return "male";
  if (s === "female" || s === "f" || s === "perempuan" || s === "wanita") return "female";
  return null;
}

/**
 * Height-for-age indicator calculation (61 to 228 months)
 */
export function calculateHeightForAge({ sex, ageMonths, heightCm }) {
  const indicator = "height-for-age";
  const normSex = normalizeSex(sex);
  if (!normSex) {
    return { applicable: false, indicator, reason: "SEX_REQUIRED" };
  }

  if (ageMonths == null || isNaN(ageMonths)) {
    return { applicable: false, indicator, reason: "AGE_REQUIRED" };
  }
  const roundedAge = Math.round(ageMonths);
  if (roundedAge < 61 || roundedAge > 228) {
    return { applicable: false, indicator, reason: "AGE_OUT_OF_RANGE" };
  }

  if (heightCm == null || isNaN(heightCm) || heightCm <= 0) {
    return { applicable: false, indicator, reason: "INVALID_MEASUREMENT" };
  }

  const dataPayload = normSex === "male" ? hfaBoys : hfaGirls;
  const lms = dataPayload.data.find(r => r.month === roundedAge);
  if (!lms) {
    return { applicable: false, indicator, reason: "LMS_DATA_NOT_FOUND" };
  }

  const zScore = computeZScore(heightCm, lms);
  let percentile = null;
  if (zScore >= -3 && zScore <= 3) {
    percentile = Math.round(normalCdf(zScore) * 1000) / 10;
  }

  return {
    applicable: true,
    indicator,
    ageMonths: roundedAge,
    sex: normSex,
    value: heightCm,
    zScore,
    percentile,
    source: `${dataPayload.source} (Version: ${dataPayload.version})`
  };
}

/**
 * BMI-for-age indicator calculation (61 to 228 months)
 */
export function calculateBmiForAge({ sex, ageMonths, bmi }) {
  const indicator = "BMI-for-age";
  const normSex = normalizeSex(sex);
  if (!normSex) {
    return { applicable: false, indicator, reason: "SEX_REQUIRED" };
  }

  if (ageMonths == null || isNaN(ageMonths)) {
    return { applicable: false, indicator, reason: "AGE_REQUIRED" };
  }
  const roundedAge = Math.round(ageMonths);
  if (roundedAge < 61 || roundedAge > 228) {
    return { applicable: false, indicator, reason: "AGE_OUT_OF_RANGE" };
  }

  if (bmi == null || isNaN(bmi) || bmi <= 0) {
    return { applicable: false, indicator, reason: "INVALID_MEASUREMENT" };
  }

  const dataPayload = normSex === "male" ? bfaBoys : bfaGirls;
  const lms = dataPayload.data.find(r => r.month === roundedAge);
  if (!lms) {
    return { applicable: false, indicator, reason: "LMS_DATA_NOT_FOUND" };
  }

  const zScore = computeZScore(bmi, lms);
  let percentile = null;
  if (zScore >= -3 && zScore <= 3) {
    percentile = Math.round(normalCdf(zScore) * 1000) / 10;
  }

  return {
    applicable: true,
    indicator,
    ageMonths: roundedAge,
    sex: normSex,
    value: bmi,
    zScore,
    percentile,
    source: `${dataPayload.source} (Version: ${dataPayload.version})`
  };
}

/**
 * Weight-for-age indicator calculation (61 to 120 months)
 */
export function calculateWeightForAge({ sex, ageMonths, weightKg }) {
  const indicator = "weight-for-age";
  const normSex = normalizeSex(sex);
  if (!normSex) {
    return { applicable: false, indicator, reason: "SEX_REQUIRED" };
  }

  if (ageMonths == null || isNaN(ageMonths)) {
    return { applicable: false, indicator, reason: "AGE_REQUIRED" };
  }
  const roundedAge = Math.round(ageMonths);
  if (roundedAge < 61 || roundedAge > 120) {
    return { applicable: false, indicator, reason: "AGE_OUT_OF_RANGE" };
  }

  if (weightKg == null || isNaN(weightKg) || weightKg <= 0) {
    return { applicable: false, indicator, reason: "INVALID_MEASUREMENT" };
  }

  const dataPayload = normSex === "male" ? wfaBoys : wfaGirls;
  const lms = dataPayload.data.find(r => r.month === roundedAge);
  if (!lms) {
    return { applicable: false, indicator, reason: "LMS_DATA_NOT_FOUND" };
  }

  const zScore = computeZScore(weightKg, lms);
  let percentile = null;
  if (zScore >= -3 && zScore <= 3) {
    percentile = Math.round(normalCdf(zScore) * 1000) / 10;
  }

  return {
    applicable: true,
    indicator,
    ageMonths: roundedAge,
    sex: normSex,
    value: weightKg,
    zScore,
    percentile,
    source: `${dataPayload.source} (Version: ${dataPayload.version})`
  };
}

/**
 * Deterministic test fixtures using official WHO Growth Reference values.
 */
export const VERIFICATION_FIXTURES = [
  // 1. Example official fixture: Height-for-age GIRLS ageMonths = 88, height = 122.7098 (Z ~ 0)
  {
    sex: "female",
    ageMonths: 88,
    indicator: "height-for-age",
    value: 122.7098,
    expectedZScore: 0.0,
    expectedPercentile: 50.0
  },
  // 2. Lower age boundary HFA: BOYS month = 61, height = 110.2647 (Z ~ 0)
  {
    sex: "male",
    ageMonths: 61,
    indicator: "height-for-age",
    value: 110.2647,
    expectedZScore: 0.0,
    expectedPercentile: 50.0
  },
  // 3. Upper age boundary HFA: GIRLS month = 228, height = 163.1548 (Z ~ 0)
  {
    sex: "female",
    ageMonths: 228,
    indicator: "height-for-age",
    value: 163.1548,
    expectedZScore: 0.0,
    expectedPercentile: 50.0
  },
  // 4. BFA: BOYS month = 120, BMI = 16.4433 (Z ~ 0)
  {
    sex: "male",
    ageMonths: 120,
    indicator: "BMI-for-age",
    value: 16.4433,
    expectedZScore: 0.0,
    expectedPercentile: 50.0
  },
  // 5. BFA: GIRLS month = 120, BMI = 16.6133 (Z ~ 0)
  {
    sex: "female",
    ageMonths: 120,
    indicator: "BMI-for-age",
    value: 16.6133,
    expectedZScore: 0.0,
    expectedPercentile: 50.0
  },
  // 6. WFA: BOYS month = 120, weight = 31.1586 (Z ~ 0)
  {
    sex: "male",
    ageMonths: 120,
    indicator: "weight-for-age",
    value: 31.1586,
    expectedZScore: 0.0,
    expectedPercentile: 50.0
  },
  // 7. WFA: GIRLS month = 120 (upper age boundary for WFA), weight = 31.8578 (Z ~ 0)
  {
    sex: "female",
    ageMonths: 120,
    indicator: "weight-for-age",
    value: 31.8578,
    expectedZScore: 0.0,
    expectedPercentile: 50.0
  },
  // 8. Out of range: HFA month = 60
  {
    sex: "male",
    ageMonths: 60,
    indicator: "height-for-age",
    value: 110.0,
    expectedApplicable: false,
    expectedReason: "AGE_OUT_OF_RANGE"
  },
  // 9. Out of range: HFA month = 229
  {
    sex: "male",
    ageMonths: 229,
    indicator: "height-for-age",
    value: 170.0,
    expectedApplicable: false,
    expectedReason: "AGE_OUT_OF_RANGE"
  },
  // 10. Out of range: WFA month = 121
  {
    sex: "male",
    ageMonths: 121,
    indicator: "weight-for-age",
    value: 35.0,
    expectedApplicable: false,
    expectedReason: "AGE_OUT_OF_RANGE"
  },
  // 11. Sex invalid behavior
  {
    sex: "invalid",
    ageMonths: 88,
    indicator: "height-for-age",
    value: 120.0,
    expectedApplicable: false,
    expectedReason: "SEX_REQUIRED"
  },
  // 12. Extreme value Z > 3 (Percentile must be null)
  {
    sex: "female",
    ageMonths: 88,
    indicator: "height-for-age",
    value: 180.0,
    expectedZScore: null,
    expectedPercentile: null
  },
  // 13. Extreme value Z < -3 (Percentile must be null)
  {
    sex: "female",
    ageMonths: 88,
    indicator: "height-for-age",
    value: 80.0,
    expectedZScore: null,
    expectedPercentile: null
  }
];

/**
 * Runs all verification fixtures and prints results to console.
 * Returns { allPassed, results }
 */
export function verifyFixtures() {
  const results = [];
  for (const fixture of VERIFICATION_FIXTURES) {
    let result;
    if (fixture.indicator === "height-for-age") {
      result = calculateHeightForAge({
        sex: fixture.sex,
        ageMonths: fixture.ageMonths,
        heightCm: fixture.value
      });
    } else if (fixture.indicator === "BMI-for-age") {
      result = calculateBmiForAge({
        sex: fixture.sex,
        ageMonths: fixture.ageMonths,
        bmi: fixture.value
      });
    } else if (fixture.indicator === "weight-for-age") {
      result = calculateWeightForAge({
        sex: fixture.sex,
        ageMonths: fixture.ageMonths,
        weightKg: fixture.value
      });
    }

    let passed = false;
    if (fixture.expectedApplicable === false) {
      passed = result.applicable === false && result.reason === fixture.expectedReason;
    } else {
      const zPassed = fixture.expectedZScore === null || Math.abs(result.zScore - fixture.expectedZScore) < 0.1;
      let pctPassed = false;
      if (fixture.expectedPercentile === null) {
        pctPassed = result.percentile === null;
      } else {
        pctPassed = result.percentile !== null && Math.abs(result.percentile - fixture.expectedPercentile) < 2.0;
      }
      passed = result.applicable === true && zPassed && pctPassed;
    }

    results.push({
      fixture,
      actual: result,
      passed
    });
  }

  const allPassed = results.every(r => r.passed);
  console.log(`[WHO 2007 Fixture Verification] ${allPassed ? "PASSED" : "FAILED"}: ${results.filter(r => r.passed).length}/${results.length} fixtures passed.`);
  return { allPassed, results };
}
