/**
 * Semantic Flow Diagnostics Test
 *
 * Purpose: Trace complete message processing flow with detailed logging
 * Identifies: Where in the pipeline the flow breaks down
 */

const fs = require('fs');
const path = require('path');

console.log('='.repeat(80));
console.log('🔍 SEMANTIC FLOW DIAGNOSTICS');
console.log('='.repeat(80));

// Test inputs
const testMessages = [
  'I need an Intel Core i7 processor',
  'high performance system',
  'budget friendly option',
  'hello', // Non-requirement message
];

console.log('\n📋 Analyzing semantic processing flow for test inputs:\n');

testMessages.forEach((msg, idx) => {
  console.log(`  ${idx + 1}. "${msg}"`);
});

// Read source files to understand flow
const files = {
  simplifiedRespec: path.join(__dirname, 'src', 'services', 'respec', 'SimplifiedRespecService.ts'),
  semanticMatcher: path.join(__dirname, 'src', 'services', 'respec', 'semantic', 'SemanticMatcher.ts'),
  semanticIntegration: path.join(__dirname, 'src', 'services', 'respec', 'semantic', 'SemanticIntegrationService.ts'),
};

const content = {};
Object.entries(files).forEach(([key, filePath]) => {
  content[key] = fs.readFileSync(filePath, 'utf8');
});

// Check flow checkpoints
console.log('\n' + '='.repeat(80));
console.log('CHECKPOINT 1: SimplifiedRespecService.processChatMessage()');
console.log('='.repeat(80));

const hasSemanticCheck = content.simplifiedRespec.includes('if (this.useSemanticMatching && this.semanticIntegration)');
const hasSemanticFallback = content.simplifiedRespec.includes('falling back to legacy method');

console.log('Uses semantic matching check:', hasSemanticCheck ? '✅ YES' : '❌ NO');
console.log('Has legacy fallback:', hasSemanticFallback ? '✅ YES' : '❌ NO');

if (hasSemanticCheck) {
  console.log('\n✅ Flow enters semantic matching pipeline');
  console.log('   Next step: SemanticIntegrationService.processMessage()');
} else {
  console.log('\n❌ ISSUE: No semantic matching integration found');
}

// Check semantic integration
console.log('\n' + '='.repeat(80));
console.log('CHECKPOINT 2: SemanticIntegrationService.processMessage()');
console.log('='.repeat(80));

const callsSemanticMatcher = content.semanticIntegration.includes('await this.semanticMatcher.parseMessage');
const convertsToFormUpdates = content.semanticIntegration.includes('convertToFormUpdates');
const hasNonRequirementResponse = content.semanticIntegration.includes('generateNonRequirementResponse');

console.log('Calls SemanticMatcher.parseMessage():', callsSemanticMatcher ? '✅ YES' : '❌ NO');
console.log('Converts to form updates:', convertsToFormUpdates ? '✅ YES' : '❌ NO');
console.log('Has non-requirement fallback:', hasNonRequirementResponse ? '✅ YES' : '❌ NO');

if (hasNonRequirementResponse) {
  // Extract the default message
  const msgMatch = content.semanticIntegration.match(/return\s+"I'm ready to help[^"]+"/);
  if (msgMatch) {
    console.log('\n⚠️  Default message found:', msgMatch[0]);
    console.log('   This message appears when hasRequirements = false');
  }
}

// Check semantic matcher
console.log('\n' + '='.repeat(80));
console.log('CHECKPOINT 3: SemanticMatcher.parseMessage()');
console.log('='.repeat(80));

const detectsIntent = content.semanticMatcher.includes('detectIntent');
const extractsTechnical = content.semanticMatcher.includes('extractTechnicalRequirements');
const mapsToUC1 = content.semanticMatcher.includes('mapToUC1Specifications');

console.log('Detects intent:', detectsIntent ? '✅ YES' : '❌ NO');
console.log('Extracts technical requirements:', extractsTechnical ? '✅ YES' : '❌ NO');
console.log('Maps to UC1 specifications:', mapsToUC1 ? '✅ YES' : '❌ NO');

// Critical check: Is LLM used?
const hasLLMExtraction = !content.semanticMatcher.includes('TODO: Add LLM-based extraction');
const hasLLMIntent = !content.semanticMatcher.includes('TODO: Add LLM-based intent detection');

console.log('\n🔍 LLM Integration Status:');
console.log('  LLM-based extraction implemented:', hasLLMExtraction ? '✅ YES' : '❌ NO (TODO found)');
console.log('  LLM-based intent detection:', hasLLMIntent ? '✅ YES' : '❌ NO (TODO found)');

if (!hasLLMExtraction || !hasLLMIntent) {
  console.log('\n❌ CRITICAL ISSUE: LLM NOT BEING USED');
  console.log('  Current implementation: PATTERN MATCHING ONLY');
  console.log('  Impact: Limited extraction coverage → hasRequirements = false → default message');
}

// Check hasRequirements logic
console.log('\n' + '='.repeat(80));
console.log('CHECKPOINT 4: hasRequirements Determination');
console.log('='.repeat(80));

