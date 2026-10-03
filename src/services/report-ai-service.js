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

  const promptText = `Anda adalah asisten ahli penyusunan laporan perkembangan siswa PJOK (Pendidikan Jasmani, Olahraga, dan Kesehatan) untuk Sekolah Dasar (SD).
Tugas Anda adalah menginterpretasikan data hasil asesmen, pertumbuhan fisik, dan observasi siswa yang diberikan untuk menyusun draf narasi laporan perkembangan siswa yang ramah, konstruktif, dan mudah dipahami orang tua.

Berikut adalah data ReportContext siswa yang telah dipilih guru:
${JSON.stringify(reportContext, null, 2)}

ATURAN KETAT (CRITICAL RULES):
1. Gunakan HANYA fakta dan data yang terdapat dalam ReportContext di atas.
2. Untuk setiap asesmen yang ada di dalam ReportContext (bagian assessments), kembalikan persis "assessmentSessionId" terkait beserta narasi "description" capaian belajarnya saja.
3. JANGAN menghasilkan atau mengarang "title", "score", "date", atau "materials" pada bagian learning (judul dan nilai akan diambil langsung oleh sistem dari sumber data asli).
4. JANGAN mengarang jawaban siswa, tindakan, atau kejadian yang tidak tercatat dalam rubrik, butir instrumen, riwayat pertumbuhan, atau observasi.
5. JANGAN mengarang kemampuan fisik/kognitif yang tidak didukung oleh deskripsi rubrik atau catatan guru dalam context.
6. Jika salah satu aspek data (misalnya pertumbuhan atau observasi atau asesmen tertentu) kosong atau tidak tersedia di ReportContext, kosongkan bagian terkait (isi dengan string kosong "") atau jelaskan secara singkat dan wajar bahwa belum ada data yang tercatat.
7. Gunakan bahasa Indonesia yang santun, ramah, apresiatif, dan mudah dipahami oleh orang tua murid SD.
8. Hindari istilah teknis yang terlalu klinis atau kaku, namun tetap profesional dan edukatif.
9. Bedakan dengan jelas antara hasil capaian belajar materi, pemahaman konsep, sikap/perilaku, pertumbuhan fisik, aktivitas gerak lanjutan di rumah, saran gizi/makanan sehat, dan tindak lanjut pembelajaran.

STRUKTUR KELUARAN JSON (HARUS PERSIS FORMAT BERIKUT):
{
  "summary": "Ringkasan umum perkembangan siswa secara keseluruhan",
  "learning": [
    {
      "assessmentSessionId": "id-assessment-session-dari-context",
      "description": "Deskripsi capaian belajar siswa berdasarkan butir instrumen dan rubrik yang dicapai"
    }
  ],
  "understanding": "Narasi mengenai pemahaman konsep gerak dan pengetahuan siswa",
  "attitude": "Narasi mengenai sikap, sportivitas, kerja sama, dan keaktifan siswa saat pembelajaran",
  "growth": "Narasi mengenai kondisi fisik, indeks tinggi/berat badan, dan pertumbuhan siswa",
  "homeActivity": "Rekomendasi aktivitas fisik atau latihan gerak sederhana yang menyenangkan bersama orang tua di rumah",
  "nutritionAdvice": "Saran pola makan bergizi, hidrasi, atau kebiasaan sehat pendukung aktivitas fisik",
  "followUp": "Rencana tindak lanjut bimbingan guru di sekolah untuk mengembangkan potensi siswa"
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

  const sanitizedLearning = Array.isArray(parsed.learning)
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
    understanding: typeof parsed.understanding === "string" ? parsed.understanding.trim() : "",
    attitude: typeof parsed.attitude === "string" ? parsed.attitude.trim() : "",
    growth: typeof parsed.growth === "string" ? parsed.growth.trim() : "",
    homeActivity: typeof parsed.homeActivity === "string" ? parsed.homeActivity.trim() : "",
    nutritionAdvice: typeof parsed.nutritionAdvice === "string" ? parsed.nutritionAdvice.trim() : "",
    followUp: typeof parsed.followUp === "string" ? parsed.followUp.trim() : ""
  };
}
