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
6. PANDUAN INTERPRETASI PERTUMBUHAN & KESELAMATAN (GROWTH SAFETY):
   - Gunakan data usia, jenis kelamin, tinggi badan (heightCm), dan berat badan (weightKg) untuk menyusun narasi pertumbuhan yang ramah dan menenangkan bagi orang tua.
   - JANGAN PERNAH mendiagnosis penyakit, stunting, obesitas, kekurangan gizi, atau gangguan pertumbuhan secara medis/alarmis hanya dari satu pengukuran.
   - Gunakan frasa ramah seperti "hasil pengukuran menunjukkan...", "berdasarkan acuan pertumbuhan yang digunakan sistem...", "berat/tinggi badan perlu dipantau dan dibantu bertambah secara bertahap...".
   - Jika kondisi membutuhkan perhatian khusus, gunakan saran berkonsultasi yang santun: "Untuk kondisi ini, akan lebih baik Ayah dan Bunda berkonsultasi ke dokter atau Puskesmas untuk mengetahui..."
   - Berikan saran pola makan (nutritionAdvice) yang praktis (makan teratur, buah/sayur, air putih, kurangi minuman manis). DILARANG menyarankan diet ketat, menghitung kalori, atau suplemen/obat.
7. PANDUAN AKTIVITAS DI RUMAH (HOME ACTIVITY):
   - Berikan rekomendasi permainan/aktivitas fisik sederhana dan spesifik yang menyenangkan untuk dilakukan bersama orang tua di rumah.
8. BATASAN PANJANG NARASI (HARUS RINGKAS AGAR MUAT DALAM 1 HALAMAN A4):
   - summary: maksimal ±45 kata
   - description (per asesmen): ±25–45 kata
   - understanding: ±40 kata
   - attitude: ±35 kata
   - growth: ±70 kata
   - nutritionAdvice: ±60 kata
   - followUp: ±45 kata
   - homeActivity: ±45 kata

STRUKTUR KELUARAN JSON (HARUS PERSIS FORMAT BERIKUT):
{
  "summary": "Ringkasan umum perkembangan siswa secara keseluruhan (max 45 kata)",
  "learning": [
    {
      "assessmentSessionId": "id-assessment-session-dari-context",
      "description": "Deskripsi capaian belajar siswa berdasarkan rubrik yang dicapai (25-45 kata)"
    }
  ],
  "understanding": "Narasi mengenai pemahaman konsep gerak dan pengetahuan siswa (max 40 kata)",
  "attitude": "Narasi mengenai sikap, sportivitas, kerja sama, dan keaktifan siswa (max 35 kata)",
  "growth": "Narasi interpretasi pertumbuhan fisik siswa yang ramah bagi orang tua (max 70 kata)",
  "homeActivity": "Rekomendasi permainan/aktivitas fisik bersama di rumah (max 45 kata)",
  "nutritionAdvice": "Saran gizi, pola makan teratur, dan kebiasaan sehat sederhana (max 60 kata)",
  "followUp": "Rencana tindak lanjut bimbingan guru di sekolah (max 45 kata)"
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
