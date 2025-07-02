import React from 'react';
import { UserAccountHeader } from '../UserAccountHeader/UserAccountHeader';
import { 
  Activity, 
  Layers, 
  Settings, 
  Download, 
  Share2, 
  HelpCircle,
  Zap,
  Brain,
  Stethoscope
} from 'lucide-react';

interface ProfessionalHeaderProps {
  title?: string;
  subtitle?: string;
  onToolClick?: (tool: string) => void;
  activeTools?: string[];
}

export const ProfessionalHeader: React.FC<ProfessionalHeaderProps> = ({
  title = "Medical Annotation System",
  subtitle = "AI-Powered Medical Image Analysis",
  onToolClick = () => {},
  activeTools = []
}) => {

  const tools = [
    { id: 'segmentation', icon: Layers, label: 'Segmentation', tooltip: 'AI Segmentation Tools' },
    { id: 'measurement', icon: Activity, label: 'Measure', tooltip: 'Measurement Tools' },
    { id: 'ai-assist', icon: Brain, label: 'AI Assist', tooltip: 'AI-Powered Analysis' },
    { id: 'export', icon: Download, label: 'Export', tooltip: 'Export Results' },
    { id: 'share', icon: Share2, label: 'Share', tooltip: 'Share Analysis' },
  ];

  return (
    <header className="bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-900 border-b border-gray-200/20 shadow-lg backdrop-blur-sm">
      <div className="max-w-full mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Left Side - Brand & Title */}
          <div className="flex items-center gap-4">
            {/* Logo/Brand */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                <Stethoscope className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white leading-tight">
                  {title}
                </h1>
                <p className="text-blue-200 text-sm">
                  {subtitle}
                </p>
              </div>
            </div>

            {/* Divider */}
            <div className="h-8 w-px bg-white/20 hidden lg:block"></div>

            {/* OHIF Tools */}
            <div className="hidden lg:flex items-center gap-2">
              {tools.map((tool) => {
                const isActive = activeTools.includes(tool.id);
                const Icon = tool.icon;
                
                return (
                  <button
                    key={tool.id}
                    onClick={() => onToolClick(tool.id)}
                    title={tool.tooltip}
                    className={`
                      flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 
                      ${isActive 
                        ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/25' 
                        : 'bg-white/10 text-white/80 hover:bg-white/20 hover:text-white'
                      }
                      backdrop-blur-sm border border-white/10
                    `}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-sm font-medium hidden xl:block">
                      {tool.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Side - User Account & Settings */}
          <div className="flex items-center gap-4">
            {/* Quick Actions */}
            <div className="hidden md:flex items-center gap-2">
              <button 
                className="p-2 hover:bg-white/10 rounded-lg text-white/70 hover:text-white transition-colors border border-white/10"
                title="AI Performance Metrics"
              >
                <Zap className="w-4 h-4" />
              </button>
              <button 
                className="p-2 hover:bg-white/10 rounded-lg text-white/70 hover:text-white transition-colors border border-white/10"
                title="Settings"
              >
                <Settings className="w-4 h-4" />
              </button>
              <button 
                className="p-2 hover:bg-white/10 rounded-lg text-white/70 hover:text-white transition-colors border border-white/10"
                title="Help & Documentation"
              >
                <HelpCircle className="w-4 h-4" />
              </button>
            </div>

            {/* Divider */}
            <div className="h-8 w-px bg-white/20 hidden md:block"></div>

            {/* User Account */}
            <UserAccountHeader />
          </div>
        </div>

        {/* Mobile Tools Menu */}
        <div className="lg:hidden mt-4 pt-4 border-t border-white/10">
          <div className="flex items-center gap-2 overflow-x-auto">
            {tools.map((tool) => {
              const isActive = activeTools.includes(tool.id);
              const Icon = tool.icon;
              
              return (
                <button
                  key={tool.id}
                  onClick={() => onToolClick(tool.id)}
                  title={tool.tooltip}
                  className={`
                    flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 whitespace-nowrap
                    ${isActive 
                      ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/25' 
                      : 'bg-white/10 text-white/80 hover:bg-white/20 hover:text-white'
                    }
                    backdrop-blur-sm border border-white/10
                  `}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-sm font-medium">
                    {tool.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </header>
  );
}; 