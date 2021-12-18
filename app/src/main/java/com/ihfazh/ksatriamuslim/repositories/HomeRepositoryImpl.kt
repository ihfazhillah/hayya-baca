package com.ihfazh.ksatriamuslim.repositories

import com.ihfazh.ksatriamuslim.domain.Book

class HomeRepositoryImpl: HomeRepository{
    override suspend fun getBooks(): List<Book> {
        return listOf(
            Book("nabi-muhammad", "Nabi Muhammad"),
            Book("kisah-buhairo", "Kisah Buhairo dan Nabi Muhammad")
        )
    }
}