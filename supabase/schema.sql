-- ============================================================
-- GenoTek Hiring Agent — Supabase Schema
-- Run this in your Supabase SQL editor
-- ============================================================

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ─── Candidates ──────────────────────────────────────────────

create table if not exists candidates (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  email           text unique not null,
  phone           text,
  resume_text     text not null,
  years_experience numeric(4,1) default 0,
  skills          text[] default '{}',
  education       text,
  source          text default 'manual' check (source in ('internshala','manual','api')),
  applied_at      timestamptz default now(),
  status          text default 'pending' check (status in (
                    'pending','scored','interview_scheduled','interviewing',
                    'interview_complete','shortlisted','rejected','hired'
                  )),
  score           numeric(5,2),
  rank            integer,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index if not exists candidates_status_idx on candidates(status);
create index if not exists candidates_score_idx on candidates(score desc);
create index if not exists candidates_email_idx on candidates(email);

-- ─── Scoring Results ─────────────────────────────────────────

create table if not exists scoring_results (
  id              uuid primary key default gen_random_uuid(),
  candidate_id    uuid references candidates(id) on delete cascade,
  skills_match    numeric(5,2) not null,
  experience      numeric(5,2) not null,
  communication   numeric(5,2) not null,
  problem_solving numeric(5,2) not null,
  culture_fit     numeric(5,2) not null,
  red_flags       numeric(5,2) not null,
  composite       numeric(5,2) not null,
  reasoning       text,
  ai_detected     boolean default false,
  model_version   text default 'v1',
  scored_at       timestamptz default now()
);

create index if not exists scoring_candidate_idx on scoring_results(candidate_id);

-- ─── Interview Sessions ───────────────────────────────────────

create table if not exists interview_sessions (
  id              uuid primary key default gen_random_uuid(),
  candidate_id    uuid references candidates(id) on delete cascade,
  round           integer default 1,
  status          text default 'pending' check (status in ('pending','active','complete','abandoned')),
  tech_score      numeric(5,2),
  comm_score      numeric(5,2),
  approach_score  numeric(5,2),
  overall_score   numeric(5,2),
  red_flags       text[] default '{}',
  recommendation  text check (recommendation in ('advance','reject','hold')),
  eval_summary    text,
  started_at      timestamptz,
  completed_at    timestamptz,
  created_at      timestamptz default now()
);

create index if not exists sessions_candidate_idx on interview_sessions(candidate_id);
create index if not exists sessions_status_idx on interview_sessions(status);

-- ─── Interview Messages ───────────────────────────────────────

create table if not exists interview_messages (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid references interview_sessions(id) on delete cascade,
  role            text not null check (role in ('assistant','candidate')),
  content         text not null,
  ai_verdict      text check (ai_verdict in ('human','ai_generated','mixed')),
  ai_confidence   numeric(4,3),
  ai_reasoning    text,
  timestamp       timestamptz default now()
);

create index if not exists messages_session_idx on interview_messages(session_id);

-- ─── AI Detection Logs ────────────────────────────────────────

create table if not exists ai_detection_logs (
  id              uuid primary key default gen_random_uuid(),
  candidate_id    uuid references candidates(id) on delete cascade,
  session_id      uuid references interview_sessions(id) on delete set null,
  message_id      uuid references interview_messages(id) on delete set null,
  text_snippet    text,
  verdict         text not null,
  confidence      numeric(4,3),
  flags           jsonb default '[]',
  perplexity      numeric(6,2),
  avg_sent_len    numeric(5,2),
  reasoning       text,
  detected_at     timestamptz default now()
);

-- ─── Hiring Outcomes (Feedback Loop) ─────────────────────────

create table if not exists hiring_outcomes (
  id              uuid primary key default gen_random_uuid(),
  candidate_id    uuid references candidates(id) on delete cascade,
  session_id      uuid references interview_sessions(id) on delete set null,
  decision        text not null check (decision in ('hired','rejected','no_show','withdrew')),
  decided_by      text not null,
  notes           text,
  decided_at      timestamptz default now()
);

-- ─── Model Weights (Learning Over Time) ──────────────────────

create table if not exists model_weights (
  id              uuid primary key default gen_random_uuid(),
  version         integer unique not null,
  w_skills        numeric(4,3) default 0.25,
  w_experience    numeric(4,3) default 0.20,
  w_communication numeric(4,3) default 0.20,
  w_problem       numeric(4,3) default 0.20,
  w_culture       numeric(4,3) default 0.10,
  w_red_flags     numeric(4,3) default 0.05,
  training_n      integer default 0,
  accuracy        numeric(4,3),
  created_at      timestamptz default now()
);

-- Seed initial weights
insert into model_weights (version, w_skills, w_experience, w_communication, w_problem, w_culture, w_red_flags, training_n)
values (1, 0.25, 0.20, 0.20, 0.20, 0.10, 0.05, 0)
on conflict (version) do nothing;

-- ─── Updated_at trigger ───────────────────────────────────────

create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger candidates_updated_at
  before update on candidates
  for each row execute function update_updated_at();

-- ─── Helpful views ────────────────────────────────────────────

create or replace view candidate_summary as
select
  c.id,
  c.name,
  c.email,
  c.status,
  c.score,
  c.rank,
  c.years_experience,
  c.skills,
  c.applied_at,
  sr.composite as latest_score,
  sr.ai_detected,
  count(distinct is2.id) as interview_count,
  max(is2.overall_score) as best_interview_score
from candidates c
left join scoring_results sr on sr.candidate_id = c.id
left join interview_sessions is2 on is2.candidate_id = c.id
group by c.id, sr.composite, sr.ai_detected
order by c.score desc nulls last;

-- ─── Row Level Security (RLS) ─────────────────────────────────
-- Enable RLS — use service role key on server, anon key on client

alter table candidates enable row level security;
alter table scoring_results enable row level security;
alter table interview_sessions enable row level security;
alter table interview_messages enable row level security;
alter table ai_detection_logs enable row level security;
alter table hiring_outcomes enable row level security;
alter table model_weights enable row level security;

-- Allow service role full access (server-side API routes use this)
create policy "service_role_all" on candidates for all using (true);
create policy "service_role_all" on scoring_results for all using (true);
create policy "service_role_all" on interview_sessions for all using (true);
create policy "service_role_all" on interview_messages for all using (true);
create policy "service_role_all" on ai_detection_logs for all using (true);
create policy "service_role_all" on hiring_outcomes for all using (true);
create policy "service_role_all" on model_weights for all using (true);