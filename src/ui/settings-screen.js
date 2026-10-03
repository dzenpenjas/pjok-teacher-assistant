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
  { id: "assessments", label: "Perencanaan Asesmen", icon: () => ICONS.chart(16) },
  { id: "backup", label: "Cadangan Data", icon: () => ICONS.database(16) }
];

export function renderSettingsScreen(state, actions, options = {}) {
  const screen = createElement("main", "screen wide-screen settings-hub-screen");

  const allowedTabs = [
    "school-teacher",
    "academic",
    "tags",
    "assessments",
    "backup"
  ];

  let activeTab =
    allowedTabs.includes(options.activeTab)
      ? options.activeTab
      : "school-teacher";

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
        if (actions?.setSettingsActiveTab) {
          actions.setSettingsActiveTab(tab.id);
        } else {
          activeTab = tab.id;
          render();
        }
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

  // --- SECTION 4: ASSESSMENT DEFINITIONS / PLANNING ---
  function renderAssessmentsSection(target) {
    const card = createElement("section", "settings-card");
    card.append(
      createElement("h2", "section-title", "Perencanaan Asesmen"),
      createElement(
        "p",
        "screen-copy",
        "Rancang asesmen yang akan digunakan di kelas. Tentukan jenis asesmen, materi, bentuk pelaksanaan, metode penilaian, instrumen, dan rubrik."
      )
    );

    const form = createElement("form", "master-form");
    form.append(
      createField({ label: "Nama Rencana Asesmen (misal: Penilaian Gerak Lokomotor Dasar)", name: "name", required: true }),
      createSelectField({
        label: "Jenis Asesmen",
        name: "purpose",
        value: "formative",
        options: [
          { value: "pretest", label: "Pretest" },
          { value: "formative", label: "Harian / Formatif" },
          { value: "posttest", label: "Posttest" },
          { value: "midterm", label: "Tengah Semester" },
          { value: "final", label: "Akhir Semester" }
        ]
      }),
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
        label: "Bentuk Asesmen",
        name: "assessmentType",
        options: [
          { value: "written", label: "Tes Tertulis" },
          { value: "oral", label: "Tes Lisan" },
          { value: "practice", label: "Praktik" },
          { value: "observation", label: "Observasi" }
        ]
      }),
      createSelectField({
        label: "Tipe Skoring",
        name: "method",
        options: [
          { value: "rubric", label: "Rubrik Skala 1–5" },
          { value: "numeric", label: "Nilai Angka" },
          { value: "stopwatch", label: "Stopwatch / Waktu" }
        ]
      })
    );

    // Textarea Materials
    const matLabel = createElement("label", "field");
    matLabel.append(
      createElement("span", "", "Materi Pokok (Satu materi per baris)"),
      createElement("span", "text-subtle text-xs", "Ketik tiap topik materi di baris baru")
    );
    const matTextarea = document.createElement("textarea");
    matTextarea.name = "materials";
    matTextarea.rows = 3;
    matTextarea.className = "input-text";
    matTextarea.placeholder = "Contoh:\nLokomotor\nNon Lokomotor\nManipulatif";
    matLabel.append(matTextarea);
    form.append(matLabel);

    // Textarea Questions
    const qLabel = createElement("label", "field");
    qLabel.append(
      createElement("span", "", "Pertanyaan / Butir Instrumen (Opsional)"),
      createElement("span", "text-subtle text-xs", "Satu butir/soal per baris")
    );
    const qTextarea = document.createElement("textarea");
    qTextarea.name = "questions";
    qTextarea.rows = 3;
    qTextarea.className = "input-text";
    qTextarea.placeholder = "Contoh:\nJelaskan cara melakukan awalan lari cepat.\nSebutkan 3 variasi gerak melempar bola.";
    qLabel.append(qTextarea);
    form.append(qLabel);

    // Textarea Instructions
    const instLabel = createElement("label", "field");
    instLabel.append(
      createElement("span", "", "Panduan / Instruksi Penilaian (Opsional)"),
      createElement("span", "text-subtle text-xs", "Panduan pelaksanaan bagi guru saat pengambilan nilai")
    );
    const instTextarea = document.createElement("textarea");
    instTextarea.name = "instructions";
    instTextarea.rows = 2;
    instTextarea.className = "input-text";
    instTextarea.placeholder = "Contoh:\nSiswa melakukan gerakan 3 kali percobaan, ambil capaian teknik terbaik.";
    instLabel.append(instTextarea);
    form.append(instLabel);

    form.append(
      createField({ label: "Deskripsi Indikator / Kriteria", name: "description" }),
      createElement("button", "primary-action compact-action", "Tambah Rencana Asesmen")
    );

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const payload = formToObject(form);
      const materials = (matTextarea.value || "")
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      const questions = (qTextarea.value || "")
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      const instructions = (instTextarea.value || "").trim();

      const fullPayload = {
        ...payload,
        materials,
        questions,
        instructions
      };

      if (actions?.createAssessmentDefinition) {
        actions.createAssessmentDefinition(fullPayload);
      }
    });
    card.append(form);

    const list = createElement("div", "record-list");
    (state.assessmentDefinitions || []).forEach((def) => {
      const row = createElement("div", "record-row");
      const content = createElement("div");

      const categoryMap = {
        keterampilan: "Keterampilan",
        kebugaran: "Kebugaran",
        sikap: "Sikap",
        pengetahuan: "Pengetahuan"
      };
      const catLabel = categoryMap[(def.category || "").toLowerCase()] || def.category || "-";

      const purposeMap = {
        pretest: "Pretest",
        formative: "Formatif",
        posttest: "Posttest",
        midterm: "UTS",
        final: "UAS"
      };
      const purposeLabel = purposeMap[def.purpose] || def.purpose || "Formatif";

      const typeMap = {
        written: "Tertulis",
        oral: "Lisan",
        practice: "Praktik",
        observation: "Observasi"
      };
      const typeLabel = typeMap[def.assessmentType] || (def.assessmentType && def.assessmentType !== "unspecified" ? def.assessmentType : "Belum ditentukan");

      let methodLabel = "Rubrik 1–5";
      const methodKey = def.method;
      if (methodKey === "numeric") {
        methodLabel = "Nilai Angka";
      } else if (methodKey === "stopwatch") {
        methodLabel = "Stopwatch";
      } else if (methodKey === "rubric") {
        methodLabel = def.rubricScale ? `Rubrik 1–${def.rubricScale}` : "Rubrik 1–5";
      }

      content.append(
        createElement("strong", "", def.name),
        createElement("span", "", `${purposeLabel} • ${catLabel} • ${typeLabel} • ${methodLabel}`)
      );
      if (def.materials && def.materials.length > 0) {
        content.append(createElement("p", "screen-copy text-xs", `Materi: ${def.materials.join(", ")}`));
      }
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
