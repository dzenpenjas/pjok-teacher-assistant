import { calculateBmi } from "../data/models.js";

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

export function analyzeGrowth(student, growthSelections = [], allGrowthRecords = []) {
  const studentAllRecords = [...(allGrowthRecords || [])]
    .filter((g) => g.studentId === student?.id)
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  const historyCount = studentAllRecords.length;

  const selectedSorted = [...(growthSelections || [])]
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""));

  if (selectedSorted.length === 0) {
    return {
      latest: null,
      previous: null,
      trend: null,
      historyCount
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

  return {
    latest,
    previous,
    trend,
    historyCount
  };
}
