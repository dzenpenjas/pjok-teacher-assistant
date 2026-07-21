import { SCREENS } from "../data/schema.js";

const NAV_ITEMS = [
  { id: SCREENS.dashboard, label: "Beranda" },
  { id: SCREENS.masterData, label: "Master" },
  { id: SCREENS.session, label: "Sesi" },
  { id: SCREENS.settings, label: "Data" }
];

export function createNavigation(currentScreen, onNavigate) {
  const nav = document.createElement("nav");
  nav.className = "bottom-nav";
  nav.setAttribute("aria-label", "Navigasi utama");

  NAV_ITEMS.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = item.id === currentScreen ? "nav-button is-active" : "nav-button";
    button.textContent = item.label;
    button.setAttribute("aria-current", item.id === currentScreen ? "page" : "false");
    button.addEventListener("click", () => onNavigate(item.id));
    nav.append(button);
  });

  return nav;
}
