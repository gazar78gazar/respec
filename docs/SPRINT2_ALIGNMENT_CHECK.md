# Sprint 2 Development - Alignment & Clarification Check
**Date**: October 1, 2025
**Current Status**: Ready to start Sprint 2 Week 1
**Purpose**: Verify alignment with PRD, PRD Addendum, Technical Specs before coding

---

## ✅ What I Understand (Verified)

### **Sprint 2 Goal**
Upgrade LLM to handle extraction AND UC1 semantic matching with confidence scoring

### **Current State (Verified)**
- ✅ Sprint 1 complete: Multi-artifact state, UC1 engine, CompatibilityLayer working
- ✅ API connection working: claude-sonnet-4-5-20250929 responding in 2.4s
- ✅ Semantic infrastructure built: SemanticMatcher, SemanticIntegrationService exist
- ❌ LLM extraction NOT implemented: Currently using pattern matching only (69.4% coverage)

### **Architecture Understanding (From PRD Addendum v2.0.1)**

**Processing Flow:**
```
EXTRACTED NODES → LLM MATCHING → CODE VALIDATION
```

**LLM Responsibilities (40% of operations):**
1. Extract technical specifications from natural language
2. Perform semantic matching to UC1 schema
3. Classify as domain, requirement, or specification
4. Provide confidence scores (0.0-1.0)

**Code Responsibilities (60% of operations):**
1. Validate LLM matches against UC1 constraints
2. Detect conflicts (mutex, dependencies, constraints)
3. Route nodes to appropriate artifacts
4. Manage state and priority queue

### **UC1 Schema Structure (Verified from uc1.json)**

**Hierarchy:**
- Use Case → 3 Domains → 15 Requirements → 56 Specifications

**Key Fields:**
- `dependencies`: Array of dependent requirements/specifications
- `technical_details`: Constraint validation parameters
- `form_mapping`: Maps spec ID to form fields (section, field_name, ui_type)
- `options`: Dropdown values for validation
- `parent`: Hierarchical relationships

**No Explicit Mutex Fields Found:**
- Conflicts must be detected through:
  - Technical_details parameter conflicts
  - Dependency validation
  - Logical business rules (e.g., high performance + low power)

### **Prompt Template (From Tech Spec Lines 80-131)**

**Required Format:**
```json
{
  "extractedAndMatched": [
    {
      "id": "generated_uuid",
      "extractedText": "original user text",
      "type": "domain|requirement|specification",
      "uc1Match": {
        "id": "matched_uc1_id",
        "name": "matched_uc1_name",
        "confidence": 0.95,
        "matchType": "exact|fuzzy|semantic"
      },
      "value": "extracted_value_if_specification",
      "attribution": "requirement"
    }
  ],
  "unmatchable": [],
  "potentialConflicts": []
}
```

### **Validation Criteria (From Implementation Plan)**
- ✅ LLM can match user input to UC1 schema nodes
- ✅ Confidence scores between 0.0-1.0 returned
- ✅ Semantic matching works for "budget friendly" → budget requirements
- ✅ Existing substitution note functionality preserved

---

## ❓ Questions & Clarifications Needed

### **QUESTION 1: LLM Integration Point**

**Current State:**
- `SemanticMatcher.extractTechnicalRequirements()` uses pattern matching
- `AnthropicService.analyzeRequirements()` exists and works

**Options for Implementation:**

**Option A: Replace SemanticMatcher patterns with LLM**
```typescript
// In SemanticMatcher.extractTechnicalRequirements()
async extractTechnicalRequirements(message: string): Promise<TechnicalExtraction[]> {
  // Call AnthropicService with UC1 schema context
  const llmResult = await this.anthropicService.extractAndMatch(message, uc1Schema);
  // Parse LLM response into TechnicalExtraction[]
  return parsedExtractions;
}
```
**Pros:** Clean separation, follows SemanticMatcher structure
**Cons:** Requires new method in AnthropicService

**Option B: Enhance AnthropicService.analyzeRequirements()**
```typescript
// Enhance existing method to return UC1-matched extractions
async analyzeRequirements(message: string): Promise<{
  requirements: EnhancedRequirement[];
  extractedAndMatched: ExtractedNode[];  // NEW
  // ... existing fields
}> {
  // Add UC1 schema to prompt
  // Parse JSON response with uc1Match field
}
```
**Pros:** Uses existing integration, minimal changes
**Cons:** Makes AnthropicService more complex

**Option C: New dedicated method in AnthropicService**
```typescript
// Add new method specifically for UC1 extraction+matching
async extractAndMatchToUC1(message: string, uc1Schema: UC1Schema): Promise<{
  extractedAndMatched: ExtractedNode[];
  unmatchable: string[];
  potentialConflicts: Conflict[];
}> {
  // Implement prompt template from tech spec
}
```
**Pros:** Clean separation of concerns, follows spec exactly
**Cons:** Requires routing logic changes

