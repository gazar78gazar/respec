# Sprint 2 Week 1 - Step-by-Step Testing Protocol
**Date**: October 2, 2025
**Purpose**: Diagnose and fix identified issues based on user observations

---

## 🎯 **Issues to Investigate** (Based on Your Feedback)

### **Issue 1: UC1 Matching Accuracy** 🔴 **HIGH PRIORITY**
**Your Observation**: "Successfully matched 3 out of 6 (should have matched 5 out of 6)"

**Hypothesis**: SemanticMatchingService LLM prompt may not be optimal for matching

### **Issue 2: Form Update Coherence** 🔴 **HIGH PRIORITY**
**Your Observation**:
- "Updated some specifications successfully, some not successfully or not at all"
- "Matched wall mount when I never spoke of any mount"
- "It updated two form fields I discussed (with wrong values)"
- "When I asked what it filled, it said it didn't fill the form fields"

**Hypothesis**: Agent lacks visibility into form updates OR form update flow has issues

### **Issue 3: Conversation Context** 🔴 **HIGH PRIORITY**
**Your Observation**: "Conversation context is indeed absent beyond the last message"

**Hypothesis**: conversationHistory not passed correctly to Agent

---

## 📋 **Testing Protocol - Execute in This Order**

### **TEST 1: Conversation Context Verification** ⚡ **DO THIS FIRST**

**Goal**: Verify conversationHistory is passed to Agent

**Steps**:
1. Open browser DevTools Console (F12)
2. Clear console
3. Start dev server: `npm run dev`
4. Wait for app to load
5. Enter message: **"I need 16 digital inputs"**
6. Press Send
7. **CHECK CONSOLE** for these logs (copy and paste output):
   ```
   [SimplifiedRespec] Processing: "I need 16 digital inputs"
   [SimplifiedRespec] 🚀 Starting Sprint 2 flow
   [SimplifiedRespec] 📝 Step 1: Agent extracting requirements...
   ```
8. Enter follow-up message: **"and 8 digital outputs"**
9. **CHECK CONSOLE** - look for `conversationHistory` being logged
10. **PASTE CONSOLE OUTPUT HERE** → Send to me

**What to Look For**:
- Does console show conversationHistory array?
- Does it include previous message?
- Is it passed to analyzeRequirements()?

**If Missing**: We'll fix the wiring immediately

---

### **TEST 2: Agent Extraction Accuracy** ⚡ **DO SECOND**

**Goal**: Verify Agent extracts correctly from user input

**Steps**:
1. Clear browser console
2. Refresh page (clear conversation)
3. Enter: **"I need Intel Core i7 processor, 16GB RAM, and 512GB SSD storage"**
4. Press Send
5. **FIND IN CONSOLE**:
   ```
   [SimplifiedRespec] ✅ Agent extracted: X requirements
   ```
6. **COPY THE FULL EXTRACTION OUTPUT** (should show 3 requirements)
7. **PASTE HERE** → Send to me

**What to Look For**:
- Agent extracts 3 items: processor_type, memory_capacity, storage_capacity
- Each has correct value
- Confidence scores present

**If Wrong**: We'll fix the Agent extraction prompt

---

### **TEST 3: UC1 Matching Accuracy** ⚡ **DO THIRD**

**Goal**: Verify SemanticMatchingService matches correctly

**Steps**:
1. Using same conversation from TEST 2
2. **FIND IN CONSOLE**:
   ```
   [SemanticMatching] 🔍 Matching X nodes to UC1
   [SemanticMatching] ✅ Matched X nodes
   [SemanticIntegration] 📍 Match: ...
   ```
3. **COPY ALL MATCH LOGS** showing:
   - What was matched
   - UC1 ID (e.g., spc001, spc003)
   - Confidence scores
4. **PASTE HERE** → Send to me

**What to Look For**:
- Intel Core i7 → spc001 (processor_type)
- 16GB RAM → spc003 (memory_capacity)
- 512GB SSD → storage-related spec

**If Wrong Matches**: We'll fix SemanticMatchingService prompt

---

### **TEST 4: Form Update Application** ⚡ **DO FOURTH**

**Goal**: Verify form actually updates with correct values

**Steps**:
1. After TEST 3, **CHECK THE FORM ON SCREEN**
2. Look for these form fields:
   - **Processor Type**: Should show "Intel Core i7"
   - **Memory Capacity**: Should show "16GB"
   - **Storage Capacity**: Should show "512GB"
