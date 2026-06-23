/* ============================================================
   settings.js
   Handles:
   - Website branding settings (name, logo, header title)
   - Theme (light/dark) persistence + toggle
   - These are read on every page (index, product, admin) so
     that changes made in the Admin > Settings page show up
     immediately on the public site.
   ============================================================ */

const SETTINGS_KEY = "bazar_settings";
const THEME_KEY = "bazar_theme";

/** Default settings used the very first time the site loads */
const DEFAULT_SETTINGS = {
  siteName: "Bazar",
  headerTitle: "Buy & sell, the local way",
  logoUrl: "" // empty => fallback to a generated letter mark
};

/** Read settings object from localStorage (merged with defaults) */
function getSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS };
  } catch (e) {
    console.error("Failed to read settings:", e);
    return { ...DEFAULT_SETTINGS };
  }
}

/** Persist settings object to localStorage */
function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

/** Apply current settings to the DOM: brand name, logo, tab title, header tagline */
function applySettingsToPage() {
  const settings = getSettings();

  document.querySelectorAll("[data-bind='siteName']").forEach(el => {
    el.textContent = settings.siteName;
  });
  document.querySelectorAll("[data-bind='headerTitle']").forEach(el => {
    el.textContent = settings.headerTitle;
  });
  document.querySelectorAll("[data-bind='logo']").forEach(el => {
    if (settings.logoUrl) {
      el.src = settings.logoUrl;
      el.style.display = "block";
    } else {
      // Fallback: simple generated letter-mark so layout never breaks
      el.src = "data:image/svg+xml;utf8," + encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" rx="8" fill="#1f7a6c"/><text x="20" y="27" font-family="Georgia,serif" font-size="20" fill="white" text-anchor="middle">${(settings.siteName || "B").charAt(0)}</text></svg>`
      );
    }
  });

  document.title = document.title.includes("|")
    ? `${document.title.split("|")[0].trim()} | ${settings.siteName}`
    : `${settings.siteName} — ${settings.headerTitle}`;
}

/* ---------------- Theme handling ---------------- */

function getTheme() {
  return localStorage.getItem(THEME_KEY) || "light";
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem(THEME_KEY, theme);
  document.querySelectorAll(".theme-toggle-icon-light").forEach(el => el.style.display = theme === "dark" ? "none" : "block");
  document.querySelectorAll(".theme-toggle-icon-dark").forEach(el => el.style.display = theme === "dark" ? "block" : "none");
}

function toggleTheme() {
  applyTheme(getTheme() === "dark" ? "light" : "dark");
}

/* Apply theme + settings as early as possible to avoid a flash of wrong theme */
applyTheme(getTheme());
document.addEventListener("DOMContentLoaded", applySettingsToPage);

/* Keep pages in sync if settings change in another tab (e.g. admin tab) */
window.addEventListener("storage", (e) => {
  if (e.key === SETTINGS_KEY) applySettingsToPage();
  if (e.key === THEME_KEY) applyTheme(getTheme());
});
