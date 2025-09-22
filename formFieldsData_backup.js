// Backup of original formFieldsData from app.tsx (lines 98-366)
// Created during migration to standardized form specification

const formFieldsData_backup = {
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

module.exports = formFieldsData_backup;