package com.ihfazh.ksatriamuslim.common

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Environment
import com.google.gson.Gson
import com.ihfazh.ksatriamuslim.domain.BookMetadata
import com.ihfazh.ksatriamuslim.domain.BookMetadataResponse
import com.ihfazh.ksatriamuslim.domain.BookReadingResponse
import okhttp3.*
import okhttp3.internal.closeQuietly
import timber.log.Timber
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.io.InputStream
import java.net.URL
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

    suspend fun shouldReDownload(
        context: Context,
        book: Int,
        pageNum: Int
    ): Boolean {
        return suspendCoroutine { cont ->
            /*
            Guard!! when no stamp for the particular book return true
            get value from local for the particular book
            get value from remote for the particular book
            return local != remote
             */

            val localLocation = getBookImageDirectory(context, book)
            val stampFile = File(localLocation + File.separator + "$pageNum-stamp")

            val remoteLocation = BASE_URL + "/books_image/books/$book/$pageNum/stamp"
            val remoteUri = Uri.parse(remoteLocation)
            val remoteUrl = URL(remoteUri.scheme, remoteUri.host, remoteUri.path)

            try {
                val responseText = remoteUrl.readText()
                Timber.d("Stamp for book $book: $responseText")

                if (!stampFile.exists()) {
                    Timber.d("Stamp file not exist in local storage")
                    tryToSafeRaw(responseText, stampFile.absolutePath)
                    Timber.d("saving remote to local")
                    cont.resume(true)
                } else {
                    Timber.d("stamp file found in local storage")
                    val localStamp = stampFile.readText()
                    Timber.d("saving remote stamp file")
                    tryToSafeRaw(responseText, stampFile.absolutePath)
                    Timber.d("compare local vs remote ${localStamp == responseText}")
                    cont.resume(localStamp != responseText)
                }

            } catch (ioe: IOException) {
                Timber.d("No Internet, use data from local")
                Timber.e(ioe)
                cont.resume(false)
            } catch (e: Exception) {
                Timber.e(e)
                tryToSafeRaw("", stampFile.absolutePath)
                cont.resume(true)
            }

        }
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

    suspend fun getBookMetadataFromLocal(
        context: Context,
        book: Int,
        page: Int,
        screenQualifier: String
    ): BookMetadataResponse {
        return suspendCoroutine { cont ->
            val location = getBookImageDirectory(context, book)
                ?: return@suspendCoroutine cont.resume(
                    BookMetadataResponse.Error(BookMetadataResponse.ERROR_SD_CARD_NOT_FOUND)
                )

            val absPath = "$location${File.separator}$page-$screenQualifier-metadata.json"

            try {
                val jsonString: String = File(absPath).bufferedReader().readText()
                val listBookMetadata: BookMetadata =
                    Gson().fromJson(jsonString, BookMetadata::class.java)
                cont.resume(
                    BookMetadataResponse.Success(listBookMetadata)
                )
            } catch (e: IOException) {
                cont.resume(
                    BookMetadataResponse.Error(BookMetadataResponse.ERROR_FILE_NOT_FOUND)
                )
            } catch (e: Exception) {
                Timber.e(e, "Error not handled")
                cont.resume(
                    BookMetadataResponse.Error(BookMetadataResponse.ERROR_UNKNOWN)
                )
            }
        }
    }

    suspend fun getBookMetadataFromWeb(
        context: Context,
        book: Int,
        page: Int,
        screenQualifier: String
    ): BookMetadataResponse {
        return suspendCoroutine { cont ->
            val urlString =
                ("$BASE_URL/book_image_metadata/books/$book/$page-$screenQualifier.json")
            Timber.d("want to download: $urlString")

            val uri = Uri.parse(urlString)

            val url = URL(uri.scheme, uri.host, uri.path)
            try {
                val responseText = url.readText()
                Timber.d("Response Text: $responseText")

                val location = getBookImageDirectory(context, book)
                    ?: return@suspendCoroutine cont.resume(
                        BookMetadataResponse.Error(BookMetadataResponse.ERROR_SD_CARD_NOT_FOUND)
                    )

                val absPath = "$location${File.separator}$page-$screenQualifier-metadata.json"
                if (makeBookImageDirectory(context, book)) {
                    val saveSuccess = tryToSafeRaw(responseText, absPath)
                    if (saveSuccess) {
                        val listBookMetadata: BookMetadata =
                            Gson().fromJson(responseText, BookMetadata::class.java)
                        cont.resume(
                            BookMetadataResponse.Success(listBookMetadata)
                        )
                    } else {
                        Timber.e("Failed on saving file into local")
                    }

                } else {
                    Timber.e("failed to create book directory on $absPath")

                }
            } catch (ioe: IOException) {
                cont.resume(
                    BookMetadataResponse.Error(BookMetadataResponse.ERROR_NO_INTERNET)
                )
            }


        }
    }

    private fun tryToSafeRaw(responseText: String, path: String): Boolean {
        val file = File(path)
        file.writeText(responseText)
        return true
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
