function getBaseUrl() {
  if ((import.meta as any).env?.VITE_API_BASE_URL) {
    return (import.meta as any).env.VITE_API_BASE_URL;
  }
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    const port = window.location.port;

    // If running on SME deployment port 3001, route API to port 5001 on the same server IP/host
    if (port === '3001') {
      return `${window.location.protocol}//${host}:5001`;
    }
    // If running on local dev port 3000, route API to the active backend on port 4001
    if (port === '3000') {
      return `${window.location.protocol}//${host}:4001`;
    }
    // If local dev server (port 5173 or localhost without docker)
    if (['localhost', '127.0.0.1', '::1'].includes(host)) {
      return 'http://localhost:4001';
    }
    // Production Vercel Deployment Fallback (Monolithic)
    if (host.includes('vercel.app') || host.includes('palmtree') || host.includes('jioplix')) {
      return window.location.origin;
    }
  }
  return '';
}

export const API_BASE_URL = getBaseUrl();
