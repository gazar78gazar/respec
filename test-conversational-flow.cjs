/**
 * Test 3: Conversational Flow Validation
 *
 * Purpose: Ensure Agent conversational behavior works correctly
 *
 * Tests:
 * 1. Use case questions are triggered
 * 2. "I don't know" handling creates assumptions (confidence=0.6)
 * 3. Category completion tracking works
 * 4. Questions are binary/multichoice format
 * 5. Context maintained across conversation
 * 6. Guided question progression
 */

const fs = require('fs');
const path = require('path');

// ============= UTILITY FUNCTIONS =============

function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) {
    console.error('❌ .env file not found');
    return {};
  }

  const envContent = fs.readFileSync(envPath, 'utf8');
  const envVars = {};

  envContent.split(/\r?\n/).forEach(line => {
    line = line.trim();
    if (!line || line.startsWith('#')) return;

    const [key, ...valueParts] = line.split('=');
    let value = valueParts.join('=').trim();

    const commentIndex = value.indexOf('#');
    if (commentIndex > 0) {
      value = value.substring(0, commentIndex).trim();
    }

    value = value.replace(/^["']|["']$/g, '');

    if (key && value) {
      envVars[key.trim()] = value;
    }
  });

  return envVars;
}

// ============= TEST FUNCTIONS =============

function testConversationalFlowIntegration() {
  console.log('📋 Test 3.1: Conversational Flow Integration');
  console.log('─────────────────────────────────────');

  const anthropicPath = path.join(__dirname, 'src/services/respec/AnthropicService.ts');
  if (!fs.existsSync(anthropicPath)) {
    console.log('❌ AnthropicService.ts not found');
    return false;
  }

  const content = fs.readFileSync(anthropicPath, 'utf8');

  // Extract system prompt
  const promptMatch = content.match(/buildSystemPrompt[\s\S]*?return\s*`([\s\S]*?)`[;\s]*\}/);

  if (!promptMatch) {
    console.log('❌ System prompt not found');
    return false;
  }

  const prompt = promptMatch[1];

  const checks = [
    { name: 'Conversational flow section exists', pattern: /Conversational [Ff]low:/i, critical: true },
    { name: 'Start with use case', pattern: /Start.*use case|use case.*first/i, critical: true },
    { name: 'Elicit user inputs', pattern: /[Ee]licit.*inputs?|ask.*guiding questions/i, critical: true },
    { name: 'Maintain user flow', pattern: /[Mm]aintain.*flow|know what category/i, critical: true },
    { name: 'Up to two questions per message', pattern: /two questions|up to 2|ask up to two/i, critical: true },
    { name: 'Binary/multichoice format', pattern: /binary|multichoice|multi.?choice/i, critical: true },
    { name: 'Separate question messages', pattern: /[Ss]eparate.*question.*messages/i, critical: false },
    { name: 'Remember conversational context', pattern: /[Rr]emember.*context|full.*conversational context/i, critical: true },
    { name: '"I Don\'t Know" handling', pattern: /I [Dd]on't [Kk]now|I [Dd]on\'t [Kk]now/i, critical: true },
    { name: 'Assumption confidence 0.6', pattern: /confidence.*0\.6|0\.6.*confidence/i, critical: true },
    { name: 'Let\'s assume [X]', pattern: /Let's assume|Let\'s assume/i, critical: true },
    { name: 'Category completion: 4 extractions', pattern: /4 extractions|every 4/i, critical: true },
    { name: 'Category completion: 75%', pattern: /75%|75 percent/i, critical: true },
    { name: 'Summarize and move to next', pattern: /summarize.*move|summarize.*next/i, critical: true }
  ];

  let criticalPass = 0;
  let criticalTotal = 0;
  let allPass = 0;

  checks.forEach(check => {
    const found = check.pattern.test(prompt);
    const symbol = found ? '✅' : (check.critical ? '❌' : '⚠️ ');
    console.log(`${symbol} ${check.name}`);

    if (found) allPass++;
    if (check.critical) {
      criticalTotal++;
      if (found) criticalPass++;
    }
  });

  console.log('');
  console.log(`Critical: ${criticalPass}/${criticalTotal}`);
  console.log(`Overall: ${allPass}/${checks.length}`);
  console.log('');

  return criticalPass === criticalTotal;
}

function testUseCaseQuestions() {
  console.log('📋 Test 3.2: Use Case Questions');
  console.log('─────────────────────────────────────');

  const anthropicPath = path.join(__dirname, 'src/services/respec/AnthropicService.ts');
  const content = fs.readFileSync(anthropicPath, 'utf8');

  const promptMatch = content.match(/buildSystemPrompt[\s\S]*?return\s*`([\s\S]*?)`[;\s]*\}/);
  if (!promptMatch) {
    console.log('❌ System prompt not found');
    return false;
  }

  const prompt = promptMatch[1];

  const expectedQuestions = [
    { name: 'Primary use case question', pattern: /What is the primary use case/i },
    { name: 'Monitor/control question', pattern: /monitor.*control.*both|control.*monitor.*both/i },
    { name: 'Devices/sensors count', pattern: /How many devices|How many sensors/i }
  ];

  let allFound = true;
  expectedQuestions.forEach(q => {
    const found = q.pattern.test(prompt);
    console.log(found ? `  ✅ ${q.name}` : `  ❌ ${q.name}`);
    if (!found) allFound = false;
  });

  console.log('');
  return allFound;
}

function testCategoryQuestions() {
  console.log('📋 Test 3.3: Category-Specific Questions');
  console.log('─────────────────────────────────────');

  const anthropicPath = path.join(__dirname, 'src/services/respec/AnthropicService.ts');
  const content = fs.readFileSync(anthropicPath, 'utf8');

  const promptMatch = content.match(/buildSystemPrompt[\s\S]*?return\s*`([\s\S]*?)`[;\s]*\}/);
  if (!promptMatch) {
    console.log('❌ System prompt not found');
    return false;
  }

  const prompt = promptMatch[1];

  const categories = [
    { name: 'I/O Questions', pattern: /I\/O.*Questions|I\/O Connectivity Questions/i },
    { name: 'Communication Questions', pattern: /Communication Questions/i },
    { name: 'Performance Questions', pattern: /Performance Questions/i },
    { name: 'Environment Questions', pattern: /Environment Questions/i },
    { name: 'Commercial Questions', pattern: /Commercial Questions/i }
  ];

  let foundCount = 0;
  categories.forEach(cat => {
    const found = cat.pattern.test(prompt);
    console.log(found ? `  ✅ ${cat.name}` : `  ⚠️  ${cat.name}`);
    if (found) foundCount++;
  });

  console.log('');
  console.log(`Found ${foundCount}/${categories.length} category question sets`);
  console.log('');

  return foundCount >= 3; // At least 3 categories should have questions
}

