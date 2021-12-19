package com.ihfazh.ksatriamuslim.remote.data

import com.google.gson.annotations.SerializedName

data class BookDetailResponse(

	@field:SerializedName("thumbnail")
	val thumbnail: String,

	@field:SerializedName("title")
	val title: String,

	@field:SerializedName("content")
	val content: List<ContentItem>
)

data class ContentItem(

	@field:SerializedName("page_text")
	val pageText: String
)
