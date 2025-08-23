# MongoDB Exact Field Matching Analysis Report

**Generated:** 2025-08-19T12:29:53.201Z
**Total Collections:** 66
**Total Unique Fields:** 2090
**Overall Consistency Score:** 93.93%

## Collection Overview

| Collection | Documents | Unique Fields |
|------------|-----------|---------------|
| registrations | 335 | 545 |
| decomposed_registrationData | 335 | 524 |
| stripePayments | 83 | 305 |
| decomposed_registrations_registrationData_level1 | 135 | 254 |
| attendees | 469 | 87 |
| squarePayments | 100 | 80 |
| decomposed_metadata | 305 | 73 |
| decomposed_attendees | 469 | 71 |
| decomposed_attendeeData | 66 | 70 |
| decomposed_registrations_registrationData_attendees_level2 | 197 | 62 |
| functions | 1 | 59 |
| decomposed_bookingContacts | 334 | 53 |
| contacts | 442 | 53 |
| events | 6 | 49 |
| decomposed_functions_metadata_level1 | 2 | 49 |
| decomposed_registrations_registrationData_metadata_level2 | 110 | 47 |
| decomposed_tickets | 860 | 46 |
| customers | 291 | 43 |
| decomposed_registrations_registrationData_bookingContact_level2 | 141 | 43 |
| locations | 2 | 42 |
| tickets | 941 | 40 |
| packages | 5 | 40 |
| decomposed_registrations_registrationData_packageDetails_level2 | 5 | 39 |
| decomposed_registrations_registrationData_comprehensiveBookingContact_level2 | 5 | 39 |
| eventTickets | 10 | 37 |
| decomposed_registrations_registrationData_tickets_level2 | 361 | 36 |
| decomposed_functions__id_buffer_level2 | 2 | 35 |
| decomposed_registrations_registrationData_selectedPackageDetails_level2 | 5 | 35 |
| decomposed_registrations__id_buffer_level2 | 143 | 35 |
| decomposed_grandLodges__id_buffer_level2 | 205 | 35 |
| organisations | 481 | 34 |
| decomposed_registrations_registrationData_metadata_billingDetails_level3 | 13 | 34 |
| decomposed_registrations__id_level1 | 135 | 33 |
| decomposed_lodgeDetails | 17 | 33 |
| decomposed_functions_metadata_sections_level2 | 2 | 33 |
| decomposed_grandLodges__id_level1 | 206 | 33 |
| decomposed_functions__id_level1 | 2 | 33 |
| decomposed_registrations_registrationData_comprehensiveLodgeDetails_level2 | 5 | 29 |
| decomposed_functions_metadata_sections_schedule_level3 | 6 | 29 |
| decomposed_functions_metadata_sections_schedule[2]_items_level4 | 2 | 27 |
| masonicProfiles | 2 | 27 |
| decomposed_functions_metadata_sections_schedule[0]_items_level4 | 2 | 27 |
| decomposed_registrations_registrationData_lodgeOrderDetails_level2 | 3 | 27 |
| decomposed_functions_metadata_sections_schedule[1]_items_level4 | 8 | 27 |
| lodges | 277 | 27 |
| grandLodges | 187 | 25 |
| decomposed_registrations_registrationData_packageDetails_eligibilityCriteria_level3 | 5 | 25 |
| decomposed_registrations_registrationData_selectedPackageDetails_eligibilityCriteria_level3 | 5 | 25 |
| decomposed_registrations_registrationData_orderDetails_level2 | 2 | 24 |
| decomposed_registrations_registrationData_packageDetails_eligibilityCriteria_rules_level4 | 10 | 24 |
| decomposed_registrations_registrationData_selectedPackageDetails_eligibilityCriteria_rules_level4 | 10 | 24 |
| decomposed_registrations_registrationData_squareAmounts_level2 | 6 | 24 |
| decomposed_functions_metadata_documents_level2 | 6 | 24 |
| decomposed_registrations_registrationData_calculatedAmounts_level2 | 5 | 23 |
| decomposed_functions_metadata_sections_details_level3 | 6 | 23 |
| decomposed_functions_metadata_attendance_level2 | 2 | 22 |
| decomposed_registrations_registrationData_attendees[0]_ticket_level3 | 2 | 22 |
| decomposed_registrations_registrationData_attendees[1]_ticket_level3 | 1 | 22 |
| decomposed_registrations_registrationData_lodgeDetails_level2 | 13 | 22 |
| decomposed_registrations_registrationData_metadata_billingDetails_country_level4 | 13 | 21 |
| decomposed_registrations_registrationData_bookingContact_stateTerritory_level3 | 11 | 21 |
| decomposed_registrations_registrationData_bookingContact_country_level3 | 11 | 21 |
| decomposed_registrations_registrationData_packageDetails_registrationTypes_level3 | 10 | 21 |
| decomposed_registrations_registrationData_metadata_billingDetails_stateTerritory_level4 | 13 | 21 |
| decomposed_registrations_registrationData_selectedPackageDetails_registrationTypes_level3 | 5 | 21 |
| payments | 0 | 0 |

## Fields Present in Multiple Collections

### _id
- **Collections:** decomposed_registrations_registrationData_metadata_billingDetails_country_level4, decomposed_functions_metadata_attendance_level2, decomposed_attendeeData, functions, decomposed_registrations__id_level1, decomposed_registrations_registrationData_calculatedAmounts_level2, grandLodges, decomposed_registrations_registrationData_orderDetails_level2, decomposed_registrations_registrationData_level1, decomposed_registrations_registrationData_packageDetails_eligibilityCriteria_rules_level4, decomposed_registrations_registrationData_attendees[0]_ticket_level3, decomposed_registrations_registrationData_bookingContact_stateTerritory_level3, registrations, decomposed_functions_metadata_sections_schedule[2]_items_level4, masonicProfiles, decomposed_metadata, decomposed_lodgeDetails, decomposed_bookingContacts, organisations, decomposed_registrations_registrationData_tickets_level2, stripePayments, squarePayments, decomposed_registrations_registrationData_selectedPackageDetails_eligibilityCriteria_rules_level4, decomposed_registrations_registrationData_bookingContact_country_level3, decomposed_functions_metadata_sections_level2, decomposed_functions_metadata_sections_schedule[0]_items_level4, decomposed_attendees, decomposed_registrations_registrationData_metadata_billingDetails_level3, eventTickets, decomposed_registrations_registrationData_packageDetails_registrationTypes_level3, decomposed_functions__id_buffer_level2, decomposed_registrations_registrationData_lodgeOrderDetails_level2, attendees, decomposed_registrations_registrationData_squareAmounts_level2, decomposed_registrations_registrationData_metadata_billingDetails_stateTerritory_level4, tickets, events, decomposed_registrations_registrationData_comprehensiveLodgeDetails_level2, locations, decomposed_registrations_registrationData_selectedPackageDetails_level2, decomposed_tickets, decomposed_functions_metadata_sections_schedule[1]_items_level4, decomposed_registrations_registrationData_packageDetails_eligibilityCriteria_level3, decomposed_registrationData, contacts, decomposed_registrations_registrationData_metadata_level2, decomposed_functions_metadata_sections_details_level3, decomposed_registrations_registrationData_packageDetails_level2, decomposed_registrations_registrationData_attendees[1]_ticket_level3, decomposed_grandLodges__id_level1, customers, decomposed_registrations_registrationData_bookingContact_level2, decomposed_registrations_registrationData_selectedPackageDetails_registrationTypes_level3, decomposed_registrations_registrationData_selectedPackageDetails_eligibilityCriteria_level3, decomposed_registrations_registrationData_comprehensiveBookingContact_level2, decomposed_functions_metadata_level1, packages, lodges, decomposed_functions_metadata_sections_schedule_level3, decomposed_registrations__id_buffer_level2, decomposed_registrations_registrationData_lodgeDetails_level2, decomposed_grandLodges__id_buffer_level2, decomposed_functions_metadata_documents_level2, decomposed_registrations_registrationData_attendees_level2, decomposed_functions__id_level1
- **Total Occurrences:** 7,849
- **Consistency Score:** 95.38%
- **Data Types by Collection:**
  - decomposed_registrations_registrationData_metadata_billingDetails_country_level4: object
  - decomposed_functions_metadata_attendance_level2: object
  - decomposed_attendeeData: object
  - functions: object
  - decomposed_registrations__id_level1: object
  - decomposed_registrations_registrationData_calculatedAmounts_level2: object
  - grandLodges: object
  - decomposed_registrations_registrationData_orderDetails_level2: object
  - decomposed_registrations_registrationData_level1: object
  - decomposed_registrations_registrationData_packageDetails_eligibilityCriteria_rules_level4: object
  - decomposed_registrations_registrationData_attendees[0]_ticket_level3: object
  - decomposed_registrations_registrationData_bookingContact_stateTerritory_level3: object
  - registrations: object
  - decomposed_functions_metadata_sections_schedule[2]_items_level4: object
  - masonicProfiles: object
  - decomposed_metadata: object
  - decomposed_lodgeDetails: object
  - decomposed_bookingContacts: object
  - organisations: object
  - decomposed_registrations_registrationData_tickets_level2: object
  - stripePayments: string
  - squarePayments: string
  - decomposed_registrations_registrationData_selectedPackageDetails_eligibilityCriteria_rules_level4: object
  - decomposed_registrations_registrationData_bookingContact_country_level3: object
  - decomposed_functions_metadata_sections_level2: object
  - decomposed_functions_metadata_sections_schedule[0]_items_level4: object
  - decomposed_attendees: object
  - decomposed_registrations_registrationData_metadata_billingDetails_level3: object
  - eventTickets: object
  - decomposed_registrations_registrationData_packageDetails_registrationTypes_level3: object
  - decomposed_functions__id_buffer_level2: object
  - decomposed_registrations_registrationData_lodgeOrderDetails_level2: object
  - attendees: object
  - decomposed_registrations_registrationData_squareAmounts_level2: object
  - decomposed_registrations_registrationData_metadata_billingDetails_stateTerritory_level4: object
  - tickets: object
  - events: object
  - decomposed_registrations_registrationData_comprehensiveLodgeDetails_level2: object
  - locations: object
  - decomposed_registrations_registrationData_selectedPackageDetails_level2: object
  - decomposed_tickets: object
  - decomposed_functions_metadata_sections_schedule[1]_items_level4: object
  - decomposed_registrations_registrationData_packageDetails_eligibilityCriteria_level3: object
  - decomposed_registrationData: object, string
  - contacts: object
  - decomposed_registrations_registrationData_metadata_level2: object
  - decomposed_functions_metadata_sections_details_level3: object
  - decomposed_registrations_registrationData_packageDetails_level2: object
  - decomposed_registrations_registrationData_attendees[1]_ticket_level3: object
  - decomposed_grandLodges__id_level1: object
  - customers: object
  - decomposed_registrations_registrationData_bookingContact_level2: object
  - decomposed_registrations_registrationData_selectedPackageDetails_registrationTypes_level3: object
  - decomposed_registrations_registrationData_selectedPackageDetails_eligibilityCriteria_level3: object
  - decomposed_registrations_registrationData_comprehensiveBookingContact_level2: object
  - decomposed_functions_metadata_level1: object
  - packages: object
  - lodges: object
  - decomposed_functions_metadata_sections_schedule_level3: object
  - decomposed_registrations__id_buffer_level2: object
  - decomposed_registrations_registrationData_lodgeDetails_level2: object
  - decomposed_grandLodges__id_buffer_level2: object
  - decomposed_functions_metadata_documents_level2: object
  - decomposed_registrations_registrationData_attendees_level2: object
  - decomposed_functions__id_level1: object

### _id.buffer
- **Collections:** decomposed_registrations_registrationData_metadata_billingDetails_country_level4, decomposed_functions_metadata_attendance_level2, decomposed_attendeeData, functions, decomposed_registrations__id_level1, decomposed_registrations_registrationData_calculatedAmounts_level2, grandLodges, decomposed_registrations_registrationData_orderDetails_level2, decomposed_registrations_registrationData_level1, decomposed_registrations_registrationData_packageDetails_eligibilityCriteria_rules_level4, decomposed_registrations_registrationData_attendees[0]_ticket_level3, decomposed_registrations_registrationData_bookingContact_stateTerritory_level3, registrations, decomposed_functions_metadata_sections_schedule[2]_items_level4, masonicProfiles, decomposed_metadata, decomposed_lodgeDetails, decomposed_bookingContacts, organisations, decomposed_registrations_registrationData_tickets_level2, decomposed_registrations_registrationData_selectedPackageDetails_eligibilityCriteria_rules_level4, decomposed_registrations_registrationData_bookingContact_country_level3, decomposed_functions_metadata_sections_level2, decomposed_functions_metadata_sections_schedule[0]_items_level4, decomposed_attendees, decomposed_registrations_registrationData_metadata_billingDetails_level3, eventTickets, decomposed_registrations_registrationData_packageDetails_registrationTypes_level3, decomposed_functions__id_buffer_level2, decomposed_registrations_registrationData_lodgeOrderDetails_level2, attendees, decomposed_registrations_registrationData_squareAmounts_level2, decomposed_registrations_registrationData_metadata_billingDetails_stateTerritory_level4, tickets, events, decomposed_registrations_registrationData_comprehensiveLodgeDetails_level2, locations, decomposed_registrations_registrationData_selectedPackageDetails_level2, decomposed_tickets, decomposed_functions_metadata_sections_schedule[1]_items_level4, decomposed_registrations_registrationData_packageDetails_eligibilityCriteria_level3, decomposed_registrationData, contacts, decomposed_registrations_registrationData_metadata_level2, decomposed_functions_metadata_sections_details_level3, decomposed_registrations_registrationData_packageDetails_level2, decomposed_registrations_registrationData_attendees[1]_ticket_level3, decomposed_grandLodges__id_level1, customers, decomposed_registrations_registrationData_bookingContact_level2, decomposed_registrations_registrationData_selectedPackageDetails_registrationTypes_level3, decomposed_registrations_registrationData_selectedPackageDetails_eligibilityCriteria_level3, decomposed_registrations_registrationData_comprehensiveBookingContact_level2, decomposed_functions_metadata_level1, packages, lodges, decomposed_functions_metadata_sections_schedule_level3, decomposed_registrations__id_buffer_level2, decomposed_registrations_registrationData_lodgeDetails_level2, decomposed_grandLodges__id_buffer_level2, decomposed_functions_metadata_documents_level2, decomposed_registrations_registrationData_attendees_level2, decomposed_functions__id_level1
- **Total Occurrences:** 7,665
- **Consistency Score:** 100.00%
- **Data Types by Collection:**
  - decomposed_registrations_registrationData_metadata_billingDetails_country_level4: object
  - decomposed_functions_metadata_attendance_level2: object
  - decomposed_attendeeData: object
  - functions: object
  - decomposed_registrations__id_level1: object
  - decomposed_registrations_registrationData_calculatedAmounts_level2: object
  - grandLodges: object
  - decomposed_registrations_registrationData_orderDetails_level2: object
  - decomposed_registrations_registrationData_level1: object
  - decomposed_registrations_registrationData_packageDetails_eligibilityCriteria_rules_level4: object
  - decomposed_registrations_registrationData_attendees[0]_ticket_level3: object
  - decomposed_registrations_registrationData_bookingContact_stateTerritory_level3: object
  - registrations: object
  - decomposed_functions_metadata_sections_schedule[2]_items_level4: object
  - masonicProfiles: object
  - decomposed_metadata: object
  - decomposed_lodgeDetails: object
  - decomposed_bookingContacts: object
  - organisations: object
  - decomposed_registrations_registrationData_tickets_level2: object
  - decomposed_registrations_registrationData_selectedPackageDetails_eligibilityCriteria_rules_level4: object
  - decomposed_registrations_registrationData_bookingContact_country_level3: object
  - decomposed_functions_metadata_sections_level2: object
  - decomposed_functions_metadata_sections_schedule[0]_items_level4: object
  - decomposed_attendees: object
  - decomposed_registrations_registrationData_metadata_billingDetails_level3: object
  - eventTickets: object
  - decomposed_registrations_registrationData_packageDetails_registrationTypes_level3: object
  - decomposed_functions__id_buffer_level2: object
  - decomposed_registrations_registrationData_lodgeOrderDetails_level2: object
  - attendees: object
  - decomposed_registrations_registrationData_squareAmounts_level2: object
  - decomposed_registrations_registrationData_metadata_billingDetails_stateTerritory_level4: object
  - tickets: object
  - events: object
  - decomposed_registrations_registrationData_comprehensiveLodgeDetails_level2: object
  - locations: object
  - decomposed_registrations_registrationData_selectedPackageDetails_level2: object
  - decomposed_tickets: object
  - decomposed_functions_metadata_sections_schedule[1]_items_level4: object
  - decomposed_registrations_registrationData_packageDetails_eligibilityCriteria_level3: object
  - decomposed_registrationData: object
  - contacts: object
  - decomposed_registrations_registrationData_metadata_level2: object
  - decomposed_functions_metadata_sections_details_level3: object
  - decomposed_registrations_registrationData_packageDetails_level2: object
  - decomposed_registrations_registrationData_attendees[1]_ticket_level3: object
  - decomposed_grandLodges__id_level1: object
  - customers: object
  - decomposed_registrations_registrationData_bookingContact_level2: object
  - decomposed_registrations_registrationData_selectedPackageDetails_registrationTypes_level3: object
  - decomposed_registrations_registrationData_selectedPackageDetails_eligibilityCriteria_level3: object
  - decomposed_registrations_registrationData_comprehensiveBookingContact_level2: object
  - decomposed_functions_metadata_level1: object
  - packages: object
  - lodges: object
  - decomposed_functions_metadata_sections_schedule_level3: object
  - decomposed_registrations__id_buffer_level2: object
  - decomposed_registrations_registrationData_lodgeDetails_level2: object
  - decomposed_grandLodges__id_buffer_level2: object
  - decomposed_functions_metadata_documents_level2: object
  - decomposed_registrations_registrationData_attendees_level2: object
  - decomposed_functions__id_level1: object

