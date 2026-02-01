-- clips テーブルの作成
create table public.clips (
  id uuid not null default gen_random_uuid() primary key,
  recording_id uuid not null references public.recordings(id) on delete cascade,
  analysis_id uuid references public.analyses(id) on delete set null,
  issue_index integer not null,
  start_ms integer not null,
  end_ms integer not null,
  storage_path text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- パフォーマンスのためのインデックス作成
create index clips_recording_id_idx on public.clips(recording_id);
create index clips_analysis_id_idx on public.clips(analysis_id);

-- RLS (Row Level Security) ポリシー設定
alter table public.clips enable row level security;

-- 管理者はフルアクセス
create policy "Admins can do all on clips" on public.clips
  for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );

-- 一般ユーザーは自分の録画に紐づくクリップのみ閲覧可能
create policy "Users can view clips of their recordings" on public.clips
  for select
  to authenticated
  using (
    exists (
      select 1 from public.recordings r
      join public.zoom_accounts za on r.zoom_account_id = za.id
      where r.id = clips.recording_id
      and za.owner_id = auth.uid()
    )
  );
