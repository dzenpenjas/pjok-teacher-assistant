import { calculateBmi } from "../data/models.js";

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

export function renderStudentDetailModal(studentId, context, onClose) {
  const backdrop = createElement("div", "modal-backdrop");
  const modal = createElement("div", "modal-card");

  const student = (context.students || []).find((s) => s.id === studentId);
  if (!student) {
    modal.append(createElement("p", "empty-copy", "Data siswa tidak ditemukan."));
    const closeBtn = createElement("button", "primary-action compact-action", "Tutup");
    closeBtn.addEventListener("click", onClose);
    modal.append(closeBtn);
    backdrop.append(modal);
    return backdrop;
  }

  const classRoom = (context.classes || []).find((c) => c.id === student.classId);
  const tags = context.tags || [];
  const growthRecords = (context.growthRecords || []).filter((g) => g.studentId === student.id).sort((a, b) => (a.date > b.date ? 1 : -1));
  const attendanceRecords = (context.attendanceRecords || []).filter((a) => a.studentId === student.id);
  const assessmentResults = (context.assessmentResults || []).filter((r) => r.studentId === student.id);
  const definitions = context.assessmentDefinitions || [];
  const observations = (context.observations || []).filter((o) => o.studentId === student.id);

  // Close Button Top Right
  const headerRow = createElement("div", "modal-header-row");
  const studentHeader = createElement("div", "modal-student-identity");
  
  const avatar = createElement("div", "student-avatar modal-avatar", getInitials(student.name));
  const textGroup = createElement("div", "modal-identity-text");
  textGroup.append(createElement("h2", "modal-student-name", student.name));
  textGroup.append(
    createElement(
      "span",
      "modal-student-sub",
      `${classRoom?.name || "Tanpa Kelas"} • NIS: ${student.studentNumber || "-"} • ${student.gender === "P" ? "Perempuan" : "Laki-laki"}`
    )
  );

  // Tag list
  const tagsWrap = createElement("div", "student-tags-inline");
  if (Array.isArray(student.tagIds)) {
    student.tagIds.forEach((tagId) => {
      const tagObj = tags.find((t) => t.id === tagId);
      if (tagObj) {
        const tagEl = createElement("span", "mini-tag", tagObj.name);
        if (tagObj.color) {
          tagEl.style.borderColor = tagObj.color;
          tagEl.style.color = tagObj.color;
        }
        tagsWrap.append(tagEl);
      }
    });
  }
  textGroup.append(tagsWrap);
  studentHeader.append(avatar, textGroup);

  const closeBtn = createElement("button", "modal-close-btn", "✕");
  closeBtn.type = "button";
  closeBtn.addEventListener("click", onClose);

  headerRow.append(studentHeader, closeBtn);
  modal.append(headerRow);

  // MODAL TABS
  const navTabs = createElement("div", "modal-nav-tabs");
  const tabBody = createElement("div", "modal-tab-body");

  let activeTab = "growth"; // growth, attendance, assessment, observations

  const modalTabs = [
    { id: "growth", label: "📏 Pertumbuhan & IMT" },
    { id: "attendance", label: "📅 Absensi" },
    { id: "assessment", label: "🎯 Nilai & Tes" },
    { id: "observations", label: "📝 Observasi" }
  ];

  modalTabs.forEach((t) => {
    const btn = createElement(
      "button",
      `modal-tab-btn ${t.id === activeTab ? "is-active" : ""}`,
      t.label
    );
    btn.type = "button";
    btn.dataset.tab = t.id;
    btn.addEventListener("click", () => {
      activeTab = t.id;
      renderActiveTab();
    });
    navTabs.append(btn);
  });

  modal.append(navTabs, tabBody);

  function renderActiveTab() {
    tabBody.replaceChildren();
    navTabs.querySelectorAll(".modal-tab-btn").forEach((b) => {
      b.classList.toggle("is-active", b.dataset.tab === activeTab);
    });

    if (activeTab === "growth") {
      renderGrowthTab();
    } else if (activeTab === "attendance") {
      renderAttendanceTab();
    } else if (activeTab === "assessment") {
      renderAssessmentTab();
    } else if (activeTab === "observations") {
      renderObservationsTab();
    }
  }

  // TAB 1: GROWTH TRACKING & BMI
  function renderGrowthTab() {
    const latest = growthRecords.length > 0 ? growthRecords[growthRecords.length - 1] : null;
    const height = latest?.heightCm || student.heightCm || null;
    const weight = latest?.weightKg || student.weightKg || null;
    const bmiCalc = calculateBmi(height, weight);

    const summaryCard = createElement("div", "growth-summary-card");
    const grid = createElement("div", "stats-grid");
    grid.append(
      createStatBox("Tinggi Badan", height ? `${height} cm` : "-"),
      createStatBox("Berat Badan", weight ? `${weight} kg` : "-"),
      createStatBox("Status IMT", bmiCalc.bmi ? `${bmiCalc.bmi} (${bmiCalc.category})` : "-")
    );
    summaryCard.append(grid);
    tabBody.append(summaryCard);

    // History Table
    const histSection = createElement("div", "growth-history-section");
    histSection.append(createElement("h3", "section-title-sm", "Riwayat Pengukuran"));

    if (growthRecords.length === 0) {
      histSection.append(createElement("p", "empty-copy", "Belum ada riwayat pengukuran pertumbuhan tersimpan."));
    } else {
      const table = createElement("table", "growth-table");
      const thead = createElement("thead");
      thead.innerHTML = `
        <tr>
          <th>Tanggal</th>
          <th>Tinggi</th>
          <th>Berat</th>
          <th>IMT</th>
          <th>Kategori</th>
          <th>Catatan</th>
        </tr>
      `;
      table.append(thead);

      const tbody = createElement("tbody");
      growthRecords.forEach((rec) => {
        const tr = createElement("tr");
        const b = calculateBmi(rec.heightCm, rec.weightKg);
        tr.innerHTML = `
          <td><strong>${rec.date || "-"}</strong></td>
          <td>${rec.heightCm ? `${rec.heightCm} cm` : "-"}</td>
          <td>${rec.weightKg ? `${rec.weightKg} kg` : "-"}</td>
          <td>${b.bmi || "-"}</td>
          <td><span class="bmi-badge bmi-${(b.category || "").toLowerCase().replace(/\s+/g, "-")}">${b.category}</span></td>
          <td>${rec.note || "-"}</td>
        `;
        tbody.append(tr);
      });
      table.append(tbody);
      histSection.append(table);
    }
    tabBody.append(histSection);

    // Form to add measurement
    const addSection = createElement("details", "activity-add-accordion");
    const summary = createElement("summary", "activity-add-summary", "+ Catat Pengukuran Baru");
    const form = createElement("form", "master-form");

    const dateF = createElement("label", "field");
    dateF.append(createElement("span", "", "Tanggal"));
    const dateIn = document.createElement("input");
    dateIn.type = "date";
    dateIn.name = "date";
    dateIn.defaultValue = new Date().toISOString().slice(0, 10);
    dateF.append(dateIn);

    const hF = createElement("label", "field");
    hF.append(createElement("span", "", "Tinggi Badan (cm) *"));
    const hIn = document.createElement("input");
    hIn.type = "number";
    hIn.step = "0.5";
    hIn.name = "heightCm";
    hIn.required = true;
    hIn.defaultValue = height || "";
    hF.append(hIn);

    const wF = createElement("label", "field");
    wF.append(createElement("span", "", "Berat Badan (kg) *"));
    const wIn = document.createElement("input");
    wIn.type = "number";
    wIn.step = "0.5";
    wIn.name = "weightKg";
    wIn.required = true;
    wIn.defaultValue = weight || "";
    wF.append(wIn);

    const nF = createElement("label", "field");
    nF.append(createElement("span", "", "Catatan"));
    const nIn = document.createElement("input");
    nIn.name = "note";
    nIn.placeholder = "Pengukuran awal semester, postur, dll";
    nF.append(nIn);

    const submitBtn = createElement("button", "primary-action compact-action", "Simpan Pengukuran");
    submitBtn.type = "submit";

    form.append(dateF, hF, wF, nF, submitBtn);
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const vals = Object.fromEntries(new FormData(form).entries());
      if (context.actions?.createGrowthRecord) {
        context.actions.createGrowthRecord({
          studentId: student.id,
          date: vals.date,
          heightCm: vals.heightCm,
          weightKg: vals.weightKg,
          note: vals.note
        });
      }
    });

    addSection.append(summary, form);
    tabBody.append(addSection);
  }

  // TAB 2: ATTENDANCE HISTORY
  function renderAttendanceTab() {
    const total = attendanceRecords.length;
    let present = 0;
    let sick = 0;
    let excused = 0;
    let absent = 0;
    let late = 0;

    attendanceRecords.forEach((r) => {
      if (r.status === "present") present++;
      else if (r.status === "sick") sick++;
      else if (r.status === "excused") excused++;
      else if (r.status === "absent") absent++;
      else if (r.status === "late") late++;
    });

    const pct = total > 0 ? Math.round((present / total) * 100) : 0;

    const summary = createElement("div", "att-badges-wrap");
    summary.append(
      createStatBox("Persentase Hadir", `${pct}%`),
      createStatBox("Hadir", String(present)),
      createStatBox("Sakit", String(sick)),
      createStatBox("Izin", String(excused)),
      createStatBox("Alfa", String(absent))
    );
    tabBody.append(summary);

    const histList = createElement("div", "attendance-list");
    if (total === 0) {
      histList.append(createElement("p", "empty-copy", "Belum ada rekaman absensi untuk siswa ini."));
    } else {
      attendanceRecords.forEach((rec) => {
        const s = (context.sessions || []).find((sess) => sess.id === rec.sessionId);
        const item = createElement("div", "record-row");
        const left = createElement("div");
        left.append(createElement("strong", "", s ? `Sesi ${s.sessionNumber || "-"}: ${s.topic || "PJOK"}` : "Sesi Pembelajaran"));
        left.append(createElement("span", "", `Tanggal: ${s?.date || rec.recordedAt?.slice(0, 10) || "-"}`));
        
        const badge = createElement(
          "span",
          `att-status-badge status-${rec.status}`,
          getAttLabel(rec.status)
        );

        item.append(left, badge);
        histList.append(item);
      });
    }
    tabBody.append(histList);
  }

  // TAB 3: ASSESSMENT RESULTS HISTORY
  function renderAssessmentTab() {
    const list = createElement("div", "record-list");
    if (assessmentResults.length === 0) {
      list.append(createElement("p", "empty-copy", "Belum ada riwayat hasil tes atau penilaian untuk siswa ini."));
    } else {
      assessmentResults.forEach((res) => {
        const s = (context.sessions || []).find((sess) => sess.id === res.sessionId);
        const as = (context.assessmentSessions || []).find((a) => a.id === res.assessmentSessionId);
        const def = definitions.find((d) => d.id === as?.definitionId);

        const card = createElement("div", "assess-student-card is-scored");
        const topRow = createElement("div", "assess-card-header");
        
        const titleCol = createElement("div");
        titleCol.append(createElement("strong", "", def?.name || as?.title || "Penilaian PJOK"));
        titleCol.append(createElement("span", "student-nis", `Sesi: ${s?.topic || "-"} (${s?.date || res.recordedAt?.slice(0, 10)})`));

        const scoreBadge = createElement("span", "assess-score-badge badge-has-score", res.formattedValue || res.value);

        topRow.append(titleCol, scoreBadge);
        card.append(topRow);

        if (res.note) {
          card.append(createElement("p", "assess-desc", `Catatan: ${res.note}`));
        }

        list.append(card);
      });
    }
    tabBody.append(list);
  }

  // TAB 4: OBSERVATIONS & NOTES
  function renderObservationsTab() {
    const obsList = createElement("div", "record-list");
    if (observations.length === 0) {
      obsList.append(createElement("p", "empty-copy", "Belum ada catatan observasi khusus untuk siswa ini."));
    } else {
      observations.forEach((obs) => {
        const card = createElement("div", "record-row");
        const left = createElement("div");
        left.append(createElement("strong", "", `[${obs.type || "Umum"}] ${obs.recordedAt?.slice(0, 10) || ""}`));
        left.append(createElement("span", "", obs.text));
        card.append(left);
        obsList.append(card);
      });
    }
    tabBody.append(obsList);

    // Form to add observation
    const form = createElement("form", "master-form");
    const input = document.createElement("input");
    input.placeholder = "Tulis observasi (misal: potensi atletik, cedera pergelangan kaki)...";
    input.required = true;

    const typeSelect = document.createElement("select");
    [
      { v: "umum", l: "Catatan Umum" },
      { v: "potensi", l: "Bakat / Potensi" },
      { v: "evaluasi", l: "Perlu Bimbingan" },
      { v: "cedera", l: "Kesehatan / Cedera" }
    ].forEach((t) => {
      const o = document.createElement("option");
      o.value = t.v;
      o.textContent = t.l;
      typeSelect.append(o);
    });

    const submit = createElement("button", "primary-action compact-action", "Tambah Observasi");
    submit.type = "submit";

    form.append(input, typeSelect, submit);
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (context.actions?.createObservation) {
        context.actions.createObservation({
          studentId: student.id,
          text: input.value.trim(),
          type: typeSelect.value
        });
      }
    });

    tabBody.append(form);
  }

  renderActiveTab();
  backdrop.append(modal);
  return backdrop;
}

function createStatBox(label, value) {
  const item = createElement("div", "stat-item");
  item.append(createElement("strong", "", value));
  item.append(createElement("span", "", label));
  return item;
}

function getInitials(name = "") {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("");
}

function getAttLabel(status) {
  const map = {
    present: "Hadir",
    late: "Terlambat",
    sick: "Sakit",
    excused: "Izin",
    absent: "Alfa"
  };
  return map[status] || status || "-";
}
