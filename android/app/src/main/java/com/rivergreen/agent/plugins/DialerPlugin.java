package com.rivergreen.agent.plugins;

import android.Manifest;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.CallLog;
import android.telephony.PhoneStateListener;
import android.telephony.SubscriptionInfo;
import android.telephony.SubscriptionManager;
import android.telephony.TelephonyCallback;
import android.telephony.TelephonyManager;
import android.text.TextUtils;
import android.util.Log;

import androidx.annotation.NonNull;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.util.List;
import java.util.concurrent.Executor;

@CapacitorPlugin(
    name = "Dialer",
    permissions = {
        @Permission(strings = { Manifest.permission.CALL_PHONE }, alias = "callPhone"),
        @Permission(strings = { Manifest.permission.READ_CALL_LOG }, alias = "callLog"),
        @Permission(strings = { Manifest.permission.READ_PHONE_STATE }, alias = "phoneState"),
        @Permission(strings = { Manifest.permission.READ_CONTACTS }, alias = "contacts")
    }
)
public class DialerPlugin extends Plugin {

    private static final String TAG = "RG_DialerPlugin";

    private TelephonyManager telephonyManager;
    private int lastState = TelephonyManager.CALL_STATE_IDLE;
    private long connectedAtMs = 0L;
    private String activePhone = "";
    private String activeDirection = "OUTGOING";

    private PhoneStateListener legacyPhoneStateListener;
    private TelephonyCallback modernTelephonyCallback;

    @Override
    public void load() {
        telephonyManager = (TelephonyManager) getContext().getSystemService(android.content.Context.TELEPHONY_SERVICE);
        registerCallStateListener();
    }

    @Override
    protected void handleOnDestroy() {
        unregisterCallStateListener();
        super.handleOnDestroy();
    }

    @PluginMethod
    public void requestPermissions(PluginCall call) {
        requestAllPermissions(call, "onPermissionsResult");
    }

    @PermissionCallback
    private void onPermissionsResult(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("callPhone", getPermissionState("callPhone") == PermissionState.GRANTED);
        ret.put("callLog", getPermissionState("callLog") == PermissionState.GRANTED);
        ret.put("phoneState", getPermissionState("phoneState") == PermissionState.GRANTED);
        ret.put("contacts", getPermissionState("contacts") == PermissionState.GRANTED);
        call.resolve(ret);
    }

