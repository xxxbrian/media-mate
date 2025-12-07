"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { toast } from "sonner"
import { ShieldAlert } from "lucide-react"

import { SectionHeader } from "@/components/admin/section-header"

async function resetConfig() {
  const res = await fetch("/api/admin/reset", { method: "GET" })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error ?? "重置失败")
  }
}

export default function ResetPage() {
  const [loading, setLoading] = useState(false)

  const handleReset = async () => {
    if (!confirm("确定要重置管理员配置吗？此操作仅站长可执行，无法撤销。")) return
    try {
      setLoading(true)
      await resetConfig()
      toast.success("已重置配置，请刷新页面")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "重置失败")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader title="重置配置" description="仅站长可用，会清除管理员设置与预设源。" />
      <Card className="space-y-4 p-6">
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>危险操作</AlertTitle>
          <AlertDescription>
            将重置管理员配置、用户封禁与预设源。自定义源可能被保留，操作不可撤销。
          </AlertDescription>
        </Alert>
        <Button variant="destructive" onClick={handleReset} disabled={loading}>
          {loading ? "重置中..." : "确认重置"}
        </Button>
      </Card>
    </div>
  )
}
