/**
 * Pattern Extraction Coverage Test
 *
 * Purpose: Test SemanticMatcher pattern-based extraction coverage
 * Validates: What types of inputs are successfully extracted vs missed
 */

const fs = require('fs');
const path = require('path');

console.log('='.repeat(80));
console.log('🔍 PATTERN EXTRACTION COVERAGE TEST');
console.log('='.repeat(80));

// Read SemanticMatcher.ts to extract patterns
const semanticMatcherPath = path.join(__dirname, 'src', 'services', 'respec', 'semantic', 'SemanticMatcher.ts');
const matcherContent = fs.readFileSync(semanticMatcherPath, 'utf8');

console.log('\n📋 Analyzing SemanticMatcher pattern coverage...\n');

// Test cases covering various user input types
const testCases = [
  {
    category: 'Processor',
    inputs: [
      'I need an Intel Core i7',
      'AMD Ryzen processor required',
      'fast CPU for processing',
      'high performance processor',
      'processor: Intel',
      'need powerful processing', // Expected to fail - too vague
      'Core i9 system', // Expected to work
    ]
  },
  {
    category: 'Memory',
    inputs: [
      'I need 16GB RAM',
      '32GB of memory',
      'need lots of memory', // Vague - should work per pattern
      'memory: 8GB',
      '4GB', // Too short - might fail
      'need more RAM', // Vague - should work per pattern
    ]
  },
  {
    category: 'Power',
    inputs: [
      'under 10W power consumption',
      '< 20W',
      'low power system',
      'high performance setup', // Should match performance pattern
      'battery optimized',
      'needs to run on battery', // Might miss - not exact pattern
    ]
  },
  {
    category: 'Storage',
    inputs: [
      '512GB SSD',
      '1TB storage',
      'need fast storage',
      'solid state drive',
      '256GB hard drive', // Should work
      'lots of disk space', // Too vague - might miss
    ]
  },
  {
    category: 'Performance',
    inputs: [
      'high performance system',
      'fast response time',
      'low latency required',
      'quick processing',
      'responsive UI', // Might miss
      'real-time processing', // Might miss
    ]
  },
  {
    category: 'Budget/Business (not in patterns)',
    inputs: [
      'budget friendly',
      'cost effective solution',
      'under $500',
      'quantity: 10 units',
      'need 5 devices', // Likely to miss
    ]
  }
];

// Extract patterns from SemanticMatcher
const patterns = {
  processor: /\/\(intel\|amd\).*\/i/,
  memory: /\/\\d\+.*(?:gb|mb).*\/i/,
  power: /\/.*(?:under|<).*w|low power|high performance|battery.*\/i/,
  storage: /\/\\d\+.*(?:gb|tb)|ssd|hdd|fast.*storage|solid.*state\/i/,
  performance: /\/high performance|fast|low latency|quick|responsive\/i/
};

// Simulate pattern matching (simplified - actual patterns are more complex)
function testPatternMatch(input, category) {
  const categoryPatterns = {
    'Processor': [
      /(intel|amd)[\s-]*(core|ryzen)?[\s-]*(i[3579]|[0-9]+)?|fast\s*cpu/i
    ],
    'Memory': [
      /(\d+)\s*(gb|mb)\s*(?:ram|memory)?|(?:lots of|more)\s*(?:ram|memory)/i
    ],
    'Power': [
      /(under \d+w|<?\s*\d+w|low power|high performance|battery\s*optimized?)/i
    ],
    'Storage': [
      /(\d+\s*(?:gb|tb)|ssd|hdd|fast\s*storage|solid\s*state)/i
    ],
    'Performance': [
      /(high performance|fast|low latency|quick|responsive)/i
    ]
  };

  const patternsForCategory = categoryPatterns[category] || [];

  for (const pattern of patternsForCategory) {
    if (pattern.test(input)) {
      return { matched: true, pattern: pattern.toString() };
    }
  }

  return { matched: false, pattern: null };
}

// Run tests
console.log('Testing pattern extraction coverage:\n');

let totalTests = 0;
let passedTests = 0;
const failedCases = [];

testCases.forEach(testCase => {
  console.log(`\n${'─'.repeat(80)}`);
  console.log(`📦 ${testCase.category} Patterns`);
  console.log('─'.repeat(80));

  testCase.inputs.forEach(input => {
    totalTests++;
    const result = testPatternMatch(input, testCase.category);

    if (result.matched) {
      passedTests++;
      console.log(`✅ MATCH: "${input}"`);
      // console.log(`   Pattern: ${result.pattern}`);
    } else {
      failedCases.push({ category: testCase.category, input });
      console.log(`❌ MISS:  "${input}"`);
    }
  });
});

// Check if LLM fallback exists
console.log('\n' + '='.repeat(80));
console.log('🔍 LLM Fallback Analysis');
console.log('='.repeat(80));

const hasLLMFallback = matcherContent.includes('TODO: Add LLM-based extraction');
const hasLLMIntentFallback = matcherContent.includes('TODO: Add LLM-based intent detection');

if (hasLLMFallback || hasLLMIntentFallback) {
  console.log('⚠️  WARNING: LLM fallback NOT IMPLEMENTED');
  if (hasLLMFallback) {
    console.log('  - extractTechnicalRequirements() has TODO for LLM integration');
  }
  if (hasLLMIntentFallback) {
    console.log('  - detectIntent() has TODO for LLM integration');
  }
  console.log('\n  Current implementation: PATTERN MATCHING ONLY');
  console.log('  Impact: Missed patterns cannot be recovered by LLM');
} else {
  console.log('✅ LLM fallback appears to be implemented');
}

// Summary
console.log('\n' + '='.repeat(80));
console.log('📊 PATTERN COVERAGE SUMMARY');
console.log('='.repeat(80));

const coveragePercent = ((passedTests / totalTests) * 100).toFixed(1);

console.log(`Total test cases: ${totalTests}`);
console.log(`Matched by patterns: ${passedTests} (${coveragePercent}%)`);
console.log(`Missed by patterns: ${failedCases.length} (${(100 - parseFloat(coveragePercent)).toFixed(1)}%)`);

if (failedCases.length > 0) {
  console.log('\n❌ Missed Cases:');
  failedCases.forEach(fail => {
    console.log(`  [${fail.category}] "${fail.input}"`);
  });
}

console.log('\n' + '='.repeat(80));
console.log('💡 RECOMMENDATIONS');
console.log('='.repeat(80));

if (coveragePercent < 70) {
  console.log('❌ Pattern coverage is LOW (<70%)');
  console.log('  → Implement LLM-based extraction for better coverage');
  console.log('  → Many user inputs will return default "ready to help" message');
} else if (coveragePercent < 85) {
  console.log('⚠️  Pattern coverage is MODERATE (70-85%)');
  console.log('  → Consider implementing LLM fallback for missed cases');
} else {
  console.log('✅ Pattern coverage is GOOD (>85%)');
  console.log('  → Patterns handle most common cases');
  console.log('  → LLM integration would still improve semantic understanding');
}

if (hasLLMFallback) {
  console.log('\n🎯 CRITICAL FINDING:');
  console.log('  LLM extraction is NOT implemented (TODO comment found)');
  console.log('  This explains why system returns default message');
  console.log('  Fix: Implement LLM-based extraction in SemanticMatcher.ts');
}

console.log('='.repeat(80));
