# ReSpec Project Documentation

## 📋 Quick Initialization Guide for Claude Code

This documentation folder contains the complete project context for the **ReSpec** system - an intelligent specification extraction and form automation tool. When initializing a new Claude Code session, read this README first to understand what's been built and what remains to be done.

## 🏗️ What ReSpec Is

ReSpec is a **React TypeScript application** that automatically extracts technical requirements from natural language input and populates structured forms. It combines:
- **LLM-powered natural language processing** (40% of operations)
- **Code-based validation and state management** (60% of operations)
- **Bidirectional chat-form synchronization**
- **Field-aware value selection** with substitution tracking

## 📁 Documentation Structure

### Core Specifications
- **`respec_PRD_v101.md`** - Product Requirements Document with recent updates
- **`respec_PRD_addendumv201.md`** - Latest requirements addendum
- **`respec-tech-spec-v101.md`** - Detailed technical implementation specification
- **`revised-bidirectional-Technical Specifications.md`** - Bidirectional communication architecture

### Development Guidelines
- **`Claude Code Development Instructions.md`** - **READ THIS FIRST** - Complete development workflow, patterns, and quality gates
- **`DEBUG_INSTRUCTIONS.md`** - Debug system usage and trace logging

## 🎯 Current Implementation Status

### ✅ COMPLETED FEATURES

#### 1. **Bidirectional Chat-Form Communication**
- **Status**: ✅ **FULLY IMPLEMENTED**
- **Location**: `src/app.tsx` (lines 1056-1368)
- **Key Components**:
  - `communicateWithMAS()` function as central hub
  - `SimplifiedRespecService` for message processing
  - Post-update verification with 150ms setTimeout
  - Trace logging system for debugging

#### 2. **LLM-Aware Field Options Enhancement**
- **Status**: ✅ **FULLY IMPLEMENTED**
- **Specification**: `../llm-field-options-specification.md`
- **Test Suite**: `../test-llm-field-options.cjs`
- **Key Features**:
  - Field options awareness in LLM prompts
  - Intelligent value substitution (e.g., "500GB" → "512GB")
  - Substitution notes for transparency
  - Enhanced form update tracking

#### 3. **Form Field Structure & Validation**
- **Status**: ✅ **FULLY IMPLEMENTED**
- **Location**: `src/app.tsx` (lines 88-400)
- **Features**:
  - Hierarchical form structure (5 main areas)
  - Dropdown options for all major fields
  - Cross-field validation
  - Permission system for user overrides

#### 4. **Debug Trace System**
- **Status**: ✅ **FULLY IMPLEMENTED**
- **Features**:
  - Console-based trace logging
  - SUCCESS/FAILED/WARNING status tracking
  - Post-update verification
  - No UI overlay (clean production interface)

### 🚧 PARTIALLY IMPLEMENTED

#### 1. **UC1.json Integration**
- **Status**: 🟡 **BASIC IMPLEMENTATION**
- **Current**: Loads UC1.json for field mappings
- **Missing**: Full specification matching and validation
- **Location**: `SimplifiedRespecService.ts` (lines 160-177)

#### 2. **Smart Defaults & Autofill**
- **Status**: 🟡 **PATTERN MATCHING ONLY**
- **Current**: Basic pattern recognition for common requirements
- **Missing**: Advanced context-aware suggestions
- **Location**: `SimplifiedRespecService.ts` (lines 501-529)

### ❌ NOT YET IMPLEMENTED

#### 1. **Advanced Conflict Detection**
- **Status**: ❌ **NOT STARTED**
- **Specification**: `respec-tech-spec-v101.md` (Section 2.3.4)
- **Requirements**:
  - Branch-level conflict isolation
  - Partial branch movement to respec
  - Priority queue for conflict resolution
  - Mutex constraint validation

#### 2. **Multi-Artifact State Management**
- **Status**: ❌ **NOT STARTED**
- **Requirements**:
  - Respec artifact (validated specs)
  - Mapped artifact (matched but unvalidated)
  - Unmapped list (unrecognized data)
  - Conflict list (isolated conflicts)

#### 3. **Advanced Form Integration**
- **Status**: ❌ **NOT STARTED**
- **Requirements**:
  - Dynamic form generation from UC1.json
  - Complex validation rules
  - Conditional field display
  - Export to multiple formats

## 🔄 Current Architecture

### Data Flow
```
User Input → Chat/Form → communicateWithMAS → SimplifiedRespecService
                ↓                                      ↓
         Form State Update ← EnhancedFormUpdate ← LLM Processing
                ↓
         Post-Update Verification (150ms delay)
```

### Key Components
- **App.tsx**: Main component with requirements state management
- **SimplifiedRespecService**: Chat processing and field mapping
- **AnthropicService**: LLM integration with field-aware context
- **ChatWindowImproved**: Chat UI with bidirectional messaging

