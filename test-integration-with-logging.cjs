/**
 * Integration Test with Verbose Logging
 *
 * Purpose: Add temporary logging to trace exact execution path
 * Generates: Modified files with console.log statements for debugging
 */

const fs = require('fs');
const path = require('path');

console.log('='.repeat(80));
console.log('🔍 INTEGRATION TEST WITH LOGGING INJECTION');
console.log('='.repeat(80));

console.log('\nThis script will:');
console.log('  1. Analyze current semantic matching flow');
console.log('  2. Suggest logging points for debugging');
console.log('  3. Generate temporary logging code');
console.log('\n⚠️  NOTE: This is diagnostic only - no files will be modified');

// Logging injection points
const loggingPoints = [
  {
    file: 'src/services/respec/SimplifiedRespecService.ts',
    location: 'Line ~444: Before semantic matching check',
    code: `console.log('[DEBUG] 🔵 processChatMessage called');
console.log('[DEBUG] useSemanticMatching:', this.useSemanticMatching);
console.log('[DEBUG] semanticIntegration exists:', !!this.semanticIntegration);`,
    purpose: 'Verify semantic matching is enabled'
  },
  {
    file: 'src/services/respec/semantic/SemanticIntegrationService.ts',
    location: 'Line ~64: Start of processMessage()',
    code: `console.log('[DEBUG] 🟢 SemanticIntegration.processMessage called');
console.log('[DEBUG] Message:', message);`,
    purpose: 'Confirm flow reaches semantic integration'
  },
  {
    file: 'src/services/respec/semantic/SemanticMatcher.ts',
    location: 'Line ~101: Start of parseMessage()',
    code: `console.log('[DEBUG] 🟡 SemanticMatcher.parseMessage called');
console.log('[DEBUG] Message:', message);`,
    purpose: 'Confirm flow reaches semantic matcher'
  },
  {
    file: 'src/services/respec/semantic/SemanticMatcher.ts',
    location: 'Line ~180: After intent detection',
    code: `console.log('[DEBUG] Intent detected:', intent.type);
console.log('[DEBUG] Requires response:', intent.requiresResponse);`,
    purpose: 'See if intent is being detected correctly'
  },
  {
    file: 'src/services/respec/semantic/SemanticMatcher.ts',
    location: 'Line ~279: After technical extraction',
    code: `console.log('[DEBUG] Extractions found:', extractions.length);
extractions.forEach(e => console.log('[DEBUG]   -', e.category, ':', e.value));`,
    purpose: 'See what patterns are matching'
  },
  {
    file: 'src/services/respec/semantic/SemanticMatcher.ts',
    location: 'Line ~294: After UC1 mapping',
    code: `console.log('[DEBUG] UC1 mapping complete');
mappedExtractions.forEach(e => console.log('[DEBUG]   - Candidates:', e.uc1Candidates.length));`,
    purpose: 'Verify UC1 candidates are being found'
  },
  {
    file: 'src/services/respec/semantic/SemanticMatcher.ts',
    location: 'Line ~128: Before return hasRequirements',
    code: `console.log('[DEBUG] ⭐ hasRequirements:', mappedExtractions.length > 0);
console.log('[DEBUG] Mapped extractions:', mappedExtractions.length);`,
    purpose: 'Critical: See why hasRequirements is false'
  },
  {
    file: 'src/services/respec/semantic/SemanticIntegrationService.ts',
    location: 'Line ~119: In convertToFormUpdates()',
    code: `console.log('[DEBUG] Converting to form updates');
console.log('[DEBUG] Extractions:', semanticResult.extractions.length);
console.log('[DEBUG] hasRequirements:', semanticResult.hasRequirements);`,
    purpose: 'See if extractions are being converted'
  },
  {
    file: 'src/services/respec/semantic/SemanticIntegrationService.ts',
    location: 'Line ~136: Field mapping check',
    code: `console.log('[DEBUG] Field mapping for', bestCandidate.specId, ':', fieldMapping);`,
    purpose: 'Verify CompatibilityLayer mappings work'
  },
  {
    file: 'src/services/respec/semantic/SemanticIntegrationService.ts',
    location: 'Line ~201: Default message return',
    code: `console.log('[DEBUG] 🔴 Returning default message (no requirements detected)');`,
    purpose: 'Confirm this is where the flow ends'
  },
  {
    file: 'src/services/respec/AnthropicService.ts',
    location: 'Line ~71: Before API call',
    code: `console.log('[DEBUG] 🔵 ANTHROPIC API CALL STARTING');
console.log('[DEBUG] Model:', import.meta.env.VITE_LLM_MODEL);
console.log('[DEBUG] Has client:', !!this.client);`,
    purpose: 'Verify if LLM is being called at all'
  },
  {
    file: 'src/services/respec/AnthropicService.ts',
    location: 'Line ~111: API error catch',
    code: `console.log('[DEBUG] 🔴 ANTHROPIC API CALL FAILED');
console.log('[DEBUG] Error:', error.message);`,
    purpose: 'Catch silent API failures'
  }
];

