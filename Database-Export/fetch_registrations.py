#!/usr/bin/env python3
"""
Script to fetch specific registrations from the exported CSV database file.
"""

import csv
import json
from datetime import datetime

# Target confirmation numbers
TARGET_CONFIRMATIONS = [
    "IND-029388TI",
    "IND-702724KT", 
    "IND-107839YX",
    "IND-648819EP",
    "IND-522951GX",
    "LDG-867620PW",
    "LDG-643031YX",
    "LDG-210679FX"
]

def fetch_registrations(csv_file):
    """Fetch specific registrations from the CSV file"""
    registrations = []
    
    with open(csv_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        
        for row in reader:
            if row.get('confirmation_number') in TARGET_CONFIRMATIONS:
                # Parse the registration data JSON
                try:
                    registration_data = json.loads(row.get('registration_data', '{}'))
                except json.JSONDecodeError:
                    registration_data = {}
                
                registration = {
                    'confirmation_number': row['confirmation_number'],
                    'registration_id': row['registration_id'],
                    'customer_id': row['customer_id'],
                    'registration_date': row['registration_date'],
                    'status': row['status'],
                    'total_amount_paid': row['total_amount_paid'],
                    'payment_status': row['payment_status'],
                    'registration_type': row['registration_type'],
                    'primary_attendee': row.get('primary_attendee', ''),
                    'attendee_count': row.get('attendee_count', 0),
                    'event_id': row.get('event_id', ''),
                    'stripe_payment_intent_id': row.get('stripe_payment_intent_id', ''),
                    'square_payment_id': row.get('square_payment_id', ''),
                    'registration_data': registration_data
                }
                registrations.append(registration)
    
    return registrations

def display_registration(reg):
    """Display a registration in a formatted way"""
    print(f"\n{'='*80}")
    print(f"Confirmation Number: {reg['confirmation_number']}")
    print(f"Registration ID: {reg['registration_id']}")
    print(f"Type: {reg['registration_type'].upper()}")
    print(f"Status: {reg['status']}")
    print(f"Payment Status: {reg['payment_status']}")
    print(f"Total Amount: ${reg['total_amount_paid']}")
    print(f"Primary Attendee: {reg['primary_attendee']}")
    print(f"Attendee Count: {reg['attendee_count']}")
    print(f"Registration Date: {reg['registration_date']}")
    
    # Display payment IDs
    if reg['stripe_payment_intent_id']:
        print(f"Stripe Payment ID: {reg['stripe_payment_intent_id']}")
    if reg['square_payment_id']:
        print(f"Square Payment ID: {reg['square_payment_id']}")
    
    # Display attendees from registration data
    if 'attendees' in reg['registration_data']:
        print(f"\nAttendees:")
        for idx, attendee in enumerate(reg['registration_data']['attendees'], 1):
            name = f"{attendee.get('firstName', '')} {attendee.get('lastName', '')}"
            lodge = attendee.get('lodgeNameNumber', attendee.get('lodge', ''))
            print(f"  {idx}. {name.strip()} - {lodge}")
    
    # Display billing details if available
    if 'billingDetails' in reg['registration_data']:
        billing = reg['registration_data']['billingDetails']
        print(f"\nBilling Contact:")
        print(f"  Name: {billing.get('firstName', '')} {billing.get('lastName', '')}")
        print(f"  Email: {billing.get('emailAddress', billing.get('email', ''))}")
        print(f"  Phone: {billing.get('mobileNumber', billing.get('phone', ''))}")

def main():
    csv_file = '/Users/darrenallatt/Development/LodgeTix - Reconcile/Database-Export/registrations_rows (1).csv'
    
    print("Fetching registrations from CSV export...")
    print(f"Looking for confirmation numbers: {', '.join(TARGET_CONFIRMATIONS)}")
    
    registrations = fetch_registrations(csv_file)
    
    print(f"\nFound {len(registrations)} out of {len(TARGET_CONFIRMATIONS)} registrations")
    
    # Sort by confirmation number
    registrations.sort(key=lambda x: x['confirmation_number'])
    
    # Display each registration
    for reg in registrations:
        display_registration(reg)
    
    # Summary
    print(f"\n{'='*80}")
    print("SUMMARY:")
    print(f"Total found: {len(registrations)}")
    
    found_confirmations = [r['confirmation_number'] for r in registrations]
    missing = [cn for cn in TARGET_CONFIRMATIONS if cn not in found_confirmations]
    
    if missing:
        print(f"Missing registrations: {', '.join(missing)}")
    else:
        print("All requested registrations were found!")

if __name__ == "__main__":
    main()