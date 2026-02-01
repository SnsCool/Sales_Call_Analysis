import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient, createServiceClient } from "@/lib/supabase-server"

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: feedbackId } = await params
  const supabase = await createServerSupabaseClient()

  try {
    // 1. 認証チェック
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // 2. 管理者チェック
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single() as { data: { role?: string } | null; error: unknown }

    if (profileError) {
      console.error("Failed to fetch user profile:", profileError)
      return NextResponse.json({ error: "Failed to verify user role" }, { status: 500 })
    }

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 })
    }

    const serviceSupabase = createServiceClient()

    // 3. フィードバックの存在確認
    const { data: feedback, error: fetchError } = await serviceSupabase
      .from("feedbacks")
      .select("id, is_shared")
      .eq("id", feedbackId)
      .single() as { data: { id: string; is_shared: boolean } | null; error: unknown }

    if (fetchError || !feedback) {
      return NextResponse.json({ error: "Feedback not found" }, { status: 404 })
    }

    if (feedback.is_shared) {
      return NextResponse.json({ error: "Feedback already shared" }, { status: 400 })
    }

    // 4. 共有状態に更新
    const { data: updatedFeedback, error: updateError } = await serviceSupabase
      .from("feedbacks")
      .update({
        is_shared: true,
        shared_at: new Date().toISOString(),
      } as never)
      .eq("id", feedbackId)
      .select()
      .single()

    if (updateError) {
      console.error("Update error:", updateError)
      return NextResponse.json({ error: "Failed to share feedback" }, { status: 500 })
    }

    return NextResponse.json({ data: updatedFeedback })
  } catch (error) {
    console.error("Share API error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
