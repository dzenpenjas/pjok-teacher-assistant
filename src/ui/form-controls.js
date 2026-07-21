export function createField({ label, name, type = "text", value = "", required = false }) {
  const wrapper = document.createElement("label");
  wrapper.className = "field";

  const text = document.createElement("span");
  text.textContent = label;

  const input = document.createElement("input");
  input.name = name;
  input.type = type;
  input.value = value || "";
  input.required = required;

  wrapper.append(text, input);
  return wrapper;
}

export function createSelectField({ label, name, value = "", options = [] }) {
  const wrapper = document.createElement("label");
  wrapper.className = "field";

  const text = document.createElement("span");
  text.textContent = label;

  const select = document.createElement("select");
  select.name = name;

  options.forEach((option) => {
    const item = document.createElement("option");
    item.value = option.value;
    item.textContent = option.label;
    item.selected = option.value === value;
    select.append(item);
  });

  wrapper.append(text, select);
  return wrapper;
}

export function createTextAreaField({ label, name, value = "" }) {
  const wrapper = document.createElement("label");
  wrapper.className = "field";

  const text = document.createElement("span");
  text.textContent = label;

  const input = document.createElement("textarea");
  input.name = name;
  input.rows = 3;
  input.value = value || "";

  wrapper.append(text, input);
  return wrapper;
}

export function formToObject(form) {
  return Object.fromEntries(new FormData(form).entries());
}
