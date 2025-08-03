async function testSquareAPIs() {
  try {
    const { SquareClient, SquareEnvironment } = await import('square');
    
    const client = new SquareClient({
      environment: SquareEnvironment.Production,
      token: process.env.SQUARE_ACCESS_TOKEN || "EAAAl0KOyTK_6vsnSkaSJKTUSyqQvhNuRQoJWrF0A7QT9lexMPYW7RaeVozX1fyB",
    });
    
    console.log('Testing Square client APIs...\n');
    console.log('Client properties:', Object.keys(client));
    console.log('\nChecking for customers API:', !!client.customers);
    console.log('Checking for customersApi:', !!client.customersApi);
    console.log('Checking for orders API:', !!client.orders);
    console.log('Checking for ordersApi:', !!client.ordersApi);
    
    // Test customer API
    if (client.customers) {
      console.log('\nCustomer API methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(client.customers)));
      console.log('\nTrying client.customers.get...');
      try {
        const customerId = "WJ86NR1VDY281NW56AZ8GZ3BWG";
        console.log('Getting customer with ID:', customerId);
        const customerResp = await client.customers.get({ customerId });
        const customer = (customerResp.result || customerResp.response || customerResp).customer;
        console.log('Customer found:', !!customer);
        if (customer) {
          console.log('Customer name:', customer.givenName, customer.familyName);
        }
      } catch (e) {
        console.log('Error with get:', e.message);
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testSquareAPIs();