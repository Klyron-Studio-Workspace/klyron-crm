export const THEME_KEY = "theme"
export const DARK_QUERY = "(prefers-color-scheme: dark)"

/**
 * Runs inline in <head> before first paint (app/layout.tsx) so the saved theme
 * applies without a flash. Keep in sync with applyTheme in lib/theme.ts.
 */
export const themeScript = `(function(){try{var t=localStorage.getItem("${THEME_KEY}");var d=t==="dark"||(t==="system"&&matchMedia("${DARK_QUERY}").matches);document.documentElement.classList.toggle("dark",d)}catch(e){}})()`
