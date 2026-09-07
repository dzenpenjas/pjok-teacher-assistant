export function createId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function nowIso() {
  return new Date().toISOString();
}

function withMeta(entity, prefix) {
  const timestamp = nowIso();
  return {
    id: entity.id || createId(prefix),
    createdAt: entity.createdAt || timestamp,
    updatedAt: timestamp
  };
}

export function createSchool(input = {}) {
  return {
    ...withMeta(input, "school"),
    name: input.name || "",
    address: input.address || "",
    phone: input.phone || ""
  };
}

export function createAcademicYear(input = {}) {
  return {
    ...withMeta(input, "year"),
    name: input.name || "",
    startsAt: input.startsAt || "",
    endsAt: input.endsAt || "",
    isActive: Boolean(input.isActive)
  };
}

export function createSemester(input = {}) {
  return {
    ...withMeta(input, "semester"),
    name: input.name || "",
    academicYearId: input.academicYearId || "",
    isActive: Boolean(input.isActive)
  };
}

export function createTeacher(input = {}) {
  return {
    ...withMeta(input, "teacher"),
    name: input.name || "",
    employeeNumber: input.employeeNumber || "",
    phone: input.phone || "",
    schoolId: input.schoolId || ""
  };
}

export function createClassRoom(input = {}) {
  return {
    ...withMeta(input, "class"),
    name: input.name || "",
    grade: input.grade || "",
    academicYearId: input.academicYearId || "",
    teacherId: input.teacherId || ""
  };
}

export function createStudent(input = {}) {
  return {
    ...withMeta(input, "student"),
    name: input.name || "",
    studentNumber: input.studentNumber || "",
    gender: input.gender || "",
    classId: input.classId || "",
    photo: input.photo || "",
    birthDate: input.birthDate || "",
    heightCm: input.heightCm || "",
    weightKg: input.weightKg || "",
    noteIds: Array.isArray(input.noteIds) ? input.noteIds : [],
    tagIds: Array.isArray(input.tagIds) ? input.tagIds : []
  };
}

export function createStudentNote(input = {}) {
  return {
    ...withMeta(input, "note"),
    studentId: input.studentId || "",
    text: input.text || ""
  };
}

export function createStudentTag(input = {}) {
  return {
    ...withMeta(input, "tag"),
    name: input.name || "",
    color: input.color || "#116149"
  };
}

export function createSession(input = {}) {
  const timestamp = nowIso();
  return {
    ...withMeta(input, "session"),
    sessionNumber: input.sessionNumber || "",
    classId: input.classId || "",
    teacherId: input.teacherId || "",
    academicYearId: input.academicYearId || "",
    semesterId: input.semesterId || "",
    date: input.date || "",
    startTime: input.startTime || "",
    endTime: input.endTime || "",
    topic: input.topic || "",
    material: input.material || "",
    location: input.location || "",
    weather: input.weather || "",
    notes: input.notes || "",
    status: input.status || "planned",
    state: input.state || "NOT_STARTED",
    timeline: Array.isArray(input.timeline)
      ? input.timeline
      : [
          {
            type: "created",
            at: timestamp
          }
        ]
  };
}

export function createAttendanceRecord(input = {}) {
  return {
    ...withMeta(input, "attendance"),
    sessionId: input.sessionId || "",
    studentId: input.studentId || "",
    status: input.status || "present",
    recordedAt: input.recordedAt || nowIso()
  };
}

export function calculateBmi(heightCm, weightKg) {
  const height = parseFloat(heightCm);
  const weight = parseFloat(weightKg);
  if (!height || !weight || height <= 0 || weight <= 0) {
    return { bmi: null, category: "-" };
  }
  const heightM = height / 100;
  const bmiVal = weight / (heightM * heightM);
  const bmi = Math.round(bmiVal * 10) / 10;

  let category = "Normal";
  if (bmi < 17.0) {
    category = "Sangat Kurus";
  } else if (bmi < 18.5) {
    category = "Kurus";
  } else if (bmi <= 25.0) {
    category = "Normal";
  } else if (bmi <= 27.0) {
    category = "Gemuk";
  } else {
    category = "Obesitas";
  }

  return { bmi, category };
}

export function createGrowthRecord(input = {}) {
  const { bmi, category } = calculateBmi(input.heightCm, input.weightKg);
  return {
    ...withMeta(input, "growth"),
    studentId: input.studentId || "",
    date: input.date || nowIso().slice(0, 10),
    heightCm: input.heightCm ? String(input.heightCm) : "",
    weightKg: input.weightKg ? String(input.weightKg) : "",
    bmi: input.bmi || bmi,
    bmiCategory: input.bmiCategory || category,
    note: input.note || ""
  };
}

export function createSessionActivity(input = {}) {
  return {
    ...withMeta(input, "activity"),
    sessionId: input.sessionId || "",
    name: input.name || "",
    type: input.type || "latihan", // pemanasan, materi, latihan, permainan, tes, pendinginan
    durationMinutes: Number(input.durationMinutes) || 10,
    status: input.status || "pending", // pending, active, completed
    startedAt: input.startedAt || null,
    endedAt: input.endedAt || null,
    notes: input.notes || ""
  };
}

export function createAssessmentDefinition(input = {}) {
  return {
    ...withMeta(input, "assess-def"),
    name: input.name || "",
    category: input.category || "Keterampilan", // Keterampilan, Kebugaran Jasmani, Sikap/Perilaku, Pengetahuan
    method: input.method || "numeric", // stopwatch, numeric, rubric
    unit: input.unit || "", // detik, cm, kali, poin
    direction: input.direction || "higher_better", // higher_better, lower_better
    rubricScale: Number(input.rubricScale) || 4,
    rubricLevels: Array.isArray(input.rubricLevels)
      ? input.rubricLevels
      : [
          { level: 1, label: "Perlu Bimbingan", desc: "Belum menguasai teknik dasar" },
          { level: 2, label: "Cukup", desc: "Mulai menguasai dengan bimbingan" },
          { level: 3, label: "Baik", desc: "Menguasai teknik dengan mandiri" },
          { level: 4, label: "Sangat Baik", desc: "Menguasai teknik secara konsisten dan tangkas" }
        ],
    description: input.description || ""
  };
}

export function createAssessmentSession(input = {}) {
  return {
    ...withMeta(input, "assess-sess"),
    sessionId: input.sessionId || "",
    definitionId: input.definitionId || "",
    classId: input.classId || "",
    date: input.date || nowIso().slice(0, 10),
    title: input.title || "",
    notes: input.notes || ""
  };
}

export function createAssessmentResult(input = {}) {
  return {
    ...withMeta(input, "result"),
    assessmentSessionId: input.assessmentSessionId || "",
    sessionId: input.sessionId || "",
    studentId: input.studentId || "",
    value: input.value !== undefined ? input.value : "",
    numericValue: input.numericValue !== undefined && input.numericValue !== null ? Number(input.numericValue) : null,
    formattedValue: input.formattedValue || (input.value ? String(input.value) : "-"),
    rubricLevel: input.rubricLevel ? Number(input.rubricLevel) : null,
    note: input.note || "",
    recordedAt: input.recordedAt || nowIso()
  };
}

export function createStudentObservation(input = {}) {
  return {
    ...withMeta(input, "obs"),
    sessionId: input.sessionId || "",
    studentId: input.studentId || "",
    text: input.text || "",
    type: input.type || "umum", // umum, positif, evaluasi, cedera, potensi
    recordedAt: input.recordedAt || nowIso()
  };
}
