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

public class MainActivity extends BridgeActivity {
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
      final int top = Math.round(bars.top / density);
      final int right = Math.round(bars.right / density);
      final int bottom = Math.round(bars.bottom / density);
      final int left = Math.round(bars.left / density);
      final String js =
          "(function(){var s=document.documentElement.style;" +
          "s.setProperty('--android-safe-top','" + top + "px');" +
          "s.setProperty('--android-safe-right','" + right + "px');" +
          "s.setProperty('--android-safe-bottom','" + bottom + "px');" +
          "s.setProperty('--android-safe-left','" + left + "px');" +
          "window.dispatchEvent(new Event('resize'));})();";
      webView.post(() -> webView.evaluateJavascript(js, null));
      return windowInsets;
    });
    ViewCompat.requestApplyInsets(webView);
  }
}
