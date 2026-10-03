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
    teacherId: input.teacherId || "",
    status: input.status || "active" // active | archived
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
    color: input.color || "#116149",
    category: input.category || "other", // health, attention, behavior, achievement, special_need, other
    severity: input.severity || "info" // info, warning, critical
  };
}

export function createTeachingSchedule(input = {}) {
  return {
    ...withMeta(input, "sched"),
    dayOfWeek: Number(input.dayOfWeek) || 1, // 1=Senin, 2=Selasa, 3=Rabu, 4=Kamis, 5=Jumat, 6=Sabtu
    startTime: input.startTime || "",
    endTime: input.endTime || "",
    classId: input.classId || "",
    location: input.location || "",
    note: input.note || "",
    active: input.active !== undefined ? Boolean(input.active) : true,
    academicYearId: input.academicYearId || "",
    semesterId: input.semesterId || ""
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

  // Elementary student growth indicator (without adult diagnostic labeling)
  return { bmi, category: "-" };
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
  const method = input.method || "rubric";
  const defaultScale = method === "rubric" ? 5 : 0;
  const rubricScale = input.rubricScale !== undefined ? Number(input.rubricScale) : defaultScale;

  const defaultRubricLevels = [
    {
      level: 1,
      label: "Belum Berkembang",
      desc: "Belum menunjukkan kemampuan yang dinilai dan masih memerlukan bimbingan penuh."
    },
    {
      level: 2,
      label: "Mulai Berkembang",
      desc: "Mulai menunjukkan kemampuan tetapi masih memerlukan banyak arahan atau bantuan."
    },
    {
      level: 3,
      label: "Cukup Berkembang",
      desc: "Mampu menunjukkan kemampuan utama dengan cukup baik, meskipun belum konsisten."
    },
    {
      level: 4,
      label: "Berkembang Baik",
      desc: "Mampu menunjukkan kemampuan dengan baik dan relatif mandiri."
    },
    {
      level: 5,
      label: "Berkembang Sangat Baik",
      desc: "Mampu menunjukkan kemampuan dengan sangat baik, mandiri, dan konsisten."
    }
  ];

  const rubricLevels = Array.isArray(input.rubricLevels)
    ? input.rubricLevels
    : (rubricScale === 0 ? [] : defaultRubricLevels.slice(0, rubricScale));

  let items = [];
  if (Array.isArray(input.items) && input.items.length > 0) {
    items = input.items.map((item) => ({
      id: item.id || createId("assess-item"),
      prompt: item.prompt || "",
      rubricScale: Number(item.rubricScale) || 5,
      rubricLevels: Array.isArray(item.rubricLevels)
        ? item.rubricLevels.map((level) => ({
            level: Number(level.level),
            label: level.label || "",
            desc: level.desc || ""
          }))
        : []
    }));
  } else if (Array.isArray(input.questions) && input.questions.length > 0) {
    items = input.questions.map((question) => ({
      id: createId("assess-item"),
      prompt: question,
      rubricScale: Number(input.rubricScale) || 5,
      rubricLevels: Array.isArray(input.rubricLevels)
        ? input.rubricLevels.map((level) => ({
            level: Number(level.level),
            label: level.label || "",
            desc: level.desc || ""
          }))
        : []
    }));
  }

  return {
    ...withMeta(input, "assess-def"),
    name: input.name || "",
    category: input.category || "keterampilan", // keterampilan, kebugaran, sikap, pengetahuan
    purpose: input.purpose || "formative", // pretest, formative, posttest, midterm, final
    assessmentType: input.assessmentType || "unspecified", // written, oral, practice, observation, unspecified
    method,
    unit: input.unit || "", // detik, cm, kali, poin
    direction: input.direction || "higher_better", // higher_better, lower_better
    rubricScale,
    rubricLevels,
    items,
    materials: Array.isArray(input.materials) ? input.materials : [],
    questions: Array.isArray(input.questions) ? input.questions : [],
    instructions: input.instructions || "",
    description: input.description || ""
  };
}

export function createAssessmentSession(input = {}) {
  const rubricSnapshot = input.rubricSnapshot && typeof input.rubricSnapshot === "object"
    ? {
        scale: Number(input.rubricSnapshot.scale) || 0,
        levels: Array.isArray(input.rubricSnapshot.levels)
          ? input.rubricSnapshot.levels.map((lvl) => ({
              level: lvl.level,
              label: lvl.label,
              desc: lvl.desc
            }))
          : []
      }
    : {
        scale: 0,
        levels: []
      };

  const rawItems = Array.isArray(input.itemsSnapshot)
    ? input.itemsSnapshot
    : (Array.isArray(input.items) ? input.items : []);

  const itemsSnapshot = rawItems.map((item) => ({
    id: item.id || "",
    prompt: item.prompt || "",
    rubricScale: Number(item.rubricScale) || 5,
    rubricLevels: Array.isArray(item.rubricLevels)
      ? item.rubricLevels.map((level) => ({
          level: Number(level.level),
          label: level.label || "",
          desc: level.desc || ""
        }))
      : []
  }));

  return {
    ...withMeta(input, "assess-sess"),
    sessionId: input.sessionId || "",
    definitionId: input.definitionId || "",
    classId: input.classId || "",
    date: input.date || nowIso().slice(0, 10),
    title: input.title || "",
    notes: input.notes || "",
    purpose: input.purpose || "formative", // pretest, formative, posttest, summative, midterm, final
    materials: Array.isArray(input.materials) ? input.materials : [],
    questions: Array.isArray(input.questions) ? input.questions : [],
    instructions: input.instructions || "",
    rubricSnapshot,
    itemsSnapshot
  };
}

export function createAssessmentResult(input = {}) {
  return {
    ...withMeta(input, "result"),
    assessmentSessionId: input.assessmentSessionId || "",
    definitionId: input.definitionId || "",
    sessionId: input.sessionId || "",
    studentId: input.studentId || "",
    value: input.value !== undefined ? input.value : "",
    numericValue: input.numericValue !== undefined && input.numericValue !== null ? Number(input.numericValue) : null,
    formattedValue: input.formattedValue || (input.value ? String(input.value) : "-"),
    rubricLevel: input.rubricLevel ? Number(input.rubricLevel) : null,
    itemResults: Array.isArray(input.itemResults)
      ? input.itemResults.map((item) => ({
          itemId: item.itemId || "",
          rubricLevel:
            item.rubricLevel !== undefined &&
            item.rubricLevel !== null &&
            !Number.isNaN(Number(item.rubricLevel))
              ? Number(item.rubricLevel)
              : null,
          note: item.note || ""
        }))
      : [],
    averageRubricScore:
      input.averageRubricScore !== undefined &&
      input.averageRubricScore !== null &&
      !Number.isNaN(Number(input.averageRubricScore))
        ? Number(input.averageRubricScore)
        : null,
    numericScore:
      input.numericScore !== undefined &&
      input.numericScore !== null &&
      !Number.isNaN(Number(input.numericScore))
        ? Number(input.numericScore)
        : null,
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
