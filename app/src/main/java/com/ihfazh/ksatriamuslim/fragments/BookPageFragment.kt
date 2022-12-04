/*
Individual Book Page, displays image
 */

package com.ihfazh.ksatriamuslim.fragments

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import coil.load
import com.google.android.material.snackbar.Snackbar
import com.ihfazh.ksatriamuslim.common.WordSpeak
import com.ihfazh.ksatriamuslim.databinding.FragmentBookPageBinding
import com.ihfazh.ksatriamuslim.domain.BookPageUIData
import com.ihfazh.ksatriamuslim.domain.SpeakInput
import com.ihfazh.ksatriamuslim.domain.Word
import com.ihfazh.ksatriamuslim.domain.WordUI
import com.ihfazh.ksatriamuslim.vm.BookPageViewModel
import org.koin.android.ext.android.inject
import org.koin.androidx.viewmodel.ext.android.viewModel

/**
 * A simple [Fragment] subclass.
 * Use the [BookPageFragment.newInstance] factory method to
 * create an instance of this fragment.
 */
class BookPageFragment : Fragment() {
    private var pageNum: Int? = null
    private var book: Int? = null

    private var binding: FragmentBookPageBinding? = null
    private val vm by viewModel<BookPageViewModel>()
    private val wordSpeak: WordSpeak by inject()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        arguments?.let {
            pageNum = it.getInt(PAGE_KEY)
            book = it.getInt(BOOK_KEY)
            vm.getImageData(book!!, pageNum!!)
        }
    }

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {

        binding = FragmentBookPageBinding.inflate(inflater, container, false)
        return binding?.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        binding?.let { b ->
            vm.uiData.observe(viewLifecycleOwner) { uiData ->
                when (uiData) {
                    is BookPageUIData.Success -> handleSuccess(b, uiData)
                    is BookPageUIData.Error -> handleError(b, uiData)
                }

            }

        }
    }

    private fun handleSuccess(binding: FragmentBookPageBinding, uiData: BookPageUIData.Success) {
        binding.pageImage.apply {
            load(uiData.bitmap)
            setTextDataList(uiData.metadata.page_data.map {
                WordUI(it, false)
            })
            setOnWordListener { index, word: Word ->
                wordSpeak.speak(
                    SpeakInput(
                        book!!,
                        pageNum!!,
                        index,
                        word.text
                    )
                )
            }
            originalHeight = vm.originalImageHeight
            originalWidth = vm.originalImageWidth
        }
    }

    private fun handleError(binding: FragmentBookPageBinding, uiData: BookPageUIData.Error) {
        Snackbar.make(binding.root, uiData.errorCode, Snackbar.LENGTH_SHORT).show()
    }

    companion object {
        private const val PAGE_KEY: String = "page"
        private const val BOOK_KEY: String = "book"

        @JvmStatic
        fun newInstance(pageNum: Int, book: Int) =
            BookPageFragment().apply {
                arguments = Bundle().apply {
                    putInt(PAGE_KEY, pageNum)
                    putInt(BOOK_KEY, book)
                }
            }
    }

    override fun onDestroy() {
        super.onDestroy()
        binding = null
    }
}