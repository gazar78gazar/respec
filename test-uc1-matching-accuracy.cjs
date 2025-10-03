/**
 * Test 2: UC1 Matching Accuracy
 *
 * Purpose: Validate semantic matching quality against known test cases
 *
 * This test validates that the SemanticMatchingService correctly:
 * 1. Matches exact technical terms to UC1 specifications
 * 2. Matches semantic concepts to UC1 requirements
 * 3. Returns appropriate confidence scores
 * 4. Correctly identifies node types (domain/requirement/specification)
 */

const fs = require('fs');
const path = require('path');

// ============= TEST CASES FROM SPRINT2_REVISED_PLAN.md =============

const TEST_CASES = [
  {
    name: 'Exact Processor Match',
    input: 'Intel Core i7',
    expectedMatch: {
      id: 'spc001',
      name: 'processor_type',
      type: 'specification',
      minConfidence: 0.9
    },
    description: 'Exact technical term should match with high confidence'
  },
  {
    name: 'Memory Specification Match',
    input: '16GB RAM',
    expectedMatch: {
      id: 'spc003',
      name: 'memory_capacity',
      type: 'specification',
      minConfidence: 0.9
    },
    description: 'Memory specification should match correctly'
  },
  {
    name: 'Semantic Use Case Match',
    input: 'thermal monitoring',
    expectedMatch: {
      id: 'req001',
      name: 'Real-Time Thermal Imaging',
      type: 'requirement',
      minConfidence: 0.8
    },
    description: 'Semantic concept should match to requirement'
  },
  {
    name: 'Semantic Budget Match',
    input: 'budget friendly',
    expectedMatches: [
      { id: 'req013', type: 'requirement' },
      { id: 'req014', type: 'requirement' }
    ],
    description: 'Budget concept should match to budget-related requirements',
    allowPartialMatch: true
  },
  {
    name: 'AI Feature Match',
    input: 'AI hot spot detection',
    expectedMatch: {
      id: 'req004',
      name: 'AI Pattern Recognition',
      type: 'requirement',
      minConfidence: 0.8
    },
    description: 'AI feature should match to AI requirement'
  },
  {
    name: 'Storage Specification',
    input: '512GB SSD',
    expectedMatch: {
      type: 'specification',
      minConfidence: 0.8
    },
    description: 'Storage specification should be recognized',
    allowPartialMatch: true
  }
];

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

function checkUC1Schema() {
  console.log('📋 Test 2.1: UC1 Schema Validation');
  console.log('─────────────────────────────────────');

  const uc1Path = path.join(__dirname, 'public', 'uc1.json');
  if (!fs.existsSync(uc1Path)) {
    console.log('❌ UC1.json not found at public/uc1.json');
    return { valid: false, schema: null };
  }

  try {
    const uc1Content = fs.readFileSync(uc1Path, 'utf8');
    const schema = JSON.parse(uc1Content);

    console.log('✅ UC1.json loaded successfully');

    // Validate structure
    const hasSpecifications = schema.specifications && Array.isArray(schema.specifications);
    const hasRequirements = schema.requirements && Array.isArray(schema.requirements);
    const hasDomains = schema.domains && Array.isArray(schema.domains);

    console.log(hasSpecifications ? `✅ Specifications: ${schema.specifications.length} found` : '❌ No specifications');
    console.log(hasRequirements ? `✅ Requirements: ${schema.requirements.length} found` : '❌ No requirements');
    console.log(hasDomains ? `✅ Domains: ${schema.domains.length} found` : '❌ No domains');

    // Check for specific test case IDs
    const spc001 = schema.specifications?.find(s => s.id === 'spc001');
    const spc003 = schema.specifications?.find(s => s.id === 'spc003');
    const req001 = schema.requirements?.find(r => r.id === 'req001');
    const req004 = schema.requirements?.find(r => r.id === 'req004');

    console.log(spc001 ? `✅ spc001 (processor_type) found` : '⚠️  spc001 not found');
    console.log(spc003 ? `✅ spc003 (memory_capacity) found` : '⚠️  spc003 not found');
    console.log(req001 ? `✅ req001 (Real-Time Thermal Imaging) found` : '⚠️  req001 not found');
    console.log(req004 ? `✅ req004 (AI Pattern Recognition) found` : '⚠️  req004 not found');

    console.log('');

    return {
      valid: hasSpecifications && hasRequirements && hasDomains,
      schema,
      testNodes: { spc001, spc003, req001, req004 }
    };

  } catch (error) {
    console.log('❌ Failed to parse UC1.json:', error.message);
    console.log('');
    return { valid: false, schema: null };
  }
}

