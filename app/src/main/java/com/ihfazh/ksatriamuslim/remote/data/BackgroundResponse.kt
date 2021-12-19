package com.ihfazh.ksatriamuslim.remote.data

import com.google.gson.annotations.SerializedName

data class BackgroundResponse(

	@field:SerializedName("background_image")
	val backgroundImage: String,

	@field:SerializedName("text_color")
	val textColor: String,

	@field:SerializedName("title")
	val title: String
)
