-- Schéma Psoa. À exécuter une fois dans Supabase : SQL Editor > New query > Run.

create table if not exists public.user_state (
  user_id    uuid primary key references auth.users on delete cascade,
  ob         jsonb,
  prog       jsonb,
  adj        int default 0,
  reminder   jsonb,
  updated_at timestamptz default now()
);

create table if not exists public.session_logs (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users on delete cascade,
  name       text,
  rate       int check (rate between 0 and 10),
  n          int,
  created_at timestamptz default now()
);
create index if not exists session_logs_user_idx on public.session_logs (user_id, created_at);

create table if not exists public.subscriptions (
  user_id                uuid primary key references auth.users on delete cascade,
  stripe_customer_id     text unique,
  stripe_subscription_id text,
  status                 text,          -- trialing, active, past_due, canceled...
  plan                   text,          -- m, y, o
  trial_end              timestamptz,
  current_period_end     timestamptz,
  cancel_at_period_end   boolean default false,
  entitlement_until      timestamptz,   -- accès du paiement unique
  updated_at             timestamptz default now()
);

create table if not exists public.push_subscriptions (
  endpoint   text primary key,
  user_id    uuid not null references auth.users on delete cascade,
  keys       jsonb not null,
  hour       int not null default 18 check (hour between 0 and 23),
  tz         text not null default 'Europe/Paris',
  last_sent  date,
  created_at timestamptz default now()
);

-- Sécurité : chaque personne ne voit et ne modifie que ses propres lignes.
alter table public.user_state         enable row level security;
alter table public.session_logs       enable row level security;
alter table public.subscriptions      enable row level security;
alter table public.push_subscriptions enable row level security;

create policy "state_select" on public.user_state for select using (auth.uid() = user_id);
create policy "state_insert" on public.user_state for insert with check (auth.uid() = user_id);
create policy "state_update" on public.user_state for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "state_delete" on public.user_state for delete using (auth.uid() = user_id);

create policy "logs_select" on public.session_logs for select using (auth.uid() = user_id);
create policy "logs_insert" on public.session_logs for insert with check (auth.uid() = user_id);
create policy "logs_delete" on public.session_logs for delete using (auth.uid() = user_id);

-- Abonnements : lecture seule pour l'utilisateur. L'écriture se fait uniquement
-- par les fonctions serveur (clé service), jamais depuis le navigateur.
create policy "subs_select" on public.subscriptions for select using (auth.uid() = user_id);

create policy "push_select" on public.push_subscriptions for select using (auth.uid() = user_id);
create policy "push_insert" on public.push_subscriptions for insert with check (auth.uid() = user_id);
create policy "push_update" on public.push_subscriptions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "push_delete" on public.push_subscriptions for delete using (auth.uid() = user_id);
