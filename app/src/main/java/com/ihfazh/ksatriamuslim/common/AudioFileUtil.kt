package com.ihfazh.ksatriamuslim.common

import android.content.Context
import android.net.Uri
import timber.log.Timber
import java.io.File
import java.io.IOException
import java.io.InputStream
import java.net.URL
import java.util.zip.ZipFile
import kotlin.coroutines.resume
import kotlin.coroutines.suspendCoroutine


sealed class AudioBookResponse {
    object Success : AudioBookResponse()
    data class Error(val errorCode: Int) : AudioBookResponse()
}

class AudioFileUtil : AbstractFileUtil() {
    suspend fun getAudioFromWeb(
        context: Context,
        book: Int
    ): AudioBookResponse {
        return suspendCoroutine { cont ->
            val urlString = "$REMOTE_DOMAIN/books/$book/audio-zip/"
            val uri = Uri.parse(urlString)
            val url = URL(uri.scheme, uri.host, uri.path)

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

                    val path = "$base${File.separator}audio${File.separator}$book.zip"
                    tryToSave(url.content as InputStream, path)

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


            } catch (ioe: IOException) {
                Timber.e(ioe, "error")
                cont.resume(
                    AudioBookResponse.Error(1)
                )
            }

        }
    }
}