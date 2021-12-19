package com.ihfazh.ksatriamuslim

import com.ihfazh.ksatriamuslim.domain.Background
import com.ihfazh.ksatriamuslim.domain.Book
import com.ihfazh.ksatriamuslim.domain.BookSummary
import com.ihfazh.ksatriamuslim.local.data.BackgroundEntity
import com.ihfazh.ksatriamuslim.local.data.BookEntity
import com.ihfazh.ksatriamuslim.local.data.BookSummaryEntity
import com.ihfazh.ksatriamuslim.remote.data.BackgroundResponse
import com.ihfazh.ksatriamuslim.remote.data.BookDetailResponse

fun BookEntity.toBook(): Book {
    return Book(id, pages.split("+=+=+"))
}

fun BookDetailResponse.toBookSummary(): BookSummary {
    val id = title.lowercase().replace(" ", "-")

    return BookSummary(
        id, title, thumbnail
    )

}

fun BookDetailResponse.toBookEntity(): BookEntity {
    val pages = content.map{
        it.pageText
    }
        .joinToString("+=+=+")
    val id = title.lowercase().replace(" ", "-")
    return BookEntity(
        id, title, thumbnail, pages
    )
}

fun List<BookSummaryEntity>.toBookSummaries(): List<BookSummary> =
    map {
        BookSummary(it.id, it.title, it.thumbnailSrc)
    }

 fun BackgroundResponse.toBackgroundEntity(): BackgroundEntity {
    val id = title.split(" ").joinToString("-")
    return BackgroundEntity(id, title, backgroundImage, textColor)
}

 fun BackgroundResponse.toBackground(): Background {
    val id = title.split(" ").joinToString("-")
    return Background(
        id = id,
        title = title,
        src = backgroundImage,
        text_color = textColor
    )
}

fun List<BackgroundEntity>.toBackgrounds(): List<Background> =
    this.map {
        Background(it.id, it.title, it.src, it.text_color)
    }