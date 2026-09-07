import { SCREENS } from "../data/schema.js";
import { ICONS } from "./icons.js";

const NAV_ITEMS = [
  { id: SCREENS.dashboard, label: "Beranda", icon: () => ICONS.home(20) },
  { id: SCREENS.session, label: "Sesi Mengajar", icon: () => ICONS.whistle(20), isPrimary: true },
  { id: SCREENS.masterData, label: "Master Data", icon: () => ICONS.users(20) },
  { id: SCREENS.settings, label: "Pengaturan", icon: () => ICONS.settings(20) }
];

export function createNavigation(currentScreen, onNavigate) {
  const nav = document.createElement("nav");
  nav.className = "bottom-nav";
  nav.setAttribute("aria-label", "Navigasi utama");

  NAV_ITEMS.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    const isActive = item.id === currentScreen;
    button.className = `nav-button ${isActive ? "is-active" : ""} ${item.isPrimary ? "nav-button-primary" : ""}`.trim();
    button.setAttribute("aria-current", isActive ? "page" : "false");

    const iconWrap = document.createElement("span");
    iconWrap.className = "nav-icon";
    iconWrap.append(item.icon());

    const label = document.createElement("span");
    label.className = "nav-label";
    label.textContent = item.label;

    button.append(iconWrap, label);
    button.addEventListener("click", () => onNavigate(item.id));
    nav.append(button);
  });

  return nav;
}

