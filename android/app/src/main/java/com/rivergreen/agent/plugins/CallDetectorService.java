package com.rivergreen.agent.plugins;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.provider.CallLog;
import android.telephony.PhoneStateListener;
import android.telephony.TelephonyManager;
import android.util.Log;

import androidx.core.app.NotificationCompat;

/**
 * Foreground Service that runs in the :call_detector process.
 * It survives the main app being killed because of android:process=":call_detector".
 *
 * Responsibilities:
 * - Listens for telephony state changes via TelephonyManager
 * - Tracks call state machine (RINGING/OFFHOOK/IDLE)
 * - On call end → stores call data in SharedPreferences AND launches PostCallOverlayService
 * - Uses START_STICKY so Android restarts it if killed
 */
public class CallDetectorService extends Service {

    private static final String TAG = "RG_CallDetectorSvc";
    private static final String CHANNEL_ID = "call_detector_channel";
    private static final int NOTIFICATION_ID = 9001;
    public static final String PREFS_NAME = "rg_call_events";

    private TelephonyManager telephonyManager;
    private PhoneStateListener phoneStateListener;

    // Call state machine
    private String lastState = "IDLE";
    private String callType = "UNKNOWN";
    private String capturedNumber = null;
    private boolean wasAnswered = false;
    private long callStartMs = 0L;

    @Override
    public void onCreate() {
        super.onCreate();
        Log.d(TAG, "onCreate: service created in process " + android.os.Process.myPid());
        createNotificationChannel();
        startForeground(NOTIFICATION_ID, buildNotification());
        startListeningToPhoneState();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Log.d(TAG, "onStartCommand: START_STICKY");
        // If we got a phone number passed in from the broadcast receiver
        if (intent != null && intent.hasExtra("phone_number")) {
            String number = intent.getStringExtra("phone_number");
            String state = intent.getStringExtra("phone_state");
            if (number != null) {
                Log.d(TAG, "onStartCommand: received number=" + number + " state=" + state);
            }
        }
        return START_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        Log.d(TAG, "onDestroy: cleaning up listener");
        stopListeningToPhoneState();
        super.onDestroy();
    }

    // ── Notification channel & foreground notification ────────────────────────

