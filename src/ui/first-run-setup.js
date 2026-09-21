import { ICONS } from "./icons.js";
import { createField, formToObject } from "./form-controls.js";

function createElement(tagName, className, textContent) {
  const element = document.createElement(tagName);
  if (className) {
    element.className = className;
  }
  if (textContent !== undefined && textContent !== null) {
    element.textContent = textContent;
  }
  return element;
}

export function isAppConfigured(state) {
  if (!state) return false;
  const hasSchool = Array.isArray(state.schools) && state.schools.length > 0 && Boolean(state.schools[0]?.name?.trim());
  const hasTeacher = Array.isArray(state.teachers) && state.teachers.length > 0 && Boolean(state.teachers[0]?.name?.trim());

  const activeYear = state.activeAcademicYearId
    ? (state.academicYears || []).find((y) => y.id === state.activeAcademicYearId)
    : (state.academicYears || []).find((y) => y.isActive);
  const hasYear = Boolean(activeYear && activeYear.name?.trim());

  const activeSemester = state.activeSemesterId
    ? (state.semesters || []).find((s) => s.id === state.activeSemesterId)
    : (state.semesters || []).find((s) => s.isActive);
  const hasSemester = Boolean(activeSemester && activeSemester.name?.trim());

  return Boolean(hasSchool && hasTeacher && hasYear && hasSemester);
}

export function renderFirstRunSetup(state, actions) {
  const screen = createElement("main", "screen wide-screen setup-wizard-screen");

  const container = createElement("div", "setup-card-container");
  
  const header = createElement("header", "setup-header");
  header.append(
    createElement("div", "setup-badge", "🏃 Setup Awal Asisten PJOK"),
    createElement("h1", "setup-title", "Selamat Datang di PJOK Assistant"),
    createElement("p", "setup-copy", "Lengkapi identitas sekolah, guru, dan tahun pelajaran untuk memulai aktivitas pembelajaran di lapangan.")
  );
  container.append(header);

  const form = createElement("form", "master-form setup-form");

  // Step 1: Sekolah
  const schoolSec = createElement("fieldset", "setup-fieldset");
  const sLegend = createElement("legend", "setup-legend");
  sLegend.append(ICONS.home(16), document.createTextNode(" 1. Identitas Sekolah"));
  schoolSec.append(sLegend);
  const school = (state.schools || [])[0] || {};
  schoolSec.append(
    createField({ label: "Nama Sekolah / SD *", name: "schoolName", value: school.name || "", required: true, placeholder: "Misal: SD Negeri 1 Kota" }),
    createField({ label: "Alamat Sekolah", name: "schoolAddress", value: school.address || "", placeholder: "Misal: Jl. Lapangan No. 1" }),
    createField({ label: "Nomor Telepon", name: "schoolPhone", value: school.phone || "", placeholder: "Misal: 021-123456" })
  );
  form.append(schoolSec);

  // Step 2: Guru
  const teacherSec = createElement("fieldset", "setup-fieldset");
  const tLegend = createElement("legend", "setup-legend");
  tLegend.append(ICONS.user(16), document.createTextNode(" 2. Identitas Guru PJOK"));
  teacherSec.append(tLegend);
  const teacher = (state.teachers || [])[0] || {};
  teacherSec.append(
    createField({ label: "Nama Lengkap Guru PJOK *", name: "teacherName", value: teacher.name || "", required: true, placeholder: "Misal: Bapak Dzen S.Pd" }),
    createField({ label: "NIP / NUPTK", name: "employeeNumber", value: teacher.employeeNumber || "", placeholder: "Misal: 198501012010011001" }),
    createField({ label: "Nomor WhatsApp / HP", name: "teacherPhone", value: teacher.phone || "", placeholder: "Misal: 081234567890" })
  );
  form.append(teacherSec);

  // Step 3: Academic Year & Semester
  const academicSec = createElement("fieldset", "setup-fieldset");
  const aLegend = createElement("legend", "setup-legend");
  aLegend.append(ICONS.calendar(16), document.createTextNode(" 3. Tahun Pelajaran & Semester Aktif"));
  academicSec.append(aLegend);

  const activeYear = state.activeAcademicYearId
    ? (state.academicYears || []).find((y) => y.id === state.activeAcademicYearId)
    : (state.academicYears || [])[0] || {};
  
  const activeSemester = state.activeSemesterId
    ? (state.semesters || []).find((s) => s.id === state.activeSemesterId)
    : (state.semesters || [])[0] || {};

  academicSec.append(
    createField({ label: "Tahun Pelajaran *", name: "academicYearName", value: activeYear.name || "2026/2027", required: true }),
    createField({ label: "Semester Aktif *", name: "semesterName", value: activeSemester.name || "Semester 1", required: true })
  );
  form.append(academicSec);

  // Actions
  const btnRow = createElement("div", "setup-actions-row");
  const saveBtn = createElement("button", "primary-action hero-setup-btn", "Simpan & Masuk Beranda");
  saveBtn.type = "submit";

  const demoBtn = createElement("button", "btn-tool text-button demo-setup-btn", "Muat Data Demo PJOK (Untuk Pengujian)");
  demoBtn.type = "button";
  demoBtn.addEventListener("click", () => {
    if (confirm("Muat data demo contoh sekolah, kelas, siswa, dan indikator penilaian PJOK?")) {
      if (actions?.loadDemoData) {
        actions.loadDemoData();
      }
    }
  });

  btnRow.append(saveBtn, demoBtn);
  form.append(btnRow);

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const vals = formToObject(form);
    if (actions?.completeFirstRunSetup) {
      actions.completeFirstRunSetup(vals);
    }
  });

  container.append(form);
  screen.append(container);
  return screen;
}
