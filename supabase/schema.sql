-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor → New Query)

-- Scores table
create table if not exists public.scores (
  id           uuid        default gen_random_uuid() primary key,
  player_name  text        not null check (char_length(player_name) >= 1 and char_length(player_name) <= 24),
  score        integer     not null check (score >= 0),
  created_at   timestamptz default now() not null
);

-- Index for fast leaderboard queries
create index if not exists scores_score_idx on public.scores (score desc);
create index if not exists scores_created_at_idx on public.scores (created_at desc);

-- Row Level Security
alter table public.scores enable row level security;

-- Anyone can read scores (public leaderboard)
create policy "Public read scores"
  on public.scores for select
  using (true);

-- Anyone can insert scores (anonymous play)
create policy "Public insert scores"
  on public.scores for insert
  with check (true);

-- Enable Realtime for live leaderboard
-- (Also enable in Supabase Dashboard: Database → Replication → scores table)
alter publication supabase_realtime add table public.scores;
