# Data Migration Examples

## Example 1: Migrating Functions with Events

This example shows how to migrate functions from the dirty database to the clean schema.

### Configuration

**Source Collections:**
- Primary: `functions`
- Additional: `events`, `locations`

**Destination Collections:**
- Primary: `functions`

### Key Field Mappings

| Destination Field | Source | Notes |
|------------------|--------|-------|
| functionId | functions.functionId | Keep existing UUID |
| slug | functions.slug | Unique identifier |
| name | events.functionName | From events collection |
| type | "multi-day-event" | Fixed value |
| status | "active" | Fixed value |
| dates.startDate | Calculate from events | Min of all event dates |
| dates.endDate | Calculate from events | Max of all event dates |
| events | Embed from events collection | Transform and embed |

## Example 2: Creating Contacts from Users

This example shows how to create the new contacts collection from existing user data.

### Configuration

**Source Collections:**
- Primary: `users`
- Additional: `registrations`, `attendees`

**Destination Collections:**
- Primary: `contacts`
- Additional: `users` (updated)

### Key Field Mappings

| Destination Field | Source | Notes |
|------------------|--------|-------|
| contactNumber | Generate | New unique ID |
| profile.firstName | users.firstName | |
| profile.lastName | users.lastName | |
| profile.email | users.email | |
| profile.phone | users.phone | |
| addresses | Transform from users | Create address array |
| masonicProfile | Extract from users | If masonic data exists |

## Example 3: Migrating Registrations with Attendees

This example shows how to migrate registrations while creating proper attendee records.

### Configuration

**Source Collections:**
- Primary: `registrations`
- Additional: `attendees`, `organisations`

**Destination Collections:**
- Primary: `registrations`
- Additional: `attendees`, `contacts`

### Key Field Mappings

| Destination Field | Source | Notes |
|------------------|--------|-------|
| registrationNumber | registrations.confirmationNumber | |
| functionId | registrations.functionId | |
| type | Determine from context | "individual" or "lodge" |
| registrant.type | Based on registration type | "contact" or "organisation" |
| registrant.contactId | Create/lookup contact | |
| attendeeIds | Link to attendees | Array of references |

## Example 4: Organisation and Jurisdiction Setup

This example shows how to create the jurisdiction hierarchy from lodges and grand lodges.

### Configuration

**Source Collections:**
- Primary: `organisations`
- Additional: `lodges`, `grandlodges`

**Destination Collections:**
- Primary: `organisations`
- Additional: `jurisdictions`

### Key Field Mappings

For Jurisdictions:
| Destination Field | Source | Notes |
|------------------|--------|-------|
| type | "craft" | For masonic lodges |
| definitions.parentName | "grandLodge" | |
| definitions.childName | "lodges" | |
| grandLodge.name | grandlodges.name | |
| grandLodge.lodges | Array from lodges | |

For Organisations:
| Destination Field | Source | Notes |
|------------------|--------|-------|
| organisationId | Generate | New ID |
| profile.name | organisations.name | |
| profile.type | "lodge" | |
| jurisdictionId | Link to created jurisdiction | |

## Tips for Successful Migration

1. **Order Matters**: Migrate in this order:
   - Jurisdictions (from grandlodges/lodges)
   - Contacts (from users/attendees)
   - Organisations (with jurisdiction links)
   - Functions (with embedded events)
   - Registrations (with contact/org links)
   - Attendees (with contact links)
   - Tickets (with all references)

2. **Handle Duplicates**: The contact-centric approach helps consolidate duplicate person records

3. **Preserve Relationships**: Always maintain foreign key relationships during migration

4. **Test First**: Run a few documents through the migration before processing all

5. **Save Mappings**: Create reusable mapping templates for each migration type