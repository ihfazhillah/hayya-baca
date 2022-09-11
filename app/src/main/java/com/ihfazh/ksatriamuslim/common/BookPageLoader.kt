package com.ihfazh.ksatriamuslim.common

import com.ihfazh.ksatriamuslim.domain.BookPageUIData

interface BookPageLoader {
    suspend fun loadPage(book: Int, pageNum: Int): BookPageUIData
}