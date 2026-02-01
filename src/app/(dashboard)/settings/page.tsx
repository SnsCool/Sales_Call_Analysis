"use client"

import { useState } from "react"
import { User, Bell, Shield, LogOut } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Avatar } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { useAuthStore } from "@/stores/auth-store"
import { createClient } from "@/lib/supabase"
import { useRouter } from "next/navigation"

export default function SettingsPage() {
  const router = useRouter()
  const { user, logout } = useAuthStore()
  const [saving, setSaving] = useState(false)

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    logout()
    router.push("/login")
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">設定</h1>
        <p className="text-muted-foreground">
          アカウントと通知の設定を管理します
        </p>
      </div>

      {/* プロフィール */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            プロフィール
          </CardTitle>
          <CardDescription>
            あなたのプロフィール情報を管理します
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar
              size="lg"
              src={user?.avatarUrl}
              alt={user?.fullName}
              fallback={user?.fullName?.charAt(0)}
            />
            <div>
              <p className="font-medium">{user?.fullName}</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
              <Badge variant="secondary" className="mt-1">
                {user?.role === "admin" ? "管理者" : "営業担当"}
              </Badge>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">氏名</label>
              <Input defaultValue={user?.fullName} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">メールアドレス</label>
              <Input defaultValue={user?.email} disabled />
            </div>
          </div>

          <Button loading={saving}>保存</Button>
        </CardContent>
      </Card>

      {/* 通知設定 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            通知設定
          </CardTitle>
          <CardDescription>
            通知の受信方法を設定します
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">新しいフィードバック</p>
              <p className="text-sm text-muted-foreground">
                フィードバックが共有された時に通知を受け取る
              </p>
            </div>
            <input type="checkbox" defaultChecked className="h-5 w-5" />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">分析完了</p>
              <p className="text-sm text-muted-foreground">
                録画の分析が完了した時に通知を受け取る
              </p>
            </div>
            <input type="checkbox" defaultChecked className="h-5 w-5" />
          </div>
        </CardContent>
      </Card>

      {/* セキュリティ */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            セキュリティ
          </CardTitle>
          <CardDescription>
            アカウントのセキュリティ設定を管理します
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button variant="outline">パスワードを変更</Button>
        </CardContent>
      </Card>

      {/* ログアウト */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <LogOut className="h-5 w-5" />
            ログアウト
          </CardTitle>
          <CardDescription>
            アカウントからログアウトします
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={handleLogout}>
            ログアウト
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