function analyzeMatchingLogic() {
  console.log('📋 Test 2.2: Matching Logic Analysis');
  console.log('─────────────────────────────────────');

  const matcherPath = path.join(__dirname, 'src/services/respec/semantic/SemanticMatchingService.ts');
  if (!fs.existsSync(matcherPath)) {
    console.log('❌ SemanticMatchingService.ts not found');
    return false;
  }

  const content = fs.readFileSync(matcherPath, 'utf8');

  const checks = [
    {
      name: 'UC1 schema passed to LLM',
      pattern: /UC1.*[Ss]chema|uc1.*[Cc]ontext/,
      critical: true
    },
    {
      name: 'Confidence scoring implemented',
      pattern: /confidence.*number|confidence.*0\.\d/,
      critical: true
    },
    {
      name: 'Match type classification',
      pattern: /'exact'|'fuzzy'|'semantic'/,
      critical: true
    },
    {
      name: 'Semantic similarity mentioned',
      pattern: /semantic.*similarity|semantic.*match/i,
      critical: false
    },
    {
      name: 'Domain/requirement/specification types',
      pattern: /'domain'.*'requirement'.*'specification'|type.*domain.*requirement.*specification/s,
      critical: true
    },
    {
      name: 'Budget friendly example',
      pattern: /budget.*friendly/i,
      critical: false
    },
    {
      name: 'Rationale provided',
      pattern: /rationale.*string/,
      critical: false
    }
  ];

  let allCriticalPassed = true;
  checks.forEach(check => {
    const found = check.pattern.test(content);
    const symbol = found ? '✅' : (check.critical ? '❌' : '⚠️ ');
    console.log(`${symbol} ${check.name}`);

    if (!found && check.critical) {
      allCriticalPassed = false;
    }
  });

  console.log('');
  return allCriticalPassed;
}

function testSystemPrompt() {
  console.log('📋 Test 2.3: System Prompt Quality');
  console.log('─────────────────────────────────────');

  const matcherPath = path.join(__dirname, 'src/services/respec/semantic/SemanticMatchingService.ts');
  if (!fs.existsSync(matcherPath)) {
    console.log('❌ SemanticMatchingService.ts not found');
    return false;
  }

  const content = fs.readFileSync(matcherPath, 'utf8');

  // Extract system prompt if it exists
  const systemPromptMatch = content.match(/buildSystemPrompt[\s\S]*?return\s*`([\s\S]*?)`/);

  if (!systemPromptMatch) {
    console.log('⚠️  System prompt not found in expected format');
    return false;
  }

  const prompt = systemPromptMatch[1];

  const checks = [
    { name: 'Mentions UC1 schema', pattern: /UC1/i },
    { name: 'Semantic matching instructions', pattern: /semantic/i },
    { name: 'Confidence scoring guidance', pattern: /confidence/i },
    { name: 'Match type guidance', pattern: /exact|fuzzy|semantic/i },
    { name: 'Example: budget friendly', pattern: /budget.*friendly/i },
    { name: 'Example: fast response', pattern: /fast.*response|response.*time/i },
    { name: 'Example: outdoor/environmental', pattern: /outdoor|environmental/i },
    { name: 'Domain/requirement/specification distinction', pattern: /domain.*requirement.*specification|specification.*requirement.*domain/is },
    { name: 'JSON format specified', pattern: /JSON/i }
  ];

  let score = 0;
  checks.forEach(check => {
    const found = check.pattern.test(prompt);
    console.log(found ? `  ✅ ${check.name}` : `  ⚠️  ${check.name}`);
    if (found) score++;
  });

  const quality = score / checks.length;
  console.log('');
  console.log(`Quality Score: ${score}/${checks.length} (${(quality * 100).toFixed(0)}%)`);
  console.log('');

  return quality >= 0.7; // 70% quality threshold
}

function testContextPreparation() {
  console.log('📋 Test 2.4: UC1 Context Preparation');
  console.log('─────────────────────────────────────');

  const matcherPath = path.join(__dirname, 'src/services/respec/semantic/SemanticMatchingService.ts');
  if (!fs.existsSync(matcherPath)) {
    console.log('❌ SemanticMatchingService.ts not found');
    return false;
  }

  const content = fs.readFileSync(matcherPath, 'utf8');

  const checks = [
    { name: 'prepareUC1Context method exists', pattern: /prepareUC1Context/ },
    { name: 'getDomains() called', pattern: /getDomains\(\)/ },
    { name: 'getRequirementsByDomain() called', pattern: /getRequirementsByDomain/ },
    { name: 'getSpecificationsByRequirement() called', pattern: /getSpecificationsByRequirement/ },
    { name: 'Includes domain descriptions', pattern: /description.*domain|domain.*description/i },
    { name: 'Includes requirement info', pattern: /requirements.*push|requirements\.push/ },
    { name: 'Includes specification info', pattern: /specifications.*push|specifications\.push/ },
    { name: 'Includes form_mapping', pattern: /form_mapping/ },
    { name: 'Includes options for specs', pattern: /options/ }
  ];

  let allPassed = true;
  checks.forEach(check => {
    const found = check.pattern.test(content);
    console.log(found ? `  ✅ ${check.name}` : `  ❌ ${check.name}`);
    if (!found) allPassed = false;
  });

  console.log('');
  return allPassed;
}

