"use client"

import { useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Switch } from "@/components/ui/switch"
import { Card } from "@/components/ui/card"
import { toast } from "sonner"

import { SectionHeader } from "@/components/admin/section-header"
import { useAdminConfig } from "@/hooks/use-admin-config"
import type { AdminConfig } from "@/lib/admin.types"
import { Spinner } from "@/components/ui/spinner"

type LiveEntry = NonNullable<AdminConfig["LiveConfig"]>[number]

async function postLive(body: Record<string, unknown>) {
  const res = await fetch("/api/admin/live", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error ?? "操作失败")
  }
}

export default function LivePage() {
  const { data, loading, error, refresh } = useAdminConfig()
  const liveSources = useMemo(() => data?.Config.LiveConfig ?? [], [data])
  const liveKey = useMemo(() => liveSources.map((s) => s.key).join("|"), [liveSources])
  const [addOpen, setAddOpen] = useState(false)
  const [newLive, setNewLive] = useState({
    name: "",
    key: "",
    url: "",
    epg: "",
    ua: "",
  })

  const [editTarget, setEditTarget] = useState<LiveEntry | null>(null)
  const [editLive, setEditLive] = useState(newLive)

  const handleAdd = async () => {
    try {
      await postLive({
        action: "add",
        key: newLive.key.trim(),
        name: newLive.name.trim(),
        url: newLive.url.trim(),
        epg: newLive.epg.trim(),
        ua: newLive.ua.trim(),
      })
      toast.success("已添加直播源")
      setAddOpen(false)
      setNewLive({ name: "", key: "", url: "", epg: "", ua: "" })
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "添加失败")
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
        title="直播源"
        description="管理直播 M3U 源及节目单，支持启用、禁用、排序与编辑。"
        action={
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button>添加直播源</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>添加直播源</DialogTitle>
                <DialogDescription>填写名称、唯一 key 以及 m3u 地址。</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <Input
                  placeholder="名称"
                  value={newLive.name}
                  onChange={(e) => setNewLive((prev) => ({ ...prev, name: e.target.value }))}
                />
                <Input
                  placeholder="唯一 key"
                  value={newLive.key}
                  onChange={(e) => setNewLive((prev) => ({ ...prev, key: e.target.value }))}
                />
                <Input
                  placeholder="M3U 地址"
                  value={newLive.url}
                  onChange={(e) => setNewLive((prev) => ({ ...prev, url: e.target.value }))}
                />
                <Input
                  placeholder="节目单 EPG (可选)"
                  value={newLive.epg}
                  onChange={(e) => setNewLive((prev) => ({ ...prev, epg: e.target.value }))}
                />
                <Input
                  placeholder="自定义 UA (可选)"
                  value={newLive.ua}
                  onChange={(e) => setNewLive((prev) => ({ ...prev, ua: e.target.value }))}
                />
              </div>
              <DialogFooter>
                <Button
                  onClick={handleAdd}
                  disabled={!newLive.name.trim() || !newLive.key.trim() || !newLive.url.trim()}
                >
                  保存
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <LiveTable
        key={liveKey}
        sources={liveSources}
        refresh={refresh}
        onEdit={(source) => {
          setEditTarget(source)
          setEditLive({
            name: source.name,
            key: source.key,
            url: source.url,
            epg: source.epg ?? "",
            ua: source.ua ?? "",
          })
        }}
      />

      {/* 编辑直播源 */}
      <Dialog open={Boolean(editTarget)} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑直播源</DialogTitle>
            <DialogDescription>仅自定义源可编辑。</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="名称"
              value={editLive.name}
              onChange={(e) => setEditLive((prev) => ({ ...prev, name: e.target.value }))}
            />
            <Input value={editLive.key} disabled />
            <Input
              placeholder="M3U 地址"
              value={editLive.url}
              onChange={(e) => setEditLive((prev) => ({ ...prev, url: e.target.value }))}
            />
            <Input
              placeholder="节目单 EPG"
              value={editLive.epg}
              onChange={(e) => setEditLive((prev) => ({ ...prev, epg: e.target.value }))}
            />
            <Input
              placeholder="自定义 UA"
              value={editLive.ua}
              onChange={(e) => setEditLive((prev) => ({ ...prev, ua: e.target.value }))}
            />
          </div>
          <DialogFooter>
            <Button
              onClick={async () => {
                if (!editTarget) return
                try {
                  await postLive({
                    action: "edit",
                    key: editTarget.key,
                    name: editLive.name.trim(),
                    url: editLive.url.trim(),
                    epg: editLive.epg.trim(),
                    ua: editLive.ua.trim(),
                  })
                  toast.success("已更新直播源")
                  setEditTarget(null)
                  refresh()
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "更新失败")
                }
              }}
              disabled={!editLive.name.trim() || !editLive.url.trim()}
            >
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function LiveTable({
  sources,
  refresh,
  onEdit,
}: {
  sources: LiveEntry[]
  refresh: () => void
  onEdit: (source: LiveEntry) => void
}) {
  const [localSources, setLocalSources] = useState<LiveEntry[]>(sources)
  const [orderDirty, setOrderDirty] = useState(false)

  const handleToggleEnable = async (source: LiveEntry) => {
    try {
      await postLive({
        action: source.disabled ? "enable" : "disable",
        key: source.key,
      })
      toast.success(source.disabled ? "已启用" : "已禁用")
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "操作失败")
    }
  }

  const handleDelete = async (source: LiveEntry) => {
    try {
      await postLive({ action: "delete", key: source.key })
      toast.success("已删除直播源")
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "删除失败")
    }
  }

  const moveRow = (index: number, delta: number) => {
    const next = [...localSources]
    const targetIndex = index + delta
    if (targetIndex < 0 || targetIndex >= next.length) return
    ;[next[index], next[targetIndex]] = [next[targetIndex], next[index]]
    setLocalSources(next)
    setOrderDirty(true)
  }

  const saveOrder = async () => {
    try {
      await postLive({ action: "sort", order: localSources.map((s) => s.key) })
      toast.success("排序已保存")
      setOrderDirty(false)
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "保存失败")
    }
  }

  return (
    <>
      <Card className="border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>名称</TableHead>
              <TableHead>Key</TableHead>
              <TableHead>地址</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>信息</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {localSources.map((source, index) => (
              <TableRow key={source.key}>
                <TableCell className="font-medium">{source.name}</TableCell>
                <TableCell>{source.key}</TableCell>
                <TableCell className="max-w-[240px] truncate text-sm text-muted-foreground">
                  {source.url}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={!source.disabled}
                      onCheckedChange={() => handleToggleEnable(source)}
                    />
                    <span className="text-sm text-muted-foreground">
                      {source.disabled ? "已禁用" : "启用中"}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="space-y-1">
                  <Badge variant="outline">{source.from === "config" ? "预设" : "自定义"}</Badge>
                  <p className="text-xs text-muted-foreground">
                    频道数：{source.channelNumber ?? 0}
                  </p>
                </TableCell>
                <TableCell className="space-x-1 text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => moveRow(index, -1)}
                    disabled={index === 0}
                  >
                    上移
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => moveRow(index, 1)}
                    disabled={index === localSources.length - 1}
                  >
                    下移
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={source.from === "config"}
                    onClick={() => onEdit(source)}
                  >
                    编辑
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={source.from === "config"}
                    onClick={() => handleDelete(source)}
                  >
                    删除
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {localSources.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                  暂无直播源
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={saveOrder} disabled={!orderDirty}>
          保存排序
        </Button>
        {!orderDirty && <p className="text-sm text-muted-foreground">移动顺序后记得保存</p>}
      </div>
    </>
  )
}
