/**
 * Service for generating student report drafts using Gemini AI.
 * strictly interprets data from ReportContext without inventing facts.
 */

export async function generateStudentReportWithAI({ apiKey, reportContext }) {
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

3. ATURAN BUKTI KETAT (EVIDENCE RULE):
   - Seluruh narasi dan interpretasi HARUS berpatokan pada bukti autentik dalam ReportContext.
   - DILARANG KERAS mengarang diagnosis medis/psikologis, label kepribadian (misal: "anak kinestetik", "masalah bahasa"), motivasi internal, atau sifat kepribadian yang tidak ada di data.
   - Gunakan bahasa yang objektif, santun, dan suportif.

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
     * Deskripsi objektif pengukuran fisik (tanggal, tinggi, berat, BMI) tanpa mengarang angka patokan/normal WHO atau diagnosis medis stunting/obesitas (sekitar 50–70 kata).
   - "nutritionAdvice":
     * Edukasi kebiasaan gizi dan pola hidup sehat umum (sekitar 40–60 kata).
   - "followUp":
     * Rencana bimbingan guru dan pemantauan berkala (sekitar 35–50 kata).
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

  let response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey.trim()
      },
      body: JSON.stringify(requestBody)
    });
  } catch (networkErr) {
    throw new Error(`Network error: ${networkErr.message}`);
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

  const data = await response.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!rawText) {
    throw new Error("Respon kosong diterima dari model AI");
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
    throw new Error(`Gagal memproses format respon AI: ${parseErr.message}`);
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Format respon AI tidak valid: bukan object JSON");
  }

  const selectedSections = reportContext.selectedSections || {};
  const isLearningActive = Boolean(selectedSections.learning);
  const isUnderstandingActive = Boolean(selectedSections.understanding);
  const isAttitudeActive = Boolean(selectedSections.attitude);
  const isGrowthActive = Boolean(selectedSections.growth);

  const sanitizedLearning = isLearningActive && Array.isArray(parsed.learning)
    ? parsed.learning.map((item) => ({
        assessmentSessionId:
          typeof item?.assessmentSessionId === "string"
            ? item.assessmentSessionId.trim()
            : "",
        description:
          typeof item?.description === "string"
            ? item.description.trim()
            : ""
      }))
    : [];

  return {
    summary: typeof parsed.summary === "string" ? parsed.summary.trim() : "",
    learning: sanitizedLearning,
    understanding: isUnderstandingActive && typeof parsed.understanding === "string" ? parsed.understanding.trim() : "",
    attitude: isAttitudeActive && typeof parsed.attitude === "string" ? parsed.attitude.trim() : "",
    growth: isGrowthActive && typeof parsed.growth === "string" ? parsed.growth.trim() : "",
    homeActivity: typeof parsed.homeActivity === "string" ? parsed.homeActivity.trim() : "",
    nutritionAdvice: isGrowthActive && typeof parsed.nutritionAdvice === "string" ? parsed.nutritionAdvice.trim() : "",
    followUp: isGrowthActive && typeof parsed.followUp === "string" ? parsed.followUp.trim() : ""
  };
}
