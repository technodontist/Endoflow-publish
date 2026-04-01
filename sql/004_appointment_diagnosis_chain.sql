-- Session 10 Phase 3: Appointment ↔ Diagnosis Chain
-- Adds columns so appointments know WHY they were created:
-- which tooth, which diagnosis, which treatment, which episode

ALTER TABLE api.appointments
ADD COLUMN IF NOT EXISTS linked_episode_id UUID,
ADD COLUMN IF NOT EXISTS linked_tooth_numbers TEXT,
ADD COLUMN IF NOT EXISTS linked_diagnosis TEXT,
ADD COLUMN IF NOT EXISTS linked_treatment_plan TEXT;

-- Index for finding appointments by episode
CREATE INDEX IF NOT EXISTS idx_appointments_linked_episode
ON api.appointments (linked_episode_id)
WHERE linked_episode_id IS NOT NULL;

COMMENT ON COLUMN api.appointments.linked_episode_id IS 'Treatment episode this appointment is for (FK to treatment_episodes.id)';
COMMENT ON COLUMN api.appointments.linked_tooth_numbers IS 'JSON array of FDI tooth numbers, e.g. ["46","14"]';
COMMENT ON COLUMN api.appointments.linked_diagnosis IS 'Diagnosis that prompted this appointment';
COMMENT ON COLUMN api.appointments.linked_treatment_plan IS 'What treatment step this appointment is for';

-- Grant permissions (same pattern as existing tables)
GRANT SELECT, INSERT, UPDATE ON api.appointments TO authenticated;



so the patient is Popatlal Pandey so hello Mr how are you doing hi doctor I am fine and cannot tell you that how much pain it was until last 3 days and you give me few medications and now it is relieved or I was not able to sleep eat anything since last 3 days it was severe pain and thank you so much so can you tell me Mr Popatlal how did the pain in your tooth get started in which tooth it is exactly 4 6 2 number hello hello sensitivity in the beginning and beginning and after that the pain got elevated I can feel hot and cold also there is tenderness while doing anything so can you tell me exactly what time does it take to get this to pain relieve doctor I think I have to take medicine otherwise it is not relieved until this three days it was continuously painful I took over the counter medication for some relief but the medication you gave was working perfectly and right now I have compared to the last three days very less pain okay okay so also I can very careers to 46 is there is a Modi carries and involving the buckle surface and like almost 50% of your food structure is lost to structure is lost let's run some test the coldest will be the first and I guess yes you are negative and cold test and you are slide positive at the upper limit of PPT let's take some exercise