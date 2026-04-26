package com.dessertscraper.app

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.webkit.GeolocationPermissions
import android.webkit.JavascriptInterface
import android.webkit.PermissionRequest
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.core.content.edit
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import com.dessertscraper.app.databinding.ActivityMainBinding
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

class MainActivity : AppCompatActivity() {
    private lateinit var binding: ActivityMainBinding
    private var uploadMessage: ValueCallback<Array<Uri>>? = null
    private val filePickerLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        val uris = if (result.resultCode == Activity.RESULT_OK && result.data != null) {
            result.data?.data?.let { arrayOf(it) }
        } else null
        uploadMessage?.onReceiveValue(uris)
        uploadMessage = null
    }
    private val notificationPermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            binding.webView.post {
                binding.webView.evaluateJavascript(
                    "window.dispatchEvent(new CustomEvent('android-notification-permission', { detail: { granted: ${if (granted) "true" else "false"} } }));",
                    null
                )
            }
        }
    private val storagePermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            binding.webView.post {
                binding.webView.evaluateJavascript(
                    "window.dispatchEvent(new CustomEvent('android-storage-permission', { detail: { granted: ${if (granted) "true" else "false"} } }));",
                    null
                )
            }
        }
    private val multiPermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { permissions ->
            val allGranted = permissions.values.all { it }
            binding.webView.post {
                binding.webView.evaluateJavascript(
                    "window.dispatchEvent(new CustomEvent('android-storage-permission', { detail: { granted: ${if (allGranted) "true" else "false"} } }));",
                    null
                )
            }
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        createNotificationChannel()
        createUpdateChannel()
        configureWebView(binding.webView)
        configureRefresh()

        if (savedInstanceState == null) {
            binding.webView.loadUrl(APP_URL)
        } else {
            binding.webView.restoreState(savedInstanceState)
        }

        // Check for app update on start
        checkForAppUpdate()

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (binding.webView.canGoBack()) {
                    binding.webView.goBack()
                } else {
                    finish()
                }
            }
        })
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun configureWebView(webView: WebView) {
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            loadsImagesAutomatically = true
            mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
            mediaPlaybackRequiresUserGesture = false
            javaScriptCanOpenWindowsAutomatically = true
            setSupportMultipleWindows(false)
            allowFileAccess = true
            allowContentAccess = true
            useWideViewPort = true
            loadWithOverviewMode = true
            setGeolocationEnabled(true)
        }

        webView.addJavascriptInterface(AndroidBridge(), "AndroidApp")
        webView.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                uploadMessage = filePathCallback
                val intent = fileChooserParams?.createIntent()
                if (intent != null) {
                    filePickerLauncher.launch(intent)
                    return true
                }
                return false
            }

            override fun onGeolocationPermissionsShowPrompt(
                origin: String?,
                callback: GeolocationPermissions.Callback?
            ) {
                callback?.invoke(origin, true, false)
            }

            override fun onPermissionRequest(request: PermissionRequest?) {
                request?.grant(request.resources)
            }

            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                if (newProgress == 100) {
                    binding.swipeRefresh.isRefreshing = false
                }
            }
        }
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(
                view: WebView?,
                request: WebResourceRequest?
            ): Boolean = false

            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                binding.swipeRefresh.isRefreshing = true
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                binding.swipeRefresh.isRefreshing = false
            }
        }
    }

    private fun configureRefresh() {
        binding.swipeRefresh.setOnRefreshListener {
            binding.webView.reload()
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        binding.webView.saveState(outState)
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (binding.webView.canGoBack()) {
            binding.webView.goBack()
            return
        }
        super.onBackPressed()
    }

    companion object {
        private const val APP_URL = "https://dessertscraper-b595.onrender.com/"
        private const val NOTIFICATION_CHANNEL_ID = "dessert_scraper_alerts"
        private const val UPDATE_CHANNEL_ID = "dessert_scraper_updates"
        private const val VERSION_CHECK_URL = "https://raw.githubusercontent.com/HADINAJIISTHEBEDT/DessertScraper/main/android-app/app/build.gradle"
        private const val PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.dessertscraper.app"
        private const val PREFS_NAME = "app_prefs"
        private const val LAST_VERSION_CHECK = "last_version_check"
        private const val CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000L // 24 hours
    }

    private inner class AndroidBridge {
        @JavascriptInterface
        fun isAndroidApp(): Boolean = true

        @JavascriptInterface
        fun isNotificationPermissionGranted(): Boolean = hasNotificationPermission()

        @JavascriptInterface
        fun requestNotificationPermission() {
            runOnUiThread {
                if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return@runOnUiThread
                notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
        }

        @JavascriptInterface
        fun isStoragePermissionGranted(): Boolean = hasStoragePermission()

        @JavascriptInterface
        fun requestStoragePermission() {
            runOnUiThread {
                requestStoragePermissionInternal()
            }
        }

        @JavascriptInterface
        fun getAppVersion(): String {
            return try {
                packageManager.getPackageInfo(packageName, 0).versionName ?: "1.0"
            } catch (e: Exception) {
                "1.0"
            }
        }

        @JavascriptInterface
        fun getAppVersionCode(): Int {
            return try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                    packageManager.getPackageInfo(packageName, 0).longVersionCode.toInt()
                } else {
                    @Suppress("DEPRECATION")
                    packageManager.getPackageInfo(packageName, 0).versionCode
                }
            } catch (e: Exception) {
                1
            }
        }

        @JavascriptInterface
        fun showUpdateNotification(title: String?, body: String?) {
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(PLAY_STORE_URL)).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            val pendingIntent = PendingIntent.getActivity(
                this@MainActivity,
                0,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            val notification = NotificationCompat.Builder(this@MainActivity, UPDATE_CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .setContentTitle(title?.takeIf { it.isNotBlank() } ?: "App Update Available")
                .setContentText(body?.takeIf { it.isNotBlank() } ?: "A new version is available. Tap to update.")
                .setStyle(NotificationCompat.BigTextStyle().bigText(body?.takeIf { it.isNotBlank() } ?: "A new version of Dessert Scraper is available."))
                .setAutoCancel(true)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setContentIntent(pendingIntent)
                .build()

            NotificationManagerCompat.from(this@MainActivity).notify(99999, notification)
        }

        @JavascriptInterface
        fun openUpdateLink() {
            runOnUiThread {
                val intent = Intent(Intent.ACTION_VIEW, Uri.parse(PLAY_STORE_URL)).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                }
                startActivity(intent)
            }
        }

        @JavascriptInterface
        fun showNotification(title: String?, body: String?, tag: String?): Boolean {
            if (!hasNotificationPermission()) return false

            val intent = Intent(this@MainActivity, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            val pendingIntent = PendingIntent.getActivity(
                this@MainActivity,
                0,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            val notification = NotificationCompat.Builder(this@MainActivity, NOTIFICATION_CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .setContentTitle(title?.takeIf { it.isNotBlank() } ?: getString(R.string.app_name))
                .setContentText(body?.takeIf { it.isNotBlank() } ?: "")
                .setStyle(NotificationCompat.BigTextStyle().bigText(body?.takeIf { it.isNotBlank() } ?: ""))
                .setAutoCancel(true)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setContentIntent(pendingIntent)
                .build()

            NotificationManagerCompat.from(this@MainActivity).notify(
                (tag ?: "dessert-scraper").hashCode(),
                notification
            )
            return true
        }

        @JavascriptInterface
        fun saveData(key: String?, value: String?) {
            if (key == null) return
            getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit {
                putString(key, value ?: "")
            }
        }

        @JavascriptInterface
        fun loadData(key: String?): String? {
            if (key == null) return null
            return getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).getString(key, null)
        }

        @JavascriptInterface
        fun removeData(key: String?) {
            if (key == null) return
            getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit {
                remove(key)
            }
        }

        @JavascriptInterface
        fun getExternalStoragePath(): String {
            return getExternalFilesDir(null)?.absolutePath ?: filesDir.absolutePath
        }
    }

    private fun hasNotificationPermission(): Boolean {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            ContextCompat.checkSelfPermission(
                this,
                Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED
    }

    private fun hasStoragePermission(): Boolean {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            return ContextCompat.checkSelfPermission(
                this,
                Manifest.permission.READ_MEDIA_IMAGES
            ) == PackageManager.PERMISSION_GRANTED
        }
        return ContextCompat.checkSelfPermission(
            this,
            Manifest.permission.WRITE_EXTERNAL_STORAGE
        ) == PackageManager.PERMISSION_GRANTED
    }

    private fun requestStoragePermissionInternal() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            multiPermissionLauncher.launch(
                arrayOf(
                    Manifest.permission.READ_MEDIA_IMAGES,
                    Manifest.permission.READ_MEDIA_VIDEO,
                    Manifest.permission.READ_MEDIA_AUDIO
                )
            )
        } else {
            storagePermissionLauncher.launch(Manifest.permission.WRITE_EXTERNAL_STORAGE)
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return

        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val channel = NotificationChannel(
            NOTIFICATION_CHANNEL_ID,
            "Dessert Scraper Alerts",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "Timer and app alerts for Dessert Scraper"
        }
        manager.createNotificationChannel(channel)
    }

    private fun createUpdateChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return

        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val channel = NotificationChannel(
            UPDATE_CHANNEL_ID,
            "Dessert Scraper Updates",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "App update notifications"
            enableLights(true)
            enableVibration(true)
        }
        manager.createNotificationChannel(channel)
    }

    private fun checkForAppUpdate() {
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val lastCheck = prefs.getLong(LAST_VERSION_CHECK, 0)
        val now = System.currentTimeMillis()
        if (now - lastCheck < CHECK_INTERVAL_MS) return

        prefs.edit { putLong(LAST_VERSION_CHECK, now) }

        Executors.newSingleThreadExecutor().execute {
            try {
                val url = URL(VERSION_CHECK_URL)
                val connection = url.openConnection() as HttpURLConnection
                connection.connectTimeout = 5000
                connection.readTimeout = 5000
                val response = connection.inputStream.bufferedReader().use { it.readText() }

                val versionCodeMatch = Regex("versionCode\\s*=\\s*(\\d+)").find(response)
                val versionNameMatch = Regex("versionName\\s*=\\s*\"([^\"]+)\"").find(response)

                val remoteVersionCode = versionCodeMatch?.groupValues?.get(1)?.toIntOrNull()
                val remoteVersionName = versionNameMatch?.groupValues?.get(1)

                val currentVersionCode = try {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                        packageManager.getPackageInfo(packageName, 0).longVersionCode.toInt()
                    } else {
                        @Suppress("DEPRECATION")
                        packageManager.getPackageInfo(packageName, 0).versionCode
                    }
                } catch (e: Exception) { 1 }

                if (remoteVersionCode != null && remoteVersionCode > currentVersionCode) {
                    runOnUiThread {
                        val bridge = AndroidBridge()
                        bridge.showUpdateNotification(
                            "Update Available",
                            "Dessert Scraper $remoteVersionName is available. Tap to update."
                        )
                    }
                }
            } catch (e: Exception) {
                // Silently fail - check again next time
            }
        }
    }
}
