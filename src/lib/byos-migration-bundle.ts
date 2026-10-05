/**
 * Customer BYOS Migration Bundle
 * Contains the complete PostgreSQL schema, enums, tables, and RLS policies
 * for deploying the Data Plane on a customer's dedicated Supabase project.
 */

export const BYOS_SCHEMA_VERSION = '1.1.0';

export const BYOS_MIGRATION_SQL = `-- ============================================================================
-- FastestHR Customer BYOS Migration Bundle (Data Plane v${BYOS_SCHEMA_VERSION})
-- Run this SQL in your dedicated Supabase project's SQL Editor
-- ============================================================================

-- 1. Metadata Tracking Table
CREATE TABLE IF NOT EXISTS public._byos_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public._byos_meta (key, value)
VALUES 
  ('migration_version', '${BYOS_SCHEMA_VERSION}'),
  ('platform', 'FastestHR'),
  ('deployed_at', now()::text)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

-- 2. Required PostgreSQL Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 3. Custom Domain Enums
DO $$ BEGIN
  CREATE TYPE public.platform_role AS ENUM ('super_admin', 'company_admin', 'hr_manager', 'recruiter', 'user');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.employee_status AS ENUM ('active', 'probation', 'on_leave', 'resigned', 'terminated', 'absconded');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.employment_type AS ENUM ('full_time', 'part_time', 'contract', 'intern');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.attendance_status AS ENUM ('present', 'absent', 'half_day', 'on_leave', 'holiday', 'weekend', 'late', 'early_leave');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.leave_request_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.payroll_status AS ENUM ('draft', 'processing', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.job_status AS ENUM ('draft', 'published', 'closed', 'archived');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.candidate_stage AS ENUM ('applied', 'screening', 'interview', 'assessment', 'offer', 'hired', 'rejected');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.interview_status AS ENUM ('scheduled', 'completed', 'cancelled', 'rescheduled');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.exit_status AS ENUM ('pending', 'approved', 'in_progress', 'completed', 'rejected');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.goal_status AS ENUM ('not_started', 'in_progress', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.review_status AS ENUM ('draft', 'active', 'completed', 'closed');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.survey_status AS ENUM ('draft', 'active', 'closed');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.ticket_status AS ENUM ('open', 'in_progress', 'resolved', 'closed');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.ticket_priority AS ENUM ('low', 'medium', 'high', 'urgent');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.course_enrollment_status AS ENUM ('enrolled', 'in_progress', 'completed');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.workflow_trigger AS ENUM ('candidate_hired', 'leave_applied', 'employee_onboarded', 'exit_initiated', 'payroll_processed', 'manual');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.chat_conversation_type AS ENUM ('dm', 'group');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.chat_participant_role AS ENUM ('admin', 'member');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.chat_message_type AS ENUM ('text', 'system');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 4. Mirrored Data Plane Domain Tables

-- Profiles (Global user shadow on tenant database)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  platform_role public.platform_role DEFAULT 'user',
  company_id UUID,
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Departments
CREATE TABLE IF NOT EXISTS public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID,
  name TEXT NOT NULL,
  description TEXT,
  manager_id UUID,
  parent_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Designations
CREATE TABLE IF NOT EXISTS public.designations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID,
  department_id UUID,
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Shifts
CREATE TABLE IF NOT EXISTS public.shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID,
  name TEXT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  half_day_time TIME,
  late_threshold_minutes INT DEFAULT 15,
  grace_period_minutes INT DEFAULT 10,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Pay Grades
CREATE TABLE IF NOT EXISTS public.pay_grades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID,
  name TEXT NOT NULL,
  min_salary NUMERIC(12,2) DEFAULT 0,
  max_salary NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Salary Structures
CREATE TABLE IF NOT EXISTS public.salary_structures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID,
  name TEXT NOT NULL,
  components JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Roles & Permissions
CREATE TABLE IF NOT EXISTS public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID,
  name TEXT NOT NULL,
  key TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  role_id UUID REFERENCES public.roles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Employees
CREATE TABLE IF NOT EXISTS public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID,
  user_id UUID,
  employee_id TEXT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  department_id UUID,
  designation_id UUID,
  manager_id UUID,
  joining_date DATE,
  employment_type public.employment_type DEFAULT 'full_time',
  status public.employee_status DEFAULT 'active',
  date_of_birth DATE,
  gender TEXT,
  address JSONB,
  bank_details JSONB,
  emergency_contacts JSONB,
  base_salary NUMERIC(12,2) DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  salary_structure_id UUID,
  pay_grade_id UUID,
  shift_id UUID,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Employee Shifts
CREATE TABLE IF NOT EXISTS public.employee_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
  shift_id UUID REFERENCES public.shifts(id) ON DELETE CASCADE,
  effective_from DATE NOT NULL,
  effective_to DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Leave Types & Balances
CREATE TABLE IF NOT EXISTS public.leave_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID,
  name TEXT NOT NULL,
  days_allowed INT NOT NULL DEFAULT 12,
  is_paid BOOLEAN DEFAULT true,
  carry_forward_days INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.leave_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
  leave_type_id UUID REFERENCES public.leave_types(id) ON DELETE CASCADE,
  year INT NOT NULL,
  total_days NUMERIC(5,2) DEFAULT 0,
  used_days NUMERIC(5,2) DEFAULT 0,
  pending_days NUMERIC(5,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(employee_id, leave_type_id, year)
);

CREATE TABLE IF NOT EXISTS public.leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID,
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
  leave_type_id UUID REFERENCES public.leave_types(id) ON DELETE RESTRICT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days_count NUMERIC(5,2) NOT NULL,
  reason TEXT,
  status public.leave_request_status DEFAULT 'pending',
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  approval_tiers JSONB DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Attendance & Holidays
CREATE TABLE IF NOT EXISTS public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID,
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  clock_in TIMESTAMPTZ,
  clock_out TIMESTAMPTZ,
  clock_in_location JSONB,
  clock_out_location JSONB,
  total_work_minutes INT DEFAULT 0,
  break_minutes INT DEFAULT 0,
  active_break_start TIMESTAMPTZ DEFAULT NULL,
  status public.attendance_status DEFAULT 'present',
  is_manual BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(employee_id, date)
);

CREATE TABLE IF NOT EXISTS public.holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID,
  name TEXT NOT NULL,
  date DATE NOT NULL,
  description TEXT,
  is_optional BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Payroll
CREATE TABLE IF NOT EXISTS public.payroll_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID,
  month INT NOT NULL,
  year INT NOT NULL,
  status public.payroll_status DEFAULT 'draft',
  total_gross NUMERIC(14,2) DEFAULT 0,
  total_deductions NUMERIC(14,2) DEFAULT 0,
  total_net NUMERIC(14,2) DEFAULT 0,
  total_employees INT DEFAULT 0,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payslips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID,
  payroll_run_id UUID REFERENCES public.payroll_runs(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
  month INT NOT NULL,
  year INT NOT NULL,
  base_salary NUMERIC(12,2) DEFAULT 0,
  earnings JSONB DEFAULT '[]'::jsonb,
  deductions JSONB DEFAULT '[]'::jsonb,
  gross_pay NUMERIC(12,2) DEFAULT 0,
  net_pay NUMERIC(12,2) DEFAULT 0,
  pdf_url TEXT,
  is_published BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Recruitment & Hiring
CREATE TABLE IF NOT EXISTS public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID,
  title TEXT NOT NULL,
  department_id UUID,
  location TEXT,
  employment_type public.employment_type DEFAULT 'full_time',
  description TEXT,
  requirements TEXT,
  experience_range TEXT,
  salary_range TEXT,
  status public.job_status DEFAULT 'draft',
  pipeline_stages JSONB DEFAULT '[]'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID,
  job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  resume_url TEXT,
  stage public.candidate_stage DEFAULT 'applied',
  rating INT DEFAULT 0,
  score NUMERIC(5,2),
  source TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.candidate_resume_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID REFERENCES public.candidates(id) ON DELETE CASCADE,
  embedding JSONB,
  extracted_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.interviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID REFERENCES public.candidates(id) ON DELETE CASCADE,
  job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE,
  interviewer_id UUID,
  title TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INT DEFAULT 30,
  status public.interview_status DEFAULT 'scheduled',
  meeting_link TEXT,
  feedback TEXT,
  rating INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_interviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID REFERENCES public.candidates(id) ON DELETE CASCADE,
  job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE,
  link_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  score NUMERIC(5,2),
  transcript JSONB,
  feedback TEXT,
  expectations JSONB,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.offer_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  custom_variables JSONB DEFAULT '[]'::jsonb,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.candidate_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID,
  candidate_id UUID REFERENCES public.candidates(id) ON DELETE CASCADE,
  job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE,
  template_id UUID,
  offer_number TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  payout NUMERIC(12,2) NOT NULL,
  joining_date DATE NOT NULL,
  html_content TEXT NOT NULL,
  pdf_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  expires_at TIMESTAMPTZ,
  custom_variable_values JSONB,
  is_predefined_html BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.recruitment_team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID,
  job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'interviewer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Onboarding & Offboarding
CREATE TABLE IF NOT EXISTS public.onboarding_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID,
  title TEXT NOT NULL,
  description TEXT,
  step_order INT NOT NULL DEFAULT 1,
  assigned_role TEXT,
  required BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.onboarding_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
  step_id UUID REFERENCES public.onboarding_steps(id) ON DELETE CASCADE,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  completed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.onboarding_document_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID,
  name TEXT NOT NULL,
  description TEXT,
  is_mandatory BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.onboarding_document_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
  requirement_id UUID REFERENCES public.onboarding_document_requirements(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.onboarding_automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID,
  name TEXT NOT NULL,
  trigger_event TEXT NOT NULL,
  actions JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.employee_exits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID,
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
  resignation_date DATE NOT NULL,
  intended_last_day DATE NOT NULL,
  approved_last_day DATE,
  reason TEXT,
  status public.exit_status DEFAULT 'pending',
  interview_feedback JSONB,
  clearance_status JSONB DEFAULT '{}'::jsonb,
  fnf_processed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Company Locations, Compliance & Culture
CREATE TABLE IF NOT EXISTS public.company_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID,
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  state TEXT,
  country TEXT,
  postal_code TEXT,
  latitude NUMERIC(10,8),
  longitude NUMERIC(11,8),
  radius_meters INT DEFAULT 200,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.compliance_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID,
  title TEXT NOT NULL,
  description TEXT,
  country TEXT,
  category TEXT,
  effective_date DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.kudos_board (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID,
  sender_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
  receiver_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  badge TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pulse_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID,
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
  mood_score INT NOT NULL,
  energy_score INT,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Performance & Goals
CREATE TABLE IF NOT EXISTS public.review_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID,
  title TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status public.review_status DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.performance_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id UUID REFERENCES public.review_cycles(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
  reviewer_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  self_rating NUMERIC(3,1),
  reviewer_rating NUMERIC(3,1),
  final_rating NUMERIC(3,1),
  strengths TEXT,
  growth_areas TEXT,
  feedback TEXT,
  status TEXT DEFAULT 'pending',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID,
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  target_value NUMERIC(10,2),
  current_value NUMERIC(10,2) DEFAULT 0,
  unit TEXT,
  due_date DATE,
  status public.goal_status DEFAULT 'not_started',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.surveys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID,
  title TEXT NOT NULL,
  description TEXT,
  questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  status public.survey_status DEFAULT 'draft',
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.survey_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id UUID REFERENCES public.surveys(id) ON DELETE CASCADE,
  employee_id UUID,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- HelpDesk & Tickets
CREATE TABLE IF NOT EXISTS public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID,
  creator_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  priority public.ticket_priority DEFAULT 'medium',
  status public.ticket_status DEFAULT 'open',
  resolution TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ticket_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES public.tickets(id) ON DELETE CASCADE,
  author_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  attachments JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Learning & Courses
CREATE TABLE IF NOT EXISTS public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID,
  title TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  modules JSONB DEFAULT '[]'::jsonb,
  duration_minutes INT DEFAULT 0,
  is_published BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.course_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
  status public.course_enrollment_status DEFAULT 'enrolled',
  progress_percent INT DEFAULT 0,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Announcements & Company Documents
CREATE TABLE IF NOT EXISTS public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID,
  title TEXT NOT NULL,
  content TEXT,
  target_audience TEXT,
  target_ids TEXT[],
  is_pinned BOOLEAN DEFAULT false,
  published_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.announcement_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID REFERENCES public.announcements(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(announcement_id, employee_id)
);

CREATE TABLE IF NOT EXISTS public.company_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID,
  title TEXT NOT NULL,
  category TEXT,
  file_url TEXT NOT NULL,
  file_size INT,
  uploaded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- SendDesk
CREATE TABLE IF NOT EXISTS public.senddesk_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  custom_variables JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.senddesk_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID,
  template_id UUID,
  document_number TEXT NOT NULL,
  recipient_name TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  payout NUMERIC(12,2),
  joining_date DATE,
  html_content TEXT NOT NULL,
  pdf_url TEXT,
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.senddesk_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID,
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tasks & Sprints
CREATE TABLE IF NOT EXISTS public.sprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID,
  name TEXT NOT NULL,
  goal TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT DEFAULT 'planned',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID,
  sprint_id UUID REFERENCES public.sprints(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  assigned_to UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'todo',
  priority TEXT DEFAULT 'medium',
  points INT DEFAULT 0,
  due_date DATE,
  parent_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.task_time_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
  minutes_spent INT NOT NULL,
  description TEXT,
  logged_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.daily_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID,
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  tasks_completed TEXT,
  tasks_in_progress TEXT,
  blockers TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Workflows
CREATE TABLE IF NOT EXISTS public.workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID,
  name TEXT NOT NULL,
  trigger_type public.workflow_trigger NOT NULL,
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.workflow_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID REFERENCES public.workflows(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending',
  payload JSONB,
  results JSONB,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Chat System
CREATE TABLE IF NOT EXISTS public.chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID,
  type public.chat_conversation_type NOT NULL DEFAULT 'dm',
  name TEXT,
  avatar_url TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.chat_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  role public.chat_participant_role NOT NULL DEFAULT 'member',
  last_read_at TIMESTAMPTZ DEFAULT now(),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  left_at TIMESTAMPTZ,
  UNIQUE(conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  message_type public.chat_message_type NOT NULL DEFAULT 'text',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.chat_presence (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'offline',
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Notifications & Audit Logs
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID,
  user_id UUID,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info',
  is_read BOOLEAN DEFAULT false,
  link TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID,
  user_id UUID,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  changes JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Meeting Scheduler
CREATE TABLE IF NOT EXISTS public.user_meeting_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  company_id UUID,
  booking_slug TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT 'Interview',
  description TEXT DEFAULT 'Welcome! Please select a convenient time on my calendar for our conversation.',
  duration_minutes INTEGER NOT NULL DEFAULT 15,
  location_type TEXT NOT NULL DEFAULT 'google_meet',
  weekly_schedule JSONB NOT NULL DEFAULT '{
    "mon": { "enabled": true, "slots": [{"start": "10:00", "end": "14:00"}, {"start": "15:00", "end": "19:00"}] },
    "tue": { "enabled": true, "slots": [{"start": "10:00", "end": "14:00"}, {"start": "15:00", "end": "19:00"}] },
    "wed": { "enabled": true, "slots": [{"start": "10:00", "end": "14:00"}, {"start": "15:00", "end": "19:00"}] },
    "thu": { "enabled": true, "slots": [{"start": "10:00", "end": "14:00"}, {"start": "15:00", "end": "19:00"}] },
    "fri": { "enabled": true, "slots": [{"start": "10:00", "end": "14:00"}, {"start": "15:00", "end": "19:00"}] },
    "sat": { "enabled": true, "slots": [{"start": "10:00", "end": "14:00"}, {"start": "15:00", "end": "19:00"}] },
    "sun": { "enabled": false, "slots": [{"start": "10:00", "end": "14:00"}] }
  }'::jsonb,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  buffer_before_minutes INTEGER NOT NULL DEFAULT 0,
  buffer_after_minutes INTEGER NOT NULL DEFAULT 0,
  min_notice_hours INTEGER NOT NULL DEFAULT 2,
  max_future_days INTEGER NOT NULL DEFAULT 7,
  google_calendar_connected BOOLEAN NOT NULL DEFAULT false,
  google_calendar_email TEXT,
  google_access_token TEXT,
  google_token_expiry TIMESTAMPTZ,
  google_refresh_token TEXT,
  google_calendar_id TEXT DEFAULT 'primary',
  auto_google_meet BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.meeting_event_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  company_id UUID,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  location_type TEXT NOT NULL DEFAULT 'google_meet',
  color TEXT DEFAULT '#6366f1',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.meeting_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID,
  host_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  event_type_id UUID REFERENCES public.meeting_event_types(id) ON DELETE SET NULL,
  guest_name TEXT NOT NULL,
  guest_email TEXT NOT NULL,
  guest_phone TEXT NOT NULL,
  guest_linkedin TEXT,
  notes TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  status TEXT NOT NULL DEFAULT 'confirmed',
  google_event_id TEXT,
  meeting_link TEXT,
  cancellation_reason TEXT,
  rescheduled_from_id UUID REFERENCES public.meeting_bookings(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Employee Login Logs
CREATE TABLE IF NOT EXISTS public.employee_login_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID,
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
  user_id UUID,
  ip_address TEXT,
  user_agent TEXT,
  device_type TEXT DEFAULT 'desktop',
  browser TEXT,
  os TEXT,
  city TEXT,
  country TEXT,
  status TEXT NOT NULL DEFAULT 'success',
  login_method TEXT DEFAULT 'password',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.get_subordinate_employee_ids(p_employee_id UUID)
RETURNS TABLE (subordinate_id UUID, depth INT, path UUID[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_employee_id IS NULL THEN RETURN; END IF;
  RETURN QUERY
  WITH RECURSIVE subordinates AS (
    SELECT e.id AS subordinate_id, 1 AS depth, ARRAY[e.id] AS path
    FROM public.employees e
    WHERE e.reporting_manager_id = p_employee_id AND e.id <> p_employee_id AND e.deleted_at IS NULL
    UNION ALL
    SELECT e.id AS subordinate_id, s.depth + 1 AS depth, s.path || e.id AS path
    FROM public.employees e
    JOIN subordinates s ON e.reporting_manager_id = s.subordinate_id
    WHERE e.deleted_at IS NULL AND NOT (e.id = ANY(s.path))
  )
  SELECT s.subordinate_id, s.depth, s.path FROM subordinates s;
END;
$$;

-- 5. High-Performance Single-Tenant RLS Policies (USING true)
DO $$
DECLARE
  tbl text;
  domain_tables text[] := ARRAY[
    'profiles', 'departments', 'designations', 'shifts', 'pay_grades', 
    'salary_structures', 'roles', 'role_permissions', 'user_roles', 
    'employees', 'employee_shifts', 'leave_types', 'leave_balances', 
    'leave_requests', 'attendance', 'holidays', 'payroll_runs', 'payslips', 
    'jobs', 'candidates', 'candidate_resume_embeddings', 'interviews', 
    'ai_interviews', 'offer_templates', 'candidate_offers', 
    'recruitment_team_members', 'onboarding_steps', 'onboarding_progress', 
    'onboarding_document_requirements', 'onboarding_document_submissions', 
    'onboarding_automations', 'employee_exits', 'company_locations', 
    'compliance_rules', 'kudos_board', 'pulse_logs', 'review_cycles', 
    'performance_reviews', 'goals', 'surveys', 'survey_responses', 
    'tickets', 'ticket_comments', 'courses', 'course_enrollments', 
    'announcements', 'announcement_reads', 'company_documents', 
    'senddesk_templates', 'senddesk_documents', 'senddesk_emails', 
    'sprints', 'tasks', 'task_time_logs', 'daily_reports', 'workflows', 
    'workflow_runs', 'chat_conversations', 'chat_participants', 
    'chat_messages', 'chat_presence', 'notifications', 'audit_logs',
    'user_meeting_settings', 'meeting_event_types', 'meeting_bookings', 'employee_login_logs'
  ];
BEGIN
  FOREACH tbl IN ARRAY domain_tables LOOP
    BEGIN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
      EXECUTE format('DROP POLICY IF EXISTS "byos_%I_all" ON public.%I;', tbl, tbl);
      EXECUTE format('CREATE POLICY "byos_%I_all" ON public.%I FOR ALL USING (true) WITH CHECK (true);', tbl, tbl);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Skipping policy for %', tbl;
    END;
  END LOOP;
END $$;

-- 6. Direct High-Speed Single-Column Indexes
CREATE INDEX IF NOT EXISTS idx_byos_employees_created_at ON public.employees(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_byos_attendance_date ON public.attendance(date DESC);
CREATE INDEX IF NOT EXISTS idx_byos_candidates_stage ON public.candidates(stage);
CREATE INDEX IF NOT EXISTS idx_byos_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_byos_chat_messages_created ON public.chat_messages(created_at DESC);

-- 7. Complete Employee Deletion Function for BYOS Database
CREATE OR REPLACE FUNCTION public.delete_employee_completely(
  p_employee_id UUID,
  p_admin_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_admin_role platform_role;
  v_admin_company_id UUID;
  v_emp RECORD;
  v_user_id UUID;
  v_company_id UUID;
  v_work_email TEXT;
  v_personal_email TEXT;
  v_avatar_url TEXT;
  v_full_name TEXT;
  v_tbl TEXT;
BEGIN
  SELECT platform_role, company_id INTO v_admin_role, v_admin_company_id FROM public.profiles WHERE id = p_admin_id;
  IF v_admin_role IS NULL OR (v_admin_role != 'company_admin' AND v_admin_role != 'super_admin') THEN
    RAISE EXCEPTION 'Unauthorized: Only Company Administrators or Super Administrators can permanently delete an employee.';
  END IF;

  SELECT id, user_id, company_id, work_email, personal_email, avatar_url, first_name, last_name
  INTO v_emp FROM public.employees WHERE id = p_employee_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Employee with ID % not found.', p_employee_id;
  END IF;

  v_user_id := v_emp.user_id;
  v_company_id := v_emp.company_id;
  v_work_email := v_emp.work_email;
  v_personal_email := v_emp.personal_email;
  v_avatar_url := v_emp.avatar_url;
  v_full_name := trim(concat(v_emp.first_name, ' ', v_emp.last_name));

  IF v_user_id IS NOT NULL AND v_user_id = p_admin_id THEN
    RAISE EXCEPTION 'Action Blocked: You cannot delete your own Administrator account.';
  END IF;

  -- Unlink reporting manager & departments
  UPDATE public.employees SET reporting_manager_id = NULL WHERE reporting_manager_id = p_employee_id;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'departments') THEN
    UPDATE public.departments SET head_id = NULL WHERE head_id = p_employee_id;
  END IF;

  -- Unlink assets
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'assets') THEN
    UPDATE public.assets SET assigned_employee_id = NULL, status = 'available' WHERE assigned_employee_id = p_employee_id;
  END IF;

  -- Unlink leave requests & reviews
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'leave_requests') THEN
    UPDATE public.leave_requests SET approved_by = NULL WHERE approved_by = p_employee_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'performance_reviews') THEN
    UPDATE public.performance_reviews SET reviewer_id = NULL WHERE reviewer_id = p_employee_id;
  END IF;

  -- Unlink tickets
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tickets') THEN
    UPDATE public.tickets SET raised_by = NULL WHERE raised_by = p_employee_id;
    IF v_user_id IS NOT NULL THEN
      UPDATE public.tickets SET assigned_to = NULL WHERE assigned_to = v_user_id;
    END IF;
  END IF;

  -- Unlink interviews
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'interviews') THEN
    UPDATE public.interviews SET interviewers = array_remove(interviewers, p_employee_id) WHERE p_employee_id = ANY(interviewers);
  END IF;

  -- Unlink user-level entities
  IF v_user_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'candidates') THEN
      UPDATE public.candidates SET assigned_to = NULL WHERE assigned_to = v_user_id;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'candidates' AND column_name = 'assigned_by') THEN
        UPDATE public.candidates SET assigned_by = NULL WHERE assigned_by = v_user_id;
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'candidates' AND column_name = 'referred_by') THEN
        UPDATE public.candidates SET referred_by = NULL WHERE referred_by = v_user_id;
      END IF;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'jobs') THEN
      UPDATE public.jobs SET posted_by = NULL WHERE posted_by = v_user_id;
    END IF;

    UPDATE public.profiles SET manager_id = NULL WHERE manager_id = v_user_id;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_roles') THEN
      UPDATE public.user_roles SET assigned_by = NULL WHERE assigned_by = v_user_id;
      DELETE FROM public.user_roles WHERE user_id = v_user_id;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'goals') THEN
      UPDATE public.goals SET created_by = NULL WHERE created_by = v_user_id;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payroll_runs') THEN
      UPDATE public.payroll_runs SET processed_by = NULL WHERE processed_by = v_user_id;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'onboarding_progress') THEN
      UPDATE public.onboarding_progress SET completed_by = NULL WHERE completed_by = v_user_id;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'kpi_daily_scores') THEN
      UPDATE public.kpi_daily_scores SET scored_by = NULL WHERE scored_by = v_user_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'kpi_monthly_scores') THEN
      UPDATE public.kpi_monthly_scores SET scored_by = NULL WHERE scored_by = v_user_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'kpi_quarterly_scores') THEN
      UPDATE public.kpi_quarterly_scores SET scored_by = NULL WHERE scored_by = v_user_id;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tasks') THEN
      UPDATE public.tasks SET assigned_by = NULL WHERE assigned_by = v_user_id;
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'task_time_logs') THEN
        DELETE FROM public.task_time_logs WHERE user_id = v_user_id;
      END IF;
      DELETE FROM public.tasks WHERE assigned_to = v_user_id;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ticket_comments') THEN
      DELETE FROM public.ticket_comments WHERE author_id = v_user_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'chat_participants') THEN
      DELETE FROM public.chat_participants WHERE user_id = v_user_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'chat_messages') THEN
      DELETE FROM public.chat_messages WHERE sender_id = v_user_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'chat_presence') THEN
      DELETE FROM public.chat_presence WHERE user_id = v_user_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'chat_conversations') THEN
      DELETE FROM public.chat_conversations WHERE created_by = v_user_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notifications') THEN
      DELETE FROM public.notifications WHERE user_id = v_user_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'daily_reports') THEN
      DELETE FROM public.daily_reports WHERE user_id = v_user_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'audit_logs') THEN
      UPDATE public.audit_logs SET actor_id = NULL WHERE actor_id = v_user_id;
    END IF;
  END IF;

  -- Child records directly linked to employee_id
  FOREACH v_tbl IN ARRAY ARRAY[
    'attendance', 'employee_shifts', 'leave_requests', 'leave_balances', 
    'payslips', 'salary_structures', 'performance_reviews', 'goals', 
    'course_enrollments', 'announcement_reads', 'survey_responses', 
    'employee_exits', 'employee_login_logs', 'kpi_daily_scores', 
    'kpi_monthly_scores', 'kpi_quarterly_scores', 'attrition_predictions', 
    'onboarding_progress', 'onboarding_document_submissions'
  ] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = v_tbl) THEN
      IF v_tbl = 'performance_reviews' THEN
        EXECUTE 'DELETE FROM public.performance_reviews WHERE reviewee_id = $1' USING p_employee_id;
      ELSIF v_tbl = 'survey_responses' THEN
        EXECUTE 'DELETE FROM public.survey_responses WHERE respondent_id = $1' USING p_employee_id;
      ELSE
        EXECUTE 'DELETE FROM public.' || quote_ident(v_tbl) || ' WHERE employee_id = $1' USING p_employee_id;
      END IF;
    END IF;
  END LOOP;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'kudos_board') THEN
    DELETE FROM public.kudos_board WHERE sender_id = p_employee_id OR receiver_id = p_employee_id;
  END IF;

  -- Delete employee & profile
  DELETE FROM public.employees WHERE id = p_employee_id;
  IF v_user_id IS NOT NULL THEN
    DELETE FROM public.profiles WHERE id = v_user_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'deleted_employee_id', p_employee_id,
    'deleted_user_id', v_user_id,
    'company_id', v_company_id,
    'work_email', v_work_email,
    'personal_email', v_personal_email,
    'full_name', v_full_name,
    'avatar_url', v_avatar_url
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.delete_employee_completely(UUID, UUID) TO authenticated, service_role;
`;
