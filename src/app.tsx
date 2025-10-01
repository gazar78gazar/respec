import { useState, useEffect, useCallback, useRef } from 'react';
import { Check, ChevronRight, ChevronDown, Download, Share, Wand2, AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { SimplifiedRespecService, EnhancedFormUpdate } from './services/respec/SimplifiedRespecService';
import * as uiUtils from './utils/uiUtilities';
import { dataServices } from './services/dataServices';
import './styles/animations.css';

// Import enhanced chat and conflict detection components
import EnhancedChatWindow from './components/EnhancedChatWindow';
import ConflictPanel from './components/ConflictPanel';
import { FieldConflict } from './services/respec/ConflictDetectionService';

// Import new artifact state management
import { ArtifactManager } from './services/respec/artifacts/ArtifactManager';
import { CompatibilityLayer } from './services/respec/artifacts/CompatibilityLayer';
import { ArtifactState } from './services/respec/artifacts/ArtifactTypes';
import { uc1ValidationEngine } from './services/respec/UC1ValidationEngine';

// Import TypeScript types
import type {
  Requirements,
  CrossFieldErrors,
  ChatMessage,
  FormUpdateEvent,
  MASCommunicationResult,
  StepHeaderProps,
  FieldData
} from './types/requirements.types';

// RequirementLegend component - removed as unused

// StepProgressIndicator component
const StepProgressIndicator = ({ currentStep, setCurrentStage, chatWindowWidth = 384 }: StepHeaderProps & { chatWindowWidth?: number }) => {
  const steps = [
    { id: 1, label: "Requirements", completed: currentStep > 1, current: currentStep === 1 },
    { id: 3, label: "Configure", completed: currentStep > 3, current: currentStep === 3 },
    { id: 4, label: "Finalize", completed: false, current: currentStep === 4 }
  ];

  const progressPercentage = ((currentStep - 1) / (steps.length - 1)) * 100;

  const handleStepNavigation = (stepId: number) => {
    if (stepId === 1) {
      setCurrentStage(1);
    }
    // Other steps are disabled for now
  };

  return (
    <div className="fixed bottom-0 left-0 bg-white border-t border-gray-200 px-6 py-4 z-10" style={{ right: `${chatWindowWidth}px` }}>
      <div className="max-w-3xl mx-auto">
        <div className="relative">
          {/* Background Track */}
          <div className="absolute top-1/2 left-0 right-0 h-1 bg-gray-200 rounded-full transform -translate-y-1/2"></div>
          
          {/* Progress Fill */}
          <div 
            className="absolute top-1/2 left-0 h-1 bg-blue-500 rounded-full transform -translate-y-1/2 transition-all duration-500"
            style={{ width: `${progressPercentage}%` }}
          ></div>
          
          {/* Stage Pills */}
          <div className="relative flex items-center justify-between">
            {steps.map((step) => (
              <button
                key={step.id}
                onClick={() => handleStepNavigation(step.id)}
                disabled={step.id !== 1}
                className={`
                  relative px-8 py-3 rounded-full font-medium text-sm
                  transition-all duration-300 transform hover:scale-105
                  ${
                    step.completed
                      ? "bg-blue-500 text-white shadow-lg hover:bg-blue-600"
                      : step.current
                      ? "bg-blue-500 text-white shadow-xl scale-105 ring-4 ring-blue-100"
                      : step.id === 1
                      ? "bg-white text-gray-600 border-2 border-gray-300 hover:border-blue-400 hover:text-blue-600"
                      : "bg-white text-gray-400 border-2 border-gray-300 cursor-not-allowed"
                  }
                `}
              >
                <div className="flex items-center">
                  {step.completed && (
                    <Check size={18} className="mr-2" strokeWidth={3} />
                  )}
                  <span className="whitespace-nowrap">{step.label}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// Standardized form specification with hierarchical structure: Areas → Categories → Specifications
const formFieldsData = {
  field_definitions: {
    // Area: Compute Performance
    compute_performance: {
      // Processing Category
      processor_type: {
        type: "dropdown",
        label: "Processor Type",
        options: [
          "Not Required",
          "Intel U300E",
          "Intel Atom",
          "Intel Core i3",
          "Intel Core i5",
          "Intel Core i7",
          "Intel Core i9"
        ],
        group: "processing"
      },
      ai_gpu_acceleration: {
        type: "dropdown",
        label: "AI/GPU Acceleration",
        options: [
          "Not Required",
          "Intel Xe Graphics",
          "Dedicated GPU Required"
        ],
        group: "processing"
      },
      // Memory Category
      memory_capacity: {
        type: "dropdown",
        label: "Memory Capacity",
        options: ["Not Required", "4GB", "8GB", "16GB", "32GB", "64GB"],
        group: "memory"
      },
      memory_type: {
        type: "dropdown",
        label: "Memory Type",
        options: ["Not Required", "DDR4", "DDR5"],
        group: "memory"
      },
      // Storage Category
      storage_capacity: {
        type: "dropdown",
        label: "Storage Capacity",
        options: ["Not Required", "128GB", "256GB", "512GB", "1TB", "2TB"],
        group: "storage"
      },
      storage_type: {
        type: "dropdown",
        label: "Storage Type",
        options: ["Not Required", "SATA SSD", "NVMe", "NVMe Gen4"],
        group: "storage"
      },
      // Response Time Category
      time_sensitive_features: {
        type: "multi-select",
        label: "Time Sensitive Features",
        options: [
          "Not Required",
          "TSN Support",
          "PTP IEEE1588",
          "Hardware Timestamping"
        ],
        group: "response_time"
      },
      response_latency: {
        type: "dropdown",
        label: "Response Latency",
        options: [
          "Not Required",
          "Standard Real-Time (<10ms)",
          "Near Real-Time (<20ms)",
          "Interactive (<50ms)",
          "Responsive (<100ms)"
        ],
        group: "response_time"
      },
      // Software Category
      operating_system: {
        type: "dropdown",
        label: "Operating System",
        options: [
          "Not Required",
          "Windows 11 IoT",
          "Ubuntu 20.04 LTS",
          "Ubuntu 22.04 LTS",
          "Real-Time Linux"
        ],
        group: "software"
      }
    },

    // Area: I/O & Connectivity
    io_connectivity: {
      // Core I/O Requirements Category
      digital_io: {
        type: "dropdown",
        label: "Digital IO",
        options: ["Not Required", "2", "4", "6", "8", "16", "32", "64", "Over 64"],
        group: "core_io"
      },
      analog_io: {
        type: "dropdown",
        label: "Analog IO",
        options: ["Not Required", "2", "4", "6", "8", "16", "32", "64", "Over 64"],
        group: "core_io"
      },
      // Ethernet Category
      ethernet_ports: {
        type: "dropdown",
        label: "Ethernet (RJ45) Ports",
        options: ["Not Required", "2", "4", "6", "8", "Over 8"],
        group: "ethernet"
      },
      ethernet_speed: {
        type: "dropdown",
        label: "Ethernet Speed",
        options: ["Not Required", "100 Mbps", "1 Gbps", "10 Gbps"],
        group: "ethernet"
      },
      ethernet_protocols: {
        type: "multi-select",
        label: "Ethernet Protocols",
        options: [
          "Not Required",
          "OPC UA",
          "MQTT",
          "PROFINET",
          "EtherCAT",
          "Ethernet/IP",
          "BACnet/IP",
          "Modbus TCP"
        ],
        group: "ethernet"
      },
      // Serial & USB Category
      usb_ports: {
        type: "dropdown",
        label: "USB Ports",
        options: ["Not Required", "2", "4", "6", "8", "Over 8"],
        group: "serial_usb"
      },
      serial_ports_amount: {
        type: "dropdown",
        label: "Serial Ports Amount",
        options: ["Not Required", "1", "2", "3", "4", "5", "6", "Over 6"],
        group: "serial_usb"
      },
      serial_port_type: {
        type: "multi-select",
        label: "Serial Port Type",
        options: ["Not Required", "RS-232", "RS-422", "RS-485"],
        group: "serial_usb"
      },
      // Industrial Protocols Category
      serial_protocol_support: {
        type: "dropdown",
        label: "Serial Protocol Support",
        options: ["Not Required", "CANbus", "TTL", "UART"],
        group: "industrial_protocols"
      },
      fieldbus_protocol_support: {
        type: "multi-select",
        label: "Fieldbus Protocol Support",
        options: [
          "Not Required",
          "Modbus RTU",
          "PROFIBUS",
          "DeviceNet",
          "CANOpen"
        ],
        group: "industrial_protocols"
      },
      // Wireless Category
      wireless_extension: {
        type: "multi-select",
        label: "Wireless Extension",
        options: [
          "Not Required",
          "WiFi 6",
          "WiFi 6E",
          "5G",
          "4G LTE",
          "LoRaWAN"
        ],
        group: "wireless"
      }
    },

    // Area: Form Factor
    form_factor: {
      // Power Requirements Category
      power_input: {
        type: "dropdown",
        label: "Power Input",
        options: ["Not Required", "9-36V DC", "18-36V DC", "24V DC", "PoE+"],
        group: "power_requirements"
      },
      max_power_consumption: {
        type: "dropdown",
        label: "Max Power Consumption",
        options: ["Not Required", "< 10W", "10-20W", "20-35W", "35-65W", "> 65W"],
        group: "power_requirements"
      },
      redundant_power: {
        type: "dropdown",
        label: "Redundant Power",
        options: ["Not Required", "Single", "Dual", "N+1"],
        group: "power_requirements"
      },
      dimensions: {
        type: "dropdown",
        label: "Dimensions",
        options: [
          "Not Required",
          "Ultra Compact (<100mm)",
          "Compact (100-200mm)",
          "Standard (200-300mm)",
          "Large (>300mm)"
        ],
        group: "power_requirements"
      },
      mounting: {
        type: "dropdown",
        label: "Mounting",
        options: [
          "Not Required",
          "19-inch Rack",
          "DIN Rail",
          "Compact",
          "Panel/Wall Mount",
          "Embedded"
        ],
        group: "power_requirements"
      }
    },

    // Area: Environment & Standards
    environment_standards: {
      // Environment Category
      operating_temperature: {
        type: "dropdown",
        label: "Operating Temperature",
        options: [
          "Not Required",
          "0°C to 50°C",
          "-20°C to 60°C",
          "-40°C to 70°C"
        ],
        group: "environment"
      },
      humidity: {
        type: "dropdown",
        label: "Humidity",
        options: [
          "Not Required",
          "+90% RH non-condensing",
          "+90% RH @ 40°C",
          "Condensing Allowed (100% RH)"
        ],
        group: "environment"
      },
      vibration_resistance: {
        type: "dropdown",
        label: "Vibration Resistance",
        options: ["Not Required", "Standard (2G)", "Heavy (5G)", "Extreme (10G)"],
        group: "environment"
      },
      ingress_protection: {
        type: "dropdown",
        label: "Ingress Protection",
        options: ["Not Required", "IP20", "IP40", "IP54", "IP65", "IP67", "IP69"],
        group: "environment"
      },
      // Standards Category
      vibration_protection: {
        type: "dropdown",
        label: "Vibration Protection",
        options: ["Not Required", "IEC 60068-2-64", "MIL-STD-810"],
        group: "standards"
      },
      certifications: {
        type: "multi-select",
        label: "Certifications",
        options: ["Not Required", "CE", "FCC", "UL", "CCC", "ATEX", "IECEx"],
        group: "standards"
      }
    },

    // Area: Commercial
    commercial: {
      // Pricing & Quantity Category
      budget_per_unit: {
        type: "number",
        label: "Budget Per Unit",
        min: 0,
        group: "pricing_quantity"
      },
      quantity: {
        type: "number",
        label: "Quantity",
        min: 1,
        max: 1000,
        group: "pricing_quantity"
      },
      total_budget: {
        type: "number",
        label: "Total Budget",
        min: 0,
        calculated: true, // Flag for auto-calculation
        group: "pricing_quantity"
      },
      // Logistics & Support Category
      delivery_timeframe: {
        type: "dropdown",
        label: "Delivery Timeframe",
        options: ["Not Required", "2 Weeks", "4 Weeks", "6 Weeks", "8 Weeks", "10 Weeks", "Over 10 Weeks"],
        group: "logistics_support"
      },
      shipping_incoterms: {
        type: "dropdown",
        label: "Shipping Incoterms",
        options: ["Not Required", "FOB", "CIF", "DDP", "EXW"],
        group: "logistics_support"
      },
      warranty_requirements: {
        type: "dropdown",
        label: "Warranty Requirements",
        options: ["Not Required", "1 Year", "2 Years", "3 Years", "5 Years"],
        group: "logistics_support"
      }
    }
  },

  field_groups: {
    compute_performance: {
      processing: {
        label: "Processing",
        fields: ["processor_type", "ai_gpu_acceleration"],
        defaultOpen: true
      },
      memory: {
        label: "Memory",
        fields: ["memory_capacity", "memory_type"],
        defaultOpen: false
      },
      storage: {
        label: "Storage",
        fields: ["storage_capacity", "storage_type"],
        defaultOpen: false
      },
      response_time: {
        label: "Response Time",
        fields: ["time_sensitive_features", "response_latency"],
        defaultOpen: false
      },
      software: {
        label: "Software",
        fields: ["operating_system"],
        defaultOpen: false
      }
    },
    io_connectivity: {
      core_io: {
        label: "Core I/O Requirements",
        fields: ["digital_io", "analog_io"],
        defaultOpen: true
      },
      ethernet: {
        label: "Ethernet",
        fields: ["ethernet_ports", "ethernet_speed", "ethernet_protocols"],
        defaultOpen: false
      },
      serial_usb: {
        label: "Serial & USB",
        fields: ["usb_ports", "serial_ports_amount", "serial_port_type"],
        defaultOpen: false
      },
      industrial_protocols: {
        label: "Industrial Protocols",
        fields: ["serial_protocol_support", "fieldbus_protocol_support"],
        defaultOpen: false
      },
      wireless: {
        label: "Wireless",
        fields: ["wireless_extension"],
        defaultOpen: false
      }
    },
    form_factor: {
      power_requirements: {
        label: "Power Requirements & Form Factor",
        fields: ["power_input", "max_power_consumption", "redundant_power", "dimensions", "mounting"],
        defaultOpen: true
      }
    },
    environment_standards: {
      environment: {
        label: "Environment",
        fields: ["operating_temperature", "humidity", "vibration_resistance", "ingress_protection"],
        defaultOpen: true
      },
      standards: {
        label: "Standards",
        fields: ["vibration_protection", "certifications"],
        defaultOpen: false
      }
    },
    commercial: {
      pricing_quantity: {
        label: "Pricing & Quantity",
        fields: ["budget_per_unit", "quantity", "total_budget"],
        defaultOpen: true
      },
      logistics_support: {
        label: "Logistics & Support",
        fields: ["delivery_timeframe", "shipping_incoterms", "warranty_requirements"],
        defaultOpen: false
      }
    }
  },

  // Priority system for required fields
  priority_system: {
    must_fields: ["digital_io", "analog_io", "ethernet_ports", "budget_per_unit", "quantity"],
    priority_levels: {
      "1": { fields: ["digital_io", "analog_io", "ethernet_ports", "budget_per_unit", "quantity"] },
      "2": { fields: ["processor_type", "memory_capacity", "storage_capacity"] },
      "3": { fields: ["operating_temperature", "ingress_protection"] },
      "4": { fields: ["serial_ports_amount", "usb_ports", "delivery_timeframe"] }
    }
  }
};

// Map sections to new standardized areas
const SECTION_MAPPING = {
  'Compute Performance': ['compute_performance'],
  'I/O & Connectivity': ['io_connectivity'],
  'Form Factor': ['form_factor'],
  'Environment & Standards': ['environment_standards'],
  'Commercial': ['commercial']
};

// Validation service functions for new standardized specification
const validateField = (fieldKey: string, value: any, fieldDef: any) => {
  const errors: string[] = [];

  // Handle "Not Required" as valid empty value
  if (value === "Not Required" || (Array.isArray(value) && value.includes("Not Required"))) {
    return errors; // Valid, no errors
  }

  // Check required fields
  if (fieldDef.required && (!value || value === '')) {
    errors.push({
      severity: 'error',
      message: `${fieldDef.label} is required`
    });
    return errors;
  }

  switch (fieldDef.type) {
    case 'number':
      const numValue = parseFloat(value);
      if (value && value !== '' && isNaN(numValue)) {
        errors.push({ severity: 'error', message: 'Must be a valid number' });
      } else if (value && value !== '') {
        if (fieldDef.min !== undefined && numValue < fieldDef.min) {
          errors.push({ severity: 'error', message: `Minimum value is ${fieldDef.min}` });
        }
        if (fieldDef.max !== undefined && numValue > fieldDef.max) {
          errors.push({ severity: 'error', message: `Maximum value is ${fieldDef.max}` });
        }
      }
      // Special handling for budget fields
      if (fieldKey === 'budget_per_unit' && value && value < 0) {
        errors.push({ severity: 'error', message: 'Budget cannot be negative' });
      }
      break;

    case 'text':
      // Note: budget fields are now 'number' type, not 'text'
      break;
    
    case 'date':
      if (value) {
        const selectedDate = new Date(value);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (selectedDate < today) {
          errors.push({ severity: 'warning', message: 'Date is in the past' });
        }
      }
      break;

    case 'dropdown':
      // Validate dropdown selection is in the allowed options
      if (value && value !== '' && fieldDef.options && !fieldDef.options.includes(value)) {
        errors.push({ severity: 'error', message: 'Please select a valid option' });
      }
      break;

    case 'multi-select':
      // Validate multi-select - all selected values must be in options
      if (value && Array.isArray(value) && value.length > 0) {
        const invalidOptions = value.filter(v => v !== "Not Required" && !fieldDef.options.includes(v));
        if (invalidOptions.length > 0) {
          errors.push({ severity: 'error', message: `Invalid options selected: ${invalidOptions.join(', ')}` });
        }
      }
      break;
  }

  return errors;
};

const validateCrossFields = (requirements: Requirements): CrossFieldErrors => {
  const crossFieldErrors: CrossFieldErrors = {};

  // Budget Calculation Validation - updated for new field names
  const commercial = requirements.commercial || {};
  if (commercial.budget_per_unit?.value && commercial.quantity?.value) {
    const unitBudget = parseFloat((commercial.budget_per_unit.value || 0).toString().replace(/[$,]/g, ''));
    const quantity = parseInt(commercial.quantity.value || 0);
    const calculatedTotal = unitBudget * quantity;

    // Note: total_budget is now auto-calculated, so this validation may not be needed
    // but keeping it for consistency check
    if (commercial.total_budget?.value) {
      const enteredTotal = parseFloat((commercial.total_budget.value || 0).toString().replace(/[$,]/g, ''));
      if (Math.abs(calculatedTotal - enteredTotal) > 0.01) {
        crossFieldErrors['commercial.total_budget'] = {
          severity: 'info',
          message: `Auto-calculated: ${calculatedTotal.toFixed(2)}`
        };
      }
    }
  }
  
  // I/O and Network Validation - updated for new field names
  const io = requirements.io_connectivity || {};
  const digitalIO = parseInt(io.digital_io?.value) || 0;
  const analogIO = parseInt(io.analog_io?.value) || 0;
  const totalIO = digitalIO + analogIO;

  // Check if ethernet ports value needs multiple ports
  if (totalIO > 32 && io.ethernet_ports?.value === "2") {
    crossFieldErrors['io_connectivity.ethernet_ports'] = {
      severity: 'warning',
      message: 'High I/O count typically requires 4+ ethernet ports for distributed I/O modules'
    };
  }
  
  // Power Consumption Validation - updated for new field names and structure
  const computing = requirements.compute_performance || {};
  const formFactor = requirements.form_factor || {};

  if (computing.processor_type?.value && formFactor.max_power_consumption?.value) {
    const processorType = computing.processor_type.value;
    const powerConsumption = formFactor.max_power_consumption.value;

    const powerRequirements = {
      'Intel Core i9': ['35-65W', '> 65W'],
      'Intel Core i7': ['35-65W', '> 65W'],
      'Intel Core i5': ['20-35W', '35-65W', '> 65W'],
      'Intel Core i3': ['10-20W', '20-35W', '35-65W'],
      'Intel Atom': ['< 10W', '10-20W', '20-35W'],
      'Intel U300E': ['< 10W', '10-20W']
    };

    const validPower = powerRequirements[processorType];
    if (validPower && powerConsumption !== 'Not Required' && !validPower.includes(powerConsumption)) {
      crossFieldErrors['form_factor.max_power_consumption'] = {
        severity: 'warning',
        message: `${processorType} typically requires: ${validPower.join(' or ')}`
      };
    }
  }
  
  // Temperature Range vs Processor Validation - updated for new field names
  const envStandards = requirements.environment_standards || {};
  if (envStandards.operating_temperature?.value && computing.processor_type?.value) {
    const temp = envStandards.operating_temperature.value;
    const processor = computing.processor_type.value;
    
    if (temp === '-40°C to 70°C' && (processor === 'Intel Core i7' || processor === 'Intel Core i9')) {
      crossFieldErrors['compute_performance.processor_type'] = {
        severity: 'warning',
        message: 'Extended temperature range may limit high-performance processor options'
      };
    }
  }
  
  // Wireless and Power Validation - updated for new field names
  if (io.wireless_extension?.value && formFactor.max_power_consumption?.value) {
    const wireless = Array.isArray(io.wireless_extension.value)
      ? io.wireless_extension.value
      : [];

    const highPowerWireless = ['5G', '4G LTE'];
    const hasHighPowerWireless = wireless.some(w => highPowerWireless.includes(w));

    if (hasHighPowerWireless && formFactor.max_power_consumption.value === '< 10W') {
      crossFieldErrors['form_factor.max_power_consumption'] = {
        severity: 'error',
        message: '5G/4G LTE modules require minimum 20W power budget'
      };
    }
  }
  
  // Storage and AI Validation - updated for new field names
  if (computing.ai_gpu_acceleration?.value === 'Dedicated GPU Required' &&
      computing.storage_capacity?.value === '64GB') {
    crossFieldErrors['compute_performance.storage_capacity'] = {
      severity: 'warning',
      message: 'AI/ML workloads with GPU typically require 256GB+ storage'
    };
  }
  
  // Industrial Protocol Requirements - updated for new field names
  if (io.serial_protocol_support?.value && io.serial_protocol_support.value !== 'Not Required' &&
      (!io.serial_ports_amount?.value || io.serial_ports_amount.value === 'Not Required')) {
    crossFieldErrors['io_connectivity.serial_ports_amount'] = {
      severity: 'info',
      message: 'Industrial protocols often benefit from RS-232/422/485 ports'
    };
  }
  
  return crossFieldErrors;
};

const autoCalculateFields = (changedField: string, newValue: any, requirements: Requirements) => {
  const updates = {};

  // Budget calculations - updated for new field names
  if (changedField === 'budget_per_unit' || changedField === 'quantity') {
    const commercial = requirements.commercial || {};
    const unitBudget = parseFloat((commercial.budget_per_unit?.value || 0).toString().replace(/[$,]/g, ''));
    const quantity = parseInt(commercial.quantity?.value || 0);

    if (changedField === 'budget_per_unit') {
      const newUnitBudget = parseFloat(newValue.toString().replace(/[$,]/g, ''));
      if (!isNaN(newUnitBudget) && quantity > 0) {
        updates['commercial.total_budget'] = (newUnitBudget * quantity).toFixed(2);
      }
    } else if (changedField === 'quantity') {
      const newQuantity = parseInt(newValue);
      if (!isNaN(unitBudget) && !isNaN(newQuantity) && unitBudget > 0) {
        updates['commercial.total_budget'] = (unitBudget * newQuantity).toFixed(2);
      }
    }
  }

  // Note: total_budget is read-only and auto-calculated, so no reverse calculation needed

  return updates;
};
const getNextMustField = (requirements) => {
  const mustFields = formFieldsData.priority_system.must_fields;
  for (const fieldKey of mustFields) {
    let found = false;
    Object.values(requirements).forEach(section => {
      if (section[fieldKey]?.isComplete) {
        found = true;
      }
    });
    if (!found) return fieldKey;
  }
  return null;
};

function App() {
  const [currentStage, setCurrentStage] = useState(1);
  const [activeTab, setActiveTab] = useState('Compute Performance');
  const [requirements, setRequirements] = useState<Requirements>({});
  const [expandedGroups, setExpandedGroups] = useState({});
  const [fieldValidations, setFieldValidations] = useState({});
  const [crossFieldValidations, setCrossFieldValidations] = useState<CrossFieldErrors>({});

  // New artifact state management (additive - preserves existing functionality)
  const [artifactManager, setArtifactManager] = useState<ArtifactManager | null>(null);
  const [compatibilityLayer, setCompatibilityLayer] = useState<CompatibilityLayer | null>(null);
  const [artifactState, setArtifactState] = useState<ArtifactState | null>(null);
  const [projectName] = useState('Untitled Project');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { id: 'initial', role: 'assistant', content: 'How can I help you with filling out these requirements?', timestamp: new Date() }
  ]);
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef(null);

  // Conflict detection state
  const [activeConflicts, setActiveConflicts] = useState<FieldConflict[]>([]);
  const [showConflicts, setShowConflicts] = useState(true);

  // ReSpec service initialization
  // const [respecService] = useState(() => new ReSpecService(
  const [simplifiedRespecService] = useState(() => new SimplifiedRespecService());
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('');

  const [loading, setLoading] = useState(false);
  const [chatWidth, setChatWidth] = useState(384); // Default 24rem = 384px
  const [isResizing, setIsResizing] = useState(false);

  // Debug trace system for tracking all system operations
  const [debugTrace, setDebugTrace] = useState<Array<{
    id: number;
    timestamp: string;
    action: string;
    details: any;
    status: 'SUCCESS' | 'FAILED' | 'BLOCKED' | 'WARNING';
  }>>([]);

  // Field permissions system for user override control
  const [fieldPermissions, setFieldPermissions] = useState<Record<string, {
    allowSystemOverride: boolean;
    grantedAt: string;
    grantedBy: string;
  }>>({});

  // Resize handler functions
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return;

    const newWidth = window.innerWidth - e.clientX;
    // Constrain between min (320px) and max (600px)
    const constrainedWidth = Math.min(600, Math.max(320, newWidth));
    setChatWidth(constrainedWidth);
  }, [isResizing]);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  // Add mouse event listeners for resize
  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      // Prevent text selection while resizing
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'col-resize';
    } else {
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isResizing, handleMouseMove, handleMouseUp]);

  // === Debug Trace Function ===
  const addTrace = useCallback((
    action: string,
    details: any,
    status: 'SUCCESS' | 'FAILED' | 'BLOCKED' | 'WARNING'
  ) => {
    const entry = {
      timestamp: new Date().toISOString(),
      action,
      details,
      status,
      id: Date.now()
    };

    console.log(`[TRACE] ${entry.timestamp} | ${action} | ${status}`, details);
    setDebugTrace(prev => [...prev.slice(-100), entry]); // Keep last 100 entries
  }, []);

  // === Validation Functions for System Updates ===
  const validateSystemFieldUpdate = useCallback((section: string, field: string, value: any, allowOverride: boolean = false): boolean => {
    try {
      // Rule 1: Check user field protection with permission system
      const currentField = requirements[section]?.[field];
      if (currentField?.source === 'user' && currentField?.value !== '' && currentField?.value !== null) {
        const permissionKey = `${section}.${field}`;
        const hasPermission = fieldPermissions[permissionKey]?.allowSystemOverride;

        if (!allowOverride || !hasPermission) {
          console.error(`[BLOCKED] Cannot overwrite user field ${section}.${field} without permission`);
          addTrace('field_update_blocked', { section, field, reason: 'no_permission' }, 'BLOCKED');
          return false;
        }

        console.warn(`[OVERRIDE] Overwriting user field ${section}.${field} with permission`);
        addTrace('field_override', { section, field, value }, 'WARNING');
      }

      // Rule 2: Validate field exists in form definition
      const fieldExists = formFieldsData.field_definitions[section]?.[field];
      if (!fieldExists) {
        console.error(`[UI-MAS] Invalid field reference: ${section}.${field}`);
        addTrace('field_validation_failed', { section, field, reason: 'field_not_exists' }, 'FAILED');
        return false;
      }

      // Rule 3: Validate value type matches field definition
      const fieldDef = formFieldsData.field_definitions[section][field];
      if (fieldDef.type === 'dropdown' && fieldDef.options && !fieldDef.options.includes(value)) {
        console.warn(`[UI-MAS] Invalid dropdown value for ${section}.${field}: ${value}`);
        return false;
      }

      if (fieldDef.type === 'number' && value !== null && value !== '' && isNaN(Number(value))) {
        console.warn(`[UI-MAS] Invalid number value for ${section}.${field}: ${value}`);
        return false;
      }

      return true;
    } catch (error: unknown) {
      console.error(`[UI-MAS] Validation error for ${section}.${field}:`, error);
      return false;
    }
  }, [requirements, addTrace, fieldPermissions]);

  const validateSystemMessage = useCallback((message: string): boolean => {
    try {
      // Rule 1: Prevent infinite message loops
      const recentSystemMessages = chatMessages
        .slice(-5)
        .filter(msg => msg.role === 'assistant')
        .length;

      if (recentSystemMessages >= 3) {
        console.warn('[UI-MAS] System message rate limit exceeded');
        return false;
      }

      // Rule 2: Validate message content
      if (!message || typeof message !== 'string' || message.trim().length === 0) {
        console.warn('[UI-MAS] Invalid message content');
        return false;
      }

      return true;
    } catch (error: unknown) {
      console.error('[UI-MAS] Message validation error:', error);
      return false;
    }
  }, [chatMessages]);

  // Conflict resolution handler
  const handleConflictResolve = async (
    conflictId: string,
    action: 'accept' | 'reject' | 'modify',
    newValue?: string
  ) => {
    try {
      const resolution = await simplifiedRespecService.resolveConflict(conflictId, action, newValue);

      if (resolution.applied && action === 'accept') {
        // Apply the form update if conflict was accepted
        const conflict = activeConflicts.find(c => c.id === conflictId);
        if (conflict) {
          await updateField(conflict.section, conflict.field.split('.')[1], resolution.newValue || conflict.newValue, false);
        }
      }

      console.log(`[APP] Conflict ${conflictId} resolved with action: ${action}`);
    } catch (error) {
      console.error('[APP] Failed to resolve conflict:', error);
    }
  };

  // Chat message handler for ReSpec
  const sendMessageWrapper = async (message: string) => {
    if (!loading) {
      setLoading(true);
      try {
        // Add user message to chat immediately
        setChatMessages(prev => [...prev, {
          role: 'user',
          content: message,
          timestamp: new Date()
        }]);

        // Send to NEW ReSpec for processing
        const result = await communicateWithMAS('chat_message', { message });

        // Add ReSpec's system response to chat with semantic metadata
        if (result.success && result.message) {
          const chatMessage: any = {
            role: 'assistant',
            content: result.message,
            timestamp: new Date()
          };

          // Add semantic metadata if available
          if ((result as any).semanticMetadata) {
            chatMessage.semanticMetadata = (result as any).semanticMetadata;
          }

          setChatMessages(prev => [...prev, chatMessage]);
        }

        return result;
      } catch (error: unknown) {
        console.error('[UI-ReSpec] Chat message failed:', error);

        // Add error message to chat instead of throwing
        setChatMessages(prev => [...prev, {
          role: 'assistant',
          content: 'Sorry, I encountered an error processing your message. Please try again.'
        }]);

        return { success: false, error: 'Processing failed' };
      } finally {
        setLoading(false);
      }
    }
  };

  // Value mapping function to translate AI outputs to form-compatible values
  const mapValueToFormField = (section: string, field: string, value: any) => {
    console.log(`[DEBUG] Mapping value for ${section}.${field}:`, { inputValue: value, inputType: typeof value });

    // Handle boolean values that need to be converted to specific options
    if (value === true || value === 'true') {
      switch (field) {
        case 'wireless_extension':
        case 'wirelessExtension':
          return 'WiFi'; // Default WiFi option
        case 'ethernet_ports':
        case 'networkPorts':
          return '2'; // Default 2 ports
        default:
          return value;
      }
    }

    // Handle AI-returned text that needs mapping to specific dropdown values
    if (typeof value === 'string') {
      const lowerValue = value.toLowerCase();

      switch (field) {
        case 'wireless_extension':
        case 'wirelessExtension':
          if (lowerValue.includes('wifi') || lowerValue.includes('wi-fi')) {
            return 'WiFi';
          }
          if (lowerValue.includes('lte')) return 'LTE';
          if (lowerValue.includes('5g')) return '5G';
          if (lowerValue.includes('lora')) return 'LoRa';
          if (lowerValue.includes('none') || lowerValue.includes('not required')) return 'None';
          return 'WiFi'; // Default fallback

        case 'analog_io':
        case 'analogIO':
          // Ensure analog IO values are valid options
          const validAnalogOptions = ["None", "2", "4", "8", "16", "32", "64"];
          if (validAnalogOptions.includes(value)) return value;
          // Try to extract number from string
          const analogMatch = value.match(/(\d+)/);
          if (analogMatch) {
            const num = analogMatch[1];
            if (validAnalogOptions.includes(num)) return num;
          }
          return '4'; // Default fallback

        case 'digital_io':
        case 'digitalIO':
          // Similar logic for digital IO
          const validDigitalOptions = ["None", "2", "4", "8", "16", "32", "64"];
          if (validDigitalOptions.includes(value)) return value;
          const digitalMatch = value.match(/(\d+)/);
          if (digitalMatch) {
            const num = digitalMatch[1];
            if (validDigitalOptions.includes(num)) return num;
          }
          return '8'; // Default fallback

        case 'ethernet_ports':
        case 'networkPorts':
          if (lowerValue.includes('2') || lowerValue.includes('two')) return '2';
          if (lowerValue.includes('4') || lowerValue.includes('four')) return '4';
          if (lowerValue.includes('8') || lowerValue.includes('eight')) return '8';
          return '2'; // Default fallback
      }
    }

    // Handle numeric values
    if (typeof value === 'number') {
      switch (field) {
        case 'analog_io':
        case 'analogIO':
        case 'digital_io':
        case 'digitalIO':
          return value.toString(); // Convert to string for dropdown
        default:
          return value;
      }
    }

    console.log(`[DEBUG] No mapping found for ${section}.${field}, using original value:`, value);
    return value;
  };

  // === UNIFIED Communication Hub using SimplifiedRespecService ===
  const communicateWithMAS = async (action: string, data: any): Promise<MASCommunicationResult> => {
    console.log(`[UI-RESPEC] ${action}:`, data);

    setIsProcessing(true);

    try {
      switch (action) {
        case 'chat_message':
          setProcessingMessage('Processing your message...');
          addTrace('chat_message', { message: data.message }, 'SUCCESS');
          const chatResult = await simplifiedRespecService.processChatMessage(data.message, requirements);

          setChatMessages(prev => [...prev, {
            role: 'assistant',
            content: chatResult.systemMessage
          }]);

          if (chatResult.formUpdates && chatResult.formUpdates.length > 0) {
            console.log(`[DEBUG] Chat message returned ${chatResult.formUpdates.length} form updates:`, chatResult.formUpdates);
            addTrace('chat_form_updates', { count: chatResult.formUpdates.length, updates: chatResult.formUpdates }, 'SUCCESS');

            chatResult.formUpdates.forEach((update: EnhancedFormUpdate) => {
              console.log(`[DEBUG] Processing chat update:`, {
                section: update.section,
                field: update.field,
                value: update.value,
                isAssumption: update.isAssumption
              });

              // Map the value to a form-compatible value
              const mappedValue = mapValueToFormField(update.section, update.field, update.value);
              console.log(`[DEBUG] Value mapped from ${update.value} to ${mappedValue}`);

              setRequirements(prev => {
                const newReqs = {
                  ...prev,
                  [update.section]: {
                    ...prev[update.section],
                    [update.field]: {
                      ...prev[update.section]?.[update.field],
                      value: mappedValue,
                      isComplete: true,
                      isAssumption: update.isAssumption || false,
                      dataSource: (update.isAssumption || false) ? 'assumption' : 'requirement',
                      priority: prev[update.section]?.[update.field]?.priority || 1,
                      source: 'system',
                      lastUpdated: new Date().toISOString(),
                      toggleHistory: prev[update.section]?.[update.field]?.toggleHistory || []
                    }
                  }
                };

                console.log(`[DEBUG] Chat update applied to requirements:`, {
                  field: `${update.section}.${update.field}`,
                  oldValue: prev[update.section]?.[update.field],
                  newValue: newReqs[update.section][update.field]
                });

                return newReqs;
              });

              // Post-update verification for chat-triggered field updates
              setTimeout(() => {
                setRequirements(currentReqs => {
                  const actualValue = currentReqs[update.section]?.[update.field]?.value;
                  const expectedValue = mappedValue;

                  if (actualValue !== expectedValue) {
                    console.error(`[CHAT VALIDATION FAILED] Field ${update.section}.${update.field}: expected "${expectedValue}", got "${actualValue}"`);
                    addTrace('chat_field_verification', {
                      section: update.section,
                      field: update.field,
                      expected: expectedValue,
                      actual: actualValue,
                      source: 'chat_message'
                    }, 'FAILED');
                  } else {
                    console.log(`[CHAT VALIDATION OK] Field ${update.section}.${update.field} = "${actualValue}"`);
                    addTrace('chat_field_verification', {
                      section: update.section,
                      field: update.field,
                      value: actualValue,
                      source: 'chat_message'
                    }, 'SUCCESS');
                  }

                  return currentReqs; // Return unchanged state
                });
              }, 150); // Slightly longer delay for chat updates

              // Handle substitution notes from enhanced updates
              if (update.substitutionNote) {
                setChatMessages(prev => [...prev, {
                  id: `sub-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                  role: 'system',
                  content: `📝 ${update.substitutionNote}`,
                  timestamp: new Date(),
                  metadata: {
                    isAssumption: false,
                    confidence: update.confidence || 0.9
                  }
                }]);
                console.log(`[DEBUG] Added substitution note for ${update.section}.${update.field}:`, update.substitutionNote);
                addTrace('substitution_note', {
                  section: update.section,
                  field: update.field,
                  originalRequest: update.originalRequest,
                  substitutionNote: update.substitutionNote
                }, 'SUCCESS');
              }
            });
          }

          if (chatResult.clarificationNeeded) {
            setClarificationRequest(chatResult.clarificationNeeded);
          }

          return { success: true };

        case 'form_update':
          if (data.source === 'user') {
            setProcessingMessage('Noting selection...');
            addTrace('form_update', { section: data.section, field: data.field, value: data.value }, 'SUCCESS');
            const formResult = await simplifiedRespecService.processFormUpdate(
              data.section,
              data.field,
              data.value
            );

            if (formResult.acknowledgment) {
              setChatMessages(prev => [...prev, {
                role: 'assistant',
                content: formResult.acknowledgment
              }]);
            }
          }
          return { success: true };

        case 'trigger_autofill':
          setProcessingMessage('Generating defaults...');
          addTrace('trigger_autofill', { trigger: data.trigger }, 'SUCCESS');
          const autofillResult = await simplifiedRespecService.triggerAutofill(data.trigger);

          setChatMessages(prev => [...prev, {
            role: 'assistant',
            content: autofillResult.message
          }]);

          autofillResult.fields.forEach(field => {
            const currentValue = requirements[field.section]?.[field.field]?.value;

            if (!currentValue || currentValue === '') {
              setRequirements(prev => ({
                ...prev,
                [field.section]: {
                  ...prev[field.section],
                  [field.field]: {
                    ...prev[field.section]?.[field.field],
                    value: field.value,
                    isComplete: true,
                    isAssumption: true,
                    dataSource: 'assumption',
                    priority: prev[field.section]?.[field.field]?.priority || 1,
                    source: 'system',
                    lastUpdated: new Date().toISOString(),
                    toggleHistory: prev[field.section]?.[field.field]?.toggleHistory || []
                  }
                }
              }));
            }
          });

          return { success: true };

        case 'autofill':
          // Map old autofill action to trigger_autofill
          return await communicateWithMAS('trigger_autofill', { trigger: data.section });

        case 'system_populate_field':
          // Populate single form field from system
          try {
            // Validate field update with permission checking
            if (!validateSystemFieldUpdate(data.section, data.field, data.value)) {
              addTrace('system_populate_field', { section: data.section, field: data.field, value: data.value, reason: 'validation_failed' }, 'FAILED');
              return { success: false, error: 'Field validation failed' };
            }

            addTrace('system_populate_field', { section: data.section, field: data.field, value: data.value }, 'SUCCESS');
            console.log(`[DEBUG] system_populate_field called with:`, {
              section: data.section,
              field: data.field,
              value: data.value,
              isSystemGenerated: data.isSystemGenerated,
              rawData: data
            });

            // Map the value to a form-compatible value
            const mappedValue = mapValueToFormField(data.section, data.field, data.value);
            console.log(`[DEBUG] System populate value mapped from ${data.value} to ${mappedValue}`);

            setProcessingMessage('Updating field...');
            setRequirements(prev => {
              const newValue = {
                ...prev,
                [data.section]: {
                  ...prev[data.section],
                  [data.field]: {
                    ...prev[data.section]?.[data.field],
                    value: mappedValue,
                    isComplete: true,
                    isAssumption: data.isSystemGenerated || false,
                    dataSource: (data.isSystemGenerated || false) ? 'assumption' : 'requirement',
                    priority: prev[data.section]?.[data.field]?.priority || 1,
                    source: 'system',
                    lastUpdated: new Date().toISOString(),
                    toggleHistory: prev[data.section]?.[data.field]?.toggleHistory || []
                  }
                }
              };

              console.log(`[DEBUG] Updated requirements for ${data.section}.${data.field}:`, {
                oldValue: prev[data.section]?.[data.field],
                newValue: newValue[data.section][data.field],
                fullSection: newValue[data.section]
              });

              return newValue;
            });

            // Post-update verification - verify the state was actually updated
            setTimeout(() => {
              // Access current requirements state for verification
              setRequirements(currentReqs => {
                const actualValue = currentReqs[data.section]?.[data.field]?.value;
                const expectedValue = mappedValue;

                if (actualValue !== expectedValue) {
                  console.error(`[VALIDATION FAILED] Field ${data.section}.${data.field}: expected "${expectedValue}", got "${actualValue}"`);
                  addTrace('system_populate_field_verification', {
                    section: data.section,
                    field: data.field,
                    expected: expectedValue,
                    actual: actualValue
                  }, 'FAILED');
                } else {
                  console.log(`[VALIDATION OK] Field ${data.section}.${data.field} = "${actualValue}"`);
                  addTrace('system_populate_field_verification', {
                    section: data.section,
                    field: data.field,
                    value: actualValue
                  }, 'SUCCESS');
                }

                return currentReqs; // Return unchanged state
              });
            }, 100);

            return { success: true };
          } catch (error: unknown) {
            console.error(`[UI-RESPEC] System field update failed:`, error);
            addTrace('system_populate_field', { section: data.section, field: data.field, error: (error as Error).message }, 'FAILED');
            return { success: false, error };
          }

        case 'system_populate_multiple':
          // Populate multiple form fields from system
          try {
            addTrace('system_populate_multiple', { count: data.updates?.length || 0 }, 'SUCCESS');
            setProcessingMessage('Updating multiple fields...');
            setRequirements(prev => {
              const updated = { ...prev };
              data.updates.forEach(update => {
                if (!updated[update.section]) updated[update.section] = {};
                updated[update.section][update.field] = {
                  ...updated[update.section]?.[update.field],
                  value: update.value,
                  isComplete: true,
                  isAssumption: update.isSystemGenerated || false,
                  dataSource: (update.isSystemGenerated || false) ? 'assumption' : 'requirement',
                  priority: updated[update.section]?.[update.field]?.priority || 1,
                  source: 'system',
                  lastUpdated: new Date().toISOString(),
                  toggleHistory: updated[update.section]?.[update.field]?.toggleHistory || []
                };
              });
              return updated;
            });
            return { success: true };
          } catch (error: unknown) {
            console.error(`[UI-RESPEC] System multiple update failed:`, error);
            return { success: false, error };
          }

        case 'system_send_message':
          // Add system message to chat
          try {
            setChatMessages(prev => [...prev, {
              role: 'assistant',
              content: data.message
            }]);
            return { success: true };
          } catch (error: unknown) {
            console.error(`[UI-RESPEC] System message failed:`, error);
            return { success: false, error };
          }

        case 'system_toggle_assumption':
          try {
            const { section, field, reason } = data;
            const currentField = requirements[section]?.[field];

            if (!currentField) {
              console.error(`[TOGGLE FAILED] Field not found: ${section}.${field}`);
              addTrace('toggle_assumption', { section, field }, 'FAILED');
              return { success: false };
            }

            const previousState = currentField.isAssumption ? 'assumption' : 'requirement';
            const newState = !currentField.isAssumption ? 'assumption' : 'requirement';

            setRequirements(prev => ({
              ...prev,
              [section]: {
                ...prev[section],
                [field]: {
                  ...prev[section][field],
                  isAssumption: !currentField.isAssumption,
                  dataSource: newState,
                  toggleHistory: [
                    ...(currentField.toggleHistory || []),
                    {
                      timestamp: new Date().toISOString(),
                      from: previousState,
                      to: newState,
                      triggeredBy: 'system',
                      reason
                    }
                  ]
                }
              }
            }));

            console.log(`[TOGGLE] ${section}.${field}: ${previousState} -> ${newState}`);
            addTrace('toggle_assumption', { section, field, from: previousState, to: newState }, 'SUCCESS');

            return { success: true, newState };
          } catch (error: unknown) {
            console.error(`[TOGGLE ERROR]`, error);
            addTrace('toggle_assumption', { error: (error as Error).message }, 'FAILED');
            return { success: false, error };
          }

        case 'grant_override_permission':
          try {
            const permissionKey = `${data.section}.${data.field}`;

            setFieldPermissions(prev => ({
              ...prev,
              [permissionKey]: {
                allowSystemOverride: true,
                grantedAt: new Date().toISOString(),
                grantedBy: data.grantedBy || 'user_action'
              }
            }));

            console.log(`[PERMISSION GRANTED] ${permissionKey}`);
            addTrace('permission_granted', { section: data.section, field: data.field }, 'SUCCESS');

            return { success: true };
          } catch (error: unknown) {
            console.error(`[PERMISSION ERROR]`, error);
            addTrace('permission_granted', { error: (error as Error).message }, 'FAILED');
            return { success: false, error };
          }

        case 'revoke_override_permission':
          try {
            const revokeKey = `${data.section}.${data.field}`;

            setFieldPermissions(prev => {
              const updated = { ...prev };
              delete updated[revokeKey];
              return updated;
            });

            console.log(`[PERMISSION REVOKED] ${revokeKey}`);
            addTrace('permission_revoked', { section: data.section, field: data.field }, 'SUCCESS');

            return { success: true };
          } catch (error: unknown) {
            console.error(`[PERMISSION ERROR]`, error);
            addTrace('permission_revoked', { error: (error as Error).message }, 'FAILED');
            return { success: false, error };
          }

        default:
          console.warn(`[UI-RESPEC] Unknown action: ${action}`);
          addTrace('unknown_action', { action }, 'WARNING');
          return { success: false };
      }
    } catch (error: unknown) {
      console.error(`[UI-RESPEC] Error:`, error);
      return { success: false, error };
    } finally {
      setIsProcessing(false);
      setProcessingMessage('');
    }
  };

  // Note: ReSpec will provide MAS capabilities through communicateWithMAS

  // ReSpec will handle requirement mapping through communicateWithMAS

  // REPLACE the entire initialization useEffect with:
  useEffect(() => {
    const initializeApp = async () => {
      const initialRequirements = {};
      const initialExpanded = {};

      Object.entries(formFieldsData.field_definitions).forEach(([section, fields]) => {
        initialRequirements[section] = {};
        initialExpanded[section] = {};

        Object.entries(fields).forEach(([fieldKey, fieldDef]) => {
          initialRequirements[section][fieldKey] = {
            value: '',
            isComplete: false,
            isAssumption: false,
            dataSource: 'requirement',
            priority: getPriority(fieldKey),
            source: 'user',
            lastUpdated: new Date().toISOString(),
            toggleHistory: []
          };
        });
      });

      // Initialize group expansion states
      Object.entries(formFieldsData.field_definitions).forEach(([section, fields]) => {
        if (formFieldsData.field_groups[section]) {
          Object.entries(formFieldsData.field_groups[section]).forEach(([groupKey, groupDef]) => {
            initialExpanded[section][groupKey] = groupDef.defaultOpen || false;
          });
        }
      });

      setRequirements(initialRequirements);
      setExpandedGroups(initialExpanded);

      // Initialize Simplified Respec service
      try {
        setProcessingMessage('Initializing...');
        setIsProcessing(true);
        await simplifiedRespecService.initialize(formFieldsData.field_definitions);
        const sessionId = simplifiedRespecService.getSessionId();
        console.log('[APP] Simplified Respec initialized:', sessionId);
      } catch (err) {
        console.error('[APP] Simplified Respec init failed:', err);
      } finally {
        setIsProcessing(false);
        setProcessingMessage('');
      }

      // Initialize new artifact state management system (additive)
      try {
        console.log('[APP] Initializing artifact state management...');

        // Load UC1 schema
        await uc1ValidationEngine.loadSchema('/uc1.json');

        // Initialize artifact manager
        const manager = new ArtifactManager(uc1ValidationEngine);
        await manager.initialize();
        setArtifactManager(manager);

        // Initialize compatibility layer
        const compatibility = new CompatibilityLayer(manager, uc1ValidationEngine);
        setCompatibilityLayer(compatibility);

        // Initialize semantic matching in SimplifiedRespecService
        simplifiedRespecService.initializeSemanticMatching(
          uc1ValidationEngine,
          manager,
          compatibility
        );

        // Set up conflict detection listener
        const unsubscribeConflicts = simplifiedRespecService.onConflictChange((conflicts) => {
          setActiveConflicts(conflicts);
          // Auto-show conflicts panel if there are critical/error conflicts
          const hasCriticalConflicts = conflicts.some(c => c.severity === 'critical' || c.severity === 'error');
          if (hasCriticalConflicts) {
            setShowConflicts(true);
          }
        });

        // Store unsubscribe function for cleanup
        return unsubscribeConflicts;

        // Get initial artifact state
        const initialArtifactState = manager.getState();
        setArtifactState(initialArtifactState);

        console.log('[APP] Artifact state management initialized successfully');
      } catch (err) {
        console.error('[APP] Artifact state management init failed:', err);
        // Non-blocking - existing functionality continues to work
      }
    };

    initializeApp();
  }, []);

  // ReSpec requirements synchronization will happen through communicateWithMAS polling

  // ReSpec bi-directional state sync - ready for ReSpec integration
  useEffect(() => {
    const syncInterval = setInterval(() => {
      // TODO: ReSpec integration
      // When ReSpec is integrated, this will:
      // 1. Call ReSpec.getPublicState() to get requirements and pendingUIUpdates
      // 2. Process any pending updates through communicateWithMAS
      // 3. Call ReSpec.clearPendingUIUpdates() after processing

      // For now, this is a placeholder that ensures the polling structure is in place
      console.log('[UI-ReSpec] Polling ready - waiting for ReSpec integration');
    }, 5000); // Reduced frequency until ReSpec is integrated

    return () => clearInterval(syncInterval);
  }, []);

  // Sync requirements with new artifact state management (additive)
  useEffect(() => {
    if (!compatibilityLayer || !artifactManager) return;

    const syncToArtifacts = async () => {
      try {
        // Sync current requirements to artifact state (correct direction)
        const syncResult = compatibilityLayer.syncRequirementsToArtifact(requirements);

        if (syncResult.updated.length > 0) {
          console.log(`[APP] Synced ${syncResult.updated.length} fields to artifact state:`, syncResult.updated);

          // Update artifact state and trigger conflict detection
          const updatedArtifactState = artifactManager.getState();
          setArtifactState(updatedArtifactState);

          // Run conflict detection
          artifactManager.detectConflicts().then(conflictResult => {
            if (conflictResult.hasConflict) {
              console.warn('[APP] CONFLICTS DETECTED:', conflictResult.conflicts);
              conflictResult.conflicts.forEach(conflict => {
                console.warn(`🚨 Conflict: ${conflict.description}`);
                console.warn(`   Resolution: ${conflict.resolution}`);
              });
            } else {
              console.log('[APP] No conflicts detected');
            }
          }).catch(error => {
            console.error('[APP] Conflict detection failed:', error);
          });
        }

        if (syncResult.errors.length > 0) {
          console.warn('[APP] Artifact sync errors:', syncResult.errors);
        }
      } catch (error) {
        console.error('[APP] Artifact sync failed:', error);
        // Non-blocking - existing functionality continues
      }
    };

    syncToArtifacts();
  }, [requirements, compatibilityLayer, artifactManager]);

  const toggleGroup = (section, group) => {
    setExpandedGroups(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [group]: !prev[section]?.[group]
      }
    }));
  };

  const getPriority = (fieldKey) => {
    for (const [level, config] of Object.entries(formFieldsData.priority_system.priority_levels)) {
      if (config.fields.includes(fieldKey)) {
        return parseInt(level);
      }
    }
    return 4;
  };

  // Helper function to map sections - ready for ReSpec integration
  const mapSectionToCategory = (section: string): string => {
    const mapping: Record<string, string> = {
      'performance_computing': 'system',
      'io_connectivity': 'io',
      'power_environment': 'environmental',
      'commercial': 'commercial'
    };
    return mapping[section] || 'system';
  };

  // Helper function to find which section contains a field
  const findFieldSection = (fieldKey: string): string => {
    for (const [section, fields] of Object.entries(formFieldsData.field_definitions)) {
      if (fields[fieldKey]) {
        return section;
      }
    }
    return 'performance_computing'; // default
  };

  const updateField = useCallback((section: string, field: string, value: any, isAssumption = false, source = 'user') => {
    // Update the field value
    setRequirements(prev => {
      const updated = {
        ...prev,
        [section]: {
          ...prev[section],
          [field]: {
            ...prev[section][field],
            value,
            isComplete: value !== '' && value !== null,
            isAssumption,
            lastUpdated: new Date().toISOString(),
            source // Use the provided source parameter
          }
        }
      };
      
      // Auto-calculate dependent fields
      const autoUpdates = autoCalculateFields(field, value, updated);
      Object.entries(autoUpdates).forEach(([path, autoValue]) => {
        const [autoSection, autoField] = path.split('.');
        if (autoSection && autoField) {
          updated[autoSection][autoField] = {
            ...updated[autoSection][autoField],
            value: autoValue,
            isComplete: true,
            isAssumption: false,
            dataSource: 'requirement',
            priority: updated[autoSection][autoField]?.priority || 1,
            source: 'system',
            lastUpdated: new Date().toISOString(),
            toggleHistory: updated[autoSection][autoField]?.toggleHistory || []
          };
        }
      });
      
      return updated;
    });

    // Form changes already notified to ReSpec via communicateWithMAS at the end of updateField
    
    // Run field-level validation and add animations
    const fieldDef = formFieldsData.field_definitions[section]?.[field];
    if (fieldDef) {
      const errors = validateField(field, value, fieldDef);
      if (errors.length > 0) {
        setFieldValidations(prev => ({
          ...prev,
          [`${section}.${field}`]: errors[0]
        }));
        // Flash field with error animation
        uiUtils.flashField(`field-${field}`, 'error');
      } else {
        setFieldValidations(prev => {
          const updated = { ...prev };
          delete updated[`${section}.${field}`];
          return updated;
        });
        // Flash field with success animation
        if (value && value !== '') {
          uiUtils.flashField(`field-${field}`, 'success');
        }
      }
    }
    
    // Auto-expand group if filling a required field
    if (fieldDef?.group && formFieldsData.priority_system.must_fields.includes(field)) {
      setExpandedGroups(prev => ({
        ...prev,
        [section]: {
          ...prev[section],
          [fieldDef.group]: true
        }
      }));
    }

    // Check for conflicts if this is a manual or semantic update
    if (source !== 'system') {
      simplifiedRespecService.detectFieldConflicts(
        `${section}.${field}`,
        value,
        requirements,
        source === 'user' ? 'manual' : 'semantic'
      ).catch(error => {
        console.warn('[APP] Conflict detection failed:', error);
      });
    }

    // Notify MAS of form changes
    communicateWithMAS('form_update', { field: `${section}.${field}`, value, isAssumption });
  }, []);
  
  // Run cross-field validations when requirements change
  useEffect(() => {
    const errors = validateCrossFields(requirements);
    setCrossFieldValidations(errors);
  }, [requirements]);

  // Auto-save functionality
  useEffect(() => {
    const timer = setTimeout(() => {
      // Convert requirements to format expected by dataServices
      const formattedRequirements = {};
      Object.entries(requirements).forEach(([section, fields]) => {
        Object.entries(fields).forEach(([fieldKey, fieldData]) => {
          if (fieldData.value && fieldData.value !== '') {
            formattedRequirements[fieldKey] = {
              value: fieldData.value,
              priority: fieldData.priority,
              isAssumption: fieldData.isAssumption,
              required: formFieldsData.priority_system.must_fields.includes(fieldKey)
            };
          }
        });
      });
      if (Object.keys(formattedRequirements).length > 0) {
        dataServices.project.autoSave(formattedRequirements, projectName);
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [requirements, projectName]);

  const calculateCompletion = () => {
    // Convert requirements to format expected by uiUtils
    const formattedRequirements = {};
    Object.entries(requirements).forEach(([section, fields]) => {
      Object.entries(fields).forEach(([fieldKey, fieldData]) => {
        formattedRequirements[fieldKey] = {
          value: fieldData.value,
          priority: fieldData.priority,
          isAssumption: fieldData.isAssumption
        };
      });
    });
    return uiUtils.calculateCompletionScore(formattedRequirements);
  };

  const calculateAccuracy = () => {
    const TOTAL_FIELDS = 37; // Total number of fields in the system
    const REQUIREMENT_WEIGHT = 100 / TOTAL_FIELDS; // ~2.7% per field
    const ASSUMPTION_WEIGHT = 60 / TOTAL_FIELDS;   // ~1.62% per field

    let accuracyScore = 0;
    let fieldCount = 0;

    // Count all fields across all sections
    Object.values(requirements).forEach(section => {
      Object.values(section).forEach(field => {
        fieldCount++;

        if (field.isComplete) {
          if (!field.isAssumption) {
            // Field is a requirement (confirmed/verified data)
            accuracyScore += REQUIREMENT_WEIGHT;
          } else {
            // Field is an assumption (inferred/estimated data)
            accuracyScore += ASSUMPTION_WEIGHT;
          }
        }
        // Missing/incomplete fields contribute 0 to accuracy
      });
    });

    // Validate we have 37 fields total (optional check)
    if (fieldCount !== TOTAL_FIELDS) {
      console.warn(`Field count mismatch: Expected ${TOTAL_FIELDS}, found ${fieldCount}`);
    }

    // Return accuracy capped at 100% and rounded to 1 decimal
    return Math.min(100, Math.round(accuracyScore * 10) / 10);
  };

  const getMustFieldsStatus = () => {
    const mustFields = formFieldsData.priority_system.must_fields;
    let completed = 0;
    const missing = [];
    
    mustFields.forEach(fieldKey => {
      let found = false;
      Object.values(requirements).forEach(section => {
        if (section[fieldKey]?.isComplete) {
          found = true;
          completed++;
        }
      });
      if (!found) {
        missing.push(fieldKey);
      }
    });
    
    return { total: mustFields.length, completed, missing };
  };

  const canProceedToNextStage = () => {
    // Check if all must fields are complete
    const mustFields = formFieldsData.priority_system.must_fields;
    for (const fieldKey of mustFields) {
      let found = false;
      Object.values(requirements).forEach(section => {
        if (section[fieldKey]?.isComplete) {
          found = true;
        }
      });
      if (!found) return false;
    }
    
    // Check for critical errors
    const hasErrors = Object.values(fieldValidations).some(v => v.severity === 'error') ||
                     Object.values(crossFieldValidations).some(v => v.severity === 'error');
    
    return !hasErrors;
  };

  const scrollToField = (fieldKey) => {
    // Find which section contains this field
    for (const [section, fields] of Object.entries(formFieldsData.field_definitions)) {
      if (fields[fieldKey]) {
        const fieldDef = fields[fieldKey];
        // Expand the group containing this field
        if (fieldDef.group) {
          setExpandedGroups(prev => ({
            ...prev,
            [section]: {
              ...prev[section],
              [fieldDef.group]: true
            }
          }));
        }
        // Find the right tab and activate it
        for (const [tab, sections] of Object.entries(SECTION_MAPPING)) {
          if (sections.includes(section)) {
            setActiveTab(tab);
            break;
          }
        }
        // Scroll to field after state updates
        setTimeout(() => {
          const element = document.getElementById(`field-${fieldKey}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            element.focus();
          }
        }, 100);
        break;
      }
    }
  };

  const autofillAll = async () => {
    await communicateWithMAS('trigger_autofill', {
      trigger: 'button_header'
    });
  };

  const autofillSection = (tabName: string) => {
    // Use MAS for autofill
    communicateWithMAS('autofill', { section: tabName });

    const sections = SECTION_MAPPING[tabName];
    const updatedRequirements = { ...requirements };
    
    sections.forEach(section => {
      Object.entries(formFieldsData.field_definitions[section] || {}).forEach(([fieldKey, fieldDef]) => {
        if (!updatedRequirements[section][fieldKey].isComplete && fieldDef.autofill_default) {
          updatedRequirements[section][fieldKey] = {
            ...updatedRequirements[section][fieldKey],
            value: fieldDef.autofill_default,
            isComplete: true,
            isAssumption: true,
            dataSource: 'assumption',
            priority: updatedRequirements[section][fieldKey]?.priority || 1,
            source: 'system',
            lastUpdated: new Date().toISOString(),
            toggleHistory: updatedRequirements[section][fieldKey]?.toggleHistory || []
          };
        }
      });
    });
    
    setRequirements(updatedRequirements);
  };

  const handleExport = async () => {
    try {
      // Convert requirements to format expected by dataServices
      const formattedRequirements = {};
      Object.entries(requirements).forEach(([section, fields]) => {
        Object.entries(fields).forEach(([fieldKey, fieldData]) => {
          formattedRequirements[fieldKey] = {
            value: fieldData.value,
            priority: fieldData.priority,
            isAssumption: fieldData.isAssumption,
            required: formFieldsData.priority_system.must_fields.includes(fieldKey)
          };
        });
      });
      
      const metadata = {
        name: projectName,
        created: new Date(),
        lastModified: new Date(),
        description: 'Industrial requirements project'
      };
      
      const blob = await dataServices.export.exportToPDF(formattedRequirements, metadata);
      dataServices.utils.downloadBlob(blob, dataServices.utils.generateFilename(projectName.replace(/\s+/g, '_'), 'pdf'));
    } catch (error: unknown) {
      console.error('Export failed:', error);
      alert('Export failed: ' + error.message);
    }
  };

  const handleChatSubmit = async () => {
    if (!chatInput.trim()) return;

    const message = chatInput.trim();

    setChatMessages(prev => [...prev, {
      role: 'user',
      content: message
    }]);

    setChatInput('');

    // Check for special triggers
    const lower = message.toLowerCase();
    if (lower.includes("don't know") || lower.includes("not sure")) {
      await communicateWithMAS('trigger_autofill', {
        trigger: 'dont_know'
      });
    } else if (lower.includes("autofill") || lower.includes("fill")) {
      await communicateWithMAS('trigger_autofill', {
        trigger: 'chat_request'
      });
    } else {
      await communicateWithMAS('chat_message', {
        message
      });
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 's':
            e.preventDefault();
            // Save project
            (async () => {
              try {
                const formattedRequirements = {};
                Object.entries(requirements).forEach(([section, fields]) => {
                  Object.entries(fields).forEach(([fieldKey, fieldData]) => {
                    if (fieldData.value && fieldData.value !== '') {
                      formattedRequirements[fieldKey] = {
                        value: fieldData.value,
                        priority: fieldData.priority,
                        isAssumption: fieldData.isAssumption,
                        required: formFieldsData.priority_system.must_fields.includes(fieldKey)
                      };
                    }
                  });
                });
                const metadata = {
                  name: projectName,
                  created: new Date(),
                  lastModified: new Date(),
                  description: 'Industrial requirements project'
                };
                await dataServices.project.saveProject(projectName, formattedRequirements, metadata);
                // Show success feedback
                uiUtils.flashField('project-header', 'success');
              } catch (error: unknown) {
                console.error('Save failed:', error);
              }
            })();
            break;
          case 'e':
            if (!e.shiftKey) {
              e.preventDefault();
              // Export
              handleExport();
            }
            break;
          case 'S':
            if (e.shiftKey) {
              e.preventDefault();
              // Share (placeholder)
              alert('Share functionality: Ctrl+Shift+S pressed');
            }
            break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [requirements, projectName, handleExport]);

  const mustFieldsStatus = getMustFieldsStatus();
  const nextField = getNextMustField(requirements);


  return (
    <div className="flex h-screen bg-gray-50">
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        
        {/* Stage Header */}
        <div id="project-header" className="bg-white px-6 py-3 border-b shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-xl font-bold">Requirements</h1>
              <span className="text-sm text-gray-500">{projectName}</span>
            </div>
            
            {/* Action Buttons */}
            <div className="flex items-center space-x-2">
              <button 
                onClick={autofillAll}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-sm font-medium flex items-center"
              >
                <Wand2 className="w-4 h-4 mr-2" />
                Autofill All
              </button>
              
              <button 
                disabled
                className="p-2 bg-white border border-gray-300 rounded-md text-gray-400 cursor-not-allowed flex items-center justify-center"
              >
                <Share size={16} />
              </button>
              
              <button 
                onClick={handleExport}
                className="p-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md flex items-center justify-center"
              >
                <Download size={16} />
              </button>
              
              <button 
                disabled
                className="px-4 py-2 bg-green-600 text-white rounded font-medium hover:bg-green-700 transition-all duration-200 opacity-50 cursor-not-allowed"
              >
                Configure
              </button>
            </div>
          </div>
        </div>

        {/* Progress Indicators */}
        <div className="bg-white px-6 py-4 border-b">
          <div className="flex gap-6">
            <div className="w-1/4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm text-gray-600">Completion</span>
                <span className="text-sm font-medium">{calculateCompletion()}%</span>
              </div>
              <div className="w-48 bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${calculateCompletion()}%` }}
                />
              </div>
            </div>
            
            <div className="w-1/4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm text-gray-600">Accuracy</span>
                <span className="text-sm font-medium">{calculateAccuracy()}%</span>
              </div>
              <div className="w-48 bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-green-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${calculateAccuracy()}%` }}
                />
              </div>
            </div>
            
            <div className="w-1/2">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm text-gray-600">Key Requirements Left:</span>
                <span className="text-sm font-medium">{mustFieldsStatus.missing.length}</span>
              </div>
              <div className="mt-2">
                <div className="flex flex-wrap gap-2">
                  {mustFieldsStatus.missing.map(field => {
                    const fieldDef = Object.values(formFieldsData.field_definitions)
                      .flatMap(section => Object.entries(section))
                      .find(([key]) => key === field)?.[1];
                    return (
                      <button
                        key={field}
                        onClick={() => scrollToField(field)}
                        className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded hover:bg-amber-200 transition-colors"
                      >
                        {fieldDef?.label || field}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>


        {/* ReSpec error handling will be managed through communicateWithMAS */}

        {/* Tabs */}
        <div className="bg-white px-6 py-3 border-b">
          <div className="flex space-x-8">
            {Object.keys(SECTION_MAPPING).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`
                  pb-2 text-sm font-medium transition-all
                  ${activeTab === tab 
                    ? 'text-blue-600 border-b-2 border-blue-600' 
                    : 'text-gray-500 hover:text-gray-700'}
                `}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Form Content */}
        <div className="flex-1 overflow-auto p-6">
          {currentStage === 1 && (
            <RequirementsForm 
              activeTab={activeTab}
              requirements={requirements}
              updateField={updateField}
              autofillSection={autofillSection}
              expandedGroups={expandedGroups}
              toggleGroup={toggleGroup}
            />
          )}
          {currentStage === 2 && (
            <RequirementsReview requirements={requirements} />
          )}
        </div>

        {/* Add bottom padding to account for fixed navigation */}
        <div className="h-20"></div>
      </div>

      {/* Enhanced Chat Panel */}
      <EnhancedChatWindow
        onSendMessage={sendMessageWrapper}
        messages={chatMessages}
        pendingClarification={null}
        loading={loading}
        width={chatWidth}
        onMouseDown={handleMouseDown}
        isResizing={isResizing}
        onConflictResolve={handleConflictResolve}
        currentRequirements={requirements}
      />

      {/* Conflict Panel */}
      {activeConflicts.length > 0 && showConflicts && (
        <div className="fixed bottom-4 right-4 w-96 max-h-80 z-50">
          <ConflictPanel
            conflicts={activeConflicts}
            onResolveConflict={handleConflictResolve}
            onDismissConflict={(conflictId) => {
              // Remove conflict from active list
              setActiveConflicts(prev => prev.filter(c => c.id !== conflictId));
            }}
          />
        </div>
      )}

      {/* Conflict Toggle Button */}
      {activeConflicts.length > 0 && (
        <button
          onClick={() => setShowConflicts(!showConflicts)}
          className={`fixed bottom-4 right-4 w-12 h-12 rounded-full shadow-lg flex items-center justify-center text-white font-semibold z-40 ${
            activeConflicts.some(c => c.severity === 'critical' || c.severity === 'error')
              ? 'bg-red-500 hover:bg-red-600'
              : 'bg-yellow-500 hover:bg-yellow-600'
          }`}
          title={`${activeConflicts.length} conflicts detected`}
        >
          ⚠️
        </button>
      )}
      
      {/* Step Progress Indicator */}
      <StepProgressIndicator
        currentStep={currentStage}
        setCurrentStage={setCurrentStage}
        chatWindowWidth={chatWidth}
      />

      {/* Debug Panel - Temporarily disabled for testing
      <DebugPanel
        communicateWithMAS={communicateWithMAS}
        respecService={simplifiedRespecService}
        chatMessages={chatMessages}
        sendMessageWrapper={sendMessageWrapper}
      />
      */}

      {/* Processing Indicator */}
      {isProcessing && (
        <div className="fixed bottom-20 right-8 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 z-50">
          <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
          <span>{processingMessage || 'Processing...'}</span>
        </div>
      )}

    </div>
  );
}

// Requirements Form Component with Accordions
function RequirementsForm({ activeTab, requirements, updateField, autofillSection, expandedGroups, toggleGroup }) {
  const sections = SECTION_MAPPING[activeTab] || [];
  
  return (
    <div className="bg-white rounded-lg shadow-sm">
      {/* Section Header */}
      <div className="px-6 py-4 border-b flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-800">
          {activeTab} Specifications
        </h3>
        
        <div className="flex items-center space-x-4">
          <button
            onClick={() => autofillSection(activeTab)}
            className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 rounded text-sm font-medium flex items-center"
          >
            <Wand2 className="w-4 h-4 mr-1" />
            Autofill
          </button>
          
          <div className="flex items-center space-x-6 text-sm text-gray-600">
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 rounded-full bg-blue-200 flex items-center justify-center">
                <Check size={10} className="text-blue-700" />
              </div>
              <span>Requirement</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 rounded-full bg-amber-200 flex items-center justify-center">
                <AlertTriangle size={10} className="text-amber-700" />
              </div>
              <span>Assumption</span>
            </div>
          </div>
        </div>
      </div>

      {/* Accordion Groups */}
      <div className="p-6">
        {sections.map(section => {
          const groups = formFieldsData.field_groups[section];
          if (!groups) return null;
          
          return (
            <div key={section} className="space-y-4">
              {Object.entries(groups).map(([groupKey, groupDef]) => {
                const isExpanded = expandedGroups[section]?.[groupKey] || false;
                const groupFields = groupDef.fields.map(fieldKey => ({
                  fieldKey,
                  fieldDef: formFieldsData.field_definitions[section][fieldKey],
                  data: requirements[section]?.[fieldKey]
                })).filter(f => f.fieldDef);
                
                const completedInGroup = groupFields.filter(f => f.data?.isComplete).length;
                const totalInGroup = groupFields.length;
                
                return (
                  <div key={groupKey} className="border rounded-lg overflow-hidden">
                    <button
                      onClick={() => toggleGroup(section, groupKey)}
                      className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 flex items-center justify-between transition-colors"
                    >
                      <div className="flex items-center">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 mr-2 text-gray-600" />
                        ) : (
                          <ChevronRight className="w-4 h-4 mr-2 text-gray-600" />
                        )}
                        <span className="font-medium text-gray-800">{groupDef.label}</span>
                        <span className="ml-3 text-sm text-gray-500">
                          ({completedInGroup}/{totalInGroup} completed)
                        </span>
                      </div>
                      
                      {completedInGroup === totalInGroup && totalInGroup > 0 && (
                        <Check className="w-5 h-5 text-green-500" />
                      )}
                    </button>
                    
                    {isExpanded && (
                      <div className="p-4 space-y-4 bg-white border-t">
                        {groupFields.map(({ fieldKey, fieldDef, data }) => (
                          <FormField
                            key={fieldKey}
                            fieldKey={fieldKey}
                            fieldDef={fieldDef}
                            data={data}
                            section={section}
                            onChange={(value, isAssumption) => updateField(section, fieldKey, value, isAssumption)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Individual Form Field Component
function FormField({ fieldKey, fieldDef, data, section, onChange, validation }) {
  const isRequired = formFieldsData.priority_system.must_fields.includes(fieldKey);
  const [localValue, setLocalValue] = useState(data?.value || '');
  const [localAssumption, setLocalAssumption] = useState(data?.isAssumption || false);

  useEffect(() => {
    setLocalValue(data?.value || '');
    setLocalAssumption(data?.isAssumption || false);
  }, [data]);

  const handleValueChange = (newValue) => {
    setLocalValue(newValue);
    onChange(newValue, localAssumption);
  };

  const toggleAssumption = () => {
    const newAssumption = !localAssumption;
    setLocalAssumption(newAssumption);
    onChange(localValue, newAssumption);
  };

  const renderInput = () => {
    switch (fieldDef.type) {
      case 'dropdown':
        return (
          <select
            id={`field-${fieldKey}`}
            value={localValue}
            onChange={(e) => handleValueChange(e.target.value)}
            className={`
              flex-1 px-3 py-2 border rounded-lg text-sm transition-all duration-500
              ${localAssumption 
                ? 'border-amber-300 bg-amber-50' 
                : !localValue || localValue === ''
                ? 'border-gray-300 bg-yellow-50'
                : 'border-gray-300 bg-white'}
              focus:outline-none focus:ring-2 focus:ring-blue-500
            `}
          >
            <option value="">Select {fieldDef.label}...</option>
            {fieldDef.options.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        );
      
      case 'multi-select':
        const selectedValues = Array.isArray(localValue) ? localValue : [];
        return (
          <div className="flex-1">
            <div className={`
              px-3 py-2 border rounded-lg text-sm transition-all duration-500
              ${localAssumption 
                ? 'border-amber-300 bg-amber-50' 
                : !localValue || (Array.isArray(localValue) && localValue.length === 0)
                ? 'border-gray-300 bg-yellow-50'
                : 'border-gray-300 bg-white'}
            `}>
              {selectedValues.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {selectedValues.map(val => (
                    <span key={val} className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                      {val}
                      <button
                        onClick={() => handleValueChange(selectedValues.filter(v => v !== val))}
                        className="ml-1 text-blue-500 hover:text-blue-700"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-gray-400">Select options...</span>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {fieldDef.options.map(opt => (
                <button
                  key={opt}
                  onClick={() => {
                    if (selectedValues.includes(opt)) {
                      handleValueChange(selectedValues.filter(v => v !== opt));
                    } else {
                      handleValueChange([...selectedValues, opt]);
                    }
                  }}
                  className={`
                    px-2 py-1 rounded text-xs
                    ${selectedValues.includes(opt)
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}
                  `}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        );
      
      case 'number':
        // Check if this is the total_budget field (read-only, auto-calculated)
        const isReadOnly = fieldKey === 'total_budget' && fieldDef.calculated === true;

        return (
          <div className="flex-1 flex items-center space-x-2">
            {!isReadOnly && (
              <button
                onClick={() => handleValueChange(Math.max((parseInt(localValue) || 0) - 1, fieldDef.min || 0))}
                className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded"
              >
                -
              </button>
            )}
            <input
              id={`field-${fieldKey}`}
              type="number"
              value={localValue}
              onChange={(e) => !isReadOnly && handleValueChange(e.target.value)}
              min={fieldDef.min}
              max={fieldDef.max}
              readOnly={isReadOnly}
              disabled={isReadOnly}
              className={`
                flex-1 px-3 py-2 border rounded-lg text-sm text-center transition-all duration-500
                ${isReadOnly
                  ? 'border-gray-200 bg-gray-50 cursor-not-allowed'
                  : localAssumption
                  ? 'border-amber-300 bg-amber-50'
                  : !localValue || localValue === ''
                  ? 'border-gray-300 bg-yellow-50'
                  : 'border-gray-300 bg-white'}
                ${!isReadOnly && 'focus:outline-none focus:ring-2 focus:ring-blue-500'}
              `}
              placeholder={isReadOnly ? 'Auto-calculated' : `${fieldDef.min || 0}-${fieldDef.max || 999}`}
            />
            {!isReadOnly && (
              <button
                onClick={() => handleValueChange(Math.min((parseInt(localValue) || 0) + 1, fieldDef.max || 999))}
                className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded"
              >
                +
              </button>
            )}
          </div>
        );
      
      case 'date':
        return (
          <input
            id={`field-${fieldKey}`}
            type="date"
            value={localValue}
            onChange={(e) => handleValueChange(e.target.value)}
            className={`
              flex-1 px-3 py-2 border rounded-lg text-sm transition-all duration-500
              ${localAssumption 
                ? 'border-amber-300 bg-amber-50' 
                : !localValue || localValue === ''
                ? 'border-gray-300 bg-yellow-50'
                : 'border-gray-300 bg-white'}
              focus:outline-none focus:ring-2 focus:ring-blue-500
            `}
          />
        );
      
      default:
        return (
          <input
            id={`field-${fieldKey}`}
            type="text"
            value={localValue}
            onChange={(e) => handleValueChange(e.target.value)}
            placeholder={fieldDef.placeholder || `Enter ${fieldDef.label}...`}
            className={`
              flex-1 px-3 py-2 border rounded-lg text-sm transition-all duration-500
              ${localAssumption 
                ? 'border-amber-300 bg-amber-50' 
                : !localValue || localValue === ''
                ? 'border-gray-300 bg-yellow-50'
                : 'border-gray-300 bg-white'}
              focus:outline-none focus:ring-2 focus:ring-blue-500
            `}
          />
        );
    }
  };

  return (
    <div>
      <div className="flex items-center space-x-4">
        <label className="w-40 text-sm font-medium text-gray-700">
          {fieldDef.label}
          {isRequired && <span className="text-red-500 ml-1">*</span>}
        </label>
        
        {renderInput()}
        
        <div className="flex items-center">
          <div
            onClick={toggleAssumption}
            className={`relative w-12 h-6 rounded-full cursor-pointer transition-all duration-300 ${
              localAssumption ? 'bg-amber-200' : 'bg-blue-200'
            }`}
            title={localAssumption ? "Click to mark as requirement" : "Click to mark as assumption"}
          >
            <div
              className={`absolute top-0.5 w-5 h-5 rounded-full flex items-center justify-center transition-all duration-300 ${
                localAssumption 
                  ? 'left-6 bg-amber-500 text-white' 
                  : 'left-0.5 bg-blue-500 text-white'
              }`}
            >
              {localAssumption ? (
                <AlertTriangle size={10} />
              ) : (
                <Check size={10} />
              )}
            </div>
          </div>
          <span className="text-sm text-gray-500 ml-2">
            {localAssumption ? 'Assumption' : 'Requirement'}
          </span>
        </div>
      </div>
      
      {/* Validation Message */}
      {validation && (
        <div className={`mt-2 ml-44 flex items-start text-xs ${
          validation.severity === 'error' ? 'text-red-600' :
          validation.severity === 'warning' ? 'text-amber-600' :
          'text-blue-600'
        }`}>
          {validation.severity === 'error' && <AlertCircle className="w-3 h-3 mr-1 mt-0.5" />}
          {validation.severity === 'warning' && <AlertTriangle className="w-3 h-3 mr-1 mt-0.5" />}
          {validation.severity === 'info' && <Info className="w-3 h-3 mr-1 mt-0.5" />}
          <span>{validation.message}</span>
        </div>
      )}
    </div>
  );
}

// Requirements Review Component
function RequirementsReview({ requirements }) {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-800">Requirements Review</h2>
      
      {Object.entries(requirements).map(([section, fields]) => {
        const filledFields = Object.entries(fields).filter(([_, data]) => data.isComplete);
        
        if (filledFields.length === 0) return null;
        
        return (
          <div key={section} className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="font-medium text-gray-700 mb-4">
              {section.split('_').map(word => 
                word.charAt(0).toUpperCase() + word.slice(1)
              ).join(' ')}
            </h3>
            
            <div className="space-y-2">
              {filledFields.map(([fieldKey, fieldData]) => {
                const fieldDef = formFieldsData.field_definitions[section][fieldKey];
                return (
                  <div key={fieldKey} className="flex justify-between py-2 border-b">
                    <span className="text-gray-600">
                      {fieldDef?.label || fieldKey}:
                    </span>
                    <span className="font-medium">
                      {Array.isArray(fieldData.value) 
                        ? fieldData.value.join(', ')
                        : fieldData.value}
                      {fieldData.isAssumption && (
                        <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded">
                          Assumption
                        </span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default App;