### _id.buffer.0
- **Collections:** decomposed_registrations_registrationData_metadata_billingDetails_country_level4, decomposed_functions_metadata_attendance_level2, decomposed_attendeeData, functions, decomposed_registrations__id_level1, decomposed_registrations_registrationData_calculatedAmounts_level2, grandLodges, decomposed_registrations_registrationData_orderDetails_level2, decomposed_registrations_registrationData_level1, decomposed_registrations_registrationData_packageDetails_eligibilityCriteria_rules_level4, decomposed_registrations_registrationData_attendees[0]_ticket_level3, decomposed_registrations_registrationData_bookingContact_stateTerritory_level3, registrations, decomposed_functions_metadata_sections_schedule[2]_items_level4, masonicProfiles, decomposed_metadata, decomposed_lodgeDetails, decomposed_bookingContacts, organisations, decomposed_registrations_registrationData_tickets_level2, decomposed_registrations_registrationData_selectedPackageDetails_eligibilityCriteria_rules_level4, decomposed_registrations_registrationData_bookingContact_country_level3, decomposed_functions_metadata_sections_level2, decomposed_functions_metadata_sections_schedule[0]_items_level4, decomposed_attendees, decomposed_registrations_registrationData_metadata_billingDetails_level3, eventTickets, decomposed_registrations_registrationData_packageDetails_registrationTypes_level3, decomposed_functions__id_buffer_level2, decomposed_registrations_registrationData_lodgeOrderDetails_level2, attendees, decomposed_registrations_registrationData_squareAmounts_level2, decomposed_registrations_registrationData_metadata_billingDetails_stateTerritory_level4, tickets, events, decomposed_registrations_registrationData_comprehensiveLodgeDetails_level2, locations, decomposed_registrations_registrationData_selectedPackageDetails_level2, decomposed_tickets, decomposed_functions_metadata_sections_schedule[1]_items_level4, decomposed_registrations_registrationData_packageDetails_eligibilityCriteria_level3, decomposed_registrationData, contacts, decomposed_registrations_registrationData_metadata_level2, decomposed_functions_metadata_sections_details_level3, decomposed_registrations_registrationData_packageDetails_level2, decomposed_registrations_registrationData_attendees[1]_ticket_level3, decomposed_grandLodges__id_level1, customers, decomposed_registrations_registrationData_bookingContact_level2, decomposed_registrations_registrationData_selectedPackageDetails_registrationTypes_level3, decomposed_registrations_registrationData_selectedPackageDetails_eligibilityCriteria_level3, decomposed_registrations_registrationData_comprehensiveBookingContact_level2, decomposed_functions_metadata_level1, packages, lodges, decomposed_functions_metadata_sections_schedule_level3, decomposed_registrations__id_buffer_level2, decomposed_registrations_registrationData_lodgeDetails_level2, decomposed_grandLodges__id_buffer_level2, decomposed_functions_metadata_documents_level2, decomposed_registrations_registrationData_attendees_level2, decomposed_functions__id_level1
- **Total Occurrences:** 7,665
- **Consistency Score:** 100.00%
- **Data Types by Collection:**
  - decomposed_registrations_registrationData_metadata_billingDetails_country_level4: number
  - decomposed_functions_metadata_attendance_level2: number
  - decomposed_attendeeData: number
  - functions: number
  - decomposed_registrations__id_level1: number
  - decomposed_registrations_registrationData_calculatedAmounts_level2: number
  - grandLodges: number
  - decomposed_registrations_registrationData_orderDetails_level2: number
  - decomposed_registrations_registrationData_level1: number
  - decomposed_registrations_registrationData_packageDetails_eligibilityCriteria_rules_level4: number
  - decomposed_registrations_registrationData_attendees[0]_ticket_level3: number
  - decomposed_registrations_registrationData_bookingContact_stateTerritory_level3: number
  - registrations: number
  - decomposed_functions_metadata_sections_schedule[2]_items_level4: number
  - masonicProfiles: number
  - decomposed_metadata: number
  - decomposed_lodgeDetails: number
  - decomposed_bookingContacts: number
  - organisations: number
  - decomposed_registrations_registrationData_tickets_level2: number
  - decomposed_registrations_registrationData_selectedPackageDetails_eligibilityCriteria_rules_level4: number
  - decomposed_registrations_registrationData_bookingContact_country_level3: number
  - decomposed_functions_metadata_sections_level2: number
  - decomposed_functions_metadata_sections_schedule[0]_items_level4: number
  - decomposed_attendees: number
  - decomposed_registrations_registrationData_metadata_billingDetails_level3: number
  - eventTickets: number
  - decomposed_registrations_registrationData_packageDetails_registrationTypes_level3: number
  - decomposed_functions__id_buffer_level2: number
  - decomposed_registrations_registrationData_lodgeOrderDetails_level2: number
  - attendees: number
  - decomposed_registrations_registrationData_squareAmounts_level2: number
  - decomposed_registrations_registrationData_metadata_billingDetails_stateTerritory_level4: number
  - tickets: number
  - events: number
  - decomposed_registrations_registrationData_comprehensiveLodgeDetails_level2: number
  - locations: number
  - decomposed_registrations_registrationData_selectedPackageDetails_level2: number
  - decomposed_tickets: number
  - decomposed_functions_metadata_sections_schedule[1]_items_level4: number
  - decomposed_registrations_registrationData_packageDetails_eligibilityCriteria_level3: number
  - decomposed_registrationData: number
  - contacts: number
  - decomposed_registrations_registrationData_metadata_level2: number
  - decomposed_functions_metadata_sections_details_level3: number
  - decomposed_registrations_registrationData_packageDetails_level2: number
  - decomposed_registrations_registrationData_attendees[1]_ticket_level3: number
  - decomposed_grandLodges__id_level1: number
  - customers: number
  - decomposed_registrations_registrationData_bookingContact_level2: number
  - decomposed_registrations_registrationData_selectedPackageDetails_registrationTypes_level3: number
  - decomposed_registrations_registrationData_selectedPackageDetails_eligibilityCriteria_level3: number
  - decomposed_registrations_registrationData_comprehensiveBookingContact_level2: number
  - decomposed_functions_metadata_level1: number
  - packages: number
  - lodges: number
  - decomposed_functions_metadata_sections_schedule_level3: number
  - decomposed_registrations__id_buffer_level2: number
  - decomposed_registrations_registrationData_lodgeDetails_level2: number
  - decomposed_grandLodges__id_buffer_level2: number
  - decomposed_functions_metadata_documents_level2: number
  - decomposed_registrations_registrationData_attendees_level2: number
  - decomposed_functions__id_level1: number

### _id.buffer.1
- **Collections:** decomposed_registrations_registrationData_metadata_billingDetails_country_level4, decomposed_functions_metadata_attendance_level2, decomposed_attendeeData, functions, decomposed_registrations__id_level1, decomposed_registrations_registrationData_calculatedAmounts_level2, grandLodges, decomposed_registrations_registrationData_orderDetails_level2, decomposed_registrations_registrationData_level1, decomposed_registrations_registrationData_packageDetails_eligibilityCriteria_rules_level4, decomposed_registrations_registrationData_attendees[0]_ticket_level3, decomposed_registrations_registrationData_bookingContact_stateTerritory_level3, registrations, decomposed_functions_metadata_sections_schedule[2]_items_level4, masonicProfiles, decomposed_metadata, decomposed_lodgeDetails, decomposed_bookingContacts, organisations, decomposed_registrations_registrationData_tickets_level2, decomposed_registrations_registrationData_selectedPackageDetails_eligibilityCriteria_rules_level4, decomposed_registrations_registrationData_bookingContact_country_level3, decomposed_functions_metadata_sections_level2, decomposed_functions_metadata_sections_schedule[0]_items_level4, decomposed_attendees, decomposed_registrations_registrationData_metadata_billingDetails_level3, eventTickets, decomposed_registrations_registrationData_packageDetails_registrationTypes_level3, decomposed_functions__id_buffer_level2, decomposed_registrations_registrationData_lodgeOrderDetails_level2, attendees, decomposed_registrations_registrationData_squareAmounts_level2, decomposed_registrations_registrationData_metadata_billingDetails_stateTerritory_level4, tickets, events, decomposed_registrations_registrationData_comprehensiveLodgeDetails_level2, locations, decomposed_registrations_registrationData_selectedPackageDetails_level2, decomposed_tickets, decomposed_functions_metadata_sections_schedule[1]_items_level4, decomposed_registrations_registrationData_packageDetails_eligibilityCriteria_level3, decomposed_registrationData, contacts, decomposed_registrations_registrationData_metadata_level2, decomposed_functions_metadata_sections_details_level3, decomposed_registrations_registrationData_packageDetails_level2, decomposed_registrations_registrationData_attendees[1]_ticket_level3, decomposed_grandLodges__id_level1, customers, decomposed_registrations_registrationData_bookingContact_level2, decomposed_registrations_registrationData_selectedPackageDetails_registrationTypes_level3, decomposed_registrations_registrationData_selectedPackageDetails_eligibilityCriteria_level3, decomposed_registrations_registrationData_comprehensiveBookingContact_level2, decomposed_functions_metadata_level1, packages, lodges, decomposed_functions_metadata_sections_schedule_level3, decomposed_registrations__id_buffer_level2, decomposed_registrations_registrationData_lodgeDetails_level2, decomposed_grandLodges__id_buffer_level2, decomposed_functions_metadata_documents_level2, decomposed_registrations_registrationData_attendees_level2, decomposed_functions__id_level1
- **Total Occurrences:** 7,665
- **Consistency Score:** 100.00%
- **Data Types by Collection:**
  - decomposed_registrations_registrationData_metadata_billingDetails_country_level4: number
  - decomposed_functions_metadata_attendance_level2: number
  - decomposed_attendeeData: number
  - functions: number
  - decomposed_registrations__id_level1: number
  - decomposed_registrations_registrationData_calculatedAmounts_level2: number
  - grandLodges: number
  - decomposed_registrations_registrationData_orderDetails_level2: number
  - decomposed_registrations_registrationData_level1: number
  - decomposed_registrations_registrationData_packageDetails_eligibilityCriteria_rules_level4: number
  - decomposed_registrations_registrationData_attendees[0]_ticket_level3: number
  - decomposed_registrations_registrationData_bookingContact_stateTerritory_level3: number
  - registrations: number
  - decomposed_functions_metadata_sections_schedule[2]_items_level4: number
  - masonicProfiles: number
  - decomposed_metadata: number
  - decomposed_lodgeDetails: number
  - decomposed_bookingContacts: number
  - organisations: number
  - decomposed_registrations_registrationData_tickets_level2: number
  - decomposed_registrations_registrationData_selectedPackageDetails_eligibilityCriteria_rules_level4: number
  - decomposed_registrations_registrationData_bookingContact_country_level3: number
  - decomposed_functions_metadata_sections_level2: number
  - decomposed_functions_metadata_sections_schedule[0]_items_level4: number
  - decomposed_attendees: number
  - decomposed_registrations_registrationData_metadata_billingDetails_level3: number
  - eventTickets: number
  - decomposed_registrations_registrationData_packageDetails_registrationTypes_level3: number
  - decomposed_functions__id_buffer_level2: number
  - decomposed_registrations_registrationData_lodgeOrderDetails_level2: number
  - attendees: number
  - decomposed_registrations_registrationData_squareAmounts_level2: number
  - decomposed_registrations_registrationData_metadata_billingDetails_stateTerritory_level4: number
  - tickets: number
  - events: number
  - decomposed_registrations_registrationData_comprehensiveLodgeDetails_level2: number
  - locations: number
  - decomposed_registrations_registrationData_selectedPackageDetails_level2: number
  - decomposed_tickets: number
  - decomposed_functions_metadata_sections_schedule[1]_items_level4: number
  - decomposed_registrations_registrationData_packageDetails_eligibilityCriteria_level3: number
  - decomposed_registrationData: number
  - contacts: number
  - decomposed_registrations_registrationData_metadata_level2: number
  - decomposed_functions_metadata_sections_details_level3: number
  - decomposed_registrations_registrationData_packageDetails_level2: number
  - decomposed_registrations_registrationData_attendees[1]_ticket_level3: number
  - decomposed_grandLodges__id_level1: number
  - customers: number
  - decomposed_registrations_registrationData_bookingContact_level2: number
  - decomposed_registrations_registrationData_selectedPackageDetails_registrationTypes_level3: number
  - decomposed_registrations_registrationData_selectedPackageDetails_eligibilityCriteria_level3: number
  - decomposed_registrations_registrationData_comprehensiveBookingContact_level2: number
  - decomposed_functions_metadata_level1: number
  - packages: number
  - lodges: number
  - decomposed_functions_metadata_sections_schedule_level3: number
  - decomposed_registrations__id_buffer_level2: number
  - decomposed_registrations_registrationData_lodgeDetails_level2: number
  - decomposed_grandLodges__id_buffer_level2: number
  - decomposed_functions_metadata_documents_level2: number
  - decomposed_registrations_registrationData_attendees_level2: number
  - decomposed_functions__id_level1: number

### _id.buffer.2
- **Collections:** decomposed_registrations_registrationData_metadata_billingDetails_country_level4, decomposed_functions_metadata_attendance_level2, decomposed_attendeeData, functions, decomposed_registrations__id_level1, decomposed_registrations_registrationData_calculatedAmounts_level2, grandLodges, decomposed_registrations_registrationData_orderDetails_level2, decomposed_registrations_registrationData_level1, decomposed_registrations_registrationData_packageDetails_eligibilityCriteria_rules_level4, decomposed_registrations_registrationData_attendees[0]_ticket_level3, decomposed_registrations_registrationData_bookingContact_stateTerritory_level3, registrations, decomposed_functions_metadata_sections_schedule[2]_items_level4, masonicProfiles, decomposed_metadata, decomposed_lodgeDetails, decomposed_bookingContacts, organisations, decomposed_registrations_registrationData_tickets_level2, decomposed_registrations_registrationData_selectedPackageDetails_eligibilityCriteria_rules_level4, decomposed_registrations_registrationData_bookingContact_country_level3, decomposed_functions_metadata_sections_level2, decomposed_functions_metadata_sections_schedule[0]_items_level4, decomposed_attendees, decomposed_registrations_registrationData_metadata_billingDetails_level3, eventTickets, decomposed_registrations_registrationData_packageDetails_registrationTypes_level3, decomposed_functions__id_buffer_level2, decomposed_registrations_registrationData_lodgeOrderDetails_level2, attendees, decomposed_registrations_registrationData_squareAmounts_level2, decomposed_registrations_registrationData_metadata_billingDetails_stateTerritory_level4, tickets, events, decomposed_registrations_registrationData_comprehensiveLodgeDetails_level2, locations, decomposed_registrations_registrationData_selectedPackageDetails_level2, decomposed_tickets, decomposed_functions_metadata_sections_schedule[1]_items_level4, decomposed_registrations_registrationData_packageDetails_eligibilityCriteria_level3, decomposed_registrationData, contacts, decomposed_registrations_registrationData_metadata_level2, decomposed_functions_metadata_sections_details_level3, decomposed_registrations_registrationData_packageDetails_level2, decomposed_registrations_registrationData_attendees[1]_ticket_level3, decomposed_grandLodges__id_level1, customers, decomposed_registrations_registrationData_bookingContact_level2, decomposed_registrations_registrationData_selectedPackageDetails_registrationTypes_level3, decomposed_registrations_registrationData_selectedPackageDetails_eligibilityCriteria_level3, decomposed_registrations_registrationData_comprehensiveBookingContact_level2, decomposed_functions_metadata_level1, packages, lodges, decomposed_functions_metadata_sections_schedule_level3, decomposed_registrations__id_buffer_level2, decomposed_registrations_registrationData_lodgeDetails_level2, decomposed_grandLodges__id_buffer_level2, decomposed_functions_metadata_documents_level2, decomposed_registrations_registrationData_attendees_level2, decomposed_functions__id_level1
- **Total Occurrences:** 7,665
- **Consistency Score:** 100.00%
- **Data Types by Collection:**
  - decomposed_registrations_registrationData_metadata_billingDetails_country_level4: number
  - decomposed_functions_metadata_attendance_level2: number
  - decomposed_attendeeData: number
  - functions: number
  - decomposed_registrations__id_level1: number
  - decomposed_registrations_registrationData_calculatedAmounts_level2: number
  - grandLodges: number
  - decomposed_registrations_registrationData_orderDetails_level2: number
  - decomposed_registrations_registrationData_level1: number
  - decomposed_registrations_registrationData_packageDetails_eligibilityCriteria_rules_level4: number
  - decomposed_registrations_registrationData_attendees[0]_ticket_level3: number
  - decomposed_registrations_registrationData_bookingContact_stateTerritory_level3: number
  - registrations: number
  - decomposed_functions_metadata_sections_schedule[2]_items_level4: number
  - masonicProfiles: number
  - decomposed_metadata: number
  - decomposed_lodgeDetails: number
  - decomposed_bookingContacts: number
  - organisations: number
  - decomposed_registrations_registrationData_tickets_level2: number
  - decomposed_registrations_registrationData_selectedPackageDetails_eligibilityCriteria_rules_level4: number
  - decomposed_registrations_registrationData_bookingContact_country_level3: number
  - decomposed_functions_metadata_sections_level2: number
  - decomposed_functions_metadata_sections_schedule[0]_items_level4: number
  - decomposed_attendees: number
  - decomposed_registrations_registrationData_metadata_billingDetails_level3: number
  - eventTickets: number
  - decomposed_registrations_registrationData_packageDetails_registrationTypes_level3: number
  - decomposed_functions__id_buffer_level2: number
  - decomposed_registrations_registrationData_lodgeOrderDetails_level2: number
  - attendees: number
  - decomposed_registrations_registrationData_squareAmounts_level2: number
  - decomposed_registrations_registrationData_metadata_billingDetails_stateTerritory_level4: number
  - tickets: number
  - events: number
  - decomposed_registrations_registrationData_comprehensiveLodgeDetails_level2: number
  - locations: number
  - decomposed_registrations_registrationData_selectedPackageDetails_level2: number
  - decomposed_tickets: number
  - decomposed_functions_metadata_sections_schedule[1]_items_level4: number
  - decomposed_registrations_registrationData_packageDetails_eligibilityCriteria_level3: number
  - decomposed_registrationData: number
  - contacts: number
  - decomposed_registrations_registrationData_metadata_level2: number
  - decomposed_functions_metadata_sections_details_level3: number
  - decomposed_registrations_registrationData_packageDetails_level2: number
  - decomposed_registrations_registrationData_attendees[1]_ticket_level3: number
  - decomposed_grandLodges__id_level1: number
  - customers: number
  - decomposed_registrations_registrationData_bookingContact_level2: number
  - decomposed_registrations_registrationData_selectedPackageDetails_registrationTypes_level3: number
  - decomposed_registrations_registrationData_selectedPackageDetails_eligibilityCriteria_level3: number
  - decomposed_registrations_registrationData_comprehensiveBookingContact_level2: number
  - decomposed_functions_metadata_level1: number
  - packages: number
  - lodges: number
  - decomposed_functions_metadata_sections_schedule_level3: number
  - decomposed_registrations__id_buffer_level2: number
  - decomposed_registrations_registrationData_lodgeDetails_level2: number
  - decomposed_grandLodges__id_buffer_level2: number
  - decomposed_functions_metadata_documents_level2: number
  - decomposed_registrations_registrationData_attendees_level2: number
  - decomposed_functions__id_level1: number

