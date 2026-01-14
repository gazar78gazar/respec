import React, { useState, useEffect, useRef, useCallback } from "react";
import { AlertTriangle, Info, ChevronDown, TrendingUp, Clock, Users, UserCheck, FileEdit } from "lucide-react";

// ============================================
// Combined Activity Graph with Coverage Bars
// ============================================
const ActivityGraph = ({ 
  interactionsData,
  coverageData,
  labels 
}: { 
  interactionsData: (number | null)[];
  coverageData: { config1: (number | null)[]; config2: (number | null)[] };
  labels: string[];
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; content: string[] } | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  const padding = { top: 30, right: 50, bottom: 30, left: 40 };

  const config1Color = 'rgba(99, 102, 241, 0.45)';
  const config2Color = 'rgba(236, 72, 153, 0.45)';
  const interactionsColor = '#3B82F6';

  const scaleValue = (value: number, chartHeight: number): number => {
    if (value <= 60) {
      return (value / 60) * (chartHeight * 0.1);
    } else {
      const base = chartHeight * 0.1;
      const remaining = ((value - 60) / 40) * (chartHeight * 0.9);
      return base + remaining;
    }
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setCanvasSize({ width: rect.width, height: rect.height });
      }
    };

    updateSize();

    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(container);

    return () => resizeObserver.disconnect();
  }, []);

  const drawChart = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || canvasSize.width === 0 || canvasSize.height === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvasSize.width;
    const height = canvasSize.height;
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    canvas.width = width * 2;
    canvas.height = height * 2;
    ctx.scale(2, 2);

    ctx.clearRect(0, 0, width, height);

    const coverageMax = 100;
    
    const validInteractions = interactionsData.filter(v => v !== null) as number[];
    const interactionsMax = validInteractions.length > 0 ? Math.max(...validInteractions) * 1.3 : 10;

    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    
    const gridValues = [60, 70, 80, 90, 100];
    gridValues.forEach(val => {
      const scaledHeight = scaleValue(val, chartHeight);
      const y = padding.top + chartHeight - scaledHeight;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
    });

    ctx.fillStyle = '#9ca3af';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'right';
    
    const labelValues = [60, 70, 80, 90, 100];
    labelValues.forEach(val => {
      const scaledHeight = scaleValue(val, chartHeight);
      const y = padding.top + chartHeight - scaledHeight;
      ctx.fillText(`${val}%`, padding.left - 8, y + 3);
    });

    ctx.textAlign = 'left';
    ctx.fillStyle = interactionsColor;
    for (let i = 0; i <= 4; i++) {
      const value = Math.round(interactionsMax * (4 - i) / 4);
      const y = padding.top + (chartHeight * i) / 4;
      ctx.fillText(value.toString(), width - padding.right + 8, y + 3);
    }

    ctx.fillStyle = '#9ca3af';
    ctx.textAlign = 'center';
    const barGroupWidth = chartWidth / labels.length;
    labels.forEach((label, i) => {
      const x = padding.left + barGroupWidth * i + barGroupWidth / 2;
      ctx.fillText(label, x, height - 8);
    });

    const barWidth = barGroupWidth * 0.3;
    const barGap = 3;

    labels.forEach((_, i) => {
      if (interactionsData[i] !== null && coverageData.config1[i] !== null) {
        const groupX = padding.left + barGroupWidth * i;
        
        const c1Value = coverageData.config1[i] as number;
        const c1Height = scaleValue(c1Value, chartHeight);
        const c1X = groupX + (barGroupWidth - barWidth * 2 - barGap) / 2;
        
        ctx.fillStyle = config1Color;
        ctx.fillRect(c1X, padding.top + chartHeight - c1Height, barWidth, c1Height);
        
        const c2Value = coverageData.config2[i] as number;
        const c2Height = scaleValue(c2Value, chartHeight);
        const c2X = c1X + barWidth + barGap;
        
        ctx.fillStyle = config2Color;
        ctx.fillRect(c2X, padding.top + chartHeight - c2Height, barWidth, c2Height);
      }
    });

    const interactionPoints: { x: number; y: number | null; value: number | null }[] = [];

    interactionsData.forEach((value, i) => {
      const x = padding.left + barGroupWidth * i + barGroupWidth / 2;
      const y = value !== null 
        ? padding.top + chartHeight - (value / interactionsMax) * chartHeight
        : null;
      interactionPoints.push({ x, y, value });
    });

    ctx.strokeStyle = interactionsColor;
    ctx.lineWidth = 2.5;
    
    let lastValidPoint: { x: number; y: number } | null = null;
    interactionPoints.forEach((point) => {
      if (point.value !== null && point.y !== null) {
        if (lastValidPoint) {
          ctx.beginPath();
          ctx.moveTo(lastValidPoint.x, lastValidPoint.y);
          ctx.lineTo(point.x, point.y);
          ctx.stroke();
        }
        lastValidPoint = { x: point.x, y: point.y };
      }
    });

    interactionPoints.forEach((point) => {
      if (point.value !== null && point.y !== null) {
        ctx.fillStyle = 'rgba(59, 130, 246, 0.3)';
        ctx.beginPath();
        ctx.arc(point.x, point.y, 10, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = interactionsColor;
        ctx.beginPath();
        ctx.arc(point.x, point.y, 7, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(point.x, point.y, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    ctx.fillStyle = '#6b7280';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Completion %', padding.left, padding.top - 15);
    
    ctx.textAlign = 'right';
    ctx.fillStyle = interactionsColor;
    ctx.fillText('Interactions', width - padding.right, padding.top - 15);

  }, [canvasSize, interactionsData, coverageData, labels, padding, config1Color, config2Color, interactionsColor]);

  useEffect(() => {
    drawChart();
  }, [drawChart]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    if (!container || canvasSize.width === 0) return;

    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;

    const chartWidth = canvasSize.width - padding.left - padding.right;
    const barGroupWidth = chartWidth / labels.length;

    const dataIndex = Math.floor((x - padding.left) / barGroupWidth);
    
    if (dataIndex >= 0 && dataIndex < labels.length) {
      const tooltipContent: string[] = [labels[dataIndex]];
      
      const intValue = interactionsData[dataIndex];
      if (intValue !== null) {
        tooltipContent.push(`Interactions: ${intValue}`);
        tooltipContent.push(`Requirements Covered: ${coverageData.config1[dataIndex]}%`);
        tooltipContent.push(`Assumptions Validated: ${coverageData.config2[dataIndex]}%`);
      } else {
        tooltipContent.push('No activity');
      }

      setTooltip({
        x: e.clientX - rect.left + 10,
        y: e.clientY - rect.top - 10,
        content: tooltipContent,
      });
    }
  };

  const handleMouseLeave = () => {
    setTooltip(null);
  };

  return (
    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
      <div className="flex items-center justify-between mb-3">
        <h5 className="text-sm font-medium text-gray-700">Configuration Completion (Last 7 Days)</h5>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-indigo-500 opacity-60" />
            <span className="text-xs text-gray-500">Requirements Covered</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-pink-500 opacity-60" />
            <span className="text-xs text-gray-500">Assumptions Validated</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span className="text-xs text-gray-500">Interactions</span>
          </div>
        </div>
      </div>
      <div 
        ref={containerRef}
        style={{ height: '200px', position: 'relative' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <canvas 
          ref={canvasRef} 
          style={{ 
            width: '100%', 
            height: '100%',
            display: 'block'
          }} 
        />
        {tooltip && (
          <div
            className="absolute bg-gray-800 text-white text-xs rounded px-2 py-1 pointer-events-none z-10"
            style={{ left: tooltip.x, top: tooltip.y }}
          >
            {tooltip.content.map((line, i) => (
              <div key={i} className={i === 0 ? 'font-semibold border-b border-gray-600 pb-1 mb-1' : ''}>
                {line}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================
// Main Component
// ============================================
export default function EngagementReview() {
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);

  const last7DaysLabels = [
    "Wed Jan 8",
    "Thu Jan 9", 
    "Fri Jan 10",
    "Sat Jan 11",
    "Sun Jan 12",
    "Mon Jan 13",
    "Tue Jan 14"
  ];

  const interactionsData: (number | null)[] = [
    4,     // Wed
    null,  // Thu
    3,     // Fri
    null,  // Sat
    null,  // Sun
    6,     // Mon
    5,     // Tue
  ];

  // Config 2 (Assumptions Validated) now increases from 57% to 88%
  const coverageData = {
    config1: [
      75,    // Wed
      null,  // Thu
      83,    // Fri
      null,  // Sat
      null,  // Sun
      88,    // Mon
      93,    // Tue
    ] as (number | null)[],
    config2: [
      57,    // Wed - starting point
      null,  // Thu
      67,    // Fri
      null,  // Sat
      null,  // Sun
      78,    // Mon
      88,    // Tue - ending point
    ] as (number | null)[],
  };

  const engagementHistory = [
    {
      category: "Compute Performance",
      section: "system",
      changes: [
        { text: "Memory upgraded from 8GB to 16GB DDR5", date: "Jan 14, 2026" },
        { text: "CPU changed to Intel Core i5-1235U", date: "Jan 13, 2026" },
        { text: "Response time target set to <500ms", date: "Jan 10, 2026" },
      ],
    },
    {
      category: "I/O & Connectivity",
      section: "system",
      changes: [
        { text: "Ethernet ports increased to 4x GbE", date: "Jan 14, 2026" },
        { text: "Serial ports: 2x RS-232, 1x RS-485", date: "Jan 9, 2026" },
        { text: "USB ports updated to 4x USB 3.2", date: "Jan 8, 2026" },
      ],
    },
    {
      category: "Power & Form Factor",
      section: "system",
      changes: [
        { text: "Mounting changed to DIN-rail", date: "Jan 9, 2026" },
        { text: "Power input: 12-24V DC wide range", date: "Jan 8, 2026" },
      ],
    },
    {
      category: "Environment & Standards",
      section: "environment",
      changes: [
        { text: "IP rating upgraded to IP40", date: "Jan 10, 2026" },
      ],
    },
    {
      category: "Commercial",
      section: "commercial",
      changes: [
        { text: "Budget per unit adjusted to $1,200-1,500", date: "Jan 13, 2026" },
        { text: "Quantity confirmed at 25 units", date: "Jan 8, 2026" },
      ],
    },
  ];

  const actionItems = [
    {
      type: "assumption",
      description: "Validate 7 remaining assumptions",
      priority: "high",
      hasLink: true,
      linkText: "View assumption list",
    },
    {
      type: "recommendation",
      title: "Resolve Open Issues",
      linkedCategories: [
        { name: "I/O & Connectivity", section: "system" },
        { name: "Compute Performance", section: "system" },
        { name: "Commercial", section: "commercial" },
      ],
      priority: "medium",
    },
  ];

  const metrics = {
    interactions: 28,
    interactionsTrend: 12,
    avgSessionDuration: "19m",
    sessionTrend: 8,
    userLogins: 8,
    uniqueUsers: 5,
    modifications: 12,
  };

  const handleNavigateToSection = (section: string) => {
    console.log(`Navigate to section: ${section}`);
    alert(`Navigate to Requirements Discovery → ${section} section`);
  };

  const totalChanges = engagementHistory.reduce((acc, cat) => acc + cat.changes.length, 0);

  return (
    <div className="bg-gray-100 p-4">
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="bg-white rounded-lg shadow-sm p-4">

          {/* Engagement Metrics - All 5 in Single Row */}
          <div className="mb-4">
            <h4 className="text-base font-medium mb-3 text-gray-800">Engagement Metrics</h4>
            
            <div className="grid grid-cols-5 gap-3">
              {/* Total Interactions */}
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-3 border border-blue-200">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-blue-600 font-medium">Total Interactions</p>
                  <TrendingUp size={14} className="text-blue-600" />
                </div>
                <p className="text-2xl font-bold text-blue-700">{metrics.interactions}</p>
                <div className="flex items-center mt-1">
                  <span className="text-xs font-medium text-green-600 bg-green-100 px-1.5 py-0.5 rounded-full">↑ {metrics.interactionsTrend}%</span>
                </div>
              </div>

              {/* Avg Session Duration */}
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-3 border border-purple-200">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-purple-600 font-medium">Avg Session</p>
                  <Clock size={14} className="text-purple-600" />
                </div>
                <p className="text-2xl font-bold text-purple-700">{metrics.avgSessionDuration}</p>
                <div className="flex items-center mt-1">
                  <span className="text-xs font-medium text-red-600 bg-red-100 px-1.5 py-0.5 rounded-full">↓ {metrics.sessionTrend}%</span>
                </div>
              </div>

              {/* User Logins */}
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-gray-600 font-medium">User Logins</p>
                  <Users size={14} className="text-gray-500" />
                </div>
                <p className="text-2xl font-bold text-gray-700">{metrics.userLogins}</p>
                <p className="text-xs text-gray-400 mt-1">this week</p>
              </div>

              {/* Unique Users */}
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-gray-600 font-medium">Unique Users</p>
                  <UserCheck size={14} className="text-gray-500" />
                </div>
                <p className="text-2xl font-bold text-gray-700">{metrics.uniqueUsers}</p>
                <p className="text-xs text-gray-400 mt-1">this week</p>
              </div>

              {/* Modifications */}
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-gray-600 font-medium">Modifications</p>
                  <FileEdit size={14} className="text-gray-500" />
                </div>
                <p className="text-2xl font-bold text-gray-700">{metrics.modifications}</p>
                <p className="text-xs text-gray-400 mt-1">this week</p>
              </div>
            </div>
          </div>

          {/* Configuration Completion Graph */}
          <div className="mb-4">
            <ActivityGraph 
              labels={last7DaysLabels}
              interactionsData={interactionsData}
              coverageData={coverageData}
            />
          </div>

          {/* Action Items - Side by Side */}
          <div className="mb-4">
            <h4 className="text-base font-medium mb-3 text-gray-800">Action Items</h4>
            <div className="grid grid-cols-2 gap-3">
              {actionItems.map((item, index) => (
                <div
                  key={index}
                  className={`flex items-start p-3 rounded border ${
                    item.type === "assumption"
                      ? "bg-amber-50 border-amber-300"
                      : "bg-blue-50 border-blue-300"
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mr-2 ${
                      item.type === "assumption"
                        ? "bg-amber-100 text-amber-600"
                        : "bg-blue-100 text-blue-600"
                    }`}
                  >
                    {item.type === "assumption" ? (
                      <AlertTriangle size={14} />
                    ) : (
                      <Info size={14} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    {item.type === "assumption" ? (
                      <>
                        <div className="font-medium text-sm text-amber-800">{item.description}</div>
                        {item.hasLink && (
                          <a href="#" className="text-xs text-blue-600 hover:text-blue-800 underline mt-1 inline-block">
                            {item.linkText}
                          </a>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="font-medium text-sm text-blue-800">{item.title}</div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {item.linkedCategories.map((cat, catIndex) => (
                            <button
                              key={catIndex}
                              onClick={() => handleNavigateToSection(cat.section)}
                              className="text-xs text-blue-600 hover:text-blue-800 underline"
                            >
                              {cat.name}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                    <div className="text-xs text-gray-600 mt-1">Priority: {item.priority}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Engagement History */}
          <div className="mb-4">
            <h4 className="text-base font-medium mb-3 text-gray-800">Engagement History</h4>

            <div className="bg-gray-50 rounded overflow-hidden">
              <button
                onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
                className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center">
                  <ChevronDown 
                    size={16} 
                    className={`mr-2 text-gray-500 transition-transform ${isHistoryExpanded ? 'rotate-180' : ''}`}
                  />
                  <span className="font-medium text-gray-900 text-sm">View All Changes</span>
                </div>
                <span className="text-xs text-gray-500">{totalChanges} modifications</span>
              </button>

              {isHistoryExpanded && (
                <div className="px-3 pb-3 pt-0 border-t border-gray-200">
                  {engagementHistory.map((category, catIndex) => (
                    <div key={catIndex} className="mt-3">
                      <div className="flex items-center mb-2">
                        <span className="font-medium text-gray-800 text-sm">{category.category}</span>
                        <button
                          onClick={() => handleNavigateToSection(category.section)}
                          className="ml-2 text-blue-600 text-xs font-medium hover:underline"
                        >
                          Review &gt;
                        </button>
                      </div>
                      <ul className="space-y-1.5 ml-4">
                        {category.changes.map((change, changeIndex) => (
                          <li key={changeIndex} className="text-xs text-gray-600 flex items-start justify-between">
                            <div className="flex items-start flex-1">
                              <span className="text-gray-400 mr-2">•</span>
                              <span>{change.text}</span>
                            </div>
                            <span className="text-gray-400 ml-3 whitespace-nowrap">{change.date}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
