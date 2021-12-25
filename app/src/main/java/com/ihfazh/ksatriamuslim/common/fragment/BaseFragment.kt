package com.ihfazh.ksatriamuslim.common.fragment

import android.os.Bundle
import android.view.*
import androidx.activity.addCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.fragment.app.Fragment
import com.ihfazh.ksatriamuslim.MainActivity

abstract class BaseFragment: Fragment() {

//    override fun onCreateView(
//        inflater: LayoutInflater,
//        container: ViewGroup?,
//        savedInstanceState: Bundle?
//    ): View? {
//        if (getShowStatusBarStatus()) {
//            (activity as AppCompatActivity).supportActionBar?.show()
//        } else {
//            (activity as AppCompatActivity).supportActionBar?.hide()
//        }
//
//        return super.onCreateView(inflater, container, savedInstanceState)
//    }
//
//    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
//        super.onViewCreated(view, savedInstanceState)
//        if (getShowStatusBarStatus()) {
//            (activity as AppCompatActivity).supportActionBar?.show()
//        } else {
//            (activity as AppCompatActivity).supportActionBar?.hide()
//        }
//    }

//    override fun onCreate(savedInstanceState: Bundle?) {
//        super.onCreate(savedInstanceState)
//        requireActivity().onBackPressedDispatcher.addCallback() {
//            isEnabled = canBack()
//        }
//    }


    open fun getShowStatusBarStatus(): Boolean = true
    open fun canBack(): Boolean = true

}