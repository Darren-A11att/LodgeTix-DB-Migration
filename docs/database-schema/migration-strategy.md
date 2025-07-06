# Contact-Centric Architecture Migration Strategy

## Overview
This document outlines the strategy for migrating from the current fragmented person data model to a unified contact-centric architecture. The migration will consolidate duplicate person data across users, registrations, and attendees collections into a central contacts collection.

## Current State Analysis

### Data Fragmentation
Person data is currently duplicated across multiple collections:
- **Users**: Authentication and profile data
- **Registrations**: Registrant contact information
- **Attendees**: Event-specific attendee details
- **Organisations**: Member lists with basic info

### Issues with Current Approach
1. Data inconsistency when person updates their information
2. No single source of truth for contact details
3. Difficulty tracking a person across different contexts
4. Redundant storage of dietary requirements and special needs
5. Complex queries to find all touchpoints for a person

## Target Architecture

### Contact-Centric Model
- **Contacts Collection**: Master repository for all person data
- **Users Collection**: Authentication only, references contacts
- **Registrations**: References contacts for registrants
- **Attendees**: References contacts with event-specific overrides
- **Organisations**: Member lists reference contacts

### Benefits
1. Single source of truth for person information
2. Consistent data across all touchpoints
3. Simplified updates and maintenance
4. Better data quality and deduplication
5. Enhanced reporting and analytics

## Migration Phases

### Phase 1: Schema Updates (Completed)
✓ Create contacts collection schema
✓ Create jurisdictions collection schema
✓ Update users collection to add contactId
✓ Update registrations to reference contacts
✓ Update attendees to add contactId
✓ Update financial-transactions for contact customers
✓ Update organisations to add jurisdictionId

### Phase 2: Data Preparation
1. **Contact Deduplication**
   - Identify duplicate persons across collections
   - Match based on email, phone, and name
   - Create matching confidence scores
   - Manual review for low-confidence matches

2. **Data Quality Cleanup**
   - Standardize phone number formats
   - Validate email addresses
   - Clean and normalize names
   - Consolidate dietary requirements and special needs

### Phase 3: Contact Creation
1. **Initial Contact Import**
   ```javascript
   // Step 1: Create contacts from users
   db.users.find({}).forEach(user => {
     const contact = {
       profile: {
         firstName: user.profile.firstName,
         lastName: user.profile.lastName,
         email: user.profile.email,
         phone: user.profile.phone,
         dietaryRequirements: user.profile.dietaryRequirements,
         specialNeeds: user.profile.specialNeeds
       },
       // ... other fields
     };
     const result = db.contacts.insertOne(contact);
     
     // Update user with contactId
     db.users.updateOne(
       { _id: user._id },
       { $set: { contactId: result.insertedId } }
     );
   });
   ```

2. **Merge Additional Data**
   - Import unique contacts from registrations
   - Import unique contacts from attendees
   - Merge masonic profile data from users

### Phase 4: Reference Updates
1. **Update Existing Records**
   ```javascript
   // Update registrations with contactId
   db.registrations.find({}).forEach(registration => {
     const contact = db.contacts.findOne({
       "profile.email": registration.registrant.email
     });
     
     if (contact) {
       db.registrations.updateOne(
         { _id: registration._id },
         { 
           $set: { 
             "registrant.contactId": contact._id,
             "registrant.type": "contact"
           } 
         }
       );
     }
   });
   ```

2. **Post-Registration Reconciliation**
   - Process attendees without contactId
   - Match based on available data
   - Create new contacts where needed
   - Update attendee records

### Phase 5: Application Updates
1. **Update API Endpoints**
   - Modify user creation to create contact first
   - Update registration flow to use contacts
   - Implement contact search and selection

2. **Update Business Logic**
   - Contact matching during registration
   - Attendee-contact reconciliation process
   - Profile update propagation

