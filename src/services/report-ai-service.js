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

2. REKONSILIASI CATATAN GURU VS ASESMEN (EVIDENCE CONFLICT RULE):
   - Catatan guru autentik berasal dari:
     * assessments[].items[].teacherNote
     * assessments[].teacherNote
     * observations[].text
   - Jika teacher note membahas kompetensi yang juga dinilai oleh rubric/assessment:
     * rubric + score = structured evidence utama (authority utama untuk kompetensi yang dinilai).
     * teacherNote = contextual evidence.
   - Aturan rekonsiliasi:
     * Jika konsisten: sintesiskan bersama untuk memperkaya narasi.
     * Jika berbeda/bertentangan:
       - JANGAN diam-diam memilih teacher note sebagai fakta final.
       - JANGAN menghapus structured assessment evidence.
       - JANGAN menulis klaim tegas yang bertentangan dengan rubrik/skor.
       - Gunakan bahasa hati-hati atau abaikan klaim catatan guru yang tidak cukup didukung bukti rubrik.
       - Contoh: Jika rubrik Level 4 atau Level 5 (Baik/Sangat Baik), tetapi catatan guru menulis "belum mampu melakukan gerakan", DILARANG menulis bahwa siswa belum mampu. Gunakan structured assessment sebagai authority utama.

3. ATURAN OBSERVASI PELENGKAP (OBSERVATION COMPLEMENT RULE):
   - Jika catatan guru atau observasi memuat informasi yang TIDAK diukur oleh asesmen terstruktur (contoh: "membantu teman saat kegiatan kelompok", "menunggu giliran", "mau mencoba ulang"):
     * Boleh digunakan sebagai evidence tambahan untuk memperkaya pemahaman konteks belajar anak.
     * JANGAN memaksa semua catatan guru harus memiliki padanan skor/rubrik terstruktur.

4. GUARDRAIL PSIKOLOGIS & LABEL PRIBADI (PSYCHOLOGICAL & TRAIT GUARDRAIL):
   - DILARANG menyimpulkan:
     * motivasi internal,
     * kepribadian,
     * diagnosis psikologis,
     * penyebab perilaku internal,
     * label personal atau tipe belajar.
   - Contoh yang DILARANG:
     * "malas" → "motivasi rendah"
     * "kurang percaya diri" → "memiliki rasa percaya diri rendah"
     * "bandel" → "sulit diatur"
     * "anak kinestetik"
   - Jika evidence berupa catatan observasi perilaku, tulis HANYA perilaku nyata yang terlihat secara faktual. JANGAN jadikan dugaan sebagai fakta psikologis. Contoh yang diizinkan jika relevan: "Pada beberapa kegiatan, Ananda masih memerlukan dorongan untuk terlibat secara konsisten."

5. INTERPRETASI BUKTI NUMERIK (NUMERIC EVIDENCE INTERPRETATION):
   - Jika asesmen bertipe "Nilai Angka" (method: "numeric") dan memiliki bukti numerik:
     * Gunakan "numericValue" (nilai asli) dan "maxValue" (skala maksimal) untuk memahami capaian siswa.
     * "normalizedValue" (0-100) adalah alat bantu interpretasi untuk membandingkan capaian lintas asesmen.
     * JANGAN menyimpulkan bahwa nilai 0-100 adalah nilai raport final.
   - Tetap gunakan konteks catatan guru untuk menafsirkan angka tersebut.

