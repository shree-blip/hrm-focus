-- Promotion Requests table
-- Tracks promotion requests from line managers, approved/rejected by VP

create table if not exists public.promotion_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  requested_by uuid not null references auth.users(id),
  
  -- Current values (snapshot at request time)
  current_title text,
  current_salary numeric,
  
  -- Proposed new values
  new_title text not null,
  new_salary numeric not null,
  effective_date date not null,
  reason text,
  
  -- Approval workflow
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  rejection_reason text,
  
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_promotion_requests_employee on public.promotion_requests(employee_id);
create index if not exists idx_promotion_requests_status on public.promotion_requests(status);
create index if not exists idx_promotion_requests_requested_by on public.promotion_requests(requested_by);

-- Enable RLS
alter table public.promotion_requests enable row level security;

-- RLS Policies
-- Managers/VPs/Admins can view all promotion requests
create policy "Managers can view promotion requests"
  on public.promotion_requests for select
  using (
    exists (
      select 1 from public.user_roles
      where user_roles.user_id = auth.uid()
      and user_roles.role in ('admin', 'vp', 'manager', 'line_manager', 'supervisor')
    )
  );

-- Line managers can insert promotion requests
create policy "Line managers can create promotion requests"
  on public.promotion_requests for insert
  with check (
    requested_by = auth.uid()
    and exists (
      select 1 from public.user_roles
      where user_roles.user_id = auth.uid()
      and user_roles.role in ('admin', 'vp', 'manager', 'line_manager', 'supervisor')
    )
  );

-- VP/Admin can update (approve/reject)
create policy "VP can update promotion requests"
  on public.promotion_requests for update
  using (
    exists (
      select 1 from public.user_roles
      where user_roles.user_id = auth.uid()
      and user_roles.role in ('admin', 'vp')
    )
  );

-- Promotion audit log
create table if not exists public.promotion_history (
  id uuid primary key default gen_random_uuid(),
  promotion_request_id uuid references public.promotion_requests(id) on delete set null,
  employee_id uuid not null references public.employees(id) on delete cascade,
  
  previous_title text,
  new_title text not null,
  previous_salary numeric,
  new_salary numeric not null,
  effective_date date not null,
  
  approved_by uuid references auth.users(id),
  reason text,
  
  created_at timestamptz not null default now()
);

-- Enable RLS on audit log
alter table public.promotion_history enable row level security;

create policy "Managers can view promotion history"
  on public.promotion_history for select
  using (
    exists (
      select 1 from public.user_roles
      where user_roles.user_id = auth.uid()
      and user_roles.role in ('admin', 'vp', 'manager', 'line_manager', 'supervisor')
    )
  );

create policy "System can insert promotion history"
  on public.promotion_history for insert
  with check (
    exists (
      select 1 from public.user_roles
      where user_roles.user_id = auth.uid()
      and user_roles.role in ('admin', 'vp')
    )
  );

-- Enable realtime for promotion_requests
alter publication supabase_realtime add table public.promotion_requests;
