import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft, RefreshCw, Phone, Target, CheckCircle2,
  Flame, TrendingUp, Crown, Activity, PhoneCall,
  AlertCircle, Award, Users, Zap,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import api from '@/lib/axios';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';

const fmtNum = (n) => Number(n || 0).toLocaleString('en-IN');
const fmtDur = (sec) => {
  if (!sec) return '—';
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
};

const ChartTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-md text-xs">
      <p className="text-slate-500 mb-1">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 justify-between">
          <span className="text-slate-600">{p.name}</span>
          <span className="font-semibold text-slate-800">{fmtNum(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

/* compact stat tile */
const Stat = ({ label, value, sub, icon: Icon, loading }) => (
  <div className="bg-white border border-slate-100 rounded-xl px-3 py-3">
    <div className="flex items-center justify-between mb-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <Icon className="h-3.5 w-3.5 text-slate-300" />
    </div>
    {loading
      ? <Skeleton className="h-5 w-14 rounded" />
      : <p className="text-[17px] font-bold text-slate-800 tabular-nums leading-none">{value}</p>}
    {sub && !loading && <p className="text-[10px] text-slate-400 mt-1">{sub}</p>}
  </div>
);

/* thin labeled bar */
const MiniBar = ({ label, value, max, pct: forcePct }) => {
  const pct = forcePct ?? (max > 0 ? Math.min((value / max) * 100, 100) : 0);
  return (
    <div className="flex items-center gap-3">
      <p className="text-[11px] text-slate-500 w-20 shrink-0">{label}</p>
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full bg-indigo-400 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[11px] font-semibold text-slate-600 tabular-nums w-10 text-right">{fmtNum(value)}</p>
    </div>
  );
};

/* ══════════════════════════════════════════════════════ */
const MemberPerformance = () => {
  const { memberId } = useParams();
  const navigate = useNavigate();
  const { user, isTeamHead } = useAuth();
  const isAgent = String(user?.role || '').toUpperCase() === 'AGENT';

  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [member, setMember]       = useState(null);
  const [allMembers, setAllMembers] = useState([]);
  const [teamName, setTeamName]   = useState('');

  const fetchData = useCallback(async (isRefresh = false) => {
    if (!user?.team_id) { setLoading(false); return; }
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const [teamRes, perfRes] = await Promise.all([
        api.get(`/teams/${user.team_id}`),
        api.get(`/teams/${user.team_id}/members-performance`),
      ]);
      if (teamRes.data.success) setTeamName(teamRes.data.team?.name || '');
      if (perfRes.data.success) {
        const members = perfRes.data.members || [];
        setAllMembers(members);
        const found = members.find((m) => String(m.id) === String(memberId));
        if (!found) {
          toast.error('Member not found');
          navigate(isTeamHead ? '/team/performance' : '/team');
        } else {
          setMember(found);
        }
      }
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); setRefreshing(false); }
  }, [user, memberId, navigate, isTeamHead]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const teamMaxes = useMemo(() => ({
    leads:    Math.max(...allMembers.map((m) => Number(m.total_leads    || 0)), 1),
    calls:    Math.max(...allMembers.map((m) => Number(m.total_calls    || 0)), 1),
    bookings: Math.max(...allMembers.map((m) => Number(m.total_bookings || 0)), 1),
    followups:Math.max(...allMembers.map((m) => Number(m.total_followups|| 0)), 1),
  }), [allMembers]);

  const compData = useMemo(() => {
    if (!member || allMembers.length < 2) return [];
    const others = allMembers.filter((m) => String(m.id) !== String(memberId));
    const avg = (k) => others.reduce((s, m) => s + Number(m[k] || 0), 0) / Math.max(others.length, 1);
    return [
      { label: 'Leads',    me: Number(member.total_leads    || 0), avg: Math.round(avg('total_leads'))    },
      { label: 'Calls',    me: Number(member.total_calls    || 0), avg: Math.round(avg('total_calls'))    },
      { label: 'Bookings', me: Number(member.total_bookings || 0), avg: Math.round(avg('total_bookings')) },
    ];
  }, [member, allMembers, memberId]);

  const rank = useMemo(() => {
    if (!member) return null;
    const sorted = [...allMembers].sort((a, b) => Number(b.total_leads || 0) - Number(a.total_leads || 0));
    const idx = sorted.findIndex((m) => String(m.id) === String(memberId));
    return idx >= 0 ? idx + 1 : null;
  }, [allMembers, member, memberId]);

  if (!loading && !isTeamHead && !isAgent) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertCircle className="h-8 w-8 mb-3 text-slate-300" />
        <p className="text-sm font-medium text-slate-500">Access denied</p>
      </div>
    );
  }

  const convRate    = parseFloat(member?.conversion_rate || 0);
  const fuPct       = member?.total_followups > 0
    ? ((Number(member.completed_followups) / Number(member.total_followups)) * 100).toFixed(0)
    : 0;
  const initials    = (member?.name || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const firstName   = member?.name?.split(' ')[0] || 'Member';

  return (
    <div className="space-y-3 pb-10">

      {/* ── top bar ── */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(isTeamHead ? '/team/performance' : '/team')}
          className="h-8 w-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
        >
          <ArrowLeft className="h-4 w-4 text-slate-600" />
        </button>
        <div className="flex items-center gap-2">
          {!loading && member && (
            <button
              onClick={() => navigate(`/team/member/${memberId}/calls`)}
              className="flex items-center gap-1.5 text-xs font-medium text-slate-600 border border-slate-200 bg-white rounded-lg px-3 py-1.5 hover:bg-slate-50 transition-colors"
            >
              <Phone className="h-3 w-3" /> Calls
            </button>
          )}
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="h-8 w-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-slate-500 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── profile strip ── */}
      <div className="bg-white border border-slate-100 rounded-2xl p-4 flex items-center gap-3">
        {loading ? (
          <>
            <Skeleton className="h-12 w-12 rounded-xl shrink-0" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-32 rounded" />
              <Skeleton className="h-3 w-24 rounded" />
            </div>
          </>
        ) : (
          <>
            <div className="h-12 w-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
              <span className="text-base font-bold text-slate-600">{initials}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-bold text-slate-800 truncate leading-tight">{member?.name || '—'}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">{teamName}</p>
            </div>
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                member?.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'
              }`}>
                {member?.is_active ? 'Active' : 'Inactive'}
              </span>
              {rank && (
                <span className="text-[10px] font-semibold text-amber-600 flex items-center gap-0.5">
                  <Award className="h-2.5 w-2.5" /> #{rank} in team
                </span>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── KPI tiles 3-col ── */}
      <div className="grid grid-cols-3 gap-2">
        <Stat loading={loading} label="Leads"     value={fmtNum(member?.total_leads)}    sub={`${fmtNum(member?.booked_leads)} booked`}    icon={Target}      />
        <Stat loading={loading} label="Calls"     value={fmtNum(member?.total_calls)}    sub={fmtDur(member?.avg_call_duration)}            icon={Phone}       />
        <Stat loading={loading} label="Today"     value={fmtNum(member?.calls_today)}    sub={`${fmtNum(member?.calls_this_week)} wk`}      icon={Flame}       />
        <Stat loading={loading} label="Bookings"  value={fmtNum(member?.total_bookings)} sub={`${fmtNum(member?.completed_bookings)} done`} icon={CheckCircle2}/>
        <Stat loading={loading} label="Conv."     value={`${convRate}%`}                 sub="lead → booking"                               icon={TrendingUp}  />
        <Stat loading={loading} label="Follow-ups"value={fmtNum(member?.total_followups)}sub={`${fuPct}% done`}                             icon={PhoneCall}   />
      </div>

      {/* ── vs team best ── */}
      <div className="bg-white border border-slate-100 rounded-2xl px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-3">vs Team Best</p>
        {loading ? (
          <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-4 w-full rounded" />)}</div>
        ) : (
          <div className="space-y-3">
            <MiniBar label="Leads"      value={Number(member?.total_leads    || 0)} max={teamMaxes.leads}    />
            <MiniBar label="Calls"      value={Number(member?.total_calls    || 0)} max={teamMaxes.calls}    />
            <MiniBar label="Bookings"   value={Number(member?.total_bookings || 0)} max={teamMaxes.bookings} />
            <MiniBar label="Follow-ups" value={Number(member?.total_followups|| 0)} max={teamMaxes.followups}/>
          </div>
        )}
      </div>

      {/* ── me vs avg chart ── */}
      <div className="bg-white border border-slate-100 rounded-2xl px-3 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2 px-1">
          {loading ? 'vs Team Avg' : `${firstName} vs Team Avg`}
        </p>
        {loading ? (
          <div className="h-44 animate-pulse bg-slate-50 rounded-lg" />
        ) : compData.length === 0 ? (
          <p className="text-center text-xs text-slate-400 py-10">Not enough data</p>
        ) : (
          <ResponsiveContainer width="100%" height={170}>
            <BarChart data={compData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<ChartTip />} />
              <Bar dataKey="me"  name={firstName}  fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={32} />
              <Bar dataKey="avg" name="Team Avg" fill="#e2e8f0" radius={[4, 4, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── rates ── */}
      {!loading && member && (
        <div className="bg-white border border-slate-100 rounded-2xl px-4 py-3 space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Rates</p>
          <MiniBar label="Conversion"   value={Number(convRate.toFixed(1))} max={100} pct={convRate} />
          <MiniBar label="Follow-up %"  value={Number(fuPct)} max={100} pct={Number(fuPct)} />
        </div>
      )}

      {/* ── quick facts ── */}
      {!loading && member && (
        <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 px-4 pt-3 pb-2">Quick Facts</p>
          <dl className="divide-y divide-slate-50">
            {[
              { label: 'Avg Call Duration',    value: fmtDur(member.avg_call_duration)  },
              { label: 'Calls This Week',      value: fmtNum(member.calls_this_week)    },
              { label: 'Successful Calls',     value: fmtNum(member.successful_calls)   },
              { label: 'Booked Leads',         value: fmtNum(member.booked_leads)       },
              { label: 'Completed Bookings',   value: fmtNum(member.completed_bookings) },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between px-4 py-2.5">
                <dt className="text-[12px] text-slate-500">{label}</dt>
                <dd className="text-[12px] font-semibold text-slate-700 tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {/* ── leaderboard ── */}
      <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-50 flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Team Leaderboard</p>
          <span className="text-[10px] text-slate-400">{allMembers.length} members</span>
        </div>
        <div className="divide-y divide-slate-50">
          {loading
            ? [...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 mx-4 my-1.5 rounded-lg" />)
            : [...allMembers]
                .sort((a, b) => Number(b.total_leads || 0) - Number(a.total_leads || 0))
                .map((m, idx) => {
                  const isThis = String(m.id) === String(memberId);
                  const isMe   = String(m.id) === String(user?.id);
                  const pct    = teamMaxes.leads > 0 ? (Number(m.total_leads || 0) / teamMaxes.leads) * 100 : 0;
                  return (
                    <div
                      key={m.id}
                      className={`flex items-center gap-3 px-4 py-2.5 transition-colors ${
                        isThis ? 'bg-indigo-50/60' : 'hover:bg-slate-50 cursor-pointer'
                      }`}
                      onClick={() => !isThis && navigate(`/team/member/${m.id}`)}
                    >
                      <span className="text-[11px] font-mono text-slate-300 w-4 shrink-0 text-center">{idx + 1}</span>
                      <div className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 text-[11px] font-bold ${
                        isThis ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {m.name?.charAt(0)?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className={`text-[12px] font-medium truncate ${isThis ? 'text-indigo-700' : 'text-slate-700'}`}>{m.name}</span>
                          {isThis && <span className="text-[9px] font-semibold text-indigo-400">viewing</span>}
                          {isMe && !isThis && <span className="text-[9px] text-slate-400">you</span>}
                        </div>
                        <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: isThis ? '#818cf8' : '#cbd5e1' }} />
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[12px] font-bold tabular-nums text-slate-700">{fmtNum(m.total_leads)}</p>
                        <p className="text-[9px] text-slate-400 tabular-nums">{fmtNum(m.total_calls)} calls</p>
                      </div>
                    </div>
                  );
                })
          }
        </div>
      </div>

    </div>
  );
};

export default MemberPerformance;
