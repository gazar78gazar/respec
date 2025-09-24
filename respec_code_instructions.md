# Claude Code Implementation Instructions
## Simplified reqMAS TypeScript Service Implementation

### CRITICAL: READ ALL INSTRUCTIONS BEFORE STARTING

These instructions are for Claude Code to implement the Simplified reqMAS service. Follow them exactly to ensure proper integration with the existing frontend.

---

## 1. IMPLEMENTATION OVERVIEW

### Files to Create
Create these files in the `src/services/reqmas/` directory:

1. `types.ts` - Core type definitions
2. `utils.ts` - Helper functions  
3. `UCDataService.ts` - UC.json data access
4. `AnthropicLLMService.ts` - Claude API integration
5. `SimplifiedReqMASService.ts` - Main service implementation
6. `index.ts` - Export file

### Dependencies to Install
Run these npm install commands:

```bash
npm install uuid @types/uuid
```

**Note**: The Anthropic SDK is NOT needed - we're using direct fetch calls to their API.

---

## 2. FILE CREATION ORDER

**CRITICAL**: Create files in this exact order to avoid TypeScript compilation errors:

### Step 1: Create `types.ts`
- Contains all TypeScript interfaces and types
- No dependencies on other reqMAS files
- Copy the complete content from the artifacts

### Step 2: Create `utils.ts` 
- Helper functions and utilities
- Only depends on `types.ts`
- Copy the complete content from the artifacts

### Step 3: Create `UCDataService.ts`
- UC.json data access and mapping
- Depends on `types.ts` and `utils.ts`
- Copy the complete content from the artifacts

### Step 4: Create `AnthropicLLMService.ts`
- Claude API integration  
- Depends on `types.ts` and `utils.ts`
- Copy the complete content from the artifacts

### Step 5: Create `SimplifiedReqMASService.ts`
- Main service implementation
- Depends on all previous files
- Copy the complete content from the artifacts

### Step 6: Create `index.ts`
- Export file for the module
- Depends on all service files
- Copy the complete content from the artifacts

---

## 3. CRITICAL IMPLEMENTATION NOTES

### Environment Variables
The service will need an Anthropic API key. Add this to your environment configuration:

```typescript
// In your environment config file
VITE_ANTHROPIC_API_KEY=your_api_key_here
```

### UC.json File Location
The service expects `uc1.json` to be available at the root public folder:
- Place `uc1.json` in `public/uc1.json`
- The service will fetch it via `/uc1.json`

### Frontend Integration
The service integrates with your existing `communicateWithMAS` function:

```typescript
// In your app.tsx, you'll use it like this:
import { SimplifiedReqMASService } from './services/reqmas';

const reqMASService = new SimplifiedReqMASService(
  process.env.VITE_ANTHROPIC_API_KEY || ''
);

// In your communicateWithMAS function:
switch (action) {
  case 'chat_message':
    const result = await reqMASService.processChatMessage(data.message);
    // Handle result.formUpdates to update form fields
    return { message: result.systemMessage, formUpdates: result.formUpdates };
    
  case 'form_update':
    const formResult = await reqMASService.processFormUpdate(data.field, data.value);
    // Handle any system messages
    return formResult;
}
```

---

## 4. TYPESCRIPT CONFIGURATION

