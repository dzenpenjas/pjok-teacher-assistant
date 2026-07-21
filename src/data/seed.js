import {
  createAcademicYear,
  createClassRoom,
  createSchool,
  createSemester,
  createStudent,
  createStudentNote,
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
    createStudentTag({ id: "tag-seed-health", name: "Penyakit", color: "#0369a1" }),
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

  return {
    schools: [school],
    academicYears: [academicYear],
    semesters: [semester],
    teachers: [teacher],
    classes: [classA, classB],
    students,
    studentTags: tags,
    studentNotes: notes
  };
}
