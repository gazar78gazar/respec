// Standardized form specification with hierarchical structure: Areas → Categories → Specifications
export const formFieldsData = {
  field_definitions: {
    // Area: Compute Performance
    computePerformance: {
      // Processing Category
      processorType: {
        type: "dropdown",
        label: "Processor Type",
        options: [
          "Not Required",
          "Entry (Intel Atom)",
          "Standard (Intel Core i3)",
          "Performance (Intel Core i5)",
          "Premium (Intel Core i7)",
          "Extreme (Intel Core i9)",
        ],
        group: "processing",
      },
      gpuAcceleration: {
        type: "dropdown",
        label: "AI/GPU Acceleration",
        options: [
          "Not Required",
          "Intel Xe Graphics",
          "Dedicated GPU Required",
          "AI Accelerator (NPU/TPU)",
        ],
        group: "processing",
      },
      // Memory Category
      memoryCapacity: {
        type: "dropdown",
        label: "Memory Capacity",
        options: ["Not Required", "4GB", "8GB", "16GB", "32GB", "64GB"],
        group: "memory",
      },
      memoryType: {
        type: "dropdown",
        label: "Memory Type",
        options: ["Not Required", "DDR4", "DDR5"],
        group: "memory",
      },
      // Storage Category
      storageCapacity: {
        type: "dropdown",
        label: "Storage Capacity",
        options: ["Not Required", "128GB", "256GB", "512GB", "1TB", "2TB"],
        group: "storage",
      },
      storageType: {
        type: "dropdown",
        label: "Storage Type",
        options: ["Not Required", "SATA SSD", "NVMe", "NVMe Gen4"],
        group: "storage",
      },
      // Response Time Category
      timeSensitiveFeatures: {
        type: "multi-select",
        label: "Time Sensitive Features",
        options: [
          "Not Required",
          "TSN Support",
          "PTP IEEE1588",
          "Hardware Timestamping",
        ],
        group: "response_time",
      },
      responseLatency: {
        type: "dropdown",
        label: "Response Latency",
        options: [
          "Not Required",
          "Standard Real-Time (<10ms)",
          "Near Real-Time (<20ms)",
          "Interactive (<50ms)",
          "Responsive (<100ms)",
        ],
        group: "response_time",
      },
      // Software Category
      operatingSystem: {
        type: "dropdown",
        label: "Operating System",
        options: [
          "Not Required",
          "Windows 11 IoT",
          "Ubuntu 20.04 LTS",
          "Ubuntu 22.04 LTS",
          "Real-Time Linux",
        ],
        group: "software",
      },
    },

    // Area: I/O & Connectivity
    IOConnectivity: {
      // Core I/O Requirements Category
      digitalIO: {
        type: "dropdown",
        label: "Digital IO",
        options: [
          "Not Required",
          "2",
          "4",
          "6",
          "8",
          "16",
          "32",
          "64",
          "Over 64",
        ],
        group: "core_io",
      },
      analogIO: {
        type: "dropdown",
        label: "Analog IO",
        options: [
          "Not Required",
          "2",
          "4",
          "6",
          "8",
          "16",
          "32",
          "64",
          "Over 64",
        ],
        group: "core_io",
      },
      // Ethernet Category
      ethernetPorts: {
        type: "dropdown",
        label: "Ethernet (RJ45) Ports",
        options: ["Not Required", "2", "4", "6", "8", "Over 8"],
        group: "ethernet",
      },
      ethernetSpeed: {
        type: "dropdown",
        label: "Ethernet Speed",
        options: ["Not Required", "100 Mbps", "1 Gbps", "10 Gbps"],
        group: "ethernet",
      },
      ethernetProtocols: {
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
          "Modbus TCP",
        ],
        group: "ethernet",
      },
      // Serial & USB Category
      usbPorts: {
        type: "dropdown",
        label: "USB Ports",
        options: ["Not Required", "2", "4", "6", "8", "Over 8"],
        group: "serial_usb",
      },
      serialPortsAmount: {
        type: "dropdown",
        label: "Serial Ports Amount",
        options: ["Not Required", "1", "2", "3", "4", "5", "6", "Over 6"],
        group: "serial_usb",
      },
      serialPortType: {
        type: "multi-select",
        label: "Serial Port Type",
        options: ["Not Required", "RS-232", "RS-422", "RS-485"],
        group: "serial_usb",
      },
      // Industrial Protocols Category
      serialProtocolSupport: {
        type: "dropdown",
        label: "Serial Protocol Support",
        options: ["Not Required", "CANbus", "TTL", "UART"],
        group: "industrial_protocols",
      },
      fieldbusProtocolSupport: {
        type: "multi-select",
        label: "Fieldbus Protocol Support",
        options: [
          "Not Required",
          "Modbus RTU",
          "PROFIBUS",
          "DeviceNet",
          "CANOpen",
        ],
        group: "industrial_protocols",
      },
      // Wireless Category
      wirelessExtension: {
        type: "multi-select",
        label: "Wireless Extension",
        options: [
          "Not Required",
          "WiFi 6",
          "WiFi 6E",
          "5G",
          "4G LTE",
          "LoRaWAN",
        ],
        group: "wireless",
      },
    },

    // Area: Form Factor
    formFactor: {
      // Power Requirements Category
      powerInput: {
        type: "dropdown",
        label: "Power Input",
        options: ["Not Required", "9-36V DC", "18-36V DC", "24V DC", "PoE+"],
        group: "power_requirements",
      },
      maxPowerConsumption: {
        type: "dropdown",
        label: "Max Power Consumption",
        options: [
          "Not Required",
          "< 10W",
          "10-20W",
          "20-35W",
          "35-65W",
          "> 65W",
        ],
        group: "power_requirements",
      },
      redundantPower: {
        type: "dropdown",
        label: "Redundant Power",
        options: ["Not Required", "Single", "Dual", "N+1"],
        group: "power_requirements",
      },
      dimensions: {
        type: "dropdown",
        label: "Dimensions",
        options: [
          "Not Required",
          "Ultra Compact (<100mm)",
          "Compact (100-200mm)",
          "Standard (200-300mm)",
          "Large (>300mm)",
        ],
        group: "power_requirements",
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
          "Embedded",
        ],
        group: "power_requirements",
      },
    },

    // Area: Environment & Standards
    environmentStandards: {
      // Environment Category
      operatingTemperature: {
        type: "dropdown",
        label: "Operating Temperature",
        options: [
          "Not Required",
          "0°C to 50°C",
          "-20°C to 60°C",
          "-40°C to 70°C",
        ],
        group: "environment",
      },
      humidity: {
        type: "dropdown",
        label: "Humidity",
        options: [
          "Not Required",
          "+90% RH non-condensing",
          "+90% RH @ 40°C",
          "Condensing Allowed (100% RH)",
        ],
        group: "environment",
      },
      vibrationResistance: {
        type: "dropdown",
        label: "Vibration Resistance",
        options: [
          "Not Required",
          "Standard (2G)",
          "Heavy (5G)",
          "Extreme (10G)",
        ],
        group: "environment",
      },
      ingress_protection: {
        type: "dropdown",
        label: "Ingress Protection",
        options: [
          "Not Required",
          "IP20",
          "IP40",
          "IP54",
          "IP65",
          "IP67",
          "IP69",
        ],
        group: "environment",
      },
      // Standards Category
      vibrationProtection: {
        type: "dropdown",
        label: "Vibration Protection",
        options: ["Not Required", "IEC 60068-2-64", "MIL-STD-810"],
        group: "standards",
      },
      certifications: {
        type: "multi-select",
        label: "Certifications",
        options: ["Not Required", "CE", "FCC", "UL", "CCC", "ATEX", "IECEx"],
        group: "standards",
      },
    },

    // Area: Commercial
    commercial: {
      // Pricing & Quantity Category
      budgetPerUnit: {
        type: "number",
        label: "Budget Per Unit",
        min: 0,
        group: "pricing_quantity",
      },
      quantity: {
        type: "number",
        label: "Quantity",
        min: 1,
        max: 1000,
        group: "pricing_quantity",
      },
      totalBudget: {
        type: "number",
        label: "Total Budget",
        min: 0,
        calculated: true, // Flag for auto-calculation
        group: "pricing_quantity",
      },
      // Logistics & Support Category
      deliveryTimeframe: {
        type: "dropdown",
        label: "Delivery Timeframe",
        options: [
          "Not Required",
          "2 Weeks",
          "4 Weeks",
          "6 Weeks",
          "8 Weeks",
          "10 Weeks",
          "Over 10 Weeks",
        ],
        group: "logistics_support",
      },
      shippingIncoterms: {
        type: "dropdown",
        label: "Shipping Incoterms",
        options: ["Not Required", "FOB", "CIF", "DDP", "EXW"],
        group: "logistics_support",
      },
      warrantyRequirements: {
        type: "dropdown",
        label: "Warranty Requirements",
        options: ["Not Required", "1 Year", "2 Years", "3 Years", "5 Years"],
        group: "logistics_support",
      },
    },
  },

  field_groups: {
    computePerformance: {
      processing: {
        label: "Processing",
        fields: ["processorType", "gpuAcceleration"],
        defaultOpen: true,
      },
      memory: {
        label: "Memory",
        fields: ["memoryCapacity", "memoryType"],
        defaultOpen: false,
      },
      storage: {
        label: "Storage",
        fields: ["storageCapacity", "storageType"],
        defaultOpen: false,
      },
      response_time: {
        label: "Response Time",
        fields: ["timeSensitiveFeatures", "responseLatency"],
        defaultOpen: false,
      },
      software: {
        label: "Software",
        fields: ["operatingSystem"],
        defaultOpen: false,
      },
    },
    IOConnectivity: {
      core_io: {
        label: "Core I/O Requirements",
        fields: ["digitalIO", "analogIO"],
        defaultOpen: true,
      },
      ethernet: {
        label: "Ethernet",
        fields: ["ethernetPorts", "ethernetSpeed", "ethernetProtocols"],
        defaultOpen: false,
      },
      serial_usb: {
        label: "Serial & USB",
        fields: ["usbPorts", "serialPortsAmount", "serialPortType"],
        defaultOpen: false,
      },
      industrial_protocols: {
        label: "Industrial Protocols",
        fields: ["serialProtocolSupport", "fieldbusProtocolSupport"],
        defaultOpen: false,
      },
      wireless: {
        label: "Wireless",
        fields: ["wirelessExtension"],
        defaultOpen: false,
      },
    },
    formFactor: {
      power_requirements: {
        label: "Power Requirements & Form Factor",
        fields: [
          "powerInput",
          "maxPowerConsumption",
          "redundantPower",
          "dimensions",
          "mounting",
        ],
        defaultOpen: true,
      },
    },
    environmentStandards: {
      environment: {
        label: "Environment",
        fields: [
          "operatingTemperature",
          "humidity",
          "vibrationResistance",
          "ingress_protection",
        ],
        defaultOpen: true,
      },
      standards: {
        label: "Standards",
        fields: ["vibrationProtection", "certifications"],
        defaultOpen: false,
      },
    },
    commercial: {
      pricing_quantity: {
        label: "Pricing & Quantity",
        fields: ["budgetPerUnit", "quantity", "totalBudget"],
        defaultOpen: true,
      },
      logistics_support: {
        label: "Logistics & Support",
        fields: [
          "deliveryTimeframe",
          "shippingIncoterms",
          "warrantyRequirements",
        ],
        defaultOpen: false,
      },
    },
  },

  // Priority system for required fields
  priority_system: {
    must_fields: [
      "digitalIO",
      "analogIO",
      "ethernetPorts",
      "budgetPerUnit",
      "quantity",
    ],
    priority_levels: {
      "1": {
        fields: [
          "digitalIO",
          "analogIO",
          "ethernetPorts",
          "budgetPerUnit",
          "quantity",
        ],
      },
      "2": {
        fields: ["processorType", "memoryCapacity", "storageCapacity"],
      },
      "3": { fields: ["operatingTemperature", "ingress_protection"] },
      "4": {
        fields: ["serialPortsAmount", "usbPorts", "deliveryTimeframe"],
      },
    },
  },
};

// Map sections to new standardized areas
export const SECTION_MAPPING = {
  "Compute Performance": ["computePerformance"],
  "I/O & Connectivity": ["IOConnectivity"],
  "Form Factor": ["formFactor"],
  "Environment & Standards": ["environmentStandards"],
  Commercial: ["commercial"],
};
