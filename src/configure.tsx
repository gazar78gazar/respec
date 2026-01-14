import React, { useState, useRef, ChangeEvent, KeyboardEvent } from 'react';

// TypeScript Interfaces
interface IconProps {
  className?: string;
}

interface SpecificationGap {
  text: string;
  status: 'partial' | 'pending';
  category: string;
}

interface BomItem {
  partNumber: string;
  description: string;
  category: string;
  unitPrice: number;
  quantity: number;
  leadTimeDate: string;
  isMandatory: boolean;
}

interface RequirementsCoverage {
  id: string;
  name: string;
  description: string;
  score: number;
  status: string;
}

interface ActionItem {
  id: string;
  type: string;
  title: string;
  description: string;
  priority: string;
}

interface Configuration {
  id: string;
  name: string;
  badge: string;
  badgeColor: 'green' | 'blue';
  overallFitScore: number;
  fullySatisfied: number;
  partiallySatisfied: number;
  pending: number;
  totalRequirements: number;
  selectedProducts: string[];
  keyBenefits: string[];
  specificationGaps: SpecificationGap[];
  unvalidatedAssumptions: string[];
  comments: string[];
  bom: BomItem[];
  requirementsCoverage: RequirementsCoverage[];
  actionItems: ActionItem[];
}

interface CommercialTerms {
  currency: string;
  shippingTerms: string;
  warranty: string;
  priceValidity: string;
  estimatedLeadTime: string;
  quantity: number;
}

interface ChatMessage {
  sender: 'system' | 'user';
  text: string;
}

// SVG Icon Components
const Icons = {
  ChevronDown: ({ className }: IconProps): JSX.Element => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6"/>
    </svg>
  ),
  ChevronUp: ({ className }: IconProps): JSX.Element => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m18 15-6-6-6 6"/>
    </svg>
  ),
  ChevronRight: ({ className }: IconProps): JSX.Element => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 18 6-6-6-6"/>
    </svg>
  ),
  Share2: ({ className }: IconProps): JSX.Element => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
      <line x1="8.59" x2="15.42" y1="13.51" y2="17.49"/><line x1="15.41" x2="8.59" y1="6.51" y2="10.49"/>
    </svg>
  ),
  Download: ({ className }: IconProps): JSX.Element => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>
    </svg>
  ),
  GitCompare: ({ className }: IconProps): JSX.Element => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/>
      <path d="M13 6h3a2 2 0 0 1 2 2v7"/><path d="M11 18H8a2 2 0 0 1-2-2V9"/>
    </svg>
  ),
  Copy: ({ className }: IconProps): JSX.Element => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
    </svg>
  ),
  Edit3: ({ className }: IconProps): JSX.Element => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>
    </svg>
  ),
  X: ({ className }: IconProps): JSX.Element => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
    </svg>
  ),
  MessageSquare: ({ className }: IconProps): JSX.Element => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  ),
  Cpu: ({ className }: IconProps): JSX.Element => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="16" height="16" x="4" y="4" rx="2"/><rect width="6" height="6" x="9" y="9" rx="1"/>
      <path d="M15 2v2"/><path d="M15 20v2"/><path d="M2 15h2"/><path d="M2 9h2"/><path d="M20 15h2"/><path d="M20 9h2"/><path d="M9 2v2"/><path d="M9 20v2"/>
    </svg>
  ),
  HardDrive: ({ className }: IconProps): JSX.Element => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" x2="2" y1="12" y2="12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
      <line x1="6" x2="6.01" y1="16" y2="16"/><line x1="10" x2="10.01" y1="16" y2="16"/>
    </svg>
  ),
  Thermometer: ({ className }: IconProps): JSX.Element => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z"/>
    </svg>
  ),
  Zap: ({ className }: IconProps): JSX.Element => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  ),
  Package: ({ className }: IconProps): JSX.Element => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
      <path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>
    </svg>
  ),
  Wifi: ({ className }: IconProps): JSX.Element => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 13a10 10 0 0 1 14 0"/><path d="M8.5 16.5a5 5 0 0 1 7 0"/><path d="M2 8.82a15 15 0 0 1 20 0"/>
      <line x1="12" x2="12.01" y1="20" y2="20"/>
    </svg>
  ),
  RefreshCw: ({ className }: IconProps): JSX.Element => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>
    </svg>
  ),
  Trash2: ({ className }: IconProps): JSX.Element => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
      <line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>
    </svg>
  ),
};

const getCategoryIcon = (category: string): JSX.Element => {
  const iconMap: Record<string, React.FC<IconProps>> = {
    controller: Icons.Cpu,
    memory: Icons.HardDrive,
    storage: Icons.HardDrive,
    thermal: Icons.Thermometer,
    power: Icons.Zap,
    io_module: Icons.Package,
    wireless: Icons.Wifi,
    accessory: Icons.Package,
  };
  const IconComponent = iconMap[category] || Icons.Package;
  return <IconComponent className="w-4 h-4" />;
};

