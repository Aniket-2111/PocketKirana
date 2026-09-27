package com.pocketkirana.customer.plugins;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.util.Log;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * PocketKirana — PhonePe Payment Gateway Native Android Capacitor Plugin
 * 
 * Provides native bridge communication between Next.js React frontend and
 * Android PhonePe Business Payment Gateway flow.
 * 
 * SECURITY RULES:
 *  1. Zero credentials in client: No salt keys, merchant secrets, or auth tokens are stored in the APK.
 *  2. Server is authoritative: The SDK callback returns transaction references to the frontend,
 *     which MUST verify status via server-to-server checksummed status API before confirming the order.
 */
@CapacitorPlugin(name = "PhonePePaymentPlugin")
public class PhonePePaymentPlugin extends Plugin {
    private static final String TAG = "PhonePePaymentPlugin";
    private static final String PHONEPE_PACKAGE = "com.phonepe.app";

    private String environment = "SANDBOX";
    private String merchantId = "";
    private boolean enableLogging = false;

    /**
     * Initialize PhonePe environment settings
     */
    @PluginMethod
    public void initPhonePe(PluginCall call) {
        try {
            String env = call.getString("environment", "SANDBOX");
            String mId = call.getString("merchantId", "");
            boolean logging = Boolean.TRUE.equals(call.getBoolean("enableLogging", false));

            this.environment = env != null ? env.toUpperCase() : "SANDBOX";
            this.merchantId = mId != null ? mId : "";
            this.enableLogging = logging;

            if (enableLogging) {
                Log.d(TAG, "PhonePe initialized with env: " + this.environment);
            }

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("environment", this.environment);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Error initializing PhonePe", e);
            call.reject("Failed to initialize PhonePe: " + e.getMessage());
        }
    }

    /**
     * Check if PhonePe application is installed on device
     */
    @PluginMethod
    public void isPhonePeAppInstalled(PluginCall call) {
        try {
            Context context = getContext();
            PackageManager pm = context.getPackageManager();
            boolean isInstalled = false;
            try {
                pm.getPackageInfo(PHONEPE_PACKAGE, PackageManager.GET_ACTIVITIES);
                isInstalled = true;
            } catch (PackageManager.NameNotFoundException e) {
                isInstalled = false;
            }

            JSObject ret = new JSObject();
            ret.put("isInstalled", isInstalled);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Error checking PhonePe app installation", e);
            call.reject("Error checking PhonePe app: " + e.getMessage());
        }
    }

    /**
     * Start PhonePe Native / Intent / Web Checkout
     */
    @PluginMethod
    public void startPayment(PluginCall call) {
        String orderId = call.getString("orderId", "");
        String merchantTransactionId = call.getString("merchantTransactionId", "");
        String redirectUrl = call.getString("redirectUrl", "");
        String token = call.getString("token", "");

        if (merchantTransactionId == null || merchantTransactionId.isEmpty()) {
            call.reject("Missing merchantTransactionId parameter");
            return;
        }

        if (enableLogging) {
            Log.d(TAG, "Starting PhonePe payment for txn: " + merchantTransactionId + ", orderId: " + orderId);
        }

        try {
            Intent paymentIntent = null;

            // 1. If explicit redirectUrl or intent URL provided, open payment intent
            if (redirectUrl != null && !redirectUrl.isEmpty()) {
                if (redirectUrl.startsWith("intent://")) {
                    try {
                        paymentIntent = Intent.parseUri(redirectUrl, Intent.URI_INTENT_SCHEME);
                    } catch (Exception ignored) {}
                } else if (redirectUrl.startsWith("upi://") || redirectUrl.startsWith("phonepe://")) {
                    paymentIntent = new Intent(Intent.ACTION_VIEW, Uri.parse(redirectUrl));
                } else if (redirectUrl.startsWith("http://") || redirectUrl.startsWith("https://")) {
                    paymentIntent = new Intent(Intent.ACTION_VIEW, Uri.parse(redirectUrl));
                }
            }

            // Fallback intent if no specific URL parsed
            if (paymentIntent == null) {
                paymentIntent = new Intent(Intent.ACTION_VIEW);
                if (redirectUrl != null && !redirectUrl.isEmpty()) {
                    paymentIntent.setData(Uri.parse(redirectUrl));
                }
            }

            paymentIntent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);

            startActivityForResult(call, paymentIntent, "phonePeActivityResult");
        } catch (Exception e) {
            Log.e(TAG, "Exception starting PhonePe checkout", e);
            JSObject ret = new JSObject();
            ret.put("status", "ERROR");
            ret.put("merchantTransactionId", merchantTransactionId);
            ret.put("orderId", orderId);
            ret.put("error", e.getMessage());
            call.resolve(ret);
        }
    }

    /**
     * Handle return from PhonePe checkout activity
     */
    @ActivityCallback
    private void phonePeActivityResult(PluginCall call, ActivityResult result) {
        if (call == null) return;

        String orderId = call.getString("orderId", "");
        String merchantTransactionId = call.getString("merchantTransactionId", "");

        int resultCode = result.getResultCode();
        Intent data = result.getData();

        if (enableLogging) {
            Log.d(TAG, "PhonePe activity returned with resultCode: " + resultCode);
        }

        JSObject ret = new JSObject();
        ret.put("orderId", orderId);
        ret.put("merchantTransactionId", merchantTransactionId);

        if (resultCode == Activity.RESULT_OK) {
            // Note: Returning SUCCESS to JS means native activity completed;
            // Frontend MUST call /api/payments/phonepe/verify for authoritative validation!
            ret.put("status", "SUCCESS");
            if (data != null && data.getExtras() != null) {
                ret.put("responseCode", data.getStringExtra("responseCode"));
            }
        } else if (resultCode == Activity.RESULT_CANCELED) {
            ret.put("status", "CANCELLED");
            ret.put("error", "Payment cancelled by user");
        } else {
            ret.put("status", "PENDING");
            ret.put("error", "Payment activity finished with status code: " + resultCode);
        }

        call.resolve(ret);
    }
}
