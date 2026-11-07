package com.yousuf.rose

import android.accessibilityservice.AccessibilityService
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import org.json.JSONObject

class RoseAccessibilityService : AccessibilityService() {

    companion object { @Volatile var instance: RoseAccessibilityService? = null }

    override fun onServiceConnected() { instance = this }
    override fun onUnbind(intent: Intent?): Boolean { instance = null; return super.onUnbind(intent) }
    override fun onAccessibilityEvent(e: AccessibilityEvent?) {}
    override fun onInterrupt() {}

    fun execute(a: JSONObject): String {
        return try {
            when (a.getString("action")) {
                "open_app" -> {
                    val pkg = a.getString("package")
                    val i = packageManager.getLaunchIntentForPackage(pkg)
                        ?: return "ERR:App not installed: $pkg"
                    i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    startActivity(i); "Opened $pkg"
                }
                "open_url" -> {
                    val i = Intent(Intent.ACTION_VIEW, Uri.parse(a.getString("url")))
                    i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    startActivity(i); "Opened link"
                }
                "click_text" -> {
                    val t = a.getString("text")
                    val node = rootInActiveWindow?.findAccessibilityNodeInfosByText(t)?.firstOrNull()
                        ?: return "ERR:Not found on screen: $t"
                    val target = clickableParent(node) ?: return "ERR:Not clickable: $t"
                    target.performAction(AccessibilityNodeInfo.ACTION_CLICK); "Clicked $t"
                }
                "type_text" -> {
                    val node = rootInActiveWindow?.findFocus(AccessibilityNodeInfo.FOCUS_INPUT)
                        ?: return "ERR:No text box is focused"
                    val b = Bundle()
                    b.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE,
                        a.getString("text"))
                    node.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, b); "Typed text"
                }
                "scroll_down" -> {
                    val n = findScrollable(rootInActiveWindow) ?: return "ERR:Nothing to scroll"
                    n.performAction(AccessibilityNodeInfo.ACTION_SCROLL_FORWARD); "Scrolled down"
                }
                "scroll_up" -> {
                    val n = findScrollable(rootInActiveWindow) ?: return "ERR:Nothing to scroll"
                    n.performAction(AccessibilityNodeInfo.ACTION_SCROLL_BACKWARD); "Scrolled up"
                }
                "back" -> { performGlobalAction(GLOBAL_ACTION_BACK); "Back" }
                "home" -> { performGlobalAction(GLOBAL_ACTION_HOME); "Home" }
                "read_screen" -> {
                    val sb = StringBuilder()
                    collectText(rootInActiveWindow, sb)
                    sb.toString().take(3000).ifEmpty { "(empty screen)" }
                }
                else -> "ERR:Unknown action"
            }
        } catch (e: Exception) { "ERR:${e.message}" }
    }

    private fun clickableParent(n: AccessibilityNodeInfo?): AccessibilityNodeInfo? {
        var c = n
        while (c != null && !c.isClickable) c = c.parent
        return c
    }

    private fun findScrollable(n: AccessibilityNodeInfo?): AccessibilityNodeInfo? {
        if (n == null) return null
        if (n.isScrollable) return n
        for (i in 0 until n.childCount) findScrollable(n.getChild(i))?.let { return it }
        return null
    }

    private fun collectText(n: AccessibilityNodeInfo?, sb: StringBuilder) {
        if (n == null) return
        n.text?.let { sb.append(it).append('\n') }
        n.contentDescription?.let { sb.append(it).append('\n') }
        for (i in 0 until n.childCount) collectText(n.getChild(i), sb)
    }
}
