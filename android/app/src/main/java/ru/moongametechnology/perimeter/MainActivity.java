package ru.moongametechnology.perimeter;

import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;
import androidx.activity.ComponentActivity;
import androidx.activity.OnBackPressedCallback;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import org.json.JSONObject;
import java.io.ByteArrayInputStream;
import java.util.Collections;
import ru.rustore.sdk.review.RuStoreReviewManagerFactory;
import ru.rustore.sdk.appupdate.manager.RuStoreAppUpdateManager;
import ru.rustore.sdk.appupdate.manager.factory.RuStoreAppUpdateManagerFactory;
import ru.rustore.sdk.appupdate.model.AppUpdateOptions;
import ru.rustore.sdk.appupdate.model.AppUpdateType;
import ru.rustore.sdk.appupdate.model.InstallStatus;
import ru.rustore.sdk.appupdate.model.UpdateAvailability;
import ru.rustore.sdk.appupdate.listener.InstallStateUpdateListener;

/** Bundled game with a narrow optional multiplayer API. No remote scripts or privileged JS interface. */
public final class MainActivity extends ComponentActivity {
    private static final String ORIGIN = "https://appassets.androidplatform.net";
    private WebView web;
    private SharedPreferences preferences;
    private RuStoreAppUpdateManager updateManager;
    private boolean activeGame, resumed, updateBusy, reviewBusy, installPromptVisible;
    private final InstallStateUpdateListener installListener = state -> runOnUiThread(() -> {
        if (state.getInstallStatus() == InstallStatus.DOWNLOADED && !activeGame && resumed) offerInstall();
    });

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        preferences = getSharedPreferences("perimeter", MODE_PRIVATE);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(13,18,22));
        setContentView(root);
        ViewCompat.setOnApplyWindowInsetsListener(root, (view, windowInsets) -> {
            Insets bars = windowInsets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            Insets keyboard = windowInsets.getInsets(WindowInsetsCompat.Type.ime());
            view.setPadding(bars.left, bars.top, bars.right, Math.max(bars.bottom, keyboard.bottom));
            return windowInsets;
        });
        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(13,18,22));
        root.addView(web, new FrameLayout.LayoutParams(-1, -1));
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setGeolocationEnabled(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);
        settings.setMediaPlaybackRequiresUserGesture(true);
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
        WebViewAssetLoader assets = new WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this)).build();
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                if (isBundled(request.getUrl())) {
                    WebResourceResponse response = assets.shouldInterceptRequest(request.getUrl());
                    return response != null ? response : missing();
                }
                if (NetworkPolicy.allows(BuildConfig.ONLINE_ORIGIN, request.getUrl().toString(), request.getMethod(), request.isForMainFrame())) {
                    return null; // WebView performs normal HTTPS and CORS checks.
                }
                return missing();
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (isBundled(request.getUrl())) return false;
                if (request.isForMainFrame() && request.hasGesture() && "https".equals(request.getUrl().getScheme())) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, request.getUrl())); }
                    catch (ActivityNotFoundException ignored) { toast("Не найден браузер для открытия ссылки."); }
                }
                return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient());
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            WebViewCompat.addWebMessageListener(web, "PerimeterBridge", Collections.singleton(ORIGIN),
                (view, message, sourceOrigin, mainFrame, reply) -> {
                    if (!mainFrame || !ORIGIN.equals(sourceOrigin.toString())) return;
                    String raw = message.getData();
                    if (raw == null || raw.length() > 1024) return;
                    try {
                        JSONObject event = new JSONObject(raw);
                        switch (event.optString("type")) {
                            case "gameState": activeGame = event.optBoolean("active", true); break;
                            case "checkUpdates": if (!activeGame) checkUpdates(); break;
                            case "matchFinished": if (!activeGame) considerReview(); break;
                            default: break;
                        }
                    } catch (Exception ignored) { /* Malformed messages do not affect the game. */ }
                });
        } else {
            toast("Обновите Android System WebView: это нужно для функций RuStore.");
        }
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override public void handleOnBackPressed() {
                web.evaluateJavascript("Boolean(window.PerimeterBack && window.PerimeterBack())", result -> {
                    if (!"true".equals(result) && !isFinishing()) new AlertDialog.Builder(MainActivity.this)
                        .setTitle("Закрыть КОНТУР?")
                        .setMessage("Локальный матч сохранён на устройстве.")
                        .setNegativeButton("Остаться", null)
                        .setPositiveButton("Закрыть", (dialog, which) -> finish()).show();
                });
            }
        });
        web.loadUrl(ORIGIN + "/assets/web/index.html");
    }

    private static boolean isBundled(Uri uri) {
        return "https".equals(uri.getScheme()) && "appassets.androidplatform.net".equals(uri.getHost())
            && uri.getPort() == -1 && uri.getPath() != null && uri.getPath().startsWith("/assets/web/");
    }
    private static WebResourceResponse missing() {
        return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", Collections.emptyMap(), new ByteArrayInputStream(new byte[0]));
    }
    private void toast(String text) { Toast.makeText(this, text, Toast.LENGTH_LONG).show(); }

    private void ensureUpdates() {
        if (updateManager == null) {
            updateManager = RuStoreAppUpdateManagerFactory.INSTANCE.create(this);
            updateManager.registerListener(installListener);
        }
    }

    private void checkUpdates() {
        if (updateBusy || !resumed || activeGame) return;
        updateBusy = true;
        try {
            ensureUpdates();
            updateManager.getAppUpdateInfo().addOnSuccessListener(info -> runOnUiThread(() -> {
                updateBusy = false;
                if (isFinishing() || !resumed || activeGame) return;
                if (info.getInstallStatus() == InstallStatus.DOWNLOADED) { offerInstall(); return; }
                if (info.getUpdateAvailability() != UpdateAvailability.UPDATE_AVAILABLE) { toast("Установлена актуальная версия."); return; }
                if (!info.isUpdateTypeAllowed(AppUpdateType.FLEXIBLE)) { toast("Откройте RuStore, чтобы обновить приложение."); return; }
                updateBusy = true;
                updateManager.startUpdateFlow(info, new AppUpdateOptions.Builder().appUpdateType(AppUpdateType.FLEXIBLE).build())
                    .addOnSuccessListener(result -> runOnUiThread(() -> { updateBusy = false; }))
                    .addOnFailureListener(error -> runOnUiThread(() -> { updateBusy = false; toast("Обновление не началось. Попробуйте позже в RuStore."); }));
            })).addOnFailureListener(error -> runOnUiThread(() -> {
                updateBusy = false;
                if (resumed) toast("Проверка недоступна. Нужны интернет, RuStore и опубликованная версия игры.");
            }));
        } catch (Exception error) {
            updateBusy = false;
            toast("RuStore сейчас недоступен. Локальная игра работает без него.");
        }
    }

    private void offerInstall() {
        if (installPromptVisible || !resumed || activeGame || isFinishing()) return;
        installPromptVisible = true;
        new AlertDialog.Builder(this).setTitle("Обновление готово")
            .setMessage("Установить сейчас? Игра перезапустится, сохранение останется на устройстве.")
            .setNegativeButton("Позже", (d, w) -> installPromptVisible = false)
            .setOnCancelListener(d -> installPromptVisible = false)
            .setPositiveButton("Установить", (d, w) -> {
                installPromptVisible = false;
                updateManager.completeUpdate(new AppUpdateOptions.Builder().appUpdateType(AppUpdateType.FLEXIBLE).build())
                    .addOnFailureListener(error -> runOnUiThread(() -> toast("Установка недоступна. Попробуйте через RuStore.")));
            }).show();
    }

    private void considerReview() {
        int count = preferences.getInt("finishedMatches", 0) + 1;
        preferences.edit().putInt("finishedMatches", count).apply();
        long now = System.currentTimeMillis();
        if (count < 3 || reviewBusy || !resumed || activeGame || now - preferences.getLong("lastReviewAttempt", 0) < 7L*24*60*60*1000) return;
        preferences.edit().putLong("lastReviewAttempt", now).apply();
        reviewBusy = true;
        try {
            var manager = RuStoreReviewManagerFactory.INSTANCE.create(this);
            manager.requestReviewFlow().addOnSuccessListener(info -> runOnUiThread(() -> {
                if (!resumed || activeGame || isFinishing()) { reviewBusy = false; return; }
                manager.launchReviewFlow(info)
                    .addOnSuccessListener(done -> { reviewBusy = false; })
                    .addOnFailureListener(error -> { reviewBusy = false; });
            })).addOnFailureListener(error -> { reviewBusy = false; });
        } catch (Exception ignored) { reviewBusy = false; }
    }

    @Override protected void onResume() {
        super.onResume(); resumed = true;
        if (web != null) { web.onResume(); web.resumeTimers(); }
    }
    @Override protected void onPause() {
        resumed = false;
        if (web != null) { web.onPause(); web.pauseTimers(); }
        super.onPause();
    }
    @Override protected void onDestroy() {
        if (updateManager != null) updateManager.unregisterListener(installListener);
        if (web != null) { web.stopLoading(); web.destroy(); }
        super.onDestroy();
    }
}
