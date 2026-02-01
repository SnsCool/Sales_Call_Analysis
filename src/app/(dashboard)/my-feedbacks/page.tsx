"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useAuthStore } from "@/stores/auth-store"
import { MessageSquare, Loader2, ExternalLink } from "lucide-react"
import Link from "next/link"

interface Feedback {
  id: string
  content: string
  shared_at: string
  created_at: string
  recordings: {
    id: string
    topic: string
    start_time: string
  } | null
}

export default function MyFeedbacksPage() {
  const { user } = useAuthStore()
  const router = useRouter()
  const isAdmin = user?.role === "admin"

  const [feedbacks, setFeedbacks] = useState<Feedback[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isAdmin) {
      // 管理者はこのページにアクセスする必要がない
      router.push("/recordings")
      return
    }

    fetchFeedbacks()
  }, [isAdmin, router])

  async function fetchFeedbacks() {
    setLoading(true)
    try {
      const res = await fetch("/api/feedbacks/my")
      if (res.ok) {
        const json = await res.json()
        setFeedbacks(json.data || [])
      }
    } catch (e) {
      console.error("Failed to fetch feedbacks:", e)
    } finally {
      setLoading(false)
    }
  }

  if (isAdmin) {
    return null
  }

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">マイフィードバック</h1>
        <p className="text-muted-foreground">
          あなた宛てに共有されたフィードバック一覧です
        </p>
      </div>

      {feedbacks.length === 0 ? (
        <div className="flex h-[40vh] flex-col items-center justify-center gap-4">
          <MessageSquare className="h-12 w-12 text-muted-foreground" />
          <p className="text-lg text-muted-foreground">
            まだ共有されたフィードバックはありません
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {feedbacks.map((feedback) => (
            <Card key={feedback.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">
                      {feedback.recordings?.topic || "無題の録画"}
                    </CardTitle>
                    <div className="mt-1 flex items-center gap-4 text-sm text-muted-foreground">
                      <span>
                        共有日時: {new Date(feedback.shared_at).toLocaleString("ja-JP")}
                      </span>
                      {feedback.recordings?.start_time && (
                        <span>
                          録画日時: {new Date(feedback.recordings.start_time).toLocaleString("ja-JP")}
                        </span>
                      )}
                    </div>
                  </div>
                  <Badge variant="secondary">共有済み</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border bg-muted/50 p-4">
                  <p className="whitespace-pre-wrap text-sm">{feedback.content}</p>
                </div>
                {feedback.recordings && (
                  <div className="mt-4">
                    <Link href={`/recordings/${feedback.recordings.id}`}>
                      <Button variant="outline" size="sm">
                        <ExternalLink className="mr-2 h-4 w-4" />
                        録画を見る
                      </Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
