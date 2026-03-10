package com.ihfazh.ksatriamuslim.adapters

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.RecyclerView
import coil.load
import com.ihfazh.ksatriamuslim.databinding.GridApplicationItemBinding
import com.ihfazh.ksatriamuslim.domain.AppInfo

object ComparatorAppInfo : DiffUtil.ItemCallback<AppInfo>() {
    override fun areItemsTheSame(oldItem: AppInfo, newItem: AppInfo): Boolean {
        return oldItem.id == newItem.id
    }

    override fun areContentsTheSame(oldItem: AppInfo, newItem: AppInfo): Boolean {
        return oldItem == newItem
    }
}

class DifferAppInfo(private val newItems: List<AppInfo>, private val oldItems: List<AppInfo>) :
    DiffUtil.Callback() {
    override fun getOldListSize(): Int {
        return oldItems.size
    }

    override fun getNewListSize(): Int {
        return newItems.size
    }

    override fun areItemsTheSame(oldItemPosition: Int, newItemPosition: Int): Boolean {
        return ComparatorAppInfo.areItemsTheSame(
            oldItems[oldItemPosition],
            newItems[newItemPosition]
        )
    }

    override fun areContentsTheSame(oldItemPosition: Int, newItemPosition: Int): Boolean {
        return ComparatorAppInfo.areContentsTheSame(
            oldItems[oldItemPosition],
            newItems[newItemPosition]
        )
    }
}

class ApplicationChildAdapter(
    private val applicationItemListener: ApplicationItemListener
) : RecyclerView.Adapter<ApplicationChildAdapter.ViewHolder>() {
    private val items: MutableList<AppInfo> = mutableListOf()

    interface ApplicationItemListener {
        fun itemClicked(appInfo: AppInfo)
    }

    class ViewHolder(
        private val binding: GridApplicationItemBinding
    ) : RecyclerView.ViewHolder(binding.root) {

        private var listener: ApplicationItemListener? = null


        fun bind(item: AppInfo) {
            binding.apply {
                icon.load(item.icon)
                label.text = item.label
            }
            listener?.let {
                binding.root.setOnClickListener { _ ->
                    it.itemClicked(item)
                }
            }
        }

        fun setOnItemChangedListener(listener: ApplicationItemListener) {
            this.listener = listener
        }

    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val layoutInflater = LayoutInflater.from(parent.context)
        val binding = GridApplicationItemBinding.inflate(layoutInflater, parent, false)
        return ViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        holder.setOnItemChangedListener(applicationItemListener)
        holder.bind(items[position])
    }

    override fun getItemCount(): Int {
        return items.count()
    }

    fun submitData(items: List<AppInfo>) {
        val callback = DiffUtil.calculateDiff(
            DifferAppInfo(items, this.items)
        )
        callback.dispatchUpdatesTo(this)
        this.items.clear()
        this.items.addAll(items)
    }
}