// Applies the look of the app to the current page.
// s = { theme, accentOverride (hex or null), font }
function applyTheme(s) {
  const root = document.documentElement;
  root.dataset.theme = s.theme;
  root.dataset.font = s.font || 'system';
  if (s.accentOverride) root.style.setProperty('--accent', s.accentOverride);
  else root.style.removeProperty('--accent');
}
