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

type CategoryEntry = AdminConfig["CustomCategories"][number]

async function postCategory(body: Record<string, unknown>) {
  const res = await fetch("/api/admin/category", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error ?? "操作失败")
  }
}

export default function CategoriesPage() {
  const { data, loading, error, refresh } = useAdminConfig()
  const categories = useMemo(() => data?.Config.CustomCategories ?? [], [data])
  const catKey = useMemo(() => categories.map((c) => `${c.query}:${c.type}`).join("|"), [categories])

  const [addOpen, setAddOpen] = useState(false)
  const [newCat, setNewCat] = useState({ name: "", type: "movie", query: "" })

  const handleAdd = async () => {
    try {
      await postCategory({
        action: "add",
        name: newCat.name.trim(),
        type: newCat.type,
        query: newCat.query.trim(),
      })
      toast.success("已添加分类")
      setAddOpen(false)
      setNewCat({ name: "", type: "movie", query: "" })
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
        title="自定义分类"
        description="为搜索构建快捷分类入口，可设置电影或电视剧类型。"
        action={
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button>添加分类</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>添加分类</DialogTitle>
                <DialogDescription>填写名称、类型与搜索关键词。</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <Input
                  placeholder="名称"
                  value={newCat.name}
                  onChange={(e) => setNewCat((prev) => ({ ...prev, name: e.target.value }))}
                />
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={newCat.type}
                  onChange={(e) => setNewCat((prev) => ({ ...prev, type: e.target.value }))}
                >
                  <option value="movie">电影</option>
                  <option value="tv">电视剧</option>
                </select>
                <Input
                  placeholder="搜索关键词 query"
                  value={newCat.query}
                  onChange={(e) => setNewCat((prev) => ({ ...prev, query: e.target.value }))}
                />
              </div>
              <DialogFooter>
                <Button
                  onClick={handleAdd}
                  disabled={!newCat.name.trim() || !newCat.query.trim()}
                >
                  保存
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <CategoriesTable key={catKey} categories={categories} refresh={refresh} />
    </div>
  )
}

function CategoriesTable({
  categories,
  refresh,
}: {
  categories: CategoryEntry[]
  refresh: () => void
}) {
  const [localCats, setLocalCats] = useState<CategoryEntry[]>(categories)
  const [orderDirty, setOrderDirty] = useState(false)

  const handleToggleEnable = async (cat: CategoryEntry) => {
    try {
      await postCategory({
        action: cat.disabled ? "enable" : "disable",
        query: cat.query,
        type: cat.type,
      })
      toast.success(cat.disabled ? "已启用" : "已禁用")
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "操作失败")
    }
  }

  const handleDelete = async (cat: CategoryEntry) => {
    try {
      await postCategory({ action: "delete", query: cat.query, type: cat.type })
      toast.success("已删除分类")
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "删除失败")
    }
  }

  const moveRow = (index: number, delta: number) => {
    const next = [...localCats]
    const target = index + delta
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    setLocalCats(next)
    setOrderDirty(true)
  }

  const saveOrder = async () => {
    try {
      await postCategory({ action: "sort", order: localCats.map((c) => `${c.query}:${c.type}`) })
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
              <TableHead>类型</TableHead>
              <TableHead>关键词</TableHead>
              <TableHead>状态</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {localCats.map((cat, index) => (
              <TableRow key={`${cat.query}-${cat.type}`}>
                <TableCell className="font-medium">{cat.name || "-"}</TableCell>
                <TableCell>
                  <Badge variant="outline">{cat.type === "movie" ? "电影" : "电视剧"}</Badge>
                </TableCell>
                <TableCell className="max-w-[240px] truncate text-sm text-muted-foreground">
                  {cat.query}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={!cat.disabled}
                      onCheckedChange={() => handleToggleEnable(cat)}
                    />
                    <span className="text-sm text-muted-foreground">
                      {cat.disabled ? "已禁用" : "启用中"}
                    </span>
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
                    disabled={index === localCats.length - 1}
                  >
                    下移
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={cat.from === "config"}
                    onClick={() => handleDelete(cat)}
                  >
                    删除
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {localCats.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                  暂无自定义分类
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
        {!orderDirty && <p className="text-sm text-muted-foreground">调整顺序后记得保存</p>}
      </div>
    </>
  )
}
