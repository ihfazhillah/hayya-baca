package com.ihfazh.ksatriamuslim.repositories

class ReadingRepositoryImpl: ReadingRepository {
    private val pages = listOf(
        "Nabi Muhammad",
        "Beliau adalah nabi terakhir yang Alloh utus kepada manusia.",
        "Mengajak manusia untuk hanya beribadah kepada Alloh, hanya meminta kepada Alloh dan hanya takut kepada Alloh.",
        "Ayahnya bernama Abdulloh dan ibunya bernama Aminah.",
        "Ayahnya meninggal saat ibunya sedang mengandungnya.",
        "Kemudian diumur 6 tahun, ibunya pun meninggal.",
        "Kakeknya yang bernama Abdul Muthollib kemudian mengasuhnya selama dua tahun, dan kemudian meninggal.",
        "Pada saat Nabi Muhammad berumur delapan tahun, pamannya yang bernama Abu Tholib kemudian merawat beliau sampai besar."
    )

    override suspend fun getText(page: Int): String {
        return pages[page - 1]
    }

    override suspend fun hasNext(page: Int): Boolean {
        return page  < pages.size
    }

    override suspend fun hasPrev(page: Int): Boolean {
        return page > 1
    }
}