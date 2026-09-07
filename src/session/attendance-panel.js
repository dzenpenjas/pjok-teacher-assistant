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

export function renderAttendancePanel(context) {
  const panel = createElement("section", "attendance-panel");
  const header = createElement("div", "panel-header-row");
  header.append(createElement("h2", "section-title", "Absensi Siswa"));
  panel.append(header);

  if (!context.session) {
    panel.append(createElement("p", "empty-copy", "Pilih atau buat sesi pembelajaran terlebih dahulu."));
    return panel;
  }

  const students = context.students || [];
  const records = context.records || [];
  const tags = context.tags || [];

  const attendanceMap = new Map(records.map((r) => [r.studentId, r]));

  // Stats calculation
  let countPresent = 0;
  let countLate = 0;
  let countExcused = 0;
  let countSick = 0;
  let countAbsent = 0;
  let countUnmarked = 0;

  students.forEach((s) => {
    const rec = attendanceMap.get(s.id);
    const status = rec?.status;
    if (status === "present") countPresent++;
    else if (status === "late") countLate++;
    else if (status === "excused") countExcused++;
    else if (status === "sick") countSick++;
    else if (status === "absent") countAbsent++;
    else countUnmarked++;
  });

  const total = students.length;
  const markedTotal = total - countUnmarked;
  const pct = total > 0 ? Math.round((markedTotal / total) * 100) : 0;

  // Overview Stats Bar
  const statsContainer = createElement("div", "att-stats-card");
  
  const statsSummary = createElement("div", "att-badges-wrap");
  statsSummary.append(
    createBadge("Hadir", countPresent, "badge-present"),
    createBadge("Terlambat", countLate, "badge-late"),
    createBadge("Izin", countExcused, "badge-excused"),
    createBadge("Sakit", countSick, "badge-sick"),
    createBadge("Alfa", countAbsent, "badge-absent"),
    createBadge("Belum", countUnmarked, "badge-unmarked")
  );

  const progressWrap = createElement("div", "att-progress-wrap");
  const progressBar = createElement("div", "att-progress-bar");
  progressBar.style.width = `${pct}%`;
  progressWrap.append(progressBar);

  const progressLabel = createElement(
    "div",
    "att-progress-label",
    `${markedTotal} dari ${total} siswa diabsen (${pct}%)`
  );

  statsContainer.append(statsSummary, progressWrap, progressLabel);
  panel.append(statsContainer);

  // Fast Actions Toolbar
  const toolbar = createElement("div", "att-toolbar");

  // Search input
  const searchInput = document.createElement("input");
  searchInput.type = "search";
  searchInput.className = "att-search-input";
  searchInput.placeholder = "Cari nama atau NIS siswa...";

  // Quick action: Mark all present
  const markAllBtn = createElement("button", "att-quick-btn", "✓ Tandai Semua Hadir");
  markAllBtn.type = "button";
  markAllBtn.addEventListener("click", () => {
    if (total === 0) return;
    if (context.onMarkAllPresent) {
      context.onMarkAllPresent(context.session.id);
    } else {
      students.forEach((s) => {
        context.onSetStatus(s.id, "present");
      });
    }
  });

  toolbar.append(searchInput, markAllBtn);
  panel.append(toolbar);

  // Filter chips
  const filterChips = createElement("div", "att-filter-chips");
  let activeFilter = "all"; // all, unmarked, present, absent_any

  const filters = [
    { id: "all", label: `Semua (${total})` },
    { id: "unmarked", label: `Belum (${countUnmarked})` },
    { id: "present", label: `Hadir (${countPresent})` },
    { id: "absent_any", label: `Tidak Hadir (${countLate + countExcused + countSick + countAbsent})` }
  ];

  filters.forEach((f) => {
    const chip = createElement(
      "button",
      f.id === activeFilter ? "att-chip is-active" : "att-chip",
      f.label
    );
    chip.type = "button";
    chip.dataset.filter = f.id;
    chip.addEventListener("click", () => {
      activeFilter = f.id;
      filterChips.querySelectorAll(".att-chip").forEach((c) => {
        c.classList.toggle("is-active", c.dataset.filter === activeFilter);
      });
      renderList();
    });
    filterChips.append(chip);
  });
  panel.append(filterChips);

  // Students list container
  const list = createElement("div", "attendance-list");
  panel.append(list);

  function renderList() {
    list.replaceChildren();
    const query = (searchInput.value || "").trim().toLowerCase();

    const filtered = students.filter((student) => {
      const rec = attendanceMap.get(student.id);
      const status = rec?.status || "unmarked";

      // Filter check
      if (activeFilter === "unmarked" && status !== "unmarked") return false;
      if (activeFilter === "present" && status !== "present") return false;
      if (activeFilter === "absent_any" && (status === "present" || status === "unmarked")) return false;

      // Query check
      if (query) {
        const nameMatch = (student.name || "").toLowerCase().includes(query);
        const nisMatch = (student.studentNumber || "").toLowerCase().includes(query);
        if (!nameMatch && !nisMatch) return false;
      }

      return true;
    });

    if (filtered.length === 0) {
      list.append(createElement("p", "empty-copy", "Tidak ada siswa yang cocok dengan filter atau pencarian."));
      return;
    }

    filtered.forEach((student) => {
      const record = attendanceMap.get(student.id) || null;
      const currentStatus = record?.status || null;
      const row = createElement("article", `attendance-row ${currentStatus ? `status-${currentStatus}` : "status-none"}`);

      // Left: Avatar + Info
      const info = createElement("div", "attendance-info");
      
      const avatar = createElement("div", "student-avatar", getInitials(student.name));
      const textMeta = createElement("div", "student-text-meta");
      
      const nameEl = createElement("strong", "student-name", student.name);
      if (context.onViewStudent) {
        nameEl.classList.add("clickable-link");
        nameEl.title = "Lihat profil & perkembangan siswa";
        nameEl.addEventListener("click", () => context.onViewStudent(student.id));
      }
      
      const sub = createElement(
        "span",
        "student-nis",
        student.studentNumber ? `NIS: ${student.studentNumber} • ${student.gender === "P" ? "Perempuan" : "Laki-laki"}` : (student.gender === "P" ? "Perempuan" : "Laki-laki")
      );

      // Student tags (health, injury, talented, etc.)
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

      textMeta.append(nameEl, sub);
      if (tagsWrap.children.length > 0) {
        textMeta.append(tagsWrap);
      }

      info.append(avatar, textMeta);

      // Right: 5 status buttons
      const actions = createElement("div", "attendance-actions-grid");
      actions.append(
        createStatusBtn("Hadir", "present", "btn-att-present", currentStatus === "present", () => setStatus(student.id, "present")),
        createStatusBtn("Terlambat", "late", "btn-att-late", currentStatus === "late", () => setStatus(student.id, "late")),
        createStatusBtn("Izin", "excused", "btn-att-excused", currentStatus === "excused", () => setStatus(student.id, "excused")),
        createStatusBtn("Sakit", "sick", "btn-att-sick", currentStatus === "sick", () => setStatus(student.id, "sick")),
        createStatusBtn("Alfa", "absent", "btn-att-absent", currentStatus === "absent", () => setStatus(student.id, "absent"))
      );

      row.append(info, actions);
      list.append(row);
    });
  }

  function setStatus(studentId, status) {
    context.onSetStatus(studentId, status);
  }

  searchInput.addEventListener("input", renderList);
  renderList();

  return panel;
}

function createBadge(label, count, className) {
  const badge = createElement("div", `att-badge ${className}`);
  badge.append(createElement("span", "att-badge-num", String(count)));
  badge.append(createElement("span", "att-badge-lbl", label));
  return badge;
}

function createStatusBtn(label, status, colorClass, isActive, onClick) {
  const btn = createElement(
    "button",
    `att-status-btn ${colorClass} ${isActive ? "is-selected" : ""}`,
    label
  );
  btn.type = "button";
  btn.addEventListener("click", onClick);
  return btn;
}

function getInitials(name = "") {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("");
}