### _id.buffer.3
- **Collections:** decomposed_registrations_registrationData_metadata_billingDetails_country_level4, decomposed_functions_metadata_attendance_level2, decomposed_attendeeData, functions, decomposed_registrations__id_level1, decomposed_registrations_registrationData_calculatedAmounts_level2, grandLodges, decomposed_registrations_registrationData_orderDetails_level2, decomposed_registrations_registrationData_level1, decomposed_registrations_registrationData_packageDetails_eligibilityCriteria_rules_level4, decomposed_registrations_registrationData_attendees[0]_ticket_level3, decomposed_registrations_registrationData_bookingContact_stateTerritory_level3, registrations, decomposed_functions_metadata_sections_schedule[2]_items_level4, masonicProfiles, decomposed_metadata, decomposed_lodgeDetails, decomposed_bookingContacts, organisations, decomposed_registrations_registrationData_tickets_level2, decomposed_registrations_registrationData_selectedPackageDetails_eligibilityCriteria_rules_level4, decomposed_registrations_registrationData_bookingContact_country_level3, decomposed_functions_metadata_sections_level2, decomposed_functions_metadata_sections_schedule[0]_items_level4, decomposed_attendees, decomposed_registrations_registrationData_metadata_billingDetails_level3, eventTickets, decomposed_registrations_registrationData_packageDetails_registrationTypes_level3, decomposed_functions__id_buffer_level2, decomposed_registrations_registrationData_lodgeOrderDetails_level2, attendees, decomposed_registrations_registrationData_squareAmounts_level2, decomposed_registrations_registrationData_metadata_billingDetails_stateTerritory_level4, tickets, events, decomposed_registrations_registrationData_comprehensiveLodgeDetails_level2, locations, decomposed_registrations_registrationData_selectedPackageDetails_level2, decomposed_tickets, decomposed_functions_metadata_sections_schedule[1]_items_level4, decomposed_registrations_registrationData_packageDetails_eligibilityCriteria_level3, decomposed_registrationData, contacts, decomposed_registrations_registrationData_metadata_level2, decomposed_functions_metadata_sections_details_level3, decomposed_registrations_registrationData_packageDetails_level2, decomposed_registrations_registrationData_attendees[1]_ticket_level3, decomposed_grandLodges__id_level1, customers, decomposed_registrations_registrationData_bookingContact_level2, decomposed_registrations_registrationData_selectedPackageDetails_registrationTypes_level3, decomposed_registrations_registrationData_selectedPackageDetails_eligibilityCriteria_level3, decomposed_registrations_registrationData_comprehensiveBookingContact_level2, decomposed_functions_metadata_level1, packages, lodges, decomposed_functions_metadata_sections_schedule_level3, decomposed_registrations__id_buffer_level2, decomposed_registrations_registrationData_lodgeDetails_level2, decomposed_grandLodges__id_buffer_level2, decomposed_functions_metadata_documents_level2, decomposed_registrations_registrationData_attendees_level2, decomposed_functions__id_level1
- **Total Occurrences:** 7,665
- **Consistency Score:** 100.00%
- **Data Types by Collection:**
  - decomposed_registrations_registrationData_metadata_billingDetails_country_level4: number
  - decomposed_functions_metadata_attendance_level2: number
  - decomposed_attendeeData: number
  - functions: number
  - decomposed_registrations__id_level1: number
  - decomposed_registrations_registrationData_calculatedAmounts_level2: number
  - grandLodges: number
  - decomposed_registrations_registrationData_orderDetails_level2: number
  - decomposed_registrations_registrationData_level1: number
  - decomposed_registrations_registrationData_packageDetails_eligibilityCriteria_rules_level4: number
  - decomposed_registrations_registrationData_attendees[0]_ticket_level3: number
  - decomposed_registrations_registrationData_bookingContact_stateTerritory_level3: number
  - registrations: number
  - decomposed_functions_metadata_sections_schedule[2]_items_level4: number
  - masonicProfiles: number
  - decomposed_metadata: number
  - decomposed_lodgeDetails: number
  - decomposed_bookingContacts: number
  - organisations: number
  - decomposed_registrations_registrationData_tickets_level2: number
  - decomposed_registrations_registrationData_selectedPackageDetails_eligibilityCriteria_rules_level4: number
  - decomposed_registrations_registrationData_bookingContact_country_level3: number
  - decomposed_functions_metadata_sections_level2: number
  - decomposed_functions_metadata_sections_schedule[0]_items_level4: number
  - decomposed_attendees: number
  - decomposed_registrations_registrationData_metadata_billingDetails_level3: number
  - eventTickets: number
  - decomposed_registrations_registrationData_packageDetails_registrationTypes_level3: number
  - decomposed_functions__id_buffer_level2: number
  - decomposed_registrations_registrationData_lodgeOrderDetails_level2: number
  - attendees: number
  - decomposed_registrations_registrationData_squareAmounts_level2: number
  - decomposed_registrations_registrationData_metadata_billingDetails_stateTerritory_level4: number
  - tickets: number
  - events: number
  - decomposed_registrations_registrationData_comprehensiveLodgeDetails_level2: number
  - locations: number
  - decomposed_registrations_registrationData_selectedPackageDetails_level2: number
  - decomposed_tickets: number
  - decomposed_functions_metadata_sections_schedule[1]_items_level4: number
  - decomposed_registrations_registrationData_packageDetails_eligibilityCriteria_level3: number
  - decomposed_registrationData: number
  - contacts: number
  - decomposed_registrations_registrationData_metadata_level2: number
  - decomposed_functions_metadata_sections_details_level3: number
  - decomposed_registrations_registrationData_packageDetails_level2: number
  - decomposed_registrations_registrationData_attendees[1]_ticket_level3: number
  - decomposed_grandLodges__id_level1: number
  - customers: number
  - decomposed_registrations_registrationData_bookingContact_level2: number
  - decomposed_registrations_registrationData_selectedPackageDetails_registrationTypes_level3: number
  - decomposed_registrations_registrationData_selectedPackageDetails_eligibilityCriteria_level3: number
  - decomposed_registrations_registrationData_comprehensiveBookingContact_level2: number
  - decomposed_functions_metadata_level1: number
  - packages: number
  - lodges: number
  - decomposed_functions_metadata_sections_schedule_level3: number
  - decomposed_registrations__id_buffer_level2: number
  - decomposed_registrations_registrationData_lodgeDetails_level2: number
  - decomposed_grandLodges__id_buffer_level2: number
  - decomposed_functions_metadata_documents_level2: number
  - decomposed_registrations_registrationData_attendees_level2: number
  - decomposed_functions__id_level1: number

### _id.buffer.4
- **Collections:** decomposed_registrations_registrationData_metadata_billingDetails_country_level4, decomposed_functions_metadata_attendance_level2, decomposed_attendeeData, functions, decomposed_registrations__id_level1, decomposed_registrations_registrationData_calculatedAmounts_level2, grandLodges, decomposed_registrations_registrationData_orderDetails_level2, decomposed_registrations_registrationData_level1, decomposed_registrations_registrationData_packageDetails_eligibilityCriteria_rules_level4, decomposed_registrations_registrationData_attendees[0]_ticket_level3, decomposed_registrations_registrationData_bookingContact_stateTerritory_level3, registrations, decomposed_functions_metadata_sections_schedule[2]_items_level4, masonicProfiles, decomposed_metadata, decomposed_lodgeDetails, decomposed_bookingContacts, organisations, decomposed_registrations_registrationData_tickets_level2, decomposed_registrations_registrationData_selectedPackageDetails_eligibilityCriteria_rules_level4, decomposed_registrations_registrationData_bookingContact_country_level3, decomposed_functions_metadata_sections_level2, decomposed_functions_metadata_sections_schedule[0]_items_level4, decomposed_attendees, decomposed_registrations_registrationData_metadata_billingDetails_level3, eventTickets, decomposed_registrations_registrationData_packageDetails_registrationTypes_level3, decomposed_functions__id_buffer_level2, decomposed_registrations_registrationData_lodgeOrderDetails_level2, attendees, decomposed_registrations_registrationData_squareAmounts_level2, decomposed_registrations_registrationData_metadata_billingDetails_stateTerritory_level4, tickets, events, decomposed_registrations_registrationData_comprehensiveLodgeDetails_level2, locations, decomposed_registrations_registrationData_selectedPackageDetails_level2, decomposed_tickets, decomposed_functions_metadata_sections_schedule[1]_items_level4, decomposed_registrations_registrationData_packageDetails_eligibilityCriteria_level3, decomposed_registrationData, contacts, decomposed_registrations_registrationData_metadata_level2, decomposed_functions_metadata_sections_details_level3, decomposed_registrations_registrationData_packageDetails_level2, decomposed_registrations_registrationData_attendees[1]_ticket_level3, decomposed_grandLodges__id_level1, customers, decomposed_registrations_registrationData_bookingContact_level2, decomposed_registrations_registrationData_selectedPackageDetails_registrationTypes_level3, decomposed_registrations_registrationData_selectedPackageDetails_eligibilityCriteria_level3, decomposed_registrations_registrationData_comprehensiveBookingContact_level2, decomposed_functions_metadata_level1, packages, lodges, decomposed_functions_metadata_sections_schedule_level3, decomposed_registrations__id_buffer_level2, decomposed_registrations_registrationData_lodgeDetails_level2, decomposed_grandLodges__id_buffer_level2, decomposed_functions_metadata_documents_level2, decomposed_registrations_registrationData_attendees_level2, decomposed_functions__id_level1
- **Total Occurrences:** 7,665
- **Consistency Score:** 100.00%
- **Data Types by Collection:**
  - decomposed_registrations_registrationData_metadata_billingDetails_country_level4: number
  - decomposed_functions_metadata_attendance_level2: number
  - decomposed_attendeeData: number
  - functions: number
  - decomposed_registrations__id_level1: number
  - decomposed_registrations_registrationData_calculatedAmounts_level2: number
  - grandLodges: number
  - decomposed_registrations_registrationData_orderDetails_level2: number
  - decomposed_registrations_registrationData_level1: number
  - decomposed_registrations_registrationData_packageDetails_eligibilityCriteria_rules_level4: number
  - decomposed_registrations_registrationData_attendees[0]_ticket_level3: number
  - decomposed_registrations_registrationData_bookingContact_stateTerritory_level3: number
  - registrations: number
  - decomposed_functions_metadata_sections_schedule[2]_items_level4: number
  - masonicProfiles: number
  - decomposed_metadata: number
  - decomposed_lodgeDetails: number
  - decomposed_bookingContacts: number
  - organisations: number
  - decomposed_registrations_registrationData_tickets_level2: number
  - decomposed_registrations_registrationData_selectedPackageDetails_eligibilityCriteria_rules_level4: number
  - decomposed_registrations_registrationData_bookingContact_country_level3: number
  - decomposed_functions_metadata_sections_level2: number
  - decomposed_functions_metadata_sections_schedule[0]_items_level4: number
  - decomposed_attendees: number
  - decomposed_registrations_registrationData_metadata_billingDetails_level3: number
  - eventTickets: number
  - decomposed_registrations_registrationData_packageDetails_registrationTypes_level3: number
  - decomposed_functions__id_buffer_level2: number
  - decomposed_registrations_registrationData_lodgeOrderDetails_level2: number
  - attendees: number
  - decomposed_registrations_registrationData_squareAmounts_level2: number
  - decomposed_registrations_registrationData_metadata_billingDetails_stateTerritory_level4: number
  - tickets: number
  - events: number
  - decomposed_registrations_registrationData_comprehensiveLodgeDetails_level2: number
  - locations: number
  - decomposed_registrations_registrationData_selectedPackageDetails_level2: number
  - decomposed_tickets: number
  - decomposed_functions_metadata_sections_schedule[1]_items_level4: number
  - decomposed_registrations_registrationData_packageDetails_eligibilityCriteria_level3: number
  - decomposed_registrationData: number
  - contacts: number
  - decomposed_registrations_registrationData_metadata_level2: number
  - decomposed_functions_metadata_sections_details_level3: number
  - decomposed_registrations_registrationData_packageDetails_level2: number
  - decomposed_registrations_registrationData_attendees[1]_ticket_level3: number
  - decomposed_grandLodges__id_level1: number
  - customers: number
  - decomposed_registrations_registrationData_bookingContact_level2: number
  - decomposed_registrations_registrationData_selectedPackageDetails_registrationTypes_level3: number
  - decomposed_registrations_registrationData_selectedPackageDetails_eligibilityCriteria_level3: number
  - decomposed_registrations_registrationData_comprehensiveBookingContact_level2: number
  - decomposed_functions_metadata_level1: number
  - packages: number
  - lodges: number
  - decomposed_functions_metadata_sections_schedule_level3: number
  - decomposed_registrations__id_buffer_level2: number
  - decomposed_registrations_registrationData_lodgeDetails_level2: number
  - decomposed_grandLodges__id_buffer_level2: number
  - decomposed_functions_metadata_documents_level2: number
  - decomposed_registrations_registrationData_attendees_level2: number
  - decomposed_functions__id_level1: number

### _id.buffer.5
- **Collections:** decomposed_registrations_registrationData_metadata_billingDetails_country_level4, decomposed_functions_metadata_attendance_level2, decomposed_attendeeData, functions, decomposed_registrations__id_level1, decomposed_registrations_registrationData_calculatedAmounts_level2, grandLodges, decomposed_registrations_registrationData_orderDetails_level2, decomposed_registrations_registrationData_level1, decomposed_registrations_registrationData_packageDetails_eligibilityCriteria_rules_level4, decomposed_registrations_registrationData_attendees[0]_ticket_level3, decomposed_registrations_registrationData_bookingContact_stateTerritory_level3, registrations, decomposed_functions_metadata_sections_schedule[2]_items_level4, masonicProfiles, decomposed_metadata, decomposed_lodgeDetails, decomposed_bookingContacts, organisations, decomposed_registrations_registrationData_tickets_level2, decomposed_registrations_registrationData_selectedPackageDetails_eligibilityCriteria_rules_level4, decomposed_registrations_registrationData_bookingContact_country_level3, decomposed_functions_metadata_sections_level2, decomposed_functions_metadata_sections_schedule[0]_items_level4, decomposed_attendees, decomposed_registrations_registrationData_metadata_billingDetails_level3, eventTickets, decomposed_registrations_registrationData_packageDetails_registrationTypes_level3, decomposed_functions__id_buffer_level2, decomposed_registrations_registrationData_lodgeOrderDetails_level2, attendees, decomposed_registrations_registrationData_squareAmounts_level2, decomposed_registrations_registrationData_metadata_billingDetails_stateTerritory_level4, tickets, events, decomposed_registrations_registrationData_comprehensiveLodgeDetails_level2, locations, decomposed_registrations_registrationData_selectedPackageDetails_level2, decomposed_tickets, decomposed_functions_metadata_sections_schedule[1]_items_level4, decomposed_registrations_registrationData_packageDetails_eligibilityCriteria_level3, decomposed_registrationData, contacts, decomposed_registrations_registrationData_metadata_level2, decomposed_functions_metadata_sections_details_level3, decomposed_registrations_registrationData_packageDetails_level2, decomposed_registrations_registrationData_attendees[1]_ticket_level3, decomposed_grandLodges__id_level1, customers, decomposed_registrations_registrationData_bookingContact_level2, decomposed_registrations_registrationData_selectedPackageDetails_registrationTypes_level3, decomposed_registrations_registrationData_selectedPackageDetails_eligibilityCriteria_level3, decomposed_registrations_registrationData_comprehensiveBookingContact_level2, decomposed_functions_metadata_level1, packages, lodges, decomposed_functions_metadata_sections_schedule_level3, decomposed_registrations__id_buffer_level2, decomposed_registrations_registrationData_lodgeDetails_level2, decomposed_grandLodges__id_buffer_level2, decomposed_functions_metadata_documents_level2, decomposed_registrations_registrationData_attendees_level2, decomposed_functions__id_level1
- **Total Occurrences:** 7,665
- **Consistency Score:** 100.00%
- **Data Types by Collection:**
  - decomposed_registrations_registrationData_metadata_billingDetails_country_level4: number
  - decomposed_functions_metadata_attendance_level2: number
  - decomposed_attendeeData: number
  - functions: number
  - decomposed_registrations__id_level1: number
  - decomposed_registrations_registrationData_calculatedAmounts_level2: number
  - grandLodges: number
  - decomposed_registrations_registrationData_orderDetails_level2: number
  - decomposed_registrations_registrationData_level1: number
  - decomposed_registrations_registrationData_packageDetails_eligibilityCriteria_rules_level4: number
  - decomposed_registrations_registrationData_attendees[0]_ticket_level3: number
  - decomposed_registrations_registrationData_bookingContact_stateTerritory_level3: number
  - registrations: number
  - decomposed_functions_metadata_sections_schedule[2]_items_level4: number
  - masonicProfiles: number
  - decomposed_metadata: number
  - decomposed_lodgeDetails: number
  - decomposed_bookingContacts: number
  - organisations: number
  - decomposed_registrations_registrationData_tickets_level2: number
  - decomposed_registrations_registrationData_selectedPackageDetails_eligibilityCriteria_rules_level4: number
  - decomposed_registrations_registrationData_bookingContact_country_level3: number
  - decomposed_functions_metadata_sections_level2: number
  - decomposed_functions_metadata_sections_schedule[0]_items_level4: number
  - decomposed_attendees: number
  - decomposed_registrations_registrationData_metadata_billingDetails_level3: number
  - eventTickets: number
  - decomposed_registrations_registrationData_packageDetails_registrationTypes_level3: number
  - decomposed_functions__id_buffer_level2: number
  - decomposed_registrations_registrationData_lodgeOrderDetails_level2: number
  - attendees: number
  - decomposed_registrations_registrationData_squareAmounts_level2: number
  - decomposed_registrations_registrationData_metadata_billingDetails_stateTerritory_level4: number
  - tickets: number
  - events: number
  - decomposed_registrations_registrationData_comprehensiveLodgeDetails_level2: number
  - locations: number
  - decomposed_registrations_registrationData_selectedPackageDetails_level2: number
  - decomposed_tickets: number
  - decomposed_functions_metadata_sections_schedule[1]_items_level4: number
  - decomposed_registrations_registrationData_packageDetails_eligibilityCriteria_level3: number
  - decomposed_registrationData: number
  - contacts: number
  - decomposed_registrations_registrationData_metadata_level2: number
  - decomposed_functions_metadata_sections_details_level3: number
  - decomposed_registrations_registrationData_packageDetails_level2: number
  - decomposed_registrations_registrationData_attendees[1]_ticket_level3: number
  - decomposed_grandLodges__id_level1: number
  - customers: number
  - decomposed_registrations_registrationData_bookingContact_level2: number
  - decomposed_registrations_registrationData_selectedPackageDetails_registrationTypes_level3: number
  - decomposed_registrations_registrationData_selectedPackageDetails_eligibilityCriteria_level3: number
  - decomposed_registrations_registrationData_comprehensiveBookingContact_level2: number
  - decomposed_functions_metadata_level1: number
  - packages: number
  - lodges: number
  - decomposed_functions_metadata_sections_schedule_level3: number
  - decomposed_registrations__id_buffer_level2: number
  - decomposed_registrations_registrationData_lodgeDetails_level2: number
  - decomposed_grandLodges__id_buffer_level2: number
  - decomposed_functions_metadata_documents_level2: number
  - decomposed_registrations_registrationData_attendees_level2: number
  - decomposed_functions__id_level1: number

