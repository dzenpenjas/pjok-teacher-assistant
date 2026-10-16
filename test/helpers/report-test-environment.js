// Minimal DOM for exercising the real report screen without browser/production storage.
export class ReportTestElement {
  constructor(tag = 'div', text = '') {
    this.tagName = tag.toUpperCase(); this.children = []; this._text = text;
    this.style = { setProperty() {} }; this.dataset = {}; this.listeners = {};
    this.className = ''; this.value = ''; this.disabled = false;
    this.classList = {
      add: (...names) => { this.className = [...new Set([...this.className.split(' '), ...names])].join(' '); },
      remove: (...names) => { this.className = this.className.split(' ').filter(n => !names.includes(n)).join(' '); },
      contains: (name) => this.className.split(' ').includes(name),
      toggle: (name, enabled) => enabled ? this.classList.add(name) : this.classList.remove(name)
    };
  }
  set textContent(value) { this._text = String(value); this.children = []; }
  get textContent() { return this._text + this.children.map(c => c.textContent ?? '').join(''); }
  append(...items) { for (const item of items) { const node = typeof item === 'string' ? new ReportTestElement('#text', item) : item; node.parentNode = this; this.children.push(node); } }
  appendChild(item) { this.append(item); return item; }
  replaceChildren(...items) { this.children = []; this._text = ''; this.append(...items); }
  removeChild(item) { this.children = this.children.filter(c => c !== item); item.parentNode = null; }
  remove() { this.parentNode?.removeChild(this); }
  setAttribute(name, value) { this[name] = value; }
  removeAttribute(name) { delete this[name]; }
  addEventListener(name, callback) { (this.listeners[name] ||= []).push(callback); }
  async click() { for (const callback of this.listeners.click || []) await callback({target:this, preventDefault(){}, stopPropagation(){}}); }
  querySelectorAll(selector) {
    const match = n => selector.startsWith('.') ? n.classList.contains(selector.slice(1)) : n.tagName === selector.toUpperCase();
    return this.children.flatMap(c => [...(match(c) ? [c] : []), ...c.querySelectorAll(selector)]);
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
}

export function installReportTestEnvironment(initialState) {
  const map = new Map([['pjokTeacherAssistant.state', JSON.stringify(initialState)]]);
  const alerts = [], errors = [];
  const storage = {getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,String(value)),removeItem:key=>map.delete(key)};
  const body = new ReportTestElement('body');
  globalThis.document = {
    body, createElement:tag=>new ReportTestElement(tag), createElementNS:(_,tag)=>new ReportTestElement(tag),
    createTextNode:text=>new ReportTestElement('#text',text), querySelector:()=>null, getElementById:()=>null,
    addEventListener(){}, removeEventListener(){}
  };
  globalThis.window = {localStorage:storage, sessionStorage:{getItem:()=>null,removeItem(){}},addEventListener(){},removeEventListener(){},history:{pushState(){}},alert:message=>alerts.push(message),confirm:()=>true};
  globalThis.localStorage = storage;
  globalThis.requestAnimationFrame = callback=>callback();
  return {storage,alerts,errors,read:()=>JSON.parse(storage.getItem('pjokTeacherAssistant.state'))};
}

export function findReportButton(screen, text) {
  return screen.querySelectorAll('button').find(button => button.textContent.includes(text));
}

export async function waitForReportBatch(ui) {
  const deadline = Date.now() + 1800000;
  while (ui.batchState?.isBatchGenerating) {
    if (Date.now() > deadline) throw new Error('Local test batch exceeded bounded deadline');
    await new Promise(resolve=>setTimeout(resolve,1));
  }
}
