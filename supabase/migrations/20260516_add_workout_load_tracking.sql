-- Adiciona colunas para monitoramento de carga/evolucao de treino por usuario.
-- Execute no SQL Editor do Supabase.

alter table public.workout_logs
  add column if not exists load_level integer check (load_level between 1 and 5),
  add column if not exists load_label text,
  add column if not exists completion_rate integer check (completion_rate between 0 and 100),
  add column if not exists completed_sets integer check (completed_sets >= 0),
  add column if not exists total_sets integer check (total_sets >= 0),
  add column if not exists session_load numeric(10,2) check (session_load >= 0);

create index if not exists workout_logs_user_load_idx
  on public.workout_logs (user_id, started_at desc, load_level);
