// Standardized form specification with hierarchical structure: Areas → Categories → Specifications
export const formFieldsData = {
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
export const SECTION_MAPPING = {
  'Compute Performance': ['compute_performance'],
  'I/O & Connectivity': ['io_connectivity'],
  'Form Factor': ['form_factor'],
  'Environment & Standards': ['environment_standards'],
  'Commercial': ['commercial']
};