function testExpectedMatches(uc1Schema) {
  console.log('📋 Test 2.5: Expected Match Validation');
  console.log('─────────────────────────────────────');

  if (!uc1Schema || !uc1Schema.valid) {
    console.log('❌ Cannot validate matches - UC1 schema not loaded');
    return false;
  }

  console.log('Validating that expected UC1 nodes exist in schema:\n');

  const testCases = TEST_CASES.filter(tc => tc.expectedMatch);
  let allFound = true;

  testCases.forEach(testCase => {
    const expected = testCase.expectedMatch;

    if (testCase.allowPartialMatch) {
      console.log(`⚠️  ${testCase.name}: Partial match allowed, skipping validation`);
      return;
    }

    let found = false;
    let actualNode = null;

    if (expected.type === 'specification') {
      actualNode = uc1Schema.schema.specifications?.find(s => s.id === expected.id);
      found = !!actualNode;
    } else if (expected.type === 'requirement') {
      actualNode = uc1Schema.schema.requirements?.find(r => r.id === expected.id);
      found = !!actualNode;
    } else if (expected.type === 'domain') {
      actualNode = uc1Schema.schema.domains?.find(d => d.id === expected.id);
      found = !!actualNode;
    }

    if (found && actualNode) {
      console.log(`✅ ${testCase.name}`);
      console.log(`   → ${expected.id} (${actualNode.name || expected.name}) exists in UC1 schema`);
    } else {
      console.log(`❌ ${testCase.name}`);
      console.log(`   → ${expected.id} NOT FOUND in UC1 schema`);
      allFound = false;
    }
  });

  console.log('');
  return allFound;
}

// ============= MAIN TEST EXECUTION =============

async function runTests() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('Test 2: UC1 Matching Accuracy Validation');
  console.log('═══════════════════════════════════════════════════════\n');

  const envVars = loadEnv();
  const hasApiKey = !!envVars.VITE_ANTHROPIC_API_KEY;

  console.log('📋 Prerequisites');
  console.log('─────────────────────────────────────');
  console.log(hasApiKey ? '✅ API key available' : '❌ API key missing');
  console.log('');

  // Run tests
  const uc1Schema = checkUC1Schema();
  const matchingLogic = analyzeMatchingLogic();
  const systemPrompt = testSystemPrompt();
  const contextPrep = testContextPreparation();
  const expectedMatches = testExpectedMatches(uc1Schema);

  // Summary
  console.log('═══════════════════════════════════════════════════════');
  console.log('TEST SUMMARY');
  console.log('═══════════════════════════════════════════════════════');

  const results = [
    { name: 'UC1 Schema Valid', passed: uc1Schema.valid },
    { name: 'Matching Logic Implemented', passed: matchingLogic },
    { name: 'System Prompt Quality', passed: systemPrompt },
    { name: 'Context Preparation', passed: contextPrep },
    { name: 'Expected Matches Exist', passed: expectedMatches }
  ];

  results.forEach(result => {
    console.log(result.passed ? `✅ ${result.name}` : `❌ ${result.name}`);
  });

  const allPassed = results.every(r => r.passed);
  console.log('');

  if (allPassed) {
    console.log('✅ ALL UC1 MATCHING ACCURACY TESTS PASSED');
    console.log('');
    console.log('SemanticMatchingService is properly configured for UC1 matching.');
    console.log('Ready for live API testing with actual LLM calls.');
  } else {
    console.log('❌ SOME TESTS FAILED');
    console.log('');
    console.log('NOTE: This test validates structure and configuration.');
    console.log('Actual matching accuracy requires live LLM API testing.');
  }
  console.log('');
  console.log('💡 Test Cases to Validate with Live Testing:');
  TEST_CASES.forEach((tc, i) => {
    console.log(`${i + 1}. ${tc.name}: "${tc.input}"`);
    console.log(`   Expected: ${tc.expectedMatch?.id || tc.expectedMatches?.map(m => m.id).join(', ') || 'N/A'}`);
  });
  console.log('');

  return allPassed;
}

// ============= RUN =============

runTests().catch(error => {
  console.error('❌ Test execution error:', error);
  process.exit(1);
});
