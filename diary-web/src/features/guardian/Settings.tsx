import { useSession } from '@/auth/SessionProvider'

export default function Settings() {
  const { state, setTrusted } = useSession()
  const trusted = state.trusted

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <h2 className="text-xl font-bold text-purple-800">Pengaturan</h2>

      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold text-purple-800">Perangkat orang tua</p>
            <p className="mt-1 text-sm text-purple-500">
              Ingat sesi orang tua di perangkat ini — tidak perlu login lagi
              setiap membuka aplikasi. Nyalakan hanya di perangkat pribadi Anda.
            </p>
          </div>
          <button
            role="switch"
            aria-checked={trusted}
            onClick={() => setTrusted(!trusted)}
            className={
              'relative h-7 w-12 shrink-0 rounded-full transition ' +
              (trusted ? 'bg-purple-600' : 'bg-purple-200')
            }
          >
            <span
              className={
                'absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ' +
                (trusted ? 'left-[22px]' : 'left-0.5')
              }
            />
          </button>
        </div>
      </div>
    </div>
  )
}
