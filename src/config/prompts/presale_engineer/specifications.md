# Specifications (UC8 2.2)

Use exact option values as listed. Only select from these options.

### Key Specifications (require user input)

Must be shortlisted through conversation before autofill available:


- `processorType`: Not Required, Entry (Intel Atom), Standard (Intel Core i3), Performance (Intel Core i5), Premium (Intel Core i7), Extreme (Intel Core i9)
- `memoryCapacity`: 4GB, 8GB, 16GB, 32GB, 64GB
- `storageCapacity`: 128GB, 256GB, 512GB, 1TB, 2TB
- `responseLatency`: Not Required, Standard Real-Time (<10ms), Near Real-Time (<20ms), Interactive (<50ms), Responsive (<100ms)
- `digitalIO`: None, 2, 4, 8, 16, 32, 64
- `analogIO`: None, 2, 4, 8, 16, 32, 64
- `ethernetPorts`: 2, 4, 8, 16
- `serialProtocols`: None, Modbus RTU, Modbus ASCII, BACnet MS/TP
- `utilityProtocols`: None, IEC 61850, DNP3, IEC 60870-5
- `wirelessExtension`: Not Required, WiFi 6, WiFi 6E, LTE, 5G, LoRa, Bluetooth 5.3
- `maxPowerConsumption`: Not Required, < 10W, 10-20W, 20-35W, 35-65W, > 65W
- `operatingTemperature`: Not Required, 0° to 50°, -20° to 60°, -40° to 70°, -40° to 85°

### Non-Key Specifications (autofill eligible)

### IOConnectivity

#### core_io

- `adcResolution`: Not Required, 16-bit, 24-bit
- `analogIO`: None, 2, 4, 8, 16, 32, 64
- `digitalIO`: None, 2, 4, 8, 16, 32, 64
- `samplingRate`: Not Required, 10 kHz, 100 kHz, 1 MHz, 1.6 MHz

#### ethernet

- `deterministicFeatures`: None, TSN (Time-Sensitive Networking), IEEE 1588 PTP, Hardware Timestamping
- `ethernetProtocols`: None, Modbus TCP, OPC UA, MQTT, BACnet/IP, PROFINET, EtherCAT, Ethernet/IP
- `ethernetSpeed`: Not Required, 100 Mbps, 1 Gbps, 10 Gbps
- `ethernetPorts`: 2, 4, 8, 16

#### serial_protocols

- `serialProtocols`: None, Modbus RTU, Modbus ASCII, BACnet MS/TP

#### serial_usb

- `usbPorts`: 0, 2, 4, 8, 16

#### utility_protocols

- `utilityProtocols`: None, IEC 61850, DNP3, IEC 60870-5

#### wireless

- `wirelessExtension`: Not Required, WiFi 6, WiFi 6E, LTE, 5G, LoRa, Bluetooth 5.3

### computePerformance

#### gpu_acceleration

- `gpuAcceleration`: None, Intel Xe Graphics, Dedicated GPU Required, AI Accelerator (NPU/TPU)

#### memory

- `memoryCapacity`: 4GB, 8GB, 16GB, 32GB, 64GB
- `memoryType`: DDR4, DDR5, Any

#### processing

- `processorType`: Not Required, Entry (Intel Atom), Standard (Intel Core i3), Performance (Intel Core i5), Premium (Intel Core i7), Extreme (Intel Core i9)

#### response_time

- `responseLatency`: Not Required, Standard Real-Time (<10ms), Near Real-Time (<20ms), Interactive (<50ms), Responsive (<100ms)

#### software

- `operatingSystem`: Not Required, Windows 11 IoT, Ubuntu 20.04 LTS, Ubuntu 22.04 LTS, Real-Time Linux

#### storage

- `storageCapacity`: 128GB, 256GB, 512GB, 1TB, 2TB
- `storageType`: SATA SSD, NVMe, NVMe Gen4, Any

### environmentStandards

#### environment

- `ingressProtection`: IP20 (Basic), IP40 (Dust Protected), IP54 (Dust/Splash), IP65 (Dust/Water Jets), IP67 (Dust/Immersion), IP69K (High Pressure)
- `operatingTemperature`: Not Required, 0° to 50°, -20° to 60°, -40° to 70°, -40° to 85°
- `shockProtection`: Standard (10G, 11ms), Industrial (30G, 11ms), Rugged (50G, 11ms), Military (100G, MIL-STD-810)
- `vibrationResistance`: Not Required, Standard (2G), Heavy (5G), Extreme (10G)

### formFactor

#### physical_design

- `coolingMethod`: Fanless (Passive), Fan Cooled (Active), Extended Heatsink, Any
- `mountingType`: DIN Rail, 19-inch Rack, Panel/Wall Mount, Desktop/Bench, Embedded/OEM, Any

#### power_requirements

- `maxPowerConsumption`: Not Required, < 10W, 10-20W, 20-35W, 35-65W, > 65W
- `powerInput`: 9-36V DC Wide Input, 18-36V DC, 24V DC Standard, 24/48V DC, 110-240V AC, PoE+ (25.5W), Redundant Power, Any
- `redundantPower`: Not Required, Single, Dual, N+1
