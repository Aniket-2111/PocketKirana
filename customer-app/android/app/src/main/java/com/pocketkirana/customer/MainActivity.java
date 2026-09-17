package com.pocketkirana.customer;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.Toast;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

public class MainActivity extends BridgeActivity {
    private long lastBackPressTime = 0;
    private Toast exitToast;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Configure WebView settings & UPI scheme interceptor
        configureWebViewForPayments();

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                handleBackPressAction();
            }
        });
    }

    @Override
    public void onResume() {
        super.onResume();
        configureWebViewForPayments();
    }

    private void configureWebViewForPayments() {
        if (getBridge() == null || getBridge().getWebView() == null) {
            return;
        }

        WebView webView = getBridge().getWebView();
        WebSettings settings = webView.getSettings();

        // 1. Clean User-Agent so PhonePe renders full payment options (UPI Intent, Collect, Apps, Card, Net Banking)
        String userAgent = settings.getUserAgentString();
        if (userAgent != null && (userAgent.contains("; wv") || userAgent.contains("Version/"))) {
            String cleanedUserAgent = userAgent.replace("; wv", "").replaceAll("Version/[0-9.]+\\s*", "");
            settings.setUserAgentString(cleanedUserAgent);
        }

        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);

        // 2. Set Custom WebView Client to intercept external UPI payment intents
        final Bridge bridge = getBridge();
        bridge.setWebViewClient(new BridgeWebViewClient(bridge) {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (request != null && request.getUrl() != null) {
                    String url = request.getUrl().toString();
                    if (handleExternalPaymentSchemes(url)) {
                        return true;
                    }
                }
                return super.shouldOverrideUrlLoading(view, request);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                if (url != null && handleExternalPaymentSchemes(url)) {
                    return true;
                }
                return super.shouldOverrideUrlLoading(view, url);
            }
        });
    }

    private boolean handleExternalPaymentSchemes(String url) {
        if (url == null) return false;

        // Native Android Location Settings & App Settings Intent Triggers
        if (url.startsWith("pocketkirana://location-settings") || url.contains("android.settings.LOCATION_SOURCE_SETTINGS")) {
            try {
                Intent intent = new Intent(android.provider.Settings.ACTION_LOCATION_SOURCE_SETTINGS);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(intent);
                return true;
            } catch (Exception e) {
                try {
                    Intent appSettings = new Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                    appSettings.setData(Uri.parse("package:" + getPackageName()));
                    appSettings.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    startActivity(appSettings);
                    return true;
                } catch (Exception ignored) {}
            }
            return true;
        }

        if (url.startsWith("pocketkirana://app-settings") || url.contains("application_details")) {
            try {
                Intent intent = new Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                intent.setData(Uri.parse("package:" + getPackageName()));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(intent);
                return true;
            } catch (Exception ignored) {}
            return true;
        }

        // Check for standard UPI and third-party payment intent schemes
        if (url.startsWith("upi://") ||
            url.startsWith("phonepe://") ||
            url.startsWith("paytmmp://") ||
            url.startsWith("tez://") ||
            url.startsWith("gpay://") ||
            url.startsWith("bhim://") ||
            url.startsWith("cred://") ||
            url.startsWith("whatsapp://") ||
            url.startsWith("market://")) {
            try {
                Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(intent);
                return true;
            } catch (Exception e) {
                // If specific app is not installed, notify user gently
                Toast.makeText(MainActivity.this, "UPI app not found or could not be opened.", Toast.LENGTH_SHORT).show();
                return true;
            }
        }

        // Handle intent:// schemes from payment gateways
        if (url.startsWith("intent://")) {
            try {
                Intent intent = Intent.parseUri(url, Intent.URI_INTENT_SCHEME);
                if (intent != null) {
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    startActivity(intent);
                    return true;
                }
            } catch (Exception e) {
                try {
                    Intent fallbackIntent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                    fallbackIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    startActivity(fallbackIntent);
                    return true;
                } catch (Exception ignored) {}
            }
            return true;
        }

        return false;
    }

    @Override
    public void onBackPressed() {
        handleBackPressAction();
    }

    private void handleBackPressAction() {
        boolean canGoBack = getBridge() != null && getBridge().getWebView() != null && getBridge().getWebView().canGoBack();
        String currentUrl = (getBridge() != null && getBridge().getWebView() != null && getBridge().getWebView().getUrl() != null)
                ? getBridge().getWebView().getUrl()
                : "";

        boolean isAtHomePage = currentUrl.endsWith("/home") || currentUrl.endsWith("/home/") || currentUrl.endsWith(":3000/") || currentUrl.endsWith("/#") || !canGoBack;

        if (isAtHomePage || !canGoBack) {
            if (System.currentTimeMillis() - lastBackPressTime < 2000) {
                if (exitToast != null) {
                    exitToast.cancel();
                }
                finishAffinity();
            } else {
                lastBackPressTime = System.currentTimeMillis();
                exitToast = Toast.makeText(MainActivity.this, "Press back again to exit", Toast.LENGTH_SHORT);
                exitToast.show();
            }
        } else {
            getBridge().getWebView().goBack();
        }
    }
}
