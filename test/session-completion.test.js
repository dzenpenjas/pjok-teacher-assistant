import test from "node:test";
import assert from "node:assert/strict";
import { renderSessionScreen } from "../src/session/session-screen.js";
import { renderSummaryPanel } from "../src/session/summary-panel.js";
import { createRepositoryContext } from "../src/repositories/repository-context.js";
import { SessionManager } from "../src/services/session-manager.js";

class Element {
  constructor(tagName) {
    this.tagName = tagName;
    this.children = [];
    this.style = {};
    this.dataset = {};
    this.listeners = {};
    this.classList = { toggle() {} };
  }
  append(...children) {
    this.children.push(...children);
    for (const child of children) child.parentNode = this;
  }
  appendChild(child) { this.append(child); }
  removeChild(child) { this.children = this.children.filter(item => item !== child); child.parentNode = null; }
  remove() { this.parentNode?.removeChild(this); }
  setAttribute() {}
  replaceChildren(...children) { this.children = children; }
  addEventListener(name, callback) { this.listeners[name] = callback; }
  querySelectorAll(selector) {
    const matches = [];
    for (const child of this.children) {
      if (!(child instanceof Element)) continue;
      if ((child.className || "").split(" ").includes(selector.slice(1))) matches.push(child);
      matches.push(...child.querySelectorAll(selector));
    }
    return matches;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  scrollIntoView() {}
  click() {
    if (this.disabled) return;
    return this.listeners.click?.({ preventDefault() {}, stopPropagation() {}, target: this });
  }
}

async function withEnvironment(run) {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const storage = new Map();
  globalThis.document = {
    createElement: tag => new Element(tag),
    createTextNode: text => ({ textContent: text }),
    body: new Element("body"),
    querySelector: selector => globalThis.document.body.querySelector(selector)
  };
  globalThis.window = {
    confirm: () => { throw new Error("Native dialogs are blocked in embedded preview"); },
    localStorage: {
      getItem: key => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, value)
    }
  };
  try {
    await run();
  } finally {
    globalThis.document = previousDocument;
    globalThis.window = previousWindow;
  }
}

test("summary completion works with native dialogs blocked, cancels safely and persists after approval", async () => {
  await withEnvironment(async () => {
    const repositories = createRepositoryContext();
    repositories.sessions.create({ id: "session-1", status: "active" });
    const manager = new SessionManager(repositories.sessions);
    const finished = [];
    const screen = renderSessionScreen(repositories.sessions.findById("session-1"), {
      initialTab: "summary",
      students: [{ id: "student-1" }],
      actions: { finishSession: id => { finished.push(id); return manager.finishSession(id); } }
    });
    const toolbarFinish = screen.querySelector(".btn-tool-primary");
    toolbarFinish.click();
    assert.equal(document.querySelector(".confirm-dialog-backdrop"), null);
    const finish = screen.querySelector(".final-action-card").querySelector(".primary-action");
    let pending = finish.click();
    const dialog = document.querySelector(".confirm-dialog-backdrop");
    const message = dialog.querySelector(".confirm-dialog-body").children[0].textContent;
    assert.match(message, /1 siswa belum diabsen/);
    assert.match(message, /Belum ada aktivitas/);
    dialog.querySelector(".btn-tool").click();
    await pending;
    assert.deepEqual(finished, []);
    assert.equal(repositories.sessions.findById("session-1").status, "active");
    assert.equal(finish.disabled, false);
    pending = finish.click();
    finish.click(); // Repeated clicks must not create another operation.
    document.querySelector(".confirm-dialog-backdrop").querySelector(".primary-action").click();
    await pending;
    assert.deepEqual(finished, ["session-1"]);
    const completed = createRepositoryContext().sessions.findById("session-1");
    assert.equal(completed.status, "completed");
    assert.equal(completed.state, "COMPLETED");
    assert.ok(completed.endTime);
    assert.equal(completed.timeline.filter(event => event.type === "session-finished").length, 1);
    const archivedPanel = renderSummaryPanel({ session: completed });
    assert.ok(archivedPanel.querySelector(".summary-done-copy"));
    assert.equal(archivedPanel.querySelector(".primary-action"), null);
  });
});

test("summary displays a storage failure instead of silently ignoring completion", async () => {
  await withEnvironment(async () => {
    const repositories = createRepositoryContext();
    repositories.sessions.create({ id: "session-1", status: "active" });
    const manager = new SessionManager(repositories.sessions);
    const panel = renderSummaryPanel({
      session: repositories.sessions.findById("session-1"),
      onFinishSession: id => manager.finishSession(id)
    });
    window.localStorage.setItem = () => { throw new Error("Storage unavailable"); };
    const finish = panel.querySelector(".primary-action");
    const pending = finish.click();
    document.querySelector(".confirm-dialog-backdrop").querySelector(".primary-action").click();
    await pending;
    const finalCard = panel.querySelector(".final-action-card");
    assert.match(finalCard.children.at(-1).textContent, /Status sesi gagal disimpan/);
    assert.equal(repositories.sessions.findById("session-1").status, "active");
    assert.equal(finish.disabled, false);
  });
});
