const axios = require('axios');

async function test() {
  try {
    const res = await axios.get('http://localhost:5002/api/employees?companyId=1', {
        headers: {
            // Need a token for this! I'll try to login first.
        }
    });
    console.log('Employees load successful');
  } catch (err) {
    console.error('Employees load failed:', err.response?.status, err.response?.data);
  }
}

// I'll first login as Admin to get a token
async function loginAndTest() {
    try {
        const loginRes = await axios.post('http://localhost:5002/api/auth/login', {
            email: 'admin@difmo.com',
            password: 'password123'
        });
        const token = loginRes.data.access_token;
        console.log('Login successful');

        const res = await axios.get('http://localhost:5002/api/employees', {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log('Employees load successful, count:', res.data.length);
    } catch (err) {
        console.error('Error:', err.response?.status, JSON.stringify(err.response?.data, null, 2));
    }
}

loginAndTest();
