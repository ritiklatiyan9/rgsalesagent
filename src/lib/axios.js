import axios from 'axios';
import { Preferences } from '@capacitor/preferences';

export const API_URL = 'https://rivergreenbackend.onrender.com/api';

// Persistence keys
const ACCESS_TOKEN_KEY = 'rg_access_token';
const USER_DATA_KEY = 'rg_user_data';

// Helpers for native storage persistence
export const saveAuthData = async (token, user) => {
  if (token) await Preferences.set({ key: ACCESS_TOKEN_KEY, value: token });
  if (user) await Preferences.set({ key: USER_DATA_KEY, value: JSON.stringify(user) });
};

export const clearAuthData = async () => {
  await Preferences.remove({ key: ACCESS_TOKEN_KEY });
  await Preferences.remove({ key: USER_DATA_KEY });
};

export const getStoredAuthData = async () => {
  const { value: token } = await Preferences.get({ key: ACCESS_TOKEN_KEY });
  const { value: userJson } = await Preferences.get({ key: USER_DATA_KEY });
  let user = null;
  try { user = userJson ? JSON.parse(userJson) : null; } catch { user = null; }
  return { token, user };
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

export const setAccessToken = (token) => {
  accessToken = token;
};

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
    // 401 Unauthorized or 403 Forbidden means the token is truly invalid/revoked
    if (error.response?.status === 401 || error.response?.status === 403) {
      accessToken = null;
      await clearAuthData();
      dispatchLogout();
    }
    return Promise.reject(error);
  }
);

export default api;
export { api };



