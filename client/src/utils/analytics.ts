import posthog from 'posthog-js';

export const initAnalytics = () => {
  const apiKey = (import.meta as any).env?.VITE_POSTHOG_KEY;
  const apiHost = (import.meta as any).env?.VITE_POSTHOG_HOST || 'https://app.posthog.com';
  if (!apiKey) return;
  posthog.init(apiKey, {
    api_host: apiHost,
    autocapture: true,
    capture_pageview: true,
    persistence: 'localStorage'
  });
};

export const identifyUser = (user: { id: string; email: string; role: string; tenant: string }) => {
  posthog.identify(user.id, {
    email: user.email,
    role: user.role,
    tenant_id: user.tenant,
  });
};

export const trackEvent = (eventName: string, properties?: Record<string, any>) => {
  posthog.capture(eventName, properties);
};

export default posthog;
