package com.ihfazh.ksatriamuslim.adapters

import androidx.fragment.app.Fragment
import androidx.viewpager2.adapter.FragmentStateAdapter
import com.ihfazh.ksatriamuslim.fragments.BookPageFragment

class BookReadingViewPagerAdapter(fragment: Fragment, private val bookId: Int) :
    FragmentStateAdapter(fragment) {
    private var count = 0
    fun setCount(value: Int) {
        count = value
        notifyDataSetChanged()
    }


    override fun getItemCount(): Int {
        return count
    }

    override fun createFragment(position: Int): Fragment {
        return BookPageFragment.newInstance(position + 1, bookId)
    }
}