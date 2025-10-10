// ReSpec Chat Integration Debug Script
// Run this in the browser console when the main app is loaded

console.log('🔍 Starting ReSpec Integration Debug...');

const DEBUG = {
    results: [],

    log(test, status, message, data = null) {
        const result = {
            test,
            status,
            message,
            data,
            timestamp: new Date().toISOString()
        };
        this.results.push(result);

        const emoji = status === 'pass' ? '✅' : status === 'fail' ? '❌' : 'ℹ️';
        console.log(`${emoji} [${test}] ${message}`, data ? data : '');

        return result;
    },

    async runAllTests() {
        console.log('\n🧪 Running All Integration Tests...\n');

        await this.testReactState();
        await this.testUCData();
        await this.testCommunicateWithMAS();
        await this.testChatFlow();
        await this.testReSpecService();

        console.log('\n📊 Test Summary:');
        const summary = this.results.reduce((acc, r) => {
            acc[r.status] = (acc[r.status] || 0) + 1;
            return acc;
        }, {});
        console.log(summary);

        return this.results;
    },

    async testReactState() {
        console.log('\n1️⃣ Testing React App State...');

        try {
            // Test if React components are accessible
            const app = document.querySelector('#root');
            this.log('React App Mount', app ? 'pass' : 'fail',
                `React app ${app ? 'found' : 'not found'} in DOM`);

            // Test if we can access React fiber for state inspection
            if (app && app._reactInternalFiber || app._reactInternals) {
                this.log('React Fiber', 'pass', 'React internals accessible');
            } else {
                this.log('React Fiber', 'info', 'React internals not directly accessible');
            }

            // Check for chat messages state by finding chat elements
            const chatMessages = document.querySelectorAll('[class*="message"], [class*="chat"]');
            this.log('Chat DOM Elements', chatMessages.length > 0 ? 'pass' : 'fail',
                `Found ${chatMessages.length} chat-related elements`);

            // Check for input elements
            const chatInput = document.querySelector('input[type="text"], textarea');
            this.log('Chat Input', chatInput ? 'pass' : 'fail',
                chatInput ? 'Chat input element found' : 'No chat input found');

        } catch (error) {
            this.log('React State Test', 'fail', error.message, error);
        }
    },

    async testUCData() {
        console.log('\n2️⃣ Testing UC Data Loading...');

        try {
            const response = await fetch('/uc_8.0_2.1.json');

            if (!response.ok) {
                this.log('UC Data Fetch', 'fail', `HTTP ${response.status}`);
                return;
            }

            const ucData = await response.json();
            this.log('UC Data Fetch', 'pass', 'UC data loaded successfully');

            // Validate new structure
            const requiredFields = ['metadata', 'scenarios', 'requirements', 'specifications'];
            requiredFields.forEach(field => {
                this.log(`UC Field: ${field}`, ucData[field] ? 'pass' : 'fail',
                    ucData[field] ? `${field} present` : `${field} missing`);
            });

            if (ucData.specifications) {
                const specCount = Object.keys(ucData.specifications).length;
                this.log('Spec Count', 'info', `${specCount} specifications loaded`);

                // Test a sample spec for form field mapping
                const sampleSpec = Object.values(ucData.specifications)[0];
                if (sampleSpec && sampleSpec.name) {
                    this.log('Spec Structure', 'pass', `Sample spec has name: ${sampleSpec.name}`);
                }
            }

        } catch (error) {
            this.log('UC Data Test', 'fail', error.message, error);
        }
    },

    async testCommunicateWithMAS() {
        console.log('\n3️⃣ Testing communicateWithMAS Function...');

        try {
            // Find the main app component and try to access communicateWithMAS
            const app = document.querySelector('#root');

            // Try to find communicateWithMAS in various ways
            let communicateWithMAS = null;

            // Method 1: Check if it's in global scope
            if (window.communicateWithMAS) {
                communicateWithMAS = window.communicateWithMAS;
                this.log('Function Location', 'pass', 'Found communicateWithMAS in global scope');
            }
            // Method 2: Try to find it in React component (more complex)
            else {
                this.log('Function Location', 'fail', 'communicateWithMAS not in global scope');

                // Suggest manual test
                this.log('Manual Test Required', 'info',
                    'To test communicateWithMAS, run this in console after loading the app:\n' +
                    'window.testCommunicate = communicateWithMAS; // from within React component');
                return;
            }

            // If we found it, test it
            if (communicateWithMAS) {
                // Test basic communication
                const testResult = await communicateWithMAS('chat_message', {
                    message: 'Debug test message'
                });

                this.log('Function Execution', 'pass', 'communicateWithMAS executed', testResult);

                // Validate response structure
                if (testResult && typeof testResult === 'object') {
                    this.log('Response Structure', 'pass', 'Valid response object received');

                    if (testResult.success !== undefined) {
                        this.log('Success Field', testResult.success ? 'pass' : 'info',
                            `Success: ${testResult.success}`);
                    }

                    if (testResult.message) {
                        this.log('Message Field', 'pass', `Message: ${testResult.message}`);
                    }
                } else {
                    this.log('Response Structure', 'fail', 'Invalid response structure');
                }
            }

        } catch (error) {
            this.log('CommunicateWithMAS Test', 'fail', error.message, error);
        }
    },

    async testChatFlow() {
        console.log('\n4️⃣ Testing Chat Flow...');

        try {
            // Find chat input and try to simulate user input
            const chatInput = document.querySelector('input[type="text"], textarea');

            if (!chatInput) {
                this.log('Chat Input', 'fail', 'No chat input element found');
                return;
            }

            this.log('Chat Input', 'pass', 'Chat input element found');

            // Test setting value
            const testMessage = 'Debug: I need 4 digital inputs';
            chatInput.value = testMessage;

            // Trigger React's onChange
            const event = new Event('input', { bubbles: true });
            chatInput.dispatchEvent(event);

            this.log('Input Simulation', 'pass', 'Test message set in input field');

            // Look for send button
            const sendButton = document.querySelector('button[type="submit"], button:contains("Send")');
            if (sendButton) {
                this.log('Send Button', 'pass', 'Send button found');

                // Don't actually click it in auto test, but indicate it's ready
                this.log('Ready for Manual Test', 'info',
                    'Manual test: Click send button or press Enter to test full flow');
            } else {
                this.log('Send Button', 'fail', 'Send button not found');
            }

            // Check for existing messages
            const existingMessages = document.querySelectorAll('[class*="message"]');
            this.log('Existing Messages', 'info', `${existingMessages.length} messages in chat`);

        } catch (error) {
            this.log('Chat Flow Test', 'fail', error.message, error);
        }
    },

    async testReSpecService() {
        console.log('\n5️⃣ Testing ReSpec Service...');

        try {
            // Check if ReSpec service is accessible
            if (window.respecService) {
                this.log('ReSpec Service', 'pass', 'ReSpec service found in global scope');

                // Test service methods
                if (typeof window.respecService.processChatMessage === 'function') {
                    this.log('ProcessChatMessage', 'pass', 'Method available');

                    try {
                        const testResult = await window.respecService.processChatMessage('test');
                        this.log('Service Execution', 'pass', 'Service executed', testResult);
                    } catch (error) {
                        this.log('Service Execution', 'fail', error.message, error);
                    }
                } else {
                    this.log('ProcessChatMessage', 'fail', 'Method not found');
                }
            } else {
                this.log('ReSpec Service', 'fail', 'ReSpec service not in global scope');

                // Suggest how to expose it for testing
                this.log('Expose Service', 'info',
                    'To test ReSpec service, add this to your React component:\n' +
                    'window.respecService = respecService; // for debugging');
            }

        } catch (error) {
            this.log('ReSpec Service Test', 'fail', error.message, error);
        }
    },

    // Helper function to find React props/state (advanced)
    findReactState() {
        const app = document.querySelector('#root');
        if (!app) return null;

        // Try different React internal properties
        const fiber = app._reactInternalFiber || app._reactInternals;
        if (!fiber) return null;

        // Navigate React fiber tree to find component with state
        let current = fiber.child;
        while (current) {
            if (current.stateNode && current.stateNode.state) {
                return current.stateNode.state;
            }
            current = current.child || current.sibling;
        }

        return null;
    }
};

// Export to global scope for easy access
window.DEBUG = DEBUG;

console.log('🔧 Debug tools loaded. Run DEBUG.runAllTests() to start comprehensive testing.');
console.log('📝 Individual tests: DEBUG.testReactState(), DEBUG.testUCData(), etc.');
console.log('📊 View results: DEBUG.results');