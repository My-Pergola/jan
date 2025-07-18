import { createFileRoute } from '@tanstack/react-router'
import { route } from '@/constants/routes'
import HeaderPage from '@/containers/HeaderPage'
import SettingsMenu from '@/containers/SettingsMenu'
import { Card, CardItem } from '@/containers/Card'
import { PortInput } from '@/containers/PortInput'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { useWebhook } from '@/hooks/useWebhook'
import { useAppState } from '@/hooks/useAppState'
import { useTranslation } from '@/i18n/react-i18next-compat'
import { useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'

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
        <HeaderPage title={t('common:webhook-server')} />
        <Card>
          <CardItem title="Port">
            <PortInput port={port} setPort={setPort} />
          </CardItem>
          <CardItem title="Run on Startup">
            <Switch checked={runOnStartup} onCheckedChange={setRunOnStartup} />
          </CardItem>
          <CardItem>
            <Button onClick={toggleServer} variant="secondary">
              {isServerRunning ? 'Stop Server' : 'Start Server'}
            </Button>
          </CardItem>
        </Card>
      </div>
    </div>
  )
}

export default WebhookServer