### Phase 6: Data Cleanup
1. **Remove Redundant Fields**
   - Remove profile data from users (keep only auth)
   - Remove detailed contact info from registrations
   - Clean up attendee records

2. **Archive Legacy Data**
   - Keep backup of original data
   - Document field mappings
   - Maintain audit trail

## Migration Scripts

### 1. Contact Deduplication Script
```javascript
// Find potential duplicates
db.aggregate([
  {
    $group: {
      _id: { email: "$profile.email" },
      contacts: { $push: "$$ROOT" },
      count: { $sum: 1 }
    }
  },
  { $match: { count: { $gt: 1 } } },
  { $sort: { count: -1 } }
]);
```

### 2. Jurisdiction Assignment Script
```javascript
// Assign jurisdictions to organisations
db.organisations.find({ 
  profile.type: "lodge",
  jurisdictionId: { $exists: false }
}).forEach(org => {
  // Logic to determine jurisdiction based on location and type
  const jurisdiction = determineJurisdiction(org);
  
  db.organisations.updateOne(
    { _id: org._id },
    { $set: { jurisdictionId: jurisdiction._id } }
  );
});
```

### 3. Contact Matching Script
```javascript
// Match attendees to contacts
db.attendees.find({ 
  contactId: { $exists: false },
  "profile.primaryEmail": { $exists: true }
}).forEach(attendee => {
  const contact = db.contacts.findOne({
    $or: [
      { "profile.email": attendee.profile.primaryEmail },
      { "profile.phone": attendee.profile.primaryPhone }
    ]
  });
  
  if (contact) {
    db.attendees.updateOne(
      { _id: attendee._id },
      { 
        $set: { 
          contactId: contact._id,
          contactMatched: true,
          contactMatchedAt: new Date()
        } 
      }
    );
  }
});
```

## Rollback Strategy

### Database Backups
1. Full database backup before migration
2. Collection-level backups at each phase
3. Point-in-time recovery capability

### Rollback Scripts
```javascript
// Remove contactId references
db.users.updateMany({}, { $unset: { contactId: "" } });
db.registrations.updateMany({}, { $unset: { "registrant.contactId": "" } });
db.attendees.updateMany({}, { $unset: { contactId: "", contactMatched: "", contactMatchedAt: "" } });

// Drop new collections
db.contacts.drop();
db.jurisdictions.drop();
```

### Application Rollback
1. Feature flags for new contact functionality
2. Dual-write period for safety
3. Gradual rollout by organisation/function

## Success Metrics

### Data Quality Metrics
- Percentage of users with contactId
- Percentage of attendees matched to contacts
- Reduction in duplicate person records
- Data completeness scores

### Performance Metrics
- Query performance improvements
- Storage space reduction
- API response time improvements

### Business Metrics
- Improved registration completion rates
- Reduced support tickets for profile updates
- Better event communication delivery rates

## Timeline

### Week 1-2: Data Analysis and Preparation
- Run deduplication analysis
- Create matching algorithms
- Prepare migration scripts

### Week 3-4: Test Migration
- Run migration on test environment
- Validate data integrity
- Performance testing

### Week 5-6: Production Migration
- Execute phased migration
- Monitor and validate
- Update applications

### Week 7-8: Cleanup and Optimization
- Remove redundant data
- Optimize indexes
- Documentation updates

## Risk Mitigation

### Data Loss Prevention
- Comprehensive backups
- Validation scripts at each step
- Audit trail maintenance

### Performance Impact
- Run migrations during off-peak hours
- Use batch processing
- Monitor system resources

### Business Continuity
- Maintain backward compatibility
- Gradual feature rollout
- Clear communication plan

## Post-Migration Tasks

### Monitoring
- Set up alerts for data inconsistencies
- Monitor contact matching rates
- Track API performance

### Documentation
- Update API documentation
- Create user guides
- Document new workflows

### Training
- Developer training on new architecture
- Support team training on contact management
- User communication about changes