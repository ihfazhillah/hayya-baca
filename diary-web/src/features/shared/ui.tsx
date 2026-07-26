import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'

export function Avatar({
  name,
  color,
  size = 48,
}: {
  name: string
  color: string
  size?: number
}) {
  const initial = name.trim().charAt(0).toUpperCase() || '?'
  return (
    <span
      className="inline-flex items-center justify-center rounded-full font-bold text-white"
      style={{ backgroundColor: color, width: size, height: size, fontSize: size / 2.4 }}
      aria-hidden
    >
      {initial}
    </span>
  )
}

export function Button({
  children,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={
        'rounded-2xl bg-purple-600 px-5 py-3 text-lg font-semibold text-white ' +
        'shadow-sm transition active:scale-95 disabled:opacity-50 ' +
        className
      }
      {...props}
    >
      {children}
    </button>
  )
}

export function TextInput({
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={
        'w-full rounded-2xl border-2 border-purple-200 bg-white px-4 py-3 ' +
        'text-lg outline-none focus:border-purple-500 ' +
        className
      }
      {...props}
    />
  )
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null
  return <p className="text-center text-sm font-medium text-red-600">{children}</p>
}

export function Card({ children }: { children: ReactNode }) {
  return (
    <div className="w-full max-w-sm rounded-3xl bg-white/90 p-6 shadow-lg">
      {children}
    </div>
  )
}
