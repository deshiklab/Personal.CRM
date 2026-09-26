package com.bitscol.personalcrm;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;

/**
 * Home-screen shell widget. Counts are written by the WebView via
 * SharedPreferences key "pcrm_widget" (JSON) when the CRM boots / saves.
 * Tapping the widget opens MainActivity.
 */
public class OverdueWidgetProvider extends AppWidgetProvider {

  public static final String PREFS = "pcrm_widget_prefs";
  public static final String KEY_OVERDUE = "overdue";
  public static final String KEY_NEXT = "next";

  @Override
  public void onUpdate(Context context, AppWidgetManager mgr, int[] ids) {
    SharedPreferences sp = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    int overdue = sp.getInt(KEY_OVERDUE, -1);
    String next = sp.getString(KEY_NEXT, "");

    for (int id : ids) {
      RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.overdue_widget);
      if (overdue < 0) {
        views.setTextViewText(R.id.widget_overdue, context.getString(R.string.widget_overdue_placeholder));
        views.setTextViewText(R.id.widget_next, context.getString(R.string.widget_next_placeholder));
      } else if (overdue == 0) {
        views.setTextViewText(R.id.widget_overdue, "All clear");
        views.setTextViewText(R.id.widget_next,
          next == null || next.isEmpty() ? "No follow-ups due" : ("Next: " + next));
      } else {
        views.setTextViewText(R.id.widget_overdue, overdue + " overdue");
        views.setTextViewText(R.id.widget_next,
          next == null || next.isEmpty() ? "" : ("Next: " + next));
      }

      Intent open = new Intent(context, MainActivity.class);
      open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
      PendingIntent pi = PendingIntent.getActivity(
        context, 0, open,
        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
      );
      views.setOnClickPendingIntent(R.id.widget_root, pi);
      mgr.updateAppWidget(id, views);
    }
  }

  /** Called from JS bridge-free path via a tiny Capacitor-free SharedPreferences write helper if needed. */
  public static void publish(Context context, int overdue, String nextName) {
    SharedPreferences.Editor ed = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit();
    ed.putInt(KEY_OVERDUE, overdue);
    ed.putString(KEY_NEXT, nextName != null ? nextName : "");
    ed.apply();
    // Trigger redraw
    Intent intent = new Intent(context, OverdueWidgetProvider.class);
    intent.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
    int[] ids = AppWidgetManager.getInstance(context)
      .getAppWidgetIds(new android.content.ComponentName(context, OverdueWidgetProvider.class));
    intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids);
    context.sendBroadcast(intent);
  }
}
