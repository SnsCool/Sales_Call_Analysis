-- フィードバック共有機能用のカラム追加
ALTER TABLE "feedbacks"
  ADD COLUMN IF NOT EXISTS "is_shared" boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS "shared_at" timestamp with time zone;

-- コメント
COMMENT ON COLUMN "feedbacks"."is_shared" IS 'フィードバックが営業担当者に共有されたかどうか';
COMMENT ON COLUMN "feedbacks"."shared_at" IS 'フィードバックが共有された日時';

-- インデックス
CREATE INDEX IF NOT EXISTS feedbacks_is_shared_idx ON "feedbacks"("is_shared");
CREATE INDEX IF NOT EXISTS feedbacks_target_user_shared_idx ON "feedbacks"("target_user_id", "is_shared") WHERE is_shared = true;

-- RLSポリシー更新: 一般ユーザーは共有済みフィードバックのみ閲覧可能
DROP POLICY IF EXISTS "Users can view shared feedbacks" ON "feedbacks";

CREATE POLICY "Users can view shared feedbacks"
ON "feedbacks"
FOR SELECT
TO authenticated
USING (
  -- 管理者は全てアクセス可能
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
  OR (
    -- 一般ユーザーは共有済みかつ自分宛てのフィードバックのみ
    is_shared = true
    AND target_user_id = auth.uid()
  )
);

-- 管理者のみ作成・更新可能
DROP POLICY IF EXISTS "Admins can insert feedbacks" ON "feedbacks";

CREATE POLICY "Admins can insert feedbacks"
ON "feedbacks"
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

DROP POLICY IF EXISTS "Admins can update feedbacks" ON "feedbacks";

CREATE POLICY "Admins can update feedbacks"
ON "feedbacks"
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);