Ensure your `tsconfig.json` includes:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "allowJs": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  }
}
```

---

## 5. ERROR HANDLING

### Common Issues and Solutions

#### Issue: "Cannot find module 'uuid'"
**Solution**: Run `npm install uuid @types/uuid`

#### Issue: "Cannot fetch /uc1.json"
**Solution**: Ensure `uc1.json` is in the `public/` folder

#### Issue: "Anthropic API key not found"
**Solution**: Add `VITE_ANTHROPIC_API_KEY` to your `.env` file

#### Issue: TypeScript compilation errors
**Solution**: Create files in the exact order specified above

---

## 6. TESTING THE IMPLEMENTATION

### Basic Functionality Test
After implementation, test with these steps:

1. **Initialize Service**:
```typescript
const service = new SimplifiedReqMASService(apiKey);
await service.initialize(); // Should not throw errors
```

2. **Test Chat Processing**:
```typescript
const response = await service.processChatMessage("I need 8 digital inputs");
console.log(response); // Should extract requirement and suggest form updates
```

3. **Test Form Processing**:
```typescript
const formResponse = await service.processFormUpdate("io.digitalInputs", 8);
console.log(formResponse); // Should validate and process the update
```

### Debug Information
Use the debug logging to troubleshoot:
```typescript
const debugLog = service.getDebugLog();
console.log('Last operation:', debugLog[debugLog.length - 1]);
```

---

## 7. INTEGRATION WITH EXISTING FRONTEND

### Modifying communicateWithMAS Function

Update your existing `communicateWithMAS` function in `app.tsx`:

```typescript
// Add this near the top of your component
const [reqMASService] = useState(() => new SimplifiedReqMASService(
  import.meta.env.VITE_ANTHROPIC_API_KEY || ''
));

// Initialize on component mount
useEffect(() => {
  reqMASService.initialize().catch(console.error);
}, []);

// Update the communicateWithMAS function
const communicateWithMAS = async (action: string, data: any) => {
  console.log(`[UI-MAS] ${action}:`, data);

  switch (action) {
    case 'chat_message':
      const chatResult = await reqMASService.processChatMessage(data.message);
      
      // Update form fields automatically
      chatResult.formUpdates.forEach(update => {
        updateFormField(update.section, update.field, update.value);
      });
      
      return {
        success: chatResult.success,
        message: chatResult.systemMessage,
        formUpdates: chatResult.formUpdates
      };

    case 'form_update':
      const formResult = await reqMASService.processFormUpdate(data.field, data.value);
      
      // If system has a message about the form update, show it in chat
      if (formResult.systemMessage) {
        addSystemMessageToChat(formResult.systemMessage);
      }
      
      return formResult;

    case 'export_requirements':
      return reqMASService.exportRequirementsJSON();

    case 'reset_session':
      reqMASService.resetSession();
      return { success: true };

    default:
      console.warn(`[UI-MAS] Unknown action: ${action}`);
  }
};
```

---

## 8. DEPLOYMENT CHECKLIST

Before marking the implementation complete, verify:

- [ ] All 6 TypeScript files created in correct order
- [ ] No TypeScript compilation errors
- [ ] `uuid` dependency installed
- [ ] `uc1.json` file placed in `public/` folder
- [ ] `VITE_ANTHROPIC_API_KEY` environment variable set
- [ ] Service initialization works without errors
- [ ] Basic chat message processing works
- [ ] Form update processing works
- [ ] Integration with existing `communicateWithMAS` function complete

---

## 9. FINAL NOTES

### Performance Considerations
- The service caches UC node data in memory for fast lookups
- LLM calls are the main performance bottleneck (~1-3 seconds)
- Debug logging can be disabled in production by checking NODE_ENV

### Extensibility
The service is designed for easy extension:
- Add new conflict detection rules in `checkMutexConflict`
- Add new form field mappings in `buildCategoryMap`
- Extend UC node matching algorithms in `calculateMatchScore`

### Monitoring
Use the built-in metrics for monitoring:
```typescript
const metrics = service.getMetrics();
console.log('Service performance:', metrics);
```

---

## IMPLEMENTATION COMPLETE

Once all files are created and the basic tests pass, the implementation is ready for integration with the existing frontend. The service will handle:

✅ Natural language requirement extraction
✅ UC node hierarchy mapping  
✅ Automatic form field updates
✅ Basic conflict detection and resolution
✅ Bidirectional chat ↔ form communication
✅ Complete requirement export functionality

**Ready to integrate with your existing communicateWithMAS function!**