**🔴 QUESTION: Which option aligns best with your architectural vision?**

---

### **QUESTION 2: UC1 Schema Context - How Much to Send?**

The full UC1 schema is ~1500 lines. Sending it all to LLM:
- Increases token usage significantly
- Provides complete context
- May exceed context window for long conversations

**Options:**

**Option A: Send Full Schema**
```typescript
const uc1Context = JSON.stringify(uc1Schema, null, 2);
// ~50KB of JSON, ~10K tokens
```
**Pros:** Complete context, best matching accuracy
**Cons:** High token cost, slower responses

**Option B: Send Condensed Schema (Names/IDs Only)**
```typescript
const uc1Context = {
  domains: domains.map(d => ({ id: d.id, name: d.name })),
  requirements: requirements.map(r => ({ id: r.id, name: r.name, parent: r.parent })),
  specifications: specifications.map(s => ({
    id: s.id,
    name: s.name,
    parent: s.parent,
    options: s.options  // For validation
  }))
};
// ~5KB, ~1K tokens
```
**Pros:** Faster, cheaper, sufficient for matching
**Cons:** Less context for complex matching

**Option C: Intelligent Context Selection**
```typescript
// Based on message content, only send relevant portions
if (message.includes('processor')) {
  // Send compute_performance specs only
}
```
**Pros:** Optimal token usage
**Cons:** Complex logic, might miss cross-domain matches

**🔴 QUESTION: Which approach do you prefer for UC1 context?**

---

### **QUESTION 3: Form Update Flow Clarification**

**From PRD Addendum:**
> "If valid → Update form field immediately + Add to matched_specifications"

**Current Implementation:**
- SimplifiedRespecService has legacy flow: LLM → form updates
- SemanticIntegration has new flow: LLM → extractions → form updates
- Both exist, which should be primary?

**Scenario:** User says "I need Intel Core i7"

**Path A: Via SemanticIntegration (New)**
```
User Input → SemanticMatcher → LLM extraction → UC1 match (spc001)
→ SemanticIntegration.convertToFormUpdates()
→ CompatibilityLayer (spc001 → compute_performance.processor_type)
→ Return formUpdates to SimplifiedRespecService
→ SimplifiedRespecService returns to app.tsx
→ app.tsx updates form via updateField()
```

**Path B: Via Legacy AnthropicService (Old)**
```
User Input → AnthropicService.analyzeRequirements()
→ Returns { section: 'compute_performance', field: 'processor_type', value: 'Intel Core i7' }
→ SimplifiedRespecService returns to app.tsx
→ app.tsx updates form directly
```

**Questions:**
- Should SemanticIntegration path fully replace legacy path?
- Should they coexist with fallback logic?
- Where does "Add to matched_specifications" happen?

**🔴 QUESTION: Should I deprecate the legacy AnthropicService direct form update path?**

---

### **QUESTION 4: Artifact Population Timing**

**From Implementation Plan Sprint 2 Week 2:**
> "Route LLM matches to mapped artifact"

**From PRD Addendum:**
> "If valid → Update form field immediately + Add to matched_specifications"

**Sequence unclear:**

**Option A: Immediate Artifact Population**
```typescript
// In SemanticMatcher or SemanticIntegration
1. LLM extracts → UC1 match
2. Immediately add to mapped artifact (via ArtifactManager)
3. Convert to form updates
4. Return form updates to UI
```
**Pros:** Artifacts always in sync, follows "immediately" instruction
**Cons:** Sprint 2 Week 2 task becomes redundant

**Option B: Defer to Week 2**
```typescript
// Sprint 2 Week 1: Just get LLM extraction working with form updates
// Sprint 2 Week 2: Add artifact population logic
```
**Pros:** Follows implementation plan sequencing
**Cons:** Temporary disconnect between form and artifacts

**🔴 QUESTION: Should Week 1 include artifact population or defer to Week 2?**

---

### **QUESTION 5: Confidence Threshold Handling**

**From SemanticIntegrationService (existing code):**
```typescript
confidenceThreshold: 0.7
```

**Scenario:** LLM returns match with confidence 0.65

**Options:**

**Option A: Reject Low Confidence Matches**
```typescript
if (uc1Match.confidence < 0.7) {
  // Don't create form update
  // Add to unmapped list
  // Ask clarification question
}
```

**Option B: Accept with Warning**
```typescript
if (uc1Match.confidence < 0.7) {
  // Create form update
  // Add substitutionNote: "Low confidence match, please verify"
  // Show warning in UI
}
```

**Option C: Tiered Confidence**
```typescript
if (confidence >= 0.9) { /* high confidence */ }
else if (confidence >= 0.7) { /* medium - add note */ }
else { /* low - ask clarification */ }
```

