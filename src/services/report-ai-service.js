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
Tugas Anda: Menganalisis bukti asesmen (evidence-based assessment synthesizer) dan menyusun narasi laporan perkembangan siswa yang objektif, ramah, konstruktif, serta bermakna bagi orang tua.

Data ReportContext siswa:
${JSON.stringify(reportContext, null, 2)}

PRINSIP SINTESIS & ANALISIS BUKTI ASESMEN (EVIDENCE-BASED SYNTHESIS RULES):
1. BACA & ANALISIS DETAIL PER BUTIR (ITEM-BY-ITEM EVIDENCE):
   - Periksa setiap asesmen dalam "assessments":
     * assessmentType: "practice" (praktik), "oral" (lisan/diskusi), "written" (tertulis), "observation" (observasi/sikap).
     * materials & title: topik materi/kompetensi.
     * items: perhatikan "prompt" (pertanyaan/instruksi), "rubricLevels" (seluruh level rubrik sesuai rubricScale pada item), "rubricLevel" + "rubricLabel" + "rubricDescription" (capaian siswa), serta "teacherNote".
     * teacherNote keseluruhan asesmen & numericScore.

2. LAKUKAN SINTESIS LINTAS ASESMEN (CROSS-ASSESSMENT SYNTHESIS):
   - Bandingkan hasil antar-asesmen yang materinya/kompetensinya berkaitan.
   - Bandingkan capaian lintas modalitas/jenis asesmen (misal: praktik vs lisan, tertulis vs observasi).
   - Identifikasi pola bermakna:
     * Praktik gerakan kuat tetapi penjelasan lisan/konsep masih berkembang (atau sebaliknya).
     * Mampu menjelaskan teori/konsep tetapi praktik belum konsisten.
     * Pemahaman dan praktik sama-sama kuat dan konsisten.
     * Perbedaan capaian antar-butir pada kompetensi yang sama.
   - Bedakan dengan jelas tingkat kemampuan: melakukan (fisik/motorik), mengenali/menyebutkan (lisan), menjelaskan (konsep), dan menerapkan. JANGAN menyamakan semua kemampuan sebagai "memahami".

3. ATURAN PERTUMBUHAN & ANALISIS DETERMINISTIK (DETAILED DETERMINISTIC GROWTH RULES):
   - Gunakan "growthSummary" (atau "growthAnalysis.growthSummary") pada ReportContext sebagai ringkasan utama hasil pengukuran tinggi badan dan berat badan terbaru beserta tanggalnya masing-masing. Data mentah "growth" tetap menjadi bukti riwayat.
   - Jika tanggal pengukuran tinggi badan dan berat badan berbeda (latestHeight.date !== latestWeight.date), AI WAJIB menyebutkan tanggal pengukuran masing-masing secara terpisah (misal: "Tinggi badan diukur pada [tgl] dan berat badan diukur pada [tgl]").
   - JANGAN menggunakan ringkasan latest lama yang kehilangan salah satu angka sebagai sumber utama.
   - AI DILARANG menghitung BMI sendiri atau mengarang tren jika data tidak lengkap atau tanggal pengukuran berbeda (jika BMI bernilai null atau bmiReason adalah "TANGGAL_PENGUKURAN_BERBEDA", jangan sebutkan angka BMI).
   - DILARANG KERAS:
     * Menghitung ulang standar pertumbuhan atau membuat asumsi standar sendiri.
     * Membuat atau menyebutkan z-score maupun persentil pertumbuhan.
     * Menggunakan kategori BMI dewasa atau memberikan diagnosis status gizi medis/klinis (stunting, gizi kurang, obesitas, gizi buruk).
     * Menilai apakah tinggi, berat, atau BMI siswa normal atau tidak normal secara medis.
   - Posisikan diri Anda sebagai GURU PJOK yang berbicara kepada ORANG TUA: gunakan bahasa yang ramah, sederhana, faktual, tidak menghakimi, dan tidak terdengar seperti diagnosis medis dokter.
   - Hindari istilah teknis yang rumit. Jika menyebutkan BMI (Indeks Massa Tubuh) saat tersedia, jelaskan maknanya secara sangat sederhana (perbandingan tinggi dan berat badan untuk melihat perkembangan fisik anak).

