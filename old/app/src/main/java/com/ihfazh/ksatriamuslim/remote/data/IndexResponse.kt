package com.ihfazh.ksatriamuslim.remote.data

import com.google.gson.annotations.SerializedName

data class IndexResponse(

	@field:SerializedName("urls")
	val urls: List<String>? = null
)