6. STRUKTUR UTAMA KOMUNIKASI KEPADA ORANG TUA (WORD BUDGET SINGKAT & REALISTIS UNTUK A4):
   - "strengths" (Anak saya sudah bisa apa?):
     * Menjelaskan kekuatan nyata siswa berdasarkan bukti butir dan asesmen dengan capaian optimal.
     * Bahasa hangat, positif, dan menghargai usaha anak (25–45 kata).
   - "developing" (Apa yang masih berkembang?):
     * Menjelaskan aspek gerak, konsep, atau partisipasi yang masih membutuhkan latihan dan waktu untuk berkembang.
     * Tentukan prioritas pembelajaran berikutnya secara jelas tanpa melabeli negatif atau mengecilkan hati anak (20–35 kata).
   - "teacherAction" (Apa yang akan dilakukan guru berikutnya?):
     * Rencana tindakan nyata dan bimbingan guru di sekolah untuk mendukung prioritas pembelajaran anak (20–35 kata).
   - "parentSupport" (Apa yang bisa dilakukan orang tua?):
     * Rekomendasi dukungan sederhana yang dapat dilakukan orang tua di rumah sesuai prioritas perkembangan anak (20–35 kata).
     * Boleh berupa: aktivitas gerak, percakapan santai, meminta anak menjelaskan gerakan, memberi kesempatan latihan mandiri, pengulangan sederhana, atau penguatan positif.
     * Aktivitas bermain fisik hanya jika relevan, TIDAK dipaksakan harus selalu berbentuk permainan.

6. ATURAN PERTUMBUHAN & ACUAN WHO 2007 (DETERMINISTIC WHO GROWTH):
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
   - "growth": Menjelaskan fakta pengukuran fisik terbaru dan acuan WHO 2007 secara objektif dan ramah (35–55 kata).
   - "nutritionAdvice" (Saran Pola Makan Sehat - OPTIONAL):
     * HANYA diisi jika ada alasan bermakna dari evidence pertumbuhan untuk memberi saran khusus (20–35 kata).
     * Jika tidak ada alasan bermakna dari evidence pertumbuhan untuk memberi saran khusus: WAJIB isi dengan string kosong ("").
     * JANGAN memunculkan saran pola makan generik untuk semua siswa. Dilarang diet ketat/target angka berat badan.

7. CATATAN GURU PROFESIONAL (DEDUPLIKASI & KOMPLEMENTER):
   - "teacherNote" hanya berisi informasi tambahan yang berguna, personal, dan BELUM cukup terwakili oleh 5 bagian utama (strengths, developing, teacherAction, parentSupport, growth).
   - Jika catatan guru yang ada hanya mengulang hal yang sudah jelas disampaikan di bagian utama: WAJIB isi dengan string kosong ("").
   - Jika TIDAK ADA catatan guru autentik pada data yang dipilih: WAJIB isi dengan string kosong ("").
   - JANGAN membuat catatan guru generik tanpa bukti autentik tambahan (0 atau 20–35 kata).

8. SELEKSI SECTION:
   - Jika selectedSections.learning === false:
     * "strengths": "", "developing": "", "teacherAction": "", "parentSupport": ""
   - Jika selectedSections.growth === false:
     * "growth": "", "nutritionAdvice": ""

STRUKTUR KELUARAN JSON (HARUS PERSIS FORMAT BERIKUT):
{
  "strengths": "Penjelasan apa yang sudah bisa dilakukan anak (25-45 kata)",
  "developing": "Penjelasan apa yang masih berkembang dan prioritas belajar selanjutnya (20-35 kata)",
  "teacherAction": "Tindakan bimbingan nyata yang akan dilakukan guru berikutnya di sekolah (20-35 kata)",
  "parentSupport": "Dukungan orang tua di rumah sesuai prioritas anak (20-35 kata)",
  "growth": "Interpretasi objektif pertumbuhan fisik & rujukan WHO 2007 (35-55 kata, atau \\\"\\\" jika selectedSections.growth === false)",
  "nutritionAdvice": "Saran gizi khusus jika ada alasan bermakna dari data pertumbuhan (20-35 kata), atau \\\"\\\" jika tidak ada kebutuhan khusus atau selectedSections.growth === false",
  "teacherNote": "Informasi pelengkap autentik dari catatan guru yang belum terwakili (20-35 kata), atau \\\"\\\" jika sudah terwakili/tidak ada"
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
