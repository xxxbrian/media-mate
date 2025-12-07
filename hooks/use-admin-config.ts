import { useCallback, useEffect, useState } from "react"

import type { AdminConfigResult } from "@/lib/admin.types"

type AdminConfigState = {
  data: AdminConfigResult | null
  loading: boolean
  error: string | null
}

export function useAdminConfig() {
  const [state, setState] = useState<AdminConfigState>({
    data: null,
    loading: true,
    error: null,
  })

  const fetchConfig = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }))
    try {
      const res = await fetch("/api/admin/config", { cache: "no-store" })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `加载失败: ${res.status}`)
      }
      const json = (await res.json()) as AdminConfigResult
      setState({ data: json, loading: false, error: null })
    } catch (err) {
      setState({
        data: null,
        loading: false,
        error: err instanceof Error ? err.message : "未知错误",
      })
    }
  }, [])

  useEffect(() => {
    fetchConfig()
  }, [fetchConfig])

  return {
    ...state,
    refresh: fetchConfig,
  }
}
