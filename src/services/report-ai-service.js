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
     * "numericScore" (0-100) adalah alat bantu interpretasi untuk membandingkan proporsi capaian antar asesmen dengan skala berbeda.
     * JANGAN menghitung ulang "numericScore".
     * JANGAN membuat KKM atau batas kelulusan sendiri.
     * JANGAN menyimpulkan lulus/gagal jika evidence tidak menyatakannya.
     * JANGAN memberi label "baik", "cukup", atau "buruk" hanya berdasarkan angka.
     * Asesmen bertipe "numeric" dengan items=[] tetap merupakan evidence valid.
     * "teacherNote" digunakan sebagai evidence kualitatif untuk menjelaskan kemampuan atau kesulitan spesifik.
     * Jika hanya ada angka tanpa teacherNote/items/deskripsi kompetensi, jangan mengarang kemampuan spesifik.
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

6. ATURAN PERTUMBUHAN & PANDUAN KEBIASAAN SEHAT (GROWTH COMMUNICATION & HEALTHY HABITS):
   - Peran Guru PJOK: Membantu keluarga membangun kebiasaan bergerak dan hidup sehat yang realistis, BUKAN mendiagnosis atau melakukan terapi medis. Narasi "growth" adalah penjelasan utama untuk orang tua.
   - Otoritas Data: Gunakan "whoReference" (atau "growthAnalysis.whoReference") dan "growthSummary" sebagai fakta rujukan standar WHO 2007 yang telah dihitung secara deterministik. DILARANG menghitung ulang z-score atau mengubah hasil WHO.
   - DILARANG menggunakan istilah teknis/klinis kepada orang tua pada output ("growth" dan "nutritionAdvice"):
     * JANGAN gunakan: "BMI", "indeks massa tubuh", "z-score", "SD", "persentil", "obesitas", "overweight", "underweight", "stunting", "wasting", "malnutrisi", "gizi buruk", "gemuk", "kurus sekali", "kelebihan makan", "malas bergerak", "harus diet".
     * Gunakan bahasa ramah dan objektif: "berat badan dibandingkan tinggi dan usianya", "perbandingan berat dan tinggi badan", "tinggi badan dibandingkan usia".

   - ATURAN KETAT REFERENCE_RANGE (RENTANG RUJUKAN):
     * KONDISI NORMAL KESELURUHAN HANYA BOLEH DISIMPULKAN JIKA SEMUA INDIKATOR WHO YANG TERSEDIA BERNILAI "REFERENCE_RANGE".
       Indikator yang harus diperiksa jika tersedia:
       - whoReference.heightForAge.interpretationCode
       - whoReference.bmiForAge.interpretationCode
       - whoReference.weightForAge.interpretationCode
     * Jika SALAH SATU indikator yang tersedia bernilai di luar rentang ("LOW_FOR_AGE", "VERY_LOW_FOR_AGE", "LOW_BMI_FOR_AGE", "VERY_LOW_BMI_FOR_AGE", "HIGH_BMI_FOR_AGE", "VERY_HIGH_BMI_FOR_AGE"):
       DILARANG KERAS menyimpulkan bahwa "Tinggi dan berat badan Ananda berada dalam rentang rujukan WHO" atau "Pertumbuhan Ananda seluruhnya normal".
       AI WAJIB mengikuti dan memprioritaskan kondisi indikator yang berada di luar rentang tersebut.
     * JANGAN OVERCLAIM NORMAL: Jika hanya sebagian indikator yang tersedia (misal hanya tinggi badan), batasi klaim HANYA pada indikator tersebut (contoh: "Tinggi badan Ananda saat ini berada dalam rentang rujukan WHO untuk usianya."), JANGAN menggeneralisasi indikator yang tidak tersedia.

   - PANDUAN PENERJEMAHAN KONDISI & ARAH KOMUNIKASI:
     * KASUS NORMAL LENGKAP (Semua indikator yang tersedia bernilai REFERENCE_RANGE):
       - "growth" (30–50 kata): "Tinggi dan berat badan Ananda saat ini berada dalam rentang rujukan pertumbuhan WHO untuk usianya."
       - "nutritionAdvice" (20–45 kata): Promosi gaya hidup aktif preventif, contoh: "Pertahankan kebiasaan bergerak aktif melalui bermain atau kegiatan olahraga yang disukai Ananda dan dapat dilakukan secara rutin."
     * KASUS DI ATAS RENTANG (HIGH_BMI_FOR_AGE):
       - "growth" (30–50 kata): Jelaskan secara faktual perbandingan berat terhadap tinggi dan usianya, contoh: "Tinggi badan Ananda berada dalam rentang rujukan untuk usianya. Perbandingan berat dan tinggi badannya saat ini berada di atas rentang yang umumnya sesuai." (DILARANG: menyebut "kelebihan berat badan/overweight" atau "harus menurunkan berat badan").
       - "nutritionAdvice" (20–45 kata): Membangun kebiasaan bergerak setiap hari melalui aktivitas yang disukai anak dan dapat dilakukan rutin (bermain aktif, berjalan kaki, bersepeda, olahraga kegemaran), disertai pola makan teratur dan beragam.
     * KASUS JAUH DI ATAS RENTANG (VERY_HIGH_BMI_FOR_AGE):
       - "growth" (30–50 kata): Bahasa serius namun tetap ramah dan tidak menghakimi, contoh: "Perbandingan berat dan tinggi badan Ananda saat ini berada cukup jauh di atas rentang yang umumnya sesuai untuk usianya."
       - "nutritionAdvice" (20–45 kata): Membangun kebiasaan bergerak rutin yang disukai anak, pola makan sehat teratur tanpa diet ketat, serta anjuran ramah berkonsultasi dengan dokter atau puskesmas untuk mendapatkan arahan yang sesuai dengan kebutuhan pertumbuhannya.
     * KASUS DI BAWAH RENTANG (LOW_BMI_FOR_AGE / VERY_LOW_BMI_FOR_AGE):
       - "growth" (30–50 kata): "Berat badan Ananda saat ini berada di bawah (atau cukup jauh di bawah) rentang yang umumnya sesuai dengan tinggi dan usianya."
       - "nutritionAdvice" (20–45 kata): Fokus pada pola makan teratur dan beragam, pemantauan pertumbuhan berkala, dan anjuran ramah berkonsultasi dengan dokter/puskesmas bila berlanjut. JANGAN mendorong peningkatan aktivitas fisik sebagai solusi berat badan rendah.
     * KASUS TINGGI BADAN DI BAWAH RENTANG (LOW_FOR_AGE / VERY_LOW_FOR_AGE):
       - DILARANG menjanjikan olahraga/makanan tertentu akan membuat anak lebih cepat tinggi. Fokus pada pemantauan berkala dan gaya hidup sehat seimbang.
     * KASUS MULTIPEL DI LUAR RENTANG (misal heightForAge = LOW_FOR_AGE & bmiForAge = HIGH_BMI_FOR_AGE):
       - Satukan maknanya secara ringkas tanpa jargon klinis, contoh: "Tinggi badan Ananda saat ini berada di bawah rentang yang umum untuk usianya, sementara perbandingan berat dan tinggi badannya berada di atas rentang rujukan."
     * Data Tidak Lengkap / Tidak Cukup: Sebutkan fakta pengukuran yang tersedia tanpa menebak status. Berikan saran kebiasaan sehat umum secara singkat jika relevan.

   - Prinsip Rekomendasi Aktivitas & Gaya Hidup Sehat:
     * Realistis dan berulang: bermain aktif, berjalan kaki, bersepeda, berenang, senam, permainan bola, atau kegiatan luar ruang. Pilih 2–3 contoh saja yang mudah dilakukan dan disukai anak.
     * Ekstrakurikuler/olahraga terstruktur adalah opsi bila anak menyukainya, BUKAN kewajiban ("Jika Ananda menyukai kegiatan tertentu, mengikuti ekstrakurikuler olahraga dapat menjadi pilihan").
     * DILARANG memberi target berat badan: JANGAN tulis target angka kg, penurunan berat badan, defisit kalori, atau diet ketat. Fokus pada kebiasaan dan konsistensi.
     * Jika tanggal ukur tinggi dan berat berbeda (latestHeight.date !== latestWeight.date), sebutkan tanggal masing-masing.
   - Batas Panjang Output:
     * "growth": 30–50 kata (penjelasan utama kondisi pertumbuhan untuk orang tua).
     * "nutritionAdvice" (makna: Kebiasaan Sehat yang Bisa Dibangun): 20–45 kata (fokus: kebiasaan aktif rutin & pola makan keluarga yang realistis).

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
  "growth": "Interpretasi objektif pertumbuhan fisik & rujukan WHO 2007 dengan bahasa ramah tanpa jargon BMI (30-50 kata, atau \\\"\\\" jika selectedSections.growth === false)",
  "nutritionAdvice": "Kebiasaan sehat yang bisa dibangun keluarga (aktivitas fisik rutin, pola makan teratur) (20-45 kata, atau \\\"\\\" jika selectedSections.growth === false)",
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

  const serializedBody = JSON.stringify(requestBody);
  const requestByteLength = typeof TextEncoder !== "undefined"
    ? new TextEncoder().encode(serializedBody).length
    : serializedBody.length;
  const requestCharLength = serializedBody.length;
  const apiModel = "gemini-3.8-flash";
  const apiEndpoint = "v1beta/models/gemini-3.8-flash:generateContent";

  if (typeof onDiagnosticStage === "function") {
    onDiagnosticStage("API_REQUEST_START", {
      requestBytes: requestByteLength,
      requestChars: requestCharLength,
      apiModel,
      apiEndpoint
    });
    onDiagnosticStage("API_WAITING", {
      requestBytes: requestByteLength,
      requestChars: requestCharLength,
      apiModel,
      apiEndpoint
    });
  }

  let response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey.trim()
      },
      body: serializedBody,
      signal: controller.signal
    });
  } catch (networkErr) {
    if (networkErr.name === "AbortError" || controller.signal.aborted) {
      const timeoutError = new Error("AI request timed out after 60 seconds");
      timeoutError.code = "AI_REQUEST_TIMEOUT";
      timeoutError.apiModel = apiModel;
      timeoutError.apiEndpoint = apiEndpoint;
      timeoutError.requestBytes = requestByteLength;
      timeoutError.requestChars = requestCharLength;
      throw timeoutError;
    }
    const netErr = new Error(`Network error: ${networkErr.message}`);
    netErr.code = "NETWORK_ERROR";
    netErr.apiModel = apiModel;
    netErr.apiEndpoint = apiEndpoint;
    netErr.requestBytes = requestByteLength;
    netErr.requestChars = requestCharLength;
    throw netErr;
  } finally {
    clearTimeout(timeoutId);
  }

  if (typeof onDiagnosticStage === "function") {
    onDiagnosticStage("API_RESPONSE_RECEIVED", {
      httpStatus: response.status,
      apiModel,
      apiEndpoint,
      requestBytes: requestByteLength,
      requestChars: requestCharLength
    });
  }

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    let parsedError = null;
    try {
      parsedError = JSON.parse(errorBody);
    } catch {
      parsedError = null;
    }

    const googleStatus = parsedError?.error?.status || null;
    let googleMessage = parsedError?.error?.message || null;
    if (googleMessage) {
      googleMessage = googleMessage.replace(/AIza[0-9A-Za-z_-]{35}/g, "[REDACTED_API_KEY]");
      googleMessage = googleMessage.replace(/key=[^&\s"'`]+/gi, "key=[REDACTED]");
    }
    const safeFallback = response.status === 400
      ? "Request contains an invalid argument."
      : `HTTP ${response.status} response`;
    const safeDetail = googleMessage ? `${googleStatus ? `[${googleStatus}] ` : ""}${googleMessage}` : safeFallback;

    if (response.status === 404) {
      const notFoundErr = new Error(
        `Model Gemini tidak tersedia untuk API key/project ini. API error (404): ${safeDetail}`
      );
      notFoundErr.httpStatus = 404;
      notFoundErr.status = 404;
      notFoundErr.code = "MODEL_NOT_FOUND";
      notFoundErr.googleStatus = googleStatus || "NOT_FOUND";
      notFoundErr.googleMessage = googleMessage;
      notFoundErr.apiModel = apiModel;
      notFoundErr.apiEndpoint = apiEndpoint;
      notFoundErr.requestBytes = requestByteLength;
      notFoundErr.requestChars = requestCharLength;
      throw notFoundErr;
    }

    const error = new Error(`API error (${response.status}): ${safeDetail}`);
    error.httpStatus = response.status;
    error.status = response.status;
    error.googleStatus = googleStatus;
    error.googleMessage = googleMessage;
    error.apiModel = apiModel;
    error.apiEndpoint = apiEndpoint;
    error.requestBytes = requestByteLength;
    error.requestChars = requestCharLength;

    if (response.status === 400) {
      if (googleStatus === "INVALID_ARGUMENT" || /INVALID_ARGUMENT/i.test(errorBody)) {
        error.code = "INVALID_ARGUMENT";
      } else {
        error.code = "HTTP_400_ERROR";
      }
    } else if (
      response.status === 401 ||
      response.status === 403 ||
      errorBody.includes("API_KEY_INVALID") ||
      errorBody.includes("API key not valid") ||
      errorBody.includes("INVALID_API_KEY")
    ) {
      error.isApiKeyError = true;
      error.code = "AUTH_ERROR";
    } else if (response.status === 429) {
      error.code = "RATE_LIMIT_EXCEEDED";
    } else if (response.status >= 500) {
      error.code = "AI_SERVER_ERROR";
    } else {
      error.code = "AI_REQUEST_ERROR";
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
