import { useState } from 'react'
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

// Password field with a show/hide toggle. Same look as TextInput, with an eye
// button on the right that flips the input between password and text.
export function PasswordInput({
  className = '',
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative w-full">
      <input
        type={show ? 'text' : 'password'}
        className={
          'w-full rounded-2xl border-2 border-purple-200 bg-white py-3 pl-4 pr-12 ' +
          'text-lg outline-none focus:border-purple-500 ' +
          className
        }
        {...props}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? 'Sembunyikan kata sandi' : 'Lihat kata sandi'}
        aria-pressed={show}
        className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-xl text-purple-400"
      >
        {show ? '🙈' : '👁️'}
      </button>
    </div>
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
