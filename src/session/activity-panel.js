import { ICONS } from "../ui/icons.js";

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

function playBeep() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.6);
  } catch {
    // AudioContext blocked or not supported
  }
}

export function renderActivityPanel(context) {
  const panel = createElement("section", "activity-panel");

  if (!context.session) {
    panel.append(createElement("p", "empty-copy", "Pilih atau buat sesi untuk mengelola aktivitas pembelajaran."));
    return panel;
  }

  const activities = context.activities || [];
  const sessionId = context.session.id;

  // 1. TOOLBAR: Field Tools (Timer & Stopwatch)
  const toolsHeader = createElement("div", "activity-tools-card");
  toolsHeader.append(createElement("h3", "activity-section-subtitle", "Peralatan Lapangan"));

  const toolsGrid = createElement("div", "tools-grid");

  // STOPWATCH WIDGET
  const stopwatchCard = createElement("div", "tool-box stopwatch-box");
  const swTitle = createElement("div", "tool-title");
  swTitle.append(ICONS.timer(16), document.createTextNode(" Stopwatch Lapangan"));
  stopwatchCard.append(swTitle);
  const swDisplay = createElement("div", "tool-display", "00:00.00");
  const swControls = createElement("div", "tool-controls");

  let swInterval = null;
  let swStartTime = 0;
  let swElapsed = 0;
  let swRunning = false;

  const swToggleBtn = createElement("button", "btn-tool btn-tool-primary", "Mulai");
  const swResetBtn = createElement("button", "btn-tool", "Reset");
  const swSendBtn = createElement("button", "btn-tool btn-tool-send", "Simpan ke Nilai Siswa");
  swSendBtn.style.display = "none";

  function formatSw(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const hundredths = Math.floor((ms % 1000) / 10);
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(hundredths).padStart(2, "0")}`;
  }

  function formatSeconds(ms) {
    return (ms / 1000).toFixed(2);
  }

  swToggleBtn.addEventListener("click", () => {
    if (!swRunning) {
      swRunning = true;
      swStartTime = Date.now() - swElapsed;
      swToggleBtn.textContent = "Stop";
      swToggleBtn.classList.remove("btn-tool-primary");
      swToggleBtn.classList.add("btn-tool-danger");
      swSendBtn.style.display = "none";
      swInterval = setInterval(() => {
        swElapsed = Date.now() - swStartTime;
        swDisplay.textContent = formatSw(swElapsed);
      }, 30);
    } else {
      swRunning = false;
      clearInterval(swInterval);
      swToggleBtn.textContent = "Lanjut";
      swToggleBtn.classList.remove("btn-tool-danger");
      swToggleBtn.classList.add("btn-tool-primary");
      if (swElapsed > 0) {
        swSendBtn.style.display = "inline-flex";
        swSendBtn.textContent = `Salin Waktu (${formatSeconds(swElapsed)}s)`;
      }
    }
  });

  swResetBtn.addEventListener("click", () => {
    swRunning = false;
    clearInterval(swInterval);
    swElapsed = 0;
    swDisplay.textContent = "00:00.00";
    swToggleBtn.textContent = "Mulai";
    swToggleBtn.classList.remove("btn-tool-danger");
    swToggleBtn.classList.add("btn-tool-primary");
    swSendBtn.style.display = "none";
  });

  swSendBtn.addEventListener("click", () => {
    if (context.onCaptureStopwatch) {
      context.onCaptureStopwatch(formatSeconds(swElapsed));
    }
  });

  swControls.append(swToggleBtn, swResetBtn, swSendBtn);
  stopwatchCard.append(swDisplay, swControls);

  // COUNTDOWN TIMER WIDGET
  const timerCard = createElement("div", "tool-box timer-box");
  const tmTitle = createElement("div", "tool-title");
  tmTitle.append(ICONS.clock(16), document.createTextNode(" Countdown Timer"));
  timerCard.append(tmTitle);
  const tmDisplay = createElement("div", "tool-display", "05:00");

  let tmSecondsRemaining = 300;
  let tmInterval = null;
  let tmRunning = false;

  function formatTm(totalSec) {
    const minutes = Math.floor(totalSec / 60);
    const seconds = totalSec % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  const tmControls = createElement("div", "tool-controls");
  const tmToggleBtn = createElement("button", "btn-tool btn-tool-primary", "Mulai");
  const tmResetBtn = createElement("button", "btn-tool", "Reset");
  const tmPlus1Btn = createElement("button", "btn-tool", "+1 Mnt");

  tmToggleBtn.addEventListener("click", () => {
    if (!tmRunning) {
      if (tmSecondsRemaining <= 0) {
        tmSecondsRemaining = 300;
      }
      tmRunning = true;
      tmToggleBtn.textContent = "Jeda";
      tmToggleBtn.classList.remove("btn-tool-primary");
      tmToggleBtn.classList.add("btn-tool-warning");
      tmInterval = setInterval(() => {
        if (tmSecondsRemaining > 0) {
          tmSecondsRemaining--;
          tmDisplay.textContent = formatTm(tmSecondsRemaining);
        } else {
          clearInterval(tmInterval);
          tmRunning = false;
          tmToggleBtn.textContent = "Mulai";
          tmToggleBtn.classList.remove("btn-tool-warning");
          tmToggleBtn.classList.add("btn-tool-primary");
          playBeep();
          tmDisplay.classList.add("timer-finished");
          setTimeout(() => tmDisplay.classList.remove("timer-finished"), 2000);
        }
      }, 1000);
    } else {
      tmRunning = false;
      clearInterval(tmInterval);
      tmToggleBtn.textContent = "Lanjut";
      tmToggleBtn.classList.remove("btn-tool-warning");
      tmToggleBtn.classList.add("btn-tool-primary");
    }
  });

  tmResetBtn.addEventListener("click", () => {
    tmRunning = false;
    clearInterval(tmInterval);
    tmSecondsRemaining = 300;
    tmDisplay.textContent = formatTm(tmSecondsRemaining);
    tmToggleBtn.textContent = "Mulai";
    tmToggleBtn.classList.remove("btn-tool-warning");
    tmToggleBtn.classList.add("btn-tool-primary");
  });

  tmPlus1Btn.addEventListener("click", () => {
    tmSecondsRemaining += 60;
    tmDisplay.textContent = formatTm(tmSecondsRemaining);
  });

  tmControls.append(tmToggleBtn, tmResetBtn, tmPlus1Btn);

  // Preset buttons
  const presetsRow = createElement("div", "timer-presets");
  [1, 2, 3, 5, 10, 15].forEach((m) => {
    const pBtn = createElement("button", "btn-preset", `${m}m`);
    pBtn.type = "button";
    pBtn.addEventListener("click", () => {
      tmRunning = false;
      clearInterval(tmInterval);
      tmSecondsRemaining = m * 60;
      tmDisplay.textContent = formatTm(tmSecondsRemaining);
      tmToggleBtn.textContent = "Mulai";
      tmToggleBtn.classList.remove("btn-tool-warning");
      tmToggleBtn.classList.add("btn-tool-primary");
    });
    presetsRow.append(pBtn);
  });

  timerCard.append(tmDisplay, tmControls, presetsRow);

  toolsGrid.append(stopwatchCard, timerCard);
  toolsHeader.append(toolsGrid);
  panel.append(toolsHeader);

  // 2. ACTIVITY FLOW LIST
  const actHeader = createElement("div", "panel-header-row");
  actHeader.append(createElement("h2", "section-title", "Alur Aktivitas Pembelajaran"));

  const loadDefaultsBtn = createElement("button", "att-quick-btn");
  loadDefaultsBtn.type = "button";
  loadDefaultsBtn.append(ICONS.plus(16), document.createTextNode(" Muat Alur Standar PJOK"));
  loadDefaultsBtn.addEventListener("click", () => {
    if (context.onLoadDefaultActivities) {
      context.onLoadDefaultActivities(sessionId);
    }
  });
  actHeader.append(loadDefaultsBtn);
  panel.append(actHeader);

  const actList = createElement("div", "activity-list");

  if (activities.length === 0) {
    actList.append(createElement("p", "empty-copy", "Belum ada rencana aktivitas pada sesi ini. Klik tombol di atas untuk memuat alur standar (Pemanasan, Inti, Permainan, Pendinginan)."));
  } else {
    activities.forEach((act, idx) => {
      const row = createElement("article", `activity-card status-${act.status || "pending"}`);
      
      const actLeft = createElement("div", "activity-info");
      const numLabel = createElement("span", "activity-badge-num", `Tahap ${idx + 1}`);
      const typeLabel = createElement("span", "activity-type-badge", capitalize(act.type || "latihan"));
      const title = createElement("strong", "activity-title", act.name || "Aktivitas");
      const duration = createElement("span", "activity-meta");
      duration.append(
        ICONS.timer(13),
        document.createTextNode(` ${act.durationMinutes || 10} menit ${act.notes ? `• ${act.notes}` : ""}`)
      );
      
      actLeft.append(numLabel, typeLabel, title, duration);

      const actRight = createElement("div", "activity-actions");
      const statusBtn = createElement(
        "button",
        `btn-act-status ${act.status === "completed" ? "is-completed" : act.status === "active" ? "is-active" : "is-pending"}`
      );
      statusBtn.type = "button";
      if (act.status === "completed") {
        statusBtn.append(ICONS.check(14), document.createTextNode(" Selesai"));
      } else if (act.status === "active") {
        statusBtn.textContent = "Sedang Berjalan";
      } else {
        statusBtn.textContent = "Mulai Tahap";
      }
      statusBtn.addEventListener("click", () => {
        let nextStatus = "active";
        if (act.status === "active") nextStatus = "completed";
        else if (act.status === "completed") nextStatus = "pending";
        if (context.onUpdateActivity) {
          context.onUpdateActivity(act.id, { ...act, status: nextStatus });
        }
      });

      const delBtn = createElement("button", "text-button danger-button", "Hapus");
      delBtn.type = "button";
      delBtn.addEventListener("click", () => {
        if (window.confirm(`Hapus tahap "${act.name}"?`)) {
          if (context.onDeleteActivity) {
            context.onDeleteActivity(act.id);
          }
        }
      });

      actRight.append(statusBtn, delBtn);
      row.append(actLeft, actRight);
      actList.append(row);
    });
  }

  panel.append(actList);

  // Add custom activity form
  const addFormCard = createElement("details", "activity-add-accordion");
  const summary = createElement("summary", "activity-add-summary", "+ Tambah Aktivitas Kustom");
  const form = createElement("form", "master-form");

  const nameField = createElement("label", "field");
  nameField.append(createElement("span", "", "Nama Aktivitas"));
  const nameInput = document.createElement("input");
  nameInput.name = "name";
  nameInput.required = true;
  nameInput.placeholder = "Misal: Drill Passing Berpasangan";
  nameField.append(nameInput);

  const typeField = createElement("label", "field");
  typeField.append(createElement("span", "", "Jenis"));
  const typeSelect = document.createElement("select");
  typeSelect.name = "type";
  [
    { val: "pemanasan", lbl: "Pemanasan" },
    { val: "materi", lbl: "Penyampaian Materi" },
    { val: "latihan", lbl: "Latihan / Praktik Inti" },
    { val: "permainan", lbl: "Permainan / Aplikasi" },
    { val: "tes", lbl: "Tes / Pengambilan Nilai" },
    { val: "pendinginan", lbl: "Pendinginan" }
  ].forEach((t) => {
    const opt = document.createElement("option");
    opt.value = t.val;
    opt.textContent = t.lbl;
    typeSelect.append(opt);
  });
  typeField.append(typeSelect);

  const durField = createElement("label", "field");
  durField.append(createElement("span", "", "Durasi (menit)"));
  const durInput = document.createElement("input");
  durInput.type = "number";
  durInput.name = "durationMinutes";
  durInput.defaultValue = "15";
  durField.append(durInput);

  const notesField = createElement("label", "field");
  notesField.append(createElement("span", "", "Catatan / Instruksi"));
  const notesInput = document.createElement("input");
  notesInput.name = "notes";
  notesInput.placeholder = "Peralatan, instruksi aba-aba, formasi";
  notesField.append(notesInput);

  const submitBtn = createElement("button", "primary-action compact-action", "Simpan Aktivitas");
  submitBtn.type = "submit";

  form.append(nameField, typeField, durField, notesField, submitBtn);
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    if (context.onCreateActivity) {
      context.onCreateActivity({
        sessionId,
        name: data.name,
        type: data.type,
        durationMinutes: Number(data.durationMinutes) || 10,
        notes: data.notes || "",
        status: "pending"
      });
    }
    form.reset();
    addFormCard.open = false;
  });

  addFormCard.append(summary, form);
  panel.append(addFormCard);

  return panel;
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
