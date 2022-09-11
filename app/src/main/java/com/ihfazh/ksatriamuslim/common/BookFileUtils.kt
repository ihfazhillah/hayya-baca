package com.ihfazh.ksatriamuslim.common

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.os.Environment
import com.ihfazh.ksatriamuslim.domain.BookReadingResponse
import okhttp3.*
import okhttp3.internal.closeQuietly
import timber.log.Timber
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.io.InputStream
import kotlin.coroutines.resume
import kotlin.coroutines.suspendCoroutine

class BookFileUtils {
    private val isSDCardMounted: Boolean
        get() {
            val state = Environment.getExternalStorageState()
            return state == Environment.MEDIA_MOUNTED
        }

    fun getBookBaseDirectory(context: Context): String? {
        var basePath = context.filesDir.absolutePath

        if (!isSDCardMounted) {
            return null
        }

        if (!basePath.endsWith(File.separator)) {
            basePath += File.separator
        }

        return basePath + BOOK_BASE

    }

    suspend fun getImageFromLocal(
        context: Context,
        book: Int,
        page: Int,
        screenQualifier: String
    ): BookReadingResponse {
        return suspendCoroutine { cont ->
            val location = getBookImageDirectory(context, book)
                ?: return@suspendCoroutine cont.resume(
                    BookReadingResponse.Error(BookReadingResponse.ERROR_SD_CARD_NOT_FOUND)
                )
            val options = BitmapFactory.Options()
            options.inPreferredConfig = Bitmap.Config.ALPHA_8
            val bitmap = BitmapFactory.decodeFile(
                "$location${File.separator}$page-$screenQualifier.png",
                options
            )

            bitmap?.let {
                cont.resume(
                    BookReadingResponse.Success(it)
                )
            } ?: cont.resume(
                BookReadingResponse.Error(BookReadingResponse.ERROR_FILE_NOT_FOUND)
            )
        }
    }

    suspend fun getImageFromWeb(
        context: Context,
        okHttpClient: OkHttpClient,
        book: Int,
        page: Int,
        screenQualifier: String,
        isRetry: Boolean = false
    ): BookReadingResponse {
        return suspendCoroutine { cont ->
            val urlString = (BASE_URL + "books_image/books/$book/$page-$screenQualifier.png")
            Timber.d("want to download: $urlString")
            val request = Request.Builder()
                .url(urlString)
                .build()
            val call = okHttpClient.newCall(request)
            var responseBody: ResponseBody? = null
            call.enqueue(object : Callback {
                override fun onFailure(call: Call, e: IOException) {
                    Timber.e(e, "Error downloading file")
                    cont.resume(BookReadingResponse.Error(BookReadingResponse.ERROR_DOWNLOADING_ERROR))
                }

                override fun onResponse(call: Call, response: Response) {
                    if (response.isSuccessful) {
                        val responseBody = response.body
                        if (responseBody != null) {
                            val bitmap = decodeBitmapSource(responseBody.source().inputStream())

                            if (bitmap != null) {
                                var path = getBookImageDirectory(context, book)
                                if (path != null && makeBookImageDirectory(context, book)) {
                                    path += File.separator + "$page-$screenQualifier.png"
                                    tryToSaveBitmap(bitmap, path)
                                }

                                cont.resume(BookReadingResponse.Success(bitmap))
                            }

                            responseBody.closeQuietly()
                        }
                    }
                }
            })
        }
    }

    private fun tryToSaveBitmap(bitmap: Bitmap, path: String): Boolean {
        var output: FileOutputStream? = null
        try {
            output = FileOutputStream(path)
            return bitmap.compress(Bitmap.CompressFormat.PNG, 100, output)
        } catch (ioe: IOException) {

        } finally {
            try {
                if (output != null) {
                    output.flush()
                    output.close()
                }
            } catch (e: Exception) {

            }
        }
        return false
    }

    private fun makeBookImageDirectory(context: Context, book: Int): Boolean {
        val path = getBookImageDirectory(context, book) ?: return false
        val directory = File(path)

        return if (directory.exists() && directory.isDirectory) {
            writeNoMediaFile(path)
        } else {
            directory.mkdirs() && writeNoMediaFile(path)

        }
    }

    private fun writeNoMediaFile(path: String): Boolean {
        val f = File("$path/.nomedia")
        return if (f.exists()) {
            true
        } else try {
            f.createNewFile()
        } catch (e: IOException) {
            false
        }

    }

    private fun getBookImageDirectory(context: Context, book: Int): String? {
        val base = getBookBaseDirectory(context) ?: return null
        return base + File.separator + book.toString()

    }

    private fun decodeBitmapSource(inputStream: InputStream): Bitmap? {
        val options = BitmapFactory.Options()
        options.inPreferredConfig = Bitmap.Config.ALPHA_8
        return BitmapFactory.decodeStream(inputStream, null, options)
    }

    companion object {
        private const val BOOK_BASE = "books/"
        private const val BASE_URL = "https://cms.ksatriamuslim.com/media"

    }

}

suspend fun Call.executeSuspend(): Unit {
    suspendCoroutine<Unit> { cont ->
        enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                TODO("Not yet implemented")
            }

            override fun onResponse(call: Call, response: Response) {
                TODO("Not yet implemented")
            }
        })
    }
}