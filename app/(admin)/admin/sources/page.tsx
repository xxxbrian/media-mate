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
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"

import { SectionHeader } from "@/components/admin/section-header"
import { useAdminConfig } from "@/hooks/use-admin-config"
import type { AdminConfig } from "@/lib/admin.types"
import { Spinner } from "@/components/ui/spinner"

type SourceEntry = AdminConfig["SourceConfig"][number]

async function postSource(body: Record<string, unknown>) {
  const res = await fetch("/api/admin/source", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error ?? "操作失败")
  }
}

export default function SourcesPage() {
  const { data, loading, error, refresh } = useAdminConfig()
  const [addOpen, setAddOpen] = useState(false)
  const [newSource, setNewSource] = useState({
    name: "",
    key: "",
    api: "",
    detail: "",
    isAdult: false,
  })

  const sources = useMemo(() => data?.Config.SourceConfig ?? [], [data])
  const sourcesKey = useMemo(() => sources.map((s) => s.key).join("|"), [sources])

  const handleAdd = async () => {
    try {
      await postSource({
        action: "add",
        key: newSource.key.trim(),
        name: newSource.name.trim(),
        api: newSource.api.trim(),
        detail: newSource.detail.trim() || undefined,
        is_adult: newSource.isAdult,
      })
      toast.success("已添加视频源")
      setAddOpen(false)
      setNewSource({ name: "", key: "", api: "", detail: "", isAdult: false })
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
        title="视频源"
        description="管理可用的视频采集源，控制开启、禁用、成人标记与排序。"
        action={
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button>添加视频源</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>添加视频源</DialogTitle>
                <DialogDescription>填入 key、名称和 api 地址。</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Input
                    placeholder="名称"
                    value={newSource.name}
                    onChange={(e) => setNewSource((prev) => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Input
                    placeholder="唯一 key"
                    value={newSource.key}
                    onChange={(e) => setNewSource((prev) => ({ ...prev, key: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Input
                    placeholder="API 地址"
                    value={newSource.api}
                    onChange={(e) => setNewSource((prev) => ({ ...prev, api: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Input
                    placeholder="Detail (可选)"
                    value={newSource.detail}
                    onChange={(e) => setNewSource((prev) => ({ ...prev, detail: e.target.value }))}
                  />
                </div>
                <div className="flex items-center justify-between rounded-md border px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">标记成人资源</p>
                    <p className="text-xs text-muted-foreground">开启后将纳入成人过滤策略。</p>
                  </div>
                  <Switch
                    checked={newSource.isAdult}
                    onCheckedChange={(val) => setNewSource((prev) => ({ ...prev, isAdult: val }))}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={handleAdd}
                  disabled={!newSource.name.trim() || !newSource.key.trim() || !newSource.api.trim()}
                >
                  保存
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <SourcesTable key={sourcesKey} sources={sources} refresh={refresh} />

      <Separator />
      <p className="text-sm text-muted-foreground">
        预设源来自配置文件，不可删除但可禁用。排序将影响搜索时的展示优先级。
      </p>
    </div>
  )
}

function SourcesTable({ sources, refresh }: { sources: SourceEntry[]; refresh: () => void }) {
  const [localSources, setLocalSources] = useState<SourceEntry[]>(sources)
  const [orderDirty, setOrderDirty] = useState(false)

  const handleToggleEnable = async (source: SourceEntry) => {
    try {
      await postSource({
        action: source.disabled ? "enable" : "disable",
        key: source.key,
      })
      toast.success(source.disabled ? "已启用" : "已禁用")
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "操作失败")
    }
  }

  const handleToggleAdult = async (source: SourceEntry, next: boolean) => {
    try {
      await postSource({
        action: "update_adult",
        key: source.key,
        is_adult: next,
      })
      toast.success("标记已更新")
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "操作失败")
    }
  }

  const handleDelete = async (source: SourceEntry) => {
    try {
      await postSource({ action: "delete", key: source.key })
      toast.success("已删除")
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
      await postSource({
        action: "sort",
        order: localSources.map((s) => s.key),
      })
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
              <TableHead>API</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>标签</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {localSources.map((source, index) => (
              <TableRow key={source.key}>
                <TableCell className="font-medium">{source.name}</TableCell>
                <TableCell>{source.key}</TableCell>
                <TableCell className="max-w-[280px] truncate text-sm text-muted-foreground">
                  {source.api}
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
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={Boolean(source.is_adult)}
                      onCheckedChange={(val) => handleToggleAdult(source, val)}
                    />
                    <span className="text-xs text-muted-foreground">成人</span>
                  </div>
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
                  暂无视频源
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
        {!orderDirty && <p className="text-sm text-muted-foreground">上下移动后记得保存</p>}
      </div>
    </>
  )
}