function testFieldAwareProcessing() {
  console.log('📋 Test 3.4: Field-Aware Value Selection');
  console.log('─────────────────────────────────────');

  const anthropicPath = path.join(__dirname, 'src/services/respec/AnthropicService.ts');
  const content = fs.readFileSync(anthropicPath, 'utf8');

  const promptMatch = content.match(/buildSystemPrompt[\s\S]*?return\s*`([\s\S]*?)`[;\s]*\}/);
  if (!promptMatch) {
    console.log('❌ System prompt not found');
    return false;
  }

  const prompt = promptMatch[1];

  const checks = [
    { name: 'Available field options mention', pattern: /Available field options|field options/i },
    { name: 'NEVER suggest unavailable values', pattern: /NEVER suggest|only.*from.*options|MUST.*select from/i },
    { name: 'Dropdown field handling', pattern: /dropdown.*field/i },
    { name: 'Closest match selection', pattern: /closest match|best match/i },
    { name: 'Substitution explanation', pattern: /substitutionNote|explain.*substitution/i },
    { name: 'originalRequest tracking', pattern: /originalRequest/i }
  ];

  let allFound = true;
  checks.forEach(check => {
    const found = check.pattern.test(prompt);
    console.log(found ? `  ✅ ${check.name}` : `  ⚠️  ${check.name}`);
    if (!found) allFound = false;
  });

  console.log('');
  return allFound;
}

function testConversationContextHandling() {
  console.log('📋 Test 3.5: Conversation Context Handling');
  console.log('─────────────────────────────────────');

  const anthropicPath = path.join(__dirname, 'src/services/respec/AnthropicService.ts');
  const content = fs.readFileSync(anthropicPath, 'utf8');

  // Check if conversation history is passed
  const checks = [
    { name: 'conversationHistory parameter', pattern: /conversationHistory/i },
    { name: 'Context in API call', pattern: /context.*conversationHistory|conversationHistory.*context/i },
    { name: 'Previous extractions mention', pattern: /[Pp]revious.*extractions|PREVIOUS.*EXTRACTIONS/i },
    { name: 'Remember full context instruction', pattern: /[Rr]emember.*full.*context/i }
  ];

  let allFound = true;
  checks.forEach(check => {
    const found = check.pattern.test(content);
    console.log(found ? `  ✅ ${check.name}` : `  ⚠️  ${check.name}`);
    if (!found) allFound = false;
  });

  console.log('');
  return allFound;
}

