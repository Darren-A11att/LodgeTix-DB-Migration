const { MongoClient } = require('mongodb');
const fs = require('fs').promises;
const path = require('path');

// MongoDB connection
const uri = 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix-migration-test.wydwfu6.mongodb.net/';
const dbName = 'LodgeTix-migration-test-1';
const client = new MongoClient(uri);

async function analyzeRegistrationStructures() {
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db(dbName);
    const registrations = db.collection('registrations');
    
    // Get total count
    const totalCount = await registrations.countDocuments();
    console.log(`\nTotal registrations: ${totalCount}`);
    
    // Structure to track different patterns
    const structurePatterns = new Map();
    const fieldOccurrences = new Map();
    const timelineAnalysis = new Map();
    const eventTypeAnalysis = new Map();
    
    // Sample registrations to analyze all
    console.log('\nAnalyzing registration structures...');
    const cursor = registrations.find({});
    
    let analyzed = 0;
    
    while (await cursor.hasNext()) {
      const reg = await cursor.next();
      analyzed++;
      
      if (analyzed % 1000 === 0) {
        console.log(`Analyzed ${analyzed} registrations...`);
      }
      
      // Get the structure signature (sorted keys)
      const structure = getStructureSignature(reg);
      const structureKey = JSON.stringify(structure);
      
      // Track this structure pattern
      if (!structurePatterns.has(structureKey)) {
        structurePatterns.set(structureKey, {
          count: 0,
          firstSeen: reg.createdAt || reg.dateCreated || new Date(),
          lastSeen: reg.createdAt || reg.dateCreated || new Date(),
          exampleId: reg._id,
          fields: structure,
          events: new Set(),
          years: new Set(),
          registrationData: analyzeRegistrationData(reg.registrationData || {})
        });
      }
      
      const pattern = structurePatterns.get(structureKey);
      pattern.count++;
      pattern.lastSeen = reg.createdAt || reg.dateCreated || new Date();
      
      // Track event types
      if (reg.eventId) {
        pattern.events.add(reg.eventId.toString());
      }
      
      // Track years
      const date = reg.createdAt || reg.dateCreated;
      if (date) {
        pattern.years.add(new Date(date).getFullYear());
      }
      
      // Track individual field occurrences
      Object.keys(reg).forEach(field => {
        fieldOccurrences.set(field, (fieldOccurrences.get(field) || 0) + 1);
      });
      
      // Timeline analysis
      const yearMonth = getYearMonth(date);
      if (!timelineAnalysis.has(yearMonth)) {
        timelineAnalysis.set(yearMonth, new Set());
      }
      timelineAnalysis.get(yearMonth).add(structureKey);
      
      // Event type analysis
      const eventId = reg.eventId ? reg.eventId.toString() : 'no-event';
      if (!eventTypeAnalysis.has(eventId)) {
        eventTypeAnalysis.set(eventId, new Set());
      }
      eventTypeAnalysis.get(eventId).add(structureKey);
    }
    
    // Generate report
    const report = {
      summary: {
        totalRegistrations: totalCount,
        uniqueStructures: structurePatterns.size,
        analyzedRegistrations: analyzed,
        analysisDate: new Date().toISOString()
      },
      structures: [],
      fieldAnalysis: {},
      timeline: {},
      eventAnalysis: {},
      registrationDataPatterns: await analyzeRegistrationDataPatterns(registrations)
    };
    
    // Process structure patterns
    for (const [key, pattern] of structurePatterns) {
      report.structures.push({
        structureId: key.substring(0, 50) + '...',
        count: pattern.count,
        percentage: ((pattern.count / totalCount) * 100).toFixed(2) + '%',
        firstSeen: pattern.firstSeen,
        lastSeen: pattern.lastSeen,
        exampleId: pattern.exampleId,
        fields: pattern.fields,
        eventCount: pattern.events.size,
        yearSpan: Array.from(pattern.years).sort().join(', '),
        registrationDataStructure: pattern.registrationData
      });
    }
    
    // Sort structures by count
    report.structures.sort((a, b) => b.count - a.count);
    
    // Field analysis
    for (const [field, count] of fieldOccurrences) {
      report.fieldAnalysis[field] = {
        count: count,
        percentage: ((count / totalCount) * 100).toFixed(2) + '%'
      };
    }
    
    // Timeline analysis
    const sortedMonths = Array.from(timelineAnalysis.keys()).sort();
    for (const month of sortedMonths) {
      report.timeline[month] = {
        uniqueStructures: timelineAnalysis.get(month).size,
        structures: Array.from(timelineAnalysis.get(month)).length
      };
    }
    
    // Event analysis summary
    report.eventAnalysis.summary = {
      totalEvents: eventTypeAnalysis.size,
      eventsWithMultipleStructures: Array.from(eventTypeAnalysis.entries())
        .filter(([_, structures]) => structures.size > 1).length
    };
    
    // Save detailed report
    const outputPath = path.join(__dirname, '../outputs/registration-structure-analysis.json');
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, JSON.stringify(report, null, 2));
    
    // Print summary
    console.log('\n=== REGISTRATION STRUCTURE ANALYSIS ===\n');
    console.log(`Total Registrations: ${report.summary.totalRegistrations}`);
    console.log(`Unique Structures Found: ${report.summary.uniqueStructures}`);
    console.log('\nTop 5 Most Common Structures:');
    
    report.structures.slice(0, 5).forEach((structure, index) => {
      console.log(`\n${index + 1}. Structure (${structure.count} registrations, ${structure.percentage}):`);
      console.log(`   Fields: ${structure.fields.slice(0, 10).join(', ')}${structure.fields.length > 10 ? '...' : ''}`);
      console.log(`   Date Range: ${new Date(structure.firstSeen).toLocaleDateString()} to ${new Date(structure.lastSeen).toLocaleDateString()}`);
      console.log(`   Years Active: ${structure.yearSpan}`);
      console.log(`   Events Using This: ${structure.eventCount}`);
    });
    
    // Analyze significant changes
    console.log('\n=== STRUCTURAL CHANGES TIMELINE ===\n');
    await analyzeStructuralChanges(report.timeline);
    
    // Analyze why differences exist
    console.log('\n=== WHY STRUCTURES DIFFER ===\n');
    await analyzeStructuralDifferences(report, registrations);
    
    console.log(`\nFull report saved to: ${outputPath}`);
    
  } catch (error) {
    console.error('Error analyzing registration structures:', error);
  } finally {
    await client.close();
  }
}

