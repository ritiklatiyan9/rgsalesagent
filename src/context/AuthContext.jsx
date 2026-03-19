import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api, {
  authAxios,
  setAccessToken,
  setActiveSiteId,
  saveAuthData,
  clearAuthData,
  getStoredAuthData,
  getStoredActiveSiteId,
  saveActiveSiteId,
  dispatchLogout,
} from '@/lib/axios';
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
  const [siteLoading, setSiteLoading] = useState(false);
  const [sites, setSites] = useState([]);
  const [activeSiteId, setActiveSiteIdState] = useState(null);
  const navigate = useNavigate();
  const initialized = useRef(false);

  const hasTeamHeadRole = useCallback((userData) => String(userData?.role || '').toUpperCase() === 'TEAM_HEAD', []);

  const syncSiteState = useCallback(async (siteId) => {
    const normalized = siteId ? String(siteId) : null;
    setActiveSiteIdState(normalized);
    setActiveSiteId(normalized);
    setUser((prev) => (prev ? { ...prev, site_id: normalized } : prev));
    await saveActiveSiteId(normalized);
  }, []);

  const loadAccessibleSites = async ({ ensureDefault = true } = {}) => {
    try {
      setSiteLoading(true);
      const { data } = await api.get('/auth/sites');
      if (!data?.success) return { sites: [], activeSiteId: null };

      const nextSites = Array.isArray(data.sites) ? data.sites : [];
      setSites(nextSites);

      const storedSiteId = await getStoredActiveSiteId();
      const preferredSiteId = storedSiteId || data.active_site_id || user?.site_id || null;
      const chosenSite = nextSites.find((site) => String(site.id) === String(preferredSiteId)) || nextSites[0] || null;

      if (!chosenSite) {
        await syncSiteState(null);
        return { sites: nextSites, activeSiteId: null };
      }

      const chosenSiteId = String(chosenSite.id);
      await syncSiteState(chosenSiteId);

      if (ensureDefault && String(data.active_site_id || '') !== chosenSiteId) {
        await switchSite(chosenSiteId, { silent: true, warmAfterSwitch: false });
      }

      return { sites: nextSites, activeSiteId: chosenSiteId };
    } catch {
      return { sites: [], activeSiteId: null };
    } finally {
      setSiteLoading(false);
    }
  };

  const switchSite = async (siteId, { silent = false, warmAfterSwitch = true } = {}) => {
    if (!siteId) return false;

    try {
      if (!silent) setSiteLoading(true);
      const { data } = await api.put('/auth/active-site', { site_id: siteId });
      if (!data?.success) return false;

      if (data.accessToken) {
        setAccessToken(data.accessToken);
      }

      const { token, refreshToken, user: storedUser } = await getStoredAuthData();
      const nextToken = data.accessToken || token;
      const nextUser = { ...(storedUser || user || {}), site_id: siteId };
      if (nextToken) await saveAuthData(nextToken, nextUser, refreshToken || null);

      await syncSiteState(siteId);
      invalidateCache();
      if (warmAfterSwitch) warmCache(WARM_URLS);
      return true;
    } catch {
      return false;
    } finally {
      if (!silent) setSiteLoading(false);
    }
  };

  // Resolve whether the user is the team head by checking team.head_id
  const resolveTeamHead = async (userData) => {
    const roleBasedTeamHead = hasTeamHeadRole(userData);

    if (!userData?.team_id) {
      setIsTeamHead(roleBasedTeamHead);
      return;
    }

    try {
      const teamRes = await api.get(`/teams/${userData.team_id}`);
      if (teamRes.data.success) {
        const headId = teamRes.data.team?.head_id;
        const teamBasedTeamHead = Boolean(headId && String(headId) === String(userData.id));
        setIsTeamHead(teamBasedTeamHead || roleBasedTeamHead);
        return;
      }
      setIsTeamHead(roleBasedTeamHead);
    } catch {
      // Keep role-based access even if team lookup fails intermittently.
      setIsTeamHead(roleBasedTeamHead);
    }
  };

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const initAuth = async () => {
      try {
        // Immediate load from native storage for "Instant UI"
        const { token, refreshToken, user: storedUser } = await getStoredAuthData();
        
        if (token && storedUser) {
          setAccessToken(token);
          setUser(storedUser);
          setIsTeamHead(hasTeamHeadRole(storedUser));
          await syncSiteState(storedUser.site_id || (await getStoredActiveSiteId()));
          await resolveTeamHead(storedUser);
          await loadAccessibleSites({ ensureDefault: true });
          
          // Background sync profile (don't block UI or wait for Render)
          api.get('/auth/me').then(async (res) => {
            if (res.data.success) {
              const updatedUser = res.data.user;
              setUser(updatedUser);
              setIsTeamHead(hasTeamHeadRole(updatedUser));
              await saveAuthData(token, updatedUser, refreshToken || null);
              await syncSiteState(updatedUser.site_id || (await getStoredActiveSiteId()));
              await loadAccessibleSites({ ensureDefault: true });
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
      setSites([]);
      await syncSiteState(null);
      await clearAuthData();
      navigate('/login', { replace: true });
    };
    window.addEventListener('auth:logout', handleForceLogout);
    return () => window.removeEventListener('auth:logout', handleForceLogout);
  }, [navigate, syncSiteState]);

  const login = async (email, password) => {
    const { data } = await authAxios.post('/auth/login', { email, password });
    if (data.success) {
      if (!['AGENT', 'TEAM_HEAD'].includes(data.user.role)) {
        await authAxios.post('/auth/logout').catch(() => {});
        throw new Error('Access denied. Agent or Team Lead account required.');
      }
      
      setAccessToken(data.accessToken);
      // Persist access + refresh tokens so session can be renewed automatically.
      await saveAuthData(data.accessToken, data.user, data.refreshToken || null);
      
      setUser(data.user);
      setIsTeamHead(hasTeamHeadRole(data.user));
      await syncSiteState(data.user.site_id || null);
      await loadAccessibleSites({ ensureDefault: true });
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
      setSites([]);
      await syncSiteState(null);
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
        setIsTeamHead(hasTeamHeadRole(updatedUser));
        const { token, refreshToken } = await getStoredAuthData();
        await saveAuthData(token, updatedUser, refreshToken || null);
        await syncSiteState(updatedUser.site_id || (await getStoredActiveSiteId()));
        await resolveTeamHead(updatedUser);
      }
    } catch {
      // ignore
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      isTeamHead,
      loading,
      login,
      logout,
      refreshUser,
      sites,
      activeSiteId,
      switchSite,
      siteLoading,
      refreshSites: loadAccessibleSites,
    }}>
      {children}
    </AuthContext.Provider>
  );
};