### Communication Protocol
- **`chat_message`**: Process natural language input
- **`form_update`**: Notify service of manual form changes
- **`trigger_autofill`**: Request smart defaults
- **`system_populate_field`**: Update single field from service
- **`system_populate_multiple`**: Batch update multiple fields

## 📝 Development Workflow

### Before Starting Any Work
1. **Run diagnostic scripts** in root folder (`.cjs` files)
2. **Read**: `Claude Code Development Instructions.md`
3. **Check TypeScript baseline**: `npx tsc --noEmit` (should show ~218 errors)
4. **Test current functionality**: `npm run dev`

### Implementation Pattern
1. **Phase 1**: Data structures and interfaces
2. **Phase 2**: Core logic implementation
3. **Phase 3**: Integration and UI updates
4. **Phase 4**: Testing and refinement

### Quality Gates
- TypeScript compilation unchanged (maintain ~218 baseline errors)
- All `.cjs` test scripts passing
- Manual test scenarios documented
- No UI debug overlays in production

## 🧪 Testing Infrastructure

### Available Test Scripts
- **`test-llm-field-options.cjs`** - Validates LLM field awareness
- **`test-bidirectional-communication.cjs`** - Tests chat-form sync
- **`test-comprehensive.cjs`** - Full system validation
- **`test-debug-system.cjs`** - Debug trace verification
- **`test-field-structure.cjs`** - Form field validation
- **`test-form-rendering-diagnosis.cjs`** - UI rendering tests

### Manual Test Scenarios
1. **Storage Value Test**: "I need 500GB storage" → Should select "512GB" with substitution note
2. **Unit Conversion**: "I need half a tera" → Should convert to "512GB" with explanation
3. **Direct Match**: "I need 512GB" → Should select directly with no substitution note
4. **Multiple Fields**: "8 ethernet ports and 16GB memory" → Should update both fields

## 🎯 Next Priority Items

### High Priority (Ready for Implementation)
1. **UC1.json Full Integration**
   - Implement complete specification matching
   - Add validation against UC1 constraints
   - **Estimated**: 2-3 days

2. **Advanced Conflict Detection**
   - Branch-level conflict isolation
   - Partial movement logic
   - **Estimated**: 4-5 days

### Medium Priority
1. **Multi-Artifact State Management**
2. **Export Functionality Enhancement**
3. **Advanced Autofill Intelligence**

### Low Priority
1. **Performance Optimization**
2. **Additional Export Formats**
3. **Advanced Analytics**

## 🚨 Critical Constraints

### Must Maintain
- **TypeScript Error Baseline**: ~218 pre-existing errors (DO NOT FIX)
- **4-Phase Implementation Pattern**: Always break work into phases
- **Console-Based Debug**: No UI debug overlays
- **Bidirectional Sync**: Chat and form must stay synchronized

### Never Do
- Fix unrelated TypeScript errors
- Add UI debug overlays (keep console-based)
- Break existing bidirectional communication
- Create new files unless absolutely necessary

## 🔍 Key File Locations

### Core Implementation
- **`src/app.tsx`**: Main application (2400+ lines)
- **`src/services/respec/SimplifiedRespecService.ts`**: Core service (747 lines)
- **`src/services/respec/AnthropicService.ts`**: LLM integration (259 lines)
- **`src/components/ChatWindowImproved.tsx`**: Chat interface

### Configuration
- **`public/uc1.json`**: Field specifications and constraints
- **`formFieldsData`** in app.tsx: Form field definitions with dropdown options

### Documentation
- **Root folder**: Test scripts (`.cjs` files)
- **`docs/`**: This folder with all specifications

## 🎬 Getting Started Checklist

When starting a new Claude Code session:

1. ✅ Read this README.md file
2. ✅ Read `Claude Code Development Instructions.md`
3. ✅ Run `npm run dev` to see current state
4. ✅ Run diagnostic scripts to understand what works
5. ✅ Check `npx tsc --noEmit` for TypeScript baseline
6. ✅ Test manual scenarios listed above
7. ✅ Review recent git commits for context
8. ✅ Identify which priority item to work on
9. ✅ Plan implementation in 4 phases
10. ✅ Get explicit approval before coding

## 📊 Success Metrics

- **Functionality**: All core features working without regression
- **Code Quality**: TypeScript baseline maintained, tests passing
- **User Experience**: Clean UI, responsive interactions
- **Documentation**: Changes documented in specs and tests
- **Reliability**: Bidirectional sync working consistently

---

**Last Updated**: September 30, 2025
**Version**: 1.0.1
**Maintainer**: Development Team

## 🚀 Remember

This project follows a **systematic, test-driven approach**. The foundation is solid - now we're building advanced features on top of proven patterns. When in doubt, run the diagnostics first, plan in phases, and get approval before implementation.