-- notifications テーブルの作成
create table public.notifications (
  id uuid not null default gen_random_uuid() primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  message text not null,
  is_read boolean default false not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- インデックス
create index notifications_user_id_idx on public.notifications(user_id);
create index notifications_user_id_is_read_idx on public.notifications(user_id, is_read) where is_read = false;
create index notifications_created_at_idx on public.notifications(created_at desc);

-- RLSポリシー
alter table public.notifications enable row level security;

-- ユーザーは自分の通知のみ閲覧可能
create policy "Users can view own notifications" on public.notifications
  for select
  to authenticated
  using (user_id = auth.uid());

-- ユーザーは自分の通知のみ更新可能（既読フラグ）
create policy "Users can update own notifications" on public.notifications
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- システム（サービスロール）のみ作成可能
create policy "Service role can insert notifications" on public.notifications
  for insert
  to service_role
  with check (true);
