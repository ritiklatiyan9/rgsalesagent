import axios from 'axios';

export const API_URL = 'https://rivergreenbackend.onrender.com/api';

// Plain axios instance for auth calls (no interceptors — avoids refresh loops)
export const authAxios = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// Main API instance (with interceptors for protected routes)
const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

let accessToken = null;
let _hasDispatchedLogout = false;

export const setAccessToken = (token) => {
  accessToken = token;
  if (token) _hasDispatchedLogout = false;
};

export const getAccessToken = () => accessToken;

// Request interceptor
api.interceptors.request.use(
  (config) => {
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor — auto-refresh on 401
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const isRefreshEndpoint = originalRequest.url?.includes('/auth/refresh');
    const isLoginEndpoint = originalRequest.url?.includes('/auth/login');

    // Handle 403 Forbidden separately — do NOT attempt refresh
    if (error.response?.status === 403) {
      return Promise.reject(error);
    }

    if (
      error.response?.status !== 401 ||
      originalRequest._retry ||
      isRefreshEndpoint ||
      isLoginEndpoint
    ) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        })
        .catch((err) => Promise.reject(err));
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const { data } = await authAxios.post('/auth/refresh');
      if (data.success && data.accessToken) {
        accessToken = data.accessToken;
        processQueue(null, data.accessToken);
        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(originalRequest);
      }
      throw new Error('Refresh failed');
    } catch (refreshError) {
      processQueue(refreshError, null);
      accessToken = null;
      if (!_hasDispatchedLogout) {
        _hasDispatchedLogout = true;
        window.dispatchEvent(new CustomEvent('auth:logout'));
      }
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export default api;
export { api };
