package com.ihfazh.ksatriamuslim.repositories

import android.content.Context
import android.util.Log
import com.ihfazh.ksatriamuslim.domain.Book
import com.ihfazh.ksatriamuslim.remote.KsatriaMuslimService
import okhttp3.ResponseBody
import retrofit2.HttpException
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream

class SpeakWordRepositoryImpl(
    val context: Context,
    val remote: KsatriaMuslimService,
    val bookRepository: BookRepository
) :
    SpeakWordRepository {
    override suspend fun getAudioUrls(): List<String> {
        return remote.getAudioSpeakIndex().urls?.map {
            it
        } ?: emptyList()
    }

    override suspend fun saveAudios() {
        val urls = getAudioUrls()
        println("urls: $urls")
        urls.forEach {
            val response = remote.getAudio(it)
            saveFile(it, response)
        }

        // per page per book
        val books: List<Book?> = bookRepository.getBooksSummary().map {
            bookRepository.getBook(it.id)
        }
        books.forEach {
            val book = it!!
            val basePath = "ksatriamuslim_audios/by-books-page/${book.id}"
            for (page in 1..book.pages.size) {
                val path = "$basePath/$page.mp3"
                try {
                    Log.d(TAG, "saveAudios: path $path")
                    val response = remote.getAudio(path)
                    saveFile(path, response, book.id)
                } catch (e: HttpException) {
                    Log.w(TAG, "saveAudios: path $path not found")
                }
            }
        }

    }

    private fun saveFile(
        filePath: String,
        response: ResponseBody,
        prefix: String? = null
    ): Boolean {
        val file = File(context.filesDir, filePath)
        val parent = context.getExternalFilesDir("ksatriamuslim_audio")

        val name = if (prefix != null) "${prefix}__${file.name}" else file.name

        Log.d(TAG, "saveFile: final file name $name - prefix: $prefix")

        if (parent?.exists() == false) {
            parent.mkdirs()
        }

        var inputStream: InputStream? = response.byteStream()
        val finalFile = context.getExternalFilesDir("ksatriamuslim_audio")?.path
            ?.plus("/$name") ?: return true

        val outputStream = FileOutputStream(finalFile)

        var temp: Int

        while (true) {
            temp = inputStream?.read() ?: -1
            outputStream.write(temp)
            if (temp == -1) {
                break
            }
        }

        outputStream.close()
        return false
    }

    companion object {
        const val TAG = "Speak word repository"
    }
}