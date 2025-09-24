# MAS Service Developer Specifications (Current Implementation)

## Overview

This document provides exact specifications for the MAS (Multi-Agent System) service that integrates with the UI-MAS communication interface as currently implemented in `src/app.tsx`.

**CRITICAL**: This specification reflects the ACTUAL current implementation, not an ideal design.

## Required Service Interface

### Service Instance Location
The MAS service MUST be available as a global import:
```typescript
// From src/app.tsx line 10
import { reqMASService } from './services/reqmas/ReqMASService';
```

### Current Implementation Status
The ReqMASService exists at `src/services/reqmas/ReqMASService.ts` and implements:
- ✅ `getPublicState()` - Line 270
- ❌ `updateFormField()` - **NOT IMPLEMENTED** (called with optional chaining)
- ✅ `triggerAutofill()` - Line 255

## Exact Interface Contract

Based on how the code actually calls the service:

```typescript
interface ReqMASService {
  // REQUIRED - Called every 1 second (Line 962)
  getPublicState(): SharedState;

  // OPTIONAL - Called with ?. operator (Line 845)
  updateFormField?(field: string, value: any): void;

  // REQUIRED - Called directly (Line 850)
  triggerAutofill(): RequirementArtifact;
}
```

### Current Data Types (from ReqMASService.ts)

```typescript
export interface SharedState {
  sessionId: string;
  timestamp: number;
  requirements: RequirementArtifact;
  useCases: DetectedUseCase[];
  chatLog: ChatEntry[];
  debugLog: AgentThought[];
  currentStep: FlowStep;
  conflicts: Conflict[];
  pendingClarification?: ClarificationRequest;
}

export interface RequirementArtifact {
  system: Record<string, any>;
  io: Record<string, any>;
  communication: Record<string, any>;
  environmental: Record<string, any>;
  commercial: Record<string, any>;
  constraints: Constraint[];
}
```

## Communication Flow Implementation

### 1. Chat Message Processing (Lines 834-841)

**Current Flow**:
```typescript
case 'chat_message':
  const chatResult = await sendMessage(data.message);
  // Sync form with MAS state
  const masState = reqMASService.getPublicState();
  if (masState.requirements) {
    setRequirements(prev => ({ ...prev, ...masState.requirements }));
  }
  return chatResult;
```

**What the MAS Service Receives**:
- **Nothing directly** - `sendMessage` comes from `useReqMAS` hook, not reqMASService
- MAS state is polled AFTER sendMessage completes

**Expected Behavior**:
- `getPublicState()` should return updated requirements after chat processing
- Requirements should be in format compatible with form sections

### 2. Form Field Updates (Lines 843-847)

**Current Flow**:
```typescript
case 'form_update':
  // Update MAS with form changes
  reqMASService.updateFormField?.(data.field, data.value);
  console.log(`[UI-MAS] Form updated: ${data.field} = ${data.value}`);
  return;
```

**What the MAS Service Receives**:
- `field`: String in format `"section.fieldname"` (e.g., `"io_connectivity.analog_io"`)
- `value`: Any type (string, number, array for multi-select)

**Current Reality**:
- Method doesn't exist, called with optional chaining `?.`
- No error thrown if method is missing
- `isAssumption` parameter is passed but not used

**Expected Behavior if Implemented**:
- Update internal MAS state with field change
- Field should be accessible via `getPublicState().requirements`

### 3. Autofill Processing (Lines 849-854)

**Current Flow**:
```typescript
case 'autofill':
  const autofillResult = reqMASService.triggerAutofill();
  // Update form with autofilled data
  setRequirements(prev => ({ ...prev, ...autofillResult }));
  console.log('[UI-MAS] Autofill completed:', Object.keys(autofillResult));
  return autofillResult;
```

**What the MAS Service Receives**:
- **No parameters** - `data.section` is ignored
- Direct synchronous call (not awaited)

**Expected Return**:
```typescript
{
  [section: string]: {
    [field: string]: {
      value: any;
      isComplete: boolean;
      isAssumption: boolean;
    }
  }
}
```

## Exact Form Schema Integration

The MAS service must understand these exact sections and fields:

### Form Sections (Lines 536-542)
```typescript
const SECTION_MAPPING = {
  'Compute Performance': ['compute_performance'],
  'I/O & Connectivity': ['io_connectivity'],
  'Form Factor': ['form_factor'],
  'Environment & Standards': ['environment_standards'],
  'Commercial': ['commercial']
};
```

### All Form Fields by Section

