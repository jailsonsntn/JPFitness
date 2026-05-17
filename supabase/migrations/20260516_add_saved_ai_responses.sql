-- Tabela para salvar respostas geradas por IA por usuario.
-- Execute no SQL Editor do Supabase.

create table if not exists public.saved_ai_responses (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references auth.users on delete cascade,
  response_type text not null,
  title         text not null,
  content       text not null,
  metadata      jsonb,
  created_at    timestamptz not null default now()
);

create index if not exists saved_ai_responses_user_idx
  on public.saved_ai_responses (user_id, created_at desc);

alter table public.saved_ai_responses enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'saved_ai_responses'
      and policyname = 'saved_ai_responses: all own'
  ) then
    create policy "saved_ai_responses: all own"
      on public.saved_ai_responses
      for all
      using (auth.uid() = user_id);
  end if;
end $$;
