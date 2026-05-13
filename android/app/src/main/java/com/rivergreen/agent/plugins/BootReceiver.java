package com.rivergreen.agent.plugins;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
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
            // Foreground service auto-start on boot is disabled to avoid the
            // persistent "DG Sales is running in background" notification.
            // The CallStateReceiver registered in the manifest still wakes up
            // the app for telephony broadcasts when the user makes a call.
            Log.d(TAG, "BOOT_COMPLETED received — foreground service auto-start is disabled");
        }
    }
}

