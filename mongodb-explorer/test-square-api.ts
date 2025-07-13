import axios from 'axios';

interface SquareApiResponse {
  [key: string]: any;
}

async function testSquareAPI(): Promise<void> {
  try {
    console.log('Testing Square API connection...\n');
    
    const response = await axios.get<SquareApiResponse>('http://localhost:3005/api/test-square');
    
    console.log('✅ Success!');
    console.log('Response:', JSON.stringify(response.data, null, 2));
  } catch (error: any) {
    console.error('❌ Error!');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Error:', error.message);
    }
  }
}

testSquareAPI();
