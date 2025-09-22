// reqMAS Type Definitions - DO NOT MODIFY STRUCTURE
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
  system: {
    processorType?: string[];
    memoryCapacity?: string[];
    storageCapacity?: string[];
    storageType?: string[];
  };
  io: {
    digitalInputs?: number;
    digitalOutputs?: number;
    analogInputs?: number;
    analogOutputs?: number;
    serialPorts?: string[];
  };
  communication: {
    ethernetPorts?: number;
    wirelessType?: string[];
    protocolSupport?: string[];
  };
  environmental: {
    operatingTemperature?: string;
    ingressProtection?: string;
    vibrationResistance?: string;
    cooling?: string;
    mounting?: string;
  };
  commercial: {
    budgetPerUnit?: string;
    certifications?: string[];
    warranty?: string;
  };
  constraints: Array<{
    id: string;
    value: any;
    confidence: number;
    source: 'user' | 'usecase' | 'autofill';
    category: string;
  }>;
}

export interface ChatEntry {
  timestamp: number;
  sender: 'user' | 'system';
  message: string;
  metadata?: any;
}

export interface DetectedUseCase {
  ucId: string;
  confidence: number;
  matchedKeywords: string[];
  impliedConstraints: string[];
}

export interface Conflict {
  id: string;
  type: 'certification' | 'budget' | 'technical' | 'incompatibility';
  constraints: string[];
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
}

export interface ClarificationRequest {
  questionId: string;
  question: string;
  options: Array<{
    id: string;
    label: string;
    resolvesConstraints: string[];
  }>;
  conflictId: string;
}

export type FlowStep = 
  | 'awaiting_input' 
  | 'extracting_requirements'
  | 'validating_constraints'
  | 'resolving_conflict'
  | 'acknowledging_requirements'
  | 'autofilling_specs'
  | 'completed';

export interface AgentThought {
  timestamp: number;
  agentId: string;
  thought: string;
  data?: any;
  decision?: string;
}