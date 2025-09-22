const fs = require('fs');
const path = require('path');
const https = require('https');

// Read .env file manually
const envPath = path.join(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const envLines = envContent.split('\n');

// Find the API key
let API_KEY = '';
for (const line of envLines) {
  if (line.startsWith('VITE_OPENAI_API_KEY=')) {
    API_KEY = line.split('=')[1].trim();
    break;
  }
}

console.log('\n=== OPENAI API KEY DIAGNOSTIC ===\n');

// Check key format
console.log('1. Key Format Check:');
if (!API_KEY) {
  console.log('   ❌ No API key found in .env');
  process.exit(1);
}

console.log(`   Key starts with: ${API_KEY.substring(0, 7)}...`);
console.log(`   Key ends with: ...${API_KEY.slice(-4)}`);
console.log(`   Key length: ${API_KEY.length} characters`);

if (API_KEY.startsWith('sk-')) {
  console.log('   ✅ Format looks correct');
} else {
  console.log('   ❌ Key should start with "sk-"');
}

// Test API call
console.log('\n2. Testing API Connection:');

const postData = JSON.stringify({
  model: 'gpt-3.5-turbo',
  messages: [{ role: 'user', content: 'Reply with just the word TEST' }],
  max_tokens: 5
});

const options = {
  hostname: 'api.openai.com',
  port: 443,
  path: '/v1/chat/completions',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Length': postData.length
  }
};

const req = https.request(options, (res) => {
  console.log(`   Status Code: ${res.statusCode}`);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    const response = JSON.parse(data);
    
    if (res.statusCode === 200) {
      console.log('   ✅ API call successful!');
      console.log(`   Response: "${response.choices[0].message.content}"`);
      console.log('\n✅ YOUR API KEY IS WORKING!');
    } else if (res.statusCode === 401) {
      console.log('   ❌ Authentication failed (401)');
      console.log('\nPossible issues:');
      console.log('1. Invalid API key');
      console.log('2. Key has been revoked');
      console.log('3. Extra spaces in the key');
      
      if (response.error) {
        console.log(`\nError details: ${response.error.message}`);
      }
      
      console.log('\nFIX: Get a new key at:');
      console.log('https://platform.openai.com/api-keys');
    } else if (res.statusCode === 429) {
      console.log('   ❌ Quota exceeded (429)');
      console.log('\nYou have no credits left!');
      console.log('FIX: Add credits at:');
      console.log('https://platform.openai.com/account/billing');
    } else {
      console.log(`   ❌ Error: ${res.statusCode}`);
      console.log('Response:', response);
    }
  });
});

req.on('error', (e) => {
  console.error(`Network error: ${e.message}`);
});

req.write(postData);
req.end();