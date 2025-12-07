"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"

import { SectionHeader } from "@/components/admin/section-header"
import { useAdminConfig } from "@/hooks/use-admin-config"
import { Spinner } from "@/components/ui/spinner"

async function postConfigFile(body: {
  configFile: string
  subscriptionUrl: string
  autoUpdate: boolean
  lastCheckTime: string
}) {
  const res = await fetch("/api/admin/config_file", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error ?? "保存失败")
  }
}

export default function ConfigFilePage() {
  const { data, loading, error, refresh } = useAdminConfig()
  const config = data?.Config
  const [content, setContent] = useState("")
  const [subscriptionUrl, setSubscriptionUrl] = useState("")
  const [autoUpdate, setAutoUpdate] = useState(false)
  const [lastCheck, setLastCheck] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!config) return
    setContent(config.ConfigFile || "")
    setSubscriptionUrl(config.ConfigSubscribtion?.URL || "")
    setAutoUpdate(Boolean(config.ConfigSubscribtion?.AutoUpdate))
    setLastCheck(config.ConfigSubscribtion?.LastCheck || "")
  }, [config])

  const save = async () => {
    try {
      setSaving(true)
      await postConfigFile({
        configFile: content,
        subscriptionUrl,
        autoUpdate,
        lastCheckTime: new Date().toISOString(),
      })
      toast.success("配置文件已保存")
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "保存失败")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Spinner />
      </div>
    )
  }

  if (error) {
    return (
      <Card className="p-6">
        <p className="text-sm text-destructive">加载失败：{error}</p>
        <Button variant="outline" className="mt-3" onClick={refresh}>
          重试
        </Button>
      </Card>
    )
  }

  return (
    <div className="space-y-8">
      <SectionHeader
        title="配置文件"
        description="仅站长可编辑。清空后将移除配置文件里的预设视频源。"
        action={
          <Button onClick={save} disabled={saving}>
            {saving ? "保存中..." : "保存"}
          </Button>
        }
      />

      <Card className="space-y-6 p-6">
        <div className="space-y-2">
          <Label htmlFor="subscription">订阅 URL</Label>
          <Input
            id="subscription"
            value={subscriptionUrl}
            onChange={(e) => setSubscriptionUrl(e.target.value)}
            placeholder="https://example.com/config.json"
          />
          <p className="text-xs text-muted-foreground">用于自动拉取配置的订阅地址，需站长权限。</p>
        </div>

        <div className="flex items-center justify-between rounded-md border px-3 py-2">
          <div>
            <p className="text-sm font-medium">自动更新</p>
            <p className="text-xs text-muted-foreground">
              启用后将定期从订阅地址拉取最新配置。
            </p>
          </div>
          <Switch checked={autoUpdate} onCheckedChange={setAutoUpdate} />
        </div>

        <div className="grid gap-3">
          <Label htmlFor="configFile">配置内容 (JSON)</Label>
          <Textarea
            id="configFile"
            rows={14}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            spellCheck={false}
          />
          <p className="text-xs text-muted-foreground">
            提交前请确认 JSON 格式正确；为空将清空预设源（自定义源保留）。
          </p>
        </div>

        <div className="text-xs text-muted-foreground">
          上次订阅拉取：{lastCheck ? new Date(lastCheck).toLocaleString() : "未记录"}
        </div>
      </Card>
    </div>
  )
}
