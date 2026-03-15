import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { authAxios, setAccessToken, saveAuthData, clearAuthData, getStoredAuthData, dispatchLogout } from '@/lib/axios';
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
        // Immediate load from native storage for "Instant UI"
        const { token, user: storedUser } = await getStoredAuthData();
        
        if (token && storedUser) {
          setAccessToken(token);
          setUser(storedUser);
          await resolveTeamHead(storedUser);
          
          // Background sync profile (don't block UI or wait for Render)
          api.get('/auth/me').then(async (res) => {
            if (res.data.success) {
              const updatedUser = res.data.user;
              setUser(updatedUser);
              await saveAuthData(token, updatedUser);
              await resolveTeamHead(updatedUser);
            }
          }).catch(err => {
            console.log('[Auth] Background profile sync failed (possibly server sleeping):', err.message);
          });

          Promise.resolve().then(() => warmCache(WARM_URLS)).catch(() => {});
        }
      } catch (err) {
        console.error('[Auth] initAuth error:', err.message);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  useEffect(() => {
    const handleForceLogout = async () => {
      setUser(null);
      setAccessToken(null);
      await clearAuthData();
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
      // Persist the 100-year session data
      await saveAuthData(data.accessToken, data.user);
      
      setUser(data.user);
      await resolveTeamHead(data.user);
      Promise.resolve().then(() => warmCache(WARM_URLS)).catch(() => {});
    }
    return data;
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // ignore
    } finally {
      setUser(null);
      setIsTeamHead(false);
      setAccessToken(null);
      await clearAuthData();
      invalidateCache();
    }
  };


  // Refresh user data from server (e.g. after profile update)
  const refreshUser = async () => {
    try {
      const meRes = await api.get('/auth/me');
      if (meRes.data.success) {
        const updatedUser = meRes.data.user;
        setUser(updatedUser);
        const { token } = await getStoredAuthData();
        await saveAuthData(token, updatedUser);
        await resolveTeamHead(updatedUser);
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
