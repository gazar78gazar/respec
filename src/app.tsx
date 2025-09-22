import { useState, useEffect, useCallback, useRef } from 'react';
import { Check, ChevronRight, ChevronDown, Download, Share, Wand2, AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { reqmasClient } from './services/reqmasClient';
import type { ClarificationRequest } from './services/reqmasClient';
import * as uiUtils from './utils/uiUtilities';
import { dataServices } from './services/dataServices';
import './styles/animations.css';
import { useReqMAS } from './hooks/useReqMAS';
import { RequirementArtifact } from './services/reqmas/types';

// RequirementLegend component
const RequirementLegend = () => (
  <div className="flex items-center justify-end mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
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
);

// StepProgressIndicator component
const StepProgressIndicator = ({ currentStep, setCurrentStage, chatWindowWidth = 384 }) => {
  const steps = [
    { id: 1, label: "Requirements", completed: currentStep > 1, current: currentStep === 1 },
    { id: 3, label: "Configure", completed: currentStep > 3, current: currentStep === 3 },
    { id: 4, label: "Finalize", completed: false, current: currentStep === 4 }
  ];

  const progressPercentage = ((currentStep - 1) / (steps.length - 1)) * 100;

  const handleStepNavigation = (stepId) => {
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

// Import your new form_fields.json structure (abbreviated for demo)
const formFieldsData = {
  field_definitions: {
    performance_computing: {
      processorTier: {
        type: "dropdown",
        label: "Processor Type",
        required: false,
        group: "essential",
        options: ["Entry (Intel Atom)", "Standard (Intel Core i3)", "Performance (Intel Core i5)", "Premium (Intel Core i7)", "Any"],
        autofill_default: "Standard (Intel Core i3)"
      },
      memoryCapacity: {
        type: "dropdown",
        label: "Memory Capacity",
        required: false,
        group: "essential",
        options: ["4GB", "8GB", "16GB", "32GB", "64GB"],
        autofill_default: "8GB"
      },
      storageCapacity: {
        type: "dropdown",
        label: "Storage Capacity",
        required: false,
        group: "essential",
        options: ["128GB", "256GB", "512GB", "1TB", "2TB"],
        autofill_default: "256GB"
      },
      storageType: {
        type: "dropdown",
        label: "Storage Type",
        required: false,
        group: "processing",
        options: ["SATA SSD", "NVMe", "NVMe Gen4", "Any"],
        autofill_default: "NVMe"
      },
      memoryType: {
        type: "dropdown",
        label: "Memory Type",
        required: false,
        group: "processing",
        options: ["DDR4", "DDR5", "Any"],
        autofill_default: "Any"
      },
      aiAcceleration: {
        type: "dropdown",
        label: "AI/GPU Acceleration",
        required: false,
        group: "advanced",
        options: ["None", "Intel Xe Graphics", "Dedicated GPU Required"],
        autofill_default: "None"
      },
      operatingSystem: {
        type: "dropdown",
        label: "Operating System",
        required: false,
        group: "advanced",
        options: ["Windows 10 IoT", "Windows 11 IoT", "Ubuntu 20.04 LTS", "Ubuntu 22.04 LTS", "Any"],
        autofill_default: "Any"
      }
    },
    io_connectivity: {
      digitalIO: {
        type: "number",
        label: "Digital IO",
        required: true,
        group: "core_io",
        min: 0,
        max: 128,
        autofill_default: 8
      },
      analogIO: {
        type: "number",
        label: "Analog IO",
        required: true,
        group: "core_io",
        min: 0,
        max: 32,
        autofill_default: 4
      },
      networkPorts: {
        type: "dropdown",
        label: "Network Ports",
        required: true,
        group: "core_io",
        options: ["1 x RJ45", "2 x RJ45", "3 x RJ45", "4+ x RJ45"],
        autofill_default: "2 x RJ45"
      },
      ethernetSpeed: {
        type: "dropdown",
        label: "Ethernet Speed",
        required: false,
        group: "network_protocols",
        options: ["100 Mbps", "1 Gbps", "10 Gbps", "Any"],
        autofill_default: "1 Gbps"
      },
      wirelessExtension: {
        type: "multi-select",
        label: "Wireless Extension",
        required: false,
        group: "network_protocols",
        options: ["WiFi 6", "WiFi 6E", "5G", "4G LTE", "LoRaWAN", "None"],
        autofill_default: []
      },
      serialPorts: {
        type: "dropdown",
        label: "Serial Ports",
        required: false,
        group: "serial_usb",
        options: ["None", "2x RS-232/422/485", "4x RS-232/422/485", "Any"],
        autofill_default: "Any"
      },
      usbPorts: {
        type: "dropdown",
        label: "USB Ports",
        required: false,
        group: "serial_usb",
        options: ["None", "4x USB 3.0", "6x USB 3.0", "Any"],
        autofill_default: "Any"
      },
      canBusSupport: {
        type: "dropdown",
        label: "CAN Bus Support",
        required: false,
        group: "industrial_protocols",
        options: ["Not Required", "1 Port", "2 Ports"],
        autofill_default: "Not Required"
      },
      modbusSupport: {
        type: "dropdown",
        label: "Modbus Support",
        required: false,
        group: "industrial_protocols",
        options: ["Not Required", "RTU", "TCP", "RTU + TCP"],
        autofill_default: "Not Required"
      }
    },
    power_environment: {
      powerInput: {
        type: "dropdown",
        label: "Power Input",
        required: false,
        group: "power",
        options: ["9-36V DC", "18-36V DC", "24V DC", "PoE+", "Any"],
        autofill_default: "24V DC"
      },
      powerConsumption: {
        type: "dropdown",
        label: "Max Power Consumption",
        required: false,
        group: "power",
        options: ["< 10W", "10-20W", "20-35W", "35-65W", "> 65W"],
        autofill_default: "20-35W"
      },
      operatingTemperature: {
        type: "dropdown",
        label: "Operating Temperature",
        required: false,
        group: "environmental",
        options: ["-40°C to 70°C", "-20°C to 60°C", "0°C to 50°C", "Any"],
        autofill_default: "0°C to 50°C"
      },
      humidity: {
        type: "dropdown",
        label: "Humidity",
        required: false,
        group: "environmental",
        options: ["95% RH @ 40°C", "90% RH non-condensing", "None"],
        autofill_default: "90% RH non-condensing"
      },
      ingressProtection: {
        type: "dropdown",
        label: "Ingress Protection",
        required: false,
        group: "environmental",
        options: ["IP20", "IP40", "IP54", "IP65", "IP67"],
        autofill_default: "IP20"
      },
      vibrationProtection: {
        type: "dropdown",
        label: "Vibration Protection",
        required: false,
        group: "certifications",
        options: ["IEC 60068-2-64", "MIL-STD-810", "None"],
        autofill_default: "None"
      },
      certifications: {
        type: "multi-select",
        label: "Certifications",
        required: false,
        group: "certifications",
        options: ["CE", "FCC", "UL", "CCC", "ATEX", "IECEx"],
        autofill_default: ["CE", "FCC"]
      }
    },
    commercial: {
      budgetPerUnit: {
        type: "text",
        label: "Budget Per Unit",
        required: true,
        group: "pricing",
        placeholder: "e.g., $2000",
        autofill_default: ""
      },
      quantity: {
        type: "number",
        label: "Quantity",
        required: true,
        group: "pricing",
        min: 1,
        max: 10000,
        autofill_default: 1
      },
      totalBudget: {
        type: "text",
        label: "Total Budget",
        required: false,
        group: "pricing",
        placeholder: "Auto-calculated",
        autofill_default: ""
      },
      deliveryTimeframe: {
        type: "date",
        label: "Delivery Timeframe",
        required: false,
        group: "logistics",
        autofill_default: ""
      },
      warrantyRequirements: {
        type: "dropdown",
        label: "Warranty Requirements",
        required: false,
        group: "logistics",
        options: ["1 Year", "2 Years", "3 Years", "5 Years"],
        autofill_default: "3 Years"
      }
    }
  },
  field_groups: {
    performance_computing: {
      essential: { label: "Essential Specifications", fields: ["processorTier", "memoryCapacity", "storageCapacity"], defaultOpen: true },
      processing: { label: "Processing Details", fields: ["storageType", "memoryType"], defaultOpen: false },
      advanced: { label: "Advanced Features", fields: ["aiAcceleration", "operatingSystem"], defaultOpen: false }
    },
    io_connectivity: {
      core_io: { label: "Core I/O Requirements", fields: ["digitalIO", "analogIO", "networkPorts"], defaultOpen: true },
      network_protocols: { label: "Network & Protocols", fields: ["ethernetSpeed", "wirelessExtension"], defaultOpen: false },
      serial_usb: { label: "Serial & USB", fields: ["serialPorts", "usbPorts"], defaultOpen: false },
      industrial_protocols: { label: "Industrial Protocols", fields: ["canBusSupport", "modbusSupport"], defaultOpen: false }
    },
    power_environment: {
      power: { label: "Power Requirements", fields: ["powerInput", "powerConsumption"], defaultOpen: true },
      environmental: { label: "Environmental Conditions", fields: ["operatingTemperature", "humidity", "ingressProtection"], defaultOpen: false },
      certifications: { label: "Certifications & Standards", fields: ["vibrationProtection", "certifications"], defaultOpen: false }
    },
    commercial: {
      pricing: { label: "Pricing & Quantity", fields: ["budgetPerUnit", "quantity", "totalBudget"], defaultOpen: true },
      logistics: { label: "Logistics & Support", fields: ["deliveryTimeframe", "warrantyRequirements"], defaultOpen: false }
    }
  },
  priority_system: {
    must_fields: ["digitalIO", "analogIO", "networkPorts", "budgetPerUnit", "quantity"],
    priority_levels: {
      "1": { fields: ["digitalIO", "analogIO", "networkPorts", "budgetPerUnit", "quantity"] },
      "2": { fields: ["processorTier", "memoryCapacity", "storageCapacity"] },
      "3": { fields: ["operatingTemperature", "ingressProtection"] },
      "4": { fields: ["serialPorts", "usbPorts", "deliveryTimeframe"] }
    }
  }
};

// Map new sections to old UI tabs
const SECTION_MAPPING = {
  'System': ['performance_computing'],
  'Performance': ['io_connectivity'],
  'Environment': ['power_environment'],
  'Commercial': ['commercial']
};

// Import validation service functions
const validateField = (fieldKey, value, fieldDef) => {
  const errors = [];
  
  if (fieldDef.required && (!value || value === '')) {
    errors.push({
      severity: 'error',
      message: `${fieldDef.label} is required`
    });
    return errors;
  }
  
  switch (fieldDef.type) {
    case 'number':
      const numValue = parseInt(value);
      if (value && isNaN(numValue)) {
        errors.push({ severity: 'error', message: 'Must be a valid number' });
      } else if (value) {
        if (fieldDef.min !== undefined && numValue < fieldDef.min) {
          errors.push({ severity: 'error', message: `Minimum value is ${fieldDef.min}` });
        }
        if (fieldDef.max !== undefined && numValue > fieldDef.max) {
          errors.push({ severity: 'error', message: `Maximum value is ${fieldDef.max}` });
        }
      }
      break;
    
    case 'text':
      if (fieldKey === 'budgetPerUnit' || fieldKey === 'totalBudget') {
        if (value && !value.match(/^\$?\d+(\.\d{0,2})?$/)) {
          errors.push({ severity: 'warning', message: 'Expected format: $1000 or 1000' });
        }
      }
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
  }
  
  return errors;
};

const validateCrossFields = (requirements) => {
  const crossFieldErrors = {};
  
  // Budget Calculation Validation
  const commercial = requirements.commercial || {};
  if (commercial.budgetPerUnit?.value && commercial.quantity?.value) {
    const unitBudget = parseFloat(commercial.budgetPerUnit.value.replace(/[$,]/g, ''));
    const quantity = parseInt(commercial.quantity.value);
    const calculatedTotal = unitBudget * quantity;
    
    if (commercial.totalBudget?.value) {
      const enteredTotal = parseFloat(commercial.totalBudget.value.replace(/[$,]/g, ''));
      if (Math.abs(calculatedTotal - enteredTotal) > 0.01) {
        crossFieldErrors['commercial.totalBudget'] = {
          severity: 'warning',
          message: `Should be ${calculatedTotal.toFixed(2)} based on unit price × quantity`
        };
      }
    }
  }
  
  // I/O and Network Validation
  const io = requirements.io_connectivity || {};
  const digitalIO = parseInt(io.digitalIO?.value) || 0;
  const analogIO = parseInt(io.analogIO?.value) || 0;
  const totalIO = digitalIO + analogIO;
  
  if (totalIO > 32 && io.networkPorts?.value === "1 x RJ45") {
    crossFieldErrors['io_connectivity.networkPorts'] = {
      severity: 'warning',
      message: 'High I/O count typically requires 2+ network ports for distributed I/O modules'
    };
  }
  
  // Power Consumption Validation
  const computing = requirements.performance_computing || {};
  const power = requirements.power_environment || {};
  
  if (computing.processorTier?.value && power.powerConsumption?.value) {
    const processorTier = computing.processorTier.value;
    const powerConsumption = power.powerConsumption.value;
    
    const powerRequirements = {
      'Premium (Intel Core i7)': ['35-65W', '> 65W'],
      'Performance (Intel Core i5)': ['20-35W', '35-65W', '> 65W'],
      'Standard (Intel Core i3)': ['10-20W', '20-35W', '35-65W'],
      'Entry (Intel Atom)': ['< 10W', '10-20W', '20-35W']
    };
    
    const validPower = powerRequirements[processorTier];
    if (validPower && !validPower.includes(powerConsumption)) {
      crossFieldErrors['power_environment.powerConsumption'] = {
        severity: 'warning',
        message: `${processorTier} typically requires: ${validPower.join(' or ')}`
      };
    }
  }
  
  // Temperature Range vs Processor Validation
  if (power.operatingTemperature?.value && computing.processorTier?.value) {
    const temp = power.operatingTemperature.value;
    const processor = computing.processorTier.value;
    
    if (temp === '-40°C to 70°C' && processor.includes('Core i7')) {
      crossFieldErrors['performance_computing.processorTier'] = {
        severity: 'warning',
        message: 'Extended temperature range may limit high-performance processor options'
      };
    }
  }
  
  // Wireless and Power Validation
  if (io.wirelessExtension?.value && power.powerConsumption?.value) {
    const wireless = Array.isArray(io.wirelessExtension.value) 
      ? io.wirelessExtension.value 
      : [];
    
    const highPowerWireless = ['5G', '4G LTE'];
    const hasHighPowerWireless = wireless.some(w => highPowerWireless.includes(w));
    
    if (hasHighPowerWireless && power.powerConsumption.value === '< 10W') {
      crossFieldErrors['power_environment.powerConsumption'] = {
        severity: 'error',
        message: '5G/4G LTE modules require minimum 20W power budget'
      };
    }
  }
  
  // Storage and AI Validation
  if (computing.aiAcceleration?.value === 'Dedicated GPU Required' && 
      computing.storageCapacity?.value === '64GB') {
    crossFieldErrors['performance_computing.storageCapacity'] = {
      severity: 'warning',
      message: 'AI/ML workloads with GPU typically require 256GB+ storage'
    };
  }
  
  // Industrial Protocol Requirements
  if ((io.canBusSupport?.value !== 'Not Required' || 
       io.modbusSupport?.value !== 'Not Required') && 
       (!io.serialPorts?.value || io.serialPorts.value === 'None')) {
    crossFieldErrors['io_connectivity.serialPorts'] = {
      severity: 'info',
      message: 'Industrial protocols often benefit from RS-232/422/485 ports'
    };
  }
  
  return crossFieldErrors;
};

const autoCalculateFields = (changedField, newValue, requirements) => {
  const updates = {};
  
  // Budget calculations
  if (changedField === 'budgetPerUnit' || changedField === 'quantity') {
    const commercial = requirements.commercial || {};
    const unitBudget = parseFloat((commercial.budgetPerUnit?.value || '').replace(/[$,]/g, ''));
    const quantity = parseInt(commercial.quantity?.value || 0);
    
    if (changedField === 'budgetPerUnit') {
      const newUnitBudget = parseFloat(newValue.replace(/[$,]/g, ''));
      if (!isNaN(newUnitBudget) && quantity > 0) {
        updates['commercial.totalBudget'] = `${(newUnitBudget * quantity).toFixed(2)}`;
      }
    } else if (changedField === 'quantity') {
      const newQuantity = parseInt(newValue);
      if (!isNaN(unitBudget) && !isNaN(newQuantity)) {
        updates['commercial.totalBudget'] = `${(unitBudget * newQuantity).toFixed(2)}`;
      }
    }
  }
  
  // If total budget is manually changed, update unit budget
  if (changedField === 'totalBudget') {
    const commercial = requirements.commercial || {};
    const quantity = parseInt(commercial.quantity?.value || 0);
    const totalBudget = parseFloat(newValue.replace(/[$,]/g, ''));
    
    if (!isNaN(totalBudget) && quantity > 0) {
      updates['commercial.budgetPerUnit'] = `${(totalBudget / quantity).toFixed(2)}`;
    }
  }
  
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
  const [activeTab, setActiveTab] = useState('System');
  const [requirements, setRequirements] = useState({});
  const [expandedGroups, setExpandedGroups] = useState({});
  const [fieldValidations, setFieldValidations] = useState({});
  const [crossFieldValidations, setCrossFieldValidations] = useState({});
  const [projectName, setProjectName] = useState('Untitled Project');
  const [chatMessages, setChatMessages] = useState([
    { role: 'assistant', content: 'How can I help you with filling out these requirements?' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [sessionId, setSessionId] = useState<string>('');
  const [clarificationRequest, setClarificationRequest] = useState<ClarificationRequest | null>(null);
  const chatEndRef = useRef(null);

  // reqMAS Integration
  const {
    connected,
    loading,
    error: reqMASError,
    chatMessages: reqMASMessages,
    requirements: reqMASRequirements,
    currentStep,
    pendingClarification,
    conflicts,
    sendMessage,
    initializeSession,
    clearSession
  } = useReqMAS();

  // Map reqMAS requirements to form fields
  const mapReqMASToFormFields = (reqMASReqs: RequirementArtifact) => {
    const mapped: any = {};
    
    // Map each category
    Object.keys(reqMASReqs).forEach(category => {
      if (category !== 'constraints') {
        mapped[category] = reqMASReqs[category as keyof RequirementArtifact];
      }
    });
    
    return mapped;
  };

  // Initialize requirements and expanded groups
  useEffect(() => {
    const initialRequirements = {};
    const initialExpanded = {};
    
    Object.entries(formFieldsData.field_definitions).forEach(([section, fields]) => {
      initialRequirements[section] = {};
      initialExpanded[section] = {};
      
      // Initialize field values
      Object.entries(fields).forEach(([fieldKey, fieldDef]) => {
        initialRequirements[section][fieldKey] = {
          value: '',
          isComplete: false,
          isAssumption: false,
          priority: getPriority(fieldKey)
        };
      });
      
      // Initialize group expansion states
      if (formFieldsData.field_groups[section]) {
        Object.entries(formFieldsData.field_groups[section]).forEach(([groupKey, groupDef]) => {
          initialExpanded[section][groupKey] = groupDef.defaultOpen || false;
        });
      }
    });
    
    setRequirements(initialRequirements);
    setExpandedGroups(initialExpanded);

    // Initialize ReqMAS session
    reqmasClient.initSession({
      application_domain: 'industrial',
      enable_assessment: false
    }).then(sessionId => {
      setSessionId(sessionId);
    }).catch(err => {
      console.warn('ReqMAS initialization failed:', err);
    });
  }, []);

  // Initialize reqMAS session on mount
  useEffect(() => {
    // Initialization handled by the hook itself
    // No need to call initializeSession explicitly
  }, []);

  // Sync reqMAS requirements with form state
  useEffect(() => {
    if (reqMASRequirements && reqMASRequirements.constraints.length > 0) {
      // Map reqMAS requirements to form fields
      const mappedRequirements = mapReqMASToFormFields(reqMASRequirements);
      setRequirements(prev => ({ ...prev, ...mappedRequirements }));
    }
  }, [reqMASRequirements]);

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

  // Helper function to map sections to categories for ReqMAS
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

  const updateField = useCallback((section, field, value, isAssumption = false) => {
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
            lastUpdated: new Date().toISOString()
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
            isAssumption: false
          };
        }
      });
      
      return updated;
    });

    // Notify ReqMAS backend
    if (sessionId) {
      reqmasClient.updateFormField({
        sessionId,
        field_name: field,
        value,
        field_category: mapSectionToCategory(section)
      }).catch(err => {
        console.warn('ReqMAS field update failed:', err);
      });
    }
    
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
    let totalWeight = 0;
    let accuracyScore = 0;
    
    Object.values(requirements).forEach(section => {
      Object.values(section).forEach(field => {
        if (field.isComplete) {
          const weight = 5 - field.priority;
          totalWeight += weight;
          if (!field.isAssumption) {
            accuracyScore += weight;
          } else {
            accuracyScore += weight * 0.5;
          }
        }
      });
    });
    
    return totalWeight > 0 ? Math.round((accuracyScore / totalWeight) * 100) : 0;
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
    if (sessionId) {
      try {
        const response = await reqmasClient.triggerAutofill(sessionId);
        
        // Apply autofilled fields from ReqMAS
        Object.entries(response.fields).forEach(([field, value]) => {
          const section = findFieldSection(field);
          updateField(section, field, value, true);
        });
        return;
      } catch (err) {
        console.warn('ReqMAS autofill failed, using fallback:', err);
      }
    }

    // Fallback to local autofill
    const updatedRequirements = { ...requirements };
    
    Object.entries(formFieldsData.field_definitions).forEach(([section, fields]) => {
      Object.entries(fields).forEach(([fieldKey, fieldDef]) => {
        if (!updatedRequirements[section][fieldKey].isComplete && fieldDef.autofill_default) {
          updatedRequirements[section][fieldKey] = {
            ...updatedRequirements[section][fieldKey],
            value: fieldDef.autofill_default,
            isComplete: true,
            isAssumption: true
          };
        }
      });
    });
    
    setRequirements(updatedRequirements);
  };

  const autofillSection = (tabName) => {
    const sections = SECTION_MAPPING[tabName];
    const updatedRequirements = { ...requirements };
    
    sections.forEach(section => {
      Object.entries(formFieldsData.field_definitions[section] || {}).forEach(([fieldKey, fieldDef]) => {
        if (!updatedRequirements[section][fieldKey].isComplete && fieldDef.autofill_default) {
          updatedRequirements[section][fieldKey] = {
            ...updatedRequirements[section][fieldKey],
            value: fieldDef.autofill_default,
            isComplete: true,
            isAssumption: true
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
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed: ' + error.message);
    }
  };

  const handleChatSubmit = async () => {
    if (!chatInput.trim()) return;
    
    setChatMessages(prev => [...prev, { role: 'user', content: chatInput }]);
    
    if (sessionId) {
      try {
        const response = await reqmasClient.sendChatMessage({
          sessionId,
          message: chatInput
        });
        
        // Add assistant response
        setChatMessages(prev => [...prev, {
          role: 'assistant',
          content: response.agentResponse
        }]);
        
        // Apply extracted fields
        response.extractedFields?.forEach(f => {
          updateField(f.section, f.field, f.value, f.isAssumption);
        });

        // Handle clarification if needed
        if (response.clarificationNeeded) {
          setClarificationRequest(response.clarificationNeeded);
        }
      } catch (err) {
        console.warn('ReqMAS chat failed:', err);
        setChatMessages(prev => [...prev, {
          role: 'assistant',
          content: 'I apologize, but I\'m having trouble connecting to the backend. Please try again.'
        }]);
      }
    } else {
      // Fallback response
      setTimeout(() => {
        setChatMessages(prev => [...prev, {
          role: 'assistant',
          content: 'ReqMAS integration pending. Your requirements have been noted.'
        }]);
      }, 500);
    }
    
    setChatInput('');
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
              } catch (error) {
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

  // ChatWindow Component
  function ChatWindow({ onSendMessage, messages, pendingClarification, loading }: any) {
    const [input, setInput] = useState('');
    
    const handleSend = async () => {
      if (input.trim() && !loading) {
        await onSendMessage(input);
        setInput('');
      }
    };

    return (
      <div className="w-96 bg-white border-l shadow-lg flex flex-col">
        <div className="bg-white border-b px-4 py-3">
          <h3 className="text-sm font-semibold text-gray-800">Requirements Assistant</h3>
          {pendingClarification && (
            <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
              Clarification needed
            </div>
          )}
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs p-3 rounded-lg text-sm ${
                  msg.sender === 'user'
                    ? 'bg-blue-500 text-white'
                    : 'bg-white border border-gray-200 text-gray-800'
                }`}
              >
                {msg.message}
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
          <div className="flex space-x-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Type your requirement..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              disabled={loading}
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm disabled:opacity-50"
            >
              {loading ? 'Processing...' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    );
  }

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


        {reqMASError && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">Connection Error: {reqMASError}</p>
            <button 
              onClick={initializeSession}
              className="mt-2 text-xs text-red-600 underline"
            >
              Retry Connection
            </button>
          </div>
        )}

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

      {/* Chat Panel */}
      <ChatWindow 
        onSendMessage={sendMessage}
        messages={reqMASMessages}
        pendingClarification={pendingClarification}
        loading={loading}
      />
      
      {/* Step Progress Indicator */}
      <StepProgressIndicator 
        currentStep={currentStage} 
        setCurrentStage={setCurrentStage}
        chatWindowWidth={384}
      />
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
        return (
          <div className="flex-1 flex items-center space-x-2">
            <button
              onClick={() => handleValueChange(Math.max((parseInt(localValue) || 0) - 1, fieldDef.min || 0))}
              className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded"
            >
              -
            </button>
            <input
              id={`field-${fieldKey}`}
              type="number"
              value={localValue}
              onChange={(e) => handleValueChange(e.target.value)}
              min={fieldDef.min}
              max={fieldDef.max}
              className={`
                flex-1 px-3 py-2 border rounded-lg text-sm text-center transition-all duration-500
                ${localAssumption 
                  ? 'border-amber-300 bg-amber-50' 
                  : !localValue || localValue === ''
                  ? 'border-gray-300 bg-yellow-50'
                  : 'border-gray-300 bg-white'}
                focus:outline-none focus:ring-2 focus:ring-blue-500
              `}
              placeholder={`${fieldDef.min || 0}-${fieldDef.max || 999}`}
            />
            <button
              onClick={() => handleValueChange(Math.min((parseInt(localValue) || 0) + 1, fieldDef.max || 999))}
              className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded"
            >
              +
            </button>
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