-- =====================================================
-- CLARITY CARE SUITE - COMPREHENSIVE DATABASE SCHEMA
-- =====================================================

-- 1. ROLE ENUM AND USER ROLES TABLE (RBAC)
-- =====================================================
CREATE TYPE public.app_role AS ENUM ('admin', 'vp', 'manager', 'employee');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'employee',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles without recursion
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to get user's highest role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1
$$;

-- RLS for user_roles
CREATE POLICY "Users can view their own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- 2. PROFILES TABLE
-- =====================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  department TEXT,
  job_title TEXT,
  location TEXT DEFAULT 'US',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'probation', 'inactive', 'on_leave')),
  hire_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Managers can update profiles" ON public.profiles
  FOR UPDATE USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'vp') OR 
    public.has_role(auth.uid(), 'manager')
  );

-- 3. EMPLOYEES TABLE (for non-authenticated employee records)
-- =====================================================
CREATE TABLE public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  employee_id TEXT UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  department TEXT,
  job_title TEXT,
  location TEXT DEFAULT 'US',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'probation', 'inactive', 'on_leave')),
  hire_date DATE,
  termination_date DATE,
  manager_id UUID REFERENCES public.employees(id),
  hourly_rate DECIMAL(10,2),
  salary DECIMAL(12,2),
  pay_type TEXT DEFAULT 'salary' CHECK (pay_type IN ('hourly', 'salary', 'contractor')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view employees" ON public.employees
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Managers can insert employees" ON public.employees
  FOR INSERT TO authenticated WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'vp') OR 
    public.has_role(auth.uid(), 'manager')
  );

CREATE POLICY "Managers can update employees" ON public.employees
  FOR UPDATE TO authenticated USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'vp') OR 
    public.has_role(auth.uid(), 'manager')
  );

-- 4. ATTENDANCE / TIME TRACKING
-- =====================================================
CREATE TABLE public.attendance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
  clock_in TIMESTAMP WITH TIME ZONE NOT NULL,
  clock_out TIMESTAMP WITH TIME ZONE,
  break_start TIMESTAMP WITH TIME ZONE,
  break_end TIMESTAMP WITH TIME ZONE,
  total_break_minutes INTEGER DEFAULT 0,
  clock_type TEXT DEFAULT 'payroll' CHECK (clock_type IN ('payroll', 'billable')),
  client_id UUID,
  location_lat DECIMAL(10,8),
  location_lng DECIMAL(11,8),
  location_name TEXT,
  notes TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'break', 'completed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own attendance" ON public.attendance_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own attendance" ON public.attendance_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own attendance" ON public.attendance_logs
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Managers can view all attendance" ON public.attendance_logs
  FOR SELECT USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'vp') OR 
    public.has_role(auth.uid(), 'manager')
  );

-- 5. LEAVE MANAGEMENT
-- =====================================================
CREATE TABLE public.leave_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  leave_type TEXT NOT NULL,
  total_days INTEGER NOT NULL DEFAULT 0,
  used_days INTEGER NOT NULL DEFAULT 0,
  year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, leave_type, year)
);

ALTER TABLE public.leave_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own balances" ON public.leave_balances
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Managers can view all balances" ON public.leave_balances
  FOR SELECT USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'vp') OR 
    public.has_role(auth.uid(), 'manager')
  );

CREATE POLICY "System can update balances" ON public.leave_balances
  FOR ALL USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'vp')
  );

CREATE TABLE public.leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  leave_type TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days INTEGER NOT NULL,
  reason TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own requests" ON public.leave_requests
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own requests" ON public.leave_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own pending requests" ON public.leave_requests
  FOR UPDATE USING (auth.uid() = user_id AND status = 'pending');

CREATE POLICY "Managers can view all requests" ON public.leave_requests
  FOR SELECT USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'vp') OR 
    public.has_role(auth.uid(), 'manager')
  );

CREATE POLICY "Managers can update requests" ON public.leave_requests
  FOR UPDATE USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'vp') OR 
    public.has_role(auth.uid(), 'manager')
  );
CREATE POLICY "All users can view approved leaves for team calendar"
ON public.leave_requests
FOR SELECT
USING (status = 'approved');

