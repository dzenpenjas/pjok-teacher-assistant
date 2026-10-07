export function formatClassName(name) {
  if (!name) return "Kelas";
  const str = String(name).trim();
  if (str.toLowerCase().startsWith("kelas")) {
    return str;
  }
  return `Kelas ${str}`;
}

/**
 * Reusable A4 Final Report Page Builder
 * Constructs a single A4 DOM node for preview and single/batch PDF generation.
 */
export function createFinalReportPage({
  student,
  classRoom,
  draft,
  reportContext,
  school,
  reportDate
}) {
  const currentContext = reportContext || {};
  const currentDraft = draft || {};

  const isScoringConverted = Boolean(currentContext.reportScoring?.enabled);
  const reportScoring = currentContext.reportScoring || null;

  const validLearningItems = (currentDraft.learning || [])
    .map((item) => {
      const matchSource = (currentContext.assessments || []).find(
        (a) => a.assessmentSessionId === item.assessmentSessionId
      );
      const sessionScoring = reportScoring?.sessions?.[item.assessmentSessionId] || null;
      let displayScore = null;
      let canConvert = true;
      let conversionReason = null;

      if (isScoringConverted) {
        if (sessionScoring && sessionScoring.canConvert && sessionScoring.convertedScore !== null) {
          displayScore = sessionScoring.convertedScore;
        } else {
          displayScore = null;
          canConvert = false;
          conversionReason = sessionScoring?.reason || "Tidak dapat dikonversi";
        }
      } else {
        displayScore = matchSource?.numericScore !== null && matchSource?.numericScore !== undefined
          ? matchSource.numericScore
          : (item.numericScore !== undefined ? item.numericScore : null);
      }

      const title = matchSource?.title || item.title || "Asesmen PJOK";
      const numericScore = matchSource?.numericScore !== undefined ? matchSource.numericScore : (item.numericScore ?? null);

      return {
        assessmentSessionId: item.assessmentSessionId || matchSource?.assessmentSessionId || "",
        title,
        numericScore,
        displayScore,
        canConvert,
        conversionReason,
        description: item.description || ""
      };
    })
    .filter(Boolean);

  let overallScore = null;
  if (reportScoring && reportScoring.overallReportScore !== undefined) {
    overallScore = reportScoring.overallReportScore !== null && Number.isFinite(Number(reportScoring.overallReportScore))
      ? Number(reportScoring.overallReportScore)
      : null;
  } else if (isScoringConverted) {
    overallScore = (reportScoring?.overallConvertedScore !== null && reportScoring?.overallConvertedScore !== undefined && Number.isFinite(Number(reportScoring.overallConvertedScore)))
      ? Number(reportScoring.overallConvertedScore)
      : null;
  } else {
    const scoresWithVal = (currentContext.assessments || [])
      .map((a) => a.numericScore)
      .filter((s) => s !== null && s !== undefined && !isNaN(Number(s)));
    overallScore = scoresWithVal.length > 0
      ? Math.round(scoresWithVal.reduce((acc, curr) => acc + curr, 0) / scoresWithVal.length)
      : null;
  }

  const formattedToday = reportDate || new Date().toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });

  const growthSummary = currentContext.growthSummary || currentContext.growthAnalysis?.growthSummary || null;
  const growthList = Array.isArray(currentContext.growth) ? currentContext.growth : [];

  let latestHeightVal = null;
  let latestHeightDate = "";
  let latestWeightVal = null;
  let latestWeightDate = "";

  if (growthSummary) {
    if (growthSummary.latestHeight && growthSummary.latestHeight.heightCm) {
      latestHeightVal = growthSummary.latestHeight.heightCm;
      latestHeightDate = growthSummary.latestHeight.date || "";
    }
    if (growthSummary.latestWeight && growthSummary.latestWeight.weightKg) {
      latestWeightVal = growthSummary.latestWeight.weightKg;
      latestWeightDate = growthSummary.latestWeight.date || "";
    }
  } else if (growthList.length > 0) {
    for (const g of growthList) {
      if (!latestHeightVal && g && g.heightCm !== null && g.heightCm !== undefined && g.heightCm !== "" && g.heightCm !== "-") {
        const hClean = typeof g.heightCm === "string" ? g.heightCm.replace(/cm/gi, "").trim() : g.heightCm;
        if (!isNaN(Number(hClean)) && Number(hClean) > 0) {
          latestHeightVal = Number(hClean);
          latestHeightDate = g.date || "";
        }
      }
      if (!latestWeightVal && g && g.weightKg !== null && g.weightKg !== undefined && g.weightKg !== "" && g.weightKg !== "-") {
        const wClean = typeof g.weightKg === "string" ? g.weightKg.replace(/kg/gi, "").trim() : g.weightKg;
        if (!isNaN(Number(wClean)) && Number(wClean) > 0) {
          latestWeightVal = Number(wClean);
          latestWeightDate = g.date || "";
        }
      }
    }
  }

  const heightDisplay = latestHeightVal ? `${latestHeightVal} cm` : "-";
  const weightDisplay = latestWeightVal ? `${latestWeightVal} kg` : "-";

  let growthDateNote = "";
  if (latestHeightDate && latestWeightDate && latestHeightDate === latestWeightDate) {
    growthDateNote = `Diukur pada ${latestHeightDate}`;
  } else if (latestHeightDate && latestWeightDate) {
    growthDateNote = `Tinggi badan diukur pada ${latestHeightDate} • Berat badan diukur pada ${latestWeightDate}`;
  } else if (latestHeightDate) {
    growthDateNote = `Tinggi badan diukur pada ${latestHeightDate}`;
  } else if (latestWeightDate) {
    growthDateNote = `Berat badan diukur pada ${latestWeightDate}`;
  } else if (growthList.length > 0 && growthList[0].date) {
    growthDateNote = `Diukur pada ${growthList[0].date}`;
  } else {
    growthDateNote = `Diukur pada ${formattedToday}`;
  }

  let studentAgeText = currentContext.studentAgeText || "-";
  if ((!studentAgeText || studentAgeText === "-") && student?.birthDate) {
    const birthYear = new Date(student.birthDate).getFullYear();
    const currentYear = new Date().getFullYear();
    if (!isNaN(birthYear) && birthYear > 1990 && currentYear >= birthYear) {
      studentAgeText = `${currentYear - birthYear} Tahun`;
    }
  }

  const schoolName = (school?.name && school.name.trim()) || "Nama sekolah belum diatur";
  const schoolAddress = school?.address ? school.address.trim() : "";

  let genderText = "-";
  const rawGender = typeof student?.gender === "string"
    ? student.gender.trim().toLowerCase()
    : (typeof currentContext.student?.gender === "string" ? currentContext.student.gender.trim().toLowerCase() : "");
  if (rawGender === "female") {
    genderText = "Perempuan";
  } else if (rawGender === "male") {
    genderText = "Laki-laki";
  }

  const finalReportData = {
    schoolName,
    schoolAddress,
    studentName: student?.name || "Siswa",
    studentNumber: student?.studentNumber || "-",
    className: classRoom?.name || "",
    studentAge: studentAgeText,
    genderText,
    reportDate: formattedToday,
    overallScore,
    isScoringConverted,
    scoringConfig: reportScoring,

    learning: validLearningItems,
    summary: currentDraft.summary || "",
    understanding: currentDraft.understanding || "",
    attitude: currentDraft.attitude || "",

    growth: {
      date: growthDateNote,
      heightDisplay,
      weightDisplay,
      interpretation: currentDraft.growth || "",
      nutritionAdvice: currentDraft.nutritionAdvice || "",
      followUp: currentDraft.followUp || ""
    },

    homeActivity: currentDraft.homeActivity || ""
  };

  const a4Paper = document.createElement("article");
  a4Paper.className = "a4-document-paper";

  // HEADER
  const headerSection = document.createElement("header");
  headerSection.className = "a4-header";
  
  const schoolNameEl = document.createElement("p");
  schoolNameEl.className = "a4-header-school";
  schoolNameEl.textContent = finalReportData.schoolName;
  headerSection.append(schoolNameEl);

  if (finalReportData.schoolAddress) {
    const schoolAddressEl = document.createElement("p");
    schoolAddressEl.className = "a4-header-location";
    schoolAddressEl.textContent = finalReportData.schoolAddress;
    headerSection.append(schoolAddressEl);
  }

  const docTypeEl = document.createElement("p");
  docTypeEl.className = "a4-doc-type";
  docTypeEl.textContent = "Laporan Belajar dan Pertumbuhan";

  const studentNameEl = document.createElement("h1");
  studentNameEl.className = "a4-student-name";
  studentNameEl.textContent = finalReportData.studentName;

  const metaRowEl = document.createElement("p");
  metaRowEl.className = "a4-meta-row";
  metaRowEl.textContent = `${formatClassName(finalReportData.className)} • Usia ${finalReportData.studentAge} • ${finalReportData.genderText}`;

  const dateRowEl = document.createElement("p");
  dateRowEl.className = "a4-date-row";
  dateRowEl.textContent = `Tanggal laporan: ${finalReportData.reportDate}`;

  headerSection.append(docTypeEl, studentNameEl, metaRowEl, dateRowEl);
  a4Paper.append(headerSection);

  const {
    learning: isLearningActive = true,
    understanding: isUnderstandingActive = true,
    attitude: isAttitudeActive = true,
    growth: isGrowthActive = true
  } = currentContext.selectedSections || {};

  // NILAI PJOK TENGAH SEMESTER HERO (JIKA ADA & LEARNING SELECTION ACTIVE)
  if (isLearningActive && finalReportData.overallScore !== null && finalReportData.overallScore !== undefined) {
    const scoreHero = document.createElement("section");
    scoreHero.className = "a4-score-hero";
    
    const heroLabel = document.createElement("span");
    heroLabel.className = "a4-score-hero-label";
    heroLabel.textContent = "NILAI PJOK TENGAH SEMESTER";

    const heroScoreWrap = document.createElement("div");
    heroScoreWrap.className = "a4-score-hero-num";

    const heroScoreVal = document.createElement("span");
    heroScoreVal.className = "a4-score-hero-val";
    heroScoreVal.textContent = String(finalReportData.overallScore);

    const heroScoreDenom = document.createElement("span");
    heroScoreDenom.className = "a4-score-hero-denom";
    heroScoreDenom.textContent = "/100";

    heroScoreWrap.append(heroScoreVal, heroScoreDenom);

    const heroNote = document.createElement("p");
    heroNote.className = "a4-score-hero-note";
    heroNote.textContent = isScoringConverted
      ? `Nilai Konversi (${reportScoring?.minimum ?? 75}–${reportScoring?.maximum ?? 92}) dari asesmen yang dipilih guru.`
      : "Nilai dari asesmen yang dipilih guru.";

    scoreHero.append(heroLabel, heroScoreWrap, heroNote);
    a4Paper.append(scoreHero);
  }

  // GAMBARAN PERKEMBANGAN (SUMMARY)
  if (finalReportData.summary && finalReportData.summary.trim()) {
    const summarySection = document.createElement("section");
    summarySection.className = "a4-section";

    const title = document.createElement("h2");
    title.className = "a4-section-title";
    title.textContent = "Gambaran Perkembangan";

    const p = document.createElement("p");
    p.className = "a4-section-text text-xs leading-relaxed text-slate-800 dark:text-slate-200";
    p.textContent = finalReportData.summary.trim();

    summarySection.append(title, p);
    a4Paper.append(summarySection);
  }

  // TABEL HASIL BELAJAR
  if (isLearningActive && finalReportData.learning.length > 0) {
    const learningSection = document.createElement("section");
    learningSection.className = "a4-section";

    const title = document.createElement("h2");
    title.className = "a4-section-title";
    title.textContent = `${finalReportData.studentName} sudah bisa apa`;
    learningSection.append(title);

    const table = document.createElement("table");
    table.className = "a4-table";
    const thead = document.createElement("thead");
    thead.innerHTML = `
      <tr>
        <th style="width: 28%;">Yang Dipelajari</th>
        <th style="width: 18%; text-align: center;">${isScoringConverted ? "Nilai Konversi" : "Nilai"}</th>
        <th style="width: 54%;">Hasil Belajar</th>
      </tr>
    `;
    const tbody = document.createElement("tbody");
    finalReportData.learning.forEach((item) => {
      const tr = document.createElement("tr");

      const tdMat = document.createElement("td");
      tdMat.className = "a4-td-mat";
      tdMat.textContent = item.title || "Asesmen PJOK";

      const tdScore = document.createElement("td");
      tdScore.className = "a4-td-score";
      const scoreBox = document.createElement("div");
      scoreBox.className = "a4-cell-score-box";

      if (isScoringConverted) {
        if (item.canConvert && item.displayScore !== null && item.displayScore !== undefined) {
          const scoreNum = document.createElement("span");
          scoreNum.className = "a4-cell-score-num";
          scoreNum.textContent = String(item.displayScore);
          const scoreDenom = document.createElement("span");
          scoreDenom.className = "a4-cell-score-denom";
          scoreDenom.textContent = "/100";
          scoreBox.append(scoreNum, scoreDenom);
        } else {
          const scoreText = document.createElement("span");
          scoreText.className = "a4-cell-score-unconverted text-xs text-subtle italic";
          scoreText.textContent = "Tidak dapat dikonversi";
          scoreBox.append(scoreText);
        }
      } else {
        const hasScore = item.displayScore !== null && item.displayScore !== undefined;
        const scoreNum = document.createElement("span");
        scoreNum.className = "a4-cell-score-num";
        scoreNum.textContent = hasScore ? String(item.displayScore) : "-";
        scoreBox.append(scoreNum);
        if (hasScore) {
          const scoreDenom = document.createElement("span");
          scoreDenom.className = "a4-cell-score-denom";
          scoreDenom.textContent = "/100";
          scoreBox.append(scoreDenom);
        }
      }
      tdScore.append(scoreBox);

      const tdDesc = document.createElement("td");
      tdDesc.className = "a4-td-desc";
      tdDesc.textContent = item.description || "-";

      tr.append(tdMat, tdScore, tdDesc);
      tbody.append(tr);
    });
    table.append(thead, tbody);
    learningSection.append(table);
    a4Paper.append(learningSection);
  }

  // PEMAHAMAN DAN SIKAP
  const showUnderstand = isUnderstandingActive && Boolean(finalReportData.understanding);
  const showAttitude = isAttitudeActive && Boolean(finalReportData.attitude);

  if (showUnderstand) {
    const understandSection = document.createElement("section");
    understandSection.className = "a4-section";

    const title = document.createElement("h2");
    title.className = "a4-section-title";
    title.textContent = "Pemahaman";

    const p = document.createElement("p");
    p.className = "a4-body-text";
    p.textContent = finalReportData.understanding;

    understandSection.append(title, p);
    a4Paper.append(understandSection);
  }

  if (showAttitude) {
    const attitudeSection = document.createElement("section");
    attitudeSection.className = "a4-section";

    const title = document.createElement("h2");
    title.className = "a4-section-title";
    title.textContent = "Sikap & Observasi";

    const p = document.createElement("p");
    p.className = "a4-body-text";
    p.textContent = finalReportData.attitude;

    attitudeSection.append(title, p);
    a4Paper.append(attitudeSection);
  }

  // PERTUMBUHAN & GROWTH INTERPRETATION
  if (isGrowthActive) {
    const growthSection = document.createElement("section");
    growthSection.className = "a4-section";

    const title = document.createElement("h2");
    title.className = "a4-section-title";
    title.textContent = `Bagaimana pertumbuhan ${finalReportData.studentName}`;
    growthSection.append(title);

    const cardsRow = document.createElement("div");
    cardsRow.className = "a4-growth-cards-row";

    const hCard = document.createElement("div");
    hCard.className = "a4-growth-card";
    const hLabel = document.createElement("span");
    hLabel.className = "a4-growth-card-label";
    hLabel.textContent = "TINGGI BADAN";

    const hValue = document.createElement("span");
    hValue.className = "a4-growth-card-value";
    hValue.textContent = finalReportData.growth.heightDisplay || (finalReportData.growth.heightCm ? `${finalReportData.growth.heightCm} cm` : "-");

    hCard.append(hLabel, hValue);

    const wCard = document.createElement("div");
    wCard.className = "a4-growth-card";
    const wLabel = document.createElement("span");
    wLabel.className = "a4-growth-card-label";
    wLabel.textContent = "BERAT BADAN";

    const wValue = document.createElement("span");
    wValue.className = "a4-growth-card-value";
    wValue.textContent = finalReportData.growth.weightDisplay || (finalReportData.growth.weightKg ? `${finalReportData.growth.weightKg} kg` : "-");

    wCard.append(wLabel, wValue);

    cardsRow.append(hCard, wCard);
    growthSection.append(cardsRow);

    const dateNote = document.createElement("p");
    dateNote.className = "a4-growth-date-note";
    dateNote.textContent = finalReportData.growth.date;
    growthSection.append(dateNote);

    const whoRef = currentContext.whoReference || currentContext.growthAnalysis?.whoReference || null;
    if (whoRef && whoRef.available) {
      const codeMap = {
        REFERENCE_RANGE: "Dalam rentang rujukan",
        LOW_FOR_AGE: "Di bawah rentang rujukan",
        VERY_LOW_FOR_AGE: "Jauh di bawah rentang rujukan",
        LOW_BMI_FOR_AGE: "Di bawah rentang rujukan",
        VERY_LOW_BMI_FOR_AGE: "Jauh di bawah rentang rujukan",
        HIGH_BMI_FOR_AGE: "Di atas rentang rujukan",
        VERY_HIGH_BMI_FOR_AGE: "Jauh di atas rentang rujukan"
      };

      const whoItems = [];
      if (whoRef.heightForAge && whoRef.heightForAge.available && whoRef.heightForAge.interpretationCode) {
        const label = codeMap[whoRef.heightForAge.interpretationCode];
        if (label) {
          whoItems.push(`Tinggi menurut usia: ${label}`);
        }
      }
      if (whoRef.bmiForAge && whoRef.bmiForAge.available && whoRef.bmiForAge.interpretationCode) {
        const label = codeMap[whoRef.bmiForAge.interpretationCode];
        if (label) {
          whoItems.push(`BMI menurut usia: ${label}`);
        }
      }
      if (whoRef.weightForAge && whoRef.weightForAge.available && whoRef.weightForAge.interpretationCode) {
        const label = codeMap[whoRef.weightForAge.interpretationCode];
        if (label) {
          whoItems.push(`Berat menurut usia: ${label}`);
        }
      }

      if (whoItems.length > 0) {
        const whoBox = document.createElement("div");
        whoBox.className = "a4-who-summary text-[11px] mb-1.5 p-1.5 bg-slate-50 dark:bg-slate-900/40 rounded border border-slate-200 dark:border-slate-800 leading-tight";
        const whoTitle = document.createElement("p");
        whoTitle.className = "font-semibold text-slate-700 dark:text-slate-300 mb-0.5";
        whoTitle.textContent = "Acuan Pertumbuhan WHO 2007:";
        whoBox.append(whoTitle);

        const whoList = document.createElement("ul");
        whoList.className = "list-disc list-inside space-y-0.5 text-slate-600 dark:text-slate-400";
        whoItems.forEach((text) => {
          const li = document.createElement("li");
          li.textContent = text;
          whoList.append(li);
        });
        whoBox.append(whoList);
        growthSection.append(whoBox);
      }
    }

    if (finalReportData.growth.interpretation) {
      const p = document.createElement("p");
      p.className = "a4-body-text mb-1";
      p.textContent = finalReportData.growth.interpretation;
      growthSection.append(p);
    }

    if (finalReportData.growth.nutritionAdvice) {
      const p = document.createElement("p");
      p.className = "a4-body-text mb-1";
      const strong = document.createElement("strong");
      strong.textContent = "Saran Pola Makan & Kebiasaan Sehat: ";
      p.append(strong, document.createTextNode(finalReportData.growth.nutritionAdvice));
      growthSection.append(p);
    }

    if (finalReportData.growth.followUp) {
      const p = document.createElement("p");
      p.className = "a4-body-text";
      const strong = document.createElement("strong");
      strong.textContent = "Tindak Lanjut Pembelajaran: ";
      p.append(strong, document.createTextNode(finalReportData.growth.followUp));
      growthSection.append(p);
    }

    a4Paper.append(growthSection);
  }

  // AYO BERMAIN BERSAMA DI RUMAH (HOME ACTIVITY)
  if (finalReportData.homeActivity) {
    const homeSection = document.createElement("section");
    homeSection.className = "a4-section";

    const title = document.createElement("h2");
    title.className = "a4-section-title";
    title.textContent = "Ayo bermain bersama di rumah";

    const p = document.createElement("p");
    p.className = "a4-body-text";
    p.textContent = finalReportData.homeActivity;

    homeSection.append(title, p);
    a4Paper.append(homeSection);
  }

  // FOOTER
  const footerSection = document.createElement("footer");
  footerSection.className = "a4-footer-row";

  const leftFooter = document.createElement("div");
  leftFooter.className = "a4-footer-left";

  const refText = document.createElement("p");
  refText.className = "a4-footer-reference text-[9px] text-slate-500 mb-0.5";
  refText.textContent = "Referensi pertumbuhan: WHO Growth Reference 2007, World Health Organization (usia 5–19 tahun).";

  const disclaimer = document.createElement("p");
  disclaimer.className = "a4-footer-disclaimer text-[9px]";
  disclaimer.textContent = "Pengukuran ini membantu pemantauan pertumbuhan dan bukan diagnosis medis.";
  leftFooter.append(refText, disclaimer);

  const rightFooter = document.createElement("div");
  rightFooter.className = "a4-footer-right";
  const signTitle = document.createElement("p");
  signTitle.className = "a4-footer-sign-title";
  signTitle.textContent = "Guru PJOK";
  const signLine = document.createElement("div");
  signLine.className = "a4-footer-sign-line";
  rightFooter.append(signTitle, signLine);

  footerSection.append(leftFooter, rightFooter);
  a4Paper.append(footerSection);

  return a4Paper;
}
