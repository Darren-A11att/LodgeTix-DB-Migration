const { ObjectId } = require('mongodb');
const { writeDocument, logError, logWarning } = require('../utils/helpers');

async function migrateJurisdictions(db, migrationState) {
  try {
    const grandLodges = await db.collection('grandLodges').find({}).toArray();
    const lodges = await db.collection('lodges').find({}).toArray();
    
    console.log(`Found ${grandLodges.length} grand lodges to migrate`);
    console.log(`Found ${lodges.length} lodges to migrate`);
    
    // Group lodges by grand lodge
    const lodgesByGrandLodge = {};
    
    lodges.forEach(lodge => {
      const glId = lodge.grand_lodge_id || lodge.grandLodgeId;
      if (!glId) {
        logWarning('LODGE_NO_GRAND_LODGE', `Lodge ${lodge.name} has no grand lodge`, { 
          lodgeId: lodge.lodge_id || lodge.lodgeId,
          lodgeName: lodge.name 
        });
        return;
      }
      
      if (!lodgesByGrandLodge[glId]) {
        lodgesByGrandLodge[glId] = [];
      }
      lodgesByGrandLodge[glId].push(lodge);
    });
    
    // Process each grand lodge as a jurisdiction
    for (const grandLodge of grandLodges) {
      try {
        const jurisdiction = await transformToJurisdiction(
          grandLodge, 
          lodgesByGrandLodge[grandLodge.grand_lodge_id || grandLodge.grandLodgeId] || [],
          migrationState
        );
        
        await writeDocument('jurisdictions', jurisdiction._id, jurisdiction);
        
      } catch (error) {
        await logError('JURISDICTION_MIGRATION', error, { 
          grandLodgeId: grandLodge.grand_lodge_id || grandLodge.grandLodgeId,
          grandLodgeName: grandLodge.name 
        });
      }
    }
    
    console.log(`Successfully migrated ${migrationState.stats.jurisdictions} jurisdictions`);
    
  } catch (error) {
    await logError('JURISDICTION_MIGRATION_FATAL', error);
    throw error;
  }
}

async function transformToJurisdiction(grandLodge, lodges, migrationState) {
  const jurisdictionId = new ObjectId();
  
  return {
    _id: jurisdictionId,
    jurisdictionId: `JUR-CRAFT-${grandLodge.country_code_iso3 || grandLodge.countryCodeIso3 || 'XX'}-${new Date().getFullYear()}-${String(migrationState.stats.jurisdictions + 1).padStart(5, '0')}`,
    type: 'craft',
    
    definitions: {
      parentName: 'grandLodge',
      parentLabel: 'Grand Lodge',
      childName: 'lodges',
      childLabel: 'Lodges',
      
      ranks: [
        { code: 'EA', name: 'Entered Apprentice', order: 1, abbreviation: 'EA' },
        { code: 'FC', name: 'Fellow Craft', order: 2, abbreviation: 'FC' },
        { code: 'MM', name: 'Master Mason', order: 3, abbreviation: 'MM' }
      ],
      
      titles: [
        { code: 'Bro', name: 'Brother', abbreviation: 'Bro.' },
        { code: 'WBro', name: 'Worshipful Brother', abbreviation: 'W.Bro.' },
        { code: 'VWBro', name: 'Very Worshipful Brother', abbreviation: 'V.W.Bro.' },
        { code: 'RWBro', name: 'Right Worshipful Brother', abbreviation: 'R.W.Bro.' },
        { code: 'MWBro', name: 'Most Worshipful Brother', abbreviation: 'M.W.Bro.' }
      ],
      
      parentOffices: [
        { code: 'GM', name: 'Grand Master', order: 1, type: 'elected' },
        { code: 'DGM', name: 'Deputy Grand Master', order: 2, type: 'elected' },
        { code: 'AGM', name: 'Assistant Grand Master', order: 3, type: 'appointed' },
        { code: 'GSW', name: 'Grand Senior Warden', order: 4, type: 'elected' },
        { code: 'GJW', name: 'Grand Junior Warden', order: 5, type: 'elected' },
        { code: 'GS', name: 'Grand Secretary', order: 6, type: 'appointed' },
        { code: 'GT', name: 'Grand Treasurer', order: 7, type: 'elected' }
      ],
      
      childOffices: [
        { code: 'WM', name: 'Worshipful Master', order: 1, type: 'elected' },
        { code: 'IPM', name: 'Immediate Past Master', order: 2, type: 'automatic' },
        { code: 'SW', name: 'Senior Warden', order: 3, type: 'elected' },
        { code: 'JW', name: 'Junior Warden', order: 4, type: 'elected' },
        { code: 'S', name: 'Secretary', order: 5, type: 'appointed' },
        { code: 'T', name: 'Treasurer', order: 6, type: 'elected' },
        { code: 'SD', name: 'Senior Deacon', order: 7, type: 'appointed' },
        { code: 'JD', name: 'Junior Deacon', order: 8, type: 'appointed' }
      ]
    },
    
    grandLodge: {
      id: grandLodge.grand_lodge_id || grandLodge.grandLodgeId,
      name: grandLodge.name || 'Unknown Grand Lodge',
      abbreviation: grandLodge.abbreviation || generateAbbreviation(grandLodge.name),
      
      country: grandLodge.country || '',
      countryCode: grandLodge.country_code_iso3 || grandLodge.countryCodeIso3 || '',
      stateRegion: grandLodge.state_region || grandLodge.stateRegion || '',
      stateRegionCode: grandLodge.state_region_code || grandLodge.stateRegionCode || '',
      
      organisationId: grandLodge.organisation_id || grandLodge.organisationId || null,
      
      address: {
        addressLine1: grandLodge.address_line_1 || grandLodge.addressLine1 || '',
        addressLine2: grandLodge.address_line_2 || grandLodge.addressLine2 || '',
        city: grandLodge.city || '',
        state: grandLodge.state || '',
        postcode: grandLodge.postcode || '',
        country: grandLodge.country || ''
      },
      
      contact: {
        phone: grandLodge.phone || '',
        email: grandLodge.email || '',
        website: grandLodge.website || ''
      },
      
      lodges: lodges.map(lodge => ({
        id: lodge.lodge_id || lodge.lodgeId,
        number: lodge.number || '',
        name: lodge.name || 'Unknown Lodge',
        displayName: lodge.display_name || lodge.displayName || `${lodge.name} No. ${lodge.number}`,
        
        district: lodge.district || '',
        meetingPlace: lodge.meeting_place || lodge.meetingPlace || '',
        areaType: determineAreaType(lodge),
        stateRegion: lodge.state_region || lodge.stateRegion || grandLodge.state_region || grandLodge.stateRegion || '',
        
        organisationId: lodge.organisation_id || lodge.organisationId || null,
        
        meetingSchedule: parseMeetingSchedule(lodge),
        
        status: lodge.status || 'active',
        consecrationDate: lodge.consecration_date || lodge.consecrationDate || null,
        warrantsNumber: lodge.warrants_number || lodge.warrantsNumber || '',
        
        customFields: {
          legacyData: {
            meetingDayOfWeek: lodge.meeting_day_of_week || lodge.meetingDayOfWeek,
            meetingWeekOfMonth: lodge.meeting_week_of_month || lodge.meetingWeekOfMonth,
            meetingTime: lodge.meeting_time || lodge.meetingTime,
            originalAreaType: lodge.area_type || lodge.areaType
          }
        }
      }))
    },
    
    metadata: {
      source: 'migration',
      createdAt: new Date(),
      createdBy: null,
      updatedAt: new Date(),
      updatedBy: null,
      version: 1
    }
  };
}

