-- recordings テーブルに storage_path カラムを追加
ALTER TABLE public.recordings
  ADD COLUMN IF NOT EXISTS storage_path text;

-- コメント
COMMENT ON COLUMN public.recordings.storage_path IS 'Supabase Storageに保存された動画のパス';

-- インデックス
CREATE INDEX IF NOT EXISTS recordings_storage_path_idx ON public.recordings(storage_path) WHERE storage_path IS NOT NULL;
