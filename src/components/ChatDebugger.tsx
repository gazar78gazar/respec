import React, { useState, useEffect } from 'react';

// Debug component to test chat functionality
export const ChatDebugger = ({
  chatMessages,
  setChatMessages,
  sendMessageWrapper,
  communicateWithMAS
}) => {
  const [testResults, setTestResults] = useState({});
  const [isRunning, setIsRunning] = useState(false);

  const runTests = async () => {
    setIsRunning(true);
    const results = {};

    // ========== DOMAIN A: State & Data Flow Tests ==========

    // Test 1: Check if chatMessages state exists
    results.stateExists = {
      test: 'chatMessages state exists',
      passed: chatMessages !== undefined,
      value: Array.isArray(chatMessages) ? `Array(${chatMessages.length})` : typeof chatMessages,
      messages: chatMessages ? chatMessages.slice(-3) : null
    };

    // Test 2: Check setChatMessages function
    results.setterExists = {
      test: 'setChatMessages function exists',
      passed: typeof setChatMessages === 'function',
      value: typeof setChatMessages
    };

    // Test 3: Test state update
    try {
      const testMsg = { role: 'user', content: `TEST: ${new Date().toISOString()}` };
      setChatMessages(prev => [...(prev || []), testMsg]);

      // Wait for state update
      await new Promise(resolve => setTimeout(resolve, 100));

      results.stateUpdate = {
        test: 'Can update state',
        passed: true,
        addedMessage: testMsg
      };
    } catch (error: unknown) {
      results.stateUpdate = {
        test: 'Can update state',
        passed: false,
        error: error.message
      };
    }

    // Test 4: Check message structure in state
    if (chatMessages && chatMessages.length > 0) {
      const lastMsg = chatMessages[chatMessages.length - 1];
      results.messageStructure = {
        test: 'Message structure valid',
        passed: lastMsg && 'role' in lastMsg && 'content' in lastMsg,
        sample: lastMsg,
        expectedKeys: ['role', 'content'],
        actualKeys: lastMsg ? Object.keys(lastMsg) : []
      };
    }

    // ========== DOMAIN B: Component Props Tests ==========

    // Test 5: Check sendMessageWrapper
    results.sendMessageWrapper = {
      test: 'sendMessageWrapper exists',
      passed: typeof sendMessageWrapper === 'function',
      value: typeof sendMessageWrapper
    };

    // Test 6: Test sendMessageWrapper execution
    if (sendMessageWrapper) {
      try {
        console.log('Testing sendMessageWrapper...');
        const result = await sendMessageWrapper('TEST: Direct message');
        results.sendMessageExecution = {
          test: 'sendMessageWrapper executes',
          passed: true,
          result: result
        };
      } catch (error: unknown) {
        results.sendMessageExecution = {
          test: 'sendMessageWrapper executes',
          passed: false,
          error: error.message
        };
      }
    }

    // Test 7: Check communicateWithMAS
    results.communicateWithMAS = {
      test: 'communicateWithMAS exists',
      passed: typeof communicateWithMAS === 'function',
      value: typeof communicateWithMAS
    };

    // Test 8: Test communicateWithMAS execution
    if (communicateWithMAS) {
      try {
        console.log('Testing communicateWithMAS...');
        const result = await communicateWithMAS('chat_message', {
          message: 'TEST: System message'
        });
        results.communicateExecution = {
          test: 'communicateWithMAS executes',
          passed: true,
          result: result
        };
      } catch (error: unknown) {
        results.communicateExecution = {
          test: 'communicateWithMAS executes',
          passed: false,
          error: error.message
        };
      }
    }

    // ========== DOMAIN C: State Observation ==========

    // Test 9: Monitor state changes
    const initialLength = chatMessages ? chatMessages.length : 0;

    // Try adding a message via different methods
    const testMessage = `TEST-${Date.now()}`;

    // Method 1: Direct state update
    try {
      setChatMessages(prev => [...(prev || []), {
        role: 'assistant',
        content: `Method1: ${testMessage}`
      }]);
      await new Promise(resolve => setTimeout(resolve, 200));

      results.method1Update = {
        test: 'Direct setChatMessages',
        passed: chatMessages && chatMessages.length > initialLength,
        oldLength: initialLength,
        newLength: chatMessages ? chatMessages.length : 0
      };
    } catch (error: unknown) {
      results.method1Update = {
        test: 'Direct setChatMessages',
        passed: false,
        error: error.message
      };
    }

    // ========== DOMAIN D: Console Analysis ==========

    // Check for console errors or warnings
    results.consoleCheck = {
      test: 'Check console for errors',
      note: 'Please check browser console for errors related to chat',
      checkFor: [
        'Cannot read property of undefined',
        'chatMessages is not defined',
        'setChatMessages is not a function',
        'Failed to execute'
      ]
    };

    setTestResults(results);
    setIsRunning(false);

    // Log all results to console for debugging
    console.log('=== CHAT DEBUG RESULTS ===');
    console.log(JSON.stringify(results, null, 2));
    console.log('Current chatMessages:', chatMessages);

    return results;
  };

  // Auto-run tests on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      runTests();
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      left: '20px',
      width: '400px',
      maxHeight: '60vh',
      background: 'black',
      color: 'lime',
      padding: '10px',
      borderRadius: '5px',
      fontSize: '12px',
      fontFamily: 'monospace',
      overflow: 'auto',
      zIndex: 10000,
      border: '2px solid lime'
    }}>
      <div style={{ marginBottom: '10px', borderBottom: '1px solid lime', paddingBottom: '5px' }}>
        <strong>🔍 CHAT DEBUGGER</strong>
        <button
          onClick={runTests}
          disabled={isRunning}
          style={{
            marginLeft: '10px',
            padding: '2px 8px',
            background: isRunning ? 'gray' : 'lime',
            color: 'black',
            border: 'none',
            borderRadius: '3px',
            cursor: isRunning ? 'not-allowed' : 'pointer'
          }}
        >
          {isRunning ? 'Running...' : 'Re-run Tests'}
        </button>
      </div>

      <div style={{ maxHeight: '50vh', overflow: 'auto' }}>
        {Object.entries(testResults).map(([key, result]) => (
          <div key={key} style={{
            marginBottom: '8px',
            padding: '5px',
            background: result.passed === true ? 'darkgreen' : result.passed === false ? 'darkred' : 'darkgray',
            borderRadius: '3px'
          }}>
            <div>
              {result.passed === true ? '✅' : result.passed === false ? '❌' : 'ℹ️'}
              {' '}<strong>{result.test || key}</strong>
            </div>
            {result.value !== undefined && (
              <div style={{ marginLeft: '20px', opacity: 0.8 }}>
                Value: {JSON.stringify(result.value)}
              </div>
            )}
            {result.error && (
              <div style={{ marginLeft: '20px', color: 'red' }}>
                Error: {result.error}
              </div>
            )}
            {result.result && (
              <div style={{ marginLeft: '20px', fontSize: '10px', opacity: 0.7 }}>
                Result: {JSON.stringify(result.result).substring(0, 100)}...
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ marginTop: '10px', borderTop: '1px solid lime', paddingTop: '5px' }}>
        <strong>Current State:</strong>
        <div style={{ fontSize: '10px' }}>
          Messages: {chatMessages ? chatMessages.length : 'null'}
        </div>
        {chatMessages && chatMessages.slice(-2).map((msg, i) => (
          <div key={i} style={{ fontSize: '10px', marginLeft: '10px' }}>
            [{msg.role}]: {msg.content?.substring(0, 50)}...
          </div>
        ))}
      </div>
    </div>
  );
};