console.log('\n' + '='.repeat(80));
console.log('📍 RECOMMENDED LOGGING POINTS');
console.log('='.repeat(80));

loggingPoints.forEach((point, idx) => {
  console.log(`\n${idx + 1}. ${point.file}`);
  console.log(`   Location: ${point.location}`);
  console.log(`   Purpose: ${point.purpose}`);
  console.log('   Code to add:');
  point.code.split('\n').forEach(line => {
    console.log(`     ${line}`);
  });
});

// Generate a complete logging-enhanced version
console.log('\n' + '='.repeat(80));
console.log('💡 USAGE INSTRUCTIONS');
console.log('='.repeat(80));

console.log('\nTo debug the issue, manually add the logging code above to the files.');
console.log('Then:');
console.log('  1. Restart the dev server: npm run dev');
console.log('  2. Open browser console (F12)');
console.log('  3. Send a test message in the chat');
console.log('  4. Watch the [DEBUG] logs to trace execution');

console.log('\n⚠️  IMPORTANT: Remove debug logs after testing!');

// Generate specific test scenarios
console.log('\n' + '='.repeat(80));
console.log('🧪 RECOMMENDED TEST SCENARIOS');
console.log('='.repeat(80));

const testScenarios = [
  {
    input: 'I need an Intel Core i7 processor',
    expected: 'Should extract processor requirement',
    checkFor: [
      'Intent: requirement',
      'Extractions: 1',
      'hasRequirements: true',
      'Field mapping found'
    ]
  },
  {
    input: 'high performance system',
    expected: 'Should extract performance requirement',
    checkFor: [
      'Intent: requirement',
      'Extractions: 1 (performance)',
      'UC1 candidates found'
    ]
  },
  {
    input: 'budget friendly option',
    expected: 'Likely to fail pattern matching',
    checkFor: [
      'Intent: other or requirement',
      'Extractions: 0',
      'hasRequirements: false',
      'Default message returned'
    ]
  },
  {
    input: 'hello',
    expected: 'Should detect as non-requirement',
    checkFor: [
      'Intent: other',
      'hasRequirements: false (early return)',
      'Default message returned'
    ]
  }
];

testScenarios.forEach((scenario, idx) => {
  console.log(`\nScenario ${idx + 1}: "${scenario.input}"`);
  console.log(`  Expected: ${scenario.expected}`);
  console.log('  Check for:');
  scenario.checkFor.forEach(check => {
    console.log(`    - ${check}`);
  });
});

// Expected log flow for working case
console.log('\n' + '='.repeat(80));
console.log('📋 EXPECTED LOG FLOW (Working Case)');
console.log('='.repeat(80));

