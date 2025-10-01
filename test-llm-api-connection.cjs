/**
 * LLM API Connection Test
 *
 * Purpose: Verify Anthropic API connectivity, model name validity, and API key
 * Tests:
 * 1. Direct API call to Anthropic
 * 2. Model name validation
 * 3. API key validity
 * 4. Network/CORS issues
 */

const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');

console.log('='.repeat(80));
console.log('🔍 LLM API CONNECTION DIAGNOSTIC TEST');
console.log('='.repeat(80));

// Load environment variables
const envPath = path.join(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};

envContent.split(/\r?\n/).forEach(line => {
  // Skip comments and empty lines
  if (line.trim().startsWith('#') || !line.trim()) return;

  const match = line.match(/^([^=]+)=(.+)$/);
  if (match) {
    const key = match[1].trim();
    let value = match[2].trim();

    // Remove inline comments (but preserve quoted strings)
    const commentIndex = value.indexOf('#');
    if (commentIndex > 0) {
      value = value.substring(0, commentIndex).trim();
    }

    envVars[key] = value;
  }
});

console.log('\n📋 Configuration Check:');
console.log('  Provider:', envVars.VITE_LLM_PROVIDER);
console.log('  Model:', envVars.VITE_LLM_MODEL);
console.log('  Temperature:', envVars.VITE_LLM_TEMPERATURE);
console.log('  Max Tokens:', envVars.VITE_LLM_MAX_TOKENS);
console.log('  API Key:', envVars.VITE_ANTHROPIC_API_KEY ?
  `${envVars.VITE_ANTHROPIC_API_KEY.substring(0, 12)}...${envVars.VITE_ANTHROPIC_API_KEY.slice(-4)}` :
  '❌ NOT FOUND');

async function testAnthropicConnection() {
  console.log('\n' + '='.repeat(80));
  console.log('TEST 1: Direct Anthropic API Call');
  console.log('='.repeat(80));

  if (!envVars.VITE_ANTHROPIC_API_KEY) {
    console.log('❌ FAILED: No API key found in .env');
    return false;
  }

  try {
    const client = new Anthropic({
      apiKey: envVars.VITE_ANTHROPIC_API_KEY
    });

    console.log('✅ Anthropic client created');
    console.log('🔵 Attempting API call with model:', envVars.VITE_LLM_MODEL);

    const startTime = Date.now();

    const completion = await client.messages.create({
      model: envVars.VITE_LLM_MODEL,
      max_tokens: parseInt(envVars.VITE_LLM_MAX_TOKENS) || 100,
      temperature: parseFloat(envVars.VITE_LLM_TEMPERATURE) || 0.3,
      messages: [
        {
          role: 'user',
          content: 'Reply with exactly: "API connection successful"'
        }
      ]
    });

    const duration = Date.now() - startTime;

    console.log('✅ API CALL SUCCESSFUL');
    console.log('  Response time:', duration, 'ms');
    console.log('  Model used:', completion.model);
    console.log('  Response:', completion.content[0].text);
    console.log('  Usage:', JSON.stringify(completion.usage, null, 2));

    return true;

  } catch (error) {
    console.log('❌ API CALL FAILED');
    console.log('  Error type:', error.constructor.name);
    console.log('  Error message:', error.message);

    if (error.status) {
      console.log('  HTTP Status:', error.status);
    }

    if (error.error) {
      console.log('  API Error:', JSON.stringify(error.error, null, 2));
    }

    // Specific error diagnostics
    if (error.message.includes('model')) {
      console.log('\n🔍 DIAGNOSIS: Invalid model name');
      console.log('  Current model:', envVars.VITE_LLM_MODEL);
      console.log('  Valid models (as of Oct 2025):');
      console.log('    - claude-sonnet-4-5-20250929 (recommended for coding)');
      console.log('    - claude-opus-4-1-20250805 (most powerful)');
      console.log('    - claude-opus-4-20250514 (original opus 4)');
    }

    if (error.message.includes('authentication') || error.message.includes('api_key')) {
      console.log('\n🔍 DIAGNOSIS: API key issue');
      console.log('  Check if API key is valid and active');
      console.log('  Verify at: https://console.anthropic.com/settings/keys');
    }

    if (error.message.includes('rate_limit')) {
      console.log('\n🔍 DIAGNOSIS: Rate limit exceeded');
      console.log('  Wait a few minutes and try again');
    }

    return false;
  }
}

