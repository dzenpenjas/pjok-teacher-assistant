import { createField, createSelectField, formToObject } from "./form-controls.js";
import { ICONS } from "./icons.js";

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

const SETTINGS_TABS = [
  { id: "school-teacher", label: "Profil Sekolah & Guru", icon: () => ICONS.home(16) },
  { id: "academic", label: "Tahun & Semester", icon: () => ICONS.calendar(16) },
  { id: "tags", label: "Tag Siswa", icon: () => ICONS.tag(16) },
  { id: "assessments", label: "Definisi Nilai", icon: () => ICONS.chart(16) },
  { id: "backup", label: "Cadangan Data", icon: () => ICONS.database(16) }
];

export function renderSettingsScreen(state, actions) {
  const screen = createElement("main", "screen wide-screen settings-hub-screen");

  let activeTab = "school-teacher";

  const container = createElement("div", "settings-hub-container");
  screen.append(container);

  function render() {
    container.replaceChildren();

    // 1. Header
    const header = createElement("header", "screen-header-row");
    const titleGroup = createElement("div");
    const eyebrow = createElement("p", "eyebrow");
    eyebrow.append(ICONS.settings(15), document.createTextNode(" Pengaturan & Master Data"));
    titleGroup.append(eyebrow, createElement("h1", "screen-title", "Pengaturan"));
    titleGroup.append(
      createElement(
        "p",
        "screen-copy",
        "Kelola profil sekolah & guru, tahun ajaran, tag kondisi siswa, indikator penilaian, dan cadangan data offline."
      )
    );
    header.append(titleGroup);
    container.append(header);

    // 2. Tab switcher
    const tabRow = createElement("div", "settings-nav-tabs");
    SETTINGS_TABS.forEach((tab) => {
      const btn = createElement(
        "button",
        `settings-tab-btn ${activeTab === tab.id ? "is-active" : ""}`
      );
      btn.type = "button";
      btn.append(tab.icon(), document.createTextNode(` ${tab.label}`));
      btn.addEventListener("click", () => {
        activeTab = tab.id;
        render();
      });
      tabRow.append(btn);
    });
    container.append(tabRow);

    // 3. Tab Content
    const contentBox = createElement("div", "settings-content-box");
    container.append(contentBox);

    if (activeTab === "school-teacher") {
      renderSchoolAndTeacherSection(contentBox);
    } else if (activeTab === "academic") {
      renderAcademicSection(contentBox);
    } else if (activeTab === "tags") {
      renderTagsSection(contentBox);
    } else if (activeTab === "assessments") {
      renderAssessmentsSection(contentBox);
    } else if (activeTab === "backup") {
      renderBackupSection(contentBox);
    }
  }

  // --- SECTION 1: SINGLETON SCHOOL & TEACHER ---
  function renderSchoolAndTeacherSection(target) {
    const school = (state.schools || [])[0] || { name: "", address: "", phone: "" };
    const teacher = (state.teachers || [])[0] || { name: "", employeeNumber: "", phone: "" };

    // School Card
    const schoolCard = createElement("section", "settings-card");
    const sHeader = createElement("div", "settings-card-header");
    sHeader.append(
      createElement("h2", "section-title", "Profil Sekolah (Tunggal)"),
      createElement("p", "screen-copy", "Hanya ada 1 sekolah aktif yang digunakan sebagai identitas pembelajaran dan administrasi PJOK.")
    );
    schoolCard.append(sHeader);

    const schoolForm = createElement("form", "master-form");
    const sNameField = createField({ label: "Nama Sekolah / SD", name: "name", value: school.name || "", required: true });
    const sAddrField = createField({ label: "Alamat Sekolah", name: "address", value: school.address || "" });
    const sPhoneField = createField({ label: "Nomor Telepon / Kontak", name: "phone", value: school.phone || "" });
    
    const sSubmitBtn = createElement("button", "primary-action compact-action", "Simpan Profil Sekolah");
    sSubmitBtn.type = "submit";

    schoolForm.append(sNameField, sAddrField, sPhoneField, sSubmitBtn);
    schoolForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const payload = formToObject(schoolForm);
      if (actions?.saveSchoolProfile) {
        actions.saveSchoolProfile(payload);
        window.alert("Profil sekolah berhasil disimpan!");
      }
    });

    schoolCard.append(schoolForm);
    target.append(schoolCard);

    // Teacher Card
    const teacherCard = createElement("section", "settings-card");
    const tHeader = createElement("div", "settings-card-header");
    tHeader.append(
      createElement("h2", "section-title", "Profil Guru PJOK (Tunggal)"),
      createElement("p", "screen-copy", "Hanya ada 1 guru PJOK aktif yang memimpin kegiatan pembelajaran di lapangan.")
    );
    teacherCard.append(tHeader);

    const teacherForm = createElement("form", "master-form");
    const tNameField = createField({ label: "Nama Lengkap Guru PJOK", name: "name", value: teacher.name || "", required: true });
    const tNipField = createField({ label: "NIP / NUPTK", name: "employeeNumber", value: teacher.employeeNumber || "" });
    const tPhoneField = createField({ label: "Nomor WhatsApp / HP", name: "phone", value: teacher.phone || "" });

    const tSubmitBtn = createElement("button", "primary-action compact-action", "Simpan Profil Guru");
    tSubmitBtn.type = "submit";

    teacherForm.append(tNameField, tNipField, tPhoneField, tSubmitBtn);
    teacherForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const payload = formToObject(teacherForm);
      if (actions?.saveTeacherProfile) {
        actions.saveTeacherProfile(payload);
        window.alert("Profil guru berhasil disimpan!");
      }
    });

    teacherCard.append(teacherForm);
    target.append(teacherCard);
  }

  // --- SECTION 2: ACADEMIC YEARS & SEMESTERS ---
  function renderAcademicSection(target) {
    const grid = createElement("div", "settings-two-col-grid");

    // Academic Years
    const ayCard = createElement("section", "settings-card");
    ayCard.append(createElement("h2", "section-title", "Tahun Ajaran"));

    const ayForm = createElement("form", "master-form");
    ayForm.append(
      createField({ label: "Nama Tahun Ajaran (misal: 2025/2026)", name: "name", required: true }),
      createElement("button", "primary-action compact-action", "Tambah Tahun Ajaran")
    );
    ayForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const payload = formToObject(ayForm);
      if (actions?.createAcademicYear) {
        actions.createAcademicYear(payload);
        render();
      }
    });
    ayCard.append(ayForm);

    const ayList = createElement("div", "record-list");
    (state.academicYears || []).forEach((ay) => {
      const row = createElement("div", "record-row");
      row.append(createElement("strong", "", ay.name));
      const delBtn = createElement("button", "text-button danger-button", "Hapus");
      delBtn.type = "button";
      delBtn.addEventListener("click", () => actions.deleteAcademicYear(ay.id));
      row.append(delBtn);
      ayList.append(row);
    });
    ayCard.append(ayList);
    grid.append(ayCard);

    // Semesters
    const semCard = createElement("section", "settings-card");
    semCard.append(createElement("h2", "section-title", "Semester"));

    const semForm = createElement("form", "master-form");
    semForm.append(
      createField({ label: "Nama Semester (misal: Ganjil / Genap)", name: "name", required: true }),
      createElement("button", "primary-action compact-action", "Tambah Semester")
    );
    semForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const payload = formToObject(semForm);
      if (actions?.createSemester) {
        actions.createSemester(payload);
        render();
      }
    });
    semCard.append(semForm);

    const semList = createElement("div", "record-list");
    (state.semesters || []).forEach((sem) => {
      const row = createElement("div", "record-row");
      row.append(createElement("strong", "", sem.name));
      const delBtn = createElement("button", "text-button danger-button", "Hapus");
      delBtn.type = "button";
      delBtn.addEventListener("click", () => actions.deleteSemester(sem.id));
      row.append(delBtn);
      semList.append(row);
    });
    semCard.append(semList);
    grid.append(semCard);

    target.append(grid);
  }

  // --- SECTION 3: STUDENT TAGS ---
  function renderTagsSection(target) {
    const card = createElement("section", "settings-card");
    card.append(
      createElement("h2", "section-title", "Tag Kondisi & Catatan Khusus Siswa"),
      createElement(
        "p",
        "screen-copy",
        "Tag digunakan untuk memberi peringatan kesehatan (misal: Asma, Riwayat Kejang, Cedera Lutut) atau tanda kebugaran berbakat saat mengajar di lapangan."
      )
    );

    const form = createElement("form", "master-form");
    form.append(
      createField({ label: "Nama Tag (misal: Asma / Cedera Kaki / Perlu Perhatian)", name: "name", required: true }),
      createField({ label: "Warna Label (Hex, misal: #dc2626 merah, #ea580c oranye)", name: "color", value: "#dc2626" }),
      createElement("button", "primary-action compact-action", "Tambah Tag")
    );
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const payload = formToObject(form);
      if (actions?.createTag) {
        actions.createTag(payload);
        render();
      }
    });
    card.append(form);

    const list = createElement("div", "record-list");
    (state.studentTags || []).forEach((tag) => {
      const row = createElement("div", "record-row");
      const tagContent = createElement("div", "tag-item-preview");
      const pill = createElement("span", "student-tag-pill", tag.name);
      pill.style.backgroundColor = tag.color ? `${tag.color}25` : "#e2e8f0";
      pill.style.color = tag.color || "#334155";
      tagContent.append(pill);

      const delBtn = createElement("button", "text-button danger-button", "Hapus");
      delBtn.type = "button";
      delBtn.addEventListener("click", () => actions.deleteTag(tag.id));

      row.append(tagContent, delBtn);
      list.append(row);
    });
    card.append(list);

    target.append(card);
  }

  // --- SECTION 4: ASSESSMENT DEFINITIONS ---
  function renderAssessmentsSection(target) {
    const card = createElement("section", "settings-card");
    card.append(
      createElement("h2", "section-title", "Definisi Indikator Penilaian PJOK"),
      createElement(
        "p",
        "screen-copy",
        "Atur instrumen tes fisik dan penilaian keterampilan (rubrik skala 1-4, stopwatch detik lari/renang, atau skor angka)."
      )
    );

    const form = createElement("form", "master-form");
    form.append(
      createField({ label: "Nama Penilaian (misal: Tes Lari 50 Meter / Dribble Bola)", name: "name", required: true }),
      createSelectField({
        label: "Kategori Penilaian",
        name: "category",
        options: [
          { value: "keterampilan", label: "Keterampilan Gerak & Teknik" },
          { value: "kebugaran", label: "Kebugaran Jasmani (TKJI)" },
          { value: "sikap", label: "Sikap / Perilaku Sportif" },
          { value: "pengetahuan", label: "Pengetahuan Gerak" }
        ]
      }),
      createSelectField({
        label: "Tipe Skoring",
        name: "scoringType",
        options: [
          { value: "rubric", label: "Rubrik Skala 1 - 4" },
          { value: "numeric", label: "Nilai Angka Bebas (0 - 100)" },
          { value: "stopwatch", label: "Waktu Stopwatch (detik)" }
        ]
      }),
      createField({ label: "Deskripsi Indikator / Kriteria", name: "description" }),
      createElement("button", "primary-action compact-action", "Tambah Definisi Penilaian")
    );

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const payload = formToObject(form);
      if (actions?.createAssessmentDefinition) {
        actions.createAssessmentDefinition(payload);
        render();
      }
    });
    card.append(form);

    const list = createElement("div", "record-list");
    (state.assessmentDefinitions || []).forEach((def) => {
      const row = createElement("div", "record-row");
      const content = createElement("div");
      content.append(
        createElement("strong", "", def.name),
        createElement("span", "", `Kategori: ${def.category || "-"} • Skoring: ${def.scoringType || "rubric"}`)
      );
      if (def.description) {
        content.append(createElement("p", "screen-copy", def.description));
      }

      const delBtn = createElement("button", "text-button danger-button", "Hapus");
      delBtn.type = "button";
      delBtn.addEventListener("click", () => actions.deleteAssessmentDefinition(def.id));

      row.append(content, delBtn);
      list.append(row);
    });
    card.append(list);

    target.append(card);
  }

  // --- SECTION 5: BACKUP & RESTORE + APP INFO ---
  function renderBackupSection(target) {
    const card = createElement("section", "settings-card");
    card.append(
      createElement("h2", "section-title", "Cadangan & Pemulihan Data Offline"),
      createElement(
        "p",
        "screen-copy",
        "Semua data aplikasi tersimpan di perangkat lokal Anda tanpa memerlukan koneksi internet. Lakukan export secara berkala untuk menyimpan salinan cadangan."
      )
    );

    const actionsRow = createElement("div", "data-actions");

    const exportBtn = createElement("button", "primary-action compact-action");
    exportBtn.type = "button";
    exportBtn.append(ICONS.download ? ICONS.download(16) : ICONS.copy(16), document.createTextNode(" Export Cadangan (JSON)"));
    exportBtn.addEventListener("click", () => {
      if (actions?.exportData) {
        actions.exportData();
      }
    });

    const importLabel = createElement("label", "import-action");
    importLabel.append(ICONS.database(16), document.createTextNode(" Import Cadangan (JSON)"));
    const importInput = document.createElement("input");
    importInput.type = "file";
    importInput.accept = "application/json,.json";
    importInput.addEventListener("change", (e) => {
      const [file] = e.target.files;
      if (file && actions?.importData) {
        actions.importData(file);
      }
      e.target.value = "";
    });
    importLabel.append(importInput);

    actionsRow.append(exportBtn, importLabel);
    card.append(actionsRow);

    // App Information
    const infoBox = createElement("div", "app-meta-box");
    infoBox.append(
      createElement("h3", "sub-title", "Tentang Aplikasi"),
      createElement("p", "screen-copy", "PJOK Teacher Assistant • Progressive Web App"),
      createElement("p", "screen-copy", "Didesain khusus untuk mempermudah guru PJOK SD mengelola kelas, absensi cepat, materi pembelajaran lapangan, dan penilaian fisik langsung dengan satu tangan."),
      createElement("p", "screen-copy", "Status Jaringan: " + (navigator.onLine ? "🟢 Online" : "🟡 Offline (Tetap Berfungsi Penuh)"))
    );
    card.append(infoBox);

    target.append(card);
  }

  render();
  return screen;
}