-- 6. TASKS
-- =====================================================
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  client_name TEXT,
  assignee_id UUID REFERENCES auth.users(id),
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  status TEXT DEFAULT 'todo' CHECK (status IN ('todo', 'in-progress', 'review', 'done')),
  due_date DATE,
  time_estimate TEXT,
  is_recurring BOOLEAN DEFAULT false,
  recurrence_pattern TEXT,
  parent_task_id UUID REFERENCES public.tasks(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view tasks" ON public.tasks
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create tasks" ON public.tasks
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Task owners and assignees can update" ON public.tasks
  FOR UPDATE USING (auth.uid() = created_by OR auth.uid() = assignee_id);

CREATE POLICY "Managers can manage all tasks" ON public.tasks
  FOR ALL USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'vp') OR 
    public.has_role(auth.uid(), 'manager')
  );

-- Task checklists
CREATE TABLE public.task_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  completed_by UUID REFERENCES auth.users(id),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.task_checklists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage checklists" ON public.task_checklists
  FOR ALL TO authenticated USING (true);

-- 7. DOCUMENTS
-- =====================================================
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  category TEXT DEFAULT 'General',
  uploaded_by UUID REFERENCES auth.users(id) NOT NULL,
  employee_id UUID REFERENCES public.employees(id),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'draft', 'signed', 'completed', 'approved', 'archived')),
  requires_signature BOOLEAN DEFAULT false,
  signed_at TIMESTAMP WITH TIME ZONE,
  signed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view documents" ON public.documents
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can upload documents" ON public.documents
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Managers can manage documents" ON public.documents
  FOR ALL USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'vp') OR 
    public.has_role(auth.uid(), 'manager')
  );

-- 8. ONBOARDING
-- =====================================================
CREATE TABLE public.onboarding_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in-progress', 'completed', 'cancelled')),
  start_date DATE NOT NULL,
  target_completion_date DATE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.onboarding_workflows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view onboarding" ON public.onboarding_workflows
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Managers can manage onboarding" ON public.onboarding_workflows
  FOR ALL USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'vp') OR 
    public.has_role(auth.uid(), 'manager')
  );

CREATE TABLE public.onboarding_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID REFERENCES public.onboarding_workflows(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  task_type TEXT DEFAULT 'general' CHECK (task_type IN ('offer_letter', 'background_check', 'nda', 'it_setup', 'orientation', 'general')),
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  completed_by UUID REFERENCES auth.users(id),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.onboarding_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view onboarding tasks" ON public.onboarding_tasks
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Managers can manage onboarding tasks" ON public.onboarding_tasks
  FOR ALL USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'vp') OR 
    public.has_role(auth.uid(), 'manager')
  );

-- 9. OFFBOARDING
-- =====================================================
CREATE TABLE public.offboarding_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in-progress', 'completed', 'cancelled')),
  resignation_date DATE,
  last_working_date DATE NOT NULL,
  reason TEXT,
  exit_interview_completed BOOLEAN DEFAULT false,
  assets_recovered BOOLEAN DEFAULT false,
  access_revoked BOOLEAN DEFAULT false,
  final_settlement_processed BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.offboarding_workflows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can manage offboarding" ON public.offboarding_workflows
  FOR ALL USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'vp') OR 
    public.has_role(auth.uid(), 'manager')
  );

-- 10. PAYROLL
-- =====================================================
CREATE TABLE public.payroll_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  region TEXT DEFAULT 'US' CHECK (region IN ('US', 'Nepal')),
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'processing', 'completed', 'cancelled')),
  total_gross DECIMAL(12,2),
  total_net DECIMAL(12,2),
  total_deductions DECIMAL(12,2),
  employee_count INTEGER,
  processed_by UUID REFERENCES auth.users(id),
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can view payroll" ON public.payroll_runs
  FOR SELECT USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'vp') OR 
    public.has_role(auth.uid(), 'manager')
  );

CREATE POLICY "VP and Admin can manage payroll" ON public.payroll_runs
  FOR ALL USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'vp')
  );

CREATE TABLE public.payslips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_run_id UUID REFERENCES public.payroll_runs(id) ON DELETE CASCADE NOT NULL,
  employee_id UUID REFERENCES public.employees(id) NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  gross_pay DECIMAL(10,2) NOT NULL,
  net_pay DECIMAL(10,2) NOT NULL,
  deductions JSONB DEFAULT '{}',
  hours_worked DECIMAL(6,2),
  overtime_hours DECIMAL(6,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own payslips" ON public.payslips
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Managers can view all payslips" ON public.payslips
  FOR SELECT USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'vp') OR 
    public.has_role(auth.uid(), 'manager')
  );

