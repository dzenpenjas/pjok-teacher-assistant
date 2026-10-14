import test from "node:test";
import assert from "node:assert/strict";
import { renderSessionScreen } from "../src/session/session-screen.js";

class Element {
  constructor(tagName) {
    this.tagName = tagName;
    this.children = [];
    this.style = {};
    this.dataset = {};
    this.listeners = {};
    this.classList = { toggle() {} };
  }
  append(...children) { this.children.push(...children); }
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
  click() { this.listeners.click?.(); }
}

test("toolbar completion confirms incomplete data and only finishes when accepted", () => {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  let accepted = false;
  const confirmations = [];
  const finished = [];
  globalThis.document = {
    createElement: tag => new Element(tag),
    createTextNode: text => ({ textContent: text })
  };
  globalThis.window = {
    confirm: message => { confirmations.push(message); return accepted; }
  };
  try {
    const screen = renderSessionScreen({ id: "session-1", status: "active" }, {
      initialTab: "summary",
      students: [{ id: "student-1" }],
      actions: { finishSession: id => finished.push(id) }
    });
    const toolbarFinish = screen.querySelector(".btn-tool-primary");
    toolbarFinish.click();
    assert.equal(confirmations.length, 1);
    assert.match(confirmations[0], /1 siswa belum diabsen/);
    assert.match(confirmations[0], /Belum ada aktivitas/);
    assert.deepEqual(finished, []);
    accepted = true;
    toolbarFinish.click();
    assert.equal(confirmations.length, 2);
    assert.deepEqual(finished, ["session-1"]);
  } finally {
    globalThis.document = previousDocument;
    globalThis.window = previousWindow;
  }
});
