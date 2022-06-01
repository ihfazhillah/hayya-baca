package com.ihfazh.ksatriamuslim.remote.data

import com.google.gson.annotations.SerializedName

data class BookListResponse(

    @field:SerializedName("next")
    val next: String? = null,

    @field:SerializedName("previous")
    val previous: String? = null,

    @field:SerializedName("count")
    val count: Int? = null,

    @field:SerializedName("results")
    val results: List<BookItem>
)

data class BookItem(

    @field:SerializedName("id")
    val id: Int,

    @field:SerializedName("cover")
    val cover: String,

    @field:SerializedName("reference")
    val reference: Reference? = null,

    @field:SerializedName("reference_note")
    val referenceNote: String? = null,

    @field:SerializedName("reference_text_ar")
    val referenceTextAr: String? = null,

    @field:SerializedName("title")
    val title: String,

    @field:SerializedName("reference_text_id")
    val referenceTextId: String? = null
)

data class Reference(

    @field:SerializedName("author")
    val author: String? = null,

    @field:SerializedName("title")
    val title: String? = null
)
