import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

export function Header({
  title,
  back,
  right,
}: {
  title: string
  back?: string | number
  right?: ReactNode
}) {
  const nav = useNavigate()
  return (
    <div className="flex items-center gap-2 px-4 pt-3 pb-2">
      {back !== undefined && (
        <button
          className="text-2xl text-teal-700 px-1"
          aria-label="Kembali"
          onClick={() => (typeof back === 'number' ? nav(back) : nav(back))}
        >
          ‹
        </button>
      )}
      <h1 className="text-2xl font-extrabold tracking-tight flex-1">{title}</h1>
      {right}
    </div>
  )
}

export function BigButton({
  children,
  onClick,
  disabled,
  secondary,
  danger,
  type = 'button',
}: {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  secondary?: boolean
  danger?: boolean
  type?: 'button' | 'submit'
}) {
  const cls = danger
    ? 'bg-orange-50 text-orange-700'
    : secondary
      ? 'bg-teal-50 text-teal-700'
      : 'bg-teal-700 text-white'
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`w-full rounded-2xl p-3.5 font-bold text-base ${cls} disabled:bg-gray-300 disabled:text-white`}
    >
      {children}
    </button>
  )
}

export function Card({
  children,
  className = '',
  onClick,
}: {
  children: ReactNode
  className?: string
  onClick?: () => void
}) {
  return (
    <div
      onClick={onClick}
      className={`bg-white border border-gray-200 rounded-2xl p-3.5 ${className}`}
    >
      {children}
    </div>
  )
}

export function Pill({
  children,
  tone = 'teal',
}: {
  children: ReactNode
  tone?: 'teal' | 'gray' | 'warn'
}) {
  const map = {
    teal: 'bg-teal-50 text-teal-700',
    gray: 'bg-gray-100 text-gray-500',
    warn: 'bg-orange-50 text-orange-700',
  }
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${map[tone]}`}>
      {children}
    </span>
  )
}

export function Toast({ message }: { message: string }) {
  return (
    <div className="fixed left-4 right-4 bottom-24 z-50 mx-auto max-w-md bg-gray-900 text-white px-4 py-3 rounded-xl text-sm shadow-lg">
      {message}
    </div>
  )
}

export function Spinner({ label = 'Memuat…' }: { label?: string }) {
  return <div className="p-8 text-center text-gray-500">{label}</div>
}