function generateAbbreviation(name) {
  if (!name) return '';
  
  // Common patterns for grand lodge abbreviations
  const words = name.split(' ');
  
  if (name.includes('United Grand Lodge')) {
    return 'UGL' + words.slice(-2).map(w => w[0]).join('');
  }
  
  // Take first letter of each significant word
  return words
    .filter(w => !['of', 'and', 'the'].includes(w.toLowerCase()))
    .map(w => w[0])
    .join('')
    .toUpperCase();
}

function determineAreaType(lodge) {
  const areaType = (lodge.area_type || lodge.areaType)?.toUpperCase();
  
  if (['METRO', 'METROPOLITAN'].includes(areaType)) return 'METRO';
  if (['COUNTRY', 'RURAL'].includes(areaType)) return 'COUNTRY';
  if (['REGIONAL'].includes(areaType)) return 'REGIONAL';
  
  // Try to infer from meeting place or district
  const place = (lodge.meeting_place || lodge.meetingPlace || '').toLowerCase();
  const district = (lodge.district || '').toLowerCase();
  
  if (place.includes('city') || district.includes('city')) return 'METRO';
  if (place.includes('rural') || district.includes('country')) return 'COUNTRY';
  
  return 'REGIONAL'; // Default
}

function parseMeetingSchedule(lodge) {
  const schedule = {
    frequency: 'monthly',
    dayOfWeek: lodge.meeting_day_of_week || lodge.meetingDayOfWeek || '',
    weekOfMonth: lodge.meeting_week_of_month || lodge.meetingWeekOfMonth || '',
    time: lodge.meeting_time || lodge.meetingTime || '19:30',
    notes: ''
  };
  
  // Parse frequency from meeting details if available
  if (lodge.meeting_frequency || lodge.meetingFrequency) {
    schedule.frequency = (lodge.meeting_frequency || lodge.meetingFrequency).toLowerCase();
  }
  
  // Normalize day of week
  if (schedule.dayOfWeek) {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const dayIndex = days.findIndex(d => d.toLowerCase().startsWith(schedule.dayOfWeek.toLowerCase()));
    if (dayIndex >= 0) {
      schedule.dayOfWeek = days[dayIndex];
    }
  }
  
  // Normalize week of month
  if (schedule.weekOfMonth) {
    const weeks = {
      '1': 'first',
      '2': 'second',
      '3': 'third',
      '4': 'fourth',
      'last': 'last'
    };
    schedule.weekOfMonth = weeks[schedule.weekOfMonth] || schedule.weekOfMonth;
  }
  
  // Build notes from any additional meeting info
  const notesParts = [];
  if (lodge.meeting_notes || lodge.meetingNotes) notesParts.push(lodge.meeting_notes || lodge.meetingNotes);
  if (lodge.meeting_exceptions || lodge.meetingExceptions) notesParts.push(`Exceptions: ${lodge.meeting_exceptions || lodge.meetingExceptions}`);
  
  schedule.notes = notesParts.join('. ');
  
  return schedule;
}

module.exports = migrateJurisdictions;