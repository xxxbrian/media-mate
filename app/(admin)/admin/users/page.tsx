"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useAdminConfig } from "@/hooks/use-admin-config"
import type { AdminConfig } from "@/lib/admin.types"
import { Card } from "@/components/ui/card"
import { toast } from "sonner"
import { SectionHeader } from "@/components/admin/section-header"
import { Spinner } from "@/components/ui/spinner"

type UserEntry = AdminConfig["UserConfig"]["Users"][number]
type SourceEntry = AdminConfig["SourceConfig"][number]
type TagEntry = NonNullable<AdminConfig["UserConfig"]["Tags"]>[number]

async function postUser(body: Record<string, unknown>) {
  const res = await fetch("/api/admin/user", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error ?? "操作失败")
  }
}

function UserBadges({ user }: { user: UserEntry }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant={user.role === "owner" ? "destructive" : user.role === "admin" ? "secondary" : "outline"}>
        {user.role === "owner" ? "站长" : user.role === "admin" ? "管理员" : "用户"}
      </Badge>
      {user.banned && <Badge variant="outline">已封禁</Badge>}
      {user.tags && user.tags.length > 0 && (
        <Badge variant="outline">组: {user.tags.join(", ")}</Badge>
      )}
      {user.enabledApis && user.enabledApis.length > 0 && (
        <Badge variant="outline">限源 {user.enabledApis.length}</Badge>
      )}
    </div>
  )
}

function SourceSelector({
  sources,
  selected,
  onChange,
}: {
  sources: SourceEntry[]
  selected: Set<string>
  onChange: (next: Set<string>) => void
}) {
  const toggle = (key: string, checked: boolean) => {
    const next = new Set(selected)
    if (checked) {
      next.add(key)
    } else {
      next.delete(key)
    }
    onChange(next)
  }

  return (
    <ScrollArea className="max-h-60 rounded-md border">
      <div className="space-y-2 p-3">
        {sources.map((src) => (
          <label key={src.key} className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={selected.has(src.key)}
              onCheckedChange={(val) => toggle(src.key, Boolean(val))}
            />
            <span className="flex-1 truncate">{src.name}</span>
            <Badge variant="outline">{src.from === "config" ? "预设" : "自定义"}</Badge>
          </label>
        ))}
        {sources.length === 0 && <p className="text-xs text-muted-foreground">暂无视频源</p>}
      </div>
    </ScrollArea>
  )
}

function TagSelector({
  tags,
  selected,
  onChange,
}: {
  tags: TagEntry[]
  selected: Set<string>
  onChange: (next: Set<string>) => void
}) {
  const toggle = (name: string, checked: boolean) => {
    const next = new Set(selected)
    if (checked) {
      next.add(name)
    } else {
      next.delete(name)
    }
    onChange(next)
  }

  return (
    <ScrollArea className="max-h-48 rounded-md border">
      <div className="space-y-2 p-3">
        {tags.length === 0 && <p className="text-xs text-muted-foreground">暂无用户组</p>}
        {tags.map((tag) => (
          <label key={tag.name} className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={selected.has(tag.name)}
              onCheckedChange={(val) => toggle(tag.name, Boolean(val))}
            />
            <span className="flex-1">{tag.name}</span>
            <Badge variant="outline">{tag.enabledApis.length > 0 ? `${tag.enabledApis.length} 源` : "无限制"}</Badge>
          </label>
        ))}
      </div>
    </ScrollArea>
  )
}

