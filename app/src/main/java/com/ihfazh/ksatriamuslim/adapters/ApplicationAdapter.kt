package com.ihfazh.ksatriamuslim.adapters

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.RecyclerView
import coil.load
import com.ihfazh.ksatriamuslim.R
import com.ihfazh.ksatriamuslim.databinding.DefaultApplicationItemBinding
import com.ihfazh.ksatriamuslim.domain.AppInfoSelect

object Comparator : DiffUtil.ItemCallback<AppInfoSelect>() {
    override fun areItemsTheSame(oldItem: AppInfoSelect, newItem: AppInfoSelect): Boolean {
        return oldItem.id == newItem.id
    }

    override fun areContentsTheSame(oldItem: AppInfoSelect, newItem: AppInfoSelect): Boolean {
        return oldItem == newItem
    }
}

class Differ(private val newItems: List<AppInfoSelect>, private val oldItems: List<AppInfoSelect>) :
    DiffUtil.Callback() {
    override fun getOldListSize(): Int {
        return oldItems.size
    }

    override fun getNewListSize(): Int {
        return newItems.size
    }

    override fun areItemsTheSame(oldItemPosition: Int, newItemPosition: Int): Boolean {
        return Comparator.areItemsTheSame(
            oldItems[oldItemPosition],
            newItems[newItemPosition]
        )
    }

    override fun areContentsTheSame(oldItemPosition: Int, newItemPosition: Int): Boolean {
        return Comparator.areContentsTheSame(
            oldItems[oldItemPosition],
            newItems[newItemPosition]
        )
    }
}

class ApplicationAdapter(
    private val applicationItemListener: ApplicationItemListener
) : RecyclerView.Adapter<ApplicationAdapter.ViewHolder>() {
    private val items: MutableList<AppInfoSelect> = mutableListOf()

    interface ApplicationItemListener {
        fun itemSelected(appInfo: AppInfoSelect)
    }

    class ViewHolder(
        private val binding: DefaultApplicationItemBinding
    ) : RecyclerView.ViewHolder(binding.root) {

        private var listener: ApplicationItemListener? = null


        fun bind(item: AppInfoSelect) {
            binding.apply {
                appIcon.load(item.icon)
                appLabel.text = item.label
                checkbox.isChecked = item.selected
            }
            if (item.selected) {
                binding.root.setBackgroundResource(R.color.teal_200)
            } else {
                binding.root.setBackgroundColor(0xFFFFFF)
            }

            listener?.let {
                binding.root.setOnClickListener { _ ->
                    it.itemSelected(
                        item.copy(selected = !item.selected)
                    )
                }
                binding.checkbox.setOnClickListener { _ ->
                    it.itemSelected(
                        item.copy(selected = !item.selected)
                    )
                }
            }
        }

        fun setOnItemChangedListener(listener: ApplicationItemListener) {
            this.listener = listener
        }

    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val layoutInflater = LayoutInflater.from(parent.context)
        val binding = DefaultApplicationItemBinding.inflate(layoutInflater, parent, false)
        return ViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        holder.setOnItemChangedListener(applicationItemListener)
        holder.bind(items[position])
    }

    override fun getItemCount(): Int {
        return items.count()
    }

    fun submitData(items: List<AppInfoSelect>) {
        val callback = DiffUtil.calculateDiff(
            Differ(items, this.items)
        )
        callback.dispatchUpdatesTo(this)
        this.items.clear()
        this.items.addAll(items)
    }
}