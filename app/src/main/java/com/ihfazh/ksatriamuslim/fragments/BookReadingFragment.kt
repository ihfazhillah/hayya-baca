package com.ihfazh.ksatriamuslim.fragments

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.navigation.fragment.findNavController
import androidx.navigation.fragment.navArgs
import com.ihfazh.ksatriamuslim.adapters.BookReadingViewPagerAdapter
import com.ihfazh.ksatriamuslim.databinding.FragmentBookReadingBinding
import com.ihfazh.ksatriamuslim.vm.BookReadingFragmentViewModel
import org.koin.androidx.viewmodel.ext.android.viewModel
import timber.log.Timber


/**
 * A simple [Fragment] subclass.
 * Use the [BookReadingFragment.newInstance] factory method to
 * create an instance of this fragment.
 */
class BookReadingFragment : Fragment() {
    private var binding: FragmentBookReadingBinding? = null
    private val vm by viewModel<BookReadingFragmentViewModel>()
    private val args by navArgs<BookReadingFragmentArgs>()

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        // Inflate the layout for this fragment
        binding = FragmentBookReadingBinding.inflate(inflater, container, false)
        vm.getPageCount(args.bookId)
        vm.getBackground()
        return binding?.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        binding?.let { b ->
            val adapter = BookReadingViewPagerAdapter(this, args.bookId)
            b.viewPager.adapter = adapter


            vm.pageCount.observe(viewLifecycleOwner) {
                Timber.d("Got pages : $it")
                adapter.setCount(it)
            }

            vm.background.observe(viewLifecycleOwner) {
                b.root.background = it
            }

            b.home.setOnClickListener {
                findNavController().popBackStack()
            }

        }
    }


    override fun onDestroy() {
        super.onDestroy()
        binding = null
    }
}