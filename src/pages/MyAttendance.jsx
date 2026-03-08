import { useState, useEffect, useCallback, useMemo } from 'react';
import api from '@/lib/axios';
import { toast } from 'sonner';
import {
  format, startOfMonth, endOfMonth, subMonths, addMonths,
  eachDayOfInterval, getDay, isSameDay, isToday, isFuture, isSameMonth,
} from 'date-fns';
import {
  CalendarDays, Clock, MapPin, LogIn, LogOut as LogOutIcon, ChevronLeft, ChevronRight,
  CheckCircle2, AlertTriangle, TrendingUp, Timer, Flame, Award, ArrowRight,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const STATUS_CONFIG = {
  PRESENT: { dot: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700 border-emerald-200', cell: 'bg-emerald-50 border-emerald-200', label: 'Present', icon: '\u2713' },
  LATE:    { dot: 'bg-amber-500',   badge: 'bg-amber-100 text-amber-700 border-amber-200',     cell: 'bg-amber-50 border-amber-200',   label: 'Late',    icon: '!' },
  HALF_DAY:{ dot: 'bg-blue-500',    badge: 'bg-blue-100 text-blue-700 border-blue-200',        cell: 'bg-blue-50 border-blue-200',     label: 'Half Day', icon: '\u00BD' },
  ABSENT:  { dot: 'bg-red-400',     badge: 'bg-red-100 text-red-700 border-red-200',           cell: 'bg-red-50 border-red-200',       label: 'Absent',  icon: '\u2717' },
};

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Generate month options for quick jump
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

  // Stats
  const presentDays = summary.filter(s => s.status === 'PRESENT').length;
  const lateDays = summary.filter(s => s.status === 'LATE').length;
  const halfDays = summary.filter(s => s.status === 'HALF_DAY').length;
  const totalWorkDays = summary.length;
  const totalHours = summary.reduce((acc, s) => acc + (parseFloat(s.hours_worked) || 0), 0);

  // Attendance rate
  const attendedDays = presentDays + lateDays + halfDays;
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const effectiveEnd = isSameMonth(currentMonth, new Date()) ? new Date() : monthEnd;
  const allDaysInRange = eachDayOfInterval({ start: monthStart, end: effectiveEnd });
  const businessDays = allDaysInRange.filter(d => getDay(d) !== 0).length;
  const attendanceRate = businessDays > 0 ? Math.round((attendedDays / businessDays) * 100) : 0;

  // Streak calculation
  const streak = useMemo(() => {
    const sorted = [...summary].sort((a, b) => new Date(b.date) - new Date(a.date));
    let count = 0;
    for (const s of sorted) {
      if (s.status === 'PRESENT' || s.status === 'LATE' || s.status === 'HALF_DAY') count++;
      else break;
    }
    return count;
  }, [summary]);

  // Build calendar grid
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

  const formatTime = (t) => t ? format(new Date(t), 'hh:mm a') : '\u2014';
  const getHoursWorked = (checkIn, checkOut) => {
    if (!checkIn || !checkOut) return null;
    const diff = (new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60);
    const hrs = Math.floor(diff);
    const mins = Math.round((diff - hrs) * 60);
    return { hrs, mins, display: `${hrs}h ${mins}m` };
  };

  const selectedDateStr = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : null;
  const selectedRecords = selectedDateStr ? (recordsByDate[selectedDateStr] || []) : [];
  const selectedSummary = selectedDateStr ? summaryByDate[selectedDateStr] : null;

  const handleMonthJump = (val) => {
    const [y, m] = val.split('-').map(Number);
    setCurrentMonth(new Date(y, m, 1));
    setSelectedDate(null);
  };

  return (
    <div className="space-y-5 pb-8">
      {/* Header Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-700 p-5 text-white shadow-lg">
        <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-white/5" />
        <div className="absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-white/5" />
        <div className="relative">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <CalendarDays className="h-5 w-5" /> My Attendance
              </h1>
              <p className="text-indigo-200 text-xs mt-1">{format(currentMonth, 'MMMM yyyy')} Overview</p>
            </div>
            {streak > 0 && (
              <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur-sm rounded-full px-3 py-1.5">
                <Flame className="h-4 w-4 text-orange-300" />
                <span className="text-sm font-semibold">{streak}</span>
                <span className="text-xs text-indigo-200">day streak</span>
              </div>
            )}
          </div>

          {/* Rate bar */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-indigo-200">Attendance Rate</span>
              <span className="text-sm font-bold">{attendanceRate}%</span>
            </div>
            <div className="h-2 rounded-full bg-white/20 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-green-300 transition-all duration-700 ease-out"
                style={{ width: `${attendanceRate}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-[10px] text-indigo-300">{attendedDays} of {businessDays} working days</span>
              {attendanceRate >= 90 && (
                <span className="flex items-center gap-1 text-[10px] text-emerald-300">
                  <Award className="h-3 w-3" /> Excellent
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { value: presentDays, label: 'Present', color: 'text-emerald-600', bg: 'bg-emerald-50', ring: 'ring-emerald-100' },
          { value: lateDays, label: 'Late', color: 'text-amber-600', bg: 'bg-amber-50', ring: 'ring-amber-100' },
          { value: totalWorkDays, label: 'Days', color: 'text-blue-600', bg: 'bg-blue-50', ring: 'ring-blue-100' },
          { value: `${totalHours.toFixed(0)}h`, label: 'Hours', color: 'text-violet-600', bg: 'bg-violet-50', ring: 'ring-violet-100' },
        ].map((s) => (
          <div key={s.label} className={`${s.bg} ring-1 ${s.ring} rounded-xl p-3 text-center`}>
            <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-slate-500 font-medium">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Calendar Card */}
      <Card className="border-0 shadow-md rounded-2xl overflow-hidden">
        {/* Month Navigation */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-50/80 border-b border-slate-100">
          <Button variant="ghost" size="icon" onClick={prevMonth} className="h-8 w-8 rounded-full hover:bg-white">
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <Select
            value={`${currentMonth.getFullYear()}-${currentMonth.getMonth()}`}
            onValueChange={handleMonthJump}
          >
            <SelectTrigger className="w-auto border-0 bg-transparent shadow-none font-bold text-slate-800 gap-1 h-auto py-1 px-2 text-base">
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
              <div
                key={d}
                className={`text-center text-[10px] font-bold uppercase py-1.5 ${d === 'Sun' ? 'text-red-400' : 'text-slate-400'}`}
              >
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
                const dateStr = format(day, 'yyyy-MM-dd');
                const dayData = summaryByDate[dateStr];
                const dayRecords = recordsByDate[dateStr];
                const hasData = !!dayData;
                const isSelected = selectedDate && isSameDay(day, selectedDate);
                const todayFlag = isToday(day);
                const future = isFuture(day);
                const isSun = getDay(day) === 0;
                const config = hasData ? STATUS_CONFIG[dayData.status] : null;

                return (
                  <button
                    key={dateStr}
                    onClick={() => !future && setSelectedDate(isSelected ? null : day)}
                    disabled={future}
                    className={`
                      aspect-square rounded-xl flex flex-col items-center justify-center gap-0.5 text-xs transition-all duration-200 relative border
                      ${isSelected
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200 scale-105'
                        : hasData
                          ? `${config.cell} border-transparent hover:scale-105 hover:shadow-sm`
                          : todayFlag
                            ? 'bg-indigo-50 border-indigo-200'
                            : future
                              ? 'opacity-25 cursor-default border-transparent'
                              : isSun
                                ? 'border-transparent bg-red-50/50'
                                : 'border-transparent hover:bg-slate-50'
                      }
                    `}
                  >
                    <span className={`text-[11px] leading-none font-semibold ${
                      isSelected ? 'text-white' :
                      todayFlag ? 'text-indigo-600' :
                      hasData ? 'text-slate-700' :
                      isSun ? 'text-red-400' :
                      future ? 'text-slate-300' :
                      'text-slate-500'
                    }`}>
                      {format(day, 'd')}
                    </span>

                    {hasData && !isSelected && (
                      <div className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
                    )}
                    {isSelected && hasData && (
                      <span className="text-[8px] font-bold text-white/90">{config.icon}</span>
                    )}

                    {todayFlag && !isSelected && (
                      <div className="absolute inset-0 rounded-xl ring-2 ring-indigo-400 ring-offset-1" />
                    )}

                    {dayRecords && dayRecords.length > 1 && !isSelected && (
                      <span className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-indigo-500 text-[7px] font-bold text-white flex items-center justify-center shadow-sm">
                        {dayRecords.length}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Legend */}
          <div className="flex items-center justify-center gap-5 mt-3 pt-3 border-t border-slate-100">
            {[
              { color: 'bg-emerald-500', label: 'Present' },
              { color: 'bg-amber-500', label: 'Late' },
              { color: 'bg-blue-500', label: 'Half Day' },
            ].map(l => (
              <div key={l.label} className="flex items-center gap-1.5">
                <div className={`h-2 w-2 rounded-full ${l.color}`} />
                <span className="text-[10px] text-slate-500 font-medium">{l.label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Selected Date Details */}
      {selectedDate && (
        <div className="animate-in slide-in-from-bottom-2 duration-300">
          <Card className="border-0 shadow-md rounded-2xl overflow-hidden">
            {/* Date header strip */}
            <div className={`px-4 py-3 flex items-center justify-between ${
              selectedSummary
                ? STATUS_CONFIG[selectedSummary.status]?.cell || 'bg-slate-50'
                : 'bg-slate-50'
            }`}>
              <div>
                <p className="text-xs font-medium text-slate-500">{format(selectedDate, 'EEEE')}</p>
                <p className="text-base font-bold text-slate-800">{format(selectedDate, 'MMMM d, yyyy')}</p>
              </div>
              {selectedSummary && (
                <Badge className={`${STATUS_CONFIG[selectedSummary.status]?.badge} text-[10px] font-bold border`}>
                  {STATUS_CONFIG[selectedSummary.status]?.label}
                </Badge>
              )}
            </div>

            <CardContent className="p-4">
              {selectedRecords.length === 0 ? (
                <div className="py-8 text-center">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 mb-3">
                    <CalendarDays className="h-5 w-5 text-slate-400" />
                  </div>
                  <p className="text-sm font-medium text-slate-500">No records for this date</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {getDay(selectedDate) === 0 ? 'Sunday \u2014 Day off' : 'No attendance was recorded'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedRecords.map((r, idx) => {
                    const worked = getHoursWorked(r.check_in_time, r.check_out_time);

                    return (
                      <div key={r.id} className="relative">
                        {/* Timeline connector */}
                        {idx < selectedRecords.length - 1 && (
                          <div className="absolute left-[17px] top-[42px] bottom-[-12px] w-0.5 bg-slate-200" />
                        )}

                        <div className="flex gap-3">
                          {/* Timeline dot */}
                          <div className="shrink-0 mt-1">
                            <div className={`h-[9px] w-[9px] rounded-full ring-4 ring-white ${STATUS_CONFIG[r.status]?.dot || 'bg-slate-300'}`} />
                          </div>

                          {/* Content card */}
                          <div className="flex-1 bg-slate-50 rounded-xl p-3.5 space-y-2.5">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <MapPin className="h-3.5 w-3.5 text-indigo-400" />
                                <span className="text-sm font-semibold text-slate-800">{r.location_name}</span>
                              </div>
                              <Badge className={`${STATUS_CONFIG[r.status]?.badge} text-[9px] font-bold border`}>
                                {STATUS_CONFIG[r.status]?.label || r.status}
                              </Badge>
                            </div>

                            {/* Time pills */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <div className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 rounded-full px-2.5 py-1">
                                <LogIn className="h-3 w-3" />
                                <span className="text-[11px] font-semibold">{formatTime(r.check_in_time)}</span>
                              </div>

                              {r.check_out_time && (
                                <>
                                  <ArrowRight className="h-3 w-3 text-slate-300" />
                                  <div className="inline-flex items-center gap-1.5 bg-rose-50 text-rose-600 rounded-full px-2.5 py-1">
                                    <LogOutIcon className="h-3 w-3" />
                                    <span className="text-[11px] font-semibold">{formatTime(r.check_out_time)}</span>
                                  </div>
                                </>
                              )}

                              {!r.check_out_time && (
                                <span className="inline-flex items-center gap-1 text-[10px] text-indigo-500 font-medium animate-pulse">
                                  <Clock className="h-3 w-3" /> Working...
                                </span>
                              )}
                            </div>

                            {/* Duration & Distance */}
                            <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                              {worked ? (
                                <div className="flex items-center gap-1.5">
                                  <Timer className="h-3 w-3 text-slate-400" />
                                  <span className="text-xs font-semibold text-slate-600">{worked.display}</span>
                                  {worked.hrs >= 8 && (
                                    <span className="text-[9px] bg-emerald-100 text-emerald-600 rounded px-1 font-bold">Full</span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs text-slate-400">Duration pending</span>
                              )}

                              {r.check_in_distance_m != null && (
                                <span className="text-[10px] font-mono text-slate-400 bg-slate-100 rounded px-1.5 py-0.5">
                                  \u00B1{Math.round(r.check_in_distance_m)}m
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tap hint */}
      {!selectedDate && !loading && totalWorkDays > 0 && (
        <div className="text-center py-2">
          <p className="text-xs text-slate-400">Tap a date on the calendar to see details</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && totalWorkDays === 0 && (
        <Card className="border-0 shadow-md rounded-2xl">
          <CardContent className="py-12 text-center">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 mb-4">
              <CalendarDays className="h-7 w-7 text-slate-400" />
            </div>
            <p className="text-base font-semibold text-slate-600">No attendance data</p>
            <p className="text-sm text-slate-400 mt-1 max-w-[240px] mx-auto">
              You don&apos;t have any attendance records for {format(currentMonth, 'MMMM yyyy')} yet.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default MyAttendance;
