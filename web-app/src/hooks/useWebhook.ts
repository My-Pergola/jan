import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { localStorageKey } from '@/constants/localStorage'

export const useWebhook = create<{
  runOnStartup: boolean
  setRunOnStartup: (v: boolean) => void
  port: number
  setPort: (n: number) => void
}>()(
  persist(
    (set) => ({
      runOnStartup: false,
      setRunOnStartup: (v) => set({ runOnStartup: v }),
      port: 8080,
      setPort: (n) => set({ port: n }),
    }),
    { name: localStorageKey.settingWebhookServer, storage: createJSONStorage(() => localStorage) }
  )
)
