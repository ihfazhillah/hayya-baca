package com.ihfazh.ksatriamuslim.common

import android.util.Log
import android.view.View
import androidx.constraintlayout.motion.widget.MotionLayout
import androidx.databinding.BindingAdapter


const val TAG = "BindingAdapters"

@BindingAdapter("isVisible")
fun setIsVisible(view: View, isVisible: Boolean) {
    Log.d(TAG, "setIsVisible: $isVisible - view: ${view.id}")
    if (isVisible) {
        view.visibility = View.VISIBLE
    } else {
        view.visibility = View.GONE
    }
}

@BindingAdapter("isVisibleMotion")
fun setIsVisibleMotion(view: View, isVisible: Boolean) {
    // https://stackoverflow.com/questions/57748203/using-motionlayout-and-setting-visibility-using-databinding-fails
    if (view.parent is MotionLayout) {
        val layout = view.parent as MotionLayout
        val visibility = if (isVisible) View.VISIBLE else View.INVISIBLE
        val alpha = if (isVisible) 1f else 0f

        for (constraintId in layout.constraintSetIds) {
            val constraint = layout.getConstraintSet(constraintId)
            if (constraint != null) {
                constraint.setVisibility(view.id, visibility)
                constraint.setAlpha(view.id, alpha)
            }
        }
    }
}