### _id.buffer.6
- **Collections:** decomposed_registrations_registrationData_metadata_billingDetails_country_level4, decomposed_functions_metadata_attendance_level2, decomposed_attendeeData, functions, decomposed_registrations__id_level1, decomposed_registrations_registrationData_calculatedAmounts_level2, grandLodges, decomposed_registrations_registrationData_orderDetails_level2, decomposed_registrations_registrationData_level1, decomposed_registrations_registrationData_packageDetails_eligibilityCriteria_rules_level4, decomposed_registrations_registrationData_attendees[0]_ticket_level3, decomposed_registrations_registrationData_bookingContact_stateTerritory_level3, registrations, decomposed_functions_metadata_sections_schedule[2]_items_level4, masonicProfiles, decomposed_metadata, decomposed_lodgeDetails, decomposed_bookingContacts, organisations, decomposed_registrations_registrationData_tickets_level2, decomposed_registrations_registrationData_selectedPackageDetails_eligibilityCriteria_rules_level4, decomposed_registrations_registrationData_bookingContact_country_level3, decomposed_functions_metadata_sections_level2, decomposed_functions_metadata_sections_schedule[0]_items_level4, decomposed_attendees, decomposed_registrations_registrationData_metadata_billingDetails_level3, eventTickets, decomposed_registrations_registrationData_packageDetails_registrationTypes_level3, decomposed_functions__id_buffer_level2, decomposed_registrations_registrationData_lodgeOrderDetails_level2, attendees, decomposed_registrations_registrationData_squareAmounts_level2, decomposed_registrations_registrationData_metadata_billingDetails_stateTerritory_level4, tickets, events, decomposed_registrations_registrationData_comprehensiveLodgeDetails_level2, locations, decomposed_registrations_registrationData_selectedPackageDetails_level2, decomposed_tickets, decomposed_functions_metadata_sections_schedule[1]_items_level4, decomposed_registrations_registrationData_packageDetails_eligibilityCriteria_level3, decomposed_registrationData, contacts, decomposed_registrations_registrationData_metadata_level2, decomposed_functions_metadata_sections_details_level3, decomposed_registrations_registrationData_packageDetails_level2, decomposed_registrations_registrationData_attendees[1]_ticket_level3, decomposed_grandLodges__id_level1, customers, decomposed_registrations_registrationData_bookingContact_level2, decomposed_registrations_registrationData_selectedPackageDetails_registrationTypes_level3, decomposed_registrations_registrationData_selectedPackageDetails_eligibilityCriteria_level3, decomposed_registrations_registrationData_comprehensiveBookingContact_level2, decomposed_functions_metadata_level1, packages, lodges, decomposed_functions_metadata_sections_schedule_level3, decomposed_registrations__id_buffer_level2, decomposed_registrations_registrationData_lodgeDetails_level2, decomposed_grandLodges__id_buffer_level2, decomposed_functions_metadata_documents_level2, decomposed_registrations_registrationData_attendees_level2, decomposed_functions__id_level1
- **Total Occurrences:** 7,665
- **Consistency Score:** 100.00%
- **Data Types by Collection:**
  - decomposed_registrations_registrationData_metadata_billingDetails_country_level4: number
  - decomposed_functions_metadata_attendance_level2: number
  - decomposed_attendeeData: number
  - functions: number
  - decomposed_registrations__id_level1: number
  - decomposed_registrations_registrationData_calculatedAmounts_level2: number
  - grandLodges: number
  - decomposed_registrations_registrationData_orderDetails_level2: number
  - decomposed_registrations_registrationData_level1: number
  - decomposed_registrations_registrationData_packageDetails_eligibilityCriteria_rules_level4: number
  - decomposed_registrations_registrationData_attendees[0]_ticket_level3: number
  - decomposed_registrations_registrationData_bookingContact_stateTerritory_level3: number
  - registrations: number
  - decomposed_functions_metadata_sections_schedule[2]_items_level4: number
  - masonicProfiles: number
  - decomposed_metadata: number
  - decomposed_lodgeDetails: number
  - decomposed_bookingContacts: number
  - organisations: number
  - decomposed_registrations_registrationData_tickets_level2: number
  - decomposed_registrations_registrationData_selectedPackageDetails_eligibilityCriteria_rules_level4: number
  - decomposed_registrations_registrationData_bookingContact_country_level3: number
  - decomposed_functions_metadata_sections_level2: number
  - decomposed_functions_metadata_sections_schedule[0]_items_level4: number
  - decomposed_attendees: number
  - decomposed_registrations_registrationData_metadata_billingDetails_level3: number
  - eventTickets: number
  - decomposed_registrations_registrationData_packageDetails_registrationTypes_level3: number
  - decomposed_functions__id_buffer_level2: number
  - decomposed_registrations_registrationData_lodgeOrderDetails_level2: number
  - attendees: number
  - decomposed_registrations_registrationData_squareAmounts_level2: number
  - decomposed_registrations_registrationData_metadata_billingDetails_stateTerritory_level4: number
  - tickets: number
  - events: number
  - decomposed_registrations_registrationData_comprehensiveLodgeDetails_level2: number
  - locations: number
  - decomposed_registrations_registrationData_selectedPackageDetails_level2: number
  - decomposed_tickets: number
  - decomposed_functions_metadata_sections_schedule[1]_items_level4: number
  - decomposed_registrations_registrationData_packageDetails_eligibilityCriteria_level3: number
  - decomposed_registrationData: number
  - contacts: number
  - decomposed_registrations_registrationData_metadata_level2: number
  - decomposed_functions_metadata_sections_details_level3: number
  - decomposed_registrations_registrationData_packageDetails_level2: number
  - decomposed_registrations_registrationData_attendees[1]_ticket_level3: number
  - decomposed_grandLodges__id_level1: number
  - customers: number
  - decomposed_registrations_registrationData_bookingContact_level2: number
  - decomposed_registrations_registrationData_selectedPackageDetails_registrationTypes_level3: number
  - decomposed_registrations_registrationData_selectedPackageDetails_eligibilityCriteria_level3: number
  - decomposed_registrations_registrationData_comprehensiveBookingContact_level2: number
  - decomposed_functions_metadata_level1: number
  - packages: number
  - lodges: number
  - decomposed_functions_metadata_sections_schedule_level3: number
  - decomposed_registrations__id_buffer_level2: number
  - decomposed_registrations_registrationData_lodgeDetails_level2: number
  - decomposed_grandLodges__id_buffer_level2: number
  - decomposed_functions_metadata_documents_level2: number
  - decomposed_registrations_registrationData_attendees_level2: number
  - decomposed_functions__id_level1: number

### _id.buffer.7
- **Collections:** decomposed_registrations_registrationData_metadata_billingDetails_country_level4, decomposed_functions_metadata_attendance_level2, decomposed_attendeeData, functions, decomposed_registrations__id_level1, decomposed_registrations_registrationData_calculatedAmounts_level2, grandLodges, decomposed_registrations_registrationData_orderDetails_level2, decomposed_registrations_registrationData_level1, decomposed_registrations_registrationData_packageDetails_eligibilityCriteria_rules_level4, decomposed_registrations_registrationData_attendees[0]_ticket_level3, decomposed_registrations_registrationData_bookingContact_stateTerritory_level3, registrations, decomposed_functions_metadata_sections_schedule[2]_items_level4, masonicProfiles, decomposed_metadata, decomposed_lodgeDetails, decomposed_bookingContacts, organisations, decomposed_registrations_registrationData_tickets_level2, decomposed_registrations_registrationData_selectedPackageDetails_eligibilityCriteria_rules_level4, decomposed_registrations_registrationData_bookingContact_country_level3, decomposed_functions_metadata_sections_level2, decomposed_functions_metadata_sections_schedule[0]_items_level4, decomposed_attendees, decomposed_registrations_registrationData_metadata_billingDetails_level3, eventTickets, decomposed_registrations_registrationData_packageDetails_registrationTypes_level3, decomposed_functions__id_buffer_level2, decomposed_registrations_registrationData_lodgeOrderDetails_level2, attendees, decomposed_registrations_registrationData_squareAmounts_level2, decomposed_registrations_registrationData_metadata_billingDetails_stateTerritory_level4, tickets, events, decomposed_registrations_registrationData_comprehensiveLodgeDetails_level2, locations, decomposed_registrations_registrationData_selectedPackageDetails_level2, decomposed_tickets, decomposed_functions_metadata_sections_schedule[1]_items_level4, decomposed_registrations_registrationData_packageDetails_eligibilityCriteria_level3, decomposed_registrationData, contacts, decomposed_registrations_registrationData_metadata_level2, decomposed_functions_metadata_sections_details_level3, decomposed_registrations_registrationData_packageDetails_level2, decomposed_registrations_registrationData_attendees[1]_ticket_level3, decomposed_grandLodges__id_level1, customers, decomposed_registrations_registrationData_bookingContact_level2, decomposed_registrations_registrationData_selectedPackageDetails_registrationTypes_level3, decomposed_registrations_registrationData_selectedPackageDetails_eligibilityCriteria_level3, decomposed_registrations_registrationData_comprehensiveBookingContact_level2, decomposed_functions_metadata_level1, packages, lodges, decomposed_functions_metadata_sections_schedule_level3, decomposed_registrations__id_buffer_level2, decomposed_registrations_registrationData_lodgeDetails_level2, decomposed_grandLodges__id_buffer_level2, decomposed_functions_metadata_documents_level2, decomposed_registrations_registrationData_attendees_level2, decomposed_functions__id_level1
- **Total Occurrences:** 7,665
- **Consistency Score:** 100.00%
- **Data Types by Collection:**
  - decomposed_registrations_registrationData_metadata_billingDetails_country_level4: number
  - decomposed_functions_metadata_attendance_level2: number
  - decomposed_attendeeData: number
  - functions: number
  - decomposed_registrations__id_level1: number
  - decomposed_registrations_registrationData_calculatedAmounts_level2: number
  - grandLodges: number
  - decomposed_registrations_registrationData_orderDetails_level2: number
  - decomposed_registrations_registrationData_level1: number
  - decomposed_registrations_registrationData_packageDetails_eligibilityCriteria_rules_level4: number
  - decomposed_registrations_registrationData_attendees[0]_ticket_level3: number
  - decomposed_registrations_registrationData_bookingContact_stateTerritory_level3: number
  - registrations: number
  - decomposed_functions_metadata_sections_schedule[2]_items_level4: number
  - masonicProfiles: number
  - decomposed_metadata: number
  - decomposed_lodgeDetails: number
  - decomposed_bookingContacts: number
  - organisations: number
  - decomposed_registrations_registrationData_tickets_level2: number
  - decomposed_registrations_registrationData_selectedPackageDetails_eligibilityCriteria_rules_level4: number
  - decomposed_registrations_registrationData_bookingContact_country_level3: number
  - decomposed_functions_metadata_sections_level2: number
  - decomposed_functions_metadata_sections_schedule[0]_items_level4: number
  - decomposed_attendees: number
  - decomposed_registrations_registrationData_metadata_billingDetails_level3: number
  - eventTickets: number
  - decomposed_registrations_registrationData_packageDetails_registrationTypes_level3: number
  - decomposed_functions__id_buffer_level2: number
  - decomposed_registrations_registrationData_lodgeOrderDetails_level2: number
  - attendees: number
  - decomposed_registrations_registrationData_squareAmounts_level2: number
  - decomposed_registrations_registrationData_metadata_billingDetails_stateTerritory_level4: number
  - tickets: number
  - events: number
  - decomposed_registrations_registrationData_comprehensiveLodgeDetails_level2: number
  - locations: number
  - decomposed_registrations_registrationData_selectedPackageDetails_level2: number
  - decomposed_tickets: number
  - decomposed_functions_metadata_sections_schedule[1]_items_level4: number
  - decomposed_registrations_registrationData_packageDetails_eligibilityCriteria_level3: number
  - decomposed_registrationData: number
  - contacts: number
  - decomposed_registrations_registrationData_metadata_level2: number
  - decomposed_functions_metadata_sections_details_level3: number
  - decomposed_registrations_registrationData_packageDetails_level2: number
  - decomposed_registrations_registrationData_attendees[1]_ticket_level3: number
  - decomposed_grandLodges__id_level1: number
  - customers: number
  - decomposed_registrations_registrationData_bookingContact_level2: number
  - decomposed_registrations_registrationData_selectedPackageDetails_registrationTypes_level3: number
  - decomposed_registrations_registrationData_selectedPackageDetails_eligibilityCriteria_level3: number
  - decomposed_registrations_registrationData_comprehensiveBookingContact_level2: number
  - decomposed_functions_metadata_level1: number
  - packages: number
  - lodges: number
  - decomposed_functions_metadata_sections_schedule_level3: number
  - decomposed_registrations__id_buffer_level2: number
  - decomposed_registrations_registrationData_lodgeDetails_level2: number
  - decomposed_grandLodges__id_buffer_level2: number
  - decomposed_functions_metadata_documents_level2: number
  - decomposed_registrations_registrationData_attendees_level2: number
  - decomposed_functions__id_level1: number

### _id.buffer.8
- **Collections:** decomposed_registrations_registrationData_metadata_billingDetails_country_level4, decomposed_functions_metadata_attendance_level2, decomposed_attendeeData, functions, decomposed_registrations__id_level1, decomposed_registrations_registrationData_calculatedAmounts_level2, grandLodges, decomposed_registrations_registrationData_orderDetails_level2, decomposed_registrations_registrationData_level1, decomposed_registrations_registrationData_packageDetails_eligibilityCriteria_rules_level4, decomposed_registrations_registrationData_attendees[0]_ticket_level3, decomposed_registrations_registrationData_bookingContact_stateTerritory_level3, registrations, decomposed_functions_metadata_sections_schedule[2]_items_level4, masonicProfiles, decomposed_metadata, decomposed_lodgeDetails, decomposed_bookingContacts, organisations, decomposed_registrations_registrationData_tickets_level2, decomposed_registrations_registrationData_selectedPackageDetails_eligibilityCriteria_rules_level4, decomposed_registrations_registrationData_bookingContact_country_level3, decomposed_functions_metadata_sections_level2, decomposed_functions_metadata_sections_schedule[0]_items_level4, decomposed_attendees, decomposed_registrations_registrationData_metadata_billingDetails_level3, eventTickets, decomposed_registrations_registrationData_packageDetails_registrationTypes_level3, decomposed_functions__id_buffer_level2, decomposed_registrations_registrationData_lodgeOrderDetails_level2, attendees, decomposed_registrations_registrationData_squareAmounts_level2, decomposed_registrations_registrationData_metadata_billingDetails_stateTerritory_level4, tickets, events, decomposed_registrations_registrationData_comprehensiveLodgeDetails_level2, locations, decomposed_registrations_registrationData_selectedPackageDetails_level2, decomposed_tickets, decomposed_functions_metadata_sections_schedule[1]_items_level4, decomposed_registrations_registrationData_packageDetails_eligibilityCriteria_level3, decomposed_registrationData, contacts, decomposed_registrations_registrationData_metadata_level2, decomposed_functions_metadata_sections_details_level3, decomposed_registrations_registrationData_packageDetails_level2, decomposed_registrations_registrationData_attendees[1]_ticket_level3, decomposed_grandLodges__id_level1, customers, decomposed_registrations_registrationData_bookingContact_level2, decomposed_registrations_registrationData_selectedPackageDetails_registrationTypes_level3, decomposed_registrations_registrationData_selectedPackageDetails_eligibilityCriteria_level3, decomposed_registrations_registrationData_comprehensiveBookingContact_level2, decomposed_functions_metadata_level1, packages, lodges, decomposed_functions_metadata_sections_schedule_level3, decomposed_registrations__id_buffer_level2, decomposed_registrations_registrationData_lodgeDetails_level2, decomposed_grandLodges__id_buffer_level2, decomposed_functions_metadata_documents_level2, decomposed_registrations_registrationData_attendees_level2, decomposed_functions__id_level1
- **Total Occurrences:** 7,665
- **Consistency Score:** 100.00%
- **Data Types by Collection:**
  - decomposed_registrations_registrationData_metadata_billingDetails_country_level4: number
  - decomposed_functions_metadata_attendance_level2: number
  - decomposed_attendeeData: number
  - functions: number
  - decomposed_registrations__id_level1: number
  - decomposed_registrations_registrationData_calculatedAmounts_level2: number
  - grandLodges: number
  - decomposed_registrations_registrationData_orderDetails_level2: number
  - decomposed_registrations_registrationData_level1: number
  - decomposed_registrations_registrationData_packageDetails_eligibilityCriteria_rules_level4: number
  - decomposed_registrations_registrationData_attendees[0]_ticket_level3: number
  - decomposed_registrations_registrationData_bookingContact_stateTerritory_level3: number
  - registrations: number
  - decomposed_functions_metadata_sections_schedule[2]_items_level4: number
  - masonicProfiles: number
  - decomposed_metadata: number
  - decomposed_lodgeDetails: number
  - decomposed_bookingContacts: number
  - organisations: number
  - decomposed_registrations_registrationData_tickets_level2: number
  - decomposed_registrations_registrationData_selectedPackageDetails_eligibilityCriteria_rules_level4: number
  - decomposed_registrations_registrationData_bookingContact_country_level3: number
  - decomposed_functions_metadata_sections_level2: number
  - decomposed_functions_metadata_sections_schedule[0]_items_level4: number
  - decomposed_attendees: number
  - decomposed_registrations_registrationData_metadata_billingDetails_level3: number
  - eventTickets: number
  - decomposed_registrations_registrationData_packageDetails_registrationTypes_level3: number
  - decomposed_functions__id_buffer_level2: number
  - decomposed_registrations_registrationData_lodgeOrderDetails_level2: number
  - attendees: number
  - decomposed_registrations_registrationData_squareAmounts_level2: number
  - decomposed_registrations_registrationData_metadata_billingDetails_stateTerritory_level4: number
  - tickets: number
  - events: number
  - decomposed_registrations_registrationData_comprehensiveLodgeDetails_level2: number
  - locations: number
  - decomposed_registrations_registrationData_selectedPackageDetails_level2: number
  - decomposed_tickets: number
  - decomposed_functions_metadata_sections_schedule[1]_items_level4: number
  - decomposed_registrations_registrationData_packageDetails_eligibilityCriteria_level3: number
  - decomposed_registrationData: number
  - contacts: number
  - decomposed_registrations_registrationData_metadata_level2: number
  - decomposed_functions_metadata_sections_details_level3: number
  - decomposed_registrations_registrationData_packageDetails_level2: number
  - decomposed_registrations_registrationData_attendees[1]_ticket_level3: number
  - decomposed_grandLodges__id_level1: number
  - customers: number
  - decomposed_registrations_registrationData_bookingContact_level2: number
  - decomposed_registrations_registrationData_selectedPackageDetails_registrationTypes_level3: number
  - decomposed_registrations_registrationData_selectedPackageDetails_eligibilityCriteria_level3: number
  - decomposed_registrations_registrationData_comprehensiveBookingContact_level2: number
  - decomposed_functions_metadata_level1: number
  - packages: number
  - lodges: number
  - decomposed_functions_metadata_sections_schedule_level3: number
  - decomposed_registrations__id_buffer_level2: number
  - decomposed_registrations_registrationData_lodgeDetails_level2: number
  - decomposed_grandLodges__id_buffer_level2: number
  - decomposed_functions_metadata_documents_level2: number
  - decomposed_registrations_registrationData_attendees_level2: number
  - decomposed_functions__id_level1: number

