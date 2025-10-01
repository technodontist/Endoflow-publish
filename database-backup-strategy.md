# Database Backup Strategy - ENDOFLOW

## Current State Documentation
Date: 2025-09-16
Time: 17:11 UTC

### Identified Issues
1. Missing `additional_notes` column in `appointment_requests` table
2. Missing foreign key relationships
3. Missing `messages` and `treatments` tables referenced in code
4. Schema inconsistencies between Drizzle ORM definitions and actual database

### Error Log Summary
```
❌ [DB] Error creating appointment booking: {
  code: 'PGRST204',
  details: null,
  hint: null,
  message: "Could not find the 'additional_notes' column of 'appointment_requests' in the schema cache"
}

❌ [DB] Error fetching pending appointment requests: {
  code: 'PGRST200',
  details: "Searched for a foreign key relationship between 'appointment_requests' and 'patient_id' in the schema 'api', but no matches were found.",
  hint: null,
  message: "Could not find a relationship between 'appointment_requests' and 'patient_id' in the schema cache"
}
```

### Backup Strategy
1. **Before making changes**: Document current table schemas
2. **Create SQL dump**: Use pg_dump to backup current data
3. **Version control**: Ensure all changes are tracked in git
4. **Rollback plan**: Keep migration scripts to revert changes if needed

### Migration Files Available
- `0000_next_mandarin.sql` - Initial schema with profiles and patients
- `0001_create_api_schema.sql` - API schema with assistants, dentists, patients tables
- `0002_appointment_booking_system.sql` - Appointment system tables (contains the fix)
- `fix-appointment-schema.sql` - Additional fixes for appointment schema

### Next Steps
1. Apply the appointment booking system migration
2. Create missing tables (messages, treatments)
3. Verify schema integrity
4. Test application functionality