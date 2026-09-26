package com.bitscol.personalcrm;

import android.content.Intent;
import android.os.Bundle;
import android.webkit.WebView;
import android.content.SharedPreferences;
import com.getcapacitor.BridgeActivity;

/**
 * Handles Android SEND / SEND_MULTIPLE share-sheet → inject text into the WebView
 * as a pcrm-native-share CustomEvent (see src/lib/shareIntent.js).
 */
public class MainActivity extends BridgeActivity {

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    handleSendIntent(getIntent());
  }

  @Override
  protected void onNewIntent(Intent intent) {
    super.onNewIntent(intent);
    setIntent(intent);
    handleSendIntent(intent);
  }


  @Override
  public void onResume() {
    super.onResume();
    syncWidgetFromPrefs();
  }

  /** Read CRM-written prefs (mirrored from JS as pcrm_widget_prefs) and refresh home widget. */
  private void syncWidgetFromPrefs() {
    try {
      SharedPreferences sp = getSharedPreferences(OverdueWidgetProvider.PREFS, MODE_PRIVATE);
      // Also try Capacitor Preferences store (group often "CapacitorStorage")
      SharedPreferences cap = getSharedPreferences("CapacitorStorage", MODE_PRIVATE);
      String raw = cap.getString("pcrm-widget-stats", null);
      if (raw != null && raw.length() > 1) {
        // Capacitor may wrap JSON strings with extra quotes
        String cleaned = raw;
        if (cleaned.startsWith("\"") && cleaned.endsWith("\"")) {
          cleaned = cleaned.substring(1, cleaned.length() - 1).replace("\\\"", "\"").replace("\\n", "\n");
        }
        int overdue = 0;
        String next = "";
        try {
          // tiny parse: {"overdue":N,"next":"..."}
          int oi = cleaned.indexOf("\"overdue\"");
          if (oi >= 0) {
            int c = cleaned.indexOf(':', oi);
            int e = c + 1;
            while (e < cleaned.length() && (cleaned.charAt(e) == ' ' )) e++;
            int e2 = e;
            while (e2 < cleaned.length() && Character.isDigit(cleaned.charAt(e2))) e2++;
            if (e2 > e) overdue = Integer.parseInt(cleaned.substring(e, e2));
          }
          int ni = cleaned.indexOf("\"next\"");
          if (ni >= 0) {
            int q1 = cleaned.indexOf('"', cleaned.indexOf(':', ni) + 1);
            int q2 = cleaned.indexOf('"', q1 + 1);
            if (q1 >= 0 && q2 > q1) next = cleaned.substring(q1 + 1, q2);
          }
        } catch (Exception ignore) {}
        OverdueWidgetProvider.publish(this, overdue, next);
      } else if (sp.contains(OverdueWidgetProvider.KEY_OVERDUE)) {
        OverdueWidgetProvider.publish(this,
          sp.getInt(OverdueWidgetProvider.KEY_OVERDUE, 0),
          sp.getString(OverdueWidgetProvider.KEY_NEXT, ""));
      }
    } catch (Exception ignore) {}
  }

  private void handleSendIntent(Intent intent) {
    if (intent == null) return;
    String action = intent.getAction();
    if (action == null) return;
    if (!Intent.ACTION_SEND.equals(action) && !Intent.ACTION_SEND_MULTIPLE.equals(action)) return;

    final String type = intent.getType() != null ? intent.getType() : "";
    String sharedText = null;
    String sharedTitle = intent.getStringExtra(Intent.EXTRA_SUBJECT);
    if (sharedTitle == null) sharedTitle = intent.getStringExtra(Intent.EXTRA_TITLE);

    if (type.startsWith("text/") || type.isEmpty() || "*/*".equals(type)) {
      CharSequence t = intent.getCharSequenceExtra(Intent.EXTRA_TEXT);
      if (t != null) sharedText = t.toString();
    }
    if (sharedText == null && sharedTitle == null) return;

    final String text = sharedText != null ? sharedText : "";
    final String title = sharedTitle != null ? sharedTitle : "";
    // Bridge may not be ready yet on cold start — retry a few times.
    deliverShare(title, text, 0);
  }

  private void deliverShare(final String title, final String text, final int attempt) {
    if (attempt > 20) return;
    try {
      if (getBridge() == null || getBridge().getWebView() == null) {
        getWindow().getDecorView().postDelayed(() -> deliverShare(title, text, attempt + 1), 250);
        return;
      }
      final WebView wv = getBridge().getWebView();
      final String jsTitle = jsonEscape(title);
      final String jsText = jsonEscape(text);
      final String js =
        "(function(){try{"
        + "var d={title:" + jsTitle + ",text:" + jsText + ",url:''};"
        + "window.dispatchEvent(new CustomEvent('pcrm-native-share',{detail:d}));"
        + "if(window.sessionStorage){sessionStorage.setItem('pcrm-pending-share',JSON.stringify(d));}"
        + "if(window.localStorage){localStorage.setItem('pcrm-pending-share',JSON.stringify(d));}"
        + "}catch(e){}})();";
      wv.post(() -> wv.evaluateJavascript(js, null));
    } catch (Exception e) {
      getWindow().getDecorView().postDelayed(() -> deliverShare(title, text, attempt + 1), 250);
    }
  }

  private static String jsonEscape(String s) {
    if (s == null) return "\"\"";
    StringBuilder sb = new StringBuilder("\"");
    for (int i = 0; i < s.length(); i++) {
      char c = s.charAt(i);
      switch (c) {
        case '\\': sb.append("\\\\"); break;
        case '"': sb.append("\\\""); break;
        case '\n': sb.append("\\n"); break;
        case '\r': sb.append("\\r"); break;
        case '\t': sb.append("\\t"); break;
        default:
          if (c < 0x20) sb.append(String.format("\\u%04x", (int) c));
          else sb.append(c);
      }
    }
    sb.append('"');
    return sb.toString();
  }
}
