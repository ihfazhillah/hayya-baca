package com.ihfazh.ksatriamuslim.repositories

import android.content.Context
import com.ihfazh.ksatriamuslim.remote.KsatriaMuslimService
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream

class SpeakWordRepositoryImpl(val context: Context, val remote: KsatriaMuslimService) :
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
            val file = File(context.filesDir, it)
            val parent = context.getExternalFilesDir("ksatriamuslim_audio")
            println("file: ${file.name}")

            if (parent?.exists() == false) {
                parent.mkdirs()
            }

            var inputStream: InputStream? = response.byteStream()
            val finalFile = context.getExternalFilesDir("ksatriamuslim_audio")?.path
                ?.plus("/${file.name}") ?: return

            val outputStream = FileOutputStream(File(finalFile))

            var temp: Int

            while (true) {
                temp = inputStream?.read() ?: -1
                outputStream.write(temp)
                if (temp == -1) {
                    break
                }
            }

            outputStream.close()


        }
    }
}