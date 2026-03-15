package com.rivergreen.agent.plugins;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.util.Log;

/**
 * Listens for BOOT_COMPLETED to automatically restart the CallDetectorService
 * after device reboot. This ensures call detection is always active.
 */
public class BootReceiver extends BroadcastReceiver {

    private static final String TAG = "RG_BootReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || intent.getAction() == null) return;

        if (Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) {
            Log.d(TAG, "BOOT_COMPLETED received — starting CallDetectorService");
            startCallDetectorService(context);
        }
    }

    private void startCallDetectorService(Context context) {
        try {
            Intent serviceIntent = new Intent(context, CallDetectorService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent);
            } else {
                context.startService(serviceIntent);
            }
            Log.d(TAG, "CallDetectorService started after boot");
        } catch (Exception e) {
            Log.e(TAG, "Failed to start service after boot: " + e.getMessage());
        }
    }
}

