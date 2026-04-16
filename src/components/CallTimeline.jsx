import { memo } from 'react';
import { Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, Clock, MessageSquare, CheckCircle2 } from 'lucide-react';

/* ── helpers ──────────────────────────────────────────────────────────── */
const fmtDur = (s) => {
  if (!s) return null;
  const sec = Number(s);
  if (sec < 60) return `${sec}s`;
  return `${Math.floor(sec / 60)}m ${sec % 60}s`;
};

const fmtDate = (v) => {
  if (!v) return 'Unknown date';
  const d = new Date(v);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const isYesterday = d.toDateString() === new Date(now - 86400000).toDateString();
  const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  const date = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  if (isToday) return `Today, ${time}`;
  if (isYesterday) return `Yesterday, ${time}`;
  return `${date}, ${time}`;
};

const typeConfig = (type) => {
  const t = String(type || '').toUpperCase();
  if (t === 'INCOMING') return { Icon: PhoneIncoming, label: 'Incoming', color: 'text-emerald-600', bg: 'bg-emerald-500', ring: 'ring-emerald-200', dot: 'bg-emerald-500' };
  if (t === 'MISSED')   return { Icon: PhoneMissed,   label: 'Missed',   color: 'text-rose-500',    bg: 'bg-rose-500',    ring: 'ring-rose-200',    dot: 'bg-rose-400' };
  return                        { Icon: PhoneOutgoing, label: 'Outgoing', color: 'text-blue-600',    bg: 'bg-blue-500',    ring: 'ring-blue-200',    dot: 'bg-blue-500' };
};

/* ── Milestone node ───────────────────────────────────────────────────── */
const TimelineNode = ({ call, isFirst, isLast }) => {
  const cfg = typeConfig(call.call_type);
  const dur = fmtDur(call.duration_seconds);

  return (
    <div className="relative flex gap-3">
      {/* Vertical track */}
      <div className="flex flex-col items-center w-7 shrink-0">
        {/* Connector line above */}
        {!isFirst && <div className="w-0.5 flex-1 bg-slate-200" />}
        {isFirst && <div className="flex-1" />}

        {/* Node circle */}
        <div className={`relative z-10 h-7 w-7 rounded-full flex items-center justify-center shrink-0
          ${isFirst ? `${cfg.bg} text-white shadow-md shadow-${cfg.bg}/30` : 'bg-white border-2 border-slate-200'}`}>
          {isFirst ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <cfg.Icon className={`h-3.5 w-3.5 ${cfg.color}`} />
          )}
        </div>

        {/* Connector line below */}
        {!isLast && <div className="w-0.5 flex-1 bg-slate-200" />}
        {isLast && <div className="flex-1" />}
      </div>

      {/* Content card */}
      <div className={`flex-1 mb-3 ${isFirst ? 'pt-0' : 'pt-0'}`}>
        <div className={`rounded-xl border p-3 transition-colors duration-150
          ${isFirst
            ? 'border-emerald-200 bg-emerald-50/50'
            : 'border-slate-100 bg-white hover:bg-slate-50/50'
          }`}>
          {/* Header row */}
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${cfg.color}`}>
              <cfg.Icon className="h-3 w-3" />
              {cfg.label}
            </span>
            <span className="text-[10px] text-slate-400 tabular-nums">{fmtDate(call.call_start)}</span>
          </div>

          {/* Meta chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            {dur && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-600 bg-slate-100 rounded-full px-2 py-0.5">
                <Clock className="h-2.5 w-2.5" />
                {dur}
              </span>
            )}
            {call.outcome_label && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-700 bg-indigo-50 rounded-full px-2 py-0.5">
                {call.outcome_label}
              </span>
            )}
            {call.next_action && call.next_action !== 'NONE' && (
              <span className="text-[10px] font-medium text-amber-700 bg-amber-50 rounded-full px-2 py-0.5">
                → {call.next_action.replace('_', ' ')}
              </span>
            )}
          </div>

          {/* Notes */}
          {call.customer_notes && (
            <div className="mt-2 flex gap-1.5 items-start">
              <MessageSquare className="h-3 w-3 text-slate-400 mt-0.5 shrink-0" />
              <p className="text-[11px] text-slate-600 leading-relaxed line-clamp-2">{call.customer_notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ── Empty state ──────────────────────────────────────────────────────── */
const EmptyTimeline = () => (
  <div className="flex flex-col items-center py-6 text-center">
    <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center mb-2">
      <Phone className="h-5 w-5 text-slate-300" />
    </div>
    <p className="text-xs text-slate-400 font-medium">No call history yet</p>
  </div>
);

/* ── Loading spinner ──────────────────────────────────────────────────── */
const TimelineLoader = () => (
  <div className="flex items-center justify-center py-6">
    <div className="h-5 w-5 border-2 border-slate-200 border-t-emerald-500 rounded-full animate-spin" />
  </div>
);

/* ── Main component ───────────────────────────────────────────────────── */
const CallTimeline = memo(({ calls = [], loading = false }) => {
  if (loading) return <TimelineLoader />;
  if (!calls.length) return <EmptyTimeline />;

  return (
    <div className="border-t border-slate-200 pt-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-3 px-0.5">
        Call Timeline · {calls.length} call{calls.length !== 1 ? 's' : ''}
      </p>
      <div>
        {calls.map((call, idx) => (
          <TimelineNode
            key={call.id || idx}
            call={call}
            isFirst={idx === 0}
            isLast={idx === calls.length - 1}
          />
        ))}
      </div>
    </div>
  );
});

CallTimeline.displayName = 'CallTimeline';
export default CallTimeline;