ATURAN BUKTI UMUM:
- Seluruh narasi dan interpretasi harus berdasarkan bukti autentik dalam ReportContext.
- Dilarang mengarang fakta yang tidak tersedia.
- Dilarang menyimpulkan diagnosis medis/psikologis.
- Dilarang memberi label kepribadian seperti "anak kinestetik".
- Dilarang menyimpulkan masalah bahasa, motivasi internal, sifat, atau penyebab perilaku tanpa bukti.
- Gunakan bahasa objektif, santun, suportif.

4. SELEKSI SECTION (Sesuai selectedSections di ReportContext):
   - Jika selectedSections.learning === false: WAJIB "learning": []
   - Jika selectedSections.understanding === false: WAJIB "understanding": ""
   - Jika selectedSections.attitude === false: WAJIB "attitude": ""
   - Jika selectedSections.growth === false: WAJIB "growth": "", "nutritionAdvice": "", "followUp": ""

5. ATURAN SPESIFIK TIAP FIELD JSON:
   - "summary" (INTERPRETASI TERPADU):
     * Merangkum gambaran perkembangan umum dan pola utama hasil sintesis lintas asesmen (sekitar 50–70 kata).
     * BUKAN sekadar daftar nilai/angka.
     * Menjawab: apa yang sudah kuat, apa yang masih berkembang, perbedaan antar-jenis asesmen (misal: praktik vs lisan), dan artinya secara praktis bagi orang tua.
     * Jika hanya ada 1 asesmen, interpretasikan asesmen tersebut secara bermakna tanpa perbandingan palsu.
   - "learning":
     * Array objek { "assessmentSessionId", "description" }.
     * Tepat 1 item per asesmen di context.
     * "description": rangkum capaian berdasarkan butir soal dan rubrik yang dicapai (sekitar 30–50 kata). DILARANG hanya mengulang nilai angka.
   - "understanding":
     * Menjelaskan pola pemahaman konsep berdasarkan bukti butir soal yang menilai mengenali/menyebutkan/menjelaskan. DILARANG menganggap semua praktik fisik sebagai bukti kemampuan menjelaskan konsep (sekitar 35–50 kata).
   - "attitude":
     * Narasi sikap, disiplin, kerja sama, dan sportivitas berdasarkan bukti observasi (sekitar 30–45 kata).
   - "growth":
     * Menjelaskan fakta pengukuran fisik terbaru (usia presisi saat pengukuran, tinggi, berat, BMI) serta perubahan/tren bermakna dibanding sebelumnya secara objektif dan ramah (sekitar 50–70 kata). Contoh: "Pada pengukuran terbaru di usia X, tinggi badan ananda Y cm dan berat badan Z kg, mengalami peningkatan sebesar..." (DILARANG menyebut diagnosis medis).
   - "nutritionAdvice" (Saran Gizi):
     * Berikan rekomendasi kebiasaan pola makan sehat dan gizi seimbang yang aman secara umum (makan beraneka ragam makanan bergizi, minum cukup air putih, istirahat cukup, dan aktivitas fisik aktif). DILARANG menetapkan target berat badan spesifik, diet ketat, kalori spesifik, suplemen, atau obat.
   - "followUp":
     * Rencana bimbingan guru dan pemantauan berkala dari sudut pandang pendidik. Sampaikan pentingnya pemantauan berkala secara rutin: "Pengukuran berkala berikutnya akan membantu melihat pola pertumbuhan Ananda dari waktu ke waktu." DILARANG otomatis merujuk medis/puskesmas hanya berdasarkan angka mentah.
   - "homeActivity":
     * Rekomendasi aktivitas gerak bersama di rumah yang menargetkan GAP/pola yang ditemukan. Contoh: Jika praktik kuat tapi lisan berkembang, sarankan anak melakukan gerakan sambil menyebutkan nama gerakannya. Jika lisan kuat tapi praktik perlu dilatih, sarankan permainan gerak fisik sederhana (sekitar 40–55 kata).

