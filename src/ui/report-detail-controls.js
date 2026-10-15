export function createReportDetailControls(options, onChange, disabled = false) {
  const box = document.createElement("fieldset");
  box.className = "space-y-2 mt-3 p-3 border rounded-lg";
  const title = document.createElement("legend");
  title.className = "font-semibold text-sm";
  title.textContent = "Detail nilai dalam laporan";
  box.append(title);
  const values = { enabled: options?.enabled === true, descriptions: options?.descriptions !== false };
  const inputs = {};
  for (const [key, text] of [["enabled", "Tampilkan detail nilai per asesmen"], ["descriptions", "Sertakan deskripsi capaian di bawah setiap nilai"]]) {
    const label = document.createElement("label");
    label.className = "flex items-center gap-2 text-sm cursor-pointer";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.className = "report-source-check";
    input.checked = values[key];
    input.disabled = disabled || (key === "descriptions" && !values.enabled);
    inputs[key] = input;
    input.addEventListener("change", () => {
      values[key] = input.checked;
      inputs.descriptions.disabled = disabled || !values.enabled;
      onChange({ ...values });
    });
    label.append(input, document.createTextNode(text));
    box.append(label);
  }
  const hint = document.createElement("p");
  hint.className = "text-xs text-subtle";
  hint.textContent = "Berlaku pada pratinjau dan PDF. Deskripsi diambil dari rubrik yang dipilih dan catatan guru pada asesmen.";
  box.append(hint);
  return box;
}
