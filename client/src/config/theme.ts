export const getTenantBrandingConfig = (): boolean => {
  const isTenantUser = localStorage.getItem('userType') === 'tenant';
  const pathname = window.location.pathname;
  const isTenantRoute = pathname !== '/' && pathname !== '/mobile' && !pathname.startsWith('/nexus');
  return isTenantUser && isTenantRoute;
};

// Helpers to namespace localStorage keys per-tenant to avoid cross-tenant leakage
export const getTenantId = (): string => {
  return localStorage.getItem('tenant') || '';
};

export const tenantKey = (key: string): string => {
  const t = getTenantId();
  return t ? `${t}__${key}` : key;
};

export const getNamespacedItem = (key: string): string | null => {
  const namespaced = localStorage.getItem(tenantKey(key));
  if (namespaced !== null && namespaced !== undefined) return namespaced;
  return localStorage.getItem(key);
};

export const setNamespacedItem = (key: string, value: string) => {
  localStorage.setItem(tenantKey(key), value);
};

// ── Palmtree Wellness Brand Defaults ──
const PALMTREE_PRIMARY_DARK    = '#003870';   
const PALMTREE_PRIMARY_ACCENT  = '#0056A3';   
const PALMTREE_APP_BG          = '#F3F4F6';   
const PALMTREE_TEXT_MAIN       = '#0F172A';
const PALMTREE_HERO_BG         = 'linear-gradient(135deg, #003870 0%, #0056A3 100%)';
const PALMTREE_HERO_TEXT       = '#ffffff';
const PALMTREE_SIDEBAR_TEXT    = '#94b8d4';   // Muted blue-slate for sidebar items

export const applyTheme = () => {
  const useTenantBranding = getTenantBrandingConfig();

  let primaryDark   = useTenantBranding ? (getNamespacedItem('theme_primary_dark')   || PALMTREE_PRIMARY_DARK)   : PALMTREE_PRIMARY_DARK;
  let primaryAccent = useTenantBranding ? (getNamespacedItem('theme_primary_accent') || PALMTREE_PRIMARY_ACCENT) : PALMTREE_PRIMARY_ACCENT;
  let appBg         = useTenantBranding ? (getNamespacedItem('theme_app_bg')         || PALMTREE_APP_BG)         : PALMTREE_APP_BG;
  let textMain      = useTenantBranding ? (getNamespacedItem('theme_text_main')       || PALMTREE_TEXT_MAIN)      : PALMTREE_TEXT_MAIN;
  let heroBg        = useTenantBranding ? (getNamespacedItem('theme_hero_bg')         || PALMTREE_HERO_BG)        : PALMTREE_HERO_BG;
  let heroText      = useTenantBranding ? (getNamespacedItem('theme_hero_text')       || PALMTREE_HERO_TEXT)      : PALMTREE_HERO_TEXT;
  let sidebarText   = useTenantBranding ? (getNamespacedItem('theme_sidebar_text')   || PALMTREE_SIDEBAR_TEXT)   : PALMTREE_SIDEBAR_TEXT;
  let fontSize      = useTenantBranding ? (getNamespacedItem('theme_font_size')       || '14')                   : '14';

  // Migrate legacy indigo/purple defaults → Palmtree brand
  if (primaryAccent === '#3b82f6' || primaryAccent === '#6366f1') {
    primaryAccent = PALMTREE_PRIMARY_ACCENT;
    if (useTenantBranding) setNamespacedItem('theme_primary_accent', PALMTREE_PRIMARY_ACCENT);
  }
  if (appBg === '#f8fafc' || appBg === '#ffffff' || appBg === '#f4f6fa') {
    appBg = PALMTREE_APP_BG;
    if (useTenantBranding) setNamespacedItem('theme_app_bg', PALMTREE_APP_BG);
  }
  if (textMain === '#1e293b') {
    textMain = PALMTREE_TEXT_MAIN;
    if (useTenantBranding) setNamespacedItem('theme_text_main', PALMTREE_TEXT_MAIN);
  }
  if (heroBg === '#ffffff'
    || heroBg === 'linear-gradient(135deg, #e0e7ff 0%, #e0f2fe 100%)'
    || heroBg === 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)') {
    heroBg = PALMTREE_HERO_BG;
    if (useTenantBranding) setNamespacedItem('theme_hero_bg', PALMTREE_HERO_BG);
  }
  if (heroText === '#0f172a' || heroText === '#1e293b') {
    heroText = PALMTREE_HERO_TEXT;
    if (useTenantBranding) setNamespacedItem('theme_hero_text', PALMTREE_HERO_TEXT);
  }

  const root = document.documentElement;
  root.style.setProperty('--primary-dark', primaryDark);
  root.style.setProperty('--primary-accent', primaryAccent);
  root.style.setProperty('--app-bg', appBg);
  root.style.setProperty('--text-main', textMain);
  root.style.setProperty('--hero-bg', heroBg);
  root.style.setProperty('--hero-text', heroText);
  root.style.setProperty('--sidebar-text', sidebarText);
  root.style.setProperty('--base-font-size', `${fontSize}px`);
  document.body.style.fontSize = `${fontSize}px`;
};

