#!/usr/bin/env node

const http = require('http');

function fetchData() {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:3006/api/reports/proclamation-banquet', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function generateBanquetSummary() {
  try {
    console.log('Fetching Proclamation Banquet Report Data...\n');
    
    const data = await fetchData();
    
    console.log('='.repeat(70));
    console.log('PROCLAMATION BANQUET REGISTRATION SUMMARY');
    console.log('='.repeat(70));
    console.log(`Report Generated: ${new Date().toLocaleString('en-AU')}`);
    console.log('='.repeat(70));
    
    console.log('\n📊 OVERALL STATISTICS:');
    console.log('-'.repeat(40));
    console.log(`Total Banquet Attendees: ${data.totalAttendees}`);
    console.log(`Total Banquet Registrations: ${data.totalBanquetRegistrations}`);
    console.log();
    console.log(`Lodge Attendees: ${data.lodgeAttendees} (${data.lodgeRegistrations.length} registrations)`);
    console.log(`Individual Attendees: ${data.individualAttendees} (${data.individualRegistrations.length} registrations)`);
    
    console.log('\n🎫 TICKET TYPE BREAKDOWN:');
    console.log('-'.repeat(40));
    
    const ticketBreakdown = data.ticketBreakdown;
    Object.entries(ticketBreakdown).forEach(([ticketName, info]) => {
      console.log(`\n${ticketName}:`);
      console.log(`  - Price: $${info.price}`);
      console.log(`  - Registrations: ${info.registrationCount}`);
      console.log(`  - Total Attendees: ${info.attendeeCount}`);
      console.log(`  - Revenue: $${(info.attendeeCount * parseFloat(info.price)).toFixed(2)}`);
    });
    
    console.log('\n🏛️ LODGE REGISTRATIONS:');
    console.log('-'.repeat(40));
    if (data.lodgeRegistrations.length > 0) {
      data.lodgeRegistrations.slice(0, 10).forEach((reg, index) => {
        const orgName = reg.registrationData?.organisationName || reg.lodgeName || 'Unknown Lodge';
        const attendeeCount = reg.attendeeCount || reg.attendee_count || 0;
        const confirmationNumber = reg.confirmationNumber || reg.confirmation_number || 'N/A';
        console.log(`${index + 1}. ${orgName} - ${attendeeCount} attendees (${confirmationNumber})`);
      });
      if (data.lodgeRegistrations.length > 10) {
        console.log(`... and ${data.lodgeRegistrations.length - 10} more lodge registrations`);
      }
    } else {
      console.log('No lodge registrations found');
    }
    
    console.log('\n👥 INDIVIDUAL REGISTRATIONS SAMPLE:');
    console.log('-'.repeat(40));
    if (data.individualRegistrations.length > 0) {
      console.log(`Showing first 5 of ${data.individualRegistrations.length} individual registrations:`);
      data.individualRegistrations.slice(0, 5).forEach((reg, index) => {
        const attendeeCount = reg.attendeeCount || reg.attendee_count || 0;
        const confirmationNumber = reg.confirmationNumber || reg.confirmation_number || 'N/A';
        const amount = reg.totalAmountPaid?.$numberDecimal || reg.totalAmountPaid || 0;
        console.log(`${index + 1}. ${confirmationNumber} - ${attendeeCount} attendee(s), $${amount}`);
      });
    } else {
      console.log('No individual registrations found');
    }
    
    console.log('\n' + '='.repeat(70));
    console.log('END OF REPORT');
    console.log('='.repeat(70));
    
  } catch (error) {
    console.error('Error generating report:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the report
generateBanquetSummary();