// Mock Data
const configurationsData: Configuration[] = [
  {
    id: 'config1',
    name: 'Configuration 1',
    badge: 'Best Commercial',
    badgeColor: 'green',
    overallFitScore: 90,
    fullySatisfied: 36,
    partiallySatisfied: 4,
    pending: 1,
    totalRequirements: 40,
    selectedProducts: [
      'UNO-137-E23BA Controller (Entry Level)',
      '8GB DDR4 Memory (Preinstalled)',
      '128GB SATA SSD',
      'CPU & Memory Thermal Pads',
      '90W Power Supply + Cord',
    ],
    keyBenefits: [
      'Cost-optimized solution',
      'Fast delivery (4-7 days)',
      'Built-in 16 digital I/O',
      'Eliminates external I/O cost',
    ],
    specificationGaps: [
      { text: 'Operating Temperature: -40°C not supported (min 0°C)', status: 'partial', category: 'Environment & Standards' },
      { text: 'Ingress Protection: IP65 not available (IP40 only)', status: 'pending', category: 'Environment & Standards' },
      { text: 'Ethernet Ports: 4 ports required (2 available)', status: 'partial', category: 'I/O & Connectivity' },
    ],
    unvalidatedAssumptions: [
      'Memory Type: DDR4 assumed based on cost optimization',
      'Storage Capacity: 128GB assumed sufficient for application',
      'Operating System: Linux assumed for industrial use',
      'Mounting: DIN rail mounting assumed',
    ],
    comments: [
      'Client mentioned preference for Advantech products',
      'Budget flexibility up to 15% for better specs',
      'Delivery timeline is flexible - Q2 target',
    ],
    bom: [
      { partNumber: 'UNO-137-E23BA', description: 'Compact DIN-rail controller Intel Atom x6413E, 8GB DDR4', category: 'controller', unitPrice: 625.00, quantity: 1, leadTimeDate: '04/07/2025', isMandatory: true },
      { partNumber: 'SQF-S4BV2-128GDSDC', description: 'SQF M.2 2242 SATA SSD 128GB', category: 'storage', unitPrice: 32.00, quantity: 1, leadTimeDate: '04/07/2025', isMandatory: true },
      { partNumber: '1990034408N010', description: 'CPU Thermal Pad for UNO-137', category: 'thermal', unitPrice: 7.00, quantity: 1, leadTimeDate: '04/07/2025', isMandatory: true },
      { partNumber: '1990026727N000', description: 'Memory Thermal Pad for UNO-137', category: 'thermal', unitPrice: 7.00, quantity: 1, leadTimeDate: '04/07/2025', isMandatory: true },
      { partNumber: 'XARK-ADP-90MDH', description: 'External Power Supply 90W 19V', category: 'power', unitPrice: 7.00, quantity: 1, leadTimeDate: '06/28/2025', isMandatory: true },
      { partNumber: '1700001524', description: 'Power Cord - North America', category: 'power', unitPrice: 7.00, quantity: 1, leadTimeDate: '04/07/2025', isMandatory: true },
    ],
    requirementsCoverage: [
      { id: 'proc', name: 'Processor Type', description: 'Intel Atom x6413E (1.5GHz)', score: 85, status: 'fully_satisfied' },
      { id: 'mem', name: 'Memory Capacity', description: '8GB DDR4 (preinstalled)', score: 100, status: 'fully_satisfied' },
      { id: 'dio', name: 'Digital I/O', description: '16 built-in digital I/O', score: 100, status: 'fully_satisfied' },
      { id: 'aio', name: 'Analog I/O', description: 'None included', score: 60, status: 'partially_satisfied' },
      { id: 'wireless', name: 'Wireless Extension', description: 'Optional WiFi available', score: 80, status: 'fully_satisfied' },
      { id: 'response', name: 'Response Time', description: 'Standard response', score: 90, status: 'fully_satisfied' },
    ],
    actionItems: [
      { id: 'a1', type: 'info', title: 'Analog I/O not included', description: 'Add ADAM-6017 module if analog inputs are needed', priority: 'medium' },
      { id: 'a2', type: 'success', title: 'Cost optimized', description: 'Best value for basic monitoring needs', priority: 'low' },
    ],
  },
  {
    id: 'config2',
    name: 'Configuration 2',
    badge: 'Best Technical',
    badgeColor: 'blue',
    overallFitScore: 93,
    fullySatisfied: 35,
    partiallySatisfied: 4,
    pending: 1,
    totalRequirements: 40,
    selectedProducts: [
      'UNO-148-D73BA Controller',
      '32GB DDR5 Memory Upgrade',
      '1TB NVMe Gen4 SSD',
    ],
    keyBenefits: [
      'High performance (i7 4.9GHz)',
      'Future-proof design',
      'Exceeds all key requirements',
      'Premium reliability',
    ],
    specificationGaps: [
      { text: 'Operating Temperature: -40°C not supported (min -20°C)', status: 'partial', category: 'Environment & Standards' },
      { text: 'Ingress Protection: IP65 not available (IP40 only)', status: 'pending', category: 'Environment & Standards' },
      { text: 'Vibration Protection: 5G required (3G supported)', status: 'partial', category: 'Environment & Standards' },
      { text: 'Ethernet Ports: 4 ports required (3 available)', status: 'partial', category: 'I/O & Connectivity' },
      { text: 'Budget Per Unit: $2,000 target exceeded', status: 'partial', category: 'Commercial' },
    ],
    unvalidatedAssumptions: [
      'Memory Type: DDR5 assumed for future-proofing',
      'Storage Capacity: 1TB assumed for data logging',
      'Operating System: Windows 11 IoT assumed',
      'Cooling: Active cooling assumed for sustained loads',
    ],
    comments: [
      'Client mentioned preference for Advantech products',
      'Budget flexibility up to 15% for better specs',
      'Delivery timeline is flexible - Q2 target',
    ],
    bom: [
      { partNumber: 'UNO-148-D73BA', description: 'DIN-rail controller Intel Core i7-1365UE, 8GB DDR5', category: 'controller', unitPrice: 1803.57, quantity: 1, leadTimeDate: '04/29/2025', isMandatory: true },
      { partNumber: 'SQR-SD5N32G4K8SNBB', description: 'SODIMM DDR5 4800 32GB Samsung', category: 'memory', unitPrice: 157.14, quantity: 1, leadTimeDate: '07/21/2027', isMandatory: false },
      { partNumber: 'SQF-C8MV4-1TDEFC', description: 'PCIe/NVMe Gen.4 M.2 2280 1TB SSD', category: 'storage', unitPrice: 95.40, quantity: 1, leadTimeDate: '05/19/2025', isMandatory: true },
      { partNumber: '98R1U148203', description: 'Memory Thermal Pad for 32GB', category: 'thermal', unitPrice: 7.00, quantity: 1, leadTimeDate: '06/13/2025', isMandatory: true },
      { partNumber: '98R1U148200', description: 'NVMe Storage Thermal Pad', category: 'thermal', unitPrice: 7.00, quantity: 1, leadTimeDate: '06/13/2025', isMandatory: true },
      { partNumber: '98R1U148201', description: 'UNO-148 V2 System Fan Kit', category: 'accessory', unitPrice: 17.14, quantity: 1, leadTimeDate: '06/13/2025', isMandatory: true },
      { partNumber: 'PSD-A120W24', description: 'DIN Rail Power Supply 120W 24V', category: 'power', unitPrice: 56.58, quantity: 1, leadTimeDate: '04/07/2025', isMandatory: true },
      { partNumber: '1702002600', description: 'Power Cord UL 3P 10A 125V', category: 'power', unitPrice: 7.00, quantity: 1, leadTimeDate: '04/07/2025', isMandatory: true },
    ],
    requirementsCoverage: [
      { id: 'proc', name: 'Processor Type', description: 'Intel Core i7-1365UE (4.9GHz)', score: 100, status: 'fully_satisfied' },
      { id: 'mem', name: 'Memory Capacity', description: '40GB DDR5 (8GB + 32GB)', score: 100, status: 'fully_satisfied' },
      { id: 'dio', name: 'Digital I/O', description: '16 built-in digital I/O', score: 95, status: 'fully_satisfied' },
      { id: 'aio', name: 'Analog I/O', description: '8 inputs via ADAM-6017', score: 90, status: 'fully_satisfied' },
      { id: 'wireless', name: 'Wireless Extension', description: 'WiFi/BT supported', score: 85, status: 'fully_satisfied' },
      { id: 'response', name: 'Response Time', description: 'Sub-second achievable', score: 98, status: 'fully_satisfied' },
    ],
    actionItems: [
      { id: 'a1', type: 'warning', title: 'Extended memory lead time', description: '32GB module has long lead time - check stock', priority: 'high' },
      { id: 'a2', type: 'info', title: 'Maximum technical fit', description: 'Best configuration for performance requirements', priority: 'low' },
    ],
  },
];

