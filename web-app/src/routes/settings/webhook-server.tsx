import { createFileRoute } from '@tanstack/react-router'
import { route } from '@/constants/routes'
import HeaderPage from '@/containers/HeaderPage'
import SettingsMenu from '@/containers/SettingsMenu'
import { Card, CardItem } from '@/containers/Card'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { useWebhook } from '@/hooks/useWebhook'
import { useAppState } from '@/hooks/useAppState'
import { useTranslation } from '@/i18n/react-i18next-compat'
import { useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Route = createFileRoute(route.settings.webhook_server as any)({
  component: WebhookServer,
})

function WebhookServer() {
  const { t } = useTranslation()
  const { port, setPort, runOnStartup, setRunOnStartup } = useWebhook()
  const { webhookServerStatus, setWebhookServerStatus } = useAppState()

  useEffect(() => {
    // placeholder to check status later
  }, [])

  const toggleServer = async () => {
    setWebhookServerStatus('pending')
    if (webhookServerStatus === 'stopped') {
      await invoke('start_webhook_server', { port })
        .then(() => setWebhookServerStatus('running'))
        .catch(() => setWebhookServerStatus('stopped'))
    } else {
      await invoke('stop_webhook_server')
        .catch(() => {})
      setWebhookServerStatus('stopped')
    }
  }

  const isServerRunning = webhookServerStatus === 'running'

  return (
    <div className="flex h-full">
      <SettingsMenu />
      <div className="flex-1 overflow-y-auto p-4">
        <HeaderPage>
          <h1 className="font-medium">{t('common:webhook-server')}</h1>
        </HeaderPage>
        <Card>
          <CardItem
            title="Port"
            actions={
              <Input
                type="number"
                min={0}
                max={65535}
                value={port}
                onChange={(e) => setPort(parseInt(e.target.value) || 0)}
                className="w-24 h-8 text-sm"
              />
            }
          />
          <CardItem
            title="Run on Startup"
            actions={<Switch checked={runOnStartup} onCheckedChange={setRunOnStartup} />}
          />
          <CardItem
            actions={
              <Button
                onClick={toggleServer}
                variant={isServerRunning ? 'destructive' : 'default'}
              >
                {isServerRunning ? 'Stop Server' : 'Start Server'}
              </Button>
            }
          />
        </Card>
      </div>
    </div>
  )
}

export default WebhookServer