### _id.buffer.9
- **Collections:** decomposed_registrations_registrationData_metadata_billingDetails_country_level4, decomposed_functions_metadata_attendance_level2, decomposed_attendeeData, functions, decomposed_registrations__id_level1, decomposed_registrations_registrationData_calculatedAmounts_level2, grandLodges, decomposed_registrations_registrationData_orderDetails_level2, decomposed_registrations_registrationData_level1, decomposed_registrations_registrationData_packageDetails_eligibilityCriteria_rules_level4, decomposed_registrations_registrationData_attendees[0]_ticket_level3, decomposed_registrations_registrationData_bookingContact_stateTerritory_level3, registrations, decomposed_functions_metadata_sections_schedule[2]_items_level4, masonicProfiles, decomposed_metadata, decomposed_lodgeDetails, decomposed_bookingContacts, organisations, decomposed_registrations_registrationData_tickets_level2, decomposed_registrations_registrationData_selectedPackageDetails_eligibilityCriteria_rules_level4, decomposed_registrations_registrationData_bookingContact_country_level3, decomposed_functions_metadata_sections_level2, decomposed_functions_metadata_sections_schedule[0]_items_level4, decomposed_attendees, decomposed_registrations_registrationData_metadata_billingDetails_level3, eventTickets, decomposed_registrations_registrationData_packageDetails_registrationTypes_level3, decomposed_functions__id_buffer_level2, decomposed_registrations_registrationData_lodgeOrderDetails_level2, attendees, decomposed_registrations_registrationData_squareAmounts_level2, decomposed_registrations_registrationData_metadata_billingDetails_stateTerritory_level4, tickets, events, decomposed_registrations_registrationData_comprehensiveLodgeDetails_level2, locations, decomposed_registrations_registrationData_selectedPackageDetails_level2, decomposed_tickets, decomposed_functions_metadata_sections_schedule[1]_items_level4, decomposed_registrations_registrationData_packageDetails_eligibilityCriteria_level3, decomposed_registrationData, contacts, decomposed_registrations_registrationData_metadata_level2, decomposed_functions_metadata_sections_details_level3, decomposed_registrations_registrationData_packageDetails_level2, decomposed_registrations_registrationData_attendees[1]_ticket_level3, decomposed_grandLodges__id_level1, customers, decomposed_registrations_registrationData_bookingContact_level2, decomposed_registrations_registrationData_selectedPackageDetails_registrationTypes_level3, decomposed_registrations_registrationData_selectedPackageDetails_eligibilityCriteria_level3, decomposed_registrations_registrationData_comprehensiveBookingContact_level2, decomposed_functions_metadata_level1, packages, lodges, decomposed_functions_metadata_sections_schedule_level3, decomposed_registrations__id_buffer_level2, decomposed_registrations_registrationData_lodgeDetails_level2, decomposed_grandLodges__id_buffer_level2, decomposed_functions_metadata_documents_level2, decomposed_registrations_registrationData_attendees_level2, decomposed_functions__id_level1
- **Total Occurrences:** 7,665
- **Consistency Score:** 100.00%
- **Data Types by Collection:**
  - decomposed_registrations_registrationData_metadata_billingDetails_country_level4: number
  - decomposed_functions_metadata_attendance_level2: number
  - decomposed_attendeeData: number
  - functions: number
  - decomposed_registrations__id_level1: number
  - decomposed_registrations_registrationData_calculatedAmounts_level2: number
  - grandLodges: number
  - decomposed_registrations_registrationData_orderDetails_level2: number
  - decomposed_registrations_registrationData_level1: number
  - decomposed_registrations_registrationData_packageDetails_eligibilityCriteria_rules_level4: number
  - decomposed_registrations_registrationData_attendees[0]_ticket_level3: number
  - decomposed_registrations_registrationData_bookingContact_stateTerritory_level3: number
  - registrations: number
  - decomposed_functions_metadata_sections_schedule[2]_items_level4: number
  - masonicProfiles: number
  - decomposed_metadata: number
  - decomposed_lodgeDetails: number
  - decomposed_bookingContacts: number
  - organisations: number
  - decomposed_registrations_registrationData_tickets_level2: number
  - decomposed_registrations_registrationData_selectedPackageDetails_eligibilityCriteria_rules_level4: number
  - decomposed_registrations_registrationData_bookingContact_country_level3: number
  - decomposed_functions_metadata_sections_level2: number
  - decomposed_functions_metadata_sections_schedule[0]_items_level4: number
  - decomposed_attendees: number
  - decomposed_registrations_registrationData_metadata_billingDetails_level3: number
  - eventTickets: number
  - decomposed_registrations_registrationData_packageDetails_registrationTypes_level3: number
  - decomposed_functions__id_buffer_level2: number
  - decomposed_registrations_registrationData_lodgeOrderDetails_level2: number
  - attendees: number
  - decomposed_registrations_registrationData_squareAmounts_level2: number
  - decomposed_registrations_registrationData_metadata_billingDetails_stateTerritory_level4: number
  - tickets: number
  - events: number
  - decomposed_registrations_registrationData_comprehensiveLodgeDetails_level2: number
  - locations: number
  - decomposed_registrations_registrationData_selectedPackageDetails_level2: number
  - decomposed_tickets: number
  - decomposed_functions_metadata_sections_schedule[1]_items_level4: number
  - decomposed_registrations_registrationData_packageDetails_eligibilityCriteria_level3: number
  - decomposed_registrationData: number
  - contacts: number
  - decomposed_registrations_registrationData_metadata_level2: number
  - decomposed_functions_metadata_sections_details_level3: number
  - decomposed_registrations_registrationData_packageDetails_level2: number
  - decomposed_registrations_registrationData_attendees[1]_ticket_level3: number
  - decomposed_grandLodges__id_level1: number
  - customers: number
  - decomposed_registrations_registrationData_bookingContact_level2: number
  - decomposed_registrations_registrationData_selectedPackageDetails_registrationTypes_level3: number
  - decomposed_registrations_registrationData_selectedPackageDetails_eligibilityCriteria_level3: number
  - decomposed_registrations_registrationData_comprehensiveBookingContact_level2: number
  - decomposed_functions_metadata_level1: number
  - packages: number
  - lodges: number
  - decomposed_functions_metadata_sections_schedule_level3: number
  - decomposed_registrations__id_buffer_level2: number
  - decomposed_registrations_registrationData_lodgeDetails_level2: number
  - decomposed_grandLodges__id_buffer_level2: number
  - decomposed_functions_metadata_documents_level2: number
  - decomposed_registrations_registrationData_attendees_level2: number
  - decomposed_functions__id_level1: number

### _id.buffer.10
- **Collections:** decomposed_registrations_registrationData_metadata_billingDetails_country_level4, decomposed_functions_metadata_attendance_level2, decomposed_attendeeData, functions, decomposed_registrations__id_level1, decomposed_registrations_registrationData_calculatedAmounts_level2, grandLodges, decomposed_registrations_registrationData_orderDetails_level2, decomposed_registrations_registrationData_level1, decomposed_registrations_registrationData_packageDetails_eligibilityCriteria_rules_level4, decomposed_registrations_registrationData_attendees[0]_ticket_level3, decomposed_registrations_registrationData_bookingContact_stateTerritory_level3, registrations, decomposed_functions_metadata_sections_schedule[2]_items_level4, masonicProfiles, decomposed_metadata, decomposed_lodgeDetails, decomposed_bookingContacts, organisations, decomposed_registrations_registrationData_tickets_level2, decomposed_registrations_registrationData_selectedPackageDetails_eligibilityCriteria_rules_level4, decomposed_registrations_registrationData_bookingContact_country_level3, decomposed_functions_metadata_sections_level2, decomposed_functions_metadata_sections_schedule[0]_items_level4, decomposed_attendees, decomposed_registrations_registrationData_metadata_billingDetails_level3, eventTickets, decomposed_registrations_registrationData_packageDetails_registrationTypes_level3, decomposed_functions__id_buffer_level2, decomposed_registrations_registrationData_lodgeOrderDetails_level2, attendees, decomposed_registrations_registrationData_squareAmounts_level2, decomposed_registrations_registrationData_metadata_billingDetails_stateTerritory_level4, tickets, events, decomposed_registrations_registrationData_comprehensiveLodgeDetails_level2, locations, decomposed_registrations_registrationData_selectedPackageDetails_level2, decomposed_tickets, decomposed_functions_metadata_sections_schedule[1]_items_level4, decomposed_registrations_registrationData_packageDetails_eligibilityCriteria_level3, decomposed_registrationData, contacts, decomposed_registrations_registrationData_metadata_level2, decomposed_functions_metadata_sections_details_level3, decomposed_registrations_registrationData_packageDetails_level2, decomposed_registrations_registrationData_attendees[1]_ticket_level3, decomposed_grandLodges__id_level1, customers, decomposed_registrations_registrationData_bookingContact_level2, decomposed_registrations_registrationData_selectedPackageDetails_registrationTypes_level3, decomposed_registrations_registrationData_selectedPackageDetails_eligibilityCriteria_level3, decomposed_registrations_registrationData_comprehensiveBookingContact_level2, decomposed_functions_metadata_level1, packages, lodges, decomposed_functions_metadata_sections_schedule_level3, decomposed_registrations__id_buffer_level2, decomposed_registrations_registrationData_lodgeDetails_level2, decomposed_grandLodges__id_buffer_level2, decomposed_functions_metadata_documents_level2, decomposed_registrations_registrationData_attendees_level2, decomposed_functions__id_level1
- **Total Occurrences:** 7,665
- **Consistency Score:** 100.00%
- **Data Types by Collection:**
  - decomposed_registrations_registrationData_metadata_billingDetails_country_level4: number
  - decomposed_functions_metadata_attendance_level2: number
  - decomposed_attendeeData: number
  - functions: number
  - decomposed_registrations__id_level1: number
  - decomposed_registrations_registrationData_calculatedAmounts_level2: number
  - grandLodges: number
  - decomposed_registrations_registrationData_orderDetails_level2: number
  - decomposed_registrations_registrationData_level1: number
  - decomposed_registrations_registrationData_packageDetails_eligibilityCriteria_rules_level4: number
  - decomposed_registrations_registrationData_attendees[0]_ticket_level3: number
  - decomposed_registrations_registrationData_bookingContact_stateTerritory_level3: number
  - registrations: number
  - decomposed_functions_metadata_sections_schedule[2]_items_level4: number
  - masonicProfiles: number
  - decomposed_metadata: number
  - decomposed_lodgeDetails: number
  - decomposed_bookingContacts: number
  - organisations: number
  - decomposed_registrations_registrationData_tickets_level2: number
  - decomposed_registrations_registrationData_selectedPackageDetails_eligibilityCriteria_rules_level4: number
  - decomposed_registrations_registrationData_bookingContact_country_level3: number
  - decomposed_functions_metadata_sections_level2: number
  - decomposed_functions_metadata_sections_schedule[0]_items_level4: number
  - decomposed_attendees: number
  - decomposed_registrations_registrationData_metadata_billingDetails_level3: number
  - eventTickets: number
  - decomposed_registrations_registrationData_packageDetails_registrationTypes_level3: number
  - decomposed_functions__id_buffer_level2: number
  - decomposed_registrations_registrationData_lodgeOrderDetails_level2: number
  - attendees: number
  - decomposed_registrations_registrationData_squareAmounts_level2: number
  - decomposed_registrations_registrationData_metadata_billingDetails_stateTerritory_level4: number
  - tickets: number
  - events: number
  - decomposed_registrations_registrationData_comprehensiveLodgeDetails_level2: number
  - locations: number
  - decomposed_registrations_registrationData_selectedPackageDetails_level2: number
  - decomposed_tickets: number
  - decomposed_functions_metadata_sections_schedule[1]_items_level4: number
  - decomposed_registrations_registrationData_packageDetails_eligibilityCriteria_level3: number
  - decomposed_registrationData: number
  - contacts: number
  - decomposed_registrations_registrationData_metadata_level2: number
  - decomposed_functions_metadata_sections_details_level3: number
  - decomposed_registrations_registrationData_packageDetails_level2: number
  - decomposed_registrations_registrationData_attendees[1]_ticket_level3: number
  - decomposed_grandLodges__id_level1: number
  - customers: number
  - decomposed_registrations_registrationData_bookingContact_level2: number
  - decomposed_registrations_registrationData_selectedPackageDetails_registrationTypes_level3: number
  - decomposed_registrations_registrationData_selectedPackageDetails_eligibilityCriteria_level3: number
  - decomposed_registrations_registrationData_comprehensiveBookingContact_level2: number
  - decomposed_functions_metadata_level1: number
  - packages: number
  - lodges: number
  - decomposed_functions_metadata_sections_schedule_level3: number
  - decomposed_registrations__id_buffer_level2: number
  - decomposed_registrations_registrationData_lodgeDetails_level2: number
  - decomposed_grandLodges__id_buffer_level2: number
  - decomposed_functions_metadata_documents_level2: number
  - decomposed_registrations_registrationData_attendees_level2: number
  - decomposed_functions__id_level1: number

### _id.buffer.11
- **Collections:** decomposed_registrations_registrationData_metadata_billingDetails_country_level4, decomposed_functions_metadata_attendance_level2, decomposed_attendeeData, functions, decomposed_registrations__id_level1, decomposed_registrations_registrationData_calculatedAmounts_level2, grandLodges, decomposed_registrations_registrationData_orderDetails_level2, decomposed_registrations_registrationData_level1, decomposed_registrations_registrationData_packageDetails_eligibilityCriteria_rules_level4, decomposed_registrations_registrationData_attendees[0]_ticket_level3, decomposed_registrations_registrationData_bookingContact_stateTerritory_level3, registrations, decomposed_functions_metadata_sections_schedule[2]_items_level4, masonicProfiles, decomposed_metadata, decomposed_lodgeDetails, decomposed_bookingContacts, organisations, decomposed_registrations_registrationData_tickets_level2, decomposed_registrations_registrationData_selectedPackageDetails_eligibilityCriteria_rules_level4, decomposed_registrations_registrationData_bookingContact_country_level3, decomposed_functions_metadata_sections_level2, decomposed_functions_metadata_sections_schedule[0]_items_level4, decomposed_attendees, decomposed_registrations_registrationData_metadata_billingDetails_level3, eventTickets, decomposed_registrations_registrationData_packageDetails_registrationTypes_level3, decomposed_functions__id_buffer_level2, decomposed_registrations_registrationData_lodgeOrderDetails_level2, attendees, decomposed_registrations_registrationData_squareAmounts_level2, decomposed_registrations_registrationData_metadata_billingDetails_stateTerritory_level4, tickets, events, decomposed_registrations_registrationData_comprehensiveLodgeDetails_level2, locations, decomposed_registrations_registrationData_selectedPackageDetails_level2, decomposed_tickets, decomposed_functions_metadata_sections_schedule[1]_items_level4, decomposed_registrations_registrationData_packageDetails_eligibilityCriteria_level3, decomposed_registrationData, contacts, decomposed_registrations_registrationData_metadata_level2, decomposed_functions_metadata_sections_details_level3, decomposed_registrations_registrationData_packageDetails_level2, decomposed_registrations_registrationData_attendees[1]_ticket_level3, decomposed_grandLodges__id_level1, customers, decomposed_registrations_registrationData_bookingContact_level2, decomposed_registrations_registrationData_selectedPackageDetails_registrationTypes_level3, decomposed_registrations_registrationData_selectedPackageDetails_eligibilityCriteria_level3, decomposed_registrations_registrationData_comprehensiveBookingContact_level2, decomposed_functions_metadata_level1, packages, lodges, decomposed_functions_metadata_sections_schedule_level3, decomposed_registrations__id_buffer_level2, decomposed_registrations_registrationData_lodgeDetails_level2, decomposed_grandLodges__id_buffer_level2, decomposed_functions_metadata_documents_level2, decomposed_registrations_registrationData_attendees_level2, decomposed_functions__id_level1
- **Total Occurrences:** 7,665
- **Consistency Score:** 100.00%
- **Data Types by Collection:**
  - decomposed_registrations_registrationData_metadata_billingDetails_country_level4: number
  - decomposed_functions_metadata_attendance_level2: number
  - decomposed_attendeeData: number
  - functions: number
  - decomposed_registrations__id_level1: number
  - decomposed_registrations_registrationData_calculatedAmounts_level2: number
  - grandLodges: number
  - decomposed_registrations_registrationData_orderDetails_level2: number
  - decomposed_registrations_registrationData_level1: number
  - decomposed_registrations_registrationData_packageDetails_eligibilityCriteria_rules_level4: number
  - decomposed_registrations_registrationData_attendees[0]_ticket_level3: number
  - decomposed_registrations_registrationData_bookingContact_stateTerritory_level3: number
  - registrations: number
  - decomposed_functions_metadata_sections_schedule[2]_items_level4: number
  - masonicProfiles: number
  - decomposed_metadata: number
  - decomposed_lodgeDetails: number
  - decomposed_bookingContacts: number
  - organisations: number
  - decomposed_registrations_registrationData_tickets_level2: number
  - decomposed_registrations_registrationData_selectedPackageDetails_eligibilityCriteria_rules_level4: number
  - decomposed_registrations_registrationData_bookingContact_country_level3: number
  - decomposed_functions_metadata_sections_level2: number
  - decomposed_functions_metadata_sections_schedule[0]_items_level4: number
  - decomposed_attendees: number
  - decomposed_registrations_registrationData_metadata_billingDetails_level3: number
  - eventTickets: number
  - decomposed_registrations_registrationData_packageDetails_registrationTypes_level3: number
  - decomposed_functions__id_buffer_level2: number
  - decomposed_registrations_registrationData_lodgeOrderDetails_level2: number
  - attendees: number
  - decomposed_registrations_registrationData_squareAmounts_level2: number
  - decomposed_registrations_registrationData_metadata_billingDetails_stateTerritory_level4: number
  - tickets: number
  - events: number
  - decomposed_registrations_registrationData_comprehensiveLodgeDetails_level2: number
  - locations: number
  - decomposed_registrations_registrationData_selectedPackageDetails_level2: number
  - decomposed_tickets: number
  - decomposed_functions_metadata_sections_schedule[1]_items_level4: number
  - decomposed_registrations_registrationData_packageDetails_eligibilityCriteria_level3: number
  - decomposed_registrationData: number
  - contacts: number
  - decomposed_registrations_registrationData_metadata_level2: number
  - decomposed_functions_metadata_sections_details_level3: number
  - decomposed_registrations_registrationData_packageDetails_level2: number
  - decomposed_registrations_registrationData_attendees[1]_ticket_level3: number
  - decomposed_grandLodges__id_level1: number
  - customers: number
  - decomposed_registrations_registrationData_bookingContact_level2: number
  - decomposed_registrations_registrationData_selectedPackageDetails_registrationTypes_level3: number
  - decomposed_registrations_registrationData_selectedPackageDetails_eligibilityCriteria_level3: number
  - decomposed_registrations_registrationData_comprehensiveBookingContact_level2: number
  - decomposed_functions_metadata_level1: number
  - packages: number
  - lodges: number
  - decomposed_functions_metadata_sections_schedule_level3: number
  - decomposed_registrations__id_buffer_level2: number
  - decomposed_registrations_registrationData_lodgeDetails_level2: number
  - decomposed_grandLodges__id_buffer_level2: number
  - decomposed_functions_metadata_documents_level2: number
  - decomposed_registrations_registrationData_attendees_level2: number
  - decomposed_functions__id_level1: number

### createdAt
- **Collections:** decomposed_registrations_registrationData_metadata_billingDetails_country_level4, decomposed_functions_metadata_attendance_level2, functions, decomposed_registrations__id_level1, decomposed_registrations_registrationData_calculatedAmounts_level2, grandLodges, decomposed_registrations_registrationData_orderDetails_level2, decomposed_registrations_registrationData_level1, decomposed_registrations_registrationData_packageDetails_eligibilityCriteria_rules_level4, decomposed_registrations_registrationData_attendees[0]_ticket_level3, decomposed_registrations_registrationData_bookingContact_stateTerritory_level3, registrations, decomposed_functions_metadata_sections_schedule[2]_items_level4, masonicProfiles, decomposed_metadata, organisations, decomposed_registrations_registrationData_tickets_level2, squarePayments, decomposed_registrations_registrationData_selectedPackageDetails_eligibilityCriteria_rules_level4, decomposed_registrations_registrationData_bookingContact_country_level3, decomposed_functions_metadata_sections_level2, decomposed_functions_metadata_sections_schedule[0]_items_level4, decomposed_registrations_registrationData_metadata_billingDetails_level3, eventTickets, decomposed_registrations_registrationData_packageDetails_registrationTypes_level3, decomposed_functions__id_buffer_level2, decomposed_registrations_registrationData_lodgeOrderDetails_level2, attendees, decomposed_registrations_registrationData_squareAmounts_level2, decomposed_registrations_registrationData_metadata_billingDetails_stateTerritory_level4, tickets, events, decomposed_registrations_registrationData_comprehensiveLodgeDetails_level2, locations, decomposed_registrations_registrationData_selectedPackageDetails_level2, decomposed_functions_metadata_sections_schedule[1]_items_level4, decomposed_registrations_registrationData_packageDetails_eligibilityCriteria_level3, decomposed_registrationData, contacts, decomposed_registrations_registrationData_metadata_level2, decomposed_functions_metadata_sections_details_level3, decomposed_registrations_registrationData_packageDetails_level2, decomposed_registrations_registrationData_attendees[1]_ticket_level3, decomposed_grandLodges__id_level1, customers, decomposed_registrations_registrationData_bookingContact_level2, decomposed_registrations_registrationData_selectedPackageDetails_registrationTypes_level3, decomposed_registrations_registrationData_selectedPackageDetails_eligibilityCriteria_level3, decomposed_registrations_registrationData_comprehensiveBookingContact_level2, decomposed_functions_metadata_level1, packages, lodges, decomposed_functions_metadata_sections_schedule_level3, decomposed_registrations__id_buffer_level2, decomposed_registrations_registrationData_lodgeDetails_level2, decomposed_grandLodges__id_buffer_level2, decomposed_functions_metadata_documents_level2, decomposed_registrations_registrationData_attendees_level2, decomposed_functions__id_level1
- **Total Occurrences:** 5,670
- **Consistency Score:** 71.19%
- **Data Types by Collection:**
  - decomposed_registrations_registrationData_metadata_billingDetails_country_level4: date
  - decomposed_functions_metadata_attendance_level2: date
  - functions: string
  - decomposed_registrations__id_level1: date
  - decomposed_registrations_registrationData_calculatedAmounts_level2: date
  - grandLodges: string
  - decomposed_registrations_registrationData_orderDetails_level2: date
  - decomposed_registrations_registrationData_level1: date
  - decomposed_registrations_registrationData_packageDetails_eligibilityCriteria_rules_level4: date
  - decomposed_registrations_registrationData_attendees[0]_ticket_level3: date
  - decomposed_registrations_registrationData_bookingContact_stateTerritory_level3: date
  - registrations: string
  - decomposed_functions_metadata_sections_schedule[2]_items_level4: date
  - masonicProfiles: string
  - decomposed_metadata: string
  - organisations: string
  - decomposed_registrations_registrationData_tickets_level2: date
  - squarePayments: string
  - decomposed_registrations_registrationData_selectedPackageDetails_eligibilityCriteria_rules_level4: date
  - decomposed_registrations_registrationData_bookingContact_country_level3: date
  - decomposed_functions_metadata_sections_level2: date
  - decomposed_functions_metadata_sections_schedule[0]_items_level4: date
  - decomposed_registrations_registrationData_metadata_billingDetails_level3: date
  - eventTickets: string
  - decomposed_registrations_registrationData_packageDetails_registrationTypes_level3: date
  - decomposed_functions__id_buffer_level2: date
  - decomposed_registrations_registrationData_lodgeOrderDetails_level2: date
  - attendees: string
  - decomposed_registrations_registrationData_squareAmounts_level2: date
  - decomposed_registrations_registrationData_metadata_billingDetails_stateTerritory_level4: date
  - tickets: string
  - events: string
  - decomposed_registrations_registrationData_comprehensiveLodgeDetails_level2: date
  - locations: string
  - decomposed_registrations_registrationData_selectedPackageDetails_level2: date
  - decomposed_functions_metadata_sections_schedule[1]_items_level4: date
  - decomposed_registrations_registrationData_packageDetails_eligibilityCriteria_level3: date
  - decomposed_registrationData: string
  - contacts: string
  - decomposed_registrations_registrationData_metadata_level2: date
  - decomposed_functions_metadata_sections_details_level3: date
  - decomposed_registrations_registrationData_packageDetails_level2: date
  - decomposed_registrations_registrationData_attendees[1]_ticket_level3: date
  - decomposed_grandLodges__id_level1: date
  - customers: string
  - decomposed_registrations_registrationData_bookingContact_level2: date
  - decomposed_registrations_registrationData_selectedPackageDetails_registrationTypes_level3: date
  - decomposed_registrations_registrationData_selectedPackageDetails_eligibilityCriteria_level3: date
  - decomposed_registrations_registrationData_comprehensiveBookingContact_level2: date
  - decomposed_functions_metadata_level1: date
  - packages: string
  - lodges: string
  - decomposed_functions_metadata_sections_schedule_level3: date
  - decomposed_registrations__id_buffer_level2: date
  - decomposed_registrations_registrationData_lodgeDetails_level2: date
  - decomposed_grandLodges__id_buffer_level2: date
  - decomposed_functions_metadata_documents_level2: date
  - decomposed_registrations_registrationData_attendees_level2: date
  - decomposed_functions__id_level1: date

