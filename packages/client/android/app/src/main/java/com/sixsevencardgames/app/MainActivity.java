package com.sixsevencardgames.app;

import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;
import android.webkit.WebView;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;

public class MainActivity extends BridgeActivity {
  // Latest OS insets (CSS px), kept so we can re-inject after page navigations.
  private int safeTop = 0;
  private int safeRight = 0;
  private int safeBottom = 0;
  private int safeLeft = 0;

  private void injectSafeAreaVars() {
    final WebView webView = getBridge().getWebView();
    if (webView == null) return;
    final String js =
        "(function(){var s=document.documentElement.style;" +
        "s.setProperty('--android-safe-top','" + safeTop + "px');" +
        "s.setProperty('--android-safe-right','" + safeRight + "px');" +
        "s.setProperty('--android-safe-bottom','" + safeBottom + "px');" +
        "s.setProperty('--android-safe-left','" + safeLeft + "px');" +
        "window.dispatchEvent(new Event('resize'));})();";
    webView.post(() -> webView.evaluateJavascript(js, null));
  }

  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);

    // Draw the WebView edge-to-edge, underneath the system bars. This makes the
    // felt bleed to every edge; controls are kept clear via the safe-area insets
    // injected below (the web layout reads them as --android-safe-*).
    WindowCompat.setDecorFitsSystemWindows(getWindow(), false);

    // Let content render into the display cutout (the landscape camera notch),
    // not just the rectangular safe area. SHORT_EDGES covers the left/right
    // cutout in landscape; API 30+ can use ALWAYS for every edge.
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      getWindow().getAttributes().layoutInDisplayCutoutMode =
          WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS;
    } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      getWindow().getAttributes().layoutInDisplayCutoutMode =
          WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
    }

    // Transparent bars so the felt shows through wherever the bars overlay.
    getWindow().setStatusBarColor(Color.TRANSPARENT);
    getWindow().setNavigationBarColor(Color.TRANSPARENT);

    // Android WebView's CSS env(safe-area-inset-*) only reflects the display
    // cutout, NOT the status/navigation bars. So we read the REAL combined insets
    // (system bars + cutout) and inject them as CSS variables the web layout uses
    // to keep the scoreboard/buttons/hand clear of the bars. Re-fires on rotation.
    final WebView webView = getBridge().getWebView();
    final float density = getResources().getDisplayMetrics().density;

    ViewCompat.setOnApplyWindowInsetsListener(webView, (v, windowInsets) -> {
      Insets bars = windowInsets.getInsets(
          WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
      safeTop = Math.round(bars.top / density);
      safeRight = Math.round(bars.right / density);
      safeBottom = Math.round(bars.bottom / density);
      safeLeft = Math.round(bars.left / density);
      injectSafeAreaVars();
      return windowInsets;
    });

    // The insets listener typically fires BEFORE the page finishes loading, and
    // a navigation replaces documentElement — wiping the injected vars. Without
    // this, the vars only reappear on the next inset change (i.e. a rotation).
    // Re-inject after every page load: the initial load AND Capgo OTA bundle
    // swaps, which reload the WebView.
    getBridge().addWebViewListener(new WebViewListener() {
      @Override
      public void onPageLoaded(WebView view) {
        injectSafeAreaVars();
      }
    });

    ViewCompat.requestApplyInsets(webView);
  }
}