function getStructureSignature(obj) {
  const keys = Object.keys(obj).sort();
  return keys.filter(key => key !== '_id' && key !== '__v');
}

function analyzeRegistrationData(regData) {
  if (!regData || typeof regData !== 'object') {
    return { type: 'empty' };
  }
  
  const keys = Object.keys(regData).sort();
  const structure = {
    fieldCount: keys.length,
    hasAttendees: 'attendees' in regData,
    hasTickets: 'tickets' in regData,
    hasSelectedTickets: 'selectedTickets' in regData,
    hasBookingContact: 'bookingContact' in regData,
    hasBillingContact: 'billingContact' in regData,
    hasCustomFields: keys.some(k => k.startsWith('custom_')),
    topLevelFields: keys.slice(0, 10)
  };
  
  return structure;
}

function getYearMonth(date) {
  if (!date) return 'unknown';
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

async function analyzeRegistrationDataPatterns(registrations) {
  console.log('\nAnalyzing registrationData patterns...');
  
  const patterns = new Map();
  const cursor = registrations.find({ registrationData: { $exists: true } });
  
  while (await cursor.hasNext()) {
    const reg = await cursor.next();
    const regData = reg.registrationData || {};
    
    // Create a signature for the registrationData structure
    const signature = createRegistrationDataSignature(regData);
    const key = JSON.stringify(signature);
    
    if (!patterns.has(key)) {
      patterns.set(key, {
        count: 0,
        signature: signature,
        exampleId: reg._id,
        firstSeen: reg.createdAt || reg.dateCreated,
        events: new Set()
      });
    }
    
    const pattern = patterns.get(key);
    pattern.count++;
    if (reg.eventId) {
      pattern.events.add(reg.eventId.toString());
    }
  }
  
  return Array.from(patterns.values()).sort((a, b) => b.count - a.count);
}

function createRegistrationDataSignature(regData) {
  const sig = {
    hasAttendees: false,
    attendeeStructure: null,
    hasTickets: false,
    hasSelectedTickets: false,
    hasBookingContact: false,
    hasBillingContact: false,
    customFields: [],
    otherFields: []
  };
  
  if (regData.attendees && Array.isArray(regData.attendees) && regData.attendees.length > 0) {
    sig.hasAttendees = true;
    sig.attendeeStructure = Object.keys(regData.attendees[0]).sort();
  }
  
  if (regData.tickets) sig.hasTickets = true;
  if (regData.selectedTickets) sig.hasSelectedTickets = true;
  if (regData.bookingContact) sig.hasBookingContact = true;
  if (regData.billingContact) sig.hasBillingContact = true;
  
  Object.keys(regData).forEach(key => {
    if (key.startsWith('custom_')) {
      sig.customFields.push(key);
    } else if (!['attendees', 'tickets', 'selectedTickets', 'bookingContact', 'billingContact'].includes(key)) {
      sig.otherFields.push(key);
    }
  });
  
  sig.customFields.sort();
  sig.otherFields.sort();
  
  return sig;
}

async function analyzeStructuralChanges(timeline) {
  const months = Object.keys(timeline).sort();
  
  // Find months with significant changes
  for (let i = 1; i < months.length; i++) {
    const prevMonth = months[i - 1];
    const currMonth = months[i];
    
    if (timeline[currMonth].uniqueStructures > timeline[prevMonth].uniqueStructures) {
      console.log(`${currMonth}: New structure(s) introduced (${timeline[currMonth].uniqueStructures} unique structures)`);
    }
  }
}

async function analyzeStructuralDifferences(report, registrations) {
  // Common patterns for why structures differ
  const differences = {
    'Payment Integration': {
      indicator: ['stripePaymentIntentId', 'paymentMethod', 'paymentStatus'],
      description: 'Stripe payment integration added'
    },
    'Invoice System': {
      indicator: ['invoiceId', 'invoiceNumber', 'invoiceData'],
      description: 'Invoice generation system added'
    },
    'Event Type Variations': {
      indicator: ['eventType', 'eventCategory'],
      description: 'Different event types have different fields'
    },
    'Form Customization': {
      indicator: ['customFormData', 'formId'],
      description: 'Custom form fields for specific events'
    },
    'Migration Artifacts': {
      indicator: ['legacyId', 'migrated', 'importedAt'],
      description: 'Fields from data migration or import'
    },
    'Feature Evolution': {
      indicator: ['qrCode', 'checkInStatus', 'certificateIssued'],
      description: 'New features added over time'
    }
  };
  
  // Check which differences apply
  console.log('Identified reasons for structural differences:\n');
  
  for (const [reason, config] of Object.entries(differences)) {
    const fieldsPresent = config.indicator.filter(field => 
      report.fieldAnalysis[field] && report.fieldAnalysis[field].count > 0
    );
    
    if (fieldsPresent.length > 0) {
      console.log(`• ${reason}: ${config.description}`);
      console.log(`  Related fields: ${fieldsPresent.join(', ')}`);
      console.log(`  Affects approximately ${report.fieldAnalysis[fieldsPresent[0]].percentage} of registrations\n`);
    }
  }
  
  // Check for time-based patterns
  const yearPatterns = await registrations.aggregate([
    {
      $group: {
        _id: { $year: '$createdAt' },
        fieldCount: { $avg: { $size: { $objectToArray: '$$ROOT' } } }
      }
    },
    { $sort: { _id: 1 } }
  ]).toArray();
  
  if (yearPatterns.length > 0) {
    console.log('Average field count by year:');
    yearPatterns.forEach(pattern => {
      if (pattern._id) {
        console.log(`  ${pattern._id}: ${Math.round(pattern.fieldCount)} fields average`);
      }
    });
  }
}

// Run the analysis
analyzeRegistrationStructures().catch(console.error);