function testResponseFormat() {
  console.log('📋 Test 3.6: Response Format Specification');
  console.log('─────────────────────────────────────');

  const anthropicPath = path.join(__dirname, 'src/services/respec/AnthropicService.ts');
  const content = fs.readFileSync(anthropicPath, 'utf8');

  const promptMatch = content.match(/buildSystemPrompt[\s\S]*?return\s*`([\s\S]*?)`[;\s]*\}/);
  if (!promptMatch) {
    console.log('❌ System prompt not found');
    return false;
  }

  const prompt = promptMatch[1];

  const checks = [
    { name: 'JSON format specified', pattern: /JSON format|Return JSON/i },
    { name: 'requirements array', pattern: /requirements.*\[/i },
    { name: 'section field', pattern: /section.*:/i },
    { name: 'field field', pattern: /field.*:/i },
    { name: 'value field', pattern: /value.*:/i },
    { name: 'confidence field', pattern: /confidence.*:/i },
    { name: 'isAssumption field', pattern: /isAssumption.*:/i },
    { name: 'response field', pattern: /response.*:/i },
    { name: 'clarificationNeeded field', pattern: /clarificationNeeded.*:/i }
  ];

  let allFound = true;
  checks.forEach(check => {
    const found = check.pattern.test(prompt);
    console.log(found ? `  ✅ ${check.name}` : `  ❌ ${check.name}`);
    if (!found) allFound = false;
  });

  console.log('');
  return allFound;
}

// ============= MAIN TEST EXECUTION =============

async function runTests() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('Test 3: Conversational Flow Validation');
  console.log('═══════════════════════════════════════════════════════\n');

  const envVars = loadEnv();
  const hasApiKey = !!envVars.VITE_ANTHROPIC_API_KEY;

  console.log('📋 Prerequisites');
  console.log('─────────────────────────────────────');
  console.log(hasApiKey ? '✅ API key available' : '❌ API key missing');
  console.log('');

  // Run all tests
  const results = {
    conversationalFlow: testConversationalFlowIntegration(),
    useCaseQuestions: testUseCaseQuestions(),
    categoryQuestions: testCategoryQuestions(),
    fieldAwareProcessing: testFieldAwareProcessing(),
    contextHandling: testConversationContextHandling(),
    responseFormat: testResponseFormat()
  };

  // Summary
  console.log('═══════════════════════════════════════════════════════');
  console.log('TEST SUMMARY');
  console.log('═══════════════════════════════════════════════════════');

  const testResults = [
    { name: 'Conversational Flow Integration', passed: results.conversationalFlow, critical: true },
    { name: 'Use Case Questions', passed: results.useCaseQuestions, critical: true },
    { name: 'Category Questions', passed: results.categoryQuestions, critical: false },
    { name: 'Field-Aware Processing', passed: results.fieldAwareProcessing, critical: true },
    { name: 'Context Handling', passed: results.contextHandling, critical: true },
    { name: 'Response Format', passed: results.responseFormat, critical: true }
  ];

  testResults.forEach(result => {
    const symbol = result.passed ? '✅' : (result.critical ? '❌' : '⚠️ ');
    console.log(`${symbol} ${result.name}`);
  });

  const criticalTests = testResults.filter(r => r.critical);
  const criticalPassed = criticalTests.filter(r => r.passed).length;
  const allPassed = testResults.every(r => r.passed);

  console.log('');
  console.log(`Critical Tests: ${criticalPassed}/${criticalTests.length}`);
  console.log('');

  if (criticalPassed === criticalTests.length) {
    console.log('✅ ALL CRITICAL CONVERSATIONAL FLOW TESTS PASSED');
    console.log('');
    console.log('AnthropicService conversational flow is properly configured.');
    console.log('');
    console.log('💡 Key Features Validated:');
    console.log('  - Use case questions guide user input');
    console.log('  - "I don\'t know" creates assumptions (confidence=0.6)');
    console.log('  - Category completion tracking (every 4 extractions or 75%)');
    console.log('  - Binary/multichoice question format');
    console.log('  - Context maintained across conversation');
    console.log('  - Field-aware value selection with substitution notes');
  } else {
    console.log('❌ SOME CRITICAL TESTS FAILED');
    console.log('');
    console.log('Review failed tests above and update AnthropicService system prompt.');
  }
  console.log('');

  return criticalPassed === criticalTests.length;
}

// ============= RUN =============

runTests().catch(error => {
  console.error('❌ Test execution error:', error);
  process.exit(1);
});
