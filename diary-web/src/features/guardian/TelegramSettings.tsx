import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from '@/auth/SessionProvider'
import { useApi } from '@/features/shared/hooks'
import { Button, TextInput } from '@/features/shared/ui'

export default function TelegramSettings() {
  const api = useApi()
  const qc = useQueryClient()
  const { state } = useSession()
  const linked = state.me?.role === 'guardian' ? state.me.telegram_linked : false
  const [deepLink, setDeepLink] = useState<string | null>(null)

  const config = useQuery({
    queryKey: ['telegram-config'],
    queryFn: () => api.telegramConfig(),
  })
  const [username, setUsername] = useState('')
  useEffect(() => {
    if (config.data) setUsername(config.data.bot_username)
  }, [config.data])

  const configured = (config.data?.bot_username ?? '').length > 0

  const saveConfig = useMutation({
    mutationFn: () => api.setTelegramConfig(username.trim().replace(/^@/, '')),
    onSuccess: (data) => {
      qc.setQueryData(['telegram-config'], data)
      setUsername(data.bot_username)
    },
  })

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
        <p className="mb-2 text-sm font-medium text-purple-700">
          Username bot Telegram
        </p>
        <p className="mb-3 text-xs text-purple-400">
          Buat bot lewat @BotFather, lalu masukkan username-nya di sini (mis.
          ruangcerita_bot).
        </p>
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <TextInput
              placeholder="username_bot"
              value={username}
              autoCapitalize="none"
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <Button
            onClick={() => saveConfig.mutate()}
            disabled={saveConfig.isPending || !username.trim()}
          >
            {saveConfig.isPending ? 'Menyimpan…' : 'Simpan'}
          </Button>
        </div>
      </div>

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
          <Button
            onClick={() => link.mutate()}
            disabled={link.isPending || !configured}
          >
            {linked ? 'Hubungkan ulang' : 'Hubungkan Telegram'}
          </Button>
          {!configured && (
            <p className="text-center text-sm text-purple-400">
              Isi username bot Telegram dulu untuk menghubungkan.
            </p>
          )}
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
