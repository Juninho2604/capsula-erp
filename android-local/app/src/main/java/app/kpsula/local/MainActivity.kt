package app.kpsula.local

import android.annotation.SuppressLint
import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.graphics.Bitmap
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.text.InputType
import android.view.View
import android.view.WindowManager
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.EditText

/**
 * KPSULA Local — envoltorio nativo del POS para las tablets del restaurante.
 *
 * - Carga http://<ip-del-servidor-local> a pantalla completa (sin barras).
 * - Si la red parpadea o el servidor reinicia, NUNCA muestra el error del
 *   navegador: aparece el overlay propio "Conectando…" y reintenta solo
 *   cada 4 segundos hasta reconectar.
 * - La URL del servidor se pide la primera vez y se puede cambiar dejando
 *   el dedo presionado sobre el overlay de conexión.
 */
class MainActivity : Activity() {

    private lateinit var webView: WebView
    private lateinit var overlay: View
    private val handler = Handler(Looper.getMainLooper())
    private var hadError = false
    private var pendingRetry: Runnable? = null
    private var fileCallback: ValueCallback<Array<Uri>>? = null

    private val prefs by lazy { getSharedPreferences("kpsula", MODE_PRIVATE) }
    private var serverUrl: String
        get() = prefs.getString("server_url", "") ?: ""
        set(v) { prefs.edit().putString("server_url", v).apply() }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        webView = findViewById(R.id.webview)
        overlay = findViewById(R.id.overlay)

        // Mantener presionado el overlay → cambiar la IP del servidor.
        overlay.setOnLongClickListener { promptServerUrl(); true }

        with(webView.settings) {
            javaScriptEnabled = true
            domStorageEnabled = true
            mediaPlaybackRequiresUserGesture = false
            useWideViewPort = true
            loadWithOverviewMode = true
        }

        webView.webViewClient = object : WebViewClient() {
            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                hadError = false
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                if (!hadError) hideOverlay()
            }

            override fun onReceivedError(
                view: WebView?, request: WebResourceRequest?, error: WebResourceError?,
            ) {
                // Solo la carga principal dispara el modo reconexión; los
                // recursos secundarios (imágenes, etc.) no tapan la app.
                if (request?.isForMainFrame == true) {
                    hadError = true
                    showOverlayAndRetry()
                }
            }

            override fun shouldOverrideUrlLoading(
                view: WebView?, request: WebResourceRequest?,
            ): Boolean {
                val url = request?.url ?: return false
                // http/https navegan dentro de la app; tel:, wa.me como
                // esquemas externos van al sistema.
                return if (url.scheme == "http" || url.scheme == "https") {
                    false
                } else {
                    runCatching { startActivity(Intent(Intent.ACTION_VIEW, url)) }
                    true
                }
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                view: WebView?, callback: ValueCallback<Array<Uri>>?,
                params: FileChooserParams?,
            ): Boolean {
                fileCallback?.onReceiveValue(null)
                fileCallback = callback
                val intent = params?.createIntent()
                    ?: Intent(Intent.ACTION_GET_CONTENT).apply { type = "*/*" }
                return runCatching { startActivityForResult(intent, REQ_FILE) }.isSuccess
            }
        }

        if (serverUrl.isBlank()) promptServerUrl() else webView.loadUrl(serverUrl)
    }

    private fun showOverlayAndRetry() {
        overlay.visibility = View.VISIBLE
        pendingRetry?.let { handler.removeCallbacks(it) }
        val retry = Runnable { if (hadError) webView.reload() }
        pendingRetry = retry
        handler.postDelayed(retry, 4000)
    }

    private fun hideOverlay() {
        overlay.visibility = View.GONE
        pendingRetry?.let { handler.removeCallbacks(it) }
        pendingRetry = null
    }

    private fun promptServerUrl() {
        val input = EditText(this).apply {
            inputType = InputType.TYPE_TEXT_VARIATION_URI
            setText(serverUrl.ifBlank { "http://192.168.1.10" })
        }
        AlertDialog.Builder(this)
            .setTitle("Servidor KPSULA")
            .setMessage("Dirección del servidor local del restaurante:")
            .setView(input)
            .setCancelable(serverUrl.isNotBlank())
            .setPositiveButton("Conectar") { _, _ ->
                var url = input.text.toString().trim()
                if (url.isNotBlank()) {
                    if (!url.startsWith("http")) url = "http://$url"
                    serverUrl = url.trimEnd('/')
                    hideOverlay()
                    webView.loadUrl(serverUrl)
                }
            }
            .show()
    }

    @Deprecated("Deprecated in Java")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode == REQ_FILE) {
            val uris = if (resultCode == RESULT_OK && data?.data != null) {
                arrayOf(data.data!!)
            } else null
            fileCallback?.onReceiveValue(uris)
            fileCallback = null
        } else {
            @Suppress("DEPRECATION")
            super.onActivityResult(requestCode, resultCode, data)
        }
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) hideSystemBars()
    }

    @Suppress("DEPRECATION")
    private fun hideSystemBars() {
        window.decorView.systemUiVisibility = (
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                or View.SYSTEM_UI_FLAG_FULLSCREEN
                or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            )
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (webView.canGoBack()) webView.goBack()
        // Sin historial no hace nada: una tablet de POS no debe "salirse"
        // de la app por un toque accidental del botón atrás.
    }

    companion object {
        private const val REQ_FILE = 71
    }
}
