package com.ihfazh.ksatriamuslim

import com.ihfazh.ksatriamuslim.domain.Background
import com.ihfazh.ksatriamuslim.domain.Book
import com.ihfazh.ksatriamuslim.domain.BookSummary
import com.ihfazh.ksatriamuslim.local.data.BackgroundEntity
import com.ihfazh.ksatriamuslim.local.data.BookEntity
import com.ihfazh.ksatriamuslim.local.data.BookSummaryEntity
import com.ihfazh.ksatriamuslim.remote.data.BackgroundResponse
import com.ihfazh.ksatriamuslim.remote.data.BookDetailResponse


fun getIdFromPath(path: String): String{
    val files = path.split("/")
    val fileName = files.last()

    return fileName.replace(".json", "")
}


fun BookEntity.toBook(): Book {
    return Book(id, pages.split("+=+=+"), locallyCreated, gift_opened)
}

fun BookDetailResponse.toBookSummary(path: String): BookSummary {
    val id = getIdFromPath(path)

    return BookSummary(
        id, title, thumbnail
    )

}

fun BookDetailResponse.toBookEntity(path: String): BookEntity {
    val pages = content.map{
        it.pageText
    }
        .joinToString("+=+=+")

    val id = getIdFromPath(path)

    return BookEntity(
        id, title, thumbnail, pages
    )
}

fun List<BookSummaryEntity>.toBookSummaries(): List<BookSummary> =
    map {
        BookSummary(it.id, it.title, it.thumbnailSrc, it.locallyCreated, it.gift_opened)
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