import { useState, useEffect, useCallback, useMemo } from 'react';
import api from '@/lib/axios';
import { toast } from 'sonner';
import {
  format, startOfMonth, endOfMonth, subMonths, addMonths,
  eachDayOfInterval, getDay, isSameDay, isToday, isFuture, isSameMonth,
} from 'date-fns';
import {
  CalendarDays, Clock, MapPin, LogIn, LogOut as LogOutIcon, ChevronLeft, ChevronRight,
  Timer, Flame, Award, ArrowRight, X,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

const STATUS_CONFIG = {
  PRESENT:  { dot: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700 border-emerald-200', cell: 'bg-emerald-50 border-emerald-200',   label: 'Present',  icon: '✓' },
  LATE:     { dot: 'bg-amber-500',   badge: 'bg-amber-100 text-amber-700 border-amber-200',       cell: 'bg-amber-50 border-amber-200',         label: 'Late',     icon: '!' },
  HALF_DAY: { dot: 'bg-blue-500',    badge: 'bg-blue-100 text-blue-700 border-blue-200',          cell: 'bg-blue-50 border-blue-200',           label: 'Half Day', icon: '½' },
  ABSENT:   { dot: 'bg-red-400',     badge: 'bg-red-100 text-red-700 border-red-200',             cell: 'bg-red-50 border-red-200',             label: 'Absent',   icon: '✗' },
};

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const generateMonthOptions = () => {
  const options = [];
  const now = new Date();
  for (let i = 0; i < 13; i++) {
    const d = subMonths(now, i);
    options.push({ value: `${d.getFullYear()}-${d.getMonth()}`, label: format(d, 'MMM yyyy'), date: d });
  }
  return options;
};

const MyAttendance = () => {
  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth() + 1;
  const monthOptions = useMemo(() => generateMonthOptions(), []);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const sd = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
      const ed = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
      const { data } = await api.get(`/attendance/my-history?page=1&limit=50&startDate=${sd}&endDate=${ed}`);
      if (data.success) setRecords(data.records);
    } catch { toast.error('Failed to load attendance history'); }
    finally { setLoading(false); }
  }, [currentMonth]);

  const fetchMonthlySummary = useCallback(async () => {
    try {
      const { data } = await api.get(`/attendance/my-monthly?year=${year}&month=${month}`);
      if (data.success) setSummary(data.summary);
    } catch { /* silent */ }
  }, [year, month]);

  useEffect(() => { fetchHistory(); fetchMonthlySummary(); }, [fetchHistory, fetchMonthlySummary]);

  const prevMonth = () => { setCurrentMonth(m => subMonths(m, 1)); setSelectedDate(null); };
  const nextMonth = () => {
    if (!isFuture(addMonths(startOfMonth(currentMonth), 1))) {
      setCurrentMonth(m => addMonths(m, 1));
      setSelectedDate(null);
    }
  };

  const presentDays = summary.filter(s => s.status === 'PRESENT').length;
  const lateDays    = summary.filter(s => s.status === 'LATE').length;
  const halfDays    = summary.filter(s => s.status === 'HALF_DAY').length;
  const totalWorkDays = summary.length;
  const totalHours  = summary.reduce((acc, s) => acc + (parseFloat(s.hours_worked) || 0), 0);

  const attendedDays = presentDays + lateDays + halfDays;
  const monthStart   = startOfMonth(currentMonth);
  const monthEnd     = endOfMonth(currentMonth);
  const effectiveEnd = isSameMonth(currentMonth, new Date()) ? new Date() : monthEnd;
  const allDaysInRange = eachDayOfInterval({ start: monthStart, end: effectiveEnd });
  const businessDays   = allDaysInRange.filter(d => getDay(d) !== 0).length;
  const attendanceRate = businessDays > 0 ? Math.round((attendedDays / businessDays) * 100) : 0;

  const streak = useMemo(() => {
    const sorted = [...summary].sort((a, b) => new Date(b.date) - new Date(a.date));
    let count = 0;
    for (const s of sorted) {
      if (s.status === 'PRESENT' || s.status === 'LATE' || s.status === 'HALF_DAY') count++;
      else break;
    }
    return count;
  }, [summary]);

  const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDay = getDay(monthStart);

  const recordsByDate = useMemo(() => {
    const map = {};
    records.forEach(r => {
      const dateStr = r.date?.split('T')[0] || format(new Date(r.date), 'yyyy-MM-dd');
      if (!map[dateStr]) map[dateStr] = [];
      map[dateStr].push(r);
    });
    return map;
  }, [records]);

  const summaryByDate = useMemo(() => {
    const map = {};
    summary.forEach(s => {
      const dateStr = s.date?.split('T')[0] || format(new Date(s.date), 'yyyy-MM-dd');
      map[dateStr] = s;
    });
    return map;
  }, [summary]);

  const formatTime = (t) => t ? format(new Date(t), 'hh:mm a') : '—';
  const getHoursWorked = (checkIn, checkOut) => {
    if (!checkIn || !checkOut) return null;
    const diff = (new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60);
    const hrs  = Math.floor(diff);
    const mins = Math.round((diff - hrs) * 60);
    return { hrs, mins, display: `${hrs}h ${mins}m` };
  };

  const selectedDateStr  = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : null;
  const selectedRecords  = selectedDateStr ? (recordsByDate[selectedDateStr] || []) : [];
  const selectedSummary  = selectedDateStr ? summaryByDate[selectedDateStr] : null;

  const handleMonthJump = (val) => {
    const [y, m] = val.split('-').map(Number);
    setCurrentMonth(new Date(y, m, 1));
    setSelectedDate(null);
  };

  const handleDayClick = (day) => {
    setSelectedDate(day);
    setModalOpen(true);
  };

  return (
    <div className="space-y-4 pb-8">

      {/* ── Header ── */}
      <div className="relative overflow-hidden rounded-2xl bg-white shadow-sm border border-slate-100">
        <div className="h-1.5 w-full bg-linear-to-r from-indigo-500 via-violet-500 to-purple-500" />
        <div className="px-5 py-4">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-slate-800 flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-indigo-500" />
                My Attendance
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">{format(currentMonth, 'MMMM yyyy')}</p>
            </div>
            {streak > 0 && (
              <div className="flex items-center gap-1.5 bg-orange-50 border border-orange-100 rounded-full px-3 py-1.5">
                <Flame className="h-3.5 w-3.5 text-orange-400" />
                <span className="text-sm font-bold text-orange-600">{streak}</span>
                <span className="text-xs text-orange-400">day streak</span>
              </div>
            )}
          </div>

          {/* Rate bar */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-slate-500">Attendance Rate</span>
              <div className="flex items-center gap-1.5">
                {attendanceRate >= 90 && (
                  <span className="flex items-center gap-0.5 text-[10px] text-emerald-600 font-semibold">
                    <Award className="h-3 w-3" /> Excellent
                  </span>
                )}
                <span className="text-sm font-bold text-slate-700">{attendanceRate}%</span>
              </div>
            </div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-linear-to-r from-indigo-500 to-violet-500 transition-all duration-700 ease-out"
                style={{ width: `${attendanceRate}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-1">{attendedDays} of {businessDays} working days</p>
          </div>
        </div>
      </div>

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { value: presentDays,            label: 'Present', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
          { value: lateDays,               label: 'Late',    color: 'text-amber-500',   bg: 'bg-amber-50',   border: 'border-amber-100'   },
          { value: totalWorkDays,          label: 'Days',    color: 'text-indigo-600',  bg: 'bg-indigo-50',  border: 'border-indigo-100'  },
          { value: `${totalHours.toFixed(0)}h`, label: 'Hours', color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-100' },
        ].map((s) => (
          <div key={s.label} className={`${s.bg} border ${s.border} rounded-xl p-3 text-center`}>
            <p className={`text-lg font-bold ${s.color} leading-tight`}>{s.value}</p>
            <p className="text-[10px] text-slate-400 font-medium mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── Calendar Card ── */}
      <Card className="border border-slate-100 shadow-sm rounded-2xl overflow-hidden">
        {/* Month nav */}
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-100 bg-slate-50/60">
          <Button variant="ghost" size="icon" onClick={prevMonth} className="h-8 w-8 rounded-full hover:bg-white">
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <Select
            value={`${currentMonth.getFullYear()}-${currentMonth.getMonth()}`}
            onValueChange={handleMonthJump}
          >
            <SelectTrigger className="w-auto border-0 bg-transparent shadow-none font-semibold text-slate-700 gap-1 h-auto py-1 px-2 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map(m => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="ghost"
            size="icon"
            onClick={nextMonth}
            disabled={isSameMonth(currentMonth, new Date())}
            className="h-8 w-8 rounded-full hover:bg-white"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <CardContent className="p-3 pt-2">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 mb-1">
            {WEEKDAYS.map(d => (
              <div key={d} className={`text-center text-[10px] font-bold uppercase py-1.5 ${d === 'Sun' ? 'text-red-400' : 'text-slate-400'}`}>
                {d}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          {loading ? (
            <div className="grid grid-cols-7 gap-1.5">
              {Array.from({ length: 35 }).map((_, i) => (
                <div key={i} className="aspect-square rounded-xl bg-slate-100 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-1.5">
              {Array.from({ length: startDay }).map((_, i) => (
                <div key={`empty-${i}`} className="aspect-square" />
              ))}

              {calendarDays.map(day => {
                const dateStr  = format(day, 'yyyy-MM-dd');
                const dayData  = summaryByDate[dateStr];
                const dayRecs  = recordsByDate[dateStr];
                const hasData  = !!dayData;
                const todayFlag = isToday(day);
                const future   = isFuture(day);
                const isSun    = getDay(day) === 0;
                const config   = hasData ? STATUS_CONFIG[dayData.status] : null;

                return (
                  <button
                    key={dateStr}
                    onClick={() => !future && handleDayClick(day)}
                    disabled={future}
                    className={`
                      aspect-square rounded-xl flex flex-col items-center justify-center gap-0.5 text-xs
                      transition-all duration-150 relative border active:scale-95
                      ${hasData
                        ? `${config.cell} hover:shadow-sm hover:brightness-95`
                        : todayFlag
                          ? 'bg-indigo-50 border-indigo-200'
                          : future
                            ? 'opacity-20 cursor-default border-transparent'
                            : isSun
                              ? 'border-transparent bg-red-50/60 hover:bg-red-50'
                              : 'border-transparent hover:bg-slate-50'
                      }
                    `}
                  >
                    <span className={`text-[11px] leading-none font-semibold ${
                      todayFlag  ? 'text-indigo-600' :
                      hasData    ? 'text-slate-700'  :
                      isSun      ? 'text-red-400'    :
                      future     ? 'text-slate-300'  :
                                   'text-slate-500'
                    }`}>
                      {format(day, 'd')}
                    </span>

                    {hasData && (
                      <div className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
                    )}

                    {todayFlag && (
                      <div className="absolute inset-0 rounded-xl ring-2 ring-indigo-400 ring-offset-1 pointer-events-none" />
                    )}

                    {dayRecs && dayRecs.length > 1 && (
                      <span className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-indigo-500 text-[7px] font-bold text-white flex items-center justify-center shadow-sm">
                        {dayRecs.length}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Legend */}
          <div className="flex items-center justify-center gap-4 mt-3 pt-3 border-t border-slate-100">
            {[
              { color: 'bg-emerald-500', label: 'Present' },
              { color: 'bg-amber-500',   label: 'Late'    },
              { color: 'bg-blue-500',    label: 'Half Day'},
              { color: 'bg-red-400',     label: 'Absent'  },
            ].map(l => (
              <div key={l.label} className="flex items-center gap-1.5">
                <div className={`h-2 w-2 rounded-full ${l.color}`} />
                <span className="text-[10px] text-slate-400 font-medium">{l.label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Hint ── */}
      {!loading && totalWorkDays > 0 && (
        <p className="text-center text-xs text-slate-400">Tap any date to see check-in / check-out details</p>
      )}

      {/* ── Empty state ── */}
      {!loading && totalWorkDays === 0 && (
        <Card className="border border-slate-100 shadow-sm rounded-2xl">
          <CardContent className="py-12 text-center">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 mb-3">
              <CalendarDays className="h-6 w-6 text-slate-400" />
            </div>
            <p className="text-sm font-semibold text-slate-600">No attendance data</p>
            <p className="text-xs text-slate-400 mt-1 max-w-55 mx-auto">
              No records for {format(currentMonth, 'MMMM yyyy')} yet.
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── Date Detail Modal ── */}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-sm p-0 gap-0 rounded-2xl overflow-hidden border-0 shadow-xl">
          {/* Modal header */}
          <div className={`px-5 py-4 ${selectedSummary ? STATUS_CONFIG[selectedSummary.status]?.cell || 'bg-slate-50' : 'bg-slate-50'}`}>
            <DialogHeader>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">
                    {selectedDate && format(selectedDate, 'EEEE')}
                  </p>
                  <DialogTitle className="text-base font-bold text-slate-800 mt-0.5">
                    {selectedDate && format(selectedDate, 'MMMM d, yyyy')}
                  </DialogTitle>
                </div>
                {selectedSummary && (
                  <Badge className={`${STATUS_CONFIG[selectedSummary.status]?.badge} text-[10px] font-bold border mt-1`}>
                    {STATUS_CONFIG[selectedSummary.status]?.label}
                  </Badge>
                )}
              </div>
            </DialogHeader>
          </div>

          {/* Modal body */}
          <div className="px-5 py-4 bg-white">
            {selectedRecords.length === 0 ? (
              <div className="py-8 text-center">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 mb-3">
                  <CalendarDays className="h-5 w-5 text-slate-400" />
                </div>
                <p className="text-sm font-medium text-slate-500">No records</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {selectedDate && getDay(selectedDate) === 0 ? 'Sunday — Day off' : 'No attendance recorded'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {selectedRecords.map((r, idx) => {
                  const worked = getHoursWorked(r.check_in_time, r.check_out_time);
                  return (
                    <div key={r.id} className="space-y-3">
                      {idx > 0 && <div className="border-t border-slate-100" />}

                      {/* Location */}
                      {r.location_name && (
                        <div className="flex items-center gap-2">
                          <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span className="text-sm font-medium text-slate-700">{r.location_name}</span>
                        </div>
                      )}

                      {/* Check-in / Check-out large tiles */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-center">
                          <div className="flex items-center justify-center gap-1 mb-1">
                            <LogIn className="h-3.5 w-3.5 text-emerald-600" />
                            <span className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wide">Check In</span>
                          </div>
                          <p className="text-base font-bold text-slate-800">{formatTime(r.check_in_time)}</p>
                        </div>

                        <div className={`border rounded-xl p-3 text-center ${r.check_out_time ? 'bg-rose-50 border-rose-100' : 'bg-slate-50 border-slate-100'}`}>
                          <div className="flex items-center justify-center gap-1 mb-1">
                            <LogOutIcon className={`h-3.5 w-3.5 ${r.check_out_time ? 'text-rose-500' : 'text-slate-400'}`} />
                            <span className={`text-[10px] font-semibold uppercase tracking-wide ${r.check_out_time ? 'text-rose-500' : 'text-slate-400'}`}>Check Out</span>
                          </div>
                          {r.check_out_time ? (
                            <p className="text-base font-bold text-slate-800">{formatTime(r.check_out_time)}</p>
                          ) : (
                            <p className="text-xs text-slate-400 flex items-center justify-center gap-1 pt-0.5">
                              <Clock className="h-3 w-3 animate-pulse" /> Working…
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Duration row */}
                      {worked && (
                        <div className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <Timer className="h-4 w-4 text-slate-400" />
                            <span className="text-sm font-semibold text-slate-700">{worked.display}</span>
                          </div>
                          {worked.hrs >= 8 ? (
                            <span className="text-[10px] bg-emerald-100 text-emerald-700 rounded-full px-2 py-0.5 font-semibold">Full day</span>
                          ) : worked.hrs >= 4 ? (
                            <span className="text-[10px] bg-blue-100 text-blue-600 rounded-full px-2 py-0.5 font-semibold">Half day</span>
                          ) : null}
                        </div>
                      )}

                      {/* Distance */}
                      {r.check_in_distance_m != null && (
                        <p className="text-[10px] text-slate-400 text-center">
                          Check-in distance: ±{Math.round(r.check_in_distance_m)}m from office
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Modal footer */}
          <div className="px-5 pb-4 bg-white">
            <Button
              variant="outline"
              className="w-full rounded-xl text-sm"
              onClick={() => setModalOpen(false)}
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MyAttendance;
