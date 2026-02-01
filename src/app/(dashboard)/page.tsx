"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Video, CheckCircle, MessageSquare, AlertCircle, Loader2 } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useAuthStore } from "@/stores/auth-store"

interface DashboardStats {
  stats: {
    totalRecordings: number
    completedAnalyses: number
    totalFeedbacks: number
    totalIssues: number
  }
  pendingRecordings: {
    id: string
    topic: string
    start_time: string
    status: string
    zoom_accounts: { display_name: string } | null
  }[]
  recentFeedbacks: {
    id: string
    content: string
    created_at: string
    recordings: { topic: string } | null
    profiles: { full_name: string } | null
  }[]
}

// 統計カードコンポーネント
function StatCard({
  title,
  value,
  description,
  icon: Icon,
  loading,
}: {
  title: string
  value: string | number
  description?: string
  icon: React.ComponentType<{ className?: string }>
  loading?: boolean
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <Loader2 className="h-6 w-6 animate-spin" />
        ) : (
          <div className="text-2xl font-bold">{value}</div>
        )}
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </CardContent>
    </Card>
  )
}

// ステータスバッジ
const statusLabels: Record<string, { label: string; variant: "secondary" | "warning" | "destructive" }> = {
  pending: { label: "待機中", variant: "secondary" },
  ready: { label: "準備完了", variant: "secondary" },
  transcribed: { label: "文字起こし完了", variant: "secondary" },
  analyzing: { label: "分析中", variant: "warning" },
}

// 未分析録画リスト
function PendingRecordingsList({
  recordings,
  loading
}: {
  recordings: DashboardStats["pendingRecordings"]
  loading: boolean
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>未分析の録画</CardTitle>
        <CardDescription>分析待ちの録画一覧</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : recordings.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            未分析の録画はありません
          </p>
        ) : (
          <div className="space-y-4">
            {recordings.map((recording) => (
              <Link
                key={recording.id}
                href={`/recordings/${recording.id}`}
                className="block"
              >
                <div className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors">
                  <div>
                    <p className="font-medium">{recording.topic || "無題"}</p>
                    <p className="text-sm text-muted-foreground">
                      {recording.zoom_accounts?.display_name} · {new Date(recording.start_time).toLocaleDateString("ja-JP")}
                    </p>
                  </div>
                  <Badge variant={statusLabels[recording.status]?.variant || "secondary"}>
                    {statusLabels[recording.status]?.label || recording.status}
                  </Badge>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// 最近のフィードバック
function RecentFeedbackList({
  feedbacks,
  loading
}: {
  feedbacks: DashboardStats["recentFeedbacks"]
  loading: boolean
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>最近のフィードバック</CardTitle>
        <CardDescription>直近のフィードバック一覧</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : feedbacks.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            フィードバックはまだありません
          </p>
        ) : (
          <div className="space-y-4">
            {feedbacks.map((feedback) => (
              <div key={feedback.id} className="rounded-lg border p-3">
                <p className="font-medium">{feedback.recordings?.topic || "無題"}</p>
                <p className="text-sm text-muted-foreground line-clamp-2">{feedback.content}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {feedback.profiles?.full_name} · {new Date(feedback.created_at).toLocaleDateString("ja-JP")}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function DashboardPage() {
  const { user } = useAuthStore()
  const isAdmin = user?.role === "admin"
  const [data, setData] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  async function fetchDashboardData() {
    try {
      const res = await fetch("/api/dashboard/stats")
      if (res.ok) {
        const json = await res.json()
        setData(json)
      }
    } catch (e) {
      console.error("Failed to fetch dashboard data:", e)
    } finally {
      setLoading(false)
    }
  }

  async function handleSync() {
    setSyncing(true)
    try {
      const res = await fetch("/api/zoom/sync", { method: "POST" })
      if (res.ok) {
        // 同期後にデータを再取得
        await fetchDashboardData()
      }
    } catch (e) {
      console.error("Failed to sync:", e)
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">ダッシュボード</h1>
          <p className="text-muted-foreground">
            {isAdmin ? "全体の状況を確認できます" : "あなたの録画とフィードバックを確認できます"}
          </p>
        </div>
        {isAdmin && (
          <Button onClick={handleSync} disabled={syncing}>
            {syncing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                同期中...
              </>
            ) : (
              "Zoom録画を同期"
            )}
          </Button>
        )}
      </div>

      {/* 統計カード */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="今月の録画数"
          value={data?.stats.totalRecordings || 0}
          description="今月アップロードされた録画"
          icon={Video}
          loading={loading}
        />
        <StatCard
          title="分析完了"
          value={data?.stats.completedAnalyses || 0}
          description="分析が完了した録画"
          icon={CheckCircle}
          loading={loading}
        />
        <StatCard
          title="フィードバック"
          value={data?.stats.totalFeedbacks || 0}
          description="作成されたフィードバック"
          icon={MessageSquare}
          loading={loading}
        />
        <StatCard
          title="問題箇所"
          value={data?.stats.totalIssues || 0}
          description="検出された問題箇所の合計"
          icon={AlertCircle}
          loading={loading}
        />
      </div>

      {/* コンテンツエリア */}
      <div className="grid gap-4 md:grid-cols-2">
        <PendingRecordingsList
          recordings={data?.pendingRecordings || []}
          loading={loading}
        />
        <RecentFeedbackList
          feedbacks={data?.recentFeedbacks || []}
          loading={loading}
        />
      </div>
    </div>
  )
}
