import { useState, useEffect, useCallback, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import api from '@/lib/axios';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Fingerprint, MapPin, Navigation, Clock, LogIn, LogOut as LogOutIcon,
  CheckCircle2, XCircle, Loader2, RefreshCw, Radar, Shield, AlertTriangle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const isNative = Capacitor.isNativePlatform();

const MarkAttendance = () => {
  const [locations, setLocations] = useState([]);
  const [todayRecords, setTodayRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPos, setCurrentPos] = useState(null);
  const [posError, setPosError] = useState(null);
  const [gettingPos, setGettingPos] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [accuracy, setAccuracy] = useState(null);
  const watchRef = useRef(null);
  const lastPosUpdate = useRef(0);

  const fetchData = useCallback(async () => {
    try {
      const [locRes, todayRes] = await Promise.all([
        api.get('/attendance/locations/active'),
        api.get('/attendance/my-today'),
      ]);
      if (locRes.data.success) setLocations(locRes.data.locations);
      if (todayRes.data.success) setTodayRecords(todayRes.data.records);
    } catch {
      toast.error('Failed to load attendance data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Request native permission + get position using Capacitor Geolocation ──
  const requestAndGetPosition = useCallback(async () => {
    setGettingPos(true);
    setPosError(null);
    try {
      if (isNative) {
        // Request permission on native (shows Android dialog)
        const permStatus = await Geolocation.requestPermissions();
        if (permStatus.location !== 'granted' && permStatus.coarseLocation !== 'granted') {
          setPosError('Location permission denied. Go to Settings → Apps → RiverGreen Agent → Permissions → Location and enable it.');
          setGettingPos(false);
          return;
        }
      }
      // Get current position (works both native and web)
      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 30000,
        maximumAge: 0,
      });
      setCurrentPos({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      setAccuracy(pos.coords.accuracy);
      setPosError(null);
      setGettingPos(false);
    } catch (err) {
      setGettingPos(false);
      const msg = err?.message || String(err);
      if (msg.includes('denied') || msg.includes('permission')) {
        setPosError('Location permission denied. Please enable location access in app settings.');
      } else if (msg.includes('unavailable') || msg.includes('Location services')) {
        setPosError('Location unavailable. Please turn on GPS/Location Services.');
      } else if (msg.includes('timeout')) {
        setPosError('Location timed out. Make sure GPS is enabled and try again.');
      } else {
        setPosError(`Location error: ${msg}`);
      }
    }
  }, []);

  // Start watching position with Capacitor watchPosition
  const startWatchingPosition = useCallback(async () => {
    // First do a one-time get to ensure permissions are granted
    await requestAndGetPosition();

    // Then start continuous watch
    try {
      if (watchRef.current !== null) {
        await Geolocation.clearWatch({ id: watchRef.current }).catch(() => {});
        watchRef.current = null;
      }
      const watchId = await Geolocation.watchPosition(
        { enableHighAccuracy: true, timeout: 30000, maximumAge: 3000 },
        (pos, err) => {
          if (err) return;
          if (!pos) return;
          const now = Date.now();
          if (now - lastPosUpdate.current < 3000) return;
          lastPosUpdate.current = now;
          setCurrentPos({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
          setAccuracy(pos.coords.accuracy);
          setGettingPos(false);
          setPosError(null);
        }
      );
      watchRef.current = watchId;
    } catch {
      // watchPosition may not be supported on all platforms, getCurrentPosition is enough
    }
  }, [requestAndGetPosition]);

  useEffect(() => {
    startWatchingPosition();
    return () => {
      if (watchRef.current !== null) {
        Geolocation.clearWatch({ id: watchRef.current }).catch(() => {});
      }
    };
  }, [startWatchingPosition]);

  const getDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371000;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const getRecordForLocation = (locId) => todayRecords.find(r => Number(r.location_id) === Number(locId));

  // Get a fresh pinpoint GPS reading right before action
  const getFreshPosition = async () => {
    try {
      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      });
      const fresh = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      setCurrentPos(fresh);
      setAccuracy(pos.coords.accuracy);
      return fresh;
    } catch {
      return currentPos;
    }
  };

  const handleCheckIn = async (locationId) => {
    if (!currentPos) { toast.error('Waiting for GPS location...'); return; }
    setActionLoading(locationId);
    try {
      const pos = await getFreshPosition() || currentPos;
      const { data } = await api.post('/attendance/check-in', {
        location_id: locationId, latitude: pos.latitude, longitude: pos.longitude,
      });
      if (data.success) {
        toast.success(data.message);
        if (data.record) {
          setTodayRecords(prev => {
            const exists = prev.find(r => Number(r.location_id) === Number(locationId));
            if (exists) return prev.map(r => Number(r.location_id) === Number(locationId) ? { ...r, ...data.record } : r);
            const loc = locations.find(l => Number(l.id) === Number(locationId));
            return [...prev, { ...data.record, location_name: loc?.name || '' }];
          });
        }
        await fetchData();
      }
    } catch (err) {
      const errData = err.response?.data;
      toast.error(errData?.message || 'Check-in failed');
      // If "already checked in" — response includes the existing record
      if (errData?.record) {
        setTodayRecords(prev => {
          const exists = prev.find(r => Number(r.location_id) === Number(locationId));
          if (exists) return prev.map(r => Number(r.location_id) === Number(locationId) ? { ...r, ...errData.record } : r);
          const loc = locations.find(l => Number(l.id) === Number(locationId));
          return [...prev, { ...errData.record, location_name: loc?.name || '' }];
        });
      }
      // Always refresh to get the latest state
      fetchData().catch(() => {});
    }
    finally { setActionLoading(null); }
  };

  const handleCheckOut = async (locationId) => {
    if (!currentPos) { toast.error('Waiting for GPS location...'); return; }
    setActionLoading(locationId);
    try {
      const pos = await getFreshPosition() || currentPos;
      const { data } = await api.post('/attendance/check-out', {
        location_id: locationId, latitude: pos.latitude, longitude: pos.longitude,
      });
      if (data.success) {
        toast.success(data.message);
        if (data.record) {
          setTodayRecords(prev =>
            prev.map(r => Number(r.location_id) === Number(locationId)
              ? { ...r, check_out_time: data.record.check_out_time, check_out_distance_m: data.record.check_out_distance_m }
              : r
            )
          );
        }
        await fetchData();
      }
    } catch (err) {
      const errData = err.response?.data;
      toast.error(errData?.message || 'Check-out failed');
      // If "already checked out" — response includes the record
      if (errData?.record) {
        setTodayRecords(prev =>
          prev.map(r => Number(r.location_id) === Number(locationId) ? { ...r, ...errData.record } : r)
        );
      }
      fetchData().catch(() => {});
    }
    finally { setActionLoading(null); }
  };

  const now = new Date();
  const todayStr = format(now, 'EEEE, MMMM d, yyyy');
  const checkedIn = todayRecords.filter(r => r.check_in_time);
  const checkedOut = todayRecords.filter(r => r.check_out_time);

  return (
    <div className="space-y-6 pb-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Fingerprint className="h-6 w-6 text-indigo-600" /> Mark Attendance
          </h1>
          <p className="text-sm text-slate-500 mt-1">{todayStr}</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <Badge variant="outline" className="gap-1 border-emerald-200 text-emerald-700 bg-emerald-50">
            <LogIn className="h-3 w-3" /> {checkedIn.length} In
          </Badge>
          <Badge variant="outline" className="gap-1 border-rose-200 text-rose-700 bg-rose-50">
            <LogOutIcon className="h-3 w-3" /> {checkedOut.length} Out
          </Badge>
        </div>
      </div>

      <Card className={`border-0 shadow-sm transition-all duration-300 ${
        posError ? 'bg-gradient-to-r from-red-50 to-rose-50' :
        currentPos ? 'bg-gradient-to-r from-emerald-50 to-green-50' :
        'bg-gradient-to-r from-amber-50 to-yellow-50'
      }`}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${
                posError ? 'bg-red-100' : currentPos ? 'bg-emerald-100' : 'bg-amber-100'
              }`}>
                {posError ? <XCircle className="h-5 w-5 text-red-600" /> :
                 currentPos ? <Navigation className="h-5 w-5 text-emerald-600" /> :
                 <Loader2 className="h-5 w-5 text-amber-600 animate-spin" />}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  {posError ? 'Location Error' : currentPos ? 'GPS Active' : 'Getting Location...'}
                </p>
                {posError ? <p className="text-xs text-red-600 mt-0.5 max-w-xs">{posError}</p> :
                 currentPos ? <p className="text-xs text-slate-500 mt-0.5 font-mono">
                   {currentPos.latitude.toFixed(6)}, {currentPos.longitude.toFixed(6)}
                   {accuracy ? ` (` + String.fromCharCode(177) + `${Math.round(accuracy)}m)` : ''}
                 </p> : <p className="text-xs text-slate-500 mt-0.5">Enable location access for attendance</p>}
              </div>
            </div>
            {(posError || !currentPos) && (
              <Button size="sm" variant="outline" className="gap-1.5" onClick={requestAndGetPosition} disabled={gettingPos}>
                {gettingPos ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} {gettingPos ? 'Getting...' : 'Retry'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {todayRecords.length > 0 && (
        <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-50 to-indigo-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-slate-800 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-indigo-600" /> Today's Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {todayRecords.map(r => (
                <div key={r.id} className="flex items-center gap-3 bg-white/70 rounded-xl p-3">
                  <MapPin className="h-4 w-4 text-indigo-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800">{r.location_name}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-emerald-600 flex items-center gap-1">
                        <LogIn className="h-3 w-3" /> {r.check_in_time ? format(new Date(r.check_in_time), 'hh:mm a') : '\u2014'}
                      </span>
                      {r.check_out_time && (
                        <span className="text-xs text-rose-600 flex items-center gap-1">
                          <LogOutIcon className="h-3 w-3" /> {format(new Date(r.check_out_time), 'hh:mm a')}
                        </span>
                      )}
                    </div>
                  </div>
                  <Badge className={`text-[10px] ${
                    r.status === 'LATE' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                  }`}>{r.status}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[0, 1].map(i => (
            <Card key={i} className="animate-pulse border-slate-100">
              <CardContent className="p-6 space-y-4">
                <div className="h-5 w-32 bg-slate-200 rounded" />
                <div className="h-4 w-48 bg-slate-100 rounded" />
                <div className="h-11 w-full bg-slate-100 rounded-xl" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : locations.length === 0 ? (
        <Card className="border-dashed border-2">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-16 w-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
              <MapPin className="h-8 w-8 text-slate-300" />
            </div>
            <h3 className="text-lg font-semibold text-slate-700">No Attendance Locations</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-xs">Contact your admin to set up attendance locations</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {locations.map(loc => {
            const record = getRecordForLocation(loc.id);
            const distance = currentPos
              ? getDistance(currentPos.latitude, currentPos.longitude, parseFloat(loc.latitude), parseFloat(loc.longitude))
              : null;
            const isInRange = distance !== null && distance <= loc.radius_meters;
            const hasCheckedIn = !!record?.check_in_time;
            const hasCheckedOut = !!record?.check_out_time;
            const isComplete = hasCheckedIn && hasCheckedOut;
            const isLoadingThis = actionLoading === loc.id;

            return (
              <Card key={loc.id} className={`transition-all duration-300 overflow-hidden ${
                isComplete ? 'border-emerald-200 bg-emerald-50/30 shadow-emerald-100/50 shadow-sm' :
                hasCheckedIn ? 'border-indigo-200 bg-indigo-50/30 shadow-indigo-100/50 shadow-sm' :
                'border-slate-200 hover:shadow-md'
              }`}>
                <div className={`h-1 w-full ${
                  isComplete ? 'bg-emerald-500' : hasCheckedIn ? 'bg-indigo-500' : 'bg-slate-200'
                }`} />
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${
                        isComplete ? 'bg-emerald-100' : hasCheckedIn ? 'bg-indigo-100' : 'bg-slate-100'
                      }`}>
                        <MapPin className={`h-5 w-5 ${
                          isComplete ? 'text-emerald-600' : hasCheckedIn ? 'text-indigo-600' : 'text-slate-500'
                        }`} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-800">{loc.name}</h3>
                        <div className="flex items-center gap-1.5 mt-1">
                          <Radar className="h-3 w-3 text-slate-400" />
                          <span className="text-xs text-slate-500">Radius: {loc.radius_meters}m</span>
                        </div>
                      </div>
                    </div>
                    {isComplete && (
                      <Badge className="bg-emerald-100 text-emerald-700 text-[10px] gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Done
                      </Badge>
                    )}
                    {hasCheckedIn && !hasCheckedOut && (
                      <Badge className="bg-indigo-100 text-indigo-700 text-[10px] gap-1 animate-pulse">
                        <Clock className="h-3 w-3" /> Working
                      </Badge>
                    )}
                  </div>

                  {distance !== null && (
                    <div className={`flex items-center gap-2 p-2.5 rounded-lg text-sm ${
                      isInRange ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-red-50 text-red-700 border border-red-200'
                    }`}>
                      {isInRange ? (
                        <><Shield className="h-4 w-4 shrink-0" /><span className="font-medium">In range - {Math.round(distance)}m away</span></>
                      ) : (
                        <><AlertTriangle className="h-4 w-4 shrink-0" /><span className="font-medium">Out of range - {Math.round(distance)}m away</span></>
                      )}
                    </div>
                  )}

                  {hasCheckedIn && (
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1.5 text-emerald-600">
                        <LogIn className="h-3.5 w-3.5" />
                        <span className="font-medium">{format(new Date(record.check_in_time), 'hh:mm a')}</span>
                      </div>
                      {hasCheckedOut && (
                        <div className="flex items-center gap-1.5 text-rose-600">
                          <LogOutIcon className="h-3.5 w-3.5" />
                          <span className="font-medium">{format(new Date(record.check_out_time), 'hh:mm a')}</span>
                        </div>
                      )}
                      {record.check_in_distance_m != null && (
                        <span className="text-xs text-slate-400 ml-auto">{String.fromCharCode(177)}{Math.round(record.check_in_distance_m)}m</span>
                      )}
                    </div>
                  )}

                  {!isComplete && (
                    <Button
                      className={`w-full gap-2 h-11 font-semibold text-sm rounded-xl transition-all ${
                        !hasCheckedIn
                          ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200'
                          : 'bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-200'
                      }`}
                      disabled={!currentPos || !isInRange || isLoadingThis || gettingPos}
                      onClick={() => hasCheckedIn ? handleCheckOut(loc.id) : handleCheckIn(loc.id)}
                    >
                      {isLoadingThis ? <Loader2 className="h-4 w-4 animate-spin" /> :
                       !hasCheckedIn ? <><LogIn className="h-4 w-4" /> Check In</> :
                       <><LogOutIcon className="h-4 w-4" /> Check Out</>}
                    </Button>
                  )}

                  {!currentPos && !isComplete && (
                    <p className="text-xs text-center text-amber-600 font-medium">Waiting for GPS location...</p>
                  )}
                  {currentPos && !isInRange && !isComplete && (
                    <p className="text-xs text-center text-red-500">Move closer to this location to mark attendance</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MarkAttendance;