    @PluginMethod
    public void makeCall(PluginCall call) {
        String phoneNumber = sanitizeNumber(call.getString("phoneNumber", ""));
        int simSlot = call.getInt("simSlot", -1);

        if (TextUtils.isEmpty(phoneNumber)) {
            call.reject("phoneNumber is required");
            return;
        }

        if (getPermissionState("callPhone") != PermissionState.GRANTED) {
            call.reject("CALL_PHONE permission not granted");
            return;
        }

        try {
            activePhone = phoneNumber;
            activeDirection = "OUTGOING";

            Intent intent = new Intent(Intent.ACTION_CALL);
            intent.setData(Uri.parse("tel:" + phoneNumber));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

            if (simSlot >= 0) {
                intent.putExtra("simSlot", simSlot);
                intent.putExtra("slot", simSlot);
                intent.putExtra("com.android.phone.extra.slot", simSlot);
            }

            getContext().startActivity(intent);

            JSObject dialing = baseEvent("DIALING");
            notifyListeners("callStateChanged", dialing);

            JSObject ret = new JSObject();
            ret.put("started", true);
            ret.put("phoneNumber", phoneNumber);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "makeCall failed", e);
            call.reject("Failed to start call: " + e.getMessage());
        }
    }

    @PluginMethod
    public void openDialer(PluginCall call) {
        String phoneNumber = sanitizeNumber(call.getString("phoneNumber", ""));
        try {
            Intent intent = new Intent(Intent.ACTION_DIAL);
            intent.setData(Uri.parse("tel:" + phoneNumber));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            JSObject ret = new JSObject();
            ret.put("opened", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to open native dialer: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getRecentCalls(PluginCall call) {
        int limit = call.getInt("limit", 50);
        if (limit <= 0) limit = 50;

        if (getPermissionState("callLog") != PermissionState.GRANTED) {
            JSObject ret = new JSObject();
            ret.put("calls", new JSArray());
            call.resolve(ret);
            return;
        }

        JSArray calls = new JSArray();
        Cursor cursor = null;
        try {
            String[] projection = new String[] {
                CallLog.Calls._ID,
                CallLog.Calls.CACHED_NAME,
                CallLog.Calls.NUMBER,
                CallLog.Calls.TYPE,
                CallLog.Calls.DATE,
                CallLog.Calls.DURATION
            };

            cursor = getContext().getContentResolver().query(
                CallLog.Calls.CONTENT_URI,
                projection,
                null,
                null,
                CallLog.Calls.DATE + " DESC"
            );

            if (cursor != null) {
                int count = 0;
                while (cursor.moveToNext() && count < limit) {
                    JSObject item = new JSObject();
                    String id = cursor.getString(0);
                    String name = cursor.getString(1);
                    String number = cursor.getString(2);
                    int type = cursor.getInt(3);
                    long date = cursor.getLong(4);
                    long duration = cursor.getLong(5);

                    item.put("id", id);
                    item.put("name", name == null ? "" : name);
                    item.put("number", number == null ? "" : number);
                    item.put("type", mapCallType(type));
                    item.put("date", date);
                    item.put("duration", duration);
                    calls.put(item);
                    count++;
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "getRecentCalls failed", e);
        } finally {
            if (cursor != null) cursor.close();
        }

        JSObject ret = new JSObject();
        ret.put("calls", calls);
        call.resolve(ret);
    }

    @PluginMethod
    public void getSIMInfo(PluginCall call) {
        JSArray sims = new JSArray();
        try {
            SubscriptionManager sm = (SubscriptionManager) getContext().getSystemService(android.content.Context.TELEPHONY_SUBSCRIPTION_SERVICE);
            if (sm != null) {
                List<SubscriptionInfo> active = sm.getActiveSubscriptionInfoList();
                if (active != null) {
                    for (SubscriptionInfo info : active) {
                        JSObject item = new JSObject();
                        item.put("slotIndex", info.getSimSlotIndex());
                        item.put("displayName", String.valueOf(info.getDisplayName()));
                        item.put("carrierName", String.valueOf(info.getCarrierName()));
                        item.put("number", info.getNumber() == null ? "" : info.getNumber());
                        sims.put(item);
                    }
                }
            }
        } catch (SecurityException se) {
            Log.w(TAG, "getSIMInfo permission issue: " + se.getMessage());
        } catch (Exception e) {
            Log.w(TAG, "getSIMInfo failed", e);
        }

        JSObject ret = new JSObject();
        ret.put("sims", sims);
        call.resolve(ret);
    }

    private void registerCallStateListener() {
        if (telephonyManager == null) return;

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                Executor executor = getActivity() != null ? getActivity().getMainExecutor() : getContext().getMainExecutor();
                modernTelephonyCallback = new DialerTelephonyCallback();
                telephonyManager.registerTelephonyCallback(executor, modernTelephonyCallback);
            } else {
                legacyPhoneStateListener = new PhoneStateListener() {
                    @Override
                    public void onCallStateChanged(int state, String phoneNumber) {
                        if (!TextUtils.isEmpty(phoneNumber)) activePhone = sanitizeNumber(phoneNumber);
                        handleStateChange(state);
                    }
                };
                telephonyManager.listen(legacyPhoneStateListener, PhoneStateListener.LISTEN_CALL_STATE);
            }
        } catch (Exception e) {
            Log.w(TAG, "registerCallStateListener failed", e);
        }
    }

    private void unregisterCallStateListener() {
        try {
            if (telephonyManager == null) return;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && modernTelephonyCallback != null) {
                telephonyManager.unregisterTelephonyCallback(modernTelephonyCallback);
                modernTelephonyCallback = null;
            }
            if (legacyPhoneStateListener != null) {
                telephonyManager.listen(legacyPhoneStateListener, PhoneStateListener.LISTEN_NONE);
                legacyPhoneStateListener = null;
            }
        } catch (Exception e) {
            Log.w(TAG, "unregisterCallStateListener failed", e);
        }
    }

    private void handleStateChange(int state) {
        if (state == lastState) return;

        if (state == TelephonyManager.CALL_STATE_RINGING) {
            activeDirection = "INCOMING";
            notifyListeners("callStateChanged", baseEvent("RINGING"));
        } else if (state == TelephonyManager.CALL_STATE_OFFHOOK) {
            connectedAtMs = System.currentTimeMillis();
            JSObject connected = baseEvent("CONNECTED");
            connected.put("connectedAt", connectedAtMs);
            notifyListeners("callStateChanged", connected);
            notifyListeners("callConnected", connected);
        } else if (state == TelephonyManager.CALL_STATE_IDLE) {
            long endedAt = System.currentTimeMillis();
            long fallbackDuration = connectedAtMs > 0 ? Math.max(0, (endedAt - connectedAtMs) / 1000L) : 0;

            final String endedPhone = activePhone == null ? "" : activePhone;
            final String endedDirection = activeDirection;
            final long finalFallback = fallbackDuration;
            final boolean wasConnected = connectedAtMs > 0;

            connectedAtMs = 0L;
            activeDirection = "OUTGOING";

            // Delay to let Android write the CallLog entry
            new Handler(Looper.getMainLooper()).postDelayed(() -> {
                long accurateDuration = finalFallback;
                if (wasConnected) {
                    int callLogDuration = queryCallLogDuration(endedPhone);
                    if (callLogDuration >= 0) {
                        accurateDuration = callLogDuration;
                        Log.d(TAG, "Using CallLog duration: " + callLogDuration + "s (fallback was " + finalFallback + "s)");
                    }
                } else {
                    accurateDuration = 0;
                }

                JSObject ended = baseEvent("ENDED");
                ended.put("phoneNumber", endedPhone);
                ended.put("endedAt", System.currentTimeMillis());
                ended.put("duration", accurateDuration);
                ended.put("callType", endedDirection);
                notifyListeners("callStateChanged", ended);
                notifyListeners("callEnded", ended);
            }, 1500);
        }

        lastState = state;
    }

    @NonNull
    private JSObject baseEvent(String state) {
        JSObject obj = new JSObject();
        obj.put("state", state);
        obj.put("phoneNumber", activePhone == null ? "" : activePhone);
        obj.put("timestamp", System.currentTimeMillis());
        return obj;
    }

    private String sanitizeNumber(String raw) {
        if (raw == null) return "";
        return raw.replaceAll("[^0-9+]", "");
    }

    private String mapCallType(int type) {
        switch (type) {
            case CallLog.Calls.INCOMING_TYPE:
                return "INCOMING";
            case CallLog.Calls.OUTGOING_TYPE:
                return "OUTGOING";
            case CallLog.Calls.MISSED_TYPE:
                return "MISSED";
            case CallLog.Calls.REJECTED_TYPE:
                return "REJECTED";
            default:
                return "UNKNOWN";
        }
    }

    private class DialerTelephonyCallback extends TelephonyCallback implements TelephonyCallback.CallStateListener {
        @Override
        public void onCallStateChanged(int state) {
            handleStateChange(state);
        }
    }

    // ── Query CallLog for accurate talk duration ─────────────────────────────

    private int queryCallLogDuration(String phoneNumber) {
        try {
            String[] projection = { CallLog.Calls.DURATION, CallLog.Calls.DATE, CallLog.Calls.NUMBER };
            long cutoff = System.currentTimeMillis() - 120_000;

            // Strategy 1: Try matching by phone number
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

            // Strategy 2: Fallback — most recent entry
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

