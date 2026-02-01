"use client"

import { useState, useEffect, useRef } from "react"
import { useParams } from "next/navigation"
import { useAuthStore } from "@/stores/auth-store"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { AlertCircle, Loader2, MessageSquare, Play, User, FileText, Search } from "lucide-react"

interface TranscriptSegment {
  start: number
  end: number
  text: string
  speaker?: string
}

interface Issue {
  start_ms: number
  end_ms: number
  rule_name: string
  severity: "error" | "warning" | "info"
  reason: string
  suggestion: string
}

interface RecordingDetail {
  id: string
  topic: string
  start_time: string
  duration: number
  status: string
  video_url: string | null
  zoom_accounts: { display_name: string; owner_id: string }
  analyses: {
    id: string
    transcript_json: TranscriptSegment[] | null
    issues_json: { issues: Issue[] } | null
    summary_text: string | null
  } | null
}

const formatTime = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
}

export default function RecordingDetailPage() {
  const params = useParams()
  const id = params.id as string
  const { user } = useAuthStore()
  const isAdmin = user?.role === "admin"

  const [data, setData] = useState<RecordingDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"transcript" | "analysis" | "feedback">("transcript")

  const [feedbackText, setFeedbackText] = useState("")
  const [feedbackLoading, setFeedbackLoading] = useState(false)
  const [feedbackMessage, setFeedbackMessage] = useState("")

  const videoRef = useRef<HTMLVideoElement>(null)

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/recordings/${id}`)
      if (!res.ok) throw new Error("Failed to fetch recording details")
      const json = await res.json()
      setData(json.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (id) fetchData()
  }, [id])

  const handleStartTranscription = async () => {
    if (!isAdmin) return
    setActionLoading("transcribe")
    try {
      const res = await fetch(`/api/recordings/${id}/transcribe`, { method: "POST" })
      if (!res.ok) throw new Error("Failed to start transcription")
      await fetchData()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error")
    } finally {
      setActionLoading(null)
    }
  }

  const handleStartAnalysis = async () => {
    if (!isAdmin) return
    setActionLoading("analyze")
    try {
      const res = await fetch(`/api/recordings/${id}/analyze`, { method: "POST" })
      if (!res.ok) throw new Error("Failed to start analysis")
      await fetchData()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error")
    } finally {
      setActionLoading(null)
    }
  }

  const handleSubmitFeedback = async () => {
    if (!isAdmin || !feedbackText.trim() || !data) return
    setFeedbackLoading(true)
    setFeedbackMessage("")
    try {
      const res = await fetch("/api/feedbacks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recording_id: id,
          target_user_id: data.zoom_accounts.owner_id,
          content: feedbackText,
        }),
      })
      if (!res.ok) throw new Error("Failed to submit feedback")
      setFeedbackMessage("フィードバックを送信しました")
      setFeedbackText("")
    } catch (err) {
      setFeedbackMessage("送信に失敗しました")
    } finally {
      setFeedbackLoading(false)
    }
  }

  const handleSeek = (timeMs: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = timeMs / 1000
      videoRef.current.play()
    }
  }

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "error":
        return <Badge variant="destructive">重大</Badge>
      case "warning":
        return <Badge variant="warning">注意</Badge>
      default:
        return <Badge variant="secondary">情報</Badge>
    }
  }

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-4 text-destructive">
        <AlertCircle className="h-12 w-12" />
        <p className="text-lg font-medium">エラーが発生しました</p>
        <p className="text-sm text-muted-foreground">{error || "録画データが見つかりません"}</p>
        <Button onClick={fetchData} variant="outline">
          再読み込み
        </Button>
      </div>
    )
  }

  const transcript = data.analyses?.transcript_json || []
  const issues = data.analyses?.issues_json?.issues || []
  const summary = data.analyses?.summary_text || ""

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{data.topic || "タイトルなし"}</h1>
          <div className="mt-1 flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <User className="h-4 w-4" />
              {data.zoom_accounts?.display_name}
            </span>
            <span>{new Date(data.start_time).toLocaleString("ja-JP")}</span>
            <Badge variant="outline">{data.status}</Badge>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 左: 動画プレイヤー */}
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <div className="aspect-video overflow-hidden rounded-lg bg-black">
                {data.video_url ? (
                  <video ref={videoRef} src={data.video_url} controls className="h-full w-full" />
                ) : (
                  <div className="flex h-full items-center justify-center text-white/50">
                    動画データがありません
                  </div>
                )}
              </div>

              {isAdmin && (
                <div className="mt-4 flex gap-2">
                  <Button
                    onClick={handleStartTranscription}
                    disabled={actionLoading === "transcribe" || transcript.length > 0}
                    variant="outline"
                    className="flex-1"
                  >
                    {actionLoading === "transcribe" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <FileText className="mr-2 h-4 w-4" />
                    )}
                    {transcript.length > 0 ? "文字起こし完了" : "文字起こし開始"}
                  </Button>
                  <Button
                    onClick={handleStartAnalysis}
                    disabled={actionLoading === "analyze" || issues.length > 0 || transcript.length === 0}
                    variant="outline"
                    className="flex-1"
                  >
                    {actionLoading === "analyze" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="mr-2 h-4 w-4" />
                    )}
                    {issues.length > 0 ? "分析完了" : "分析開始"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* サマリー */}
          {summary && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">通話サマリー</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{summary}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* 右: タブ */}
        <div className="space-y-4">
          {/* タブボタン */}
          <div className="flex gap-2">
            <Button
              variant={activeTab === "transcript" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("transcript")}
            >
              文字起こし
            </Button>
            <Button
              variant={activeTab === "analysis" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("analysis")}
            >
              分析結果 {issues.length > 0 && `(${issues.length})`}
            </Button>
            {isAdmin && (
              <Button
                variant={activeTab === "feedback" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveTab("feedback")}
              >
                フィードバック
              </Button>
            )}
          </div>

          {/* タブコンテンツ */}
          <Card className="max-h-[60vh] overflow-y-auto">
            <CardContent className="p-4">
              {activeTab === "transcript" && (
                <div className="space-y-3">
                  {transcript.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">文字起こしデータがありません</p>
                  ) : (
                    transcript.map((seg, i) => (
                      <div
                        key={i}
                        className="flex gap-3 cursor-pointer hover:bg-muted/50 p-2 rounded-lg transition-colors"
                        onClick={() => handleSeek(seg.start)}
                      >
                        <span className="text-xs font-mono text-muted-foreground min-w-[50px]">
                          {formatTime(seg.start)}
                        </span>
                        <div>
                          {seg.speaker && <span className="text-xs font-semibold text-primary">{seg.speaker}</span>}
                          <p className="text-sm">{seg.text}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === "analysis" && (
                <div className="space-y-4">
                  {issues.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">分析結果がありません</p>
                  ) : (
                    issues.map((issue, i) => (
                      <div key={i} className="border rounded-lg p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {getSeverityBadge(issue.severity)}
                            <span className="font-medium text-sm">{issue.rule_name}</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSeek(issue.start_ms)}
                            className="text-xs"
                          >
                            <Play className="h-3 w-3 mr-1" />
                            {formatTime(issue.start_ms)}
                          </Button>
                        </div>
                        <p className="text-sm text-muted-foreground">{issue.reason}</p>
                        <p className="text-sm text-green-600">💡 {issue.suggestion}</p>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === "feedback" && isAdmin && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    この録画に関するフィードバックを作成します。
                  </p>
                  <textarea
                    className="w-full min-h-[150px] p-3 border rounded-lg text-sm resize-none"
                    placeholder="フィードバックを入力..."
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                  />
                  {feedbackMessage && (
                    <p className={`text-sm ${feedbackMessage.includes("失敗") ? "text-red-500" : "text-green-500"}`}>
                      {feedbackMessage}
                    </p>
                  )}
                  <Button onClick={handleSubmitFeedback} disabled={!feedbackText.trim() || feedbackLoading}>
                    {feedbackLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    送信
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
