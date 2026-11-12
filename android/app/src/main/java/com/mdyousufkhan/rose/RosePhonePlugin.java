package com.mdyousufkhan.rose;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.provider.ContactsContract;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import java.util.HashSet;
import java.util.Set;

@CapacitorPlugin(
    name = "RosePhone",
    permissions = {
        @Permission(strings = { Manifest.permission.CALL_PHONE }, alias = "call"),
        @Permission(strings = { Manifest.permission.READ_CONTACTS }, alias = "contacts")
    }
)
public class RosePhonePlugin extends Plugin {

    @PluginMethod
    public void call(PluginCall call) {
        String number = call.getString("number", "").trim();
        if (number.isEmpty()) {
            call.reject("ফোন নম্বর দেওয়া হয়নি");
            return;
        }

        if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.CALL_PHONE)
                != PackageManager.PERMISSION_GRANTED) {
            call.reject("CALL_PHONE অনুমতি দেওয়া নেই। ফোনের Settings থেকে অনুমতি দিন।");
            return;
        }

        try {
            Intent intent = new Intent(Intent.ACTION_CALL, Uri.parse("tel:" + Uri.encode(number)));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            JSObject ret = new JSObject();
            ret.put("ok", true);
            ret.put("number", number);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject(e.getMessage() != null ? e.getMessage() : "Call failed");
        }
    }

    @PluginMethod
    public void searchContacts(PluginCall call) {
        String query = call.getString("query", "").trim();
        if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.READ_CONTACTS)
                != PackageManager.PERMISSION_GRANTED) {
            call.reject("READ_CONTACTS অনুমতি দেওয়া নেই। ফোনের Settings থেকে Contacts অনুমতি দিন।");
            return;
        }

        JSArray contacts = new JSArray();
        Set<String> seen = new HashSet<>();

        Cursor cursor = null;
        try {
            cursor = getContext().getContentResolver().query(
                ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
                new String[] {
                    ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME,
                    ContactsContract.CommonDataKinds.Phone.NUMBER
                },
                ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME + " LIKE ?",
                new String[] { "%" + query + "%" },
                ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME + " ASC"
            );

            if (cursor != null) {
                int nameIdx = cursor.getColumnIndex(ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME);
                int numIdx = cursor.getColumnIndex(ContactsContract.CommonDataKinds.Phone.NUMBER);
                while (cursor.moveToNext() && contacts.length() < 10) {
                    String name = nameIdx >= 0 ? cursor.getString(nameIdx) : "";
                    String number = numIdx >= 0 ? cursor.getString(numIdx) : "";
                    if (name == null) name = "";
                    if (number == null) number = "";
                    String cleanNum = number.replaceAll("[\\s\\-()]", "");
                    String key = (name.trim().toLowerCase() + "|" + cleanNum);
                    if (!cleanNum.isEmpty() && !seen.contains(key)) {
                        seen.add(key);
                        JSObject item = new JSObject();
                        item.put("name", name.trim());
                        item.put("number", number.trim());
                        contacts.put(item);
                    }
                }
            }

            JSObject ret = new JSObject();
            ret.put("contacts", contacts);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject(e.getMessage() != null ? e.getMessage() : "searchContacts failed");
        } finally {
            if (cursor != null) {
                cursor.close();
            }
        }
    }

    @PluginMethod
    public void openApp(PluginCall call) {
        String pkg = call.getString("package", "").trim();
        if (pkg.isEmpty()) {
            call.reject("Package name is required");
            return;
        }

        try {
            PackageManager pm = getContext().getPackageManager();
            Intent launchIntent = pm.getLaunchIntentForPackage(pkg);
            if (launchIntent == null) {
                call.reject("অ্যাপটি ফোনে ইনস্টল করা নেই (" + pkg + ")");
                return;
            }
            launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(launchIntent);
            JSObject ret = new JSObject();
            ret.put("ok", true);
            ret.put("package", pkg);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject(e.getMessage() != null ? e.getMessage() : "openApp failed");
        }
    }
}
