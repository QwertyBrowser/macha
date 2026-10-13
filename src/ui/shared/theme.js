// Applies a theme to the current page. accentOverride is a hex color or null (= use the theme's accent).
function applyTheme(theme, accentOverride) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  if (accentOverride) root.style.setProperty('--accent', accentOverride);
  else root.style.removeProperty('--accent');
}
