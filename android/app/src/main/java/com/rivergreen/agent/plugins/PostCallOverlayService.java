package com.rivergreen.agent.plugins;

import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.provider.Settings;
import android.util.Log;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;

/**
 * Shows a Truecaller-style bottom-sheet overlay on top of all apps after a call ends.
 * Uses SYSTEM_ALERT_WINDOW + WindowManager.addView().
 *
 * Features:
 * - Semi-transparent scrim backdrop
 * - White bottom card with phone number, call type, duration
 * - "Add as Lead" / "Dismiss" buttons
 * - Auto-dismiss after 15 seconds with countdown progress bar
 * - Swipe-down gesture to dismiss
 */
public class PostCallOverlayService extends Service {

    private static final String TAG = "RG_PostCallOverlay";
    private static final long AUTO_DISMISS_MS = 15_000;

    private WindowManager windowManager;
    private View overlayView;
    private Handler handler;
    private Runnable autoDismissRunnable;

    private String phoneNumber;
    private String callType;
    private int duration;

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            phoneNumber = intent.getStringExtra("phone_number");
            callType = intent.getStringExtra("call_type");
            duration = intent.getIntExtra("duration", 0);
        }
        if (phoneNumber == null) phoneNumber = "Unknown";
        if (callType == null) callType = "UNKNOWN";

        Log.d(TAG, "onStartCommand: phone=" + phoneNumber + " type=" + callType + " dur=" + duration);

        if (!Settings.canDrawOverlays(this)) {
            Log.w(TAG, "No overlay permission — stopping");
            stopSelf();
            return START_NOT_STICKY;
        }

        // Remove any existing overlay before showing a new one
        removeOverlay();
        showOverlay();

        return START_NOT_STICKY;
    }

    @Override
    public void onDestroy() {
        removeOverlay();
        super.onDestroy();
    }

    // ── Build & show the overlay ─────────────────────────────────────────────

    private void showOverlay() {
        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
        handler = new Handler(Looper.getMainLooper());

        // ── Window params ────────────────────────────────────────────────────
        int layoutType = WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY;

        WindowManager.LayoutParams params = new WindowManager.LayoutParams(
                WindowManager.LayoutParams.MATCH_PARENT,
                WindowManager.LayoutParams.MATCH_PARENT,
                layoutType,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                        | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN
                        | WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED,
                PixelFormat.TRANSLUCENT
        );
        params.gravity = Gravity.BOTTOM;

        // ── Root: full-screen frame with scrim ───────────────────────────────
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.parseColor("#66000000")); // semi-transparent scrim

        // Tap scrim to dismiss
        root.setOnClickListener(v -> dismissOverlay());

        // ── Bottom card ──────────────────────────────────────────────────────
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(dp(20), dp(12), dp(20), dp(24));

        GradientDrawable cardBg = new GradientDrawable();
        cardBg.setColor(Color.WHITE);
        cardBg.setCornerRadii(new float[]{dp(24), dp(24), dp(24), dp(24), 0, 0, 0, 0});
        card.setBackground(cardBg);
        card.setElevation(dp(16));
        card.setClickable(true); // prevent click-through to scrim

        FrameLayout.LayoutParams cardParams = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.WRAP_CONTENT,
                Gravity.BOTTOM
        );
        root.addView(card, cardParams);

        // ── Handle bar ───────────────────────────────────────────────────────
        View handleBar = new View(this);
        GradientDrawable handleBg = new GradientDrawable();
        handleBg.setColor(Color.parseColor("#D1D5DB"));
        handleBg.setCornerRadius(dp(2));
        handleBar.setBackground(handleBg);
        LinearLayout.LayoutParams handleParams = new LinearLayout.LayoutParams(dp(40), dp(4));
        handleParams.gravity = Gravity.CENTER_HORIZONTAL;
        handleParams.topMargin = dp(4);
        handleParams.bottomMargin = dp(16);
        card.addView(handleBar, handleParams);

        // ── Emoji + Title row ────────────────────────────────────────────────
        TextView title = new TextView(this);
        title.setText("📞  Log This Call");
        title.setTextSize(TypedValue.COMPLEX_UNIT_SP, 20);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        title.setTextColor(Color.parseColor("#1E293B"));
        title.setGravity(Gravity.CENTER_HORIZONTAL);
        LinearLayout.LayoutParams titleParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        titleParams.bottomMargin = dp(4);
        card.addView(title, titleParams);

        // ── Subtitle ─────────────────────────────────────────────────────────
        TextView subtitle = new TextView(this);
        subtitle.setText("A call just ended — save this contact as a lead");
        subtitle.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        subtitle.setTextColor(Color.parseColor("#64748B"));
        subtitle.setGravity(Gravity.CENTER_HORIZONTAL);
        LinearLayout.LayoutParams subParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        subParams.bottomMargin = dp(16);
        card.addView(subtitle, subParams);

        // ── Info strip (3 columns) ───────────────────────────────────────────
        LinearLayout infoStrip = new LinearLayout(this);
        infoStrip.setOrientation(LinearLayout.HORIZONTAL);
        infoStrip.setGravity(Gravity.CENTER);
        infoStrip.setWeightSum(3);

        infoStrip.addView(buildInfoCell("📱", "NUMBER", phoneNumber), buildInfoCellParams());
        infoStrip.addView(buildInfoCell("⏱", "DURATION", formatDuration(duration)), buildInfoCellParams());
        infoStrip.addView(buildInfoCell(callTypeEmoji(callType), "TYPE", formatCallType(callType)), buildInfoCellParams());

        LinearLayout.LayoutParams stripParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        stripParams.bottomMargin = dp(20);
        card.addView(infoStrip, stripParams);

        // ── "Add as Lead" button ─────────────────────────────────────────────
        TextView btnAdd = new TextView(this);
        btnAdd.setText("➕  Add as Lead");
        btnAdd.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16);
        btnAdd.setTypeface(Typeface.DEFAULT_BOLD);
        btnAdd.setTextColor(Color.WHITE);
        btnAdd.setGravity(Gravity.CENTER);
        btnAdd.setPadding(dp(16), dp(14), dp(16), dp(14));

        GradientDrawable btnAddBg = new GradientDrawable(
                GradientDrawable.Orientation.LEFT_RIGHT,
                new int[]{Color.parseColor("#4F46E5"), Color.parseColor("#6366F1")}
        );
        btnAddBg.setCornerRadius(dp(14));
        btnAdd.setBackground(btnAddBg);
        btnAdd.setOnClickListener(v -> {
            openLeadForm();
            dismissOverlay();
        });

        LinearLayout.LayoutParams btnAddParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        btnAddParams.bottomMargin = dp(10);
        card.addView(btnAdd, btnAddParams);

        // ── "Dismiss" button ─────────────────────────────────────────────────
        TextView btnDismiss = new TextView(this);
        btnDismiss.setText("Skip");
        btnDismiss.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        btnDismiss.setTypeface(null, Typeface.BOLD);
        btnDismiss.setTextColor(Color.parseColor("#64748B"));
        btnDismiss.setGravity(Gravity.CENTER);
        btnDismiss.setPadding(dp(16), dp(12), dp(16), dp(12));

        GradientDrawable btnDismissBg = new GradientDrawable();
        btnDismissBg.setColor(Color.parseColor("#F1F5F9"));
        btnDismissBg.setCornerRadius(dp(14));
        btnDismiss.setBackground(btnDismissBg);
        btnDismiss.setOnClickListener(v -> dismissOverlay());

        LinearLayout.LayoutParams btnDismissParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        btnDismissParams.bottomMargin = dp(8);
        card.addView(btnDismiss, btnDismissParams);

        // ── Progress bar for auto-dismiss countdown ──────────────────────────
        ProgressBar progressBar = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progressBar.setMax(1000);
        progressBar.setProgress(1000);
        progressBar.setScaleY(0.5f);
        LinearLayout.LayoutParams pbParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, dp(4));
        card.addView(progressBar, pbParams);

        // Animate the progress bar
        final long startTime = System.currentTimeMillis();
        handler.post(new Runnable() {
            @Override
            public void run() {
                if (overlayView == null) return;
                long elapsed = System.currentTimeMillis() - startTime;
                int progress = (int) (1000 * (1.0 - (double) elapsed / AUTO_DISMISS_MS));
                if (progress < 0) progress = 0;
                progressBar.setProgress(progress);
                if (progress > 0) {
                    handler.postDelayed(this, 50);
                }
            }
        });

        // ── Swipe-down to dismiss ────────────────────────────────────────────
        card.setOnTouchListener(new View.OnTouchListener() {
            float startY = 0;
            @Override
            public boolean onTouch(View v, MotionEvent event) {
                switch (event.getAction()) {
                    case MotionEvent.ACTION_DOWN:
                        startY = event.getRawY();
                        return true;
                    case MotionEvent.ACTION_UP:
                        float dy = event.getRawY() - startY;
                        if (dy > dp(80)) {
                            dismissOverlay();
                            return true;
                        }
                        break;
                }
                return false;
            }
        });

        // ── Add to window ────────────────────────────────────────────────────
        overlayView = root;
        try {
            showDebugNotification(this, "Attempting to add overlay to window...");
            windowManager.addView(overlayView, params);
            Log.d(TAG, "showOverlay: overlay added to window");
        } catch (Exception e) {
            showDebugNotification(this, "Overlay FAILED: " + e.getMessage());
            Log.e(TAG, "showOverlay failed: " + e.getMessage());
            overlayView = null;
            stopSelf();
            return;
        }

        // ── Auto-dismiss timer ───────────────────────────────────────────────
        autoDismissRunnable = this::dismissOverlay;
        handler.postDelayed(autoDismissRunnable, AUTO_DISMISS_MS);
    }

    // ── Remove overlay ───────────────────────────────────────────────────────

    private void removeOverlay() {
        if (handler != null && autoDismissRunnable != null) {
            handler.removeCallbacks(autoDismissRunnable);
        }
        if (overlayView != null && windowManager != null) {
            try {
                windowManager.removeView(overlayView);
            } catch (Exception ignored) {}
            overlayView = null;
        }
    }

    private void dismissOverlay() {
        removeOverlay();
        stopSelf();
    }

    // ── Open the app's lead form ─────────────────────────────────────────────

    private void openLeadForm() {
        try {
            // Try to launch the main activity with deep-link data
            Intent intent = getPackageManager().getLaunchIntentForPackage(getPackageName());
            if (intent == null) {
                intent = new Intent(Intent.ACTION_VIEW);
            }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            intent.setData(Uri.parse("rivergreen://leads/add?phone=" + Uri.encode(phoneNumber)
                    + "&callType=" + Uri.encode(callType)
                    + "&duration=" + duration
                    + "&auto=true"));
            startActivity(intent);
            Log.d(TAG, "openLeadForm: launched with deep link");
        } catch (Exception e) {
            Log.e(TAG, "openLeadForm failed: " + e.getMessage());
        }
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private int dp(int dp) {
        return (int) TypedValue.applyDimension(
                TypedValue.COMPLEX_UNIT_DIP, dp,
                getResources().getDisplayMetrics()
        );
    }

    private LinearLayout buildInfoCell(String emoji, String label, String value) {
        LinearLayout cell = new LinearLayout(this);
        cell.setOrientation(LinearLayout.VERTICAL);
        cell.setGravity(Gravity.CENTER);
        cell.setPadding(dp(8), dp(10), dp(8), dp(10));

        GradientDrawable cellBg = new GradientDrawable();
        cellBg.setColor(Color.parseColor("#F8FAFC"));
        cellBg.setCornerRadius(dp(12));
        cell.setBackground(cellBg);

        TextView emojiTv = new TextView(this);
        emojiTv.setText(emoji);
        emojiTv.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16);
        emojiTv.setGravity(Gravity.CENTER);
        cell.addView(emojiTv);

        TextView labelTv = new TextView(this);
        labelTv.setText(label);
        labelTv.setTextSize(TypedValue.COMPLEX_UNIT_SP, 9);
        labelTv.setTextColor(Color.parseColor("#94A3B8"));
        labelTv.setTypeface(Typeface.DEFAULT_BOLD);
        labelTv.setGravity(Gravity.CENTER);
        labelTv.setLetterSpacing(0.1f);
        cell.addView(labelTv);

        TextView valueTv = new TextView(this);
        valueTv.setText(value);
        valueTv.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
        valueTv.setTextColor(Color.parseColor("#1E293B"));
        valueTv.setTypeface(Typeface.DEFAULT_BOLD);
        valueTv.setGravity(Gravity.CENTER);
        valueTv.setMaxLines(1);
        cell.addView(valueTv);

        return cell;
    }

    private LinearLayout.LayoutParams buildInfoCellParams() {
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f);
        p.setMargins(dp(4), 0, dp(4), 0);
        return p;
    }

    private String formatDuration(int secs) {
        if (secs <= 0) return "0:00";
        int m = secs / 60;
        int s = secs % 60;
        return m + ":" + String.format("%02d", s);
    }

    private String formatCallType(String type) {
        if (type == null) return "Unknown";
        switch (type) {
            case "INCOMING": return "Incoming";
            case "OUTGOING": return "Outgoing";
            case "MISSED":   return "Missed";
            default:         return "Unknown";
        }
    }

    private String callTypeEmoji(String type) {
        if (type == null) return "📞";
        switch (type) {
            case "INCOMING": return "📲";
            case "OUTGOING": return "📤";
            case "MISSED":   return "📵";
            default:         return "📞";
        }
    }

    private void showDebugNotification(Context context, String msg) {
        try {
            android.app.NotificationManager nm = (android.app.NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            android.app.NotificationChannel channel = new android.app.NotificationChannel(
                    "debug_channel", "Debug", android.app.NotificationManager.IMPORTANCE_HIGH);
            nm.createNotificationChannel(channel);
            
            android.app.Notification notif = new androidx.core.app.NotificationCompat.Builder(context, "debug_channel")
                    .setContentTitle("Debug Overlay")
                    .setContentText(msg)
                    .setSmallIcon(android.R.drawable.ic_dialog_info)
                    .build();
            nm.notify((int) System.currentTimeMillis(), notif);
        } catch (Exception e) {}
    }
}

