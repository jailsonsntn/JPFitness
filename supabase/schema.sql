-- =============================================================
-- JPFitness — Schema Completo do Banco de Dados
-- Execute este script no SQL Editor do Supabase Dashboard
-- https://ntrhvtswvcqezntvpqlr.supabase.co
-- =============================================================

-- Habilitar extensão UUID
create extension if not exists "uuid-ossp";

-- =============================================================
-- TABELA: profiles (extende auth.users)
-- =============================================================
create table if not exists public.profiles (
  id              uuid references auth.users on delete cascade primary key,
  username        text unique,
  full_name       text,
  avatar_url      text,
  bio             text,
  goal            text not null default 'maintenance'
                  check (goal in ('weight_loss', 'muscle_gain', 'maintenance', 'performance')),
  weight_kg       numeric(5,2),
  height_cm       numeric(5,1),
  age             integer check (age > 0 and age < 120),
  activity_level  text default 'moderate'
                  check (activity_level in ('sedentary','light','moderate','active','very_active')),
  daily_calorie_goal integer default 2000 check (daily_calorie_goal > 0),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.profiles is 'Perfis de usuário — extensão de auth.users';

-- =============================================================
-- TABELA: workouts (planos de treino)
-- =============================================================
create table if not exists public.workouts (
  id                    uuid primary key default uuid_generate_v4(),
  user_id               uuid not null references auth.users on delete cascade,
  name                  text not null,
  description           text,
  emoji                 text default '💪',
  level                 text not null default 'intermediate'
                        check (level in ('beginner','intermediate','advanced')),
  estimated_duration_min integer check (estimated_duration_min > 0),
  is_custom             boolean not null default true,
  tags                  text[],
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

comment on table public.workouts is 'Planos de treino criados pelos usuários';

-- =============================================================
-- TABELA: workout_exercises (exercícios dentro de um plano)
-- =============================================================
create table if not exists public.workout_exercises (
  id            uuid primary key default uuid_generate_v4(),
  workout_id    uuid not null references public.workouts on delete cascade,
  exercise_id   integer,                  -- ID do exercício no wger
  exercise_name text not null,
  sets          integer not null default 3 check (sets > 0),
  reps          text not null default '10',
  rest_seconds  integer default 60 check (rest_seconds >= 0),
  weight_kg     numeric(6,2),             -- peso sugerido
  notes         text,
  order_index   integer not null default 0
);

comment on table public.workout_exercises is 'Exercícios que compõem um plano de treino';

-- =============================================================
-- TABELA: workout_logs (sessões de treino realizadas)
-- =============================================================
create table if not exists public.workout_logs (
  id               uuid primary key default uuid_generate_v4(),
  user_id          uuid not null references auth.users on delete cascade,
  workout_id       uuid references public.workouts on delete set null,
  name             text not null,
  started_at       timestamptz not null default now(),
  finished_at      timestamptz,
  duration_seconds integer check (duration_seconds >= 0),
  load_level       integer check (load_level between 1 and 5),
  load_label       text,
  completion_rate  integer check (completion_rate between 0 and 100),
  completed_sets   integer check (completed_sets >= 0),
  total_sets       integer check (total_sets >= 0),
  session_load     numeric(10,2) check (session_load >= 0),
  notes            text,
  calories_burned  integer check (calories_burned >= 0),
  rating           integer check (rating between 1 and 5),   -- avaliação subjetiva
  created_at       timestamptz not null default now()
);

comment on table public.workout_logs is 'Histórico de sessões de treino realizadas';

-- =============================================================
-- TABELA: workout_log_sets (séries realizadas em cada sessão)
-- =============================================================
create table if not exists public.workout_log_sets (
  id              uuid primary key default uuid_generate_v4(),
  log_id          uuid not null references public.workout_logs on delete cascade,
  exercise_id     integer,
  exercise_name   text not null,
  set_number      integer not null check (set_number > 0),
  reps_completed  integer check (reps_completed >= 0),
  weight_kg       numeric(6,2) check (weight_kg >= 0),
  duration_seconds integer,               -- para exercícios por tempo
  completed       boolean not null default true,
  notes           text
);

comment on table public.workout_log_sets is 'Séries individuais realizadas em uma sessão';

-- =============================================================
-- TABELA: food_logs (diário alimentar)
-- =============================================================
create table if not exists public.food_logs (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references auth.users on delete cascade,
  logged_date  date not null default current_date,
  meal_name    text not null,
  description  text,
  calories     integer not null default 0 check (calories >= 0),
  protein_g    numeric(7,2) not null default 0 check (protein_g >= 0),
  carbs_g      numeric(7,2) not null default 0 check (carbs_g >= 0),
  fat_g        numeric(7,2) not null default 0 check (fat_g >= 0),
  fiber_g      numeric(7,2) default 0 check (fiber_g >= 0),
  ai_analyzed  boolean not null default false,
  ai_rating    integer check (ai_rating between 1 and 10),
  ai_tips      text[],
  created_at   timestamptz not null default now()
);

comment on table public.food_logs is 'Diário alimentar diário com análise por IA';

-- =============================================================
-- TABELA: body_measurements (medições corporais)
-- =============================================================
create table if not exists public.body_measurements (
  id             uuid primary key default uuid_generate_v4(),
  user_id        uuid not null references auth.users on delete cascade,
  measured_date  date not null default current_date,
  weight_kg      numeric(5,2) check (weight_kg > 0),
  body_fat_pct   numeric(4,1) check (body_fat_pct between 0 and 100),
  muscle_mass_kg numeric(5,2) check (muscle_mass_kg > 0),
  bmi            numeric(4,1) check (bmi > 0),
  chest_cm       numeric(5,1) check (chest_cm > 0),
  waist_cm       numeric(5,1) check (waist_cm > 0),
  hip_cm         numeric(5,1) check (hip_cm > 0),
  arm_cm         numeric(5,1) check (arm_cm > 0),
  thigh_cm       numeric(5,1) check (thigh_cm > 0),
  calf_cm        numeric(5,1) check (calf_cm > 0),
  notes          text,
  created_at     timestamptz not null default now()
);

comment on table public.body_measurements is 'Histórico de medições corporais para acompanhar progresso';

-- =============================================================
-- TABELA: chat_messages (histórico de conversa com IA)
-- =============================================================
create table if not exists public.chat_messages (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references auth.users on delete cascade,
  role       text not null check (role in ('user','assistant')),
  content    text not null,
  created_at timestamptz not null default now()
);

comment on table public.chat_messages is 'Histórico de mensagens com o AI Trainer (Groq)';

-- =============================================================
-- TABELA: saved_ai_responses (respostas/plano gerados por IA)
-- =============================================================
create table if not exists public.saved_ai_responses (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references auth.users on delete cascade,
  response_type text not null,
  title         text not null,
  content       text not null,
  metadata      jsonb,
  created_at    timestamptz not null default now()
);

comment on table public.saved_ai_responses is 'Respostas de IA salvas pelo usuario (ex.: planos alimentares e resumos).';

-- Índice para busca rápida por usuário ordenada por data
create index if not exists chat_messages_user_created_idx
  on public.chat_messages (user_id, created_at desc);

-- =============================================================
-- TABELA: user_streaks (sequências de atividade)
-- =============================================================
create table if not exists public.user_streaks (
  id                 uuid primary key default uuid_generate_v4(),
  user_id            uuid not null unique references auth.users on delete cascade,
  current_streak     integer not null default 0 check (current_streak >= 0),
  longest_streak     integer not null default 0 check (longest_streak >= 0),
  last_activity_date date,
  total_workouts     integer not null default 0 check (total_workouts >= 0),
  total_minutes      integer not null default 0 check (total_minutes >= 0),
  updated_at         timestamptz not null default now()
);

comment on table public.user_streaks is 'Acompanhamento de sequências e estatísticas gerais do usuário';

-- =============================================================
-- TABELA: saved_exercises (favoritos da biblioteca wger)
-- =============================================================
create table if not exists public.saved_exercises (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users on delete cascade,
  exercise_id integer not null,              -- ID do exercício no wger
  exercise_name text not null,
  category    text,
  notes       text,
  saved_at    timestamptz not null default now(),
  unique(user_id, exercise_id)
);

comment on table public.saved_exercises is 'Exercícios favoritos salvos pelo usuário da biblioteca wger';

-- =============================================================
-- ÍNDICES PARA PERFORMANCE
-- =============================================================
create index if not exists workout_logs_user_date_idx    on public.workout_logs (user_id, started_at desc);
create index if not exists food_logs_user_date_idx       on public.food_logs (user_id, logged_date desc);
create index if not exists body_measurements_user_date_idx on public.body_measurements (user_id, measured_date desc);
create index if not exists workout_exercises_workout_idx on public.workout_exercises (workout_id, order_index);
create index if not exists workouts_user_idx             on public.workouts (user_id, created_at desc);
create index if not exists saved_exercises_user_idx      on public.saved_exercises (user_id, saved_at desc);
create index if not exists saved_ai_responses_user_idx   on public.saved_ai_responses (user_id, created_at desc);

-- =============================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================
alter table public.profiles           enable row level security;
alter table public.workouts           enable row level security;
alter table public.workout_exercises  enable row level security;
alter table public.workout_logs       enable row level security;
alter table public.workout_log_sets   enable row level security;
alter table public.food_logs          enable row level security;
alter table public.body_measurements  enable row level security;
alter table public.chat_messages      enable row level security;
alter table public.saved_ai_responses enable row level security;
alter table public.user_streaks       enable row level security;
alter table public.saved_exercises    enable row level security;

-- --- profiles ---
create policy "profiles: select own"
  on public.profiles for select using (auth.uid() = id);

create policy "profiles: insert own"
  on public.profiles for insert with check (auth.uid() = id);

create policy "profiles: update own"
  on public.profiles for update using (auth.uid() = id);

-- --- workouts ---
create policy "workouts: all own"
  on public.workouts for all using (auth.uid() = user_id);

-- --- workout_exercises ---
create policy "workout_exercises: all via workout"
  on public.workout_exercises for all
  using (
    exists (
      select 1 from public.workouts
      where id = workout_exercises.workout_id
        and user_id = auth.uid()
    )
  );

-- --- workout_logs ---
create policy "workout_logs: all own"
  on public.workout_logs for all using (auth.uid() = user_id);

-- --- workout_log_sets ---
create policy "workout_log_sets: all via log"
  on public.workout_log_sets for all
  using (
    exists (
      select 1 from public.workout_logs
      where id = workout_log_sets.log_id
        and user_id = auth.uid()
    )
  );

-- --- food_logs ---
create policy "food_logs: all own"
  on public.food_logs for all using (auth.uid() = user_id);

-- --- body_measurements ---
create policy "body_measurements: all own"
  on public.body_measurements for all using (auth.uid() = user_id);

-- --- chat_messages ---
create policy "chat_messages: all own"
  on public.chat_messages for all using (auth.uid() = user_id);

-- --- saved_ai_responses ---
create policy "saved_ai_responses: all own"
  on public.saved_ai_responses for all using (auth.uid() = user_id);

-- --- user_streaks ---
create policy "user_streaks: all own"
  on public.user_streaks for all using (auth.uid() = user_id);

-- --- saved_exercises ---
create policy "saved_exercises: all own"
  on public.saved_exercises for all using (auth.uid() = user_id);

-- =============================================================
-- FUNCTIONS & TRIGGERS
-- =============================================================

-- Trigger: atualizar updated_at automaticamente
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger trg_workouts_updated_at
  before update on public.workouts
  for each row execute function public.set_updated_at();

create trigger trg_streaks_updated_at
  before update on public.user_streaks
  for each row execute function public.set_updated_at();

-- Trigger: criar profile + streak ao registrar usuário
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;

  insert into public.user_streaks (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Função: atualizar streak após registrar treino
create or replace function public.update_streak_on_workout()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_last_date date;
  v_current   integer;
  v_longest   integer;
begin
  select last_activity_date, current_streak, longest_streak
  into v_last_date, v_current, v_longest
  from public.user_streaks
  where user_id = new.user_id;

  if v_last_date = current_date then
    -- Já treinou hoje, só atualiza total_workouts e total_minutes
    update public.user_streaks
    set
      total_workouts = total_workouts + 1,
      total_minutes  = total_minutes + coalesce(new.duration_seconds / 60, 0)
    where user_id = new.user_id;
  elsif v_last_date = current_date - interval '1 day' then
    -- Treinou ontem: incrementar sequência
    update public.user_streaks
    set
      current_streak     = v_current + 1,
      longest_streak     = greatest(v_longest, v_current + 1),
      last_activity_date = current_date,
      total_workouts     = total_workouts + 1,
      total_minutes      = total_minutes + coalesce(new.duration_seconds / 60, 0)
    where user_id = new.user_id;
  else
    -- Quebrou a sequência: reiniciar
    update public.user_streaks
    set
      current_streak     = 1,
      last_activity_date = current_date,
      total_workouts     = total_workouts + 1,
      total_minutes      = total_minutes + coalesce(new.duration_seconds / 60, 0)
    where user_id = new.user_id;
  end if;

  return new;
end;
$$;

create trigger trg_update_streak_on_workout
  after insert on public.workout_logs
  for each row execute function public.update_streak_on_workout();

-- Função: calcular BMI automaticamente ao registrar medição
create or replace function public.calc_bmi_on_measurement()
returns trigger language plpgsql as $$
begin
  if new.weight_kg is not null and new.height_cm is not null and new.height_cm > 0 then
    new.bmi = round((new.weight_kg / ((new.height_cm / 100.0) ^ 2))::numeric, 1);
  end if;
  return new;
end;
$$;

create trigger trg_calc_bmi
  before insert or update on public.body_measurements
  for each row execute function public.calc_bmi_on_measurement();

-- =============================================================
-- VIEWS ÚTEIS
-- =============================================================

-- View: resumo diário de nutrição
create or replace view public.daily_nutrition_summary as
select
  user_id,
  logged_date,
  count(*)                                    as meals_count,
  sum(calories)                               as total_calories,
  round(sum(protein_g)::numeric, 1)           as total_protein_g,
  round(sum(carbs_g)::numeric, 1)             as total_carbs_g,
  round(sum(fat_g)::numeric, 1)               as total_fat_g,
  round(sum(fiber_g)::numeric, 1)             as total_fiber_g
from public.food_logs
group by user_id, logged_date;

-- View: estatísticas de treino por semana
create or replace view public.weekly_workout_stats as
select
  user_id,
  date_trunc('week', started_at)::date        as week_start,
  count(*)                                    as total_workouts,
  sum(duration_seconds) / 60                  as total_minutes,
  sum(calories_burned)                        as total_calories_burned,
  round(avg(rating)::numeric, 1)              as avg_rating
from public.workout_logs
where finished_at is not null
group by user_id, date_trunc('week', started_at);

-- =============================================================
-- DADOS DE EXEMPLO (opcional — remova em produção)
-- =============================================================
-- Descomente para inserir dados de teste após criar um usuário:
--
-- insert into public.body_measurements (user_id, weight_kg, height_cm)
-- values ('<seu-user-id>', 80.0, 175.0);