STRUKTUR KELUARAN JSON (HARUS PERSIS FORMAT BERIKUT):
{
  "summary": "Interpretasi terpadu lintas asesmen (50-70 kata)",
  "learning": [
    {
      "assessmentSessionId": "id-asesmen-dari-context",
      "description": "Rangkuman capaian belajar berbasis rubrik item (30-50 kata)"
    }
  ],
  "understanding": "Narasi pemahaman konsep berbasis bukti lisan/tertulis (35-50 kata, atau \"\" jika selectedSections.understanding === false)",
  "attitude": "Narasi sikap & sportivitas berbasis observasi (30-45 kata, atau \"\" jika selectedSections.attitude === false)",
  "growth": "Interpretasi objektif pertumbuhan fisik (50-70 kata, atau \"\" jika selectedSections.growth === false)",
  "homeActivity": "Rekomendasi aktivitas rumah berbasis gap yang ditemukan (40-55 kata)",
  "nutritionAdvice": "Saran gizi sehat (40-60 kata, atau \"\" jika selectedSections.growth === false)",
  "followUp": "Rencana tindak lanjut bimbingan (35-50 kata, atau \"\" jika selectedSections.growth === false)"
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

  // 1. Summary validation
  if (typeof parsed.summary !== "string" || !parsed.summary.trim()) {
    throw createInvalidAiResponseError("AI response missing summary");
  }

  // 2. Home Activity validation
  if (typeof parsed.homeActivity !== "string" || !parsed.homeActivity.trim()) {
    throw createInvalidAiResponseError("AI response missing home activity");
  }

  const selectedSections = reportContext.selectedSections || {};
  const isLearningActive = Boolean(selectedSections.learning);
  const isUnderstandingActive = Boolean(selectedSections.understanding);
  const isAttitudeActive = Boolean(selectedSections.attitude);
  const isGrowthActive = Boolean(selectedSections.growth);

  let sanitizedLearning = [];

  // 3. Learning validation
  if (isLearningActive) {
    if (!Array.isArray(parsed.learning)) {
      throw createInvalidAiResponseError("AI response missing learning array");
    }

    const contextAssessments = Array.isArray(reportContext.assessments) ? reportContext.assessments : [];
    if (contextAssessments.length > 0 && parsed.learning.length === 0) {
      throw createInvalidAiResponseError("AI response learning array is empty");
    }

    for (const assess of contextAssessments) {
      const sessId = assess.assessmentSessionId;
      const matched = parsed.learning.find(
        (item) => item && typeof item === "object" && String(item.assessmentSessionId || "").trim() === String(sessId || "").trim()
      );
      if (!matched) {
        throw createInvalidAiResponseError(`AI response missing learning item for assessment ${sessId}`);
      }
      if (typeof matched.description !== "string" || !matched.description.trim()) {
        throw createInvalidAiResponseError(`AI response missing description for assessment ${sessId}`);
      }
    }

    sanitizedLearning = parsed.learning.map((item) => ({
      assessmentSessionId:
        typeof item?.assessmentSessionId === "string"
          ? item.assessmentSessionId.trim()
          : (item?.assessmentSessionId !== undefined && item?.assessmentSessionId !== null ? String(item.assessmentSessionId).trim() : ""),
      description:
        typeof item?.description === "string"
          ? item.description.trim()
          : ""
    }));
  }

  // 4. Understanding validation
  if (isUnderstandingActive) {
    if (typeof parsed.understanding !== "string" || !parsed.understanding.trim()) {
      throw createInvalidAiResponseError("AI response missing understanding section");
    }
  }

  // 5. Attitude validation
  if (isAttitudeActive) {
    if (typeof parsed.attitude !== "string" || !parsed.attitude.trim()) {
      throw createInvalidAiResponseError("AI response missing attitude section");
    }
  }

  // 6. Growth validation
  if (isGrowthActive) {
    if (typeof parsed.growth !== "string" || !parsed.growth.trim()) {
      throw createInvalidAiResponseError("AI response missing growth section");
    }
    if (typeof parsed.nutritionAdvice !== "string" || !parsed.nutritionAdvice.trim()) {
      throw createInvalidAiResponseError("AI response missing nutrition advice");
    }
    if (typeof parsed.followUp !== "string" || !parsed.followUp.trim()) {
      throw createInvalidAiResponseError("AI response missing follow-up recommendations");
    }
  }

  return {
    summary: parsed.summary.trim(),
    learning: sanitizedLearning,
    understanding: isUnderstandingActive ? parsed.understanding.trim() : "",
    attitude: isAttitudeActive ? parsed.attitude.trim() : "",
    growth: isGrowthActive ? parsed.growth.trim() : "",
    homeActivity: parsed.homeActivity.trim(),
    nutritionAdvice: isGrowthActive ? parsed.nutritionAdvice.trim() : "",
    followUp: isGrowthActive ? parsed.followUp.trim() : ""
  };
}
