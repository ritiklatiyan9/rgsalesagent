package com.rivergreen.agent;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.util.Log;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;
import com.rivergreen.agent.plugins.CallDetectorPlugin;
import com.rivergreen.agent.plugins.CallDetectorService;
import com.rivergreen.agent.plugins.DialerPlugin;

public class MainActivity extends BridgeActivity {
	private static final String TAG = "RG_MainActivity";
	private static final int PHONE_PERM_CODE = 1001;
	private static final int OVERLAY_PERM_CODE = 1002;

	@Override
	public void onCreate(Bundle savedInstanceState) {
		registerPlugin(CallDetectorPlugin.class);
		registerPlugin(DialerPlugin.class);
		super.onCreate(savedInstanceState);
		requestPhonePermissions();
		requestOverlayPermissionIfNeeded();
		handleDeepLinkIntent(getIntent());
	}

	@Override
	protected void onNewIntent(Intent intent) {
		super.onNewIntent(intent);
		handleDeepLinkIntent(intent);
	}

	private void requestPhonePermissions() {
		String[] perms = {
			Manifest.permission.READ_PHONE_STATE,
			Manifest.permission.READ_CALL_LOG,
			Manifest.permission.CALL_PHONE
		};

		boolean needed = false;
		for (String p : perms) {
			if (ContextCompat.checkSelfPermission(this, p) != PackageManager.PERMISSION_GRANTED) {
				needed = true;
				break;
			}
		}

		if (needed) {
			Log.d(TAG, "Requesting phone permissions");
			ActivityCompat.requestPermissions(this, perms, PHONE_PERM_CODE);
		} else {
			Log.d(TAG, "Phone permissions already granted");
			startCallDetectorService();
		}
	}

	@Override
	public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
		super.onRequestPermissionsResult(requestCode, permissions, grantResults);
		if (requestCode == PHONE_PERM_CODE) {
			boolean allGranted = true;
			for (int result : grantResults) {
				if (result != PackageManager.PERMISSION_GRANTED) {
					allGranted = false;
					break;
				}
			}
			if (allGranted) {
				Log.d(TAG, "Phone permissions granted - starting service");
				startCallDetectorService();
			}
		}
	}

	private void requestOverlayPermissionIfNeeded() {
		if (!Settings.canDrawOverlays(this)) {
			Log.d(TAG, "Overlay permission not granted - requesting");
			try {
				Intent intent = new Intent(
					Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
					Uri.parse("package:" + getPackageName())
				);
				startActivityForResult(intent, OVERLAY_PERM_CODE);
			} catch (Exception e) {
				Log.w(TAG, "Could not open overlay settings: " + e.getMessage());
			}
		}
	}

	private void startCallDetectorService() {
		try {
			Intent serviceIntent = new Intent(this, CallDetectorService.class);
			if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
				startForegroundService(serviceIntent);
			} else {
				startService(serviceIntent);
			}
			Log.d(TAG, "CallDetectorService started");
		} catch (Exception e) {
			Log.w(TAG, "Failed to start CallDetectorService: " + e.getMessage());
		}
	}

	private void handleDeepLinkIntent(Intent intent) {
		if (intent == null || intent.getData() == null) return;
		Uri uri = intent.getData();
		String scheme = uri.getScheme();
		if (!"rivergreen".equals(scheme)) return;

		String phone = uri.getQueryParameter("phone");
		String callType = uri.getQueryParameter("callType");
		String durationStr = uri.getQueryParameter("duration");

		if (phone == null || phone.isEmpty()) return;

		Log.d(TAG, "handleDeepLinkIntent: phone=" + phone + " callType=" + callType);

		int duration = 0;
		try {
			duration = Integer.parseInt(durationStr);
		} catch (Exception ignored) {}

		final String json = "{\"phoneNumber\":\"" + phone.replace("\"", "\\\"")
			+ "\",\"callType\":\"" + (callType != null ? callType : "UNKNOWN")
			+ "\",\"duration\":" + duration
			+ ",\"timestamp\":" + System.currentTimeMillis()
			+ ",\"fromOverlay\":true}";

		// Persistence: Store in SharedPreferences so getLastCall() can catch it if JS isn't ready
		try {
			getSharedPreferences("rg_call_events", android.content.Context.MODE_PRIVATE)
				.edit()
				.putString("pending_call", json)
				.putLong("pending_ts", System.currentTimeMillis())
				.apply();
			Log.d(TAG, "Deep link stored in SharedPreferences for polling");
		} catch (Exception e) {
			Log.w(TAG, "Failed to store deep link in prefs: " + e.getMessage());
		}

		final String js = "try{window.dispatchEvent(new CustomEvent('callEnded',{detail:"
			+ json + "}))}catch(e){console.error('[RG]',e)}";

		// Increased delay to 3500ms for solid hydration
		new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(() -> {
			try {
				getBridge().getWebView().evaluateJavascript(js, null);
				Log.d(TAG, "Deep link event dispatched to WebView");
			} catch (Exception e) {
				Log.w(TAG, "Failed to dispatch deep link event: " + e.getMessage());
			}
		}, 3500);
	}
}
