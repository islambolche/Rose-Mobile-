package com.yousuf.rose

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.provider.ContactsContract
import androidx.core.content.ContextCompat
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import java.net.URLEncoder

@CapacitorPlugin(
    name = "PhoneControl",
    permissions = [
        Permission(strings = [Manifest.permission.READ_CONTACTS], alias = "contacts"),
        Permission(strings = [Manifest.permission.CALL_PHONE], alias = "phone")
    ]
)
class PhoneControlPlugin : Plugin() {

    @PluginMethod
    fun openApp(call: PluginCall) {
        val name = call.getString("name")?.trim()
        if (name.isNullOrEmpty()) {
            val ret = JSObject()
            ret.put("opened", false)
            ret.put("reason", "App name is required")
            call.resolve(ret)
            return
        }

        val context = context
        val pm = context.packageManager
        val intent = Intent(Intent.ACTION_MAIN, null).apply {
            addCategory(Intent.CATEGORY_LAUNCHER)
        }
        val apps = pm.queryIntentActivities(intent, 0)

        val targetName = name.lowercase()

        val aliases = mapOf(
            "youtube" to listOf("youtube", "ইউটিউব"),
            "whatsapp" to listOf("whatsapp", "হোয়াটসঅ্যাপ", "ওয়াটসঅ্যাপ"),
            "facebook" to listOf("facebook", "ফেসবুক", "fb"),
            "messenger" to listOf("messenger", "মেসেঞ্জার"),
            "camera" to listOf("camera", "ক্যামেরা"),
            "settings" to listOf("settings", "সেটিংস", "setting"),
            "chrome" to listOf("chrome", "ক্রোম", "browser"),
            "gallery" to listOf("gallery", "গ্যালারি", "photos", "ছবি")
        )

        var matchedPackage: String? = null
        var matchedLabel: String? = null

        for (app in apps) {
            val label = app.loadLabel(pm).toString()
            val lowerLabel = label.lowercase()
            val packageName = app.activityInfo.packageName.lowercase()

            if (lowerLabel.contains(targetName) || packageName.contains(targetName)) {
                matchedPackage = app.activityInfo.packageName
                matchedLabel = label
                break
            }

            for ((key, aliasList) in aliases) {
                if (aliasList.any { targetName.contains(it) || it.contains(targetName) }) {
                    if (lowerLabel.contains(key) || packageName.contains(key)) {
                        matchedPackage = app.activityInfo.packageName
                        matchedLabel = label
                        break
                    }
                }
            }
            if (matchedPackage != null) break
        }

        if (matchedPackage != null) {
            val launchIntent = pm.getLaunchIntentForPackage(matchedPackage)
            if (launchIntent != null) {
                launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                context.startActivity(launchIntent)
                val ret = JSObject()
                ret.put("opened", true)
                ret.put("app", matchedLabel ?: name)
                call.resolve(ret)
                return
            }
        }

        val ret = JSObject()
        ret.put("opened", false)
        ret.put("reason", "App '$name' not found on device")
        call.resolve(ret)
    }

    @PluginMethod
    fun findContact(call: PluginCall) {
        val name = call.getString("name")?.trim() ?: ""
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.READ_CONTACTS) != PackageManager.PERMISSION_GRANTED) {
            val ret = JSObject()
            ret.put("error", "permission_needed")
            ret.put("permission", Manifest.permission.READ_CONTACTS)
            call.resolve(ret)
            return
        }

        val matches = JSArray()
        val resolver = context.contentResolver
        val cursor = resolver.query(
            ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
            arrayOf(
                ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME,
                ContactsContract.CommonDataKinds.Phone.NUMBER
            ),
            "${ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME} LIKE ?",
            arrayOf("%$name%"),
            "${ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME} ASC"
        )

        val foundNumbers = mutableSetOf<String>()
        cursor?.use { c ->
            val nameIdx = c.getColumnIndex(ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME)
            val numIdx = c.getColumnIndex(ContactsContract.CommonDataKinds.Phone.NUMBER)
            var count = 0
            while (c.moveToNext() && count < 5) {
                val cName = if (nameIdx != -1) c.getString(nameIdx) else ""
                val cNum = if (numIdx != -1) c.getString(numIdx) else ""
                val cleanNum = cNum.replace("\\s+".toRegex(), "")
                if (cleanNum.isNotEmpty() && !foundNumbers.contains(cleanNum)) {
                    foundNumbers.add(cleanNum)
                    val item = JSObject()
                    item.put("name", cName)
                    item.put("number", cNum)
                    matches.put(item)
                    count++
                }
            }
        }

        val ret = JSObject()
        ret.put("contacts", matches)
        call.resolve(ret)
    }

    @PluginMethod
    fun callNumber(call: PluginCall) {
        val number = call.getString("number")?.trim()
        if (number.isNullOrEmpty()) {
            call.reject("Phone number is required")
            return
        }

        if (ContextCompat.checkSelfPermission(context, Manifest.permission.CALL_PHONE) != PackageManager.PERMISSION_GRANTED) {
            val ret = JSObject()
            ret.put("error", "permission_needed")
            ret.put("permission", Manifest.permission.CALL_PHONE)
            call.resolve(ret)
            return
        }

        val intent = Intent(Intent.ACTION_CALL, Uri.parse("tel:$number")).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)

        val ret = JSObject()
        ret.put("started", true)
        call.resolve(ret)
    }

    @PluginMethod
    fun openWhatsAppChat(call: PluginCall) {
        val rawNum = call.getString("number")?.trim() ?: ""
        val text = call.getString("text")?.trim() ?: ""

        val cleanNumber = rawNum.replace("[^0-9+]".toRegex(), "")
        val encodedText = URLEncoder.encode(text, "UTF-8")
        val url = "https://wa.me/$cleanNumber?text=$encodedText"

        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        try {
            context.startActivity(intent)
            val ret = JSObject()
            ret.put("opened", true)
            call.resolve(ret)
        } catch (e: Exception) {
            val ret = JSObject()
            ret.put("opened", false)
            ret.put("reason", e.message)
            call.resolve(ret)
        }
    }

    @PluginMethod
    fun composeSms(call: PluginCall) {
        val number = call.getString("number")?.trim() ?: ""
        val text = call.getString("text")?.trim() ?: ""

        val intent = Intent(Intent.ACTION_SENDTO, Uri.parse("sms:$number")).apply {
            putExtra("sms_body", text)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        try {
            context.startActivity(intent)
            val ret = JSObject()
            ret.put("opened", true)
            call.resolve(ret)
        } catch (e: Exception) {
            val ret = JSObject()
            ret.put("opened", false)
            ret.put("reason", e.message)
            call.resolve(ret)
        }
    }

    @PluginMethod
    fun openUrl(call: PluginCall) {
        var url = call.getString("url")?.trim() ?: ""
        if (!url.startsWith("http://") && !url.startsWith("https://")) {
            url = "https://$url"
        }

        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        try {
            context.startActivity(intent)
            val ret = JSObject()
            ret.put("opened", true)
            call.resolve(ret)
        } catch (e: Exception) {
            val ret = JSObject()
            ret.put("opened", false)
            ret.put("reason", e.message)
            call.resolve(ret)
        }
    }
}
