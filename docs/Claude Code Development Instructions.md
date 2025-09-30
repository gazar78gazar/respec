# Claude Code Development Instructions

## 🚫 CRITICAL: NO CODING WITHOUT EXPLICIT APPROVAL
- ALWAYS present implementation plans and wait for explicit approval before coding
- Ask clarifying questions if requirements are ambiguous
- Propose alternatives when encountering technical decisions
- Create comprehensive test scripts before implementation for validation

## 📋 Current Project Context

### Environment Parameters
- **Tech Stack**: React TypeScript, Vite, Anthropic Claude API
- **Development Stage**: MVP with production features
- **Architecture Pattern**: Service-based with SimplifiedRespecService integration
- **Database**: Browser LocalStorage for sessions, JSON configs for field definitions
- **Deployment**: Vite dev server (port 5173)
- **Testing Framework**: Custom Node.js test scripts (.cjs)

### Current Sprint Information
- **Sprint Number**: Bidirectional Communication & LLM Enhancement
- **Sprint Goals**: Full chat-form sync with field-aware LLM
- **Sprint Duration**: Completed in phases (Foundation → Protection → Polish → Testing)
- **Definition of Done**: All tests passing, no new TypeScript errors, manual validation ready

## 🏗️ Architecture Overview

### Core Components
- **App.tsx**: Main component with requirements state, form rendering, chat integration
- **SimplifiedRespecService**: Handles chat processing, field mapping, UC1 data
- **AnthropicService**: LLM integration with field-aware context
- **ChatWindowImproved**: Chat UI with bidirectional messaging
- **Field Permissions System**: User override control for form fields
- **Debug Trace System**: Real-time operation logging (console-based)

### Data Flow Patterns
```
User Input → Chat/Form → SimplifiedRespecService → AnthropicService
    ↓                           ↓                        ↓
Form Updates ← Field Mapping ← LLM Processing ← Context Enhancement
    ↓
Post-Update Verification (150ms delay) → Trace Logging
```

## 📝 Development Workflow

### Before Any Coding Session
1. **Diagnostic First**: Run diagnostic scripts to understand current state
2. **Root Cause Analysis**: Identify actual issues before proposing fixes
3. **Phased Approach**: Break complex features into 4-phase implementations
4. **Test Creation**: Write comprehensive test scripts BEFORE coding

### Implementation Process
1. **Phase-Based Development**:
   - Phase 1: Data Structures & Setup
   - Phase 2: Core Logic Implementation
   - Phase 3: Integration & UI Updates
   - Phase 4: Testing & Refinement

2. **Continuous Validation**:
   - TypeScript compilation after each phase
   - No new errors introduced (maintain baseline)
   - Test script validation at each phase

3. **Debug Trace Integration**:
   - Add trace points for all critical operations
   - Include SUCCESS/FAILED/WARNING statuses
   - Keep console-based for development

### End of Sprint Requirements
1. **Testing Suite**: Run all .cjs test scripts
2. **TypeScript Check**: `npx tsc --noEmit` with no new errors
3. **Manual Test Scenarios**: Document real-world test cases
4. **Clean Up**: Remove UI debug overlays for production

## 🎯 Current Implementation Plan

### Completed Features
- [x] Bidirectional chat-form communication
- [x] Field permissions system with user overrides
- [x] Debug trace system with comprehensive logging
- [x] Post-update verification with setTimeout patterns
- [x] LLM-aware field options with substitution notes
- [x] Enhanced form updates with original request tracking

### Technical Decisions Log
| Decision | Rationale | Date | Status |
|----------|-----------|------|--------|
| Use setTimeout for verification | React state batching consistency | Sep 2024 | Approved |
| EnhancedFormUpdate interface | Track substitutions transparently | Sep 2024 | Approved |
| Remove debug UI overlay | Keep traces but avoid UI clutter | Sep 2024 | Approved |
| 4-phase implementation | Systematic, testable progress | Sep 2024 | Approved |

## 🔍 Impact Analysis Template

### Our Proven Method
1. **Run Diagnostic Script First**
2. **Identify Root Causes**
3. **Propose Phased Solution**
4. **Get Explicit Approval**
5. **Implement with Tests**

### Testing Requirements
- Unit test scripts for each phase
- Integration validation after Phase 3
- Full test suite after Phase 4
- Manual scenario testing documented

## 🧪 Testing Standards

### Test Script Pattern (.cjs files)
```javascript
// Consistent structure:
- Colors for console output
- Test tracking (passed/failed/findings)
- Section organization
- Clear pass/fail criteria
- Summary with success rate
- Next steps documentation
```

### Test Execution Points
- [x] After each phase completion
- [x] Before marking todo items complete
- [x] TypeScript check after changes
- [x] Manual scenarios documented

## 📊 Multi-Agent System Guidelines

### SimplifiedRespecService Patterns
- Load UC1.json for field mappings
- Build field options map from definitions
- Identify relevant fields from message context
- Build context prompts with available options
- Handle substitutions with explanatory notes

### LLM Context Enhancement
- Include available dropdown options in prompts
- Enforce "select from list only" for dropdowns
- Require substitutionNote for value changes
- Track originalRequest for transparency

## 🚨 Red Flags - Stop and Ask

If encountering any of these, STOP and ask for guidance:
- Form fields not rendering (check activeTab initialization)
- Chat updates not reflected (check field mappings)
- TypeScript errors increasing (maintain baseline)
- Value mapping failures (check dropdown options)
- State synchronization issues (verify setTimeout patterns)

## 💬 Communication Protocol

### Before Starting Work
"I've identified [issue]. Root cause analysis shows [findings]. I propose a [N]-phase solution:
Phase 1: [description]
Phase 2: [description]
...
This will [impact]. Tests will validate [criteria]. May I proceed?"

### During Implementation
- Complete each phase fully before moving on
- Run TypeScript check after each phase
- Update todo list to track progress
- Note any deviations from plan

### When Complete
"[Feature] implementation complete:
- All [N] phases implemented
- [X] tests passing, [Y] failing
- TypeScript: [number] pre-existing errors maintained
- Ready for: [manual testing scenarios]"

## 📈 Success Metrics

### Sprint Success Criteria
- [x] Bidirectional communication working
- [x] No form rendering issues
- [x] LLM aware of field options
- [x] Clean UI without debug overlays
- [x] Comprehensive test coverage

### Quality Gates
- [x] Diagnostic scripts validate implementation
- [x] TypeScript compilation unchanged
- [x] Test success rate > 95%
- [x] Manual scenarios documented

## 🔄 Working Method Principles

### 1. Diagnostic-Driven Development
- Always run diagnostic scripts first
- Identify root causes before coding
- Validate assumptions with tests

### 2. Phased Implementation
- Break complex features into 4 phases
- Complete each phase before proceeding
- Test at phase boundaries

### 3. Transparency Through Tracing
- Add debug traces for visibility
- Keep console logs for development
- Remove UI overlays for production

### 4. Test-First Validation
- Write test scripts before coding
- Use consistent .cjs test structure
- Document expected vs actual clearly

### 5. Maintain Baseline Quality
- No new TypeScript errors
- Keep ~218 pre-existing errors
- Don't fix unrelated issues

---

## 🔄 This Document
- **Owner**: Development Team
- **Last Updated**: September 28, 2025
- **Review Frequency**: Each major feature
- **Update Process**: Document patterns that prove successful

Remember: This document captures our PROVEN working methods from successful implementations.