export default function UsersPage() {
  const { data, loading, error, refresh } = useAdminConfig()
  const config = data?.Config

  const [addOpen, setAddOpen] = useState(false)
  const [newUser, setNewUser] = useState({ username: "", password: "", tag: "" })

  const [passwordTarget, setPasswordTarget] = useState<UserEntry | null>(null)
  const [newPassword, setNewPassword] = useState("")

  const [apiTarget, setApiTarget] = useState<UserEntry | null>(null)
  const [apiSelected, setApiSelected] = useState<Set<string>>(new Set())

  const [tagTarget, setTagTarget] = useState<UserEntry | null>(null)
  const [tagSelected, setTagSelected] = useState<Set<string>>(new Set())

  const [tagDialog, setTagDialog] = useState<{ mode: "add" | "edit"; tag?: TagEntry } | null>(null)
  const [tagForm, setTagForm] = useState<{ name: string; apis: Set<string> }>({
    name: "",
    apis: new Set(),
  })

  const sources = config?.SourceConfig ?? []
  const tags = config?.UserConfig.Tags ?? []

  const users = useMemo(() => {
    return config?.UserConfig.Users ?? []
  }, [config])

  const handleAddUser = async () => {
    try {
      await postUser({
        action: "add",
        targetUsername: newUser.username.trim(),
        targetPassword: newUser.password,
        userGroup: newUser.tag || undefined,
      })
      toast.success("添加成功")
      setAddOpen(false)
      setNewUser({ username: "", password: "", tag: "" })
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "添加失败")
    }
  }

  const handlePasswordChange = async () => {
    if (!passwordTarget) return
    try {
      await postUser({
        action: "changePassword",
        targetUsername: passwordTarget.username,
        targetPassword: newPassword,
      })
      toast.success("密码已更新")
      setPasswordTarget(null)
      setNewPassword("")
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "更新失败")
    }
  }

  const handleApiSave = async () => {
    if (!apiTarget) return
    try {
      await postUser({
        action: "updateUserApis",
        targetUsername: apiTarget.username,
        enabledApis: Array.from(apiSelected),
      })
      toast.success("已更新可用视频源")
      setApiTarget(null)
      setApiSelected(new Set())
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "更新失败")
    }
  }

  const handleTagsSave = async () => {
    if (!tagTarget) return
    try {
      await postUser({
        action: "updateUserGroups",
        targetUsername: tagTarget.username,
        userGroups: Array.from(tagSelected),
      })
      toast.success("已更新用户组")
      setTagTarget(null)
      setTagSelected(new Set())
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "更新失败")
    }
  }

  const handleSimpleAction = async (
    action:
      | "ban"
      | "unban"
      | "setAdmin"
      | "cancelAdmin"
      | "deleteUser"
      | "updateUserGroups",
    user: UserEntry
  ) => {
    try {
      await postUser({ action, targetUsername: user.username })
      toast.success("操作成功")
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "操作失败")
    }
  }

  const openApiDialog = (user: UserEntry) => {
    setApiTarget(user)
    setApiSelected(new Set(user.enabledApis ?? []))
  }

  const openTagDialog = (user: UserEntry) => {
    setTagTarget(user)
    setTagSelected(new Set(user.tags ?? []))
  }

  const openEditTag = (tag: TagEntry) => {
    setTagDialog({ mode: "edit", tag })
    setTagForm({ name: tag.name, apis: new Set(tag.enabledApis ?? []) })
  }

  const handleSaveTag = async () => {
    const mode = tagDialog?.mode ?? "add"
    try {
      await postUser({
        action: "userGroup",
        groupAction: mode,
        groupName: tagForm.name.trim(),
        enabledApis: Array.from(tagForm.apis),
      })
      toast.success(mode === "add" ? "用户组已创建" : "用户组已更新")
      setTagDialog(null)
      setTagForm({ name: "", apis: new Set() })
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "操作失败")
    }
  }

  const handleDeleteTag = async (tag: TagEntry) => {
    try {
      await postUser({
        action: "userGroup",
        groupAction: "delete",
        groupName: tag.name,
      })
      toast.success("用户组已删除")
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "删除失败")
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
        title="用户管理"
        description="管理站长、管理员和普通用户的角色与权限。"
        action={
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button>添加用户</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>添加用户</DialogTitle>
                <DialogDescription>创建新的登录用户并设置初始密码。</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="username">用户名</Label>
                  <Input
                    id="username"
                    value={newUser.username}
                    onChange={(e) => setNewUser((prev) => ({ ...prev, username: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="password">密码</Label>
                  <Input
                    id="password"
                    type="password"
                    value={newUser.password}
                    onChange={(e) => setNewUser((prev) => ({ ...prev, password: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="tag">用户组（可选）</Label>
                  <select
                    id="tag"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={newUser.tag}
                    onChange={(e) => setNewUser((prev) => ({ ...prev, tag: e.target.value }))}
                  >
                    <option value="">无</option>
                    {tags.map((tag) => (
                      <option key={tag.name} value={tag.name}>
                        {tag.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={handleAddUser}
                  disabled={!newUser.username || !newUser.password}
                >
                  创建
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <Card className="border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>用户名</TableHead>
              <TableHead>信息</TableHead>
              <TableHead>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.username}>
                <TableCell className="font-medium">{user.username}</TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <UserBadges user={user} />
                    {user.enabledApis && user.enabledApis.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        仅可用: {user.enabledApis.join(", ")}
                      </p>
                    )}
                  </div>
                </TableCell>
                <TableCell className="space-x-2">
                  <Button variant="outline" size="sm" onClick={() => openApiDialog(user)}>
                    限定源
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => openTagDialog(user)}>
                    用户组
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setPasswordTarget(user)
                      setNewPassword("")
                    }}
                  >
                    修改密码
                  </Button>
                  {user.role !== "owner" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        handleSimpleAction(user.role === "admin" ? "cancelAdmin" : "setAdmin", user)
                      }
                    >
                      {user.role === "admin" ? "取消管理" : "设为管理"}
                    </Button>
                  )}
                  {user.role !== "owner" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSimpleAction(user.banned ? "unban" : "ban", user)}
                    >
                      {user.banned ? "解封" : "封禁"}
                    </Button>
                  )}
                  {user.role !== "owner" && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm">
                          删除
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>确认删除 {user.username} ?</AlertDialogTitle>
                          <AlertDialogDescription>
                            删除后该用户的收藏、记录等数据会被清理，操作不可撤销。
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>取消</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleSimpleAction("deleteUser", user)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            确认删除
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {users.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">
                  暂无用户
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <SectionHeader
        title="用户组"
        description="给用户分配用户组以限制可用的视频源。"
        action={
          <Button
            onClick={() => {
              setTagDialog({ mode: "add" })
              setTagForm({ name: "", apis: new Set() })
            }}
          >
            新建用户组
          </Button>
        }
      />

      <Card className="border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>名称</TableHead>
              <TableHead>可用视频源</TableHead>
              <TableHead>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tags.map((tag) => (
              <TableRow key={tag.name}>
                <TableCell className="font-medium">{tag.name}</TableCell>
                <TableCell>
                  {tag.enabledApis.length > 0 ? (
                    <span className="text-sm text-muted-foreground">
                      {tag.enabledApis.length} 个源
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground">无限制</span>
                  )}
                </TableCell>
                <TableCell className="space-x-2">
                  <Button variant="outline" size="sm" onClick={() => openEditTag(tag)}>
                    编辑
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm">
                        删除
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>删除用户组 {tag.name} ?</AlertDialogTitle>
                        <AlertDialogDescription>
                          使用该用户组的用户将失去此分组限制。
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>取消</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDeleteTag(tag)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          删除
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              </TableRow>
            ))}
            {tags.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">
                  还没有用户组
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <div className="space-y-4">
        <SectionHeader
          title="帮助"
          description="管理员权限说明和接口文档。"
          action={
            <Link className="text-sm text-primary underline-offset-4 hover:underline" href="/api/admin/config">
              查看原始配置
            </Link>
          }
        />
        <p className="text-sm text-muted-foreground">
          站长可以操作所有用户和管理员，管理员仅能管理普通用户及自己。更多限制由后端接口校验保障。
        </p>
      </div>

      {/* 修改密码对话框 */}
      <Dialog open={Boolean(passwordTarget)} onOpenChange={(open) => !open && setPasswordTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>修改密码</DialogTitle>
            <DialogDescription>仅支持非站长账户。</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">用户：{passwordTarget?.username}</p>
            <div className="space-y-1">
              <Label htmlFor="newPassword">新密码</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={handlePasswordChange}
              disabled={!newPassword.trim()}
            >
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 限定源对话框 */}
      <Dialog open={Boolean(apiTarget)} onOpenChange={(open) => !open && setApiTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>限定视频源</DialogTitle>
            <DialogDescription>
              如果不选择任何源，表示无限制。用户：{apiTarget?.username}
            </DialogDescription>
          </DialogHeader>
          <SourceSelector sources={sources} selected={apiSelected} onChange={setApiSelected} />
          <DialogFooter>
            <Button onClick={handleApiSave}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 用户组分配对话框 */}
      <Dialog open={Boolean(tagTarget)} onOpenChange={(open) => !open && setTagTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>分配用户组</DialogTitle>
            <DialogDescription>
              选择一个或多个用户组。用户：{tagTarget?.username}
            </DialogDescription>
          </DialogHeader>
          <TagSelector tags={tags} selected={tagSelected} onChange={setTagSelected} />
          <DialogFooter>
            <Button onClick={handleTagsSave}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 创建/编辑用户组 */}
      <Dialog open={Boolean(tagDialog)} onOpenChange={(open) => !open && setTagDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tagDialog?.mode === "edit" ? "编辑用户组" : "新建用户组"}</DialogTitle>
            <DialogDescription>
              设置用户组名称和可用的视频源列表。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="tag-name">名称</Label>
              <Input
                id="tag-name"
                value={tagForm.name}
                onChange={(e) => setTagForm((prev) => ({ ...prev, name: e.target.value }))}
                disabled={tagDialog?.mode === "edit"}
              />
            </div>
            <div className="space-y-2">
              <Label>可用视频源（留空表示无限制）</Label>
              <SourceSelector
                sources={sources}
                selected={tagForm.apis}
                onChange={(next) => setTagForm((prev) => ({ ...prev, apis: next }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={handleSaveTag}
              disabled={!tagForm.name.trim()}
            >
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