**🔴 QUESTION: How should low-confidence matches be handled?**

---

### **QUESTION 6: Conversation History Context**

**Current Implementation:**
```typescript
// SimplifiedRespecService keeps history
this.conversationHistory: Array<{ role, content, timestamp }>
```

**For LLM extraction:**
- Should conversation history be passed to LLM?
- How many messages? (Current: last 5)
- Does history help with context or just increase tokens?

**Example:**
```
User: "I need a high performance system"
Agent: "I've extracted processor: Intel Core i7..."
User: "Make it budget friendly"  ← Needs previous context
```

**🔴 QUESTION: Should LLM receive conversation history for better context?**

---

### **QUESTION 7: Error Handling Strategy**

**Scenario:** LLM returns invalid JSON or malformed response

**Current AnthropicService behavior:**
```typescript
try {
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(jsonMatch[0]);
} catch (parseError) {
  // Falls back to legacy pattern matching
}
```

**For Sprint 2:**
- Should we keep fallback to patterns?
- Or fail gracefully with user message?
- Retry logic?

**🔴 QUESTION: What's the error handling strategy for LLM failures?**

---

### **QUESTION 8: Substitution Notes vs Low Confidence**

**From existing AnthropicService:**
```typescript
interface EnhancedFormUpdate {
  originalRequest?: string;
  substitutionNote?: string;
}
```

**Scenario:** User asks "500GB storage", system has [256GB, 512GB]

**Current behavior:** Selects 512GB, adds substitutionNote

**With confidence scores:**
- Is this a 0.9 confidence "fuzzy" match?
- Or a 0.7 confidence "semantic" match?
- Should substitutionNote replace confidence, or coexist?

**🔴 QUESTION: How do substitutionNote and confidence scoring relate?**

---

### **QUESTION 9: Test-Driven Development**

**Implementation Plan mentions:**
> "Use provided user transcripts when added to /docs"

**Current state:** No user transcripts yet

**Should I:**
- Use synthetic test cases I created (test-pattern-extraction-coverage.cjs)?
- Wait for real transcripts?
- Create test suite based on PRD examples?

**🔴 QUESTION: What test scenarios should drive Sprint 2 Week 1 development?**

---

### **QUESTION 10: Performance Target**

**From Implementation Plan:**
> "Performance target: <4 seconds response time"

**Current API test:** 2.4 seconds for simple request

**With UC1 schema context:**
- Likely 3-5 seconds depending on schema size
- May exceed 4s target if full schema sent

**Options:**
- Accept 5s for MVP (prioritize accuracy)
- Optimize prompt (condensed schema)
- Add caching strategy

**🔴 QUESTION: Is 4 seconds a hard requirement or guideline?**

---

## 📋 Development Approach Proposal

**Unless you have concerns, I propose:**

### **Week 1 Implementation:**

1. **Create new AnthropicService method** (Option C from Q1)
   ```typescript
   async extractAndMatchToUC1(message: string, uc1Schema: CondensedSchema)
   ```

2. **Use condensed UC1 schema** (Option B from Q2)
   - Send names, IDs, options, parent relationships
   - ~1K tokens instead of 10K

3. **Replace SemanticMatcher patterns** with LLM calls
   - Keep pattern matching as fallback on LLM failure

4. **Defer artifact population to Week 2** (Option B from Q4)
   - Focus on extraction + form updates first

5. **Implement tiered confidence** (Option C from Q5)
   - >=0.9: Direct update
   - 0.7-0.9: Update with note
   - <0.7: Ask clarification

6. **Include last 3 messages** as context (Q6)
   - Balance context vs token cost

7. **Keep fallback to patterns** on LLM errors (Q7)
   - Graceful degradation

8. **Use synthetic test cases** (Q9)
   - Based on test-pattern-extraction-coverage.cjs

---

## ✅ Ready to Proceed If:

- [ ] You approve the development approach above
- [ ] You answer the 🔴 RED QUESTIONS that affect architecture
- [ ] You confirm no additional requirements I missed
- [ ] You provide user transcripts (optional, can use synthetic)

---

## 🚨 Show Stoppers / Risks

**None identified.**

All prerequisites are met:
- ✅ API working
- ✅ Infrastructure ready
- ✅ Clear specs available
- ✅ No blocking bugs

**Possible concerns:**
- Token costs with full UC1 schema (mitigated by condensed option)
- Response time might exceed 4s (acceptable for MVP?)
- Integration complexity (mitigated by phased approach)

---

**I'm ready to start coding Sprint 2 Week 1 once you provide guidance on the questions above.**

**Most critical questions: Q1 (integration point), Q2 (schema size), Q4 (artifact timing)**
