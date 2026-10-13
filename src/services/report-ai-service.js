/**
 * Service for generating student report drafts using Gemini AI.
 * strictly interprets data from ReportContext without inventing facts.
 */

export async function generateStudentReportWithAI({ apiKey, reportContext, onDiagnosticStage }) {
  if (!apiKey || !apiKey.trim()) {
    const error = new Error("API key is required");
    error.isApiKeyError = true;
    throw error;
  }

  if (!reportContext || typeof reportContext !== "object") {
    throw new Error("Invalid reportContext provided");
  }

  const promptText = `Anda adalah sintesis pakar asesmen PJOK (Pendidikan Jasmani, Olahraga, dan Kesehatan) Sekolah Dasar (SD).
Tugas Anda: Menganalisis bukti asesmen (evidence-based assessment synthesizer) dan menyusun narasi laporan perkembangan siswa yang ramah, objektif, bermakna, dan mudah dipahami orang tua dengan pola komunikasi:
KEKUATAN → YANG MASIH BERKEMBANG → TINDAKAN

Data ReportContext siswa:
${JSON.stringify(reportContext, null, 2)}

PRINSIP SINTESIS & ANALISIS BUKTI ASESMEN:
1. POLA KEMAMPUAN LINTAS ASESMEN (CROSS-ASSESSMENT SYNTHESIS):
   - Periksa setiap asesmen, butir soal (items), rubrik yang dicapai (rubricLevel, rubricLabel, rubricDescription), dan catatan guru autentik (teacherNote pada butir maupun sesi asesmen).
   - Bandingkan capaian lintas modalitas/jenis asesmen (praktik vs lisan, tertulis vs observasi).
   - Kenali pola bermakna:
     * Praktik gerakan kuat tetapi penjelasan lisan/konsep masih berkembang (atau sebaliknya).
     * Mampu menjelaskan teori/konsep tetapi praktik belum konsisten.
     * Pemahaman dan praktik sama-sama konsisten dan matang.
     * Perbedaan capaian antar-butir pada materi yang berkaitan.
   - Bedakan tingkat kemampuan: melakukan (fisik/motorik), mengenali/menyebutkan (lisan), menjelaskan (konsep), dan menerapkan. JANGAN menyamakan semua kemampuan sebagai "memahami".

2. STRUKTUR UTAMA KOMUNIKASI KEPADA ORANG TUA:
   - "strengths" (Anak saya sudah bisa apa?):
     * Menjelaskan kekuatan nyata siswa berdasarkan bukti butir dan asesmen dengan capaian optimal.
     * Bahasa hangat, positif, dan menghargai usaha anak (sekitar 50–70 kata).
   - "developing" (Apa yang masih berkembang?):
     * Menjelaskan aspek gerak, konsep, atau partisipasi yang masih membutuhkan latihan dan waktu untuk berkembang.
     * Tentukan prioritas pembelajaran berikutnya secara jelas tanpa melabeli negatif atau mengecilkan hati anak (sekitar 40–60 kata).
   - "teacherAction" (Apa yang akan dilakukan guru berikutnya?):
     * Rencana tindakan nyata dan bimbingan guru di sekolah untuk mendukung prioritas pembelajaran anak (sekitar 35–50 kata).
   - "parentSupport" (Apa yang bisa dilakukan orang tua?):
     * Rekomendasi dukungan dan aktivitas bermain gerak bersama di rumah yang menargetkan gap/prioritas anak, menyenangkan, dan mudah dilakukan bersama keluarga (sekitar 40–55 kata).

3. ATURAN PERTUMBUHAN & ACUAN WHO 2007 (DETERMINISTIC WHO GROWTH):
   - Gunakan "whoReference" (atau "growthAnalysis.whoReference") pada ReportContext sebagai otoritas rujukan standar WHO 2007 yang telah dihitung secara deterministik.
   - Gunakan "growthSummary" sebagai ringkasan fakta pengukuran fisik terbaru (tinggi, berat, tanggal ukur).
   - DILARANG menghitung ulang z-score atau membuat asumsi standar sendiri.
   - DILARANG menyebut angka z-score teknis kepada orang tua.
   - DILARANG mendiagnosis medis/klinis seperti "stunting", "gizi buruk", "obesitas", "wasting", atau "malnutrisi".
   - Panduan penerjemahan kode WHO:
     * Height-for-age: "REFERENCE_RANGE" (dalam rentang rujukan), "LOW_FOR_AGE" (di bawah rentang rujukan), "VERY_LOW_FOR_AGE" (jauh di bawah rentang rujukan).
     * BMI-for-age: "REFERENCE_RANGE" (dalam rentang rujukan), "LOW_BMI_FOR_AGE" / "VERY_LOW_BMI_FOR_AGE" (di bawah / jauh di bawah rentang rujukan), "HIGH_BMI_FOR_AGE" / "VERY_HIGH_BMI_FOR_AGE" (di atas / jauh di atas rentang rujukan).
     * Weight-for-age: "REFERENCE_RANGE" (dalam rentang rujukan), "LOW_FOR_AGE" / "VERY_LOW_FOR_AGE" (di bawah / jauh di bawah rentang rujukan).
   - Jika data pengukuran tinggi badan dan berat badan berbeda tanggal (latestHeight.date !== latestWeight.date), sebutkan tanggal masing-masing.
   - "growth": Menjelaskan fakta pengukuran fisik terbaru dan acuan WHO 2007 secara objektif dan ramah (sekitar 40–60 kata).
   - "nutritionAdvice": Rekomendasi kebiasaan makan sehat dan pola gizi seimbang yang aman secara umum (sekitar 30–45 kata). Dilarang diet ketat/target angka berat badan.

4. CATATAN GURU PROFESIONAL (BERBASIS BUKTI AUTENTIK YANG SUDAH ADA):
   - Periksa apakah ada catatan guru pada:
     * ReportContext.assessments[].items[].teacherNote
     * ReportContext.assessments[].teacherNote
     * ReportContext.observations[].text
   - Jika ADA bukti catatan guru autentik tersebut:
     * Sintesiskan menjadi "teacherNote" (Catatan Guru profesional) yang personal, hangat, dan konstruktif dari guru PJOK untuk siswa dan orang tua (sekitar 30–45 kata).
   - Jika TIDAK ADA catatan guru autentik sama sekali pada data yang dipilih:
     * Isi "teacherNote" dengan string kosong ("").

5. SELEKSI SECTION:
   - Jika selectedSections.learning === false:
     * "strengths": "", "developing": "", "teacherAction": "", "parentSupport": ""
   - Jika selectedSections.growth === false:
     * "growth": "", "nutritionAdvice": ""

STRUKTUR KELUARAN JSON (HARUS PERSIS FORMAT BERIKUT):
{
  "strengths": "Penjelasan apa yang sudah bisa dilakukan anak (50-70 kata)",
  "developing": "Penjelasan apa yang masih berkembang dan prioritas belajar selanjutnya (40-60 kata)",
  "teacherAction": "Tindakan bimbingan nyata yang akan dilakukan guru berikutnya di sekolah (35-50 kata)",
  "parentSupport": "Dukungan dan aktivitas menyenangkan yang bisa dilakukan orang tua di rumah (40-55 kata)",
  "growth": "Interpretasi objektif pertumbuhan fisik & rujukan WHO 2007 (40-60 kata, atau \\\"\\\" jika selectedSections.growth === false)",
  "nutritionAdvice": "Saran pola makan dan kebiasaan sehat (30-45 kata, atau \\\"\\\" jika selectedSections.growth === false)",
  "teacherNote": "Sintesis catatan guru profesional berbasis bukti autentik (30-45 kata, atau \\\"\\\" jika tidak ada catatan autentik)"
}

KEMBALIKAN HANYA JSON MURNI TANPA TEKS LAINNYA.`;

  const requestBody = {
    contents: [
      {
        role: "user",
        parts: [
          {
            text: promptText
          }
        ]
      }
    ],
    generationConfig: {
      responseMimeType: "application/json"
    }
  };

  const endpoint = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent";

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, 60000);

  if (typeof onDiagnosticStage === "function") {
    onDiagnosticStage("API_REQUEST_START");
    onDiagnosticStage("API_WAITING");
  }

  let response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey.trim()
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });
  } catch (networkErr) {
    if (networkErr.name === "AbortError" || controller.signal.aborted) {
      const timeoutError = new Error("AI request timed out after 60 seconds");
      timeoutError.code = "AI_REQUEST_TIMEOUT";
      throw timeoutError;
    }
    throw new Error(`Network error: ${networkErr.message}`);
  } finally {
    clearTimeout(timeoutId);
  }

  if (typeof onDiagnosticStage === "function") {
    onDiagnosticStage("API_RESPONSE_RECEIVED", { httpStatus: response.status });
  }

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    if (response.status === 404) {
      throw new Error(
        `Model Gemini tidak tersedia untuk API key/project ini. API error (404): ${errorBody}`
      );
    }
    const error = new Error(`API error (${response.status}): ${errorBody}`);
    if (
      response.status === 401 ||
      response.status === 403 ||
      errorBody.includes("API_KEY_INVALID") ||
      errorBody.includes("API key not valid") ||
      errorBody.includes("INVALID_API_KEY")
    ) {
      error.isApiKeyError = true;
    }
    throw error;
  }

  if (typeof onDiagnosticStage === "function") {
    onDiagnosticStage("RESPONSE_PARSING");
  }

  const data = await response.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  function createInvalidAiResponseError(message) {
    const err = new Error(message);
    err.code = "INVALID_AI_RESPONSE";
    return err;
  }

  if (!rawText) {
    throw createInvalidAiResponseError("Respon kosong diterima dari model AI");
  }

  let parsed;
  try {
    let cleaned = rawText.trim();
    if (cleaned.startsWith("```json")) {
      cleaned = cleaned.replace(/^```json\s*/, "").replace(/\s*```$/, "");
    } else if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```\s*/, "").replace(/\s*```$/, "");
    }
    parsed = JSON.parse(cleaned);
  } catch (parseErr) {
    throw createInvalidAiResponseError(`Gagal memproses format respon AI: ${parseErr.message}`);
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw createInvalidAiResponseError("Format respon AI tidak valid: bukan plain object JSON");
  }

  const selectedSections = reportContext.selectedSections || {};
  const isLearningActive = selectedSections.learning !== false;
  const isGrowthActive = selectedSections.growth !== false;

  const strengthsText = typeof parsed.strengths === "string"
    ? parsed.strengths.trim()
    : (typeof parsed.summary === "string" ? parsed.summary.trim() : "");

  const developingText = typeof parsed.developing === "string"
    ? parsed.developing.trim()
    : (typeof parsed.understanding === "string" ? parsed.understanding.trim() : "");

  const teacherActionText = typeof parsed.teacherAction === "string"
    ? parsed.teacherAction.trim()
    : (typeof parsed.followUp === "string" ? parsed.followUp.trim() : "");

  const parentSupportText = typeof parsed.parentSupport === "string"
    ? parsed.parentSupport.trim()
    : (typeof parsed.homeActivity === "string" ? parsed.homeActivity.trim() : "");

  const growthText = isGrowthActive
    ? (typeof parsed.growth === "string" ? parsed.growth.trim() : "")
    : "";

  const nutritionAdviceText = isGrowthActive
    ? (typeof parsed.nutritionAdvice === "string" ? parsed.nutritionAdvice.trim() : "")
    : "";

  const teacherNoteText = typeof parsed.teacherNote === "string"
    ? parsed.teacherNote.trim()
    : (typeof parsed.attitude === "string" ? parsed.attitude.trim() : "");

  if (isLearningActive) {
    if (!strengthsText) {
      throw createInvalidAiResponseError("AI response missing strengths (Anak saya sudah bisa apa)");
    }
    if (!developingText) {
      throw createInvalidAiResponseError("AI response missing developing section (Apa yang masih berkembang)");
    }
    if (!teacherActionText) {
      throw createInvalidAiResponseError("AI response missing teacherAction (Apa yang akan dilakukan guru berikutnya)");
    }
    if (!parentSupportText) {
      throw createInvalidAiResponseError("AI response missing parentSupport (Apa yang bisa dilakukan orang tua)");
    }
  }

  if (isGrowthActive) {
    if (!growthText) {
      throw createInvalidAiResponseError("AI response missing growth section");
    }
    if (!nutritionAdviceText) {
      throw createInvalidAiResponseError("AI response missing nutrition advice");
    }
  }

  return {
    strengths: strengthsText,
    developing: developingText,
    teacherAction: teacherActionText,
    parentSupport: parentSupportText,
    growth: growthText,
    nutritionAdvice: nutritionAdviceText,
    teacherNote: teacherNoteText,

    // Backward compatibility aliases
    summary: strengthsText,
    homeActivity: parentSupportText,
    followUp: teacherActionText,
    understanding: developingText,
    attitude: teacherNoteText,
    learning: []
  };
}
