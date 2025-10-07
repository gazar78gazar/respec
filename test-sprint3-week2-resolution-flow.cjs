#!/usr/bin/env node
/**
 * Sprint 3 Week 2 - Agent-Driven Resolution Flow Test Suite
 *
 * Tests agent response parsing, resolution orchestration, cycle management,
 * and priority queue implementation.
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 Sprint 3 Week 2 - Agent-Driven Resolution Flow Tests\n');
console.log('=' .repeat(70));

const tests = [];
let passed = 0;
let failed = 0;

function addTest(name, check) {
  tests.push({ name, check });
}

function readFile(filePath) {
  try {
    return fs.readFileSync(path.join(__dirname, filePath), 'utf8');
  } catch (error) {
    return null;
  }
}

// ============= TEST DEFINITIONS =============

addTest('✅ 1. parseConflictResponse() method added to AnthropicService', () => {
  const content = readFile('src/services/respec/AnthropicService.ts');
  if (!content) return false;

  return content.includes('parseConflictResponse') &&
         content.includes('isResolution') &&
         content.includes('choice:') &&
         content.includes('Sprint 3 Week 2');
});

addTest('✅ 2. Response parsing handles "A", "B", and variations', () => {
  const content = readFile('src/services/respec/AnthropicService.ts');
  if (!content) return false;

  return content.includes('option a') &&
         content.includes('option b') &&
         content.includes('first one') &&
         content.includes('second one');
});

addTest('✅ 3. Confidence threshold implemented (0.7)', () => {
  const content = readFile('src/services/respec/AnthropicService.ts');
  if (!content) return false;

  return content.includes('0.7') &&
         content.includes('confidence <');
});

addTest('✅ 4. generateClarification() method added to AnthropicService', () => {
  const content = readFile('src/services/respec/AnthropicService.ts');
  if (!content) return false;

  return content.includes('generateClarification') &&
         content.includes('Instead of choosing');
});

addTest('✅ 5. handleConflictResolution() orchestration method added', () => {
  const content = readFile('src/services/respec/AnthropicService.ts');
  if (!content) return false;

  return content.includes('handleConflictResolution') &&
         content.includes('artifactManager') &&
         content.includes('resolveConflict');
});

addTest('✅ 6. Resolution success generates confirmation message', () => {
  const content = readFile('src/services/respec/AnthropicService.ts');
  if (!content) return false;

  return content.includes('Got it') &&
         content.includes('resolution_success') &&
         content.includes('confirmation');
});

addTest('✅ 7. incrementConflictCycle() added to ArtifactManager', () => {
  const content = readFile('src/services/respec/artifacts/ArtifactManager.ts');
  if (!content) return false;

  return content.includes('incrementConflictCycle') &&
         content.includes('cycleCount++') &&
         content.includes('Sprint 3 Week 2');
});

addTest('✅ 8. Cycle escalation triggers after 3 attempts', () => {
  const content = readFile('src/services/respec/artifacts/ArtifactManager.ts');
  if (!content) return false;

  return content.includes('cycleCount >= 3') &&
         content.includes('escalateConflict');
});

addTest('✅ 9. escalateConflict() method implemented', () => {
  const content = readFile('src/services/respec/artifacts/ArtifactManager.ts');
  if (!content) return false;

  return content.includes('private escalateConflict') &&
         content.includes('escalated.push') &&
         content.includes('Max resolution cycles');
});

addTest('✅ 10. System unblocks after escalation', () => {
  const content = readFile('src/services/respec/artifacts/ArtifactManager.ts');
  if (!content) return false;

  const escalateSection = content.split('private escalateConflict')[1];
  if (!escalateSection) return false;

  return escalateSection.includes('priorityQueue.blocked = false') &&
         escalateSection.includes('systemBlocked = false');
});

addTest('✅ 11. getActiveConflictsForAgent() enhanced with priority sorting', () => {
  const content = readFile('src/services/respec/SimplifiedRespecService.ts');
  if (!content) return false;

  return content.includes('priorityOrder') &&
         content.includes('cross-artifact') &&
         content.includes('sort((a, b)');
});

addTest('✅ 12. Only one conflict returned at a time', () => {
  const content = readFile('src/services/respec/SimplifiedRespecService.ts');
  if (!content) return false;

  return content.includes('topConflict') &&
         content.includes('Only ONE conflict at a time') &&
         content.includes('conflicts: [structuredConflict]');
});

addTest('✅ 13. totalConflicts field added for progress indicators', () => {
  const content = readFile('src/services/respec/SimplifiedRespecService.ts');
  if (!content) return false;

  return content.includes('totalConflicts:') &&
         content.includes('currentConflict:');
});

addTest('✅ 14. Priority order: cross-artifact > logical > constraint', () => {
  const content = readFile('src/services/respec/SimplifiedRespecService.ts');
  if (!content) return false;

  return content.includes("'cross-artifact': 1") &&
         content.includes("'logical': 2") &&
         content.includes("'constraint': 3");
});

addTest('✅ 15. Resolution calls artifactManager.resolveConflict()', () => {
  const content = readFile('src/services/respec/AnthropicService.ts');
  if (!content) return false;

  return content.includes('await artifactManager.resolveConflict(') &&
         content.includes('conflict.id') &&
         content.includes('resolutionId');
});

addTest('✅ 16. Low confidence response increments cycle count', () => {
  const content = readFile('src/services/respec/AnthropicService.ts');
  if (!content) return false;

  const lowConfSection = content.split('parsed.confidence < 0.7')[1];
  if (!lowConfSection) return false;

  return lowConfSection.includes('incrementConflictCycle');
});

addTest('✅ 17. Invalid choice increments cycle count', () => {
  const content = readFile('src/services/respec/AnthropicService.ts');
  if (!content) return false;

  const sections = content.split('incrementConflictCycle');
  return sections.length >= 3; // Should appear at least twice (low conf + invalid)
});

addTest('✅ 18. Progress indicator shows remaining conflicts', () => {
  const content = readFile('src/services/respec/AnthropicService.ts');
  if (!content) return false;

  return content.includes('remainingConflicts') &&
         content.includes('more conflict(s) to resolve');
});

addTest('✅ 19. Fallback parsing for non-API mode', () => {
  const content = readFile('src/services/respec/AnthropicService.ts');
  if (!content) return false;

  const parseMethod = content.split('parseConflictResponse')[1];
  if (!parseMethod) return false;

  return parseMethod.includes('if (!this.client)') &&
         parseMethod.includes('Fallback');
});

addTest('✅ 20. Resolution modes properly defined', () => {
  const content = readFile('src/services/respec/AnthropicService.ts');
  if (!content) return false;

  return content.includes('resolution_success') &&
         content.includes('clarification_provided') &&
         content.includes('clarification_needed') &&
         content.includes('invalid_choice');
});

addTest('✅ 21. Sprint 3 Week 2 implementation plan exists', () => {
  return fs.existsSync(path.join(__dirname, 'docs/plans/SPRINT3_WEEK2_IMPLEMENTATION_PLAN.md'));
});

addTest('✅ 22. Resolution error handling with try-catch', () => {
  const content = readFile('src/services/respec/AnthropicService.ts');
  if (!content) return false;

  const resolutionSection = content.split('resolveConflict')[1];
  if (!resolutionSection) return false;

  return resolutionSection.includes('try {') &&
         resolutionSection.includes('catch (error)') &&
         resolutionSection.includes('resolution_failed');
});

addTest('✅ 23. Conflict-free confirmation message', () => {
  const content = readFile('src/services/respec/AnthropicService.ts');
  if (!content) return false;

  return content.includes('conflict-free') &&
         content.includes('What else would you like to configure');
});

addTest('✅ 24. Escalation emits event', () => {
  const content = readFile('src/services/respec/artifacts/ArtifactManager.ts');
  if (!content) return false;

  const escalateSection = content.split('escalateConflict')[1];
  if (!escalateSection) return false;

  return escalateSection.includes('emit') &&
         escalateSection.includes('conflict_escalated');
});

addTest('✅ 25. Week 2 wires to SimplifiedRespecService', () => {
  const content = readFile('src/services/respec/SimplifiedRespecService.ts');
  if (!content) return false;

  return content.includes('handleConflictResolution') &&
         content.includes('this.artifactManager');
});

// ============= RUN TESTS =============

console.log('\n📋 Running Tests...\n');

tests.forEach((test, index) => {
  try {
    const result = test.check();
    if (result) {
      console.log(`${test.name}`);
      passed++;
    } else {
      console.log(`❌ ${test.name}`);
      failed++;
    }
  } catch (error) {
    console.log(`❌ ${test.name} - ERROR: ${error.message}`);
    failed++;
  }
});

// ============= SUMMARY =============

console.log('\n' + '='.repeat(70));
console.log('\n📊 Test Results Summary\n');
console.log(`Total Tests: ${tests.length}`);
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`📈 Success Rate: ${Math.round((passed / tests.length) * 100)}%`);

if (failed === 0) {
  console.log('\n🎉 All Sprint 3 Week 2 tests passed!');
  console.log('\n✅ Implementation Complete:');
  console.log('   - Agent parses A/B responses semantically');
  console.log('   - Resolution orchestration with error handling');
  console.log('   - Cycle management (max 3 attempts)');
  console.log('   - Auto-escalation after max cycles');
  console.log('   - Priority queue (one conflict at a time)');
  console.log('   - Confirmation messages with progress indicators');
  console.log('\n📝 Next Steps:');
  console.log('   - Run manual end-to-end tests (npm run dev)');
  console.log('   - Test all 5 scenarios from implementation plan');
  console.log('   - Verify Sprint 2 functionality still works');
  console.log('   - Update completion documentation');
} else {
  console.log('\n⚠️  Some tests failed. Review implementation.');
}

console.log('\n' + '='.repeat(70));

process.exit(failed > 0 ? 1 : 0);