const defaultCommercialTerms: CommercialTerms = {
  currency: 'USD',
  shippingTerms: 'FOB Origin',
  warranty: '1 year standard',
  priceValidity: '60 days',
  estimatedLeadTime: '4-6 weeks',
  quantity: 25,
};

// Helpers
const formatCurrency = (amount: number): string => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
const calculateTotal = (bom: BomItem[]): number => bom.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
const getScoreColor = (score: number): string => score >= 90 ? 'text-green-600' : score >= 70 ? 'text-yellow-600' : 'text-red-600';

export default function ConfigurePage(): JSX.Element {
  const [activeConfigTab, setActiveConfigTab] = useState<string>('config2');
  const [commercialTerms, setCommercialTerms] = useState<CommercialTerms>(defaultCommercialTerms);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { sender: 'system', text: 'How can I help you Finalize this configuration?' },
    { sender: 'user', text: 'Why havent we included a 5G antenna and card, as initially requested?' },
    { sender: 'system', text: 'Previously you mentioned that 5G coverage may not suffice for this PC. Would you like to review an alternative PC that supports 5G communication, or purchase an external router instead?' },
  ]);
  const [chatInput, setChatInput] = useState<string>('');
  const [projectName, setProjectName] = useState<string>('Untitled Project');
  const [showProjectDropdown, setShowProjectDropdown] = useState<boolean>(false);
  const [specGapsOpen, setSpecGapsOpen] = useState<boolean>(false);
  const [unvalidatedAssumptionsOpen, setUnvalidatedAssumptionsOpen] = useState<boolean>(false);
  const [commentsOpen, setCommentsOpen] = useState<boolean>(false);
  const [commercialTermsOpen, setCommercialTermsOpen] = useState<boolean>(false);
  const [bomOpen, setBomOpen] = useState<boolean>(true);
  const [editMode, setEditMode] = useState<boolean>(false);
  const [compareMode, setCompareMode] = useState<boolean>(false);
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([]);
  const [showComparison, setShowComparison] = useState<boolean>(false);
  const [duplicateMode, setDuplicateMode] = useState<boolean>(false);
  const [selectedForDuplicate, setSelectedForDuplicate] = useState<string | null>(null);
  const [tabCompareMode, setTabCompareMode] = useState<boolean>(false);
  const [compareFromTab, setCompareFromTab] = useState<string | null>(null);
  const [selectedCompareTarget, setSelectedCompareTarget] = useState<string | null>(null);
  const [showSharePopup, setShowSharePopup] = useState<boolean>(false);
  const [shareLinkCopied, setShareLinkCopied] = useState<boolean>(false);
  const [configurations, setConfigurations] = useState<Configuration[]>(configurationsData);

  const configGapsRef = useRef<HTMLDivElement>(null);
  const bomRef = useRef<HTMLDivElement>(null);
  const unvalidatedAssumptionsRef = useRef<HTMLDivElement>(null);

  const currentConfig: Configuration = configurations.find(c => c.id === activeConfigTab) || configurations[0];

  const handleChatSubmit = (): void => {
    if (!chatInput.trim()) return;
    setChatMessages(prev => [...prev, { sender: 'user', text: chatInput }]);
    setChatInput('');
    setTimeout(() => {
      setChatMessages(prev => [...prev, { 
        sender: 'system', 
        text: `Analyzing "${chatInput}" for ${currentConfig.name}. This configuration ${currentConfig.badge ? `is the ${currentConfig.badge} option` : 'provides a balanced approach'} with ${currentConfig.overallFitScore}% fit score.` 
      }]);
    }, 800);
  };

  const handleCompareSelection = (configId: string): void => {
    setSelectedForCompare(prev => {
      if (prev.includes(configId)) {
        return prev.filter(id => id !== configId);
      }
      if (prev.length >= 2) {
        return [...prev.slice(1), configId];
      }
      return [...prev, configId];
    });
  };

  const handleStartComparison = (): void => {
    if (selectedForCompare.length === 2) {
      setShowComparison(true);
    }
  };

  const handleDuplicateSelection = (configId: string): void => {
    setSelectedForDuplicate(configId);
  };

  const generateDuplicateName = (baseName: string): string => {
    const existingNames = configurations.map(c => c.name);
    let counter = 1;
    let newName = `${baseName}(${counter})`;
    while (existingNames.includes(newName)) {
      counter++;
      newName = `${baseName}(${counter})`;
    }
    return newName;
  };

  const generateUniqueId = (): string => {
    return `config_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  const handleConfirmDuplicate = (): void => {
    if (!selectedForDuplicate) return;
    const configToDuplicate = configurations.find(c => c.id === selectedForDuplicate);
    if (!configToDuplicate) return;

    const newConfig: Configuration = {
      ...JSON.parse(JSON.stringify(configToDuplicate)),
      id: generateUniqueId(),
      name: generateDuplicateName(configToDuplicate.name),
    };

    setConfigurations(prev => [...prev, newConfig]);
    setActiveConfigTab(newConfig.id);
    setDuplicateMode(false);
    setSelectedForDuplicate(null);
  };

  const handleTabDuplicate = (): void => {
    const configToDuplicate = configurations.find(c => c.id === activeConfigTab);
    if (!configToDuplicate) return;

    const newConfig: Configuration = {
      ...JSON.parse(JSON.stringify(configToDuplicate)),
      id: generateUniqueId(),
      name: generateDuplicateName(configToDuplicate.name),
    };

    setConfigurations(prev => [...prev, newConfig]);
    setActiveConfigTab(newConfig.id);
  };

  const handleTabCompareToggle = (): void => {
    if (tabCompareMode) {
      setTabCompareMode(false);
      setCompareFromTab(null);
      setSelectedCompareTarget(null);
    } else {
      setTabCompareMode(true);
      setCompareFromTab(activeConfigTab);
      setSelectedCompareTarget(null);
      setEditMode(false);
      setCompareMode(false);
      setSelectedForCompare([]);
      setDuplicateMode(false);
      setSelectedForDuplicate(null);
    }
  };

  const handleCompareTargetSelection = (configId: string): void => {
    setSelectedCompareTarget(configId);
  };

  const handleStartTabComparison = (): void => {
    if (compareFromTab && selectedCompareTarget) {
      setSelectedForCompare([compareFromTab, selectedCompareTarget]);
      setShowComparison(true);
      setTabCompareMode(false);
    }
  };

  const scrollToConfigCoverageGaps = (): void => {
    setSpecGapsOpen(true);
    setTimeout(() => {
      configGapsRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleEditToggle = (): void => {
    setEditMode(!editMode);
    if (!editMode) {
      setCompareMode(false);
      setShowComparison(false);
      setDuplicateMode(false);
      setSelectedForDuplicate(null);
      setTabCompareMode(false);
      setCompareFromTab(null);
      setSelectedCompareTarget(null);
    }
  };

  const handleShare = (): void => {
    setShowSharePopup(true);
    setShareLinkCopied(false);
  };

  const handleCopyShareLink = (): void => {
    const shareLink = `https://app.configure.io/project/${projectName.replace(/\s+/g, '-').toLowerCase()}/${activeConfigTab}`;
    navigator.clipboard.writeText(shareLink);
    setShareLinkCopied(true);
    setTimeout(() => setShareLinkCopied(false), 2000);
  };

  const getShareLink = (): string => {
    return `https://app.configure.io/project/${projectName.replace(/\s+/g, '-').toLowerCase()}/${activeConfigTab}`;
  };

  return (
    <div className="flex bg-gray-50">
      {/* Left Panel with Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Main Content - scrollable */}
        <div className="flex-1 overflow-auto p-6">
          {/* Tabs */}
          <div className="mb-4 flex items-center border-b border-gray-200">
            <div className="flex items-center">
              {configurations.map((config) => (
                <div key={config.id} className="flex items-center">
                  {compareMode && (
                    <input type="checkbox" className="mr-2 w-4 h-4 text-blue-600 rounded" checked={selectedForCompare.includes(config.id)} onChange={() => handleCompareSelection(config.id)} />
                  )}
                  {duplicateMode && (
                    <input type="checkbox" className="mr-2 w-4 h-4 text-blue-600 rounded" checked={selectedForDuplicate === config.id} onChange={() => handleDuplicateSelection(config.id)} />
                  )}
                  {tabCompareMode && config.id !== compareFromTab && (
                    <input type="checkbox" className="mr-2 w-4 h-4 text-blue-600 rounded" checked={selectedCompareTarget === config.id} onChange={() => handleCompareTargetSelection(config.id)} />
                  )}
                  <button className={`px-4 py-2 flex flex-col items-center ${activeConfigTab === config.id ? 'border-b-2 border-blue-500' : ''}`} onClick={() => !compareMode && !duplicateMode && !tabCompareMode && setActiveConfigTab(config.id)}>
                    {config.badge && (
                      <span className={`mb-1 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide rounded-sm ${config.badgeColor === 'green' ? 'bg-fuchsia-50 text-fuchsia-700' : 'bg-rose-50 text-rose-600'}`}>
                        {config.badge}
                      </span>
                    )}
                    <span className={`font-medium text-sm ${activeConfigTab === config.id ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
                      {config.name}
                    </span>
                  </button>
                </div>
              ))}
              {compareMode && selectedForCompare.length === 2 && (
                <button onClick={handleStartComparison} className="ml-4 px-3 py-1.5 bg-blue-500 text-white rounded-md text-sm font-medium hover:bg-blue-600">View Comparison</button>
              )}
              {duplicateMode && selectedForDuplicate && (
                <button onClick={handleConfirmDuplicate} className="ml-4 px-3 py-1.5 bg-blue-500 text-white rounded-md text-sm font-medium hover:bg-blue-600">Duplicate Now</button>
              )}
              {tabCompareMode && selectedCompareTarget && (
                <button onClick={handleStartTabComparison} className="ml-4 px-3 py-1.5 bg-blue-500 text-white rounded-md text-sm font-medium hover:bg-blue-600">View Comparison</button>
              )}
            </div>
          </div>

          {/* Tab Action Bar */}
          <div className="mb-6 flex items-center justify-between">
            {/* Requirement Coverage and Status Indicators */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center">
                <span className={`text-2xl font-bold ${getScoreColor(currentConfig.overallFitScore)}`}>{currentConfig.overallFitScore}%</span>
                <span className="text-sm text-gray-500 ml-2">Requirement Coverage</span>
              </div>
              <div className="w-px h-6 bg-gray-300"></div>
              <button onClick={scrollToConfigCoverageGaps} className="flex items-center space-x-2 text-sm text-gray-600 hover:text-yellow-600 hover:underline cursor-pointer">
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500"></div>
                <span>{currentConfig.partiallySatisfied || 0} Partial</span>
              </button>
              <button onClick={scrollToConfigCoverageGaps} className="flex items-center space-x-2 text-sm text-gray-600 hover:text-red-600 hover:underline cursor-pointer">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
                <span>{currentConfig.pending || 0} Uncovered</span>
              </button>
            </div>
            {/* Action Buttons */}
            <div className="flex items-center space-x-2">
              <button onClick={handleTabCompareToggle} className={`flex items-center space-x-1 px-3 py-1.5 border rounded-md text-sm ${tabCompareMode ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
                {tabCompareMode ? <Icons.X className="w-4 h-4" /> : <Icons.GitCompare className="w-4 h-4" />}
                <span>{tabCompareMode ? 'Cancel' : 'Compare'}</span>
              </button>
              <button onClick={handleTabDuplicate} className="flex items-center space-x-1 px-3 py-1.5 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50">
                <Icons.Copy className="w-4 h-4" />
                <span>Duplicate</span>
              </button>
              <button onClick={handleEditToggle} className={`flex items-center space-x-1 px-3 py-1.5 border rounded-md text-sm ${editMode ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
                {editMode ? <Icons.X className="w-4 h-4" /> : <Icons.Edit3 className="w-4 h-4" />}
                <span>{editMode ? 'Done' : 'Edit'}</span>
              </button>
              <div className="w-px h-6 bg-gray-300 mx-1"></div>
              <button onClick={handleShare} className="p-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">
                <Icons.Share2 className="w-4 h-4" />
              </button>
              <button className="p-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">
                <Icons.Download className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Show comparison view or regular content */}
          {showComparison ? (
            /* Comparison View */
            <div className="space-y-6">
              {/* Side by Side BOM */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-medium mb-4 text-gray-800">Bill of Materials Comparison</h3>
                <div className="grid grid-cols-2 gap-6">
                  {selectedForCompare.map((configId) => {
                    const config = configurations.find(c => c.id === configId);
                    if (!config) return null;
                    return (
                      <div key={configId}>
                        <div className="mb-3">
                          {config.badge && (
                            <span className={`inline-block mb-1 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide rounded-sm ${config.badgeColor === 'green' ? 'bg-fuchsia-50 text-fuchsia-700' : 'bg-rose-50 text-rose-600'}`}>
                              {config.badge}
                            </span>
                          )}
                          <h4 className="font-medium text-gray-700">{config.name}</h4>
                        </div>
                        <table className="min-w-full divide-y divide-gray-200 text-sm">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500">Part Number</th>
                              <th className="px-2 py-2 text-right text-xs font-medium text-gray-500">Price</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {config.bom.map((item, idx) => (
                              <tr key={idx}>
                                <td className="px-2 py-2 text-gray-900">{item.partNumber}</td>
                                <td className="px-2 py-2 text-right text-gray-900">{formatCurrency(item.unitPrice)}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="bg-blue-50">
                            <tr>
                              <td className="px-2 py-2 font-bold text-gray-900">Total:</td>
                              <td className="px-2 py-2 text-right font-bold text-blue-600">{formatCurrency(calculateTotal(config.bom))}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Side by Side Configuration Gaps */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-medium mb-4 text-gray-800">Configuration Coverage Gaps Comparison</h3>
                <div className="grid grid-cols-2 gap-6">
                  {selectedForCompare.map((configId) => {
                    const config = configurations.find(c => c.id === configId);
                    if (!config) return null;
                    return (
                      <div key={configId}>
                        <div className="mb-3">
                          {config.badge && (
                            <span className={`inline-block mb-1 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide rounded-sm ${config.badgeColor === 'green' ? 'bg-fuchsia-50 text-fuchsia-700' : 'bg-rose-50 text-rose-600'}`}>
                              {config.badge}
                            </span>
                          )}
                          <h4 className="font-medium text-gray-700">{config.name}</h4>
                        </div>
                        {['Compute & Performance', 'I/O & Connectivity', 'Form Factor', 'Environment & Standards', 'Commercial'].map((category) => {
                          const categoryGaps = config.specificationGaps?.filter(g => g.category === category) || [];
                          if (categoryGaps.length === 0) return null;
                          return (
                            <div key={category} className="mb-3">
                              <h5 className="text-sm font-medium text-gray-600 mb-1">{category}</h5>
                              <ul className="space-y-1 text-sm text-gray-600 ml-2">
                                {categoryGaps.map((g, i) => (
                                  <li key={i} className="flex items-start">
                                    <span className={`mr-1 ${g.status === 'pending' ? 'text-red-500' : 'text-yellow-500'}`}>•</span>
                                    <span>{g.text}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          );
                        })}
                        {(!config.specificationGaps || config.specificationGaps.length === 0) && (
                          <p className="text-sm text-gray-500 italic">No configuration gaps</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <button onClick={() => { setShowComparison(false); setCompareMode(false); setSelectedForCompare([]); setTabCompareMode(false); setCompareFromTab(null); setSelectedCompareTarget(null); }} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300">
                Exit Comparison
              </button>
            </div>
          ) : (
            /* Regular Content */
            <>
              {/* Bill of Materials Accordion */}
              <div ref={bomRef} className="bg-white rounded-lg shadow-sm mb-6">
                <button onClick={() => setBomOpen(!bomOpen)} className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50 rounded-lg">
                  <h3 className="text-lg font-medium text-gray-800">Bill of Materials</h3>
                  {bomOpen ? <Icons.ChevronUp className="w-5 h-5 text-gray-500" /> : <Icons.ChevronDown className="w-5 h-5 text-gray-500" />}
                </button>
                {bomOpen && (
                  <div className="px-6 pb-6">
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Part Number</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Unit Price (EXW)</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Lead Time</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                            {editMode && <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>}
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {currentConfig.bom.map((item, idx) => (
                            <tr key={idx} className={item.isMandatory ? '' : 'bg-gray-50'}>
                              <td className="px-4 py-4 text-sm">
                                <div className="flex items-center space-x-2">
                                  <span className="text-gray-400">{getCategoryIcon(item.category)}</span>
                                  <span className="font-medium text-gray-900">{item.partNumber}</span>
                                  {!item.isMandatory && <span className="px-1.5 py-0.5 text-xs bg-yellow-100 text-yellow-700 rounded">Optional</span>}
                                </div>
                              </td>
                              <td className="px-4 py-4 text-sm text-gray-600">{item.description}</td>
                              <td className="px-4 py-4 text-sm text-gray-900 text-right">{formatCurrency(item.unitPrice)}</td>
                              <td className="px-4 py-4 text-sm text-gray-900 text-right">{item.leadTimeDate}</td>
                              <td className="px-4 py-4 text-sm text-gray-900 text-right font-medium">{formatCurrency(item.unitPrice * item.quantity)}</td>
                              {editMode && (
                                <td className="px-4 py-4 text-sm text-center">
                                  <div className="flex items-center justify-center space-x-2">
                                    <button className="p-1 text-blue-600 hover:bg-blue-50 rounded" title="Change">
                                      <Icons.RefreshCw className="w-4 h-4" />
                                    </button>
                                    <button className="p-1 text-red-600 hover:bg-red-50 rounded" title="Remove">
                                      <Icons.Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-blue-50">
                          <tr>
                            <td colSpan={editMode ? 5 : 4} className="px-4 py-4 text-right font-bold text-gray-900">Total:</td>
                            <td className="px-4 py-4 text-right font-bold text-blue-600 text-lg">{formatCurrency(calculateTotal(currentConfig.bom))}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Commercial Terms Accordion */}
              <div className="bg-white rounded-lg shadow-sm mb-6">
                <button onClick={() => setCommercialTermsOpen(!commercialTermsOpen)} className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50 rounded-lg">
                  <h3 className="text-lg font-medium text-gray-800">Commercial Terms</h3>
                  {commercialTermsOpen ? <Icons.ChevronUp className="w-5 h-5 text-gray-500" /> : <Icons.ChevronDown className="w-5 h-5 text-gray-500" />}
                </button>
                {commercialTermsOpen && (
                  <div className="px-6 pb-6">
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm text-gray-500 mb-1">Currency</label>
                        <select value={commercialTerms.currency} onChange={(e: ChangeEvent<HTMLSelectElement>) => setCommercialTerms({...commercialTerms, currency: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-md">
                          <option value="USD">USD</option>
                          <option value="EUR">EUR</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-500 mb-1">Warranty</label>
                        <select value={commercialTerms.warranty} onChange={(e: ChangeEvent<HTMLSelectElement>) => setCommercialTerms({...commercialTerms, warranty: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-md">
                          <option>1 year standard</option>
                          <option>2 year extended</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-500 mb-1">Shipping Terms</label>
                        <select value={commercialTerms.shippingTerms} onChange={(e: ChangeEvent<HTMLSelectElement>) => setCommercialTerms({...commercialTerms, shippingTerms: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-md">
                          <option>FOB Origin</option>
                          <option>CIF</option>
                          <option>DDP</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-500 mb-1">Price Validity</label>
                        <p className="px-3 py-2 bg-gray-50 rounded-md text-gray-700">{commercialTerms.priceValidity}</p>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-500 mb-1">Est. Lead Time</label>
                        <p className="px-3 py-2 bg-gray-50 rounded-md text-gray-700">{commercialTerms.estimatedLeadTime}</p>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-500 mb-1">Quantity</label>
                        <input type="number" value={commercialTerms.quantity} onChange={(e: ChangeEvent<HTMLInputElement>) => setCommercialTerms({...commercialTerms, quantity: parseInt(e.target.value) || 1})} className="w-full px-3 py-2 border border-gray-300 rounded-md" min={1} />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Configuration Coverage Gaps Accordion */}
              <div ref={configGapsRef} className="bg-white rounded-lg shadow-sm mb-6">
                <button onClick={() => setSpecGapsOpen(!specGapsOpen)} className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50 rounded-lg">
                  <h3 className="text-lg font-medium text-gray-800">Configuration Coverage Gaps</h3>
                  {specGapsOpen ? <Icons.ChevronUp className="w-5 h-5 text-gray-500" /> : <Icons.ChevronDown className="w-5 h-5 text-gray-500" />}
                </button>
                {specGapsOpen && (
                  <div className="px-6 pb-6">
                    {['Compute & Performance', 'I/O & Connectivity', 'Form Factor', 'Environment & Standards', 'Commercial'].map((category) => {
                      const categoryGaps = currentConfig.specificationGaps?.filter(g => g.category === category) || [];
                      if (categoryGaps.length === 0) return null;
                      return (
                        <div key={category} className="mb-4 last:mb-0">
                          <h4 className="font-medium text-gray-700 mb-2">{category}</h4>
                          <ul className="space-y-1 text-sm text-gray-600 ml-2">
                            {categoryGaps.map((g, i) => (
                              <li key={i} className="flex items-start">
                                <span className={`mr-1 ${g.status === 'pending' ? 'text-red-500' : 'text-yellow-500'}`}>•</span>
                                <span>{g.text}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Unvalidated Assumptions Accordion */}
              <div ref={unvalidatedAssumptionsRef} className="bg-white rounded-lg shadow-sm mb-6">
                <button onClick={() => setUnvalidatedAssumptionsOpen(!unvalidatedAssumptionsOpen)} className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50 rounded-lg">
                  <h3 className="text-lg font-medium text-gray-800">Unvalidated Assumptions</h3>
                  {unvalidatedAssumptionsOpen ? <Icons.ChevronUp className="w-5 h-5 text-gray-500" /> : <Icons.ChevronDown className="w-5 h-5 text-gray-500" />}
                </button>
                {unvalidatedAssumptionsOpen && (
                  <div className="px-6 pb-6">
                    <ul className="space-y-2 text-sm text-gray-600">
                      {currentConfig.unvalidatedAssumptions?.map((a, i) => (
                        <li key={i} className="flex items-start">
                          <span className="mr-2 text-yellow-500">•</span>
                          <span>{a}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Comments Accordion */}
              <div className="bg-white rounded-lg shadow-sm mb-6">
                <button onClick={() => setCommentsOpen(!commentsOpen)} className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50 rounded-lg">
                  <h3 className="text-lg font-medium text-gray-800">Comments</h3>
                  {commentsOpen ? <Icons.ChevronUp className="w-5 h-5 text-gray-500" /> : <Icons.ChevronDown className="w-5 h-5 text-gray-500" />}
                </button>
                {commentsOpen && (
                  <div className="px-6 pb-6">
                    <ul className="space-y-2 text-sm text-gray-600">
                      {currentConfig.comments?.map((c, i) => (
                        <li key={i} className="flex items-start">
                          <span className="mr-2 text-gray-400">•</span>
                          <span>{c}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Share Popup Modal */}
      {showSharePopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-96 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Share Configuration</h3>
              <button onClick={() => setShowSharePopup(false)} className="p-1 text-gray-400 hover:text-gray-600 rounded">
                <Icons.X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-4">Copy this link to share the current configuration with others.</p>
            <div className="flex items-center space-x-2">
              <input type="text" readOnly value={getShareLink()} className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm bg-gray-50 text-gray-700" />
              <button onClick={handleCopyShareLink} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${shareLinkCopied ? 'bg-green-500 text-white' : 'bg-blue-500 text-white hover:bg-blue-600'}`}>
                {shareLinkCopied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-3">Paste this link in email, Slack, or any messaging system to share.</p>
          </div>
        </div>
      )}
    </div>
  );
}