### sourceId
- **Collections:** decomposed_registrations_registrationData_metadata_billingDetails_country_level4, decomposed_functions_metadata_attendance_level2, decomposed_registrations__id_level1, decomposed_registrations_registrationData_calculatedAmounts_level2, decomposed_registrations_registrationData_orderDetails_level2, decomposed_registrations_registrationData_level1, decomposed_registrations_registrationData_packageDetails_eligibilityCriteria_rules_level4, decomposed_registrations_registrationData_attendees[0]_ticket_level3, decomposed_registrations_registrationData_bookingContact_stateTerritory_level3, decomposed_functions_metadata_sections_schedule[2]_items_level4, decomposed_registrations_registrationData_tickets_level2, decomposed_registrations_registrationData_selectedPackageDetails_eligibilityCriteria_rules_level4, decomposed_registrations_registrationData_bookingContact_country_level3, decomposed_functions_metadata_sections_level2, decomposed_functions_metadata_sections_schedule[0]_items_level4, decomposed_registrations_registrationData_metadata_billingDetails_level3, decomposed_registrations_registrationData_packageDetails_registrationTypes_level3, decomposed_functions__id_buffer_level2, decomposed_registrations_registrationData_lodgeOrderDetails_level2, decomposed_registrations_registrationData_squareAmounts_level2, decomposed_registrations_registrationData_metadata_billingDetails_stateTerritory_level4, decomposed_registrations_registrationData_comprehensiveLodgeDetails_level2, decomposed_registrations_registrationData_selectedPackageDetails_level2, decomposed_functions_metadata_sections_schedule[1]_items_level4, decomposed_registrations_registrationData_packageDetails_eligibilityCriteria_level3, contacts, decomposed_registrations_registrationData_metadata_level2, decomposed_functions_metadata_sections_details_level3, decomposed_registrations_registrationData_packageDetails_level2, decomposed_registrations_registrationData_attendees[1]_ticket_level3, decomposed_grandLodges__id_level1, decomposed_registrations_registrationData_bookingContact_level2, decomposed_registrations_registrationData_selectedPackageDetails_registrationTypes_level3, decomposed_registrations_registrationData_selectedPackageDetails_eligibilityCriteria_level3, decomposed_registrations_registrationData_comprehensiveBookingContact_level2, decomposed_functions_metadata_level1, decomposed_functions_metadata_sections_schedule_level3, decomposed_registrations__id_buffer_level2, decomposed_registrations_registrationData_lodgeDetails_level2, decomposed_grandLodges__id_buffer_level2, decomposed_functions_metadata_documents_level2, decomposed_registrations_registrationData_attendees_level2, decomposed_functions__id_level1
- **Total Occurrences:** 2,273
- **Consistency Score:** 97.67%
- **Data Types by Collection:**
  - decomposed_registrations_registrationData_metadata_billingDetails_country_level4: string
  - decomposed_functions_metadata_attendance_level2: string
  - decomposed_registrations__id_level1: string
  - decomposed_registrations_registrationData_calculatedAmounts_level2: string
  - decomposed_registrations_registrationData_orderDetails_level2: string
  - decomposed_registrations_registrationData_level1: string
  - decomposed_registrations_registrationData_packageDetails_eligibilityCriteria_rules_level4: string
  - decomposed_registrations_registrationData_attendees[0]_ticket_level3: string
  - decomposed_registrations_registrationData_bookingContact_stateTerritory_level3: string
  - decomposed_functions_metadata_sections_schedule[2]_items_level4: string
  - decomposed_registrations_registrationData_tickets_level2: string
  - decomposed_registrations_registrationData_selectedPackageDetails_eligibilityCriteria_rules_level4: string
  - decomposed_registrations_registrationData_bookingContact_country_level3: string
  - decomposed_functions_metadata_sections_level2: string
  - decomposed_functions_metadata_sections_schedule[0]_items_level4: string
  - decomposed_registrations_registrationData_metadata_billingDetails_level3: string
  - decomposed_registrations_registrationData_packageDetails_registrationTypes_level3: string
  - decomposed_functions__id_buffer_level2: string
  - decomposed_registrations_registrationData_lodgeOrderDetails_level2: string
  - decomposed_registrations_registrationData_squareAmounts_level2: string
  - decomposed_registrations_registrationData_metadata_billingDetails_stateTerritory_level4: string
  - decomposed_registrations_registrationData_comprehensiveLodgeDetails_level2: string
  - decomposed_registrations_registrationData_selectedPackageDetails_level2: string
  - decomposed_functions_metadata_sections_schedule[1]_items_level4: string
  - decomposed_registrations_registrationData_packageDetails_eligibilityCriteria_level3: string
  - contacts: null
  - decomposed_registrations_registrationData_metadata_level2: string
  - decomposed_functions_metadata_sections_details_level3: string
  - decomposed_registrations_registrationData_packageDetails_level2: string
  - decomposed_registrations_registrationData_attendees[1]_ticket_level3: string
  - decomposed_grandLodges__id_level1: string
  - decomposed_registrations_registrationData_bookingContact_level2: string
  - decomposed_registrations_registrationData_selectedPackageDetails_registrationTypes_level3: string
  - decomposed_registrations_registrationData_selectedPackageDetails_eligibilityCriteria_level3: string
  - decomposed_registrations_registrationData_comprehensiveBookingContact_level2: string
  - decomposed_functions_metadata_level1: string
  - decomposed_functions_metadata_sections_schedule_level3: string
  - decomposed_registrations__id_buffer_level2: string
  - decomposed_registrations_registrationData_lodgeDetails_level2: string
  - decomposed_grandLodges__id_buffer_level2: string
  - decomposed_functions_metadata_documents_level2: string
  - decomposed_registrations_registrationData_attendees_level2: string
  - decomposed_functions__id_level1: string

### sourcePath
- **Collections:** decomposed_registrations_registrationData_metadata_billingDetails_country_level4, decomposed_functions_metadata_attendance_level2, decomposed_registrations__id_level1, decomposed_registrations_registrationData_calculatedAmounts_level2, decomposed_registrations_registrationData_orderDetails_level2, decomposed_registrations_registrationData_level1, decomposed_registrations_registrationData_packageDetails_eligibilityCriteria_rules_level4, decomposed_registrations_registrationData_attendees[0]_ticket_level3, decomposed_registrations_registrationData_bookingContact_stateTerritory_level3, decomposed_functions_metadata_sections_schedule[2]_items_level4, decomposed_registrations_registrationData_tickets_level2, decomposed_registrations_registrationData_selectedPackageDetails_eligibilityCriteria_rules_level4, decomposed_registrations_registrationData_bookingContact_country_level3, decomposed_functions_metadata_sections_level2, decomposed_functions_metadata_sections_schedule[0]_items_level4, decomposed_registrations_registrationData_metadata_billingDetails_level3, decomposed_registrations_registrationData_packageDetails_registrationTypes_level3, decomposed_functions__id_buffer_level2, decomposed_registrations_registrationData_lodgeOrderDetails_level2, decomposed_registrations_registrationData_squareAmounts_level2, decomposed_registrations_registrationData_metadata_billingDetails_stateTerritory_level4, decomposed_registrations_registrationData_comprehensiveLodgeDetails_level2, decomposed_registrations_registrationData_selectedPackageDetails_level2, decomposed_functions_metadata_sections_schedule[1]_items_level4, decomposed_registrations_registrationData_packageDetails_eligibilityCriteria_level3, decomposed_registrations_registrationData_metadata_level2, decomposed_functions_metadata_sections_details_level3, decomposed_registrations_registrationData_packageDetails_level2, decomposed_registrations_registrationData_attendees[1]_ticket_level3, decomposed_grandLodges__id_level1, decomposed_registrations_registrationData_bookingContact_level2, decomposed_registrations_registrationData_selectedPackageDetails_registrationTypes_level3, decomposed_registrations_registrationData_selectedPackageDetails_eligibilityCriteria_level3, decomposed_registrations_registrationData_comprehensiveBookingContact_level2, decomposed_functions_metadata_level1, decomposed_functions_metadata_sections_schedule_level3, decomposed_registrations__id_buffer_level2, decomposed_registrations_registrationData_lodgeDetails_level2, decomposed_grandLodges__id_buffer_level2, decomposed_functions_metadata_documents_level2, decomposed_registrations_registrationData_attendees_level2, decomposed_functions__id_level1
- **Total Occurrences:** 1,831
- **Consistency Score:** 100.00%
- **Data Types by Collection:**
  - decomposed_registrations_registrationData_metadata_billingDetails_country_level4: string
  - decomposed_functions_metadata_attendance_level2: string
  - decomposed_registrations__id_level1: string
  - decomposed_registrations_registrationData_calculatedAmounts_level2: string
  - decomposed_registrations_registrationData_orderDetails_level2: string
  - decomposed_registrations_registrationData_level1: string
  - decomposed_registrations_registrationData_packageDetails_eligibilityCriteria_rules_level4: string
  - decomposed_registrations_registrationData_attendees[0]_ticket_level3: string
  - decomposed_registrations_registrationData_bookingContact_stateTerritory_level3: string
  - decomposed_functions_metadata_sections_schedule[2]_items_level4: string
  - decomposed_registrations_registrationData_tickets_level2: string
  - decomposed_registrations_registrationData_selectedPackageDetails_eligibilityCriteria_rules_level4: string
  - decomposed_registrations_registrationData_bookingContact_country_level3: string
  - decomposed_functions_metadata_sections_level2: string
  - decomposed_functions_metadata_sections_schedule[0]_items_level4: string
  - decomposed_registrations_registrationData_metadata_billingDetails_level3: string
  - decomposed_registrations_registrationData_packageDetails_registrationTypes_level3: string
  - decomposed_functions__id_buffer_level2: string
  - decomposed_registrations_registrationData_lodgeOrderDetails_level2: string
  - decomposed_registrations_registrationData_squareAmounts_level2: string
  - decomposed_registrations_registrationData_metadata_billingDetails_stateTerritory_level4: string
  - decomposed_registrations_registrationData_comprehensiveLodgeDetails_level2: string
  - decomposed_registrations_registrationData_selectedPackageDetails_level2: string
  - decomposed_functions_metadata_sections_schedule[1]_items_level4: string
  - decomposed_registrations_registrationData_packageDetails_eligibilityCriteria_level3: string
  - decomposed_registrations_registrationData_metadata_level2: string
  - decomposed_functions_metadata_sections_details_level3: string
  - decomposed_registrations_registrationData_packageDetails_level2: string
  - decomposed_registrations_registrationData_attendees[1]_ticket_level3: string
  - decomposed_grandLodges__id_level1: string
  - decomposed_registrations_registrationData_bookingContact_level2: string
  - decomposed_registrations_registrationData_selectedPackageDetails_registrationTypes_level3: string
  - decomposed_registrations_registrationData_selectedPackageDetails_eligibilityCriteria_level3: string
  - decomposed_registrations_registrationData_comprehensiveBookingContact_level2: string
  - decomposed_functions_metadata_level1: string
  - decomposed_functions_metadata_sections_schedule_level3: string
  - decomposed_registrations__id_buffer_level2: string
  - decomposed_registrations_registrationData_lodgeDetails_level2: string
  - decomposed_grandLodges__id_buffer_level2: string
  - decomposed_functions_metadata_documents_level2: string
  - decomposed_registrations_registrationData_attendees_level2: string
  - decomposed_functions__id_level1: string

### decompositionLevel
- **Collections:** decomposed_registrations_registrationData_metadata_billingDetails_country_level4, decomposed_functions_metadata_attendance_level2, decomposed_registrations__id_level1, decomposed_registrations_registrationData_calculatedAmounts_level2, decomposed_registrations_registrationData_orderDetails_level2, decomposed_registrations_registrationData_level1, decomposed_registrations_registrationData_packageDetails_eligibilityCriteria_rules_level4, decomposed_registrations_registrationData_attendees[0]_ticket_level3, decomposed_registrations_registrationData_bookingContact_stateTerritory_level3, decomposed_functions_metadata_sections_schedule[2]_items_level4, decomposed_registrations_registrationData_tickets_level2, decomposed_registrations_registrationData_selectedPackageDetails_eligibilityCriteria_rules_level4, decomposed_registrations_registrationData_bookingContact_country_level3, decomposed_functions_metadata_sections_level2, decomposed_functions_metadata_sections_schedule[0]_items_level4, decomposed_registrations_registrationData_metadata_billingDetails_level3, decomposed_registrations_registrationData_packageDetails_registrationTypes_level3, decomposed_functions__id_buffer_level2, decomposed_registrations_registrationData_lodgeOrderDetails_level2, decomposed_registrations_registrationData_squareAmounts_level2, decomposed_registrations_registrationData_metadata_billingDetails_stateTerritory_level4, decomposed_registrations_registrationData_comprehensiveLodgeDetails_level2, decomposed_registrations_registrationData_selectedPackageDetails_level2, decomposed_functions_metadata_sections_schedule[1]_items_level4, decomposed_registrations_registrationData_packageDetails_eligibilityCriteria_level3, decomposed_registrations_registrationData_metadata_level2, decomposed_functions_metadata_sections_details_level3, decomposed_registrations_registrationData_packageDetails_level2, decomposed_registrations_registrationData_attendees[1]_ticket_level3, decomposed_grandLodges__id_level1, decomposed_registrations_registrationData_bookingContact_level2, decomposed_registrations_registrationData_selectedPackageDetails_registrationTypes_level3, decomposed_registrations_registrationData_selectedPackageDetails_eligibilityCriteria_level3, decomposed_registrations_registrationData_comprehensiveBookingContact_level2, decomposed_functions_metadata_level1, decomposed_functions_metadata_sections_schedule_level3, decomposed_registrations__id_buffer_level2, decomposed_registrations_registrationData_lodgeDetails_level2, decomposed_grandLodges__id_buffer_level2, decomposed_functions_metadata_documents_level2, decomposed_registrations_registrationData_attendees_level2, decomposed_functions__id_level1
- **Total Occurrences:** 1,831
- **Consistency Score:** 100.00%
- **Data Types by Collection:**
  - decomposed_registrations_registrationData_metadata_billingDetails_country_level4: number
  - decomposed_functions_metadata_attendance_level2: number
  - decomposed_registrations__id_level1: number
  - decomposed_registrations_registrationData_calculatedAmounts_level2: number
  - decomposed_registrations_registrationData_orderDetails_level2: number
  - decomposed_registrations_registrationData_level1: number
  - decomposed_registrations_registrationData_packageDetails_eligibilityCriteria_rules_level4: number
  - decomposed_registrations_registrationData_attendees[0]_ticket_level3: number
  - decomposed_registrations_registrationData_bookingContact_stateTerritory_level3: number
  - decomposed_functions_metadata_sections_schedule[2]_items_level4: number
  - decomposed_registrations_registrationData_tickets_level2: number
  - decomposed_registrations_registrationData_selectedPackageDetails_eligibilityCriteria_rules_level4: number
  - decomposed_registrations_registrationData_bookingContact_country_level3: number
  - decomposed_functions_metadata_sections_level2: number
  - decomposed_functions_metadata_sections_schedule[0]_items_level4: number
  - decomposed_registrations_registrationData_metadata_billingDetails_level3: number
  - decomposed_registrations_registrationData_packageDetails_registrationTypes_level3: number
  - decomposed_functions__id_buffer_level2: number
  - decomposed_registrations_registrationData_lodgeOrderDetails_level2: number
  - decomposed_registrations_registrationData_squareAmounts_level2: number
  - decomposed_registrations_registrationData_metadata_billingDetails_stateTerritory_level4: number
  - decomposed_registrations_registrationData_comprehensiveLodgeDetails_level2: number
  - decomposed_registrations_registrationData_selectedPackageDetails_level2: number
  - decomposed_functions_metadata_sections_schedule[1]_items_level4: number
  - decomposed_registrations_registrationData_packageDetails_eligibilityCriteria_level3: number
  - decomposed_registrations_registrationData_metadata_level2: number
  - decomposed_functions_metadata_sections_details_level3: number
  - decomposed_registrations_registrationData_packageDetails_level2: number
  - decomposed_registrations_registrationData_attendees[1]_ticket_level3: number
  - decomposed_grandLodges__id_level1: number
  - decomposed_registrations_registrationData_bookingContact_level2: number
  - decomposed_registrations_registrationData_selectedPackageDetails_registrationTypes_level3: number
  - decomposed_registrations_registrationData_selectedPackageDetails_eligibilityCriteria_level3: number
  - decomposed_registrations_registrationData_comprehensiveBookingContact_level2: number
  - decomposed_functions_metadata_level1: number
  - decomposed_functions_metadata_sections_schedule_level3: number
  - decomposed_registrations__id_buffer_level2: number
  - decomposed_registrations_registrationData_lodgeDetails_level2: number
  - decomposed_grandLodges__id_buffer_level2: number
  - decomposed_functions_metadata_documents_level2: number
  - decomposed_registrations_registrationData_attendees_level2: number
  - decomposed_functions__id_level1: number

