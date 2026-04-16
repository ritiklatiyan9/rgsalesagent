import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, UserCheck, Shield, Crown, ChevronRight, Clock, Phone, Mail, RefreshCw } from 'lucide-react';
import { cachedGet, getCachedSync } from '@/lib/queryCache';
import { useAuth } from '@/context/AuthContext';

const CACHE_KEY = '/teams/my';

const ROLE_BADGE = {
  TEAM_HEAD: 'bg-violet-100 text-violet-700 border-violet-200',
  AGENT:     'bg-blue-100 text-blue-700 border-blue-200',
};

/* ── Skeleton loader ── */
const MemberSkeleton = () => (
  <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-white border border-slate-100 shadow-sm">
    <Skeleton className="h-11 w-11 rounded-xl shrink-0" />
    <div className="flex-1 space-y-1.5">
      <Skeleton className="h-4 w-36 rounded" />
      <Skeleton className="h-3 w-28 rounded" />
      <Skeleton className="h-3 w-20 rounded" />
    </div>
    <Skeleton className="h-6 w-16 rounded-full shrink-0" />
  </div>
);

const TeamMembers = () => {
  const { user, isTeamHead } = useAuth();
  const navigate = useNavigate();

  // ── instant-load from cache
  const _init = getCachedSync(CACHE_KEY);
  const hasDataRef = useRef(!!(_init?.team));

  const [team, setTeam]       = useState(_init?.team ?? null);
  const [members, setMembers] = useState(_init?.members ?? []);
  const [loading, setLoading] = useState(!hasDataRef.current);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]     = useState(null);

  const fetchTeam = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else if (!hasDataRef.current) setLoading(true);
    setError(null);
    try {
      const data = await cachedGet(CACHE_KEY, {
        staleTime: 60_000,
        cacheTime: 300_000,
        force: isRefresh,
      });
      if (data?.success) {
        setTeam(data.team ?? null);
        setMembers(data.members ?? []);
        hasDataRef.current = true;
      } else if (!data?.success && !_init?.team) {
        setError('not_in_team');
      }
    } catch (err) {
      if (err?.response?.status === 404) {
        setError('not_in_team');
      } else {
        setError('fetch_failed');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchTeam(); }, [fetchTeam]);

  // derived
  const headIds   = (team?.heads ?? []).map(h => String(h.id));
  const isHead    = (id) => headIds.includes(String(id));
  const headCount = members.filter(m => isHead(m.id)).length;
  const agentCount = members.filter(m => !isHead(m.id)).length;

  /* ── Not in team ── */
  if (!loading && error === 'not_in_team') return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="h-16 w-16 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center mb-4">
        <Users className="h-8 w-8 text-slate-300" />
      </div>
      <p className="text-[15px] font-bold text-slate-700">Not assigned to a team</p>
      <p className="text-[12px] text-slate-400 mt-1.5 max-w-[260px] leading-relaxed">
        Contact your admin to be added to a team.
      </p>
    </div>
  );

  /* ── Fetch error ── */
  if (!loading && error === 'fetch_failed' && !team) return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <p className="text-[14px] font-semibold text-slate-600">Failed to load team</p>
      <button
        onClick={() => fetchTeam(true)}
        className="mt-3 text-[12px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors"
      >
        <RefreshCw className="h-3.5 w-3.5" /> Try again
      </button>
    </div>
  );

  return (
    <div className="space-y-4 pb-8">

      {/* ── Team header banner ── */}
      <div className="relative overflow-hidden rounded-2xl bg-linear-to-r from-indigo-600 to-violet-600 p-4 shadow-md">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-white/15 border border-white/25 flex items-center justify-center shrink-0">
              <Users className="h-5 w-5 text-white" />
            </div>
            <div>
              {loading ? (
                <>
                  <Skeleton className="h-4 w-32 rounded bg-white/20 mb-1" />
                  <Skeleton className="h-3 w-20 rounded bg-white/15" />
                </>
              ) : (
                <>
                  <p className="text-[15px] font-extrabold text-white leading-tight">{team?.name || 'My Team'}</p>
                  <p className="text-[11px] text-indigo-200/80 font-medium mt-0.5">
                    {headCount} head{headCount !== 1 ? 's' : ''} · {agentCount} agent{agentCount !== 1 ? 's' : ''}
                  </p>
                </>
              )}
            </div>
          </div>
          <div className="text-right shrink-0 flex items-center gap-2">
            {refreshing && (
              <RefreshCw className="h-4 w-4 text-white/60 animate-spin" />
            )}
            {loading ? (
              <Skeleton className="h-10 w-12 rounded-xl bg-white/20" />
            ) : (
              <div className="text-center">
                <p className="text-2xl font-extrabold text-white leading-none">{members.length}</p>
                <p className="text-[9px] text-indigo-200 uppercase tracking-wide font-semibold mt-0.5">members</p>
              </div>
            )}
          </div>
        </div>
        <svg className="absolute bottom-0 left-0 w-full pointer-events-none" height="24" viewBox="0 0 400 24" preserveAspectRatio="none">
          <path d="M0,16 C80,2 200,22 320,8 C380,0 400,10 400,10 L400,24 L0,24 Z" fill="#fff" opacity="0.06" />
        </svg>
      </div>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total', value: members.length, icon: Users, cls: 'text-indigo-600 bg-indigo-50' },
          { label: 'Heads', value: headCount,       icon: Shield,    cls: 'text-violet-600 bg-violet-50' },
          { label: 'Agents', value: agentCount,     icon: UserCheck, cls: 'text-sky-600 bg-sky-50' },
        ].map(({ label, value, icon: Icon, cls }) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3 flex flex-col items-center gap-1.5">
            <div className={`h-8 w-8 rounded-xl flex items-center justify-center ${cls}`}>
              <Icon className="h-4 w-4" />
            </div>
            {loading ? <Skeleton className="h-5 w-8 rounded" /> : (
              <p className="text-[18px] font-extrabold text-slate-800 leading-none">{value}</p>
            )}
            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">{label}</p>
          </div>
        ))}
      </div>

      {/* ── Member list ── */}
      {loading ? (
        <div className="space-y-2.5">
          {Array.from({ length: 5 }).map((_, i) => <MemberSkeleton key={i} />)}
        </div>
      ) : members.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Users className="h-10 w-10 text-slate-200 mb-3" />
          <p className="text-[13px] font-semibold text-slate-500">No members yet</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {members.map((m, idx) => {
            const isMemberHead = isHead(m.id);
            const isMe = String(m.id) === String(user?.id);
            const initials = (m.name || '?').charAt(0).toUpperCase();

            return (
              <div
                key={m.id}
                className={`relative overflow-hidden rounded-2xl bg-white border shadow-sm transition-all duration-150 active:scale-[0.99] ${
                  isTeamHead ? 'cursor-pointer hover:shadow-md hover:border-indigo-200 active:scale-[0.99]' : ''
                } ${isMemberHead ? 'border-violet-200/80' : isMe ? 'border-indigo-200/80' : 'border-slate-200/80'}`}
                onClick={isTeamHead ? () => navigate(`/team/member/${m.id}`) : undefined}
              >
                {/* Left accent */}
                <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl ${
                  isMemberHead ? 'bg-linear-to-b from-violet-400 to-purple-500' :
                  isMe         ? 'bg-linear-to-b from-indigo-400 to-blue-500' :
                                 'bg-slate-200'
                }`} />

                <div className="flex items-center gap-3 pl-4 pr-3.5 py-3.5">
                  {/* Avatar */}
                  <div className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ${
                    isMemberHead ? 'bg-violet-100 border border-violet-200' :
                    isMe         ? 'bg-indigo-100 border border-indigo-200' :
                                   'bg-slate-100 border border-slate-200'
                  }`}>
                    {m.profile_photo ? (
                      <img src={m.profile_photo} alt={m.name} className="w-full h-full rounded-xl object-cover" loading="lazy" />
                    ) : (
                      <span className={`text-[15px] font-bold ${
                        isMemberHead ? 'text-violet-700' : isMe ? 'text-indigo-700' : 'text-slate-600'
                      }`}>{initials}</span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-[13.5px] font-bold text-slate-900 truncate leading-snug">{m.name || 'Unnamed'}</p>
                      {isMe && (
                        <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200">You</span>
                      )}
                      {!m.is_active && (
                        <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200">Inactive</span>
                      )}
                    </div>

                    {m.email && (
                      <p className="text-[11px] text-slate-400 font-medium mt-0.5 truncate flex items-center gap-1">
                        <Mail className="h-3 w-3 shrink-0" />{m.email}
                      </p>
                    )}
                    {m.phone && (
                      <p className="text-[11px] text-slate-400 font-medium truncate flex items-center gap-1">
                        <Phone className="h-3 w-3 shrink-0" />{m.phone}
                      </p>
                    )}

                    <div className="flex items-center gap-2 mt-1.5">
                      {isMemberHead ? (
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full border bg-violet-50 text-violet-700 border-violet-200">
                          <Crown className="h-2.5 w-2.5" /> Team Head
                        </span>
                      ) : (
                        <span className={`inline-flex items-center text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full border ${ROLE_BADGE[m.role] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                          {m.role?.replace(/_/g, ' ')}
                        </span>
                      )}
                      {m.created_at && (
                        <span className="flex items-center gap-1 text-[10px] text-slate-400 font-medium">
                          <Clock className="h-2.5 w-2.5" />
                          {new Date(m.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right caret for team head navigation */}
                  {isTeamHead && (
                    <ChevronRight className="h-4 w-4 text-slate-300 shrink-0" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Footer ── */}
      {!loading && members.length > 0 && (
        <p className="text-center text-[10px] text-slate-400 font-medium">
          {members.length} member{members.length !== 1 ? 's' : ''} in {team?.name || 'your team'}
        </p>
      )}
    </div>
  );
};

export default TeamMembers;
