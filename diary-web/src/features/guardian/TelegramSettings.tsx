import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useSession } from '@/auth/SessionProvider'
import { useApi } from '@/features/shared/hooks'
import { Button } from '@/features/shared/ui'

export default function TelegramSettings() {
  const api = useApi()
  const { state } = useSession()
  const linked = state.me?.role === 'guardian' ? state.me.telegram_linked : false
  const [deepLink, setDeepLink] = useState<string | null>(null)

  const link = useMutation({
    mutationFn: () => api.telegramLink(),
    onSuccess: (data) => {
      setDeepLink(data.deep_link)
      window.open(data.deep_link, '_blank', 'noopener')
    },
  })

  const unlink = useMutation({
    mutationFn: () => api.telegramUnlink(),
    onSuccess: () => setDeepLink(null),
  })

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <h2 className="text-xl font-bold text-purple-800">Notifikasi Telegram</h2>
      <p className="text-sm text-purple-500">
        Dapatkan kabar saat anak menulis cerita baru atau membalas — hanya nama,
        jenis, dan cuplikan singkat. Isi lengkap tetap hanya di aplikasi.
      </p>

      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <p className="mb-3 text-sm">
          Status:{' '}
          <span
            className={linked ? 'font-semibold text-green-600' : 'text-purple-400'}
          >
            {linked ? 'Terhubung' : 'Belum terhubung'}
          </span>
        </p>
        <div className="flex flex-col gap-2">
          <Button onClick={() => link.mutate()} disabled={link.isPending}>
            {linked ? 'Hubungkan ulang' : 'Hubungkan Telegram'}
          </Button>
          {deepLink && (
            <a
              href={deepLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-center text-sm text-purple-500 underline"
            >
              Buka bot Telegram, lalu tekan Start
            </a>
          )}
          {linked && (
            <button
              onClick={() => unlink.mutate()}
              disabled={unlink.isPending}
              className="text-sm text-red-500"
            >
              Putuskan
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
