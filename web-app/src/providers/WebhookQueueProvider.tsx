import { useEffect, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useModelProvider } from '@/hooks/useModelProvider'
import { useThreads } from '@/hooks/useThreads'
import { useChat } from '@/hooks/useChat'
import { useAppState } from '@/hooks/useAppState'
import { defaultModel } from '@/lib/models'

export function WebhookQueueProvider() {
  const { selectedProvider, selectedModel } = useModelProvider()
  const { createThread, setCurrentThreadId } = useThreads()
  const { sendMessage } = useChat()
  const { streamingContent } = useAppState()
  const processingRef = useRef(false)

  useEffect(() => {
    if (!streamingContent && processingRef.current) {
      processingRef.current = false
    }
  }, [streamingContent])

  useEffect(() => {
    const interval = setInterval(async () => {
      if (processingRef.current) return
      if (useAppState.getState().streamingContent) return
      try {
        const lead = await invoke<string | null>('get_next_lead')
        if (lead) {
          processingRef.current = true
          const thread = await createThread(
            {
              id: selectedModel?.id ?? defaultModel(selectedProvider),
              provider: selectedProvider,
            },
            'Webhook Lead'
          )
          setCurrentThreadId(thread.id)
          sendMessage(lead, false)
        }
      } catch (e) {
        console.error('Failed to process webhook lead:', e)
      }
    }, 3000)
    return () => clearInterval(interval)
  }, [createThread, selectedProvider, selectedModel, setCurrentThreadId, sendMessage])

  return null
}
