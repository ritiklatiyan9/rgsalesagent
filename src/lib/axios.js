import axios from 'axios';
import { Preferences } from '@capacitor/preferences';

export const API_URL = 'https://rivergreenbackend.onrender.com/api';

// Persistence keys
const ACCESS_TOKEN_KEY = 'rg_access_token';
const REFRESH_TOKEN_KEY = 'rg_refresh_token';
const USER_DATA_KEY = 'rg_user_data';
const ACTIVE_SITE_KEY = 'rg_active_site_id';

// Helpers for native storage persistence
export const saveAuthData = async (token, user, refreshToken = null) => {
  if (token) await Preferences.set({ key: ACCESS_TOKEN_KEY, value: token });
  if (user) await Preferences.set({ key: USER_DATA_KEY, value: JSON.stringify(user) });
  if (refreshToken) await Preferences.set({ key: REFRESH_TOKEN_KEY, value: refreshToken });
};

export const saveActiveSiteId = async (siteId) => {
  if (!siteId) {
    await Preferences.remove({ key: ACTIVE_SITE_KEY });
    return;
  }
  await Preferences.set({ key: ACTIVE_SITE_KEY, value: String(siteId) });
};

export const getStoredActiveSiteId = async () => {
  const { value } = await Preferences.get({ key: ACTIVE_SITE_KEY });
  return value || null;
};

export const clearAuthData = async () => {
  await Preferences.remove({ key: ACCESS_TOKEN_KEY });
  await Preferences.remove({ key: REFRESH_TOKEN_KEY });
  await Preferences.remove({ key: USER_DATA_KEY });
  await Preferences.remove({ key: ACTIVE_SITE_KEY });
};

export const getStoredAuthData = async () => {
  const { value: token } = await Preferences.get({ key: ACCESS_TOKEN_KEY });
  const { value: refreshToken } = await Preferences.get({ key: REFRESH_TOKEN_KEY });
  const { value: userJson } = await Preferences.get({ key: USER_DATA_KEY });
  let user = null;
  try { user = userJson ? JSON.parse(userJson) : null; } catch { user = null; }
  return { token, refreshToken, user };
};

// Plain axios instance for auth calls
export const authAxios = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// Main API instance
const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

let accessToken = null;
let activeSiteId = null;

export const setAccessToken = (token) => {
  accessToken = token;
};

export const setActiveSiteId = (siteId) => {
  activeSiteId = siteId || null;
};

export const getActiveSiteId = () => activeSiteId;

export const getAccessToken = () => accessToken;

// Request interceptor: Attach token from memory OR native storage
api.interceptors.request.use(
  async (config) => {
    // If memory token is missing, try loading from native storage
    if (!accessToken) {
      const { token } = await getStoredAuthData();
      if (token) accessToken = token;
    }

    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }

    if (!activeSiteId) {
      activeSiteId = await getStoredActiveSiteId();
    }
    if (activeSiteId) {
      config.headers['x-site-id'] = activeSiteId;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Unified logout event
export const dispatchLogout = () => {
  window.dispatchEvent(new CustomEvent('auth:logout'));
};

// Response interceptor: Only logout on explicit 401/403
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error?.config || {};
    const status = error?.response?.status;

    if (status === 401 && !originalRequest._retry && !String(originalRequest.url || '').includes('/auth/refresh')) {
      originalRequest._retry = true;
      try {
        const { refreshToken } = await getStoredAuthData();
        const refreshHeaders = refreshToken ? { 'x-refresh-token': refreshToken } : {};
        const { data } = await authAxios.post('/auth/refresh', {}, { headers: refreshHeaders });

        if (data?.success && data?.accessToken) {
          accessToken = data.accessToken;
          const { user } = await getStoredAuthData();
          await saveAuthData(data.accessToken, user, data.refreshToken || refreshToken || null);
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
          return api(originalRequest);
        }
      } catch {
        // Fall through to hard logout below.
      }
    }

    // Logout only when authentication is truly invalid and refresh did not recover.
    if (status === 401) {
      accessToken = null;
      await clearAuthData();
      dispatchLogout();
    }

    // Do not auto-logout on 403. Permission errors can happen on specific resources.
    return Promise.reject(error);
  }
);

export default api;
export { api };