#### 1. compute_performance (9 fields)
```typescript
[
  'processor_type', 'ai_gpu_acceleration', 'memory_capacity',
  'memory_type', 'storage_capacity', 'storage_type',
  'time_sensitive_features', 'response_latency', 'operating_system'
]
```

#### 2. io_connectivity (12 fields)
```typescript
[
  'digital_io', 'analog_io', 'ethernet_ports', 'ethernet_speed',
  'ethernet_protocols', 'usb_ports', 'serial_ports_amount',
  'serial_port_type', 'serial_protocol_support',
  'fieldbus_protocol_support', 'wireless_extension'
]
```

#### 3. form_factor (5 fields)
```typescript
[
  'power_input', 'max_power_consumption', 'redundant_power',
  'dimensions', 'mounting'
]
```

#### 4. environment_standards (6 fields)
```typescript
[
  'operating_temperature', 'humidity', 'vibration_resistance',
  'ingress_protection', 'vibration_protection', 'certifications'
]
```

#### 5. commercial (6 fields)
```typescript
[
  'budget_per_unit', 'quantity', 'total_budget',
  'delivery_timeframe', 'shipping_incoterms', 'warranty_requirements'
]
```

### Priority Fields (Lines 525)
```typescript
const MUST_FIELDS = [
  'digital_io', 'analog_io', 'ethernet_ports',
  'budget_per_unit', 'quantity'
];
```

## Field Types and Options

### Dropdown Fields
Most fields are dropdowns with "Not Required" as first option:

```typescript
// Example: processor_type
options: [
  "Not Required", "Intel U300E", "Intel Atom", "Intel Core i3",
  "Intel Core i5", "Intel Core i7", "Intel Core i9"
]

// Example: digital_io
options: ["Not Required", "2", "4", "6", "8", "16", "32", "64", "Over 64"]
```

### Multi-Select Fields
```typescript
// ethernet_protocols, serial_port_type, fieldbus_protocol_support,
// time_sensitive_features, wireless_extension, certifications
```

### Number Fields
```typescript
// budget_per_unit (min: 0)
// quantity (min: 1, max: 1000)
// total_budget (min: 0, calculated: true - read-only)
```

## State Synchronization Requirements

### Polling Implementation (Lines 960-978)
```typescript
useEffect(() => {
  const syncInterval = setInterval(() => {
    const masState = reqMASService.getPublicState();
    if (masState.requirements && Object.keys(masState.requirements).length > 0) {
      setRequirements(prev => {
        const merged = { ...prev };
        // Only sync if there are actual changes
        Object.keys(masState.requirements).forEach(section => {
          if (masState.requirements[section] && Object.keys(masState.requirements[section]).length > 0) {
            merged[section] = { ...merged[section], ...masState.requirements[section] };
          }
        });
        return merged;
      });
    }
  }, 1000); // Check every second

  return () => clearInterval(syncInterval);
}, []);
```

**Requirements for MAS Service**:
- `getPublicState()` called every 1000ms
- Must return `requirements` object with section-based structure
- Shallow merge strategy used: `{ ...merged[section], ...masState.requirements[section] }`
- Only syncs if `Object.keys(masState.requirements).length > 0`

## Integration with useReqMAS Hook

### Current Dependencies (Lines 875-887)
```typescript
const {
  connected,           // Not used by communicateWithMAS
  loading,             // Used by sendMessageWrapper
  error: reqMASError,  // Not used by communicateWithMAS
  chatMessages: reqMASMessages,    // Used by ChatWindow
  requirements: reqMASRequirements, // Used by separate useEffect
  currentStep,         // Not used by communicateWithMAS
  pendingClarification, // Used by ChatWindow
  conflicts,           // Not used by communicateWithMAS
  sendMessage,         // USED by communicateWithMAS chat_message
  initializeSession,   // Not used by communicateWithMAS
  clearSession        // Not used by communicateWithMAS
} = useReqMAS();
```

**Key Point**: The `sendMessage` function comes from `useReqMAS`, NOT from `reqMASService`

## Error Handling Requirements

### Current Implementation
- **No error handling** in `communicateWithMAS` itself
- Optional chaining used: `reqMASService.updateFormField?.(data.field, data.value)`
- Unknown actions log warnings but don't throw errors

### Console Logging Requirements
All MAS operations must be traceable:
```typescript
// From lines 831, 846, 853, 857
console.log(`[UI-MAS] ${action}:`, data);
console.log(`[UI-MAS] Form updated: ${data.field} = ${data.value}`);
console.log('[UI-MAS] Autofill completed:', Object.keys(autofillResult));
console.warn(`[UI-MAS] Unknown action: ${action}`);
```

