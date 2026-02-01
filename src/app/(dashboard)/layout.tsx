"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { useAuthStore } from "@/stores/auth-store"
import { AppLayout } from "@/components/layout"
import { Spinner } from "@/components/ui/spinner"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const { user, isLoading, setUser, setLoading } = useAuthStore()

  useEffect(() => {
    const supabase = createClient()

    const getUser = async () => {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser()

      if (!authUser) {
        router.push("/login")
        return
      }

      // プロファイル情報を取得
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", authUser.id)
        .single()

      const p = profile as { full_name?: string; role?: string; avatar_url?: string } | null
      setUser({
        id: authUser.id,
        email: authUser.email!,
        fullName: p?.full_name || authUser.email!,
        role: (p?.role as "admin" | "sales") || "sales",
        avatarUrl: p?.avatar_url,
      })
    }

    getUser()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        setUser(null)
        router.push("/login")
      }
    })

    return () => subscription.unsubscribe()
  }, [router, setUser, setLoading])

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!user) {
    return null
  }

  return <AppLayout>{children}</AppLayout>
}