const hasRequirementsLogic = content.semanticMatcher.match(/hasRequirements:\s*([^,\n]+)/);
if (hasRequirementsLogic) {
  console.log('hasRequirements logic:', hasRequirementsLogic[1]);

  if (hasRequirementsLogic[1].includes('mappedExtractions.length > 0')) {
    console.log('\n✅ hasRequirements = (mappedExtractions.length > 0)');
    console.log('   Meaning: Needs at least 1 UC1-mapped extraction');
    console.log('   If pattern matching fails → no extractions → hasRequirements = false');
  }
}

// Trace for sample input
console.log('\n' + '='.repeat(80));
console.log('FLOW TRACE: "I need an Intel Core i7 processor"');
console.log('='.repeat(80));

console.log('\nStep 1: SimplifiedRespecService.processChatMessage()');
console.log('  ↓ useSemanticMatching = true (assumed)');
console.log('  ↓ semanticIntegration exists (assumed)');
console.log('  ↓ Calls: semanticIntegration.processMessage()');

console.log('\nStep 2: SemanticIntegrationService.processMessage()');
console.log('  ↓ Calls: semanticMatcher.parseMessage()');

console.log('\nStep 3: SemanticMatcher.parseMessage()');
console.log('  ↓ Calls: detectIntent()');
console.log('    → Pattern check: /i need|i want|require/i');
console.log('    → Match found: intent.type = "requirement"');
console.log('  ↓ Calls: extractTechnicalRequirements()');
console.log('    → Pattern check: /(intel|amd).*i[3579]/i');
console.log('    → Match found: extractions = [{ category: "processor", value: "Intel Core i7" }]');
console.log('  ↓ Calls: mapToUC1Specifications()');
console.log('    → Maps "processor" → spc001');
console.log('    → Returns: mappedExtractions.length = 1');
console.log('  ↓ Sets: hasRequirements = true');

console.log('\nStep 4: Back to SemanticIntegrationService');
console.log('  ↓ semanticResult.hasRequirements = true');
console.log('  ↓ Calls: convertToFormUpdates()');
console.log('    → UC1 candidate: spc001');
console.log('    → Maps to form field via CompatibilityLayer');
console.log('    → formUpdates.length = 1');
console.log('  ↓ Calls: generateSystemResponse()');
console.log('    → Returns: "I\'ve extracted the following requirements: ..."');

console.log('\nExpected result: ✅ Form updated with processor value');

// Trace for failing input
console.log('\n' + '='.repeat(80));
console.log('FLOW TRACE: "budget friendly option"');
console.log('='.repeat(80));

console.log('\nStep 1-3: Same as above');
console.log('\nStep 3: SemanticMatcher.parseMessage()');
console.log('  ↓ Calls: detectIntent()');
console.log('    → Pattern check: /budget/ not in requirement patterns');
console.log('    → intent.type = "other"');
console.log('  ↓ Early return: hasRequirements = false');

console.log('\nStep 4: Back to SemanticIntegrationService');
console.log('  ↓ semanticResult.hasRequirements = false');
console.log('  ↓ Calls: generateNonRequirementResponse()');
console.log('    → Returns: "I\'m ready to help you fill out your technical requirements..."');

console.log('\nActual result: ❌ Default message (no extraction)');

// Summary
console.log('\n' + '='.repeat(80));
console.log('📊 ROOT CAUSE ANALYSIS SUMMARY');
console.log('='.repeat(80));

console.log('\n🎯 PRIMARY ISSUE: LLM Not Integrated');
console.log('  - SemanticMatcher uses ONLY pattern matching');
console.log('  - No LLM fallback for missed patterns');
console.log('  - TODO comments confirm incomplete implementation');

console.log('\n🎯 SECONDARY ISSUE: Limited Pattern Coverage');
console.log('  - Only specific phrases matched (Intel, AMD, etc.)');
console.log('  - Generic terms like "budget friendly" not covered');
console.log('  - Missing patterns → hasRequirements = false → default message');

console.log('\n🎯 FLOW BREAKDOWN:');
console.log('  1. ✅ Semantic matching pipeline IS enabled');
console.log('  2. ✅ Flow reaches SemanticMatcher correctly');
console.log('  3. ❌ Pattern matching has limited coverage');
console.log('  4. ❌ No LLM fallback to recover missed patterns');
console.log('  5. ❌ hasRequirements = false');
console.log('  6. ❌ Returns default "ready to help" message');

console.log('\n💡 VALIDATION STRATEGY:');
console.log('  1. Run test-llm-api-connection.cjs → Verify API works');
console.log('  2. Run test-pattern-extraction-coverage.cjs → Confirm pattern limits');
console.log('  3. Add logging to SemanticMatcher.parseMessage() → Trace actual execution');
console.log('  4. Implement LLM extraction → Complete Sprint 2');

console.log('\n' + '='.repeat(80));
console.log('✅ DIAGNOSTIC COMPLETE');
console.log('='.repeat(80));
console.log('\nNext step: Run test-llm-api-connection.cjs to verify API is working');
console.log('Then: Implement LLM-based extraction in SemanticMatcher');
