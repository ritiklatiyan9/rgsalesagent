package com.rivergreen.agent.plugins;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.CallLog;
import android.provider.Settings;
import android.telephony.TelephonyManager;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.PermissionState;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(
    name = "CallDetector",
    permissions = {
        @Permission(strings = { Manifest.permission.READ_PHONE_STATE }, alias = "phoneState"),
        @Permission(strings = { Manifest.permission.READ_CALL_LOG    }, alias = "callLog")
    }
)
public class CallDetectorPlugin extends Plugin implements CallStateReceiver.CallStateListener {

    private static final String TAG        = "RG_CallDetectorPlugin";
    private static final String PREFS_NAME = "rg_call_events";

    private CallStateReceiver receiver       = null;
    private boolean           isListening    = false;
    private long              callStartMs    = 0L;
    private String            capturedNumber = null;
    private String            callType       = "UNKNOWN";
    private boolean           wasAnswered    = false;

    // ── Lifecycle — auto-start when possible ─────────────────────────────────

    @Override
    public void load() {
        if (getPermissionState("phoneState") == PermissionState.GRANTED) {
            registerReceiver();
            isListening = true;
            Log.d(TAG, "load: auto-started listening (permissions already granted)");
            // Also start the foreground service for background detection
            startForegroundDetectionService();
        } else {
            Log.d(TAG, "load: permissions not yet granted — waiting");
        }
    }

    @Override
    protected void handleOnResume() {
        // After user grants permissions via the Activity dialog, this fires
        if (!isListening && getPermissionState("phoneState") == PermissionState.GRANTED) {
            registerReceiver();
            isListening = true;
            Log.d(TAG, "handleOnResume: auto-started listening");
        }
        // DISABLED: deliverPendingCall() often clears the data before React is hydrated.
        // We now rely on the much more robust Channel 3 (visibilitycheck polling in useCallListener.js).
        // deliverPendingCall();
    }

    @Override
    protected void handleOnDestroy() {
        unregisterReceiver();
        super.handleOnDestroy();
    }

    // ── Plugin methods (called from JS) ──────────────────────────────────────

