package com.ihfazh.ksatriamuslim.views

import android.content.Context
import android.graphics.*
import android.util.AttributeSet
import android.view.MotionEvent
import androidx.core.graphics.toRectF
import com.ihfazh.ksatriamuslim.domain.Word
import com.ihfazh.ksatriamuslim.domain.WordUI
import timber.log.Timber

const val ORIGINAL_WIDTH = 960
const val ORIGINAL_HEIGHT = 1080


class HighLightedImageView : androidx.appcompat.widget.AppCompatImageView {
    constructor(context: Context) : super(context)
    constructor(context: Context, attributeSet: AttributeSet) : super(context, attributeSet)
    constructor(context: Context, attributeSet: AttributeSet, defStyleAttr: Int) : super(
        context,
        attributeSet,
        defStyleAttr
    )

    private val textDataList: MutableList<WordUI> = mutableListOf()
    private var onWordListener: (Word) -> Unit = {}

    var originalWidth: Int = ORIGINAL_WIDTH
    var originalHeight: Int = ORIGINAL_HEIGHT

    fun setTextDataList(textDataList: List<WordUI>) {
        this.textDataList.clear()
        this.textDataList.addAll(textDataList)
        invalidate()
    }

    fun setOnWordListener(listener: (Word) -> Unit) {
        this.onWordListener = listener
    }

    private val paint = Paint().apply {
        color = Color.parseColor("#FEB7B3")
    }

    private val textBackgroundPaint = Paint().apply {
        color = Color.argb(150, 252, 241, 221)
    }


    override fun onDraw(canvas: Canvas?) {

        val widthRatio = width.toFloat() / originalWidth
        val heightRatio = height.toFloat() / originalHeight

        // add some padding
        val padding = 5 * resources.displayMetrics.density
        val round = 25 * resources.displayMetrics.density

        // text background overlay
        canvas?.drawRoundRect(
            0f,
            0f,
            width.toFloat(),
            height.toFloat(),
            round,
            round,
            textBackgroundPaint
        )

        textDataList.forEach { textData ->
            if (textData.isActive) {
                textData.bBoxes.forEach { bBox ->

                    val textBBox = bBox.toDeviceRect(widthRatio, heightRatio).apply {
                        left -= padding
                        right += padding
                        top -= padding
                        bottom += padding
                    }

                    canvas?.drawRoundRect(textBBox, round, round, paint)
                }
            }
        }

        super.onDraw(canvas)

    }

    override fun onTouchEvent(event: MotionEvent?): Boolean {
        if (event?.action == MotionEvent.ACTION_DOWN) {
            activateText(event.x, event.y)
            Timber.d("x: ${event.x}, y: ${event.y}")
        }

        if (event?.action == MotionEvent.ACTION_UP) {
            decativateAll()
        }
        return true
    }

    private fun decativateAll() {
        setTextDataList(
            textDataList.map {
                it.copy(isActive = false)
            }
        )
    }

    private fun activateText(x: Float, y: Float) {
        val widthRatio = width.toFloat() / originalWidth
        val heightRatio = height.toFloat() / originalHeight

        val originX = x / widthRatio
        val originY = y / heightRatio

        setTextDataList(
            textDataList.map { wordUI ->
                var isActive = false

                wordUI.bBoxes.forEach { rect ->
                    val rectF = rect.toRectF()
                    isActive = rectF.contains(originX, originY)
                    if (isActive) {
                        return@forEach
                    }
                }

                val anyActive =
                    wordUI.bBoxes.any { rect -> rect.toRectF().contains(originX, originY) }

                Timber.d("origin x: $originX origin y: $originY")
                Timber.d("current word: $wordUI")
                Timber.d("Is Active: $isActive")
                Timber.d("any active: $anyActive")

                if (anyActive) {
                    onWordListener.invoke(wordUI.word)
                }

                wordUI.copy(isActive = anyActive)
            }

        )
    }


}

private fun Rect.toDeviceRect(xRatio: Float, yRatio: Float): RectF {
    return RectF(
        left * xRatio,
        top * yRatio,
        right * xRatio,
        bottom * yRatio
    )
}

