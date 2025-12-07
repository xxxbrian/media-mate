"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Copy, Link as LinkIcon, Shield } from "lucide-react"

import { SectionHeader } from "@/components/admin/section-header"

const DEFAULT_MODE = "fast"
const DEFAULT_FORMAT = "json"

export default function TvboxPage() {
  const [format, setFormat] = useState<"json" | "base64">(DEFAULT_FORMAT as "json" | "base64")
  const [mode, setMode] = useState<"standard" | "safe" | "yingshicang" | "fast">(
    DEFAULT_MODE as "standard" | "safe" | "yingshicang" | "fast"
  )
  const [baseUrl, setBaseUrl] = useState("")

  useEffect(() => {
    const envBase = (process.env.NEXT_PUBLIC_SITE_BASE || "").trim().replace(/\/$/, "")
    if (envBase) {
      setBaseUrl(envBase)
      return
    }
    if (typeof window !== "undefined") {
      setBaseUrl(window.location.origin)
    }
  }, [])

  const configUrl = useMemo(() => {
    if (!baseUrl) return ""
    const modeParam = mode !== "standard" ? `&mode=${mode}` : ""
    return `${baseUrl}/api/tvbox/config?format=${format}${modeParam}`
  }, [baseUrl, format, mode])

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success("已复制到剪贴板")
    } catch {
      toast.error("复制失败")
    }
  }

  const testUrl = async () => {
    if (!configUrl) return
    try {
      const res = await fetch(configUrl)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      toast.success("订阅地址可访问")
    } catch (err) {
      toast.error(`测试失败: ${err instanceof Error ? err.message : "网络错误"}`)
    }
  }

  return (
    <div className="space-y-8">
      <SectionHeader
        title="TVBox"
        description="生成 TVBox / 猫影视 等播放器的订阅地址，可选择输出格式和兼容模式。"
      />

      <Card className="space-y-4 p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>输出格式</Label>
            <div className="flex gap-2">
              {(["json", "base64"] as const).map((item) => (
                <Button
                  key={item}
                  variant={format === item ? "default" : "outline"}
                  onClick={() => setFormat(item)}
                >
                  {item.toUpperCase()}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>模式</Label>
            <div className="flex flex-wrap gap-2">
              {[
                { key: "standard", label: "标准" },
                { key: "fast", label: "快速" },
                { key: "yingshicang", label: "影视仓优化" },
                { key: "safe", label: "兼容" },
              ].map((item) => (
                <Button
                  key={item.key}
                  variant={mode === item.key ? "default" : "outline"}
                  onClick={() => setMode(item.key as typeof mode)}
                >
                  {item.label}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label>订阅地址</Label>
          <div className="flex gap-2">
            <Input value={configUrl} readOnly />
            <Button onClick={() => copy(configUrl)} variant="outline">
              <Copy className="mr-1 h-4 w-4" /> 复制
            </Button>
            <Button onClick={testUrl} variant="secondary">
              <LinkIcon className="mr-1 h-4 w-4" /> 测试
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            如需关闭成人过滤，使用 <code>?filter=off</code> 追加参数。
          </p>
        </div>

        <div className="space-y-3 rounded-md border p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Shield className="h-4 w-4" />
            成人内容快捷链接
          </div>
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => copy(configUrl.split("?")[0] ?? configUrl)}
              >
                复制家庭模式
              </Button>
              <span>默认过滤成人内容</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => copy(`${configUrl.split("?")[0]}?filter=off`)}
              >
                复制完整内容
              </Button>
              <span>显示所有资源</span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
