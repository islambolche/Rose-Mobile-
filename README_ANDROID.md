# IYABD Android Integration Guide
**Owner: MD YOUSUF KHAN**

IYABD is designed to bridge the gap between a web companion and a native Android assistant. For full system-level control, a native Android implementation using Kotlin is required.

## 1. Required Android Permissions
To function as a personal assistant, the following permissions must be requested in the Android Manifest:

<!-- Basic (runtime) -->
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.BLUETOOTH" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.CALL_PHONE" />
<uses-permission android:name="android.permission.READ_PHONE_STATE" />
<uses-permission android:name="android.permission.ANSWER_PHONE_CALLS" />
<uses-permission android:name="android.permission.READ_CONTACTS" />
<uses-permission android:name="android.permission.SEND_SMS" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />

<!-- Advanced (special-access) -->
<uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW" />
<uses-permission android:name="android.permission.BIND_NOTIFICATION_LISTENER_SERVICE" />
<uses-permission android:name="android.permission.ACCESS_NOTIFICATION_POLICY" />
<uses-permission android:name="android.permission.WRITE_SETTINGS" />
<uses-permission android:name="android.permission.BIND_ACCESSIBILITY_SERVICE" />
<uses-permission android:name="android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS" />
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.QUERY_ALL_PACKAGES" />

## 2. Intent-Based App Control (Kotlin Example)
To open other apps like WhatsApp or YouTube from IYABD, use explicit Intents:

```kotlin
fun openAppWithAction(appId: String, payload: String) {
    when (appId) {
        "whatsapp" -> {
            val intent = Intent(Intent.ACTION_VIEW)
            intent.data = Uri.parse("https://wa.me/?text=$payload")
            startActivity(intent)
        }
        "youtube" -> {
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse("vnd.youtube:results?search_query=$payload"))
            startActivity(intent)
        }
    }
}
```

## 3. Web-to-Native Bridge
The web interface (built with React) can communicate with your native Android container using a `WebView` and a `JavascriptInterface`:

```kotlin
class IYABDBridge(private val context: Context) {
    @JavascriptInterface
    fun performAction(app: String, action: String, data: String) {
        // Handle native logic here
    }
}

// In your Activity:
webView.addJavascriptInterface(IYABDBridge(this), "AndroidIYABD")
```

## 4. Accessibility Service (Advanced)
For deep phone automation (tapping buttons, scrolling), IYABD would require an `AccessibilityService`. Note that this requires explicit user activation in Android System Settings and is subject to Google Play's strict safety policies.

## 5. Security & Consent
- **Sensitive Actions**: Banking or system-destructive commands must always prompt for biometric or PIN confirmation.
- **Data Privacy**: All voice data processed through Gemini remains personal to MD YOUSUF KHAN.
