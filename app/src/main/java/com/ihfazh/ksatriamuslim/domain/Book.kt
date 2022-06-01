package com.ihfazh.ksatriamuslim.domain


data class Book(
    val id: Int,
    val title: String,
    val thumbnailSrc: String,
    // TODO: Mungkin perlu di pisah memang antara summary
    // dengan detail nantinya

//    val pages: List<BookPage>,
    val created: Int,

    // TODO: references
)