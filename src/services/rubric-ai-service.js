export async function generateRubricWithAI({
  apiKey,
  gradeLevel,
  phase,
  material,
  purpose,
  assessmentType,
  question,
  rubricScale
}) {
  if (!apiKey || !apiKey.trim()) {
    const error = new Error("API key is required");
    error.isApiKeyError = true;
    throw error;
  }

  const scale = Number(rubricScale) || 5;

  const typeGuidance = {
    oral: "Nilai kualitas pemahaman/jawaban lisan siswa.",
    written: "Nilai kualitas pemahaman dan jawaban tertulis siswa.",
    practice: "Nilai kualitas pelaksanaan teknik gerakan, koordinasi, dan keterampilan fisik siswa.",
    observation: "Nilai perilaku, kerja sama, sportivitas, dan kinerja yang dapat diamati secara langsung."
  };

  const specificTypeGuidance = typeGuidance[assessmentType] || typeGuidance.practice;

  const promptText = `Anda adalah asisten ahli penyusunan asesmen PJOK (Pendidikan Jasmani, Olahraga, dan Kesehatan) untuk Sekolah Dasar (SD).
Tugas Anda adalah membuat rubrik penilaian bertingkat untuk satu butir pertanyaan/instrumen asesmen.

Informasi Asesmen:
- Tingkat Kelas: Kelas ${gradeLevel || "-"} (${phase || "Fase tidak diketahui"})
- Materi Pembelajaran: ${material}
- Tujuan Asesmen: ${purpose}
- Bentuk Asesmen: ${assessmentType} (${specificTypeGuidance})
- Butir Pertanyaan / Instrumen: "${question}"
- Jumlah Skala Rubrik: ${scale} level (dari Level 1 hingga Level ${scale})

Aturan Pembuatan Rubrik:
1. Deskripsi rubrik harus spesifik terhadap pertanyaan instrumen yang diajukan.
2. Sesuai dengan perkembangan gerak dan kognitif siswa tingkat ${gradeLevel || "-"} (${phase || "SD"}).
3. Sesuai dengan materi "${material}" dan bentuk asesmen "${assessmentType}".
4. Kriteria penilaian harus observable (dapat diamati secara nyata di lapangan/kelas).
5. Memiliki progresi yang jelas dan terukur dari Level 1 (belum menguasai/sangat dasar) sampai Level ${scale} (sangat mahir/sempurna).
6. Gunakan bahasa Indonesia yang sederhana, jelas, dan baku untuk guru PJOK.
7. Jangan sekadar menulis kata sifat generik seperti "kurang/cukup/baik/sangat baik", tetapi berikan deskripsi indikator perilaku/gerak yang spesifik.
8. Jangan mengubah pertanyaan dan jangan menambah kompetensi yang tidak ditanyakan.
9. Kembalikan TEPAT ${scale} level penilaian, berurutan dari level 1 hingga level ${scale}.

KEMBALIKAN HANYA JSON MURNI DENGAN FORMAT BERIKUT (tanpa markdown atau teks lainnya):
{
  "rubricLevels": [
    {
      "level": 1,
      "label": "Level 1",
      "desc": "deskripsi indikator level 1"
    }
  ]
}`;

  const endpoint = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

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
      responseMimeType: "application/json",
      temperature: 0.2
    }
  };

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
    const error = new Error(`API error (${response.status}): ${errorBody}`);
    if (
      response.status === 400 ||
      response.status === 401 ||
      response.status === 403 ||
      errorBody.includes("API_KEY_INVALID") ||
      errorBody.includes("API key not valid")
    ) {
      error.isApiKeyError = true;
    }
    throw error;
  }

  const data = await response.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!rawText) {
    throw new Error("Empty response received from AI model");
  }

  let parsed;
  try {
    // Sanitize in case of markdown wrapping
    let cleaned = rawText.trim();
    if (cleaned.startsWith("```json")) {
      cleaned = cleaned.replace(/^```json\s*/, "").replace(/\s*```$/, "");
    } else if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```\s*/, "").replace(/\s*```$/, "");
    }
    parsed = JSON.parse(cleaned);
  } catch (parseErr) {
    throw new Error(`Failed to parse AI response as JSON: ${parseErr.message}`);
  }

  if (!parsed || !Array.isArray(parsed.rubricLevels)) {
    throw new Error("Invalid response format: rubricLevels array missing");
  }

  if (parsed.rubricLevels.length !== scale) {
    throw new Error(`Invalid rubricLevels count: expected ${scale}, got ${parsed.rubricLevels.length}`);
  }

  const validatedLevels = [];
  for (let i = 0; i < scale; i++) {
    const expectedLevel = i + 1;
    const item = parsed.rubricLevels[i];
    if (!item) {
      throw new Error(`Missing level ${expectedLevel} in AI response`);
    }
    const levelNum = Number(item.level);
    const desc = (item.desc || "").trim();
    if (!desc) {
      throw new Error(`Empty description for level ${expectedLevel}`);
    }
    validatedLevels.push({
      level: expectedLevel,
      label: item.label || `Level ${expectedLevel}`,
      desc: desc
    });
  }

  return {
    rubricLevels: validatedLevels
  };
}
