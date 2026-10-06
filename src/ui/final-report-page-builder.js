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
      if (isScoringConverted && sessionScoring && sessionScoring.canConvert && sessionScoring.convertedScore !== null) {
        displayScore = sessionScoring.convertedScore;
      } else if (!isScoringConverted && matchSource && matchSource.numericScore !== null && matchSource.numericScore !== undefined) {
        displayScore = matchSource.numericScore;
      } else if (matchSource && matchSource.numericScore !== null && matchSource.numericScore !== undefined) {
        displayScore = matchSource.numericScore;
      }

      if (!matchSource) {
        if (item.title || item.description) {
          return {
            assessmentSessionId: item.assessmentSessionId || "",
            title: item.title || "Asesmen PJOK",
            numericScore: item.numericScore !== undefined ? item.numericScore : null,
            displayScore: isScoringConverted ? (sessionScoring?.convertedScore ?? item.numericScore) : (item.numericScore ?? null),
            description: item.description || ""
          };
        }
        return null;
      }
      return {
        assessmentSessionId: matchSource.assessmentSessionId,
        title: matchSource.title,
        numericScore: matchSource.numericScore,
        displayScore,
        description: item.description || ""
      };
    })
    .filter(Boolean);

  let overallScore = null;
  if (isScoringConverted && reportScoring?.overallConvertedScore !== null && reportScoring?.overallConvertedScore !== undefined) {
    overallScore = reportScoring.overallConvertedScore;
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
  const latestGrowthRecord = currentContext.growth?.[0] || null;

  let heightDisplay = "-";
  let weightDisplay = "-";
  let heightDate = "";
  let weightDate = "";
  let growthDateNote = "";

  if (growthSummary) {
    if (growthSummary.latestHeight) {
      heightDisplay = `${growthSummary.latestHeight.heightCm} cm`;
      heightDate = growthSummary.latestHeight.date || "";
    }
    if (growthSummary.latestWeight) {
      weightDisplay = `${growthSummary.latestWeight.weightKg} kg`;
      weightDate = growthSummary.latestWeight.date || "";
    }

    if (heightDate && weightDate && heightDate === weightDate) {
      growthDateNote = `Diukur pada ${heightDate}`;
    } else if (heightDate && weightDate) {
      growthDateNote = `Tinggi badan diukur pada ${heightDate} • Berat badan diukur pada ${weightDate}`;
    } else if (heightDate) {
      growthDateNote = `Tinggi badan diukur pada ${heightDate}`;
    } else if (weightDate) {
      growthDateNote = `Berat badan diukur pada ${weightDate}`;
    } else {
      growthDateNote = `Diukur pada ${formattedToday}`;
    }
  } else if (latestGrowthRecord) {
    heightDisplay = latestGrowthRecord.heightCm && latestGrowthRecord.heightCm !== "-" ? `${latestGrowthRecord.heightCm} cm` : "-";
    weightDisplay = latestGrowthRecord.weightKg && latestGrowthRecord.weightKg !== "-" ? `${latestGrowthRecord.weightKg} kg` : "-";
    growthDateNote = `Diukur pada ${latestGrowthRecord.date || formattedToday}`;
  }

  let studentAgeText = currentContext.studentAgeText || "-";
  if ((!studentAgeText || studentAgeText === "-") && student?.birthDate) {
    const birthYear = new Date(student.birthDate).getFullYear();
    const currentYear = new Date().getFullYear();
    if (!isNaN(birthYear) && birthYear > 1990 && currentYear >= birthYear) {
      studentAgeText = `${currentYear - birthYear} Tahun`;
    }
  }

  const schoolName = school?.name || "SD NEGERI PJOK";
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
    heroNote.textContent = "Nilai dari asesmen yang dipilih guru.";

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
        <th style="width: 14%; text-align: center;">Nilai</th>
        <th style="width: 58%;">Hasil Belajar</th>
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
      const hasScore = item.numericScore !== null && item.numericScore !== undefined;
      const scoreNum = document.createElement("span");
      scoreNum.className = "a4-cell-score-num";
      scoreNum.textContent = hasScore ? String(item.numericScore) : "-";
      scoreBox.append(scoreNum);
      if (hasScore) {
        const scoreDenom = document.createElement("span");
        scoreDenom.className = "a4-cell-score-denom";
        scoreDenom.textContent = "/100";
        scoreBox.append(scoreDenom);
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
    const hVal = finalReportData.growth.heightCm && finalReportData.growth.heightCm !== "-"
      ? `${finalReportData.growth.heightCm} cm`
      : "-";
    
    const hLabel = document.createElement("span");
    hLabel.className = "a4-growth-card-label";
    hLabel.textContent = "TINGGI BADAN";

    const hValue = document.createElement("span");
    hValue.className = "a4-growth-card-value";
    hValue.textContent = hVal;

    hCard.append(hLabel, hValue);

    const wCard = document.createElement("div");
    wCard.className = "a4-growth-card";
    const wVal = finalReportData.growth.weightKg && finalReportData.growth.weightKg !== "-"
      ? `${finalReportData.growth.weightKg} kg`
      : "-";

    const wLabel = document.createElement("span");
    wLabel.className = "a4-growth-card-label";
    wLabel.textContent = "BERAT BADAN";

    const wValue = document.createElement("span");
    wValue.className = "a4-growth-card-value";
    wValue.textContent = wVal;

    wCard.append(wLabel, wValue);

    cardsRow.append(hCard, wCard);
    growthSection.append(cardsRow);

    const dateNote = document.createElement("p");
    dateNote.className = "a4-growth-date-note";
    dateNote.textContent = `Diukur pada ${finalReportData.growth.date}`;
    growthSection.append(dateNote);

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
  const disclaimer = document.createElement("p");
  disclaimer.className = "a4-footer-disclaimer";
  disclaimer.textContent = "Pengukuran ini membantu pemantauan awal dan bukan diagnosis medis.";
  leftFooter.append(disclaimer);

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
