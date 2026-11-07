package com.yousuf.rose

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "AlwaysListen")
class AlwaysListenPlugin : Plugin() {

    @PluginMethod
    fun start(call: PluginCall) {
        val context = context
        val intent = Intent(context, AlwaysListenService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent)
        } else {
            context.startService(intent)
        }
        val ret = JSObject()
        ret.put("started", true)
        call.resolve(ret)
    }

    @PluginMethod
    fun stop(call: PluginCall) {
        val context = context
        val intent = Intent(context, AlwaysListenService::class.java)
        context.stopService(intent)
        val ret = JSObject()
        ret.put("stopped", true)
        call.resolve(ret)
    }

    @PluginMethod
    fun isRunning(call: PluginCall) {
        val ret = JSObject()
        ret.put("running", AlwaysListenService.isRunning)
        call.resolve(ret)
    }

    @PluginMethod
    fun requestBatteryOptimizationExemption(call: PluginCall) {
        val context = context
        val packageName = context.packageName
        val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager

        if (!pm.isIgnoringBatteryOptimizations(packageName)) {
            val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                data = Uri.parse("package:$packageName")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
        }
        val ret = JSObject()
        ret.put("requested", true)
        call.resolve(ret)
    }
}
