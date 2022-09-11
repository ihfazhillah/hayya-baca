package com.ihfazh.ksatriamuslim.fragments

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.view.animation.AnimationUtils
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.navigation.fragment.findNavController
import androidx.navigation.fragment.navArgs
import androidx.viewpager2.widget.ViewPager2
import com.ihfazh.ksatriamuslim.MainNavigationDirections
import com.ihfazh.ksatriamuslim.R
import com.ihfazh.ksatriamuslim.adapters.BookReadingViewPagerAdapter
import com.ihfazh.ksatriamuslim.common.Recognizer
import com.ihfazh.ksatriamuslim.databinding.FragmentBookReadingBinding
import com.ihfazh.ksatriamuslim.vm.BookReadingFragmentViewModel
import com.ihfazh.ksatriamuslim.vm.ChildViewModel
import kotlinx.coroutines.launch
import org.koin.androidx.viewmodel.ext.android.sharedViewModel
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
    private val childViewModel by sharedViewModel<ChildViewModel>()
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
            b.viewPager.registerOnPageChangeCallback(object : ViewPager2.OnPageChangeCallback() {
                override fun onPageSelected(position: Int) {
                    super.onPageSelected(position)
                    if (position + 1 == adapter.itemCount) {
                        b.btnDone.visibility = View.VISIBLE
                        val anim =
                            AnimationUtils.loadAnimation(requireContext(), R.anim.test_bouncing)
                        b.btnDone.startAnimation(anim)
                    } else {
                        b.btnDone.visibility = View.GONE
                    }
                }
            })

            b.btnDone.setOnClickListener {
                childViewModel.increaseMyCoin(args.bookId)
                val action = MainNavigationDirections.goToCoinCongratulateFragment()
                findNavController().navigate(action)
                lifecycleScope.launch { Recognizer.stopRecognizing() }

            }


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