-- 11. NOTIFICATIONS
-- =====================================================
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info' CHECK (type IN ('info', 'warning', 'success', 'error')),
  link TEXT,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "System can create notifications" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (true);

-- 12. USER PREFERENCES
-- =====================================================
CREATE TABLE public.user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  leave_notifications BOOLEAN DEFAULT true,
  task_notifications BOOLEAN DEFAULT true,
  payroll_notifications BOOLEAN DEFAULT true,
  performance_notifications BOOLEAN DEFAULT false,
  email_digest BOOLEAN DEFAULT false,
  theme TEXT DEFAULT 'light',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own preferences" ON public.user_preferences
  FOR ALL USING (auth.uid() = user_id);

-- 13. COMPANY HOLIDAYS
-- =====================================================
CREATE TABLE public.company_holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  date DATE NOT NULL,
  region TEXT DEFAULT 'all' CHECK (region IN ('all', 'US', 'Nepal')),
  is_recurring BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.company_holidays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view holidays" ON public.company_holidays
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Managers can manage holidays" ON public.company_holidays
  FOR ALL USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'vp')
  );

-- 14. TRIGGER FOR PROFILE CREATION ON SIGNUP
-- =====================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, first_name, last_name, email)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data ->> 'first_name', 'New'), 
    COALESCE(NEW.raw_user_meta_data ->> 'last_name', 'User'),
    NEW.email
  );
  
  -- Create default role for new user
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'employee');
  
  -- Create default leave balances
  INSERT INTO public.leave_balances (user_id, leave_type, total_days) VALUES
    (NEW.id, 'Annual Leave', 20),
    (NEW.id, 'Sick Leave', 10),
    (NEW.id, 'Personal Leave', 3),
    (NEW.id, 'Comp Time', 5);
  
  -- Create default preferences
  INSERT INTO public.user_preferences (user_id) VALUES (NEW.id);
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 15. UPDATED_AT TRIGGER FUNCTION
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON public.employees FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_leave_balances_updated_at BEFORE UPDATE ON public.leave_balances FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_leave_requests_updated_at BEFORE UPDATE ON public.leave_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_onboarding_workflows_updated_at BEFORE UPDATE ON public.onboarding_workflows FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_offboarding_workflows_updated_at BEFORE UPDATE ON public.offboarding_workflows FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON public.user_preferences FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 16. INSERT INITIAL COMPANY HOLIDAYS
-- =====================================================
INSERT INTO public.company_holidays (name, date, region) VALUES
  ('New Year''s Day', '2025-01-01', 'all'),
  ('Martin Luther King Jr. Day', '2025-01-20', 'US'),
  ('Presidents'' Day', '2025-02-17', 'US'),
  ('Memorial Day', '2025-05-26', 'US'),
  ('Independence Day', '2025-07-04', 'US'),
  ('Labor Day', '2025-09-01', 'US'),
  ('Thanksgiving', '2025-11-27', 'US'),
  ('Christmas', '2025-12-25', 'all'),
  ('Dashain', '2025-10-02', 'Nepal'),
  ('Tihar', '2025-10-21', 'Nepal'),
  ('Buddha Jayanti', '2025-05-12', 'Nepal'),
  ('Republic Day', '2025-05-29', 'Nepal');

-- 17. ADD PAUSE FUNCTIONALITY TO ATTENDANCE LOGS
-- =====================================================
ALTER TABLE public.attendance_logs 
ADD COLUMN IF NOT EXISTS pause_start TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS pause_end TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS total_pause_minutes INTEGER DEFAULT 0;

-- Update the status check constraint to include 'paused' and 'auto_clocked_out'
ALTER TABLE public.attendance_logs 
DROP CONSTRAINT IF EXISTS attendance_logs_status_check;

ALTER TABLE public.attendance_logs 
ADD CONSTRAINT attendance_logs_status_check 
CHECK (status IN ('active', 'break', 'paused', 'completed', 'auto_clocked_out'));