console.log(`
Input: "I need an Intel Core i7 processor"

Expected logs:
  [DEBUG] 🔵 processChatMessage called
  [DEBUG] useSemanticMatching: true
  [DEBUG] semanticIntegration exists: true
  [DEBUG] 🟢 SemanticIntegration.processMessage called
  [DEBUG] Message: I need an Intel Core i7 processor
  [DEBUG] 🟡 SemanticMatcher.parseMessage called
  [DEBUG] Message: I need an Intel Core i7 processor
  [DEBUG] Intent detected: requirement
  [DEBUG] Requires response: false
  [DEBUG] Extractions found: 1
  [DEBUG]   - processor : Intel Core i7
  [DEBUG] UC1 mapping complete
  [DEBUG]   - Candidates: 1
  [DEBUG] ⭐ hasRequirements: true
  [DEBUG] Mapped extractions: 1
  [DEBUG] Converting to form updates
  [DEBUG] Extractions: 1
  [DEBUG] hasRequirements: true
  [DEBUG] Field mapping for spc001 : { section: 'compute_performance', field: 'processor_type' }

Result: Form updates with processor value
`);

// Expected log flow for failing case
console.log('\n' + '='.repeat(80));
console.log('📋 EXPECTED LOG FLOW (Failing Case)');
console.log('='.repeat(80));

console.log(`
Input: "budget friendly option"

Expected logs:
  [DEBUG] 🔵 processChatMessage called
  [DEBUG] useSemanticMatching: true
  [DEBUG] semanticIntegration exists: true
  [DEBUG] 🟢 SemanticIntegration.processMessage called
  [DEBUG] Message: budget friendly option
  [DEBUG] 🟡 SemanticMatcher.parseMessage called
  [DEBUG] Message: budget friendly option
  [DEBUG] Intent detected: other  ← NO requirement pattern match
  [DEBUG] ⭐ hasRequirements: false  ← Early return, no extraction attempted
  [DEBUG] 🔴 Returning default message (no requirements detected)

Result: "I'm ready to help you fill out your technical requirements..."
`);

// Analysis script
console.log('\n' + '='.repeat(80));
console.log('🔬 AUTOMATED ANALYSIS');
console.log('='.repeat(80));

// Check if semantic matcher has LLM integration
const semanticMatcherPath = path.join(__dirname, 'src', 'services', 'respec', 'semantic', 'SemanticMatcher.ts');
const matcherContent = fs.readFileSync(semanticMatcherPath, 'utf8');

const hasLLMTodo = matcherContent.includes('TODO: Add LLM-based extraction');

if (hasLLMTodo) {
  console.log('\n❌ CONFIRMED: LLM extraction NOT implemented');
  console.log('   Found: "TODO: Add LLM-based extraction" in SemanticMatcher.ts');
  console.log('   Impact: Only pattern matching is used');
  console.log('   Fix needed: Implement LLM-based extraction to replace pattern fallback');
} else {
  console.log('\n✅ LLM extraction appears to be implemented');
  console.log('   Next: Verify LLM is actually being called');
}

// Check anthropic service usage
const anthropicPath = path.join(__dirname, 'src', 'services', 'respec', 'AnthropicService.ts');
const anthropicContent = fs.readFileSync(anthropicPath, 'utf8');

const hasAPICall = anthropicContent.includes('await this.client.messages.create');

if (hasAPICall) {
  console.log('\n✅ AnthropicService has API call implementation');
  console.log('   Next: Verify it\'s being called from SemanticMatcher');
} else {
  console.log('\n❌ No API call found in AnthropicService');
}

// Final recommendation
console.log('\n' + '='.repeat(80));
console.log('🎯 RECOMMENDED ACTION PLAN');
console.log('='.repeat(80));

console.log('\n1. Run: node test-llm-api-connection.cjs');
console.log('   → Verify Anthropic API is accessible and working');

console.log('\n2. Add logging code (above) to trace execution');
console.log('   → Identify exact point where flow breaks');

console.log('\n3. Run: node test-pattern-extraction-coverage.cjs');
console.log('   → Understand pattern matching limitations');

console.log('\n4. Test in browser with logging enabled');
console.log('   → Send test messages and analyze [DEBUG] logs');

console.log('\n5. Implement LLM-based extraction in SemanticMatcher');
console.log('   → Replace pattern-only approach with LLM fallback');

console.log('\n' + '='.repeat(80));
console.log('✅ DIAGNOSTIC SCRIPT COMPLETE');
console.log('='.repeat(80));
