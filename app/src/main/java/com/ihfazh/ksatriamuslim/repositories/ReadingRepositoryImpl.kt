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

    private val buhairo = listOf(
        "Kisah Buhairo",
        "Suatu hari, Nabi Muhammad bersama pamannya pergi berdagang menuju Syam." ,
        "Ketika hendak sampai, disana ada Ahli Ibadah yang bernama Buhairo." ,
        "Buhairo memperhatikan kafilah dagang, kemudian memegang tangan Nabi Muhammad Seraya berkata" ,
        "Orang ini adalah tuannya manusia, orang ini adalah utusan Alloh, dia diutus sebagai rahmat semesta alam”" ,
        "Orang orang bertanya “kok kamu bisa tahu?”" ,
        "Buhairo menjawab “Kalian ketika melewati Al ‘Aqobah semua pepohonan dan bebatuan sujud kepadanya." ,
        "Pepohonan dan bebatuan tidaklah sujud kecuali kepada nabi." ,
        "Aku juga tahu karena ada cap kenabian di punggungnya yang bentuknya seperti buah apel.”" ,
        "Lalu buhairo mempersiapkan hidangan untuk kafilah dagang dan kemudian mengantarkannya." ,
        "Pada saat itu, Nabi Muhammad sedang menjaga unta." ,
        "Buhairo berkata: “panggil dia”. " ,
        "Maka datanglah Nabi Muhammad dalam keadaan dipayungi awan dan orang orang sudah berteduh dibawah pohon." ,
        "Nabi Muhammad pun duduk, tapi bayangan pohon malah menuju Nabi Muhammad dan memayunginya." ,
        "Buhairo pun berkata “Lihat, bayangan pohon menujunya”" ,
        "Ketika kafilah dagang akan meneruskan perjalanan, Buhairo berpesan untuk tidak melanjutkan perjalanan ke Romawi." ,
        "Kenapa? Karena orang orang Romawi kalau tahu disitu ada Nabi Muhammad, mereka akan membunuhnya." ,
        "Akhirnya, pamannya yang bernama Abu Tholib mengembalikan Nabi Muhammad, memerintahkannya pulang, bersama Abu Bakar dan Bilal.",
        "Begitulah Alloh menyelamatkan Nabi Nya dari orang orang yang memusuhinya, bahkan sebelum dia diutus sebagai nabi."
    )

    override suspend fun getText(bookId: String, page: Int): String {
        if (bookId == "nabi-muhammad"){
            return pages[page - 1]
        } else {
            return buhairo[page - 1]
        }
    }

    override suspend fun hasNext(bookId: String, page: Int): Boolean {
        if (bookId == "nabi-muhammad"){
            return page   < pages.size
        } else {
            return page  < buhairo.size
        }
    }

    override suspend fun hasPrev(bookId: String, page: Int): Boolean {
        return page > 1
    }
}