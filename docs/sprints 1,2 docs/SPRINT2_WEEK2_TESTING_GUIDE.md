# Sprint 2 Week 2 - Testing Guide
**Date**: October 3, 2025
**Purpose**: Validate Sprint 2 Week 2 artifact management implementation

---

## 📋 **Test Scripts Overview**

I've created **2 comprehensive test scripts** for Sprint 2 Week 2:

### **Test 1: Artifact Population Validation**
**File**: `test-sprint2-week2-artifact-population.cjs`
**Purpose**: Structural code validation
**Tests**: 40+ tests across 10 categories

### **Test 2: Runtime Flow Validation**
**File**: `test-sprint2-week2-runtime-flow.cjs`
**Purpose**: Logic and behavior validation
**Tests**: 35+ tests across 7 categories

---

## 🧪 **Test 1: Artifact Population Validation**

**What it tests**:
✅ ArtifactManager methods exist and are used
✅ SemanticIntegrationService_NEW has correct routing
✅ Specification/Requirement/Domain handlers implemented
✅ Factory function updated with ArtifactManager
✅ SimplifiedRespecService wiring correct
✅ Error handling present
✅ Logging quality
✅ Switch statement routing logic

**Run it**:
```bash
node test-sprint2-week2-artifact-population.cjs
```

**Expected output**:
```
================================================================================
TEST 1: ArtifactManager Methods Exist
================================================================================
✓ ArtifactManager has addSpecificationToMapped method
✓ ArtifactManager has detectConflicts method
✓ ArtifactManager has moveNonConflictingToRespec method
✓ ArtifactManager maintains hierarchical structure

... (40+ more tests)

================================================================================
TEST RESULTS
================================================================================

Total Tests: 45
Passed: 45
Failed: 0

Critical Tests: 25
Critical Passed: 25

✓ ALL TESTS PASSED
Sprint 2 Week 2 artifact population implementation is structurally complete!
```

---

## 🧪 **Test 2: Runtime Flow Validation**

**What it tests**:
✅ Correct method call sequences
✅ Conflict detection conditional logic
✅ Value passing and transformations
✅ Nested iteration for requirements/domains
✅ Error handling resilience
✅ Defensive programming (null checks)
✅ Data integrity (correct parameters passed)

**Run it**:
```bash
node test-sprint2-week2-runtime-flow.cjs
```

**Expected output**:
```
================================================================================
TEST 1: Specification Handling - Method Call Sequence
================================================================================
✓ Step 1: Gets UC1 specification first
✓ Step 2: Adds to mapped artifact with correct parameters
✓ Step 3: Triggers conflict detection after adding
✓ Step 4: Checks conflict result before moving
✓ Step 5: Moves to respec only if no conflicts

... (35+ more tests)

================================================================================
TEST RESULTS
================================================================================

Total Tests: 37
Passed: 37
Failed: 0

Critical Tests: 18
Critical Passed: 18

✓ ALL RUNTIME FLOW TESTS PASSED
Sprint 2 Week 2 runtime logic is correctly implemented!
```

---

## ✅ **What Each Test Validates**

### **Test 1 Categories**:

#### **1. ArtifactManager Methods Exist** (4 tests, all critical)
- Verifies `addSpecificationToMapped()` exists
- Verifies `detectConflicts()` exists
- Verifies `moveNonConflictingToRespec()` exists
- Verifies hierarchical structure maintained

#### **2. SemanticIntegrationService_NEW Routing** (6 tests, all critical)
- ArtifactManager imported
- artifactManager property exists
- Constructor accepts artifactManager
- Handler methods exist (specification/requirement/domain)

#### **3. Specification Handling Implementation** (5 tests, 3 critical)
- Calls addSpecificationToMapped
- Triggers conflict detection
- Moves to respec if no conflicts
- Checks conflict result properly
- Logs conflict detection

#### **4. Requirement Handling Implementation** (3 tests, all critical)
- Gets child specifications
- Adds all child specs to mapped
- Triggers conflict detection

#### **5. Domain Handling Implementation** (3 tests, all critical)
- Gets child requirements
- Iterates through requirements and specs
- Triggers conflict detection

#### **6. Factory Function Integration** (2 tests, all critical)
- Accepts artifactManager parameter
- Passes artifactManager to constructor

#### **7. SimplifiedRespecService Integration** (2 tests, 1 critical)
- Passes artifactManager to factory
- Imports correctly

#### **8. Error Handling** (4 tests)
- Try/catch blocks present
- Console.error logging exists

#### **9. Logging & Observability** (3 tests)
- Detailed logs for specifications
- Detailed logs for requirements
- Detailed logs for domains

#### **10. Routing Switch Statement** (4 tests, 3 critical)
- Switch statement exists
- Routes specifications correctly
- Routes requirements correctly
- Routes domains correctly
- Has default case for unknown types

---

### **Test 2 Categories**:

#### **1. Specification Flow Sequence** (5 tests, all critical)
- Gets UC1 spec first
- Adds to mapped with correct parameters
- Triggers conflict detection after adding
- Checks conflict result before moving
- Moves to respec only if no conflicts

#### **2. Conflict Branching Logic** (3 tests, 1 critical)
- Separate paths for conflict vs no-conflict
- Different log messages
- Only moves when no conflicts

#### **3. Requirement Handling Logic** (5 tests, 3 critical)
- Gets child specifications
- Validates child specs exist
- Iterates through all children
- Adds each child to mapped
- Uses default values when needed

#### **4. Domain Handling Logic** (4 tests, all critical)
- Gets child requirements
- Has nested loops
- Gets specifications for each requirement
- Adds all specifications from all requirements

#### **5. Error Handling Resilience** (4 tests)
- Error logging exists
- Errors include context
- Null/undefined checks present
- Returns early when spec not found

