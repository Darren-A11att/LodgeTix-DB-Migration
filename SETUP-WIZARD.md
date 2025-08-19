# Function Setup Wizard

## Overview
The Function Setup Wizard is a comprehensive interface that guides you through creating a complete function with events, tickets, and packages. It automatically creates all necessary records in the commerce database based on the LodgeTix mapping structure.

## Access
Navigate to: `/admin/setup-wizard` or click "🎯 Setup Wizard" in the admin menu.

## Wizard Steps

### Step 1: Function Details
Configure the main function information:
- **Function Name**: The name of your function (e.g., "Annual Ball 2024")
- **Handle**: URL-friendly identifier (auto-generated from name)
- **Description**: Detailed description of the function
- **Venue**: Location where the function will be held
- **Start/End Dates**: Function date range
- **Organizer**: Organization running the function
- **Organizer Email**: Contact email

### Step 2: Events
Add one or more events to your function:
- **Event Name**: Name of the specific event (e.g., "Gala Dinner")
- **Date & Time**: When the event occurs
- **Max Attendees**: Maximum capacity
- **Description**: Event-specific details

### Step 3: Tickets
Configure ticket types for each event:
- **Ticket Name**: Type of ticket (e.g., "VIP", "Standard")
- **Price**: Cost in ZAR
- **Quantity**: Number of tickets available
- **Description**: What's included with this ticket
- **Early Bird Pricing**: Optional discounted pricing with end date

### Step 4: Packages (Optional)
Create bundled ticket packages:
- **Package Name**: Name of the bundle (e.g., "Couples Package")
- **Package Price**: Total bundle cost
- **Ticket Selection**: Choose which tickets to include
- **Quantity**: How many of each ticket type
- **Automatic Savings Calculation**: Shows customer savings

### Step 5: Review
Review all configured items before submission:
- Function summary
- Events list
- Ticket types
- Package deals
- Preview of what will be created

## What Gets Created

When you submit the wizard, it automatically creates:

### 1. Product Collection
- Maps to the LodgeTix `function`
- Contains all metadata (venue, dates, organizer)
- Groups all related products

### 2. Vendor Record
- Created from organizer information
- Links to all created products
- Sets up commission and payout schedule

### 3. Products (One per Event)
- Maps to LodgeTix `events`
- Contains event details (date, time, capacity)
- Includes attendee options (name, email, dietary requirements)

### 4. Product Variants (Tickets)
- Maps to LodgeTix `eventTickets`
- Individual SKUs for inventory tracking
- Pricing including early bird options
- Stock quantities

### 5. Bundle Products (Packages)
- Maps to LodgeTix `packages`
- Links to specific products and variants
- Calculates and displays savings

### 6. Inventory Records
- Creates inventory items for each ticket type
- Sets up stock levels
- Links to stock location

### 7. Stock Location
- Creates venue as stock location
- Links to all inventory items

## Data Mapping

| Wizard Input | Commerce Entity | Purpose |
|--------------|-----------------|---------|
| Function | `product_collection` | Groups all events |
| Event | `product` | Individual event with variants |
| Ticket | `product_variant` | Specific ticket type with pricing |
| Package | `bundle` product | Multi-ticket deals |
| Organizer | `vendor` | Payment and commission handling |
| Venue | `stock_location` | Inventory location |

## Example Workflow

1. **Create Annual Ball 2024**
   - Function: "Annual Ball 2024"
   - Venue: "Grand Hotel Ballroom"
   - Dates: Dec 31, 2024

2. **Add Events**
   - Event 1: "Cocktail Reception" at 6:00 PM
   - Event 2: "Gala Dinner" at 7:30 PM
   - Event 3: "After Party" at 11:00 PM

3. **Configure Tickets**
   - Cocktail Reception: Standard (R500)
   - Gala Dinner: Standard (R1500), VIP (R3000)
   - After Party: General (R300)

4. **Create Packages**
   - Full Experience: All three events (R2000 - save R300)
   - Couples Package: 2x Gala Dinner (R2700 - save R300)

5. **Submit**
   - Creates 1 collection, 3 products, 5 variants, 2 bundles
   - Sets up complete inventory tracking
   - Ready for sales!

## API Endpoint

The wizard submits to: `POST /api/admin/setup-wizard`

### Request Payload
```json
{
  "function": {
    "name": "Annual Ball 2024",
    "handle": "annual-ball-2024",
    "description": "...",
    "venue": "Grand Hotel",
    "startDate": "2024-12-31",
    "endDate": "2024-12-31",
    "organizer": "Lodge Events",
    "organizerEmail": "events@lodge.org"
  },
  "events": [
    {
      "id": "event_123",
      "name": "Gala Dinner",
      "date": "2024-12-31",
      "time": "19:30",
      "description": "...",
      "maxAttendees": 200
    }
  ],
  "tickets": [
    {
      "id": "ticket_456",
      "eventId": "event_123",
      "name": "Standard",
      "price": 1500,
      "quantity": 180,
      "description": "...",
      "earlyBird": true,
      "earlyBirdPrice": 1200,
      "earlyBirdEndDate": "2024-11-30"
    }
  ],
  "packages": [
    {
      "id": "package_789",
      "name": "Couples Package",
      "tickets": [
        {
          "eventId": "event_123",
          "ticketId": "ticket_456",
          "quantity": 2
        }
      ],
      "price": 2700,
      "savings": 300,
      "description": "..."
    }
  ]
}
```

### Response
```json
{
  "success": true,
  "message": "Successfully created function \"Annual Ball 2024\"",
  "created": {
    "collection": "ObjectId",
    "vendor": "ObjectId",
    "products": 3,
    "variants": 5,
    "bundles": 2,
    "inventory_items": 5,
    "location": "ObjectId"
  },
  "details": {
    "collection": {
      "id": "...",
      "handle": "annual-ball-2024",
      "title": "Annual Ball 2024"
    },
    "products": [...],
    "bundles": [...]
  }
}
```

## Benefits

1. **Guided Process**: Step-by-step interface ensures nothing is missed
2. **Automatic Mapping**: Converts LodgeTix concepts to commerce structure
3. **Bulk Creation**: Creates dozens of related records in one submission
4. **Inventory Setup**: Automatically configures stock tracking
5. **Package Deals**: Easy creation of bundled offerings
6. **Validation**: Ensures required fields and proper relationships

## Next Steps After Setup

1. **Review Products**: Check `/admin/products` to see created items
2. **Adjust Inventory**: Fine-tune stock levels if needed
3. **Configure Payment Gateway**: Set up payment processing
4. **Create Marketing Materials**: Use product handles for URLs
5. **Start Selling**: Products are immediately available for purchase

## Tips

- Use descriptive names for events and tickets
- Set realistic inventory quantities
- Consider early bird pricing to drive early sales
- Create packages that offer genuine value
- Keep descriptions clear and informative