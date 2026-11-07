package com.yousuf.rose

import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import org.json.JSONArray
import org.json.JSONObject

class RoseNotificationListener : NotificationListenerService() {
    companion object {
        private val items = ArrayList<JSONObject>()
        @Synchronized fun add(o: JSONObject) { items.add(0, o); if (items.size > 50) items.removeAt(50) }
        @Synchronized fun recentJson(): String = JSONArray(items).toString()
    }

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        val e = sbn.notification.extras
        add(JSONObject().apply {
            put("app", sbn.packageName)
            put("title", e.getCharSequence("android.title")?.toString() ?: "")
            put("text", e.getCharSequence("android.text")?.toString() ?: "")
            put("time", sbn.postTime)
        })
    }
}
