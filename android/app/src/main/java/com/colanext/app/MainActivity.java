package com.colanext.app;

import android.annotation.SuppressLint;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.ProgressBar;
import android.widget.Toast;

import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import android.widget.EditText;
import android.widget.LinearLayout;

public class MainActivity extends AppCompatActivity {

    private WebView webView;
    private ProgressBar progressBar;
    private static final String DEFAULT_URL = "https://cola-next-system-production-1641.up.railway.app/user";
    private String serverUrl;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        if (controller != null) {
            controller.hide(WindowInsetsCompat.Type.systemBars());
            controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        }

        progressBar = findViewById(R.id.progressBar);
        webView = findViewById(R.id.webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setAllowFileAccess(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);

        webView.setWebViewClient(new WebViewClient());
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                if (newProgress < 100) {
                    progressBar.setVisibility(View.VISIBLE);
                    progressBar.setProgress(newProgress);
                } else {
                    progressBar.setVisibility(View.GONE);
                }
            }
        });

        SharedPreferences prefs = getSharedPreferences("colanext", MODE_PRIVATE);
        serverUrl = prefs.getString("server_url", DEFAULT_URL);
        webView.loadUrl(serverUrl);

        webView.setOnLongClickListener(v -> {
            showUrlDialog();
            return true;
        });
        webView.setLongClickable(true);
    }

    private void showUrlDialog() {
        EditText input = new EditText(this);
        input.setText(serverUrl);
        input.setHint("Server URL (e.g. http://192.168.1.100:3001/user)");
        LinearLayout container = new LinearLayout(this);
        container.setPadding(50, 20, 50, 0);
        container.addView(input);

        new AlertDialog.Builder(this)
            .setTitle("Change Server URL")
            .setView(container)
            .setPositiveButton("Save", (d, w) -> {
                String url = input.getText().toString().trim();
                if (!url.isEmpty()) {
                    serverUrl = url;
                    getSharedPreferences("colanext", MODE_PRIVATE).edit().putString("server_url", url).apply();
                    webView.loadUrl(url);
                    Toast.makeText(this, "URL updated!", Toast.LENGTH_SHORT).show();
                }
            })
            .setNegativeButton("Cancel", null)
            .show();
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.destroy();
        }
        super.onDestroy();
    }
}
