import DashboardContent from "./dashboard-content"

// Vercelビルドトレーサーの問題を回避するため動的レンダリングを強制
export const dynamic = "force-dynamic"

export default function DashboardPage() {
  return <DashboardContent />
}