    private void createNotificationChannel() {
        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Call Detection Service",
                NotificationManager.IMPORTANCE_LOW
        );
        channel.setDescription("Monitors phone calls to help you capture leads");
        channel.setShowBadge(false);
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm != null) nm.createNotificationChannel(channel);
    }

    private Notification buildNotification() {
        Intent launchIntent = getPackageManager().getLaunchIntentForPackage(getPackageName());
        PendingIntent pi = PendingIntent.getActivity(
                this, 0, launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("RiverGreen Active")
                .setContentText("Monitoring calls for lead capture")
                .setSmallIcon(android.R.drawable.ic_menu_call)
                .setOngoing(true)
                .setContentIntent(pi)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .build();
    }

    // ── Telephony state listener ─────────────────────────────────────────────

    private void startListeningToPhoneState() {
        telephonyManager = (TelephonyManager) getSystemService(Context.TELEPHONY_SERVICE);
        if (telephonyManager == null) {
            Log.e(TAG, "TelephonyManager is null — cannot listen");
            return;
        }

        phoneStateListener = new PhoneStateListener() {
            @Override
            public void onCallStateChanged(int state, String incomingNumber) {
                handleCallState(state, incomingNumber);
            }
        };

        try {
            telephonyManager.listen(phoneStateListener, PhoneStateListener.LISTEN_CALL_STATE);
            Log.d(TAG, "startListeningToPhoneState: registered");
        } catch (SecurityException e) {
            Log.e(TAG, "SecurityException registering listener: " + e.getMessage());
        }
    }

    private void stopListeningToPhoneState() {
        if (telephonyManager != null && phoneStateListener != null) {
            telephonyManager.listen(phoneStateListener, PhoneStateListener.LISTEN_NONE);
        }
    }

    private void handleCallState(int state, String phoneNumber) {
        Log.d(TAG, "handleCallState: state=" + state + " number=" + phoneNumber);

        switch (state) {
            case TelephonyManager.CALL_STATE_RINGING:
                if (phoneNumber != null && !phoneNumber.isEmpty()) {
                    capturedNumber = phoneNumber;
                }
                callType = "INCOMING";
                wasAnswered = false;
                callStartMs = 0L;
                lastState = "RINGING";
                break;

            case TelephonyManager.CALL_STATE_OFFHOOK:
                wasAnswered = true;
                callStartMs = System.currentTimeMillis();
                if ("IDLE".equals(lastState)) {
                    // IDLE → OFFHOOK = outgoing call
                    callType = "OUTGOING";
                }
                lastState = "OFFHOOK";
                break;

            case TelephonyManager.CALL_STATE_IDLE:
                if ("OFFHOOK".equals(lastState) || "RINGING".equals(lastState)) {
                    // Call just ended
                    final int fallbackDuration = (wasAnswered && callStartMs > 0L)
                            ? (int) ((System.currentTimeMillis() - callStartMs) / 1000L)
                            : 0;

                    final String resolvedType = (!wasAnswered && "INCOMING".equals(callType))
                            ? "MISSED"
                            : callType;

                    final String number = (capturedNumber != null) ? capturedNumber : "";
                    final boolean finalWasAnswered = wasAnswered;

                    Log.i(TAG, "CALL ENDED → type=" + resolvedType + " number=" + number
                            + " fallbackDuration=" + fallbackDuration + "s");

                    // Delay to let Android write the CallLog entry,
                    // then query for accurate talk duration
                    new Handler(Looper.getMainLooper()).postDelayed(() -> {
                        int accurateDuration = fallbackDuration;
                        if (finalWasAnswered) {
                            int callLogDuration = queryCallLogDuration(number);
                            if (callLogDuration >= 0) {
                                accurateDuration = callLogDuration;
                                Log.d(TAG, "Using CallLog duration: " + callLogDuration + "s (fallback was " + fallbackDuration + "s)");
                            }
                        } else {
                            accurateDuration = 0;
                        }

                        // Store in SharedPreferences for the Capacitor plugin to pick up
                        storeCallEvent(number, resolvedType, accurateDuration);

                        // Launch overlay
                        launchOverlay(number, resolvedType, accurateDuration);
                    }, 1500);
                }

                // Reset state machine
                lastState = "IDLE";
                callType = "UNKNOWN";
                capturedNumber = null;
                wasAnswered = false;
                callStartMs = 0L;
                break;
        }
    }

    // ── Store call for Capacitor plugin to pick up ───────────────────────────

    private void storeCallEvent(String phoneNumber, String callType, int durationSecs) {
        try {
            String json = "{\"phoneNumber\":\"" + escapeJson(phoneNumber)
                    + "\",\"callType\":\"" + callType
                    + "\",\"duration\":" + durationSecs
                    + ",\"timestamp\":" + System.currentTimeMillis() + "}";

            getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                    .edit()
                    .putString("pending_call", json)
                    .putLong("pending_ts", System.currentTimeMillis())
                    .apply();

            Log.d(TAG, "storeCallEvent: " + json);
        } catch (Exception e) {
            Log.e(TAG, "storeCallEvent failed: " + e.getMessage());
        }
    }

    private String escapeJson(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    // ── Launch the React App Drawer ──────────────────────────────────────────

    private void launchOverlay(String phoneNumber, String callType, int durationSecs) {
        // OEM devices (MIUI, ColorOS) often silently block SYSTEM_ALERT_WINDOW custom views.
        // However, having the SYSTEM_ALERT_WINDOW permission GRANTS the right to launch Activities 
        // from the background on Android 10+. So we will directly launch the React app!
        launchDeepLink(phoneNumber, callType, durationSecs);
        showHeadsUpNotification(phoneNumber, callType, durationSecs);
    }

    private void launchDeepLink(String phoneNumber, String callType, int durationSecs) {
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW,
                    android.net.Uri.parse("rivergreen://leads/add?phone=" + android.net.Uri.encode(phoneNumber)
                            + "&callType=" + android.net.Uri.encode(callType)
                            + "&duration=" + durationSecs
                            + "&auto=true"));
            
            // Critical flags to launch from background and wake up the existing task
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK 
                          | Intent.FLAG_ACTIVITY_CLEAR_TOP 
                          | Intent.FLAG_ACTIVITY_SINGLE_TOP);
                          
            startActivity(intent);
            Log.d(TAG, "launchDeepLink: Launched React App");
        } catch (Exception e) {
            Log.e(TAG, "launchDeepLink failed: " + e.getMessage());
        }
    }

    private void showHeadsUpNotification(String phoneNumber, String callType, int durationSecs) {
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW,
                    android.net.Uri.parse("rivergreen://leads/add?phone=" + android.net.Uri.encode(phoneNumber)
                            + "&callType=" + android.net.Uri.encode(callType)
                            + "&duration=" + durationSecs
                            + "&auto=true"));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            
            PendingIntent pi = PendingIntent.getActivity(this, (int)System.currentTimeMillis(), intent, 
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

            NotificationManager nm = getSystemService(NotificationManager.class);
            String channelId = "post_call_heads_up";
            
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                NotificationChannel channel = new NotificationChannel(
                        channelId, "Call Alerts", NotificationManager.IMPORTANCE_HIGH);
                channel.setDescription("Alerts you immediately after a call ends");
                channel.enableVibration(true);
                if (nm != null) nm.createNotificationChannel(channel);
            }

            NotificationCompat.Builder builder = new NotificationCompat.Builder(this, channelId)
                    .setContentTitle("Call Ended")
                    .setContentText("Tap to log " + phoneNumber + " as a lead")
                    .setSmallIcon(android.R.drawable.ic_menu_call)
                    .setPriority(NotificationCompat.PRIORITY_HIGH)
                    .setCategory(NotificationCompat.CATEGORY_CALL)
                    .setAutoCancel(true)
                    .setContentIntent(pi)
                    .setFullScreenIntent(pi, true); // wakes up screen if locked

            if (nm != null) nm.notify((int)System.currentTimeMillis(), builder.build());
        } catch (Exception e) {
            Log.e(TAG, "Notification failed: " + e.getMessage());
        }
    }

    // ── Query CallLog for accurate talk duration ─────────────────────────────

    /**
     * Query the system CallLog for the most recent call to/from the given number.
     * Returns the duration in seconds, or -1 if not found.
     */
    private int queryCallLogDuration(String phoneNumber) {
        try {
            String[] projection = { CallLog.Calls.DURATION, CallLog.Calls.DATE, CallLog.Calls.NUMBER };
            long cutoff = System.currentTimeMillis() - 120_000;

            // Strategy 1: Try matching by phone number
            if (phoneNumber != null && !phoneNumber.isEmpty()) {
                String normalized = phoneNumber.replaceAll("[^0-9]", "");
                String tail = normalized.length() > 7 ? normalized.substring(normalized.length() - 7) : normalized;
                Cursor cursor = getContentResolver().query(
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
            Cursor cursor = getContentResolver().query(
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

