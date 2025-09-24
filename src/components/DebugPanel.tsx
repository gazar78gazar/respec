import React, { useState, useEffect } from 'react';

interface DebugPanelProps {
  communicateWithMAS?: (action: string, data: any) => Promise<any>;
  respecService?: any;
  chatMessages?: any[];
  sendMessageWrapper?: (message: string) => Promise<any>;
}

export const DebugPanel: React.FC<DebugPanelProps> = ({
  communicateWithMAS,
  respecService,
  chatMessages,
  sendMessageWrapper
}) => {
  const [testResults, setTestResults] = useState<string[]>([]);
  const [testMessage, setTestMessage] = useState('I need 8 digital inputs for my substation');

  useEffect(() => {
    // Expose functions to global scope for debugging
    if (communicateWithMAS) {
      (window as any).testCommunicateWithMAS = communicateWithMAS;
    }
    if (respecService) {
      (window as any).testRespecService = respecService;
    }
    if (sendMessageWrapper) {
      (window as any).testSendMessageWrapper = sendMessageWrapper;
    }

    console.log('🔧 Debug Panel: Functions exposed to global scope');
    console.log('- window.testCommunicateWithMAS');
    console.log('- window.testRespecService');
    console.log('- window.testSendMessageWrapper');
  }, [communicateWithMAS, respecService, sendMessageWrapper]);

  const addResult = (result: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${result}`]);
  };

  const testCommunicateWithMAS = async () => {
    if (!communicateWithMAS) {
      addResult('❌ communicateWithMAS not available');
      return;
    }

    try {
      addResult('🧪 Testing communicateWithMAS...');
      const result = await communicateWithMAS('chat_message', { message: testMessage });
      addResult(`✅ communicateWithMAS result: ${JSON.stringify(result)}`);
    } catch (error) {
      addResult(`❌ communicateWithMAS error: ${error}`);
    }
  };

  const testReSpecService = async () => {
    if (!respecService) {
      addResult('❌ respecService not available');
      return;
    }

    try {
      addResult('🧪 Testing ReSpec service...');
      const result = await respecService.processChatMessage(testMessage);
      addResult(`✅ ReSpec service result: ${JSON.stringify(result)}`);
    } catch (error) {
      addResult(`❌ ReSpec service error: ${error}`);
    }
  };

  const testSendMessageWrapper = async () => {
    if (!sendMessageWrapper) {
      addResult('❌ sendMessageWrapper not available');
      return;
    }

    try {
      addResult('🧪 Testing sendMessageWrapper...');
      const result = await sendMessageWrapper(testMessage);
      addResult(`✅ sendMessageWrapper result: ${JSON.stringify(result)}`);
    } catch (error) {
      addResult(`❌ sendMessageWrapper error: ${error}`);
    }
  };

  const testUCDataLoad = async () => {
    try {
      addResult('🧪 Testing UC data load...');
      const response = await fetch('/uc1.json');

      if (!response.ok) {
        addResult(`❌ UC data fetch failed: ${response.status}`);
        return;
      }

      const ucData = await response.json();
      addResult(`✅ UC data loaded: ${Object.keys(ucData.specifications || {}).length} specifications`);
    } catch (error) {
      addResult(`❌ UC data error: ${error}`);
    }
  };

  const clearResults = () => {
    setTestResults([]);
  };

  return (
    <div style={{
      position: 'fixed',
      top: '10px',
      left: '10px',
      width: '350px',
      maxHeight: '400px',
      backgroundColor: '#f8f9fa',
      border: '2px solid #007bff',
      borderRadius: '8px',
      padding: '12px',
      fontSize: '11px',
      zIndex: 1000,
      overflow: 'auto'
    }}>
      <h3 style={{ margin: '0 0 10px 0', color: '#007bff' }}>
        🔧 ReSpec Debug Panel
      </h3>

      <div style={{ marginBottom: '10px' }}>
        <label>Test Message:</label>
        <input
          type="text"
          value={testMessage}
          onChange={(e) => setTestMessage(e.target.value)}
          style={{
            width: '100%',
            padding: '5px',
            margin: '5px 0',
            border: '1px solid #ccc',
            borderRadius: '4px'
          }}
        />
      </div>

      <div style={{ marginBottom: '10px' }}>
        <button onClick={testCommunicateWithMAS} style={{ margin: '2px', padding: '5px 8px', fontSize: '11px' }}>
          Test communicateWithMAS
        </button>
        <button onClick={testReSpecService} style={{ margin: '2px', padding: '5px 8px', fontSize: '11px' }}>
          Test ReSpec Service
        </button>
        <button onClick={testSendMessageWrapper} style={{ margin: '2px', padding: '5px 8px', fontSize: '11px' }}>
          Test sendMessageWrapper
        </button>
        <button onClick={testUCDataLoad} style={{ margin: '2px', padding: '5px 8px', fontSize: '11px' }}>
          Test UC Data
        </button>
        <button onClick={clearResults} style={{ margin: '2px', padding: '5px 8px', fontSize: '11px', backgroundColor: '#dc3545', color: 'white' }}>
          Clear
        </button>
      </div>

      <div>
        <strong>Status:</strong>
        <div style={{ fontSize: '10px', color: '#666', marginBottom: '5px' }}>
          Chat Messages: {chatMessages?.length || 0} |
          Functions: {[
            communicateWithMAS ? 'communicate' : null,
            respecService ? 'respec' : null,
            sendMessageWrapper ? 'sendWrapper' : null
          ].filter(Boolean).join(', ') || 'none'}
        </div>
      </div>

      <div style={{
        maxHeight: '300px',
        overflowY: 'auto',
        backgroundColor: '#ffffff',
        border: '1px solid #ddd',
        borderRadius: '4px',
        padding: '8px'
      }}>
        {testResults.length === 0 ? (
          <div style={{ color: '#666', fontStyle: 'italic' }}>
            Click buttons above to run tests...
          </div>
        ) : (
          testResults.map((result, index) => (
            <div key={index} style={{
              padding: '2px 0',
              borderBottom: '1px solid #eee',
              fontSize: '10px',
              fontFamily: 'monospace'
            }}>
              {result}
            </div>
          ))
        )}
      </div>

      <div style={{ marginTop: '10px', fontSize: '10px', color: '#666' }}>
        Open console and run: DEBUG.runAllTests()
      </div>
    </div>
  );
};

export default DebugPanel;