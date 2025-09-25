import React, { useState, useRef, useEffect, useCallback } from 'react';

// SAFE hybrid ChatWindow - preserves existing functionality while adding improvements
function ChatWindow({ onSendMessage, messages, pendingClarification, loading, width, onMouseDown, isResizing }: any) {
  // IMPROVEMENT: Better input state management with ref backup
  const inputRef = useRef<string>('');
  const [input, setInputState] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // IMPROVEMENT: Dual state management to prevent input loss
  const setInput = useCallback((value: string) => {
    inputRef.current = value;
    setInputState(value);
  }, []);

  // IMPROVEMENT: Restore input from ref on re-renders
  useEffect(() => {
    if (inputRef.current && inputRef.current !== input) {
      setInputState(inputRef.current);
    }
  }, []);

  // IMPROVEMENT: Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const maxHeight = 120; // ~5 lines
      const newHeight = Math.min(textareaRef.current.scrollHeight, maxHeight);
      textareaRef.current.style.height = `${newHeight}px`;
    }
  }, [input]);

  const handleSend = async () => {
    if (input.trim() && !loading) {
      await onSendMessage(input);
      setInput('');
      // Reset textarea height after sending
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  // IMPROVEMENT: Better keyboard handling
  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Send on Enter, but allow Shift+Enter for new lines
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      className="bg-white border-l shadow-lg flex flex-col relative"
      style={{ width: `${width}px` }} // PRESERVED: Dynamic width
    >
      {/* PRESERVED: Resize Handle */}
      <div
        onMouseDown={onMouseDown}
        className={`absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 transition-colors ${
          isResizing ? 'bg-blue-500' : 'bg-gray-300'
        } group`}
      >
        {/* Grip indicator */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-8 flex flex-col justify-between opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="w-1 h-1 bg-gray-600 rounded-full"></div>
          <div className="w-1 h-1 bg-gray-600 rounded-full"></div>
          <div className="w-1 h-1 bg-gray-600 rounded-full"></div>
        </div>
      </div>

      <div className="bg-white border-b px-4 py-3">
        <h3 className="text-sm font-semibold text-gray-800">Requirements Assistant</h3>
        {pendingClarification && (
          <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
            Clarification needed
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
        {/* PRESERVED: Correct data structure (role/content) */}
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-xs p-3 rounded-lg text-sm ${
                msg.role === 'user'
                  ? 'bg-blue-500 text-white'
                  : 'bg-white border border-gray-200 text-gray-800'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {pendingClarification && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-sm font-medium mb-2">{pendingClarification.question}</p>
            <div className="space-y-2">
              {pendingClarification.options.map(option => (
                <button
                  key={option.id}
                  onClick={() => onSendMessage(option.label)}
                  className="w-full text-left px-3 py-2 bg-white border rounded hover:bg-gray-50 text-sm"
                  disabled={loading}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="bg-white border-t p-4">
        {/* IMPROVEMENT: Better input with textarea */}
        <div className="flex items-end space-x-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your requirement..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none overflow-y-auto"
            style={{ minHeight: '38px' }}
            disabled={loading}
            rows={1}
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm disabled:opacity-50 flex-shrink-0"
          >
            {loading ? '...' : 'Send'}
          </button>
        </div>
        {/* IMPROVEMENT: Helpful hint */}
        <div className="mt-1 text-xs text-gray-500">
          Press Enter to send, Shift+Enter for new line
        </div>
      </div>
    </div>
  );
}

export default ChatWindow;