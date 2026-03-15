package com.rivergreen.agent.plugins;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.telephony.TelephonyManager;
import android.util.Log;

/**
 * BroadcastReceiver that listens to phone call state changes.
 * Also ensures CallDetectorService is running as a safety net.
 */
public class CallStateReceiver extends BroadcastReceiver {

    private static final String TAG = "RG_CallStateReceiver";

    public enum CallEvent { RINGING, OFFHOOK, IDLE, OUTGOING_STARTED }

    public interface CallStateListener {
        void onCallStateChanged(CallEvent state, String phoneNumber);
    }

    // Singleton listener — set by CallDetectorPlugin
    public static CallStateListener listener = null;

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || intent.getAction() == null) return;

        // Safety net: ensure the foreground service is running
        ensureServiceRunning(context);

        switch (intent.getAction()) {
            case Intent.ACTION_NEW_OUTGOING_CALL: {
                String number = intent.getStringExtra(Intent.EXTRA_PHONE_NUMBER);
                Log.d(TAG, "OUTGOING_STARTED number=" + number);
                if (listener != null) listener.onCallStateChanged(CallEvent.OUTGOING_STARTED, number);
                break;
            }
            case TelephonyManager.ACTION_PHONE_STATE_CHANGED: {
                String stateStr = intent.getStringExtra(TelephonyManager.EXTRA_STATE);
                String number   = intent.getStringExtra(TelephonyManager.EXTRA_INCOMING_NUMBER);
                Log.d(TAG, "PHONE_STATE=" + stateStr + " number=" + number);
                if (listener == null || stateStr == null) break;
                if (stateStr.equals(TelephonyManager.EXTRA_STATE_RINGING)) {
                    listener.onCallStateChanged(CallEvent.RINGING, number);
                } else if (stateStr.equals(TelephonyManager.EXTRA_STATE_OFFHOOK)) {
                    listener.onCallStateChanged(CallEvent.OFFHOOK, number);
                } else if (stateStr.equals(TelephonyManager.EXTRA_STATE_IDLE)) {
                    showDebugNotification(context, "Call ENDED Receiver: " + number);
                    listener.onCallStateChanged(CallEvent.IDLE, number);
                }
                break;
            }
        }
    }

    private void showDebugNotification(Context context, String msg) {
        try {
            android.app.NotificationManager nm = (android.app.NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            android.app.NotificationChannel channel = new android.app.NotificationChannel(
                    "debug_channel", "Debug", android.app.NotificationManager.IMPORTANCE_HIGH);
            nm.createNotificationChannel(channel);
            
            android.app.Notification notif = new androidx.core.app.NotificationCompat.Builder(context, "debug_channel")
                    .setContentTitle("Debug")
                    .setContentText(msg)
                    .setSmallIcon(android.R.drawable.ic_dialog_info)
                    .build();
            nm.notify((int) System.currentTimeMillis(), notif);
        } catch (Exception e) {}
    }

    /**
     * Ensure the foreground CallDetectorService is running.
     * If the service was killed by the OS, this will restart it.
     */
    private void ensureServiceRunning(Context context) {
        try {
            Intent serviceIntent = new Intent(context, CallDetectorService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent);
            } else {
                context.startService(serviceIntent);
            }
        } catch (Exception e) {
            Log.w(TAG, "ensureServiceRunning failed: " + e.getMessage());
        }
    }
}

