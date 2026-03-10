package com.ihfazh.ksatriamuslim

import com.ihfazh.ksatriamuslim.domain.Background
import com.ihfazh.ksatriamuslim.domain.Book
import com.ihfazh.ksatriamuslim.local.data.BackgroundEntity
import com.ihfazh.ksatriamuslim.local.data.BookEntity
import com.ihfazh.ksatriamuslim.remote.data.BackgroundResponse


fun getIdFromPath(path: String): String{
    val files = path.split("/")
    val fileName = files.last()

    return fileName.replace(".json", "")
}


fun BookEntity.toBook(): Book {
    return Book(id = id, title = title, thumbnailSrc, created)
}

//fun BookDetailResponse.toBookSummary(path: String): BookUI {
//    val id = getIdFromPath(path)
//
//    return BookUI(
//        id, title, thumbnail
//    )
//
//}

//fun BookDetailResponse.toBookEntity(path: String): BookEntity {
//    val pages = content.map{
//        it.pageText
//    }
//        .joinToString("+=+=+")
//
//    val id = getIdFromPath(path)
//
//    return BookEntity(
//        id, title, thumbnail, pages
//    )
//}

//fun List<BookUIEntity>.toBookSummaries(): List<BookUI> =
//    map {
//        BookUI(it.id, it.title, it.thumbnailSrc, it.locallyCreated, it.gift_opened)
//    }
//
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