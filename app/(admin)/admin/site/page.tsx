"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"

import { SectionHeader } from "@/components/admin/section-header"
import { useAdminConfig } from "@/hooks/use-admin-config"
import type { AdminConfig } from "@/lib/admin.types"
import { Spinner } from "@/components/ui/spinner"

type SiteForm = AdminConfig["SiteConfig"]

async function postSiteConfig(body: SiteForm) {
  const res = await fetch("/api/admin/site", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error ?? "保存失败")
  }
}

const doubanOptions = [
  { value: "direct", label: "直连" },
  { value: "cors-proxy-zwei", label: "Cors Proxy by Zwei" },
  { value: "cmliussss-cdn-tencent", label: "豆瓣 CDN (腾讯云)" },
  { value: "cmliussss-cdn-ali", label: "豆瓣 CDN (阿里云)" },
  { value: "custom", label: "自定义" },
]

const doubanImageOptions = [
  { value: "direct", label: "直连" },
  { value: "server", label: "服务器代理" },
  { value: "img3", label: "豆瓣官方 CDN" },
  { value: "cmliussss-cdn-tencent", label: "豆瓣 CDN (腾讯云)" },
  { value: "cmliussss-cdn-ali", label: "豆瓣 CDN (阿里云)" },
  { value: "custom", label: "自定义" },
]

export default function SitePage() {
  const { data, loading, error, refresh } = useAdminConfig()
  const siteConfig = data?.Config.SiteConfig
  const [form, setForm] = useState<SiteForm | null>(siteConfig ?? null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (siteConfig) setForm(siteConfig)
  }, [siteConfig])

  const save = async () => {
    if (!form) return
    try {
      setSaving(true)
      await postSiteConfig(form)
      toast.success("站点配置已保存")
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "保存失败")
    } finally {
      setSaving(false)
    }
  }

  if (loading || !form) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        {error ? (
          <div className="space-y-3 text-center">
            <p className="text-sm text-destructive">加载失败：{error}</p>
            <Button variant="outline" onClick={refresh}>
              重试
            </Button>
          </div>
        ) : (
          <Spinner />
        )}
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <SectionHeader
        title="站点设置"
        description="配置站点名称、公告、搜索策略与豆瓣代理。"
        action={
          <Button onClick={save} disabled={saving}>
            {saving ? "保存中..." : "保存"}
          </Button>
        }
      />

      <Card className="space-y-6 p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="SiteName">站点名称</Label>
            <Input
              id="SiteName"
              value={form.SiteName}
              onChange={(e) => setForm({ ...form, SiteName: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="SearchDownstreamMaxPage">搜索可拉取最大页数</Label>
            <Input
              id="SearchDownstreamMaxPage"
              type="number"
              min={1}
              value={form.SearchDownstreamMaxPage}
              onChange={(e) =>
                setForm({ ...form, SearchDownstreamMaxPage: Number(e.target.value) || 1 })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="SiteInterfaceCacheTime">接口缓存时间（秒）</Label>
            <Input
              id="SiteInterfaceCacheTime"
              type="number"
              min={0}
              value={form.SiteInterfaceCacheTime}
              onChange={(e) =>
                setForm({ ...form, SiteInterfaceCacheTime: Number(e.target.value) || 0 })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>流式搜索</Label>
            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <span className="text-sm text-muted-foreground">开启后搜索结果会实时推送。</span>
              <Switch
                checked={form.FluidSearch}
                onCheckedChange={(val) => setForm({ ...form, FluidSearch: val })}
              />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="Announcement">站点公告</Label>
          <Textarea
            id="Announcement"
            rows={4}
            value={form.Announcement}
            onChange={(e) => setForm({ ...form, Announcement: e.target.value })}
          />
        </div>
      </Card>

      <SectionHeader title="豆瓣配置" />
      <Card className="space-y-6 p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>豆瓣数据代理</Label>
            <Select
              value={form.DoubanProxyType}
              onValueChange={(val) => setForm({ ...form, DoubanProxyType: val })}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择数据代理" />
              </SelectTrigger>
              <SelectContent>
                {doubanOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {form.DoubanProxyType === "custom" && (
            <div className="space-y-2">
              <Label htmlFor="DoubanProxy">自定义代理地址</Label>
              <Input
                id="DoubanProxy"
                value={form.DoubanProxy}
                onChange={(e) => setForm({ ...form, DoubanProxy: e.target.value })}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>豆瓣图片代理</Label>
            <Select
              value={form.DoubanImageProxyType}
              onValueChange={(val) => setForm({ ...form, DoubanImageProxyType: val })}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择图片代理" />
              </SelectTrigger>
              <SelectContent>
                {doubanImageOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {form.DoubanImageProxyType === "custom" && (
            <div className="space-y-2">
              <Label htmlFor="DoubanImageProxy">自定义图片代理地址</Label>
              <Input
                id="DoubanImageProxy"
                value={form.DoubanImageProxy}
                onChange={(e) => setForm({ ...form, DoubanImageProxy: e.target.value })}
              />
            </div>
          )}
        </div>

        <Separator />
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex items-center justify-between rounded-md border px-3 py-2">
            <div>
              <p className="text-sm font-medium">成人内容过滤</p>
              <p className="text-xs text-muted-foreground">关闭后将显示成人源与内容。</p>
            </div>
            <Switch
              checked={!form.DisableYellowFilter}
              onCheckedChange={(val) => setForm({ ...form, DisableYellowFilter: !val })}
            />
          </div>
        </div>
      </Card>
    </div>
  )
}
