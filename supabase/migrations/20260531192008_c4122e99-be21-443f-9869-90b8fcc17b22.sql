
-- Enums
create type public.project_role as enum ('admin','member');
create type public.task_status as enum ('todo','in_progress','done');
create type public.task_priority as enum ('low','medium','high');

-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  created_at timestamptz not null default now()
);
grant select on public.profiles to authenticated;
grant update (name) on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "profiles readable by authenticated" on public.profiles for select to authenticated using (true);
create policy "users update own profile" on public.profiles for update to authenticated using (auth.uid() = id);

-- Projects
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.projects to authenticated;
grant all on public.projects to service_role;
alter table public.projects enable row level security;

-- Project members
create table public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role project_role not null default 'member',
  created_at timestamptz not null default now(),
  unique (project_id, user_id)
);
grant select, insert, update, delete on public.project_members to authenticated;
grant all on public.project_members to service_role;
alter table public.project_members enable row level security;

-- Helper functions (security definer to avoid recursive RLS)
create or replace function public.is_project_member(_user uuid, _project uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.project_members where user_id=_user and project_id=_project);
$$;
create or replace function public.is_project_admin(_user uuid, _project uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.project_members where user_id=_user and project_id=_project and role='admin');
$$;

-- Project policies
create policy "members can view projects" on public.projects for select to authenticated
  using (public.is_project_member(auth.uid(), id));
create policy "any authenticated can create project" on public.projects for insert to authenticated
  with check (auth.uid() = created_by);
create policy "admins can update project" on public.projects for update to authenticated
  using (public.is_project_admin(auth.uid(), id));
create policy "admins can delete project" on public.projects for delete to authenticated
  using (public.is_project_admin(auth.uid(), id));

-- Project member policies
create policy "members see project members" on public.project_members for select to authenticated
  using (public.is_project_member(auth.uid(), project_id));
create policy "admins add members" on public.project_members for insert to authenticated
  with check (public.is_project_admin(auth.uid(), project_id));
create policy "admins update members" on public.project_members for update to authenticated
  using (public.is_project_admin(auth.uid(), project_id));
create policy "admins remove members" on public.project_members for delete to authenticated
  using (public.is_project_admin(auth.uid(), project_id));

-- Tasks
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  description text,
  due_date date,
  priority task_priority not null default 'medium',
  status task_status not null default 'todo',
  assignee_id uuid references auth.users(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.tasks to authenticated;
grant all on public.tasks to service_role;
alter table public.tasks enable row level security;

create policy "members view tasks" on public.tasks for select to authenticated
  using (public.is_project_member(auth.uid(), project_id));
create policy "admins create tasks" on public.tasks for insert to authenticated
  with check (public.is_project_admin(auth.uid(), project_id) and auth.uid() = created_by);
create policy "admins or assignee update tasks" on public.tasks for update to authenticated
  using (public.is_project_admin(auth.uid(), project_id) or assignee_id = auth.uid());
create policy "admins delete tasks" on public.tasks for delete to authenticated
  using (public.is_project_admin(auth.uid(), project_id));

-- updated_at trigger for tasks
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
create trigger trg_tasks_updated_at before update on public.tasks
for each row execute function public.set_updated_at();

-- Auto-create profile + bootstrap project admin trigger
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)), new.email);
  return new;
end; $$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- When a project is created, add creator as admin member
create or replace function public.handle_new_project()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.project_members (project_id, user_id, role)
  values (new.id, new.created_by, 'admin');
  return new;
end; $$;
create trigger on_project_created
  after insert on public.projects
  for each row execute function public.handle_new_project();
