const http = require('http');

// Make a direct API call to see the actual data
const options = {
  hostname: 'localhost',
  port: 3005,
  path: '/api/reports/event-tickets',
  method: 'GET',
};

const req = http.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      console.log('=== API RESPONSE FROM MONGODB EXPLORER ===\n');
      console.log('Summary:', json.summary);
      console.log('\nFirst ticket data:');
      if (json.tickets && json.tickets[0]) {
        console.log('  Name:', json.tickets[0].name);
        console.log('  Registration Count:', json.tickets[0].registrationCount);
        console.log('  Total Attendees:', json.tickets[0].totalAttendees);
      }
      
      // The fact that it returns data means it's connected to SOME database
      console.log('\nThis data must be coming from somewhere...');
    } catch (e) {
      console.error('Error parsing response:', e);
      console.log('Raw response:', data.substring(0, 200));
    }
  });
});

req.on('error', (e) => {
  console.error('Request error:', e);
});

req.end();