### parentCollection
- **Collections:** decomposed_registrations_registrationData_metadata_billingDetails_country_level4, decomposed_functions_metadata_attendance_level2, decomposed_registrations__id_level1, decomposed_registrations_registrationData_calculatedAmounts_level2, decomposed_registrations_registrationData_orderDetails_level2, decomposed_registrations_registrationData_level1, decomposed_registrations_registrationData_packageDetails_eligibilityCriteria_rules_level4, decomposed_registrations_registrationData_attendees[0]_ticket_level3, decomposed_registrations_registrationData_bookingContact_stateTerritory_level3, decomposed_functions_metadata_sections_schedule[2]_items_level4, decomposed_registrations_registrationData_tickets_level2, decomposed_registrations_registrationData_selectedPackageDetails_eligibilityCriteria_rules_level4, decomposed_registrations_registrationData_bookingContact_country_level3, decomposed_functions_metadata_sections_level2, decomposed_functions_metadata_sections_schedule[0]_items_level4, decomposed_registrations_registrationData_metadata_billingDetails_level3, decomposed_registrations_registrationData_packageDetails_registrationTypes_level3, decomposed_functions__id_buffer_level2, decomposed_registrations_registrationData_lodgeOrderDetails_level2, decomposed_registrations_registrationData_squareAmounts_level2, decomposed_registrations_registrationData_metadata_billingDetails_stateTerritory_level4, decomposed_registrations_registrationData_comprehensiveLodgeDetails_level2, decomposed_registrations_registrationData_selectedPackageDetails_level2, decomposed_functions_metadata_sections_schedule[1]_items_level4, decomposed_registrations_registrationData_packageDetails_eligibilityCriteria_level3, decomposed_registrations_registrationData_metadata_level2, decomposed_functions_metadata_sections_details_level3, decomposed_registrations_registrationData_packageDetails_level2, decomposed_registrations_registrationData_attendees[1]_ticket_level3, decomposed_grandLodges__id_level1, decomposed_registrations_registrationData_bookingContact_level2, decomposed_registrations_registrationData_selectedPackageDetails_registrationTypes_level3, decomposed_registrations_registrationData_selectedPackageDetails_eligibilityCriteria_level3, decomposed_registrations_registrationData_comprehensiveBookingContact_level2, decomposed_functions_metadata_level1, decomposed_functions_metadata_sections_schedule_level3, decomposed_registrations__id_buffer_level2, decomposed_registrations_registrationData_lodgeDetails_level2, decomposed_grandLodges__id_buffer_level2, decomposed_functions_metadata_documents_level2, decomposed_registrations_registrationData_attendees_level2, decomposed_functions__id_level1
- **Total Occurrences:** 1,831
- **Consistency Score:** 100.00%
- **Data Types by Collection:**
  - decomposed_registrations_registrationData_metadata_billingDetails_country_level4: string
  - decomposed_functions_metadata_attendance_level2: string
  - decomposed_registrations__id_level1: string
  - decomposed_registrations_registrationData_calculatedAmounts_level2: string
  - decomposed_registrations_registrationData_orderDetails_level2: string
  - decomposed_registrations_registrationData_level1: string
  - decomposed_registrations_registrationData_packageDetails_eligibilityCriteria_rules_level4: string
  - decomposed_registrations_registrationData_attendees[0]_ticket_level3: string
  - decomposed_registrations_registrationData_bookingContact_stateTerritory_level3: string
  - decomposed_functions_metadata_sections_schedule[2]_items_level4: string
  - decomposed_registrations_registrationData_tickets_level2: string
  - decomposed_registrations_registrationData_selectedPackageDetails_eligibilityCriteria_rules_level4: string
  - decomposed_registrations_registrationData_bookingContact_country_level3: string
  - decomposed_functions_metadata_sections_level2: string
  - decomposed_functions_metadata_sections_schedule[0]_items_level4: string
  - decomposed_registrations_registrationData_metadata_billingDetails_level3: string
  - decomposed_registrations_registrationData_packageDetails_registrationTypes_level3: string
  - decomposed_functions__id_buffer_level2: string
  - decomposed_registrations_registrationData_lodgeOrderDetails_level2: string
  - decomposed_registrations_registrationData_squareAmounts_level2: string
  - decomposed_registrations_registrationData_metadata_billingDetails_stateTerritory_level4: string
  - decomposed_registrations_registrationData_comprehensiveLodgeDetails_level2: string
  - decomposed_registrations_registrationData_selectedPackageDetails_level2: string
  - decomposed_functions_metadata_sections_schedule[1]_items_level4: string
  - decomposed_registrations_registrationData_packageDetails_eligibilityCriteria_level3: string
  - decomposed_registrations_registrationData_metadata_level2: string
  - decomposed_functions_metadata_sections_details_level3: string
  - decomposed_registrations_registrationData_packageDetails_level2: string
  - decomposed_registrations_registrationData_attendees[1]_ticket_level3: string
  - decomposed_grandLodges__id_level1: string
  - decomposed_registrations_registrationData_bookingContact_level2: string
  - decomposed_registrations_registrationData_selectedPackageDetails_registrationTypes_level3: string
  - decomposed_registrations_registrationData_selectedPackageDetails_eligibilityCriteria_level3: string
  - decomposed_registrations_registrationData_comprehensiveBookingContact_level2: string
  - decomposed_functions_metadata_level1: string
  - decomposed_functions_metadata_sections_schedule_level3: string
  - decomposed_registrations__id_buffer_level2: string
  - decomposed_registrations_registrationData_lodgeDetails_level2: string
  - decomposed_grandLodges__id_buffer_level2: string
  - decomposed_functions_metadata_documents_level2: string
  - decomposed_registrations_registrationData_attendees_level2: string
  - decomposed_functions__id_level1: string

### data
- **Collections:** decomposed_registrations_registrationData_metadata_billingDetails_country_level4, decomposed_functions_metadata_attendance_level2, decomposed_registrations__id_level1, decomposed_registrations_registrationData_calculatedAmounts_level2, decomposed_registrations_registrationData_orderDetails_level2, decomposed_registrations_registrationData_level1, decomposed_registrations_registrationData_packageDetails_eligibilityCriteria_rules_level4, decomposed_registrations_registrationData_attendees[0]_ticket_level3, decomposed_registrations_registrationData_bookingContact_stateTerritory_level3, decomposed_functions_metadata_sections_schedule[2]_items_level4, decomposed_registrations_registrationData_tickets_level2, decomposed_registrations_registrationData_selectedPackageDetails_eligibilityCriteria_rules_level4, decomposed_registrations_registrationData_bookingContact_country_level3, decomposed_functions_metadata_sections_level2, decomposed_functions_metadata_sections_schedule[0]_items_level4, decomposed_registrations_registrationData_metadata_billingDetails_level3, decomposed_registrations_registrationData_packageDetails_registrationTypes_level3, decomposed_functions__id_buffer_level2, decomposed_registrations_registrationData_lodgeOrderDetails_level2, decomposed_registrations_registrationData_squareAmounts_level2, decomposed_registrations_registrationData_metadata_billingDetails_stateTerritory_level4, decomposed_registrations_registrationData_comprehensiveLodgeDetails_level2, decomposed_registrations_registrationData_selectedPackageDetails_level2, decomposed_functions_metadata_sections_schedule[1]_items_level4, decomposed_registrations_registrationData_packageDetails_eligibilityCriteria_level3, decomposed_registrations_registrationData_metadata_level2, decomposed_functions_metadata_sections_details_level3, decomposed_registrations_registrationData_packageDetails_level2, decomposed_registrations_registrationData_attendees[1]_ticket_level3, decomposed_grandLodges__id_level1, decomposed_registrations_registrationData_bookingContact_level2, decomposed_registrations_registrationData_selectedPackageDetails_registrationTypes_level3, decomposed_registrations_registrationData_selectedPackageDetails_eligibilityCriteria_level3, decomposed_registrations_registrationData_comprehensiveBookingContact_level2, decomposed_functions_metadata_level1, decomposed_functions_metadata_sections_schedule_level3, decomposed_registrations__id_buffer_level2, decomposed_registrations_registrationData_lodgeDetails_level2, decomposed_grandLodges__id_buffer_level2, decomposed_functions_metadata_documents_level2, decomposed_registrations_registrationData_attendees_level2, decomposed_functions__id_level1
- **Total Occurrences:** 1,831
- **Consistency Score:** 95.24%
- **Data Types by Collection:**
  - decomposed_registrations_registrationData_metadata_billingDetails_country_level4: object
  - decomposed_functions_metadata_attendance_level2: object
  - decomposed_registrations__id_level1: object
  - decomposed_registrations_registrationData_calculatedAmounts_level2: object
  - decomposed_registrations_registrationData_orderDetails_level2: object
  - decomposed_registrations_registrationData_level1: object
  - decomposed_registrations_registrationData_packageDetails_eligibilityCriteria_rules_level4: object
  - decomposed_registrations_registrationData_attendees[0]_ticket_level3: object
  - decomposed_registrations_registrationData_bookingContact_stateTerritory_level3: object
  - decomposed_functions_metadata_sections_schedule[2]_items_level4: object
  - decomposed_registrations_registrationData_tickets_level2: object
  - decomposed_registrations_registrationData_selectedPackageDetails_eligibilityCriteria_rules_level4: object
  - decomposed_registrations_registrationData_bookingContact_country_level3: object
  - decomposed_functions_metadata_sections_level2: object
  - decomposed_functions_metadata_sections_schedule[0]_items_level4: object
  - decomposed_registrations_registrationData_metadata_billingDetails_level3: object
  - decomposed_registrations_registrationData_packageDetails_registrationTypes_level3: string
  - decomposed_functions__id_buffer_level2: object
  - decomposed_registrations_registrationData_lodgeOrderDetails_level2: object
  - decomposed_registrations_registrationData_squareAmounts_level2: object
  - decomposed_registrations_registrationData_metadata_billingDetails_stateTerritory_level4: object
  - decomposed_registrations_registrationData_comprehensiveLodgeDetails_level2: object
  - decomposed_registrations_registrationData_selectedPackageDetails_level2: object
  - decomposed_functions_metadata_sections_schedule[1]_items_level4: object
  - decomposed_registrations_registrationData_packageDetails_eligibilityCriteria_level3: object
  - decomposed_registrations_registrationData_metadata_level2: object
  - decomposed_functions_metadata_sections_details_level3: object
  - decomposed_registrations_registrationData_packageDetails_level2: object
  - decomposed_registrations_registrationData_attendees[1]_ticket_level3: object
  - decomposed_grandLodges__id_level1: object
  - decomposed_registrations_registrationData_bookingContact_level2: object
  - decomposed_registrations_registrationData_selectedPackageDetails_registrationTypes_level3: string
  - decomposed_registrations_registrationData_selectedPackageDetails_eligibilityCriteria_level3: object
  - decomposed_registrations_registrationData_comprehensiveBookingContact_level2: object
  - decomposed_functions_metadata_level1: object
  - decomposed_functions_metadata_sections_schedule_level3: object
  - decomposed_registrations__id_buffer_level2: object
  - decomposed_registrations_registrationData_lodgeDetails_level2: object
  - decomposed_grandLodges__id_buffer_level2: object
  - decomposed_functions_metadata_documents_level2: object
  - decomposed_registrations_registrationData_attendees_level2: object
  - decomposed_functions__id_level1: object

## Data Type Mismatches

### _id
- **Collections:** decomposed_registrations_registrationData_metadata_billingDetails_country_level4, decomposed_functions_metadata_attendance_level2, decomposed_attendeeData, functions, decomposed_registrations__id_level1, decomposed_registrations_registrationData_calculatedAmounts_level2, grandLodges, decomposed_registrations_registrationData_orderDetails_level2, decomposed_registrations_registrationData_level1, decomposed_registrations_registrationData_packageDetails_eligibilityCriteria_rules_level4, decomposed_registrations_registrationData_attendees[0]_ticket_level3, decomposed_registrations_registrationData_bookingContact_stateTerritory_level3, registrations, decomposed_functions_metadata_sections_schedule[2]_items_level4, masonicProfiles, decomposed_metadata, decomposed_lodgeDetails, decomposed_bookingContacts, organisations, decomposed_registrations_registrationData_tickets_level2, stripePayments, squarePayments, decomposed_registrations_registrationData_selectedPackageDetails_eligibilityCriteria_rules_level4, decomposed_registrations_registrationData_bookingContact_country_level3, decomposed_functions_metadata_sections_level2, decomposed_functions_metadata_sections_schedule[0]_items_level4, decomposed_attendees, decomposed_registrations_registrationData_metadata_billingDetails_level3, eventTickets, decomposed_registrations_registrationData_packageDetails_registrationTypes_level3, decomposed_functions__id_buffer_level2, decomposed_registrations_registrationData_lodgeOrderDetails_level2, attendees, decomposed_registrations_registrationData_squareAmounts_level2, decomposed_registrations_registrationData_metadata_billingDetails_stateTerritory_level4, tickets, events, decomposed_registrations_registrationData_comprehensiveLodgeDetails_level2, locations, decomposed_registrations_registrationData_selectedPackageDetails_level2, decomposed_tickets, decomposed_functions_metadata_sections_schedule[1]_items_level4, decomposed_registrations_registrationData_packageDetails_eligibilityCriteria_level3, decomposed_registrationData, contacts, decomposed_registrations_registrationData_metadata_level2, decomposed_functions_metadata_sections_details_level3, decomposed_registrations_registrationData_packageDetails_level2, decomposed_registrations_registrationData_attendees[1]_ticket_level3, decomposed_grandLodges__id_level1, customers, decomposed_registrations_registrationData_bookingContact_level2, decomposed_registrations_registrationData_selectedPackageDetails_registrationTypes_level3, decomposed_registrations_registrationData_selectedPackageDetails_eligibilityCriteria_level3, decomposed_registrations_registrationData_comprehensiveBookingContact_level2, decomposed_functions_metadata_level1, packages, lodges, decomposed_functions_metadata_sections_schedule_level3, decomposed_registrations__id_buffer_level2, decomposed_registrations_registrationData_lodgeDetails_level2, decomposed_grandLodges__id_buffer_level2, decomposed_functions_metadata_documents_level2, decomposed_registrations_registrationData_attendees_level2, decomposed_functions__id_level1
- **Consistency Score:** 95.38%
- **Conflicting Types:**
  - decomposed_registrations_registrationData_metadata_billingDetails_country_level4: object
  - decomposed_functions_metadata_attendance_level2: object
  - decomposed_attendeeData: object
  - functions: object
  - decomposed_registrations__id_level1: object
  - decomposed_registrations_registrationData_calculatedAmounts_level2: object
  - grandLodges: object
  - decomposed_registrations_registrationData_orderDetails_level2: object
  - decomposed_registrations_registrationData_level1: object
  - decomposed_registrations_registrationData_packageDetails_eligibilityCriteria_rules_level4: object
  - decomposed_registrations_registrationData_attendees[0]_ticket_level3: object
  - decomposed_registrations_registrationData_bookingContact_stateTerritory_level3: object
  - registrations: object
  - decomposed_functions_metadata_sections_schedule[2]_items_level4: object
  - masonicProfiles: object
  - decomposed_metadata: object
  - decomposed_lodgeDetails: object
  - decomposed_bookingContacts: object
  - organisations: object
  - decomposed_registrations_registrationData_tickets_level2: object
  - stripePayments: string
  - squarePayments: string
  - decomposed_registrations_registrationData_selectedPackageDetails_eligibilityCriteria_rules_level4: object
  - decomposed_registrations_registrationData_bookingContact_country_level3: object
  - decomposed_functions_metadata_sections_level2: object
  - decomposed_functions_metadata_sections_schedule[0]_items_level4: object
  - decomposed_attendees: object
  - decomposed_registrations_registrationData_metadata_billingDetails_level3: object
  - eventTickets: object
  - decomposed_registrations_registrationData_packageDetails_registrationTypes_level3: object
  - decomposed_functions__id_buffer_level2: object
  - decomposed_registrations_registrationData_lodgeOrderDetails_level2: object
  - attendees: object
  - decomposed_registrations_registrationData_squareAmounts_level2: object
  - decomposed_registrations_registrationData_metadata_billingDetails_stateTerritory_level4: object
  - tickets: object
  - events: object
  - decomposed_registrations_registrationData_comprehensiveLodgeDetails_level2: object
  - locations: object
  - decomposed_registrations_registrationData_selectedPackageDetails_level2: object
  - decomposed_tickets: object
  - decomposed_functions_metadata_sections_schedule[1]_items_level4: object
  - decomposed_registrations_registrationData_packageDetails_eligibilityCriteria_level3: object
  - decomposed_registrationData: object, string
  - contacts: object
  - decomposed_registrations_registrationData_metadata_level2: object
  - decomposed_functions_metadata_sections_details_level3: object
  - decomposed_registrations_registrationData_packageDetails_level2: object
  - decomposed_registrations_registrationData_attendees[1]_ticket_level3: object
  - decomposed_grandLodges__id_level1: object
  - customers: object
  - decomposed_registrations_registrationData_bookingContact_level2: object
  - decomposed_registrations_registrationData_selectedPackageDetails_registrationTypes_level3: object
  - decomposed_registrations_registrationData_selectedPackageDetails_eligibilityCriteria_level3: object
  - decomposed_registrations_registrationData_comprehensiveBookingContact_level2: object
  - decomposed_functions_metadata_level1: object
  - packages: object
  - lodges: object
  - decomposed_functions_metadata_sections_schedule_level3: object
  - decomposed_registrations__id_buffer_level2: object
  - decomposed_registrations_registrationData_lodgeDetails_level2: object
  - decomposed_grandLodges__id_buffer_level2: object
  - decomposed_functions_metadata_documents_level2: object
  - decomposed_registrations_registrationData_attendees_level2: object
  - decomposed_functions__id_level1: object

