import {
  createAcademicYear,
  createAssessmentDefinition,
  createAssessmentResult,
  createAssessmentSession,
  createAttendanceRecord,
  createClassRoom,
  createGrowthRecord,
  createSchool,
  createSemester,
  createSession,
  createSessionActivity,
  createStudent,
  createStudentNote,
  createStudentObservation,
  createStudentTag,
  createTeacher
} from "./models.js";

export function createSeedData() {
  const school = createSchool({
    id: "school-seed-1",
    name: "SD Negeri Harapan",
    address: "Jl. Lapangan Sehat No. 1",
    phone: "021-000000"
  });

  const teacher = createTeacher({
    id: "teacher-seed-1",
    name: "Bapak Dzen",
    employeeNumber: "PJOK-001",
    phone: "081234567890",
    schoolId: school.id
  });

  const academicYear = createAcademicYear({
    id: "year-seed-1",
    name: "2026/2027",
    startsAt: "2026-07-01",
    endsAt: "2027-06-30",
    isActive: true
  });

  const semester = createSemester({
    id: "semester-seed-1",
    name: "Semester 1",
    academicYearId: academicYear.id,
    isActive: true
  });

  const classA = createClassRoom({
    id: "class-seed-5a",
    name: "Kelas 5A",
    grade: "5",
    academicYearId: academicYear.id,
    teacherId: teacher.id
  });

  const classB = createClassRoom({
    id: "class-seed-5b",
    name: "Kelas 5B",
    grade: "5",
    academicYearId: academicYear.id,
    teacherId: teacher.id
  });

  const tags = [
    createStudentTag({ id: "tag-seed-talented", name: "Berbakat", color: "#0f766e" }),
    createStudentTag({ id: "tag-seed-attention", name: "Perlu Perhatian", color: "#b45309" }),
    createStudentTag({ id: "tag-seed-special", name: "Berkebutuhan Khusus", color: "#6d28d9" }),
    createStudentTag({ id: "tag-seed-injury", name: "Cedera", color: "#b91c1c" }),
    createStudentTag({ id: "tag-seed-health", name: "Penyakit Asma", color: "#0369a1" }),
    createStudentTag({ id: "tag-seed-o2sn", name: "O2SN", color: "#15803d" })
  ];

  const students = [
    createStudent({
      id: "student-seed-1",
      name: "Ahmad Fauzan",
      studentNumber: "25001",
      gender: "L",
      classId: classA.id,
      birthDate: "2015-03-12",
      heightCm: "142",
      weightKg: "36",
      tagIds: ["tag-seed-talented", "tag-seed-o2sn"],
      noteIds: ["note-seed-1"]
    }),
    createStudent({
      id: "student-seed-2",
      name: "Siti Aisyah",
      studentNumber: "25002",
      gender: "P",
      classId: classA.id,
      birthDate: "2015-06-20",
      heightCm: "139",
      weightKg: "34",
      tagIds: ["tag-seed-attention"],
      noteIds: ["note-seed-2"]
    }),
    createStudent({
      id: "student-seed-3",
      name: "Bima Pratama",
      studentNumber: "25003",
      gender: "L",
      classId: classA.id,
      birthDate: "2015-01-08",
      heightCm: "145",
      weightKg: "38"
    }),
    createStudent({
      id: "student-seed-4",
      name: "Nadia Putri",
      studentNumber: "25004",
      gender: "P",
      classId: classB.id,
      birthDate: "2015-09-14",
      heightCm: "140",
      weightKg: "33",
      tagIds: ["tag-seed-health"]
    }),
    createStudent({
      id: "student-seed-5",
      name: "Raka Wijaya",
      studentNumber: "25005",
      gender: "L",
      classId: classB.id,
      birthDate: "2015-11-03",
      heightCm: "143",
      weightKg: "37",
      tagIds: ["tag-seed-injury"]
    })
  ];

  const notes = [
    createStudentNote({
      id: "note-seed-1",
      studentId: "student-seed-1",
      text: "Kecepatan sprint menonjol saat latihan."
    }),
    createStudentNote({
      id: "note-seed-2",
      studentId: "student-seed-2",
      text: "Perlu pendampingan saat aktivitas berkelompok."
    })
  ];

  // Assessment Definitions for PJOK
  const assessmentDefinitions = [
    createAssessmentDefinition({
      id: "def-seed-sprint",
      name: "Lari Sprint 40 Meter",
      category: "Keterampilan",
      method: "stopwatch",
      unit: "detik",
      direction: "lower_better",
      description: "Pengukuran kecepatan lari akselerasi 40 meter menggunakan stopwatch."
    }),
    createAssessmentDefinition({
      id: "def-seed-longjump",
      name: "Lompat Jauh Tanpa Awalan",
      category: "Keterampilan",
      method: "numeric",
      unit: "cm",
      direction: "higher_better",
      description: "Pengukuran kekuatan dan daya ledak otot tungkai (standing broad jump)."
    }),
    createAssessmentDefinition({
      id: "def-seed-pushup",
      name: "Push-Up 30 Detik",
      category: "Kebugaran Jasmani",
      method: "numeric",
      unit: "kali",
      direction: "higher_better",
      description: "Pengukuran daya tahan dan kekuatan otot tubuh bagian atas."
    }),
    createAssessmentDefinition({
      id: "def-seed-rubric-movement",
      name: "Gerak Nonlokomotor & Keseimbangan",
      category: "Keterampilan",
      method: "rubric",
      unit: "skala",
      direction: "higher_better",
      rubricScale: 4,
      rubricLevels: [
        { level: 1, label: "Perlu Bimbingan", desc: "Gerakan kaku, belum seimbang, butuh arahan terus-menerus." },
        { level: 2, label: "Cukup", desc: "Mampu melakukan namun sesekali kehilangan tumpuan." },
        { level: 3, label: "Baik", desc: "Gerakan luwes, postur tegak, dan seimbang secara mandiri." },
        { level: 4, label: "Sangat Baik", desc: "Penguasaan sempurna, tangkas, stabil, dan percaya diri." }
      ],
      description: "Rubrik observasi teknik menekuk, meliuk, dan keseimbangan statis satu kaki."
    })
  ];

  // Historical Growth Records showing development over time
  const growthRecords = [
    // Ahmad
    createGrowthRecord({
      id: "growth-seed-1a",
      studentId: "student-seed-1",
      date: "2026-01-12",
      heightCm: "138",
      weightKg: "34",
      note: "Pengukuran awal semester 2"
    }),
    createGrowthRecord({
      id: "growth-seed-1b",
      studentId: "student-seed-1",
      date: "2026-07-15",
      heightCm: "142",
      weightKg: "36",
      note: "Pengukuran awal tahun ajaran baru"
    }),
    // Siti
    createGrowthRecord({
      id: "growth-seed-2a",
      studentId: "student-seed-2",
      date: "2026-01-12",
      heightCm: "136",
      weightKg: "32",
      note: "Pengukuran awal semester 2"
    }),
    createGrowthRecord({
      id: "growth-seed-2b",
      studentId: "student-seed-2",
      date: "2026-07-15",
      heightCm: "139",
      weightKg: "34",
      note: "Pengukuran awal tahun ajaran baru"
    }),
    // Bima
    createGrowthRecord({
      id: "growth-seed-3a",
      studentId: "student-seed-3",
      date: "2026-07-15",
      heightCm: "145",
      weightKg: "38",
      note: "Pengukuran tahun ajaran baru"
    })
  ];

  // Sample Sessions: 1 active ready-to-teach session for Class 5A
  const today = new Date().toISOString().slice(0, 10);
  const activeSession = createSession({
    id: "session-seed-active",
    sessionNumber: "2",
    classId: classA.id,
    teacherId: teacher.id,
    academicYearId: academicYear.id,
    semesterId: semester.id,
    date: today,
    startTime: "07:30",
    endTime: "",
    topic: "Atletik Dasar: Lari Cepat & Reaksi",
    material: "Start jongkok, akselerasi sprint 40 meter, dan koordinasi langkah",
    location: "Lapangan Rumput Utama",
    weather: "Cerah berawan (pagi)",
    notes: "Siapkan 4 cone kerucut dan 2 stopwatch lapangan.",
    status: "active",
    state: "ACTIVE"
  });

  // Activities for the active session
  const sessionActivities = [
    createSessionActivity({
      id: "act-seed-1",
      sessionId: activeSession.id,
      name: "Pemanasan & Peregangan Dinamis",
      type: "pemanasan",
      durationMinutes: 10,
      status: "completed",
      notes: "Jogging keliling lapangan 2 putaran + peregangan sendi tungkai."
    }),
    createSessionActivity({
      id: "act-seed-2",
      sessionId: activeSession.id,
      name: "Latihan Start Jongkok & Reaksi",
      type: "materi",
      durationMinutes: 15,
      status: "active",
      notes: "Aba-aba 'Bersedia', 'Siap', 'Ya'. Fokus tolakan kaki depan."
    }),
    createSessionActivity({
      id: "act-seed-3",
      sessionId: activeSession.id,
      name: "Pengambilan Waktu Sprint 40 Meter",
      type: "tes",
      durationMinutes: 20,
      status: "pending",
      notes: "Menggunakan stopwatch lapangan, 2 kali percobaan per siswa."
    }),
    createSessionActivity({
      id: "act-seed-4",
      sessionId: activeSession.id,
      name: "Permainan Reaksi Hijau-Hitam",
      type: "permainan",
      durationMinutes: 10,
      status: "pending",
      notes: "Melatih ketangkasan dan sportivitas siswa."
    }),
    createSessionActivity({
      id: "act-seed-5",
      sessionId: activeSession.id,
      name: "Pendinginan & Refleksi Belajar",
      type: "pendinginan",
      durationMinutes: 5,
      status: "pending",
      notes: "Pelemasan otot, minum air putih, dan evaluasi hasil latihan."
    })
  ];

  // Attendance for active session
  const attendanceRecords = [
    createAttendanceRecord({
      id: "att-seed-1",
      sessionId: activeSession.id,
      studentId: "student-seed-1",
      status: "present"
    }),
    createAttendanceRecord({
      id: "att-seed-2",
      sessionId: activeSession.id,
      studentId: "student-seed-2",
      status: "present"
    }),
    createAttendanceRecord({
      id: "att-seed-3",
      sessionId: activeSession.id,
      studentId: "student-seed-3",
      status: "present"
    })
  ];

  // Assessment Session for active session (Sprint 40m)
  const assessmentSession = createAssessmentSession({
    id: "as-seed-1",
    sessionId: activeSession.id,
    definitionId: "def-seed-sprint",
    classId: classA.id,
    date: today,
    title: "Penilaian Sprint 40M Kelas 5A"
  });

  // Sample results
  const assessmentResults = [
    createAssessmentResult({
      id: "res-seed-1",
      assessmentSessionId: assessmentSession.id,
      sessionId: activeSession.id,
      studentId: "student-seed-1",
      value: "7.82",
      numericValue: 7.82,
      formattedValue: "7.82 detik",
      note: "Akselerasi sangat cepat, start mantap"
    }),
    createAssessmentResult({
      id: "res-seed-2",
      assessmentSessionId: assessmentSession.id,
      sessionId: activeSession.id,
      studentId: "student-seed-2",
      value: "8.95",
      numericValue: 8.95,
      formattedValue: "8.95 detik",
      note: "Perlu perbaikan ayunan lengan saat sprint"
    })
  ];

  const studentObservations = [
    createStudentObservation({
      id: "obs-seed-1",
      sessionId: activeSession.id,
      studentId: "student-seed-1",
      text: "Fauzan menunjukkan bakat atletik luar biasa, cocok dipersiapkan untuk seleksi O2SN.",
      type: "potensi"
    })
  ];

  return {
    schools: [school],
    academicYears: [academicYear],
    semesters: [semester],
    teachers: [teacher],
    classes: [classA, classB],
    students,
    studentTags: tags,
    studentNotes: notes,
    assessmentDefinitions,
    growthRecords,
    sessions: [activeSession],
    sessionActivities,
    attendanceRecords,
    assessmentSessions: [assessmentSession],
    assessmentResults,
    studentObservations
  };
}
