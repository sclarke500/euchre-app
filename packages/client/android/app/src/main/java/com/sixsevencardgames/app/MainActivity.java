package com.sixsevencardgames.app;

import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;

import androidx.core.view.WindowCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);

    // Draw the WebView edge-to-edge, underneath the system bars. This makes the
    // WebView report non-zero env(safe-area-inset-*) so the web layout's
    // safe-rect logic (same path as iOS) keeps controls clear of the bars.
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
  }
}
