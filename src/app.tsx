import { useState, useEffect, useCallback, useRef } from 'react';
import { Check, ChevronRight, ChevronDown, Download, Share, Wand2, AlertCircle, Info } from 'lucide-react';
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
          <img src="/assets/icons/requirement-icon.png" alt="Requirement" className="w-2.5 h-2.5" />
        </div>
        <span>Requirement</span>
      </div>
      <div className="flex items-center space-x-2">
        <div className="w-4 h-4 rounded-full bg-amber-200 flex items-center justify-center">
          <img src="/assets/icons/assumption-icon.png" alt="Assumption" className="w-2.5 h-2.5" />
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
const validateField = (fieldKey, value, fieldDef) => {
  const errors = [];

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

const validateCrossFields = (requirements) => {
  const crossFieldErrors = {};

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

const autoCalculateFields = (changedField, newValue, requirements) => {
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
  const [chatWidth, setChatWidth] = useState(384); // Default 24rem = 384px
  const [isResizing, setIsResizing] = useState(false);

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
  function ChatWindow({ onSendMessage, messages, pendingClarification, loading, width, onMouseDown, isResizing }: any) {
    const [input, setInput] = useState('');

    const handleSend = async () => {
      if (input.trim() && !loading) {
        await onSendMessage(input);
        setInput('');
      }
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
        width={chatWidth}
        onMouseDown={handleMouseDown}
        isResizing={isResizing}
      />
      
      {/* Step Progress Indicator */}
      <StepProgressIndicator
        currentStep={currentStage}
        setCurrentStage={setCurrentStage}
        chatWindowWidth={chatWidth}
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
                <img src="/assets/icons/requirement-icon.png" alt="Requirement" className="w-2.5 h-2.5" />
              </div>
              <span>Requirement</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 rounded-full bg-amber-200 flex items-center justify-center">
                <img src="/assets/icons/assumption-icon.png" alt="Assumption" className="w-2.5 h-2.5" />
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
              <img
                src={localAssumption ? "/assets/icons/assumption-icon.png" : "/assets/icons/requirement-icon.png"}
                alt={localAssumption ? "Assumption" : "Requirement"}
                className="w-2.5 h-2.5"
              />
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