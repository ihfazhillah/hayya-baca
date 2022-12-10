package com.ihfazh.ksatriamuslim.common

import android.content.Context
import android.net.Uri
import timber.log.Timber
import java.io.File
import java.io.IOException
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.zip.ZipFile
import kotlin.coroutines.resume
import kotlin.coroutines.suspendCoroutine


sealed class AudioBookResponse {
    object Success : AudioBookResponse()
    data class Error(val errorCode: Int) : AudioBookResponse()
}

class AudioFileUtil(
    private val sessionManager: SessionManager,
    private val context: Context
) : AbstractFileUtil() {
    fun getTimeStamp(book: Int): String {
        val base = getBookDirectory(context, book)
        val file = File("$base${File.separator}audio${File.separator}timestamp")
        if (!file.exists()) return ""
        return file.readText()
    }

    suspend fun getAudioFromWeb(
        book: Int,
    ): AudioBookResponse {
        return suspendCoroutine { cont ->
            val urlString = "$REMOTE_DOMAIN/books/$book/audio-zip/"
            val uri = Uri.parse(urlString)

            val url = URL(
                uri.scheme,
                uri.host,
                uri.path + "?token=${sessionManager.getToken()}&timestamp=${getTimeStamp(book)}"
            )

            Timber.d("want to download: $urlString")

            try {

                val base = getBookDirectory(context, book)
                if (base != null && makeBookDirectory(context, book)) {
                    val baseAudioPath = "$base${File.separator}audio${File.separator}"

                    val dir = File(baseAudioPath)

                    if (!dir.exists()) {
                        dir.mkdirs()
                        writeNoMediaFile(baseAudioPath)
                    }

                    with(url.openConnection() as HttpURLConnection) {

                        if (responseCode != 200) {
                            // 403 forbidden
                            // 400: kalau tidak ada di server
                            // data belum ada data baru
                            Timber.d(responseCode.toString())
                            cont.resume(
                                AudioBookResponse.Error(responseCode)
                            )
                            return@suspendCoroutine
                        }

                        val path = "$base${File.separator}audio${File.separator}$book.zip"

                        tryToSave(content as InputStream, path)

                        Timber.d("Audio Zip File downloaded successfully")


                        ZipFile(path).use { zip ->
                            zip.entries().asSequence().forEach { entry ->
                                val p = baseAudioPath + entry.name
                                tryToSave(zip.getInputStream(entry), p)
                                Timber.d("File saved at $p")
                            }
                        }

                        Timber.d("deleting zip file")

                        File(path).delete()
                        cont.resume(AudioBookResponse.Success)
                    }

                }


            } catch (ioe: IOException) {
                Timber.e(ioe, "error")
                cont.resume(
                    AudioBookResponse.Error(1)
                )
            }

        }
    }

    fun getAudioFile(book: Int, page: Int, index: Int): File {
        // currently file in wav. Change me if the audio already in mp3 format
        val base = getBookDirectory(context, book)
        val path = "$base${File.separator}audio${File.separator}${book}_${page}_$index.mp3"
        return File(path)
    }

    fun getAudioFiles(book: Int, page: Int): List<File> {
        val base = getBookDirectory(context, book) ?: return listOf()
        val directory = File("$base${File.separator}audio${File.separator}")
        return directory.listFiles { _, fileName ->
            fileName.startsWith("${book}_${page}_")
        }?.sorted()?.toList() ?: listOf()
    }

}