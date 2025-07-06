# Field Name Fixes for MongoDB Migration Scripts

## Summary
Fixed field name mismatches in the migration scripts where the code was looking for camelCase field names but the MongoDB data uses snake_case.

## Changes Made

### 1. migrate-catalog-objects.js
Fixed the following field mappings:
- `event.functionId` → `event.function_id`
- `event.eventId` → `event.event_id`
- `ticket.eventId` → `ticket.event_id`
- `ticket.ticketId` → `ticket.ticket_id`
- `event.eventStart` → `event.event_start`
- `event.eventEnd` → `event.event_end`
- `event.eventIncludes` → `event.event_includes`
- `event.imageUrl` → `event.image_url`
- `ticket.inventoryMethod` → `ticket.inventory_method`
- `func.functionId` → `func.function_id`
- `func.organiserId` → `func.organiser_id`
- `func.organiserName` → `func.organiser_name`
- `func.createdBy` → `func.created_by`
- `func.createdAt` → `func.created_at`
- `func.updatedAt` → `func.updated_at`
- `func.registrationTypes` → `func.registration_types`
- `func.paymentGateways` → `func.payment_gateways`
- `func.allowPartialRegistrations` → `func.allow_partial_registrations`
- Date fields: `publishedDate` → `published_date`, `onSaleDate` → `on_sale_date`, `closedDate` → `closed_date`, `startDate` → `start_date`, `endDate` → `end_date`

### 2. migrate-contacts.js
Fixed the following field mappings:
- `user.email` → `user.primary_email` (when available)
- `attendee.attendee_id` - already using snake_case correctly

### 3. migrate-orders-payments.js
Fixed the following field mappings:
- `ticket.attendeeId` → `ticket.attendee_id`
- `registration.confirmationNumber` → `registration.confirmation_number`
- `registration.registrationType` → `registration.registration_type`
- `registration.functionId` → `registration.function_id`
- `registration.paymentStatus` → `registration.payment_status`
- `registration.registrationData` → `registration.registration_data`
- `registration.primaryAttendee` → `registration.primary_attendee`
- `registration.organisationName` → `registration.organisation_name`
- `registration.ipAddress` → `registration.ip_address`
- `registration.createdAt` → `registration.created_at`
- `registration.createdBy` → `registration.created_by`
- `registration.authUserId` → `registration.auth_user_id`
- `registration.updatedAt` → `registration.updated_at`
- `registration.updatedBy` → `registration.updated_by`
- `registration.bookingContactId` → `registration.booking_contact_id`
- `registration.organisationId` → `registration.organisation_id`
- `registration.totalPricePaid` → `registration.total_price_paid`
- `registration.totalAmountPaid` → `registration.total_amount_paid`
- `registration.stripeFee` → `registration.stripe_fee`
- `registration.squareFee` → `registration.square_fee`
- `registration.platformFeeAmount` → `registration.platform_fee_amount`
- `payment.transactionId` → `payment.transaction_id`
- `payment.customerName` → `payment.customer_name`
- `payment.grossAmount` → `payment.gross_amount`
- `payment.feeAmount` → `payment.fee_amount`
- `payment.netAmount` → `payment.net_amount`
- `payment.paymentId` → `payment.payment_id`
- `payment.cardLast4` → `payment.card_last4`
- `payment.cardBrand` → `payment.card_brand`
- `ticket.eventId` → `ticket.event_id`
- `ticket.eventTicketId` → `ticket.event_ticket_id`
- `ticket.ticketTypeId` → `ticket.ticket_type_id`
- `ticket.eventTitle` → `ticket.event_title`
- `ticket.ticketPrice` → `ticket.ticket_price`
- `ticket.originalPrice` → `ticket.original_price`
- `attendee.attendeeId` → `attendee.attendee_id`
- `attendee.firstName` → `attendee.first_name`
- `attendee.lastName` → `attendee.last_name`
- `attendee.primaryEmail` → `attendee.primary_email`
- `attendee.primaryPhone` → `attendee.primary_phone`
- `attendee.dietaryRequirements` → `attendee.dietary_requirements`
- `attendee.specialNeeds` → `attendee.special_needs`

### 4. migrate-organisations.js
Fixed the following field mappings:
- `org.organisationId` → `org.organisation_id`
- `lodge.jurisdictionId` → `lodge.jurisdiction_id`
- `org.parentOrganisationId` → `org.parent_organisation_id`
- `org.parentOrganisationName` → `org.parent_organisation_name`

### 5. migrate-jurisdictions.js
Fixed the following field mappings:
- `lodge.grandLodgeId` → `lodge.grand_lodge_id`
- `lodge.lodgeId` → `lodge.lodge_id`
- `grandLodge.grandLodgeId` → `grandLodge.grand_lodge_id`
- `grandLodge.countryCodeIso3` → `grandLodge.country_code_iso3`
- `grandLodge.stateRegion` → `grandLodge.state_region`
- `grandLodge.stateRegionCode` → `grandLodge.state_region_code`
- `grandLodge.organisationId` → `grandLodge.organisation_id`
- `grandLodge.addressLine1` → `grandLodge.address_line_1`
- `grandLodge.addressLine2` → `grandLodge.address_line_2`
- `lodge.displayName` → `lodge.display_name`
- `lodge.meetingPlace` → `lodge.meeting_place`
- `lodge.organisationId` → `lodge.organisation_id`
- `lodge.consecrationDate` → `lodge.consecration_date`
- `lodge.warrantsNumber` → `lodge.warrants_number`
- `lodge.meetingDayOfWeek` → `lodge.meeting_day_of_week`
- `lodge.meetingWeekOfMonth` → `lodge.meeting_week_of_month`
- `lodge.meetingTime` → `lodge.meeting_time`
- `lodge.areaType` → `lodge.area_type`
- `lodge.meetingFrequency` → `lodge.meeting_frequency`
- `lodge.meetingNotes` → `lodge.meeting_notes`
- `lodge.meetingExceptions` → `lodge.meeting_exceptions`

## Implementation Pattern
All fields now check for both snake_case and camelCase versions to ensure compatibility:
```javascript
// Example pattern used throughout:
const fieldValue = document.snake_case_field || document.camelCaseField;
```

This ensures the migration scripts work correctly regardless of whether the source data uses snake_case or camelCase field names.