### createdAt
- **Collections:** decomposed_registrations_registrationData_metadata_billingDetails_country_level4, decomposed_functions_metadata_attendance_level2, functions, decomposed_registrations__id_level1, decomposed_registrations_registrationData_calculatedAmounts_level2, grandLodges, decomposed_registrations_registrationData_orderDetails_level2, decomposed_registrations_registrationData_level1, decomposed_registrations_registrationData_packageDetails_eligibilityCriteria_rules_level4, decomposed_registrations_registrationData_attendees[0]_ticket_level3, decomposed_registrations_registrationData_bookingContact_stateTerritory_level3, registrations, decomposed_functions_metadata_sections_schedule[2]_items_level4, masonicProfiles, decomposed_metadata, organisations, decomposed_registrations_registrationData_tickets_level2, squarePayments, decomposed_registrations_registrationData_selectedPackageDetails_eligibilityCriteria_rules_level4, decomposed_registrations_registrationData_bookingContact_country_level3, decomposed_functions_metadata_sections_level2, decomposed_functions_metadata_sections_schedule[0]_items_level4, decomposed_registrations_registrationData_metadata_billingDetails_level3, eventTickets, decomposed_registrations_registrationData_packageDetails_registrationTypes_level3, decomposed_functions__id_buffer_level2, decomposed_registrations_registrationData_lodgeOrderDetails_level2, attendees, decomposed_registrations_registrationData_squareAmounts_level2, decomposed_registrations_registrationData_metadata_billingDetails_stateTerritory_level4, tickets, events, decomposed_registrations_registrationData_comprehensiveLodgeDetails_level2, locations, decomposed_registrations_registrationData_selectedPackageDetails_level2, decomposed_functions_metadata_sections_schedule[1]_items_level4, decomposed_registrations_registrationData_packageDetails_eligibilityCriteria_level3, decomposed_registrationData, contacts, decomposed_registrations_registrationData_metadata_level2, decomposed_functions_metadata_sections_details_level3, decomposed_registrations_registrationData_packageDetails_level2, decomposed_registrations_registrationData_attendees[1]_ticket_level3, decomposed_grandLodges__id_level1, customers, decomposed_registrations_registrationData_bookingContact_level2, decomposed_registrations_registrationData_selectedPackageDetails_registrationTypes_level3, decomposed_registrations_registrationData_selectedPackageDetails_eligibilityCriteria_level3, decomposed_registrations_registrationData_comprehensiveBookingContact_level2, decomposed_functions_metadata_level1, packages, lodges, decomposed_functions_metadata_sections_schedule_level3, decomposed_registrations__id_buffer_level2, decomposed_registrations_registrationData_lodgeDetails_level2, decomposed_grandLodges__id_buffer_level2, decomposed_functions_metadata_documents_level2, decomposed_registrations_registrationData_attendees_level2, decomposed_functions__id_level1
- **Consistency Score:** 71.19%
- **Conflicting Types:**
  - decomposed_registrations_registrationData_metadata_billingDetails_country_level4: date
  - decomposed_functions_metadata_attendance_level2: date
  - functions: string
  - decomposed_registrations__id_level1: date
  - decomposed_registrations_registrationData_calculatedAmounts_level2: date
  - grandLodges: string
  - decomposed_registrations_registrationData_orderDetails_level2: date
  - decomposed_registrations_registrationData_level1: date
  - decomposed_registrations_registrationData_packageDetails_eligibilityCriteria_rules_level4: date
  - decomposed_registrations_registrationData_attendees[0]_ticket_level3: date
  - decomposed_registrations_registrationData_bookingContact_stateTerritory_level3: date
  - registrations: string
  - decomposed_functions_metadata_sections_schedule[2]_items_level4: date
  - masonicProfiles: string
  - decomposed_metadata: string
  - organisations: string
  - decomposed_registrations_registrationData_tickets_level2: date
  - squarePayments: string
  - decomposed_registrations_registrationData_selectedPackageDetails_eligibilityCriteria_rules_level4: date
  - decomposed_registrations_registrationData_bookingContact_country_level3: date
  - decomposed_functions_metadata_sections_level2: date
  - decomposed_functions_metadata_sections_schedule[0]_items_level4: date
  - decomposed_registrations_registrationData_metadata_billingDetails_level3: date
  - eventTickets: string
  - decomposed_registrations_registrationData_packageDetails_registrationTypes_level3: date
  - decomposed_functions__id_buffer_level2: date
  - decomposed_registrations_registrationData_lodgeOrderDetails_level2: date
  - attendees: string
  - decomposed_registrations_registrationData_squareAmounts_level2: date
  - decomposed_registrations_registrationData_metadata_billingDetails_stateTerritory_level4: date
  - tickets: string
  - events: string
  - decomposed_registrations_registrationData_comprehensiveLodgeDetails_level2: date
  - locations: string
  - decomposed_registrations_registrationData_selectedPackageDetails_level2: date
  - decomposed_functions_metadata_sections_schedule[1]_items_level4: date
  - decomposed_registrations_registrationData_packageDetails_eligibilityCriteria_level3: date
  - decomposed_registrationData: string
  - contacts: string
  - decomposed_registrations_registrationData_metadata_level2: date
  - decomposed_functions_metadata_sections_details_level3: date
  - decomposed_registrations_registrationData_packageDetails_level2: date
  - decomposed_registrations_registrationData_attendees[1]_ticket_level3: date
  - decomposed_grandLodges__id_level1: date
  - customers: string
  - decomposed_registrations_registrationData_bookingContact_level2: date
  - decomposed_registrations_registrationData_selectedPackageDetails_registrationTypes_level3: date
  - decomposed_registrations_registrationData_selectedPackageDetails_eligibilityCriteria_level3: date
  - decomposed_registrations_registrationData_comprehensiveBookingContact_level2: date
  - decomposed_functions_metadata_level1: date
  - packages: string
  - lodges: string
  - decomposed_functions_metadata_sections_schedule_level3: date
  - decomposed_registrations__id_buffer_level2: date
  - decomposed_registrations_registrationData_lodgeDetails_level2: date
  - decomposed_grandLodges__id_buffer_level2: date
  - decomposed_functions_metadata_documents_level2: date
  - decomposed_registrations_registrationData_attendees_level2: date
  - decomposed_functions__id_level1: date

### sourceId
- **Collections:** decomposed_registrations_registrationData_metadata_billingDetails_country_level4, decomposed_functions_metadata_attendance_level2, decomposed_registrations__id_level1, decomposed_registrations_registrationData_calculatedAmounts_level2, decomposed_registrations_registrationData_orderDetails_level2, decomposed_registrations_registrationData_level1, decomposed_registrations_registrationData_packageDetails_eligibilityCriteria_rules_level4, decomposed_registrations_registrationData_attendees[0]_ticket_level3, decomposed_registrations_registrationData_bookingContact_stateTerritory_level3, decomposed_functions_metadata_sections_schedule[2]_items_level4, decomposed_registrations_registrationData_tickets_level2, decomposed_registrations_registrationData_selectedPackageDetails_eligibilityCriteria_rules_level4, decomposed_registrations_registrationData_bookingContact_country_level3, decomposed_functions_metadata_sections_level2, decomposed_functions_metadata_sections_schedule[0]_items_level4, decomposed_registrations_registrationData_metadata_billingDetails_level3, decomposed_registrations_registrationData_packageDetails_registrationTypes_level3, decomposed_functions__id_buffer_level2, decomposed_registrations_registrationData_lodgeOrderDetails_level2, decomposed_registrations_registrationData_squareAmounts_level2, decomposed_registrations_registrationData_metadata_billingDetails_stateTerritory_level4, decomposed_registrations_registrationData_comprehensiveLodgeDetails_level2, decomposed_registrations_registrationData_selectedPackageDetails_level2, decomposed_functions_metadata_sections_schedule[1]_items_level4, decomposed_registrations_registrationData_packageDetails_eligibilityCriteria_level3, contacts, decomposed_registrations_registrationData_metadata_level2, decomposed_functions_metadata_sections_details_level3, decomposed_registrations_registrationData_packageDetails_level2, decomposed_registrations_registrationData_attendees[1]_ticket_level3, decomposed_grandLodges__id_level1, decomposed_registrations_registrationData_bookingContact_level2, decomposed_registrations_registrationData_selectedPackageDetails_registrationTypes_level3, decomposed_registrations_registrationData_selectedPackageDetails_eligibilityCriteria_level3, decomposed_registrations_registrationData_comprehensiveBookingContact_level2, decomposed_functions_metadata_level1, decomposed_functions_metadata_sections_schedule_level3, decomposed_registrations__id_buffer_level2, decomposed_registrations_registrationData_lodgeDetails_level2, decomposed_grandLodges__id_buffer_level2, decomposed_functions_metadata_documents_level2, decomposed_registrations_registrationData_attendees_level2, decomposed_functions__id_level1
- **Consistency Score:** 97.67%
- **Conflicting Types:**
  - decomposed_registrations_registrationData_metadata_billingDetails_country_level4: string
  - decomposed_functions_metadata_attendance_level2: string
  - decomposed_registrations__id_level1: string
  - decomposed_registrations_registrationData_calculatedAmounts_level2: string
  - decomposed_registrations_registrationData_orderDetails_level2: string
  - decomposed_registrations_registrationData_level1: string
  - decomposed_registrations_registrationData_packageDetails_eligibilityCriteria_rules_level4: string
  - decomposed_registrations_registrationData_attendees[0]_ticket_level3: string
  - decomposed_registrations_registrationData_bookingContact_stateTerritory_level3: string
  - decomposed_functions_metadata_sections_schedule[2]_items_level4: string
  - decomposed_registrations_registrationData_tickets_level2: string
  - decomposed_registrations_registrationData_selectedPackageDetails_eligibilityCriteria_rules_level4: string
  - decomposed_registrations_registrationData_bookingContact_country_level3: string
  - decomposed_functions_metadata_sections_level2: string
  - decomposed_functions_metadata_sections_schedule[0]_items_level4: string
  - decomposed_registrations_registrationData_metadata_billingDetails_level3: string
  - decomposed_registrations_registrationData_packageDetails_registrationTypes_level3: string
  - decomposed_functions__id_buffer_level2: string
  - decomposed_registrations_registrationData_lodgeOrderDetails_level2: string
  - decomposed_registrations_registrationData_squareAmounts_level2: string
  - decomposed_registrations_registrationData_metadata_billingDetails_stateTerritory_level4: string
  - decomposed_registrations_registrationData_comprehensiveLodgeDetails_level2: string
  - decomposed_registrations_registrationData_selectedPackageDetails_level2: string
  - decomposed_functions_metadata_sections_schedule[1]_items_level4: string
  - decomposed_registrations_registrationData_packageDetails_eligibilityCriteria_level3: string
  - contacts: null
  - decomposed_registrations_registrationData_metadata_level2: string
  - decomposed_functions_metadata_sections_details_level3: string
  - decomposed_registrations_registrationData_packageDetails_level2: string
  - decomposed_registrations_registrationData_attendees[1]_ticket_level3: string
  - decomposed_grandLodges__id_level1: string
  - decomposed_registrations_registrationData_bookingContact_level2: string
  - decomposed_registrations_registrationData_selectedPackageDetails_registrationTypes_level3: string
  - decomposed_registrations_registrationData_selectedPackageDetails_eligibilityCriteria_level3: string
  - decomposed_registrations_registrationData_comprehensiveBookingContact_level2: string
  - decomposed_functions_metadata_level1: string
  - decomposed_functions_metadata_sections_schedule_level3: string
  - decomposed_registrations__id_buffer_level2: string
  - decomposed_registrations_registrationData_lodgeDetails_level2: string
  - decomposed_grandLodges__id_buffer_level2: string
  - decomposed_functions_metadata_documents_level2: string
  - decomposed_registrations_registrationData_attendees_level2: string
  - decomposed_functions__id_level1: string

### data
- **Collections:** decomposed_registrations_registrationData_metadata_billingDetails_country_level4, decomposed_functions_metadata_attendance_level2, decomposed_registrations__id_level1, decomposed_registrations_registrationData_calculatedAmounts_level2, decomposed_registrations_registrationData_orderDetails_level2, decomposed_registrations_registrationData_level1, decomposed_registrations_registrationData_packageDetails_eligibilityCriteria_rules_level4, decomposed_registrations_registrationData_attendees[0]_ticket_level3, decomposed_registrations_registrationData_bookingContact_stateTerritory_level3, decomposed_functions_metadata_sections_schedule[2]_items_level4, decomposed_registrations_registrationData_tickets_level2, decomposed_registrations_registrationData_selectedPackageDetails_eligibilityCriteria_rules_level4, decomposed_registrations_registrationData_bookingContact_country_level3, decomposed_functions_metadata_sections_level2, decomposed_functions_metadata_sections_schedule[0]_items_level4, decomposed_registrations_registrationData_metadata_billingDetails_level3, decomposed_registrations_registrationData_packageDetails_registrationTypes_level3, decomposed_functions__id_buffer_level2, decomposed_registrations_registrationData_lodgeOrderDetails_level2, decomposed_registrations_registrationData_squareAmounts_level2, decomposed_registrations_registrationData_metadata_billingDetails_stateTerritory_level4, decomposed_registrations_registrationData_comprehensiveLodgeDetails_level2, decomposed_registrations_registrationData_selectedPackageDetails_level2, decomposed_functions_metadata_sections_schedule[1]_items_level4, decomposed_registrations_registrationData_packageDetails_eligibilityCriteria_level3, decomposed_registrations_registrationData_metadata_level2, decomposed_functions_metadata_sections_details_level3, decomposed_registrations_registrationData_packageDetails_level2, decomposed_registrations_registrationData_attendees[1]_ticket_level3, decomposed_grandLodges__id_level1, decomposed_registrations_registrationData_bookingContact_level2, decomposed_registrations_registrationData_selectedPackageDetails_registrationTypes_level3, decomposed_registrations_registrationData_selectedPackageDetails_eligibilityCriteria_level3, decomposed_registrations_registrationData_comprehensiveBookingContact_level2, decomposed_functions_metadata_level1, decomposed_functions_metadata_sections_schedule_level3, decomposed_registrations__id_buffer_level2, decomposed_registrations_registrationData_lodgeDetails_level2, decomposed_grandLodges__id_buffer_level2, decomposed_functions_metadata_documents_level2, decomposed_registrations_registrationData_attendees_level2, decomposed_functions__id_level1
- **Consistency Score:** 95.24%
- **Conflicting Types:**
  - decomposed_registrations_registrationData_metadata_billingDetails_country_level4: object
  - decomposed_functions_metadata_attendance_level2: object
  - decomposed_registrations__id_level1: object
  - decomposed_registrations_registrationData_calculatedAmounts_level2: object
  - decomposed_registrations_registrationData_orderDetails_level2: object
  - decomposed_registrations_registrationData_level1: object
  - decomposed_registrations_registrationData_packageDetails_eligibilityCriteria_rules_level4: object
  - decomposed_registrations_registrationData_attendees[0]_ticket_level3: object
  - decomposed_registrations_registrationData_bookingContact_stateTerritory_level3: object
  - decomposed_functions_metadata_sections_schedule[2]_items_level4: object
  - decomposed_registrations_registrationData_tickets_level2: object
  - decomposed_registrations_registrationData_selectedPackageDetails_eligibilityCriteria_rules_level4: object
  - decomposed_registrations_registrationData_bookingContact_country_level3: object
  - decomposed_functions_metadata_sections_level2: object
  - decomposed_functions_metadata_sections_schedule[0]_items_level4: object
  - decomposed_registrations_registrationData_metadata_billingDetails_level3: object
  - decomposed_registrations_registrationData_packageDetails_registrationTypes_level3: string
  - decomposed_functions__id_buffer_level2: object
  - decomposed_registrations_registrationData_lodgeOrderDetails_level2: object
  - decomposed_registrations_registrationData_squareAmounts_level2: object
  - decomposed_registrations_registrationData_metadata_billingDetails_stateTerritory_level4: object
  - decomposed_registrations_registrationData_comprehensiveLodgeDetails_level2: object
  - decomposed_registrations_registrationData_selectedPackageDetails_level2: object
  - decomposed_functions_metadata_sections_schedule[1]_items_level4: object
  - decomposed_registrations_registrationData_packageDetails_eligibilityCriteria_level3: object
  - decomposed_registrations_registrationData_metadata_level2: object
  - decomposed_functions_metadata_sections_details_level3: object
  - decomposed_registrations_registrationData_packageDetails_level2: object
  - decomposed_registrations_registrationData_attendees[1]_ticket_level3: object
  - decomposed_grandLodges__id_level1: object
  - decomposed_registrations_registrationData_bookingContact_level2: object
  - decomposed_registrations_registrationData_selectedPackageDetails_registrationTypes_level3: string
  - decomposed_registrations_registrationData_selectedPackageDetails_eligibilityCriteria_level3: object
  - decomposed_registrations_registrationData_comprehensiveBookingContact_level2: object
  - decomposed_functions_metadata_level1: object
  - decomposed_functions_metadata_sections_schedule_level3: object
  - decomposed_registrations__id_buffer_level2: object
  - decomposed_registrations_registrationData_lodgeDetails_level2: object
  - decomposed_grandLodges__id_buffer_level2: object
  - decomposed_functions_metadata_documents_level2: object
  - decomposed_registrations_registrationData_attendees_level2: object
  - decomposed_functions__id_level1: object

### organisationId
- **Collections:** grandLodges, registrations, organisations, decomposed_registrationData, contacts, customers, lodges
- **Consistency Score:** 42.86%
- **Conflicting Types:**
  - grandLodges: string
  - registrations: null, string
  - organisations: string
  - decomposed_registrationData: string
  - contacts: null
  - customers: null
  - lodges: string, null

### description
- **Collections:** functions, stripePayments, eventTickets, events, locations, packages
- **Consistency Score:** 50.00%
- **Conflicting Types:**
  - functions: string
  - stripePayments: null, string
  - eventTickets: string, null
  - events: string
  - locations: null
  - packages: string

### country
- **Collections:** grandLodges, decomposed_bookingContacts, organisations, locations, contacts, customers
- **Consistency Score:** 16.67%
- **Conflicting Types:**
  - grandLodges: string
  - decomposed_bookingContacts: string, object
  - organisations: string, null
  - locations: string, null
  - contacts: null
  - customers: null, string

### eventId
- **Collections:** registrations, eventTickets, tickets, events, decomposed_registrationData, packages
- **Consistency Score:** 33.33%
- **Conflicting Types:**
  - registrations: null
  - eventTickets: string
  - tickets: string, null
  - events: string
  - decomposed_registrationData: string, null
  - packages: null

### email
- **Collections:** decomposed_bookingContacts, attendees, locations, decomposed_registrationData, contacts, customers
- **Consistency Score:** 66.67%
- **Conflicting Types:**
  - decomposed_bookingContacts: string
  - attendees: null
  - locations: null
  - decomposed_registrationData: string
  - contacts: string
  - customers: string

### attendeeId
- **Collections:** decomposed_attendeeData, decomposed_attendees, attendees, tickets, decomposed_tickets
- **Consistency Score:** 80.00%
- **Conflicting Types:**
  - decomposed_attendeeData: string
  - decomposed_attendees: string
  - attendees: string
  - tickets: string, null
  - decomposed_tickets: string

### grandLodgeId
- **Collections:** decomposed_attendeeData, grandLodges, masonicProfiles, decomposed_attendees, lodges
- **Consistency Score:** 80.00%
- **Conflicting Types:**
  - decomposed_attendeeData: string
  - grandLodges: string
  - masonicProfiles: null
  - decomposed_attendees: string
  - lodges: string

### authUserId
- **Collections:** registrations, attendees, decomposed_registrationData, contacts, customers
- **Consistency Score:** 0.00%
- **Conflicting Types:**
  - registrations: string, null
  - attendees: null
  - decomposed_registrationData: string, null
  - contacts: null, string
  - customers: string, null

### state
- **Collections:** decomposed_bookingContacts, organisations, locations, contacts, customers
- **Consistency Score:** 20.00%
- **Conflicting Types:**
  - decomposed_bookingContacts: string
  - organisations: string, null
  - locations: string, null
  - contacts: null
  - customers: null

### sourceType
- **Collections:** decomposed_attendeeData, decomposed_metadata, squarePayments, contacts
- **Consistency Score:** 75.00%
- **Conflicting Types:**
  - decomposed_attendeeData: string
  - decomposed_metadata: string
  - squarePayments: string
  - contacts: null

### isPartner
- **Collections:** decomposed_attendeeData, decomposed_attendees, attendees, contacts
- **Consistency Score:** 25.00%
- **Conflicting Types:**
  - decomposed_attendeeData: null, string
  - decomposed_attendees: null, string
  - attendees: null
  - contacts: boolean

## Field Consistency Report (Lowest Scores)

| Field Name | Collections | Consistency Score |
|------------|-------------|-------------------|
| partner | 2 | 0.00% |
| partnerOf | 2 | 0.00% |
| stateRegion | 2 | 0.00% |
| stateRegionCode | 1 | 0.00% |
| data.attendees.partner | 1 | 0.00% |
| data.bookingContact.country | 1 | 0.00% |
| data.registrationId | 1 | 0.00% |
| data.eventTitle | 1 | 0.00% |
| totalPricePaid | 2 | 0.00% |
| stripePaymentIntentId | 2 | 0.00% |
| registrationData.attendees.partner | 1 | 0.00% |
| registrationData.stripeFee | 1 | 0.00% |
| registrationData.authUserId | 1 | 0.00% |
| registrationData.registrationId | 1 | 0.00% |
| platformFeeAmount | 2 | 0.00% |
| authUserId | 5 | 0.00% |
| organisationName | 2 | 0.00% |
| primaryAttendee | 2 | 0.00% |
| confirmationGeneratedAt | 2 | 0.00% |
| registrationData.eventTitle | 1 | 0.00% |