#### **6. ArtifactManager Availability** (2 tests, 1 critical)
- Checks if artifactManager exists
- Has fallback when missing

#### **7. Value Transformation** (4 tests, 2 critical)
- Passes UC1 spec object (not just ID)
- Passes actual value
- Passes extraction context
- Passes match rationale

---

## 🎯 **Expected Test Results**

### **If Implementation is Correct**:
- ✅ Test 1: 45/45 passed (25/25 critical)
- ✅ Test 2: 37/37 passed (18/18 critical)
- ✅ Both scripts exit with code 0

### **If Minor Issues**:
- ⚠️ Critical tests pass, some non-critical fail
- ⚠️ Scripts exit with code 0 (warnings shown)
- ⚠️ Core functionality OK, best practices not fully followed

### **If Critical Issues**:
- ❌ Critical tests fail
- ❌ Scripts exit with code 1
- ❌ Implementation has blocking issues

---

## 🔧 **How to Run All Tests**

### **Option 1: Run Both Tests Sequentially**:
```bash
node test-sprint2-week2-artifact-population.cjs && node test-sprint2-week2-runtime-flow.cjs
```

### **Option 2: Run Week 1 + Week 2 Tests Together**:
```bash
# Week 1 tests
node test-sprint1-week3-integration.cjs

# Week 2 tests
node test-sprint2-week2-artifact-population.cjs
node test-sprint2-week2-runtime-flow.cjs
```

### **Option 3: Add to package.json**:
```json
{
  "scripts": {
    "test:week2": "node test-sprint2-week2-artifact-population.cjs && node test-sprint2-week2-runtime-flow.cjs",
    "test:sprint2": "npm run test:week1 && npm run test:week2"
  }
}
```

---

## 📊 **What Tests DON'T Cover**

These tests validate **code structure and logic**, but NOT:

❌ **Runtime execution** (requires running app)
❌ **LLM API calls** (requires actual Anthropic API)
❌ **Browser UI updates** (requires live browser)
❌ **User interaction flows** (requires manual testing)

For those, you need **manual testing** with the scenarios in `SPRINT2_WEEK2_COMPLETION.md`.

---

## 🧪 **Manual Testing Scenarios**

After test scripts pass, run these manual tests:

### **Scenario 1: Simple Specification (No Conflict)**
```
1. Start dev server: npm run dev
2. Enter: "I need Intel Core i7 processor"
3. Check console for:
   - [Route] 🎯 SPECIFICATION: spc001 = Intel Core i7
   - [ArtifactManager] Added specification spc001 to mapped artifact
   - [ConflictDetection] 🔍 Detected 0 conflicts
   - [Route] ✅ No conflicts - moving non-conflicting specs to respec
4. Check form: processor_type = "Intel Core i7"
```

### **Scenario 2: Multiple Specifications**
```
1. Refresh page
2. Enter: "I need Intel Core i7, 16GB RAM, 512GB SSD"
3. Check console for 4 specifications added
4. Check console for 0 conflicts detected
5. Check console for 4 specs moved to respec
6. Check form: All 4 fields populated
```

### **Scenario 3: Conflict Detection**
```
1. Refresh page
2. Enter: "I need high performance Intel Core i9 with only 15W power"
3. Check console for:
   - 2 specifications added (spc001, spc005)
   - 1 conflict detected
   - Holding in mapped (not moving to respec)
4. Check form: NO updates (waiting for resolution)
5. Check console for system blocked = true
```

---

## ✅ **Test Checklist**

### **Automated Tests** (run first):
- [ ] Run `test-sprint2-week2-artifact-population.cjs`
  - [ ] All 45 tests pass
  - [ ] All 25 critical tests pass
- [ ] Run `test-sprint2-week2-runtime-flow.cjs`
  - [ ] All 37 tests pass
  - [ ] All 18 critical tests pass

### **Manual Tests** (run after automated tests pass):
- [ ] Scenario 1: Simple specification works
- [ ] Scenario 2: Multiple specifications work
- [ ] Scenario 3: Conflict detection blocks properly

### **Integration Tests** (optional):
- [ ] Week 1 functionality still works
- [ ] Form updates still display correctly
- [ ] Conversation context still maintained
- [ ] Value selection still works

---

## 🎯 **Success Criteria**

Sprint 2 Week 2 is **COMPLETE** when:

✅ Both test scripts pass (82 total tests)
✅ All 43 critical tests pass
✅ Manual Scenario 1-3 work as expected
✅ Week 1 functionality unchanged

---

## 📝 **Test Script Details**

### **Test Coverage**:
| Category | Test 1 | Test 2 | Total |
|----------|--------|--------|-------|
| Critical Tests | 25 | 18 | 43 |
| Non-Critical | 20 | 19 | 39 |
| **Total** | **45** | **37** | **82** |

### **Test Types**:
- **Structural**: Verifies code exists
- **Logical**: Verifies correct behavior
- **Sequential**: Verifies method call order
- **Conditional**: Verifies branching logic
- **Defensive**: Verifies error handling

### **Coverage Areas**:
- ✅ ArtifactManager integration
- ✅ Routing implementation
- ✅ Conflict detection logic
- ✅ Error handling
- ✅ Value passing
- ✅ Logging quality

---

## 🚀 **Next Steps After Tests Pass**

1. ✅ Commit Sprint 2 Week 2 implementation
2. ✅ Update Sprint 2 status documentation
3. ✅ Move to Sprint 3 Week 1 (Conflict Resolution UI)

---

**Testing Guide Created**: October 3, 2025
**Test Scripts**: 2 scripts, 82 total tests, 43 critical
**Estimated Test Time**: ~5 seconds (automated) + ~5 minutes (manual)
