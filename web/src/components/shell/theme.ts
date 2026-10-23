/** Theme preference: "system" follows the OS; "light"/"dark" set data-theme on <html>. */
export type ThemePref = "system" | "light" | "dark";

export const THEME_STORAGE_KEY = "cn-theme";

/** Inline script for <head>: applies a saved theme before first paint (no flash). */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t);}catch(e){}})();`;

export function readThemePref(): ThemePref {
  try {
    const t = localStorage.getItem(THEME_STORAGE_KEY);
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system";
  }
}

export function applyThemePref(t: ThemePref) {
  const el = document.documentElement;
  if (t === "system") el.removeAttribute("data-theme");
  else el.setAttribute("data-theme", t);
  try {
    if (t === "system") localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, t);
  } catch {
    /* storage unavailable: the choice lasts for this page view */
  }
}
