import { NavLink } from 'react-router-dom'

const PENGAMPU = [
  { to: '/', icon: '⌂', label: 'Beranda', end: true },
  { to: '/input', icon: '✎', label: 'Input', end: false },
]
const GUARDIAN = [
  { to: '/', icon: '▦', label: 'Dashboard', end: true },
  { to: '/kelola', icon: '⚙', label: 'Kelola', end: false },
  { to: '/cetak', icon: '⎙', label: 'Cetak', end: false },
]

export function NavBar({ role }: { role: 'guardian' | 'pengampu' }) {
  const items = role === 'guardian' ? GUARDIAN : PENGAMPU
  return (
    <nav className="fixed left-0 right-0 bottom-0 z-30 flex bg-white border-t border-gray-200 pt-1.5 pb-5 no-print">
      {items.map((it) => (
        <NavLink
          key={it.to}
          to={it.to}
          end={it.end}
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center gap-0.5 text-[11px] font-semibold ${
              isActive ? 'text-teal-700' : 'text-gray-500'
            }`
          }
        >
          <span className="text-xl leading-none">{it.icon}</span>
          {it.label}
        </NavLink>
      ))}
    </nav>
  )
}
