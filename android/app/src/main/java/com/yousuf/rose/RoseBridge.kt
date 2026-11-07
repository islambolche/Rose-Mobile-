package com.yousuf.rose

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.Settings
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.core.app.NotificationManagerCompat
import org.json.JSONObject

class RoseBridge(private val ctx: Context, private val web: WebView) {

    private fun launch(i: Intent) {
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        ctx.startActivity(i)
    }

    @JavascriptInterface fun isAndroidApp(): Boolean = true

    @JavascriptInterface fun isAccessibilityOn(): Boolean =
        RoseAccessibilityService.instance != null

    @JavascriptInterface fun isNotificationAccessOn(): Boolean =
        NotificationManagerCompat.getEnabledListenerPackages(ctx).contains(ctx.packageName)

    @JavascriptInterface fun openAccessibilitySettings() =
        launch(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))

    @JavascriptInterface fun openNotificationAccessSettings() =
        launch(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))

    @JavascriptInterface fun openAllFilesSettings() =
        launch(Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION,
            Uri.parse("package:${ctx.packageName}")))

    @JavascriptInterface fun openOverlaySettings() =
        launch(Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
            Uri.parse("package:${ctx.packageName}")))

    @JavascriptInterface fun openBatterySettings() =
        launch(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))

    @JavascriptInterface fun openAppSettings() =
        launch(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
            Uri.parse("package:${ctx.packageName}")))

    @JavascriptInterface fun getRecentNotifications(): String =
        RoseNotificationListener.recentJson()

    // ওয়েব অ্যাপ শুধু Approve-হওয়া কাজের জন্য এটা ডাকবে
    @JavascriptInterface fun runAction(id: String, json: String) {
        Thread {
            val svc = RoseAccessibilityService.instance
            val r = if (svc == null) "ERR:Accessibility is off" else svc.execute(JSONObject(json))
            val ok = !r.startsWith("ERR:")
            val msg = JSONObject.quote(r.removePrefix("ERR:"))
            val safeId = JSONObject.quote(id)
            web.post {
                web.evaluateJavascript(
                    "window.onRoseResult && window.onRoseResult($safeId, $ok, $msg)", null)
            }
        }.start()
    }
}
