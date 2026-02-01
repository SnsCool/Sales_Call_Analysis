"use client"

import { useState, useEffect } from "react"
import { Plus, Search, Edit, Trash2, BookOpen, Loader2, X } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useAuthStore } from "@/stores/auth-store"

interface KnowledgeRule {
  id: string
  title: string
  category: string | null
  content: string
  prompt_instructions: string | null
  is_active: boolean
}

export default function KnowledgePage() {
  const { user } = useAuthStore()
  const isAdmin = user?.role === "admin"

  const [rules, setRules] = useState<KnowledgeRule[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("すべて")

  // 編集モーダル状態
  const [editingRule, setEditingRule] = useState<KnowledgeRule | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [saving, setSaving] = useState(false)

  // フォーム状態
  const [formTitle, setFormTitle] = useState("")
  const [formCategory, setFormCategory] = useState("")
  const [formContent, setFormContent] = useState("")
  const [formInstructions, setFormInstructions] = useState("")

  useEffect(() => {
    fetchRules()
  }, [])

  async function fetchRules() {
    setLoading(true)
    try {
      const res = await fetch("/api/knowledge")
      if (res.ok) {
        const json = await res.json()
        setRules(json.data || [])
      }
    } catch (e) {
      console.error("Failed to fetch rules:", e)
    } finally {
      setLoading(false)
    }
  }

  // カテゴリ一覧を取得
  const categories = ["すべて", ...Array.from(new Set(rules.map((r) => r.category).filter(Boolean))) as string[]]

  // フィルタリング
  const filteredRules = rules.filter((rule) => {
    const matchesSearch = rule.title.toLowerCase().includes(search.toLowerCase()) ||
      rule.content.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = selectedCategory === "すべて" || rule.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  // 編集開始
  function handleEdit(rule: KnowledgeRule) {
    setEditingRule(rule)
    setFormTitle(rule.title)
    setFormCategory(rule.category || "")
    setFormContent(rule.content)
    setFormInstructions(rule.prompt_instructions || "")
    setShowCreateModal(true)
  }

  // 新規作成開始
  function handleCreate() {
    setEditingRule(null)
    setFormTitle("")
    setFormCategory("")
    setFormContent("")
    setFormInstructions("")
    setShowCreateModal(true)
  }

  // 保存
  async function handleSave() {
    if (!formTitle.trim() || !formContent.trim()) return
    setSaving(true)

    try {
      const body = {
        title: formTitle,
        category: formCategory || null,
        content: formContent,
        prompt_instructions: formInstructions || null,
        is_active: true,
      }

      const url = editingRule ? `/api/knowledge/${editingRule.id}` : "/api/knowledge"
      const method = editingRule ? "PATCH" : "POST"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        setShowCreateModal(false)
        await fetchRules()
      }
    } catch (e) {
      console.error("Failed to save:", e)
    } finally {
      setSaving(false)
    }
  }

  // 削除
  async function handleDelete(id: string) {
    if (!confirm("このルールを削除しますか？")) return

    try {
      const res = await fetch(`/api/knowledge/${id}`, { method: "DELETE" })
      if (res.ok) {
        await fetchRules()
      }
    } catch (e) {
      console.error("Failed to delete:", e)
    }
  }

  // 管理者以外
  if (!isAdmin) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="text-center">
          <BookOpen className="mx-auto h-12 w-12 text-muted-foreground" />
          <h2 className="mt-4 text-xl font-semibold">アクセス権限がありません</h2>
          <p className="mt-2 text-muted-foreground">
            このページは管理者のみアクセスできます
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">ナレッジ管理</h1>
          <p className="text-muted-foreground">
            営業ルール・チェック項目を管理します（{rules.length}件）
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          新規作成
        </Button>
      </div>

      {/* 検索・フィルタ */}
      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="ルールを検索..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {categories.slice(0, 6).map((category) => (
            <Button
              key={category}
              variant={selectedCategory === category ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(category)}
            >
              {category}
            </Button>
          ))}
        </div>
      </div>

      {/* ローディング */}
      {loading && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      )}

      {/* ルール一覧 */}
      {!loading && (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredRules.map((rule) => (
            <Card key={rule.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg">{rule.title}</CardTitle>
                    {!rule.is_active && <Badge variant="secondary">無効</Badge>}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(rule)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(rule.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                {rule.category && <Badge variant="outline">{rule.category}</Badge>}
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-3">{rule.content}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!loading && filteredRules.length === 0 && (
        <div className="text-center text-muted-foreground py-12">
          ルールが見つかりません
        </div>
      )}

      {/* 作成/編集モーダル */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">
                {editingRule ? "ルールを編集" : "新規ルール作成"}
              </h2>
              <Button variant="ghost" size="icon" onClick={() => setShowCreateModal(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">タイトル *</label>
                <Input
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="ルールのタイトル"
                />
              </div>

              <div>
                <label className="text-sm font-medium">カテゴリ</label>
                <Input
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  placeholder="例: 話法、ヒアリング"
                />
              </div>

              <div>
                <label className="text-sm font-medium">内容 *</label>
                <textarea
                  className="w-full min-h-[120px] p-3 border rounded-lg text-sm resize-none"
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  placeholder="ルールの内容を記載"
                />
              </div>

              <div>
                <label className="text-sm font-medium">AI分析用の指示（オプション）</label>
                <textarea
                  className="w-full min-h-[80px] p-3 border rounded-lg text-sm resize-none"
                  value={formInstructions}
                  onChange={(e) => setFormInstructions(e.target.value)}
                  placeholder="AIが分析時に使用する追加指示"
                />
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowCreateModal(false)}>
                  キャンセル
                </Button>
                <Button onClick={handleSave} disabled={saving || !formTitle.trim() || !formContent.trim()}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  保存
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
