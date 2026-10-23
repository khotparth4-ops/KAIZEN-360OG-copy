# Supabase ERD patch: missing items

**Scope:** Supabase `campus` schema in project `Campus360`. Cross-checked against the live schema on 2026-10-23.

The three supplied diagrams cover 39 of the 48 `campus` tables. These nine tables were missing and are added below as append-ready Mermaid source:

- Accounts, college structure, and timetable: `audit_log`, `rate_limits`, `settings`
- Enrollment, attendance, marks, and parent access: `attendance_audit`, `files`, `notifications`, `reminders`
- Announcements and campus features: `kaizen_reviews`, `shared_items`

The supplied diagrams were screenshots, and no editable Mermaid source was present in this repository. These blocks are the editable patch to merge into the corresponding diagrams; they do not replace or modify the screenshots.

## 1. Accounts, college structure, and timetable

Add these entities and relationships to diagram 1:

~~~mermaid
erDiagram
    AUTH_USERS ||--o| ACCOUNTS : identity
    ACCOUNTS o|--o{ AUDIT_LOG : actor
    ACCOUNTS ||--o{ SETTINGS : owns
    RATE_LIMITS {
        text bucket_key PK
        timestamptz window_start PK
    }
~~~

`AUTH_USERS` represents Supabase's external `auth.users` table, outside the `campus` schema. `campus.accounts.id` references `auth.users.id`; an auth user may have zero or one campus account. `rate_limits` has no foreign keys, so it is intentionally shown without a relationship.

## 2. Enrollment, attendance, marks, and parent access

Add these entities and relationships to diagram 2:

~~~mermaid
erDiagram
    ACCOUNTS o|--o{ ATTENDANCE_AUDIT : actor
    ACCOUNTS ||--o{ FILES : owns
    ACCOUNTS ||--o{ NOTIFICATIONS : receives
    ACCOUNTS ||--o{ REMINDERS : has
~~~

`attendance_audit.actor_account_id` is nullable. Its `record_id` column does **not** have a foreign-key constraint to `attendance_records`, so this patch does not draw an enforced relationship for that column.

## 3. Announcements and campus features

Add these entities and relationships to diagram 3:

~~~mermaid
erDiagram
    ACCOUNTS o|--o{ KAIZEN_REVIEWS : submits
    ACCOUNTS ||--o{ SHARED_ITEMS : owns
    DIVISIONS o|--o{ SHARED_ITEMS : scopes
~~~

`kaizen_reviews.account_id` and `shared_items.division_code` are nullable; the optional markers reflect that.

## Cross-check notes

- All nine omitted tables exist in the live `campus` schema.
- The account, division, and external auth links above match live foreign-key constraints.
- `audit_log.entity_id` is not a foreign key because it can refer to different entity types.
- No database tables or data were changed by this documentation patch.
