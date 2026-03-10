package com.ihfazh.ksatriamuslim.domain

data class WordUI(
    val word: Word,
    val isActive: Boolean = false
) {

    val text = word.text
    val bBoxes = word.bboxes
}
