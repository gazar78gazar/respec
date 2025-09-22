import { useState, useEffect, useCallback } from 'react';
import { reqMASService, SharedState, ClarificationRequest, RequirementArtifact } from '../services/reqmas/ReqMASService';

interface UseReqMASReturn {
  // State
  connected: boolean;
  loading: boolean;
  error: string | null;
  chatMessages: any[];
  requirements: RequirementArtifact;
  currentStep: string;
  pendingClarification: ClarificationRequest | undefined;
  conflicts: number;
  
  // Actions
  sendMessage: (message: string) => Promise<void>;
  initializeSession: () => void;
  clearSession: () => void;
  getDebugInfo: () => any[];
}

export function useReqMAS(): UseReqMASReturn {
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<SharedState>(reqMASService.getPublicState());
  
  // Using frontend-only service, no client needed
  
  const initializeSession = useCallback(() => {
    setLoading(true);
    setError(null);
    
    try {
      // Load any saved state from localStorage
      reqMASService.loadState();
      setState(reqMASService.getPublicState());
      setConnected(true);
    } catch (err: any) {
      setError(err.message);
      setConnected(false);
    } finally {
      setLoading(false);
    }
  }, []);
  
  // Send message
  const sendMessage = useCallback(async (message: string) => {
    if (!connected) {
      initializeSession();
    }

    try {
      setLoading(true);
      setError(null);
      
      const result = await reqMASService.processMessage(message);
      setState(result.state);
      
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [connected, initializeSession]);
  
  // Clear session
  const clearSession = useCallback(() => {
    reqMASService.resetSession();
    setState(reqMASService.getPublicState());
    setConnected(false);
  }, []);
  
  // Get debug info
  const getDebugInfo = useCallback(() => {
    const state = reqMASService.getPublicState();
    return state.debugLog;
  }, []);
  
  // Initialize on mount
  useEffect(() => {
    initializeSession();
  }, []);
  
  return {
    connected,
    loading,
    error,
    chatMessages: state?.chatLog || [],
    requirements: state?.requirements || {
      system: {},
      io: {},
      communication: {},
      environmental: {},
      commercial: {},
      constraints: []
    } as RequirementArtifact,
    currentStep: state?.currentStep || 'awaiting_input',
    pendingClarification: state?.pendingClarification,
    conflicts: state?.conflicts?.length || 0,
    sendMessage,
    initializeSession,
    clearSession,
    getDebugInfo
  };
}