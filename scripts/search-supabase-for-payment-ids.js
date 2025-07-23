const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function searchSupabaseForPaymentIds() {
  // Initialize Supabase client
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase credentials in environment variables');
    return;
  }
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  try {
    console.log('=== SEARCHING SUPABASE FOR PAYMENT IDS ===\n');
    
    // Read the unenriched transactions report
    const reportPath = path.join(__dirname, 'unenriched-transactions-report.json');
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
    
    console.log(`Found ${report.unenrichedTransactions.length} payment IDs to search in Supabase\n`);
    
    const searchResults = [];
    
    for (const transaction of report.unenrichedTransactions) {
      const paymentId = transaction.paymentId;
      console.log(`\n=== Searching for Payment ID: ${paymentId} ===`);
      console.log(`Amount: $${transaction.amount}`);
      console.log(`Customer: ${transaction.customerName} (${transaction.customerEmail})`);
      
      const result = {
        paymentId: paymentId,
        transactionDetails: {
          amount: transaction.amount,
          customerName: transaction.customerName,
          customerEmail: transaction.customerEmail,
          createdAt: transaction.createdAt,
          orderMetadata: transaction.orderMetadata
        },
        supabaseMatches: []
      };
      
      // Search 1: stripe_payment_intent_id column
      console.log('\nSearching stripe_payment_intent_id...');
      const { data: stripeMatches, error: stripeError } = await supabase
        .from('registrations')
        .select('*')
        .eq('stripe_payment_intent_id', paymentId);
      
      if (stripeError) {
        console.error('Error searching stripe_payment_intent_id:', stripeError.message);
      } else if (stripeMatches && stripeMatches.length > 0) {
        console.log(`✅ Found ${stripeMatches.length} match(es) in stripe_payment_intent_id`);
        stripeMatches.forEach(match => {
          console.log(`  - Registration ID: ${match.id}`);
          console.log(`    Confirmation: ${match.confirmation_number}`);
          console.log(`    Status: ${match.status}`);
          result.supabaseMatches.push({
            field: 'stripe_payment_intent_id',
            registration: match
          });
        });
      }
      
      // Search 2: square_payment_id column
      console.log('\nSearching square_payment_id...');
      const { data: squareMatches, error: squareError } = await supabase
        .from('registrations')
        .select('*')
        .eq('square_payment_id', paymentId);
      
      if (squareError) {
        console.error('Error searching square_payment_id:', squareError.message);
      } else if (squareMatches && squareMatches.length > 0) {
        console.log(`✅ Found ${squareMatches.length} match(es) in square_payment_id`);
        squareMatches.forEach(match => {
          console.log(`  - Registration ID: ${match.id}`);
          console.log(`    Confirmation: ${match.confirmation_number}`);
          console.log(`    Status: ${match.status}`);
          result.supabaseMatches.push({
            field: 'square_payment_id',
            registration: match
          });
        });
      }
      
      // Search 3: registration_data JSONB column for square_payment_id
      console.log('\nSearching registration_data->square_payment_id...');
      const { data: jsonbMatches, error: jsonbError } = await supabase
        .from('registrations')
        .select('*')
        .filter('registration_data->square_payment_id', 'eq', paymentId);
      
      if (jsonbError) {
        console.error('Error searching registration_data->square_payment_id:', jsonbError.message);
      } else if (jsonbMatches && jsonbMatches.length > 0) {
        console.log(`✅ Found ${jsonbMatches.length} match(es) in registration_data->square_payment_id`);
        jsonbMatches.forEach(match => {
          console.log(`  - Registration ID: ${match.id}`);
          console.log(`    Confirmation: ${match.confirmation_number}`);
          console.log(`    Status: ${match.status}`);
          result.supabaseMatches.push({
            field: 'registration_data->square_payment_id',
            registration: match
          });
        });
      }
      
      // Also try searching with text search in registration_data
      console.log('\nSearching registration_data with text search...');
      const { data: textMatches, error: textError } = await supabase
        .from('registrations')
        .select('*')
        .textSearch('registration_data', paymentId);
      
      if (!textError && textMatches && textMatches.length > 0) {
        // Filter to only include matches where the payment ID actually appears
        const validTextMatches = textMatches.filter(match => {
          const regDataStr = JSON.stringify(match.registration_data);
          return regDataStr.includes(paymentId);
        });
        
        if (validTextMatches.length > 0) {
          console.log(`✅ Found ${validTextMatches.length} match(es) in registration_data text search`);
          validTextMatches.forEach(match => {
            console.log(`  - Registration ID: ${match.id}`);
            console.log(`    Confirmation: ${match.confirmation_number}`);
            console.log(`    Status: ${match.status}`);
            result.supabaseMatches.push({
              field: 'registration_data_text_search',
              registration: match
            });
          });
        }
      }
      
      if (result.supabaseMatches.length === 0) {
        console.log('\n❌ No matches found in Supabase');
        
        // Try searching by email and amount as a fallback
        if (transaction.customerEmail && transaction.customerEmail !== 'Unknown' && transaction.customerEmail !== 'customer@example.com') {
          console.log('\nSearching by email in registration_data...');
          
          const { data: emailMatches, error: emailError } = await supabase
            .from('registrations')
            .select('*')
            .or(`registration_data->bookingContact->emailAddress.eq.${transaction.customerEmail},registration_data->bookingContact->email.eq.${transaction.customerEmail}`);
          
          if (!emailError && emailMatches && emailMatches.length > 0) {
            console.log(`🔍 Found ${emailMatches.length} registration(s) with matching email`);
            emailMatches.forEach(match => {
              console.log(`  - Registration ID: ${match.id}`);
              console.log(`    Confirmation: ${match.confirmation_number}`);
              console.log(`    Total Paid: ${match.total_amount_paid}`);
              console.log(`    Payment IDs: stripe=${match.stripe_payment_intent_id}, square=${match.square_payment_id}`);
              
              // Check if amount matches
              const regAmount = parseFloat(match.total_amount_paid);
              const txAmount = parseFloat(transaction.amount);
              if (Math.abs(regAmount - txAmount) < 0.01) {
                console.log(`    ✅ Amount matches!`);
              }
            });
          }
        }
      }
      
      searchResults.push(result);
    }
    
    // Save search results
    const outputPath = path.join(__dirname, 'supabase-payment-search-results.json');
    const searchReport = {
      generatedAt: new Date().toISOString(),
      searchedFields: [
        'stripe_payment_intent_id',
        'square_payment_id',
        'registration_data->square_payment_id',
        'registration_data text search'
      ],
      totalSearched: report.unenrichedTransactions.length,
      results: searchResults
    };
    
    fs.writeFileSync(outputPath, JSON.stringify(searchReport, null, 2));
    
    console.log(`\n\n=== SEARCH COMPLETE ===`);
    console.log(`\n📄 Detailed search results saved to: ${outputPath}`);
    
    // Summary
    const foundCount = searchResults.filter(r => r.supabaseMatches.length > 0).length;
    console.log(`\nSummary:`);
    console.log(`  Total payment IDs searched: ${searchResults.length}`);
    console.log(`  Found matches in Supabase: ${foundCount}`);
    console.log(`  No matches found: ${searchResults.length - foundCount}`);
    
    // List which transactions have matches
    if (foundCount > 0) {
      console.log('\nTransactions with Supabase matches:');
      searchResults.forEach(result => {
        if (result.supabaseMatches.length > 0) {
          console.log(`\n${result.paymentId}:`);
          const uniqueRegistrations = [...new Set(result.supabaseMatches.map(m => m.registration.id))];
          uniqueRegistrations.forEach(regId => {
            const match = result.supabaseMatches.find(m => m.registration.id === regId);
            console.log(`  - ${match.registration.confirmation_number} (Found in: ${match.field})`);
          });
        }
      });
    }
    
  } catch (error) {
    console.error('Fatal error:', error);
  }
}

// Run the search
searchSupabaseForPaymentIds();