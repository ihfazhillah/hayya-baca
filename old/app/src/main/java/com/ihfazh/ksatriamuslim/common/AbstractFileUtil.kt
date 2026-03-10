package com.ihfazh.ksatriamuslim.common

import android.content.Context
import android.os.Environment
import java.io.File
import java.io.IOException
import java.io.InputStream

abstract class AbstractFileUtil {
    private val isSDCardMounted: Boolean
        get() {
            val state = Environment.getExternalStorageState()
            return state == Environment.MEDIA_MOUNTED
        }

    private fun getBookBaseDirectory(context: Context): String? {
        var basePath = context.filesDir.absolutePath

        if (!isSDCardMounted) {
            return null
        }

        if (!basePath.endsWith(File.separator)) {
            basePath += File.separator
        }

        return basePath + BOOK_BASE
    }

    fun writeNoMediaFile(path: String): Boolean {
        val f = File("$path/.nomedia")
        return if (f.exists()) {
            true
        } else try {
            f.createNewFile()
        } catch (e: IOException) {
            false
        }


    }

    fun getBookDirectory(context: Context, book: Int): String? {
        val base = getBookBaseDirectory(context) ?: return null
        return base + File.separator + book.toString()

    }

    fun makeBookDirectory(context: Context, book: Int): Boolean {
        val path = getBookDirectory(context, book) ?: return false
        val directory = File(path)

        return if (directory.exists() && directory.isDirectory) {
            writeNoMediaFile(path)
        } else {
            directory.mkdirs() && writeNoMediaFile(path)

        }
    }

    private fun tryToSafeRaw(responseText: String, path: String): Boolean {
        val file = File(path)
        file.writeText(responseText)
        return true
    }

    fun tryToSave(stream: InputStream, path: String): Boolean {
        val file = File(path)
        file.writeBytes(stream.readBytes())
        return true
    }

    companion object {
        private const val BOOK_BASE = "books/"
        const val REMOTE_DOMAIN = "https://cms.ksatriamuslim.com"
    }
}