3. **TAKE SCREENSHOT** or **LIST WHAT ACTUALLY SHOWS**:
   ```
   Processor Type: _______
   Memory Capacity: _______
   Storage Capacity: _______
   ```
4. **SEND ME THE VALUES** → What did it actually fill?

**What to Look For**:
- Values match what you said
- NO random values (like "wall mount")
- Form fields actually filled

**If Wrong**: We'll trace the form update path

---

### **TEST 5: Agent Form Visibility** ⚡ **DO FIFTH**

**Goal**: Check if Agent knows what it filled

**Steps**:
1. In the SAME conversation (don't refresh)
2. Type: **"What form fields did you just fill?"**
3. Press Send
4. **COPY AGENT'S RESPONSE**
5. **PASTE HERE** → Send to me

**What to Look For**:
- Agent should list: processor_type, memory_capacity, storage_capacity
- Values should match TEST 4

**If Agent Says "I didn't fill anything"**: We'll add form state visibility

---

### **TEST 6: Hallucination Check (Wall Mount Issue)** ⚡ **DO SIXTH**

**Goal**: Reproduce "wall mount" hallucination

**Steps**:
1. Clear browser, refresh page
2. Enter: **"I need a compact industrial PC with good cooling"**
3. Press Send
4. **CHECK CONSOLE** for extractions and matches
5. **CHECK FORM** for any "mounting" field changes
6. **COPY**:
   - Console extraction logs
   - Console UC1 match logs
   - Form field values that changed
7. **PASTE HERE** → Send to me

**What to Look For**:
- Did it extract "wall mount" when you didn't say it?
- Did UC1 matcher return mounting-related spec?
- Did form get updated with mounting value?

**If Hallucination Occurs**: We'll fix Agent prompt or UC1 matching

---

## 📊 **Results Template** - Fill This Out

After running all 6 tests, fill out this template and send to me:

```
=== TEST 1: Conversation Context ===
Console Output:
[PASTE HERE]

Issues Found:
[YES/NO and describe]

=== TEST 2: Agent Extraction ===
Extracted Requirements:
[PASTE HERE]

Expected: 3 items (processor, memory, storage)
Actual: [X items, list them]

Issues Found:
[YES/NO and describe]

=== TEST 3: UC1 Matching ===
Match Logs:
[PASTE HERE]

Expected Matches:
- Intel Core i7 → spc001
- 16GB RAM → spc003
- 512GB SSD → [some storage spec]

Actual Matches:
[PASTE WHAT YOU SEE]

Issues Found:
[YES/NO and describe]

=== TEST 4: Form Update ===
Form Field Values:
- Processor Type: [VALUE]
- Memory Capacity: [VALUE]
- Storage Capacity: [VALUE]

Expected vs Actual:
[DESCRIBE DIFFERENCES]

Issues Found:
[YES/NO and describe]

=== TEST 5: Agent Form Visibility ===
Agent's Response:
[PASTE HERE]

Should List: processor_type, memory_capacity, storage_capacity
Actually Listed: [PASTE]

Issues Found:
[YES/NO and describe]

=== TEST 6: Hallucination Check ===
Console Logs:
[PASTE EXTRACTION + MATCHING]

Form Values That Changed:
[LIST ALL]

Did "wall mount" or "mounting" appear?: [YES/NO]
If YES, where?: [CONSOLE/FORM/BOTH]

Issues Found:
[YES/NO and describe]
```

---

## 🔧 **Fix Priority Based on Results**

After you send me the completed template, I'll:

1. **Identify root causes** from console logs
2. **Create targeted fixes** for each issue
3. **Provide exact code changes** to apply
4. **Re-test** to verify fixes work

---

## ⚠️ **Important Notes**

- **Keep console open** for all tests
- **Don't refresh** between TEST 2-5 (same conversation)
- **DO refresh** between TEST 1, TEST 2, and TEST 6 (separate tests)
- **Copy FULL console output** - more is better
- **Include timestamps** if visible
- **Screenshots welcome** if console output is unclear

---

## 🎯 **Expected Timeline**

- **Tests 1-6**: 10-15 minutes total
- **Fill template**: 5 minutes
- **Send to me**: 1 minute
- **Analysis + fixes**: 10-20 minutes (my side)
- **Apply fixes**: 5 minutes (your side)
- **Re-test**: 5 minutes

**Total**: ~40-60 minutes to identify and fix all issues

---

Ready to start? Begin with **TEST 1** and work through in order. Send me the completed results template when done!
