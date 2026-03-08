import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { authAxios, setAccessToken } from '@/lib/axios';
import { warmCache, invalidateCache } from '@/lib/queryCache';

const WARM_URLS = [
    '/leads?page=1&limit=15',
    '/calls?limit=10',
    '/followups/counts',
];

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isTeamHead, setIsTeamHead] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const initialized = useRef(false);

  // Resolve whether the user is the team head by checking team.head_id
  // (assignTeamHead sets head_id on the team but does NOT change user.role)
  const resolveTeamHead = async (userData) => {
    if (!userData?.team_id) { setIsTeamHead(false); return; }
    try {
      const teamRes = await api.get(`/teams/${userData.team_id}`);
      if (teamRes.data.success) {
        const headId = teamRes.data.team?.head_id;
        setIsTeamHead(headId && String(headId) === String(userData.id));
      }
    } catch {
      setIsTeamHead(false);
    }
  };

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const initAuth = async () => {
      try {
        const { data } = await authAxios.post('/auth/refresh');
        if (data.success && data.accessToken) {
          setAccessToken(data.accessToken);
          const meRes = await api.get('/auth/me');
          if (meRes.data.success) {
            const userData = meRes.data.user;
            setUser(userData);
            await resolveTeamHead(userData);
            // Warmup cache in background to avoid blocking UI and infinite loops
            Promise.resolve().then(() => warmCache(WARM_URLS)).catch(() => {});
          }
        }
      } catch {
        // Not logged in
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  useEffect(() => {
    const handleForceLogout = () => {
      setUser(null);
      setAccessToken(null);
      navigate('/login', { replace: true });
    };
    window.addEventListener('auth:logout', handleForceLogout);
    return () => window.removeEventListener('auth:logout', handleForceLogout);
  }, [navigate]);

  const login = async (email, password) => {
    const { data } = await authAxios.post('/auth/login', { email, password });
    if (data.success) {
      if (!['AGENT', 'TEAM_HEAD'].includes(data.user.role)) {
        await authAxios.post('/auth/logout').catch(() => {});
        throw new Error('Access denied. Agent or Team Lead account required.');
      }
      setAccessToken(data.accessToken);
      setUser(data.user);
      await resolveTeamHead(data.user);
      // Warmup cache in background after setting token
      Promise.resolve().then(() => warmCache(WARM_URLS)).catch(() => {});
    }
    return data;
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // ignore — token may already be expired
    } finally {
      setUser(null);
      setIsTeamHead(false);
      setAccessToken(null);
      invalidateCache();
    }
  };

  // Refresh user data from server (e.g. after profile update)
  const refreshUser = async () => {
    try {
      const meRes = await api.get('/auth/me');
      if (meRes.data.success) {
        setUser(meRes.data.user);
      }
    } catch {
      // ignore
    }
  };

  return (
    <AuthContext.Provider value={{ user, isTeamHead, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};
