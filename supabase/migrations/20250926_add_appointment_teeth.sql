-- Migration: Add appointment_teeth table to link teeth and diagnoses to appointments
-- Created: 2025-09-26

-- 1) Table
create table if not exists api.appointment_teeth (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references api.appointments(id) on delete cascade,
  consultation_id uuid references api.consultations(id) on delete set null,
  tooth_number text not null,
  tooth_diagnosis_id uuid references api.tooth_diagnoses(id) on delete set null,
  diagnosis text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2) Indexes
create index if not exists idx_appointment_teeth_appt on api.appointment_teeth(appointment_id);
create index if not exists idx_appointment_teeth_diag on api.appointment_teeth(tooth_diagnosis_id);
create index if not exists idx_appointment_teeth_tooth on api.appointment_teeth(tooth_number);

-- 3) updated_at trigger
create or replace function api.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_update_appointment_teeth_updated_at on api.appointment_teeth;
create trigger trg_update_appointment_teeth_updated_at
  before update on api.appointment_teeth
  for each row execute function api.update_updated_at_column();

-- 4) RLS
alter table api.appointment_teeth enable row level security;

-- Staff can manage appointment_teeth
drop policy if exists "Staff can manage appointment_teeth" on api.appointment_teeth;
create policy "Staff can manage appointment_teeth" on api.appointment_teeth
  for all to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and role in ('assistant','dentist')
        and status = 'active'
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and role in ('assistant','dentist')
        and status = 'active'
    )
  );

-- Patients can view their own appointment_teeth via their appointments
drop policy if exists "Patients can view their appointment_teeth" on api.appointment_teeth;
create policy "Patients can view their appointment_teeth" on api.appointment_teeth
  for select to authenticated
  using (
    appointment_id in (
      select id from api.appointments where patient_id = auth.uid()
    )
  );
