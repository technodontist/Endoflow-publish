# 🚀 Complete Supabase Setup Guide for ENDOFLOW

## 📋 Prerequisites Check

First, let's verify your current Supabase project setup:

### 1. **Project Information**
- ✅ Project URL: `https://pxpfbeqlqqrjpkiqlxmi.supabase.co`
- ✅ Project ID: `pxpfbeqlqqrjpkiqlxmi`

## 🔧 **STEP 1: Supabase Dashboard Settings**

### **A. Authentication Settings**
1. Go to **Authentication** → **Settings**
2. Configure these settings:

```
Site URL: http://localhost:3000
Additional Redirect URLs: 
- http://localhost:3000/auth/callback
- http://localhost:3000/patient
- http://localhost:3000/assistant
- http://localhost:3000/dentist

Enable email confirmations: OFF (for development)
Disable email signup: OFF
Enable phone auth: OFF (unless needed)
```

### **B. API Settings**
1. Go to **Settings** → **API**
2. **Copy these values** (you'll need them):

```
Project URL: https://pxpfbeqlqqrjpkiqlxmi.supabase.co
Anon/Public Key: [Your anon key]
Service Role Key: [Your service role key - KEEP SECRET]
```

### **C. Database Settings**
1. Go to **Settings** → **Database**
2. **Enable these extensions**:
   - ✅ `uuid-ossp` (for UUID generation)
   - ✅ `pgcrypto` (for encryption functions)

## 🗄️ **STEP 2: Database Schema Setup**

### **Option A: Clean Slate Approach (Recommended)**
1. Go to **SQL Editor**
2. Run this **COMPLETE RESET** script:

```sql
-- COMPLETE SUPABASE RESET FOR ENDOFLOW
-- This creates everything from scratch

-- 1. Clean slate - drop existing api schema if it exists
DROP SCHEMA IF EXISTS api CASCADE;

-- 2. Create fresh api schema
CREATE SCHEMA api;

-- 3. Create all required tables with proper structure
CREATE TABLE api.appointment_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  appointment_type TEXT NOT NULL,
  preferred_date DATE NOT NULL,
  preferred_time TEXT NOT NULL,
  reason_for_visit TEXT NOT NULL,
  pain_level INTEGER,
  additional_notes TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
  notification_sent BOOLEAN DEFAULT FALSE,
  assigned_to UUID,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE api.assistants (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE api.dentists (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  specialty TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE api.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  dentist_id UUID REFERENCES api.dentists(id),
  assistant_id UUID REFERENCES api.assistants(id),
  appointment_request_id UUID REFERENCES api.appointment_requests(id),
  scheduled_date DATE NOT NULL,
  scheduled_time TIME NOT NULL,
  duration_minutes INTEGER DEFAULT 60,
  appointment_type TEXT NOT NULL,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled', 'no_show')),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE api.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  related_id UUID,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE api.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('patient', 'assistant', 'dentist')),
  message TEXT NOT NULL,
  is_from_patient BOOLEAN DEFAULT FALSE,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE api.treatments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  dentist_id UUID REFERENCES api.dentists(id),
  appointment_id UUID REFERENCES api.appointments(id),
  treatment_type TEXT NOT NULL,
  description TEXT,
  notes TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE api.patients (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  date_of_birth DATE,
  medical_history_summary TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE api.pending_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_data TEXT NOT NULL,
  submitted_at TIMESTAMP DEFAULT NOW() NOT NULL,
  status TEXT CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending' NOT NULL
);

-- 4. Create indexes for performance
CREATE INDEX idx_appointment_requests_patient_id ON api.appointment_requests(patient_id);
CREATE INDEX idx_appointment_requests_status ON api.appointment_requests(status);
CREATE INDEX idx_appointments_patient_id ON api.appointments(patient_id);
CREATE INDEX idx_appointments_dentist_id ON api.appointments(dentist_id);
CREATE INDEX idx_appointments_scheduled_date ON api.appointments(scheduled_date);
CREATE INDEX idx_notifications_user_id ON api.notifications(user_id);
CREATE INDEX idx_notifications_read ON api.notifications(read);
CREATE INDEX idx_messages_patient_id ON api.messages(patient_id);
CREATE INDEX idx_treatments_patient_id ON api.treatments(patient_id);

-- 5. Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 6. Add triggers
CREATE TRIGGER update_appointments_updated_at 
    BEFORE UPDATE ON api.appointments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_treatments_updated_at 
    BEFORE UPDATE ON api.treatments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 7. Grant all permissions to service_role (no RLS for development)
GRANT USAGE ON SCHEMA api TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA api TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA api TO service_role;

-- Also grant to authenticated users
GRANT USAGE ON SCHEMA api TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA api TO authenticated;

-- 8. Success message
SELECT 'COMPLETE SUPABASE SETUP SUCCESSFUL! All tables created with proper structure.' as result;
```

## 🔑 **STEP 3: Environment Variables Setup**

Update your `.env.local` file with the correct values:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL="https://pxpfbeqlqqrjpkiqlxmi.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="[YOUR_ANON_KEY_FROM_SUPABASE_DASHBOARD]"

# Service Role Key (Keep this secret!)
SUPABASE_SERVICE_ROLE_KEY="[YOUR_SERVICE_ROLE_KEY_FROM_SUPABASE_DASHBOARD]"

# Database URL (for Drizzle if needed)
POSTGRES_URL="postgresql://postgres:[YOUR_DB_PASSWORD]@db.pxpfbeqlqqrjpkiqlxmi.supabase.co:5432/postgres"
```

## 👥 **STEP 4: Test Users Setup**

### **A. Create Test Users in Authentication**
1. Go to **Authentication** → **Users**
2. **Create these test users**:

```
Patient User:
Email: patient@endoflow.com
Password: endoflow123
Role: patient

Assistant User:
Email: assistant@endoflow.com  
Password: endoflow123
Role: assistant

Dentist User:
Email: dentist@endoflow.com
Password: endoflow123
Role: dentist
```

### **B. Update Profiles Table**
Run this SQL to ensure proper user profiles:

```sql
-- Ensure profiles table matches your users
INSERT INTO public.profiles (id, role, status, full_name) VALUES
  ('d1864a3f-d700-4cb5-a737-781071d2fc16', 'patient', 'active', 'Test Patient')
ON CONFLICT (id) DO UPDATE SET
  role = EXCLUDED.role,
  status = EXCLUDED.status,
  full_name = EXCLUDED.full_name;
```

## 🧪 **STEP 5: Verification**

### **A. Test Database Structure**
```bash
node verify-fix.js
```

### **B. Test Application**
```bash
npm run dev
```

## 🔧 **STEP 6: API Settings Configuration**

### **A. Database Settings**
1. Go to **Settings** → **Database**
2. **Connection string**: Copy the connection pooler URL if using external connections

### **B. API Settings** 
1. **JWT Settings**: Use default settings
2. **CORS settings**: Add your localhost if needed

---

## 📝 **Final Checklist**

Before starting your application:

- ✅ All database tables created successfully
- ✅ Environment variables updated with correct keys
- ✅ Test users created in Authentication
- ✅ Database permissions granted properly
- ✅ No RLS blocking access (for development)

## 🚀 **Ready to Launch**

After completing all steps:
1. Restart your development server
2. Test the appointment booking functionality
3. Verify all features work correctly

Your ENDOFLOW app should now work perfectly! 🎉