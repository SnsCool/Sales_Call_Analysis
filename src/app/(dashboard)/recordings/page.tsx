"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, AlertCircle } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";

// APIレスポンスの型定義
interface Recording {
  id: string;
  topic: string;
  start_time: string;
  duration: number;
  status:
    | "pending"
    | "downloading"
    | "ready"
    | "transcribing"
    | "transcribed"
    | "analyzing"
    | "completed"
    | "failed";
  zoom_accounts: { display_name: string; owner_id: string };
}

interface ApiResponse {
  data: Recording[];
}

// ステータスの日本語マッピングと色の定義
const STATUS_CONFIG: Record<
  Recording["status"],
  { label: string; variant: "secondary" | "warning" | "destructive" | "default" }
> = {
  pending: { label: "待機中", variant: "secondary" },
  downloading: { label: "ダウンロード中", variant: "secondary" },
  ready: { label: "準備完了", variant: "secondary" },
  transcribing: { label: "文字起こし中", variant: "warning" },
  transcribed: { label: "文字起こし完了", variant: "secondary" },
  analyzing: { label: "分析中", variant: "warning" },
  completed: { label: "完了", variant: "default" },
  failed: { label: "失敗", variant: "destructive" },
};

export default function RecordingsPage() {
  const router = useRouter();
  const { user } = useAuthStore();

  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const limit = 20;

  const fetchRecordings = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      if (searchQuery) {
        params.append("search", searchQuery);
      }

      if (statusFilter !== "all") {
        params.append("status", statusFilter);
      }

      const response = await fetch(`/api/recordings?${params.toString()}`);

      if (!response.ok) {
        throw new Error("データの取得に失敗しました");
      }

      const result: ApiResponse = await response.json();
      setRecordings(result.data || []);
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error ? err.message : "不明なエラーが発生しました"
      );
      setRecordings([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRecordings();
  }, [page, statusFilter]);

  const handleSearch = () => {
    setPage(1);
    fetchRecordings();
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setStatusFilter(e.target.value);
    setPage(1);
  };

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">録画一覧</h1>
        <p className="text-muted-foreground">
          Zoomミーティングの録画を確認・分析できます
        </p>
      </div>

      {/* コントロールバー */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="タイトルで検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="pl-10"
            />
          </div>
          <Button onClick={handleSearch} disabled={isLoading}>
            検索
          </Button>
        </div>

        <select
          value={statusFilter}
          onChange={handleStatusChange}
          className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="all">すべてのステータス</option>
          <option value="completed">完了</option>
          <option value="analyzing">分析中</option>
          <option value="pending">待機中</option>
          <option value="failed">失敗</option>
        </select>
      </div>

      {/* エラー表示 */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-destructive/10 text-destructive rounded-lg border border-destructive/20">
          <AlertCircle className="h-5 w-5" />
          <p>{error}</p>
        </div>
      )}

      {/* ローディング表示 */}
      {isLoading && (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">読み込み中...</span>
        </div>
      )}

      {/* 録画リスト */}
      {!isLoading && (
        <>
          {recordings.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              該当する録画データはありません
            </div>
          ) : (
            <div className="space-y-4">
              {recordings.map((recording) => {
                const config = STATUS_CONFIG[recording.status];

                return (
                  <Card
                    key={recording.id}
                    className="hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => router.push(`/recordings/${recording.id}`)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-medium">
                            {recording.topic || "（タイトルなし）"}
                          </h3>
                          <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
                            <span>{formatDate(recording.start_time)}</span>
                            <span>{formatDuration(recording.duration)}</span>
                            <span>{recording.zoom_accounts?.display_name}</span>
                          </div>
                        </div>
                        <Badge variant={config.variant}>{config.label}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* ページネーション */}
          <div className="flex justify-center items-center gap-4 pt-6">
            <Button
              variant="outline"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1 || isLoading}
            >
              前へ
            </Button>
            <span className="text-sm font-medium">ページ: {page}</span>
            <Button
              variant="outline"
              onClick={() => setPage((p) => p + 1)}
              disabled={recordings.length < limit || isLoading}
            >
              次へ
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