    @PluginMethod
    public void startListening(PluginCall call) {
        if (isListening) {
            JSObject ret = new JSObject();
            ret.put("listening", true);
            call.resolve(ret);
            return;
        }
        if (getPermissionState("phoneState") != PermissionState.GRANTED) {
            requestPermissionForAlias("phoneState", call, "onPermissionsResult");
            return;
        }
        registerReceiver();
        isListening = true;
        Log.d(TAG, "startListening: receiver registered");
        JSObject ret = new JSObject();
        ret.put("listening", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void stopListening(PluginCall call) {
        unregisterReceiver();
        isListening = false;
        Log.d(TAG, "stopListening: receiver unregistered");
        JSObject ret = new JSObject();
        ret.put("listening", false);
        call.resolve(ret);
    }

    @PluginMethod
    public void startCallDetection(PluginCall call) {
        startForegroundDetectionService();
        JSObject ret = new JSObject();
        ret.put("started", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void stopCallDetection(PluginCall call) {
        try {
            Intent serviceIntent = new Intent(getContext(), CallDetectorService.class);
            getContext().stopService(serviceIntent);
        } catch (Exception e) {
            Log.w(TAG, "stopCallDetection: " + e.getMessage());
        }
        JSObject ret = new JSObject();
        ret.put("stopped", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void requestOverlayPermission(PluginCall call) {
        if (Settings.canDrawOverlays(getContext())) {
            JSObject ret = new JSObject();
            ret.put("granted", true);
            call.resolve(ret);
            return;
        }
        try {
            Intent intent = new Intent(
                Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Uri.parse("package:" + getContext().getPackageName())
            );
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
        } catch (Exception e) {
            Log.w(TAG, "requestOverlayPermission: " + e.getMessage());
        }
        JSObject ret = new JSObject();
        ret.put("granted", false);
        ret.put("openedSettings", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void checkOverlayPermission(PluginCall call) {
        boolean granted = Settings.canDrawOverlays(getContext());
        JSObject ret = new JSObject();
        ret.put("granted", granted);
        call.resolve(ret);
    }

    @PluginMethod
    public void openAutostartSettings(PluginCall call) {
        boolean success = false;
        try {
            Intent intent = new Intent();
            String manufacturer = android.os.Build.MANUFACTURER.toLowerCase();
            
            if ("xiaomi".equals(manufacturer) || "poco".equals(manufacturer)) {
                intent.setComponent(new android.content.ComponentName("com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity"));
            } else if ("oppo".equals(manufacturer) || "realme".equals(manufacturer)) {
                intent.setComponent(new android.content.ComponentName("com.coloros.safecenter", "com.coloros.safecenter.permission.startup.StartupAppListActivity"));
            } else if ("vivo".equals(manufacturer)) {
                intent.setComponent(new android.content.ComponentName("com.vivo.permissionmanager", "com.vivo.permissionmanager.activity.BgStartUpManagerActivity"));
            } else if ("oneplus".equals(manufacturer)) {
                intent.setComponent(new android.content.ComponentName("com.oneplus.security", "com.oneplus.security.chainlaunch.view.AllowAutoLaunchActivity"));
            } else if ("huawei".equals(manufacturer) || "honor".equals(manufacturer)) {
                intent.setComponent(new android.content.ComponentName("com.huawei.systemmanager", "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity"));
            } else if ("samsung".equals(manufacturer)) {
                intent.setComponent(new android.content.ComponentName("com.samsung.android.lool", "com.samsung.android.sm.ui.battery.BatteryActivity"));
            } else {
                // Generic app info fallback
                intent.setAction(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                intent.setData(Uri.parse("package:" + getContext().getPackageName()));
            }

            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            success = true;
            Log.d(TAG, "Opened autostart/background settings for " + manufacturer);
        } catch (Exception e) {
            Log.e(TAG, "Failed to open autostart settings: " + e.getMessage());
            try {
                // Ultimate fallback
                Intent fallback = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                fallback.setData(Uri.parse("package:" + getContext().getPackageName()));
                fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(fallback);
                success = true;
            } catch (Exception ignored) {}
        }
        
        JSObject ret = new JSObject();
        ret.put("success", success);
        call.resolve(ret);
    }

    @PluginMethod
    public void openBatterySettings(PluginCall call) {
        boolean success = false;
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                android.os.PowerManager pm = (android.os.PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
                if (pm != null && pm.isIgnoringBatteryOptimizations(getContext().getPackageName())) {
                    JSObject ret = new JSObject();
                    ret.put("success", true);
                    ret.put("alreadyIgnored", true);
                    call.resolve(ret);
                    return;
                }
                
                Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                intent.setData(Uri.parse("package:" + getContext().getPackageName()));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);
                success = true;
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to open battery settings: " + e.getMessage());
        }
        JSObject ret = new JSObject();
        ret.put("success", success);
        ret.put("alreadyIgnored", false);
        call.resolve(ret);
    }

    @PluginMethod
    public void requestPermissions(PluginCall call) {
        requestAllPermissions(call, "onPermissionsResult");
    }

    @PermissionCallback
    private void onPermissionsResult(PluginCall call) {
        boolean granted = getPermissionState("phoneState") == PermissionState.GRANTED;
        if (granted && !isListening) {
            registerReceiver();
            isListening = true;
            Log.d(TAG, "onPermissionsResult: started listening");
        }
        JSObject ret = new JSObject();
        ret.put("granted", granted);
        call.resolve(ret);
    }

    // ── Foreground service management ────────────────────────────────────────

    private void startForegroundDetectionService() {
        try {
            Intent serviceIntent = new Intent(getContext(), CallDetectorService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                getContext().startForegroundService(serviceIntent);
            } else {
                getContext().startService(serviceIntent);
            }
            Log.d(TAG, "startForegroundDetectionService: started");
        } catch (Exception e) {
            Log.w(TAG, "startForegroundDetectionService failed: " + e.getMessage());
        }
    }

    // ── Receiver management ──────────────────────────────────────────────────

    private void registerReceiver() {
        if (receiver != null) return;
        receiver = new CallStateReceiver();
        CallStateReceiver.listener = this;
        IntentFilter filter = new IntentFilter();
        filter.addAction(TelephonyManager.ACTION_PHONE_STATE_CHANGED);
        filter.addAction(Intent.ACTION_NEW_OUTGOING_CALL);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            getContext().registerReceiver(receiver, filter, Context.RECEIVER_EXPORTED);
        } else {
            getContext().registerReceiver(receiver, filter);
        }
        Log.d(TAG, "registerReceiver: done");
    }

    private void unregisterReceiver() {
        if (receiver != null) {
            try { getContext().unregisterReceiver(receiver); } catch (Exception ignored) {}
            receiver = null;
        }
        CallStateReceiver.listener = null;
    }

    // ── Call state handling ───────────────────────────────────────────────────

    @Override
    public void onCallStateChanged(CallStateReceiver.CallEvent state, String phoneNumber) {
        Log.d(TAG, "onCallStateChanged: " + state + "  number=" + phoneNumber);
        switch (state) {
            case RINGING:
                capturedNumber = phoneNumber;
                callType       = "INCOMING";
                wasAnswered    = false;
                callStartMs    = 0L;
                break;

            case OUTGOING_STARTED:
                capturedNumber = phoneNumber;
                callType       = "OUTGOING";
                wasAnswered    = false;
                callStartMs    = 0L;
                break;

            case OFFHOOK:
                wasAnswered = true;
                callStartMs = System.currentTimeMillis();
                if ("UNKNOWN".equals(callType)) callType = "OUTGOING";
                // Capture the number if not already set
                // (ACTION_NEW_OUTGOING_CALL may not fire on Android 10+)
                if (capturedNumber == null && phoneNumber != null && !phoneNumber.isEmpty()) {
                    capturedNumber = phoneNumber;
                }
                break;

            case IDLE: {
                final int fallbackDuration = (wasAnswered && callStartMs > 0L)
                    ? (int) ((System.currentTimeMillis() - callStartMs) / 1000L)
                    : 0;

                final String resolvedType = (!wasAnswered && "INCOMING".equals(callType))
                    ? "MISSED"
                    : callType;

                final String finalNumber = capturedNumber != null ? capturedNumber : "";
                final boolean finalWasAnswered = wasAnswered;

                // Reset state machine immediately
                capturedNumber = null;
                callType       = "UNKNOWN";
                wasAnswered    = false;
                callStartMs    = 0L;

                // Delay slightly to let Android write the CallLog entry,
                // then query it for the accurate talk duration
                new Handler(Looper.getMainLooper()).postDelayed(() -> {
                    int accurateDuration = fallbackDuration;
                    if (finalWasAnswered) {
                        int callLogDuration = queryCallLogDuration(finalNumber);
                        if (callLogDuration >= 0) {
                            accurateDuration = callLogDuration;
                            Log.d(TAG, "Using CallLog duration: " + callLogDuration + "s (fallback was " + fallbackDuration + "s)");
                        }
                    } else {
                        accurateDuration = 0;
                    }

                    JSObject data = new JSObject();
                    data.put("phoneNumber", finalNumber);
                    data.put("callType",    resolvedType);
                    data.put("duration",    accurateDuration);
                    data.put("timestamp",   System.currentTimeMillis());

                    Log.i(TAG, "callEnded → " + data.toString());

                    // Channel 1: Capacitor plugin event
                    notifyListeners("callEnded", data);

                    // Channel 2: Direct evaluateJavascript
                    try {
                        final String json = data.toString();
                        final String js = "try{window.dispatchEvent(new CustomEvent('callEnded',{detail:"
                            + json + "}))}catch(e){console.error('[RG]',e)}";
                        getActivity().runOnUiThread(() -> {
                            try {
                                getBridge().getWebView().evaluateJavascript(js, null);
                            } catch (Exception ignored) {}
                        });
                        Log.d(TAG, "evaluateJavascript: delivered");
                    } catch (Exception e) {
                        Log.w(TAG, "evaluateJavascript failed: " + e.getMessage());
                    }

                    // Store in SharedPreferences for delivery on next app resume
                    try {
                        getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                            .edit()
                            .putString("pending_call", data.toString())
                            .putLong("pending_ts", System.currentTimeMillis())
                            .apply();
                    } catch (Exception e) {
                        Log.w(TAG, "SharedPreferences save failed: " + e.getMessage());
                    }
                }, 1500); // 1500ms delay for CallLog to be written

                break;
            }
        }
    }

    // ── Pending call delivery ────────────────────────────────────────────────

    private void deliverPendingCall() {
        try {
            SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            String pending = prefs.getString("pending_call", null);
            if (pending == null) return;

            long ts = prefs.getLong("pending_ts", 0);
            // Only deliver if less than 5 minutes old
            if (System.currentTimeMillis() - ts > 300_000) {
                prefs.edit().remove("pending_call").remove("pending_ts").apply();
                return;
            }

            // Clear first to prevent double-delivery
            prefs.edit().remove("pending_call").remove("pending_ts").apply();

            final String js = "try{window.dispatchEvent(new CustomEvent('callEnded',{detail:"
                + pending + "}))}catch(e){console.error('[RG]',e)}";
            getActivity().runOnUiThread(() -> {
                try {
                    getBridge().getWebView().evaluateJavascript(js, null);
                } catch (Exception ignored) {}
            });
            Log.d(TAG, "deliverPendingCall: delivered → " + pending);
        } catch (Exception e) {
            Log.w(TAG, "deliverPendingCall error: " + e.getMessage());
        }
    }

    // ── getLastCall — JS can poll this for pending calls ──────────────────────

    @PluginMethod
    public void getLastCall(PluginCall call) {
        try {
            SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            String pending = prefs.getString("pending_call", null);
            if (pending == null) {
                JSObject ret = new JSObject();
                ret.put("hasCall", false);
                call.resolve(ret);
                return;
            }
            long ts = prefs.getLong("pending_ts", 0);
            if (System.currentTimeMillis() - ts > 300_000) {
                prefs.edit().remove("pending_call").remove("pending_ts").apply();
                JSObject ret = new JSObject();
                ret.put("hasCall", false);
                call.resolve(ret);
                return;
            }
            // Clear so it's not delivered twice
            prefs.edit().remove("pending_call").remove("pending_ts").apply();
            JSObject ret = new JSObject();
            ret.put("hasCall", true);
            ret.put("call", new JSObject(pending));
            call.resolve(ret);
        } catch (Exception e) {
            JSObject ret = new JSObject();
            ret.put("hasCall", false);
            call.resolve(ret);
        }
    }

    // ── Query CallLog for accurate talk duration ─────────────────────────────

    /**
     * Query the system CallLog for the most recent call to/from the given number.
     * Returns the duration in seconds, or -1 if not found.
     * The system CallLog records actual talk time (answer → hangup), which is
     * what we need instead of the OFFHOOK→IDLE time that includes ringing.
     */
    private int queryCallLogDuration(String phoneNumber) {
        try {
            if (getPermissionState("callLog") != PermissionState.GRANTED) {
                Log.w(TAG, "queryCallLogDuration: READ_CALL_LOG not granted");
                return -1;
            }

            String[] projection = { CallLog.Calls.DURATION, CallLog.Calls.DATE, CallLog.Calls.NUMBER };
            long cutoff = System.currentTimeMillis() - 120_000; // within last 2 minutes

            // Strategy 1: Try matching by phone number (last 7 digits for broad match)
            if (phoneNumber != null && !phoneNumber.isEmpty()) {
                String normalized = phoneNumber.replaceAll("[^0-9]", "");
                String tail = normalized.length() > 7 ? normalized.substring(normalized.length() - 7) : normalized;
                Cursor cursor = getContext().getContentResolver().query(
                    CallLog.Calls.CONTENT_URI,
                    projection,
                    CallLog.Calls.NUMBER + " LIKE ? AND " + CallLog.Calls.DATE + " > ?",
                    new String[]{ "%" + tail, String.valueOf(cutoff) },
                    CallLog.Calls.DATE + " DESC"
                );
                if (cursor != null) {
                    try {
                        if (cursor.moveToFirst()) {
                            int dur = cursor.getInt(cursor.getColumnIndexOrThrow(CallLog.Calls.DURATION));
                            Log.d(TAG, "queryCallLogDuration: by-number match → " + dur + "s");
                            return dur;
                        }
                    } finally { cursor.close(); }
                }
            }

            // Strategy 2: Fallback — get the most recent CallLog entry (no number filter)
            Cursor cursor = getContext().getContentResolver().query(
                CallLog.Calls.CONTENT_URI,
                projection,
                CallLog.Calls.DATE + " > ?",
                new String[]{ String.valueOf(cutoff) },
                CallLog.Calls.DATE + " DESC"
            );
            if (cursor != null) {
                try {
                    if (cursor.moveToFirst()) {
                        int dur = cursor.getInt(cursor.getColumnIndexOrThrow(CallLog.Calls.DURATION));
                        String num = cursor.getString(cursor.getColumnIndexOrThrow(CallLog.Calls.NUMBER));
                        Log.d(TAG, "queryCallLogDuration: fallback most-recent → " + dur + "s, number=" + num);
                        return dur;
                    }
                } finally { cursor.close(); }
            }
        } catch (Exception e) {
            Log.w(TAG, "queryCallLogDuration failed: " + e.getMessage());
        }
        return -1;
    }
}