async function testModelValidity() {
  console.log('\n' + '='.repeat(80));
  console.log('TEST 2: Model Name Validation');
  console.log('='.repeat(80));

  const validModels = {
    'claude-sonnet-4-5-20250929': 'Claude Sonnet 4.5 (Sep 2025) - Best for coding',
    'claude-opus-4-1-20250805': 'Claude Opus 4.1 (Aug 2025) - Most powerful',
    'claude-opus-4-20250514': 'Claude Opus 4 (May 2025) - Original',
    'claude-sonnet-4-20250514': 'Claude Sonnet 4 (May 2025)'
  };

  const currentModel = envVars.VITE_LLM_MODEL;

  console.log('Current model:', currentModel);

  if (validModels[currentModel]) {
    console.log('✅ Model name is valid:', validModels[currentModel]);
    return true;
  } else {
    console.log('❌ Model name NOT in known valid list');
    console.log('\nValid models:');
    Object.entries(validModels).forEach(([model, desc]) => {
      console.log(`  - ${model}`);
      console.log(`    ${desc}`);
    });
    console.log('\nNote: Model might still work if it\'s newly released.');
    return false;
  }
}

async function testFallbackModel() {
  console.log('\n' + '='.repeat(80));
  console.log('TEST 3: Fallback Model Check');
  console.log('='.repeat(80));

  const anthropicServicePath = path.join(__dirname, 'src', 'services', 'respec', 'AnthropicService.ts');
  const content = fs.readFileSync(anthropicServicePath, 'utf8');

  const modelMatch = content.match(/model:\s*import\.meta\.env\.VITE_LLM_MODEL\s*\|\|\s*['"]([^'"]+)['"]/);

  if (modelMatch) {
    const fallbackModel = modelMatch[1];
    console.log('Fallback model in AnthropicService.ts:', fallbackModel);

    const validModels = [
      'claude-sonnet-4-5-20250929',
      'claude-opus-4-1-20250805',
      'claude-opus-4-20250514',
      'claude-sonnet-4-20250514'
    ];

    if (validModels.includes(fallbackModel)) {
      console.log('✅ Fallback model is valid');
      return true;
    } else {
      console.log('❌ Fallback model is INVALID');
      console.log('  This will cause issues if .env model fails to load');
      return false;
    }
  } else {
    console.log('⚠️  Could not find fallback model in code');
    return false;
  }
}

async function runAllTests() {
  console.log('\n');

  const results = {
    modelValidity: await testModelValidity(),
    fallbackModel: await testFallbackModel(),
    apiConnection: await testAnthropicConnection()
  };

  console.log('\n' + '='.repeat(80));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(80));

  console.log('Model Name Validity:', results.modelValidity ? '✅ PASS' : '❌ FAIL');
  console.log('Fallback Model Check:', results.fallbackModel ? '✅ PASS' : '⚠️  WARNING');
  console.log('API Connection:', results.apiConnection ? '✅ PASS' : '❌ FAIL');

  const allPassed = results.modelValidity && results.apiConnection;

  console.log('\n' + '='.repeat(80));
  if (allPassed) {
    console.log('✅ ALL CRITICAL TESTS PASSED');
    console.log('The LLM API connection is working correctly.');
    console.log('If the app still shows graceful failure, the issue is elsewhere.');
  } else {
    console.log('❌ SOME TESTS FAILED');
    console.log('Fix the issues above before proceeding.');
  }
  console.log('='.repeat(80));

  return allPassed;
}

// Run tests
runAllTests().catch(error => {
  console.error('\n❌ UNEXPECTED ERROR:', error);
  process.exit(1);
});
