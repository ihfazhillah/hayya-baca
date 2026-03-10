package com.ihfazh.ksatriamuslim.domain

data class BookUI(
    val book: Book,
//    val id: String,
//    val title: String,
//    val thumbnailSrc: String,
//    val locallyCreated: Date? = null,
    val gift_opened: Boolean = true,
    val locked: Boolean = false
) {
    val id = book.id
    val title = book.title

    //    val pages = book.pages
    val created = book.created
}
