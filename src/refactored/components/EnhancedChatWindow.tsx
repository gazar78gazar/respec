import React, { useState, useRef, useEffect, useCallback } from "react";
import { MASCommunicationResult } from "../types/requirements.types";

// Enhanced ChatWindow with semantic feedback, confidence indicators, and conflict detection
interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  semanticMetadata?: {
    extractions?: Array<{
      category: string;
      value: string;
      confidence: number;
      ucSpec?: string;
    }>;
    intent: string;
    confidence: number;
    conflicts?: Array<{
      field: string;
      currentValue: string;
      newValue: string;
      severity: "warning" | "error";
    }>;
    formUpdates?: Array<{
      section: string;
      field: string;
      value: string;
      confidence: number;
    }>;
  };
  timestamp?: Date;
}

interface EnhancedChatWindowProps {
  onSendMessage: (message: string) => Promise<MASCommunicationResult>;
  messages: ChatMessage[];
  pendingClarification?: any;
  isLoading: boolean;
  width: number;
  onMouseDown: (e: React.MouseEvent) => void;
  isResizing: boolean;
  onConflictResolve?: (
    conflictId: string,
    resolution: "accept" | "reject" | "modify",
    newValue?: string
  ) => void;
}

export const EnhancedChatWindow: React.FC<EnhancedChatWindowProps> = ({
  onSendMessage,
  messages,
  pendingClarification,
  isLoading,
  width,
  onMouseDown,
  isResizing,
  onConflictResolve,
}) => {
  const inputRef = useRef<string>("");
  const [input, setInputState] = useState("");
  const [showExtractions, setShowExtractions] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Dual state management to prevent input loss
  const setInput = useCallback((value: string) => {
    inputRef.current = value;
    setInputState(value);
  }, []);

  // Restore input from ref on re-renders
  useEffect(() => {
    if (inputRef.current && inputRef.current !== input) {
      setInputState(inputRef.current);
    }
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      const maxHeight = 120; // ~5 lines
      const newHeight = Math.min(textareaRef.current.scrollHeight, maxHeight);
      textareaRef.current.style.height = `${newHeight}px`;
    }
  }, [input]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (input.trim() && !isLoading) {
      await onSendMessage(input);
      setInput("");
      // Reset textarea height after sending
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return "text-green-600 bg-green-50";
    if (confidence >= 0.6) return "text-yellow-600 bg-yellow-50";
    return "text-red-600 bg-red-50";
  };

  const getConfidenceText = (confidence: number) => {
    if (confidence >= 0.8) return "High";
    if (confidence >= 0.6) return "Medium";
    return "Low";
  };

  const renderSemanticMetadata = (
    metadata: ChatMessage["semanticMetadata"]
  ) => {
    if (!metadata || !showExtractions) return null;

    return (
      <div className="mt-2 p-3 bg-gray-50 border rounded-lg text-xs space-y-2">
        {/* Intent and Overall Confidence */}
        <div className="flex justify-between items-center">
          <span className="text-gray-600">
            Intent:{" "}
            <span className="font-medium capitalize">{metadata.intent}</span>
          </span>
          <span
            className={`px-2 py-1 rounded-full text-xs font-medium ${getConfidenceColor(
              metadata.confidence
            )}`}
          >
            {getConfidenceText(metadata.confidence)} Confidence
          </span>
        </div>

        {/* Extracted Requirements */}
        {metadata.extractions && metadata.extractions.length > 0 && (
          <div>
            <div className="font-medium text-gray-700 mb-1">
              Extracted Requirements:
            </div>
            <div className="space-y-1">
              {metadata.extractions.map((extraction, idx) => (
                <div
                  key={idx}
                  className="flex justify-between items-center bg-white p-2 rounded border"
                >
                  <div>
                    <span className="font-medium capitalize">
                      {extraction.category}:
                    </span>{" "}
                    {extraction.value}
                    {extraction.ucSpec && (
                      <span className="ml-2 text-gray-500">
                        ({extraction.ucSpec})
                      </span>
                    )}
                  </div>
                  <span
                    className={`px-1 py-0.5 rounded text-xs ${getConfidenceColor(
                      extraction.confidence
                    )}`}
                  >
                    {Math.round(extraction.confidence * 100)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Form Updates Applied */}
        {metadata.formUpdates && metadata.formUpdates.length > 0 && (
          <div>
            <div className="font-medium text-gray-700 mb-1">
              Form Updates Applied:
            </div>
            <div className="space-y-1">
              {metadata.formUpdates.map((update, idx) => (
                <div
                  key={idx}
                  className="flex justify-between items-center bg-blue-50 p-2 rounded border"
                >
                  <div>
                    <span className="font-medium">
                      {update.section}.{update.field}:
                    </span>{" "}
                    {update.value}
                  </div>
                  <span
                    className={`px-1 py-0.5 rounded text-xs ${getConfidenceColor(
                      update.confidence
                    )}`}
                  >
                    {Math.round(update.confidence * 100)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Conflicts Detected */}
        {metadata.conflicts && metadata.conflicts.length > 0 && (
          <div>
            <div className="font-medium text-red-700 mb-1">
              ⚠️ Conflicts Detected:
            </div>
            <div className="space-y-2">
              {metadata.conflicts.map((conflict, idx) => (
                <div
                  key={idx}
                  className="bg-red-50 border border-red-200 p-2 rounded"
                >
                  <div className="text-red-800 font-medium">
                    {conflict.field}
                  </div>
                  <div className="text-sm text-red-600">
                    Current:{" "}
                    <span className="font-mono">{conflict.currentValue}</span> →
                    New: <span className="font-mono">{conflict.newValue}</span>
                  </div>
                  <div className="flex space-x-2 mt-2">
                    <button
                      onClick={() =>
                        onConflictResolve?.(conflict.field, "accept")
                      }
                      className="px-2 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600"
                    >
                      Accept New
                    </button>
                    <button
                      onClick={() =>
                        onConflictResolve?.(conflict.field, "reject")
                      }
                      className="px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600"
                    >
                      Keep Current
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className="bg-white border-l shadow-lg flex flex-col relative"
      style={{ width: `${width}px` }}
    >
      {/* Resize Handle */}
      <div
        onMouseDown={onMouseDown}
        className={`absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 transition-colors ${
          isResizing ? "bg-blue-500" : "bg-gray-300"
        } group`}
      >
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-8 flex flex-col justify-between opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="w-1 h-1 bg-gray-600 rounded-full"></div>
          <div className="w-1 h-1 bg-gray-600 rounded-full"></div>
          <div className="w-1 h-1 bg-gray-600 rounded-full"></div>
        </div>
      </div>

      {/* Header with Controls */}
      <div className="bg-white border-b px-4 py-3">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-semibold text-gray-800">
            🤖 Semantic Requirements Assistant
          </h3>
          <button
            onClick={() => setShowExtractions(!showExtractions)}
            className="text-xs text-blue-600 hover:text-blue-800"
          >
            {showExtractions ? "Hide Details" : "Show Details"}
          </button>
        </div>
        {pendingClarification && (
          <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
            💬 Clarification needed
          </div>
        )}
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${
              msg.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-sm ${
                msg.role === "user" ? "w-auto" : "w-full"
              }`}
            >
              <div
                className={`p-3 rounded-lg text-sm ${
                  msg.role === "user"
                    ? "bg-blue-500 text-white"
                    : msg.role === "system"
                    ? "bg-purple-100 border border-purple-200 text-purple-800"
                    : "bg-white border border-gray-200 text-gray-800"
                }`}
              >
                {msg.content}
                {msg.timestamp && (
                  <div className="text-xs opacity-70 mt-1">
                    {msg.timestamp.toLocaleTimeString()}
                  </div>
                )}
              </div>

              {/* Semantic Metadata for Assistant Messages */}
              {msg.role === "assistant" &&
                msg.semanticMetadata &&
                renderSemanticMetadata(msg.semanticMetadata)}
            </div>
          </div>
        ))}

        {/* Pending Clarification */}
        {pendingClarification && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-sm font-medium mb-2">
              {pendingClarification.question}
            </p>
            <div className="space-y-2">
              {pendingClarification.options.map((option: any) => (
                <button
                  key={option.id}
                  onClick={() => onSendMessage(option.label)}
                  className="w-full text-left px-3 py-2 bg-white border rounded hover:bg-gray-50 text-sm"
                  disabled={isLoading}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 rounded-lg p-3 text-sm">
              <div className="flex items-center space-x-2">
                <div className="animate-spin h-3 w-3 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                <span>Analyzing requirements...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="bg-white border-t p-4">
        <div className="flex items-end space-x-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Describe your requirements... (e.g., 'I need an Intel i7 processor with 16GB RAM')"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none overflow-y-auto"
            style={{ minHeight: "38px" }}
            disabled={isLoading}
            rows={1}
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm disabled:opacity-50 flex-shrink-0"
          >
            {isLoading ? "⏳" : "📤"}
          </button>
        </div>
        <div className="mt-1 text-xs text-gray-500">
          💡 Press Enter to send, Shift+Enter for new line • Powered by semantic
          AI
        </div>
      </div>
    </div>
  );
};

export default EnhancedChatWindow;