## Implementation Requirements

### Essential Methods

#### 1. getPublicState() - REQUIRED
```typescript
getPublicState(): SharedState {
  return {
    sessionId: string,
    timestamp: number,
    requirements: {
      // Must match form section structure
      compute_performance?: { [field: string]: FieldData },
      io_connectivity?: { [field: string]: FieldData },
      form_factor?: { [field: string]: FieldData },
      environment_standards?: { [field: string]: FieldData },
      commercial?: { [field: string]: FieldData }
    },
    // ... other properties
  };
}

interface FieldData {
  value: any;
  isComplete: boolean;
  isAssumption: boolean;
  // Other properties as needed
}
```

#### 2. updateFormField() - OPTIONAL
```typescript
updateFormField?(field: string, value: any): void {
  // field format: "section.fieldname" (e.g., "io_connectivity.analog_io")
  // value: any type (string, number, array)

  // Update internal state
  // Method MUST NOT throw errors if not implemented
}
```

#### 3. triggerAutofill() - REQUIRED
```typescript
triggerAutofill(): RequirementArtifact | FormRequirements {
  // Return structure that can be spread into requirements state
  // Must include section-based organization

  return {
    compute_performance: { /* field data */ },
    io_connectivity: { /* field data */ },
    form_factor: { /* field data */ },
    environment_standards: { /* field data */ },
    commercial: { /* field data */ }
  };
}
```

## Current Service Registration

The service is imported and used directly:
```typescript
// Line 10: Import statement
import { reqMASService } from './services/reqmas/ReqMASService';

// Direct usage - no initialization shown
const masState = reqMASService.getPublicState();
const autofillResult = reqMASService.triggerAutofill();
reqMASService.updateFormField?.(field, value);
```

## Known Issues & Workarounds

### 1. Missing updateFormField Method
- Called with optional chaining to prevent errors
- Not implemented in current ReqMASService
- Silently fails without affecting UI

### 2. Ignored Section Parameter
- Autofill action receives `{ section: tabName }` but `triggerAutofill()` takes no parameters
- Section-specific autofill not implemented

### 3. Duplicate Autofill Logic
- Line 1277 calls MAS autofill
- Lines 1279-1294 run original autofill logic
- MAS results may be overwritten

### 4. Mixed State Sources
- Chat processing uses `useReqMAS` hook
- Form sync uses `reqMASService`
- Two separate state management systems

### 5. Data Structure Mismatch
- MAS returns `RequirementArtifact` with system/io/communication/environmental/commercial
- UI expects compute_performance/io_connectivity/form_factor/environment_standards/commercial

## Testing Integration Points

### Console Validation
Expected console output when MAS service is working:
```javascript
// Chat message
[UI-MAS] chat_message: {message: "I need 4 analog inputs"}

// Form field change
[UI-MAS] Form updated: io_connectivity.analog_io = 4

// Autofill trigger
[UI-MAS] Autofill completed: (12) ['processor_type', 'memory_capacity', ...]
```

### State Polling Test
Every 1 second, verify:
1. `reqMASService.getPublicState()` is called
2. If `masState.requirements` exists with data, it merges into UI state
3. Form fields update automatically

### Method Availability Test
```javascript
// These should not throw errors:
typeof reqMASService.getPublicState === 'function'        // true
typeof reqMASService.triggerAutofill === 'function'       // true
typeof reqMASService.updateFormField === 'function'       // false (optional)
```

## Implementation Roadmap

### Phase 1: Core Interface Compliance
- ✅ Implement `getPublicState()` returning SharedState
- ✅ Implement `triggerAutofill()` returning compatible structure
- ❌ Add `updateFormField(field, value)` method (optional)

### Phase 2: Data Structure Alignment
- Map MAS internal structure to UI form sections
- Ensure polling returns data in expected format
- Handle field value format conversion

### Phase 3: Enhanced Integration
- Fix section parameter usage in autofill
- Remove duplicate autofill logic
- Add proper error handling and logging

## Conclusion

The current MAS service implementation partially satisfies the UI-MAS communication interface:

**Working**:
- State polling via `getPublicState()`
- Autofill triggering via `triggerAutofill()`
- Console logging for debugging

**Missing**:
- Form field update handling via `updateFormField()`
- Section-specific autofill support
- Proper data structure mapping

**Architecture Issues**:
- Mixed state management between `useReqMAS` and `reqMASService`
- Data structure mismatch between MAS and UI expectations
- Duplicate autofill logic causing potential overwrites

This specification provides the exact requirements for building or updating a MAS service that works with the current UI implementation without requiring changes to the UI code.