create table if not exists shared_reports (
  id text primary key,
  report jsonb not null,
  reg_number text,
  nickname text,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

create index if not exists shared_reports_expires_at_idx
  on shared_reports (expires_at);

alter table shared_reports
  add column if not exists reg_number text,
  add column if not exists nickname text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists expires_at timestamptz;
