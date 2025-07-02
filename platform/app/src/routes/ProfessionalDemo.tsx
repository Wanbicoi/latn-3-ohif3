import React, { useState } from 'react';
import { ProfessionalHeader } from '../../../ui-next/src/components/ProfessionalHeader';
import { FloatingSegmentationComments } from '../../../ui-next/src/components/SegmentationTable/FloatingSegmentationComments';
import { 
  Activity, 
  Layers, 
  Brain, 
  Download, 
  Share2,
  Star,
  Zap,
  CheckCircle,
  Users,
  BarChart3,
  Globe,
  Shield
} from 'lucide-react';

const ProfessionalDemo: React.FC = () => {
  const [activeTools, setActiveTools] = useState<string[]>(['segmentation', 'ai-assist']);
  const [selectedView, setSelectedView] = useState<string>('overview');

  const handleToolClick = (tool: string) => {
    setActiveTools(prev => 
      prev.includes(tool) 
        ? prev.filter(t => t !== tool)
        : [...prev, tool]
    );
  };

  const features = [
    {
      icon: Star,
      title: 'Advanced UI Design',
      description: 'Modern, professional interface with beautiful gradients and glass morphism effects',
      status: 'completed'
    },
    {
      icon: Shield,
      title: 'User Authentication',
      description: 'Complete user account management with role-based access control',
      status: 'completed'
    },
    {
      icon: Brain,
      title: 'AI-Powered Tools',
      description: 'Integrated AI assistance for medical image analysis and annotation',
      status: 'active'
    },
    {
      icon: Layers,
      title: 'Advanced Segmentation',
      description: 'Professional segmentation tools with real-time collaboration',
      status: 'active'
    },
    {
      icon: Users,
      title: 'Team Collaboration',
      description: 'Real-time comments and annotations sharing across medical teams',
      status: 'completed'
    },
    {
      icon: BarChart3,
      title: 'Analytics Dashboard',
      description: 'Comprehensive insights and performance metrics for medical workflows',
      status: 'upcoming'
    }
  ];

  const stats = [
    { label: 'Active Users', value: '1,234', change: '+12%', icon: Users },
    { label: 'Annotations', value: '45,678', change: '+23%', icon: Layers },
    { label: 'AI Accuracy', value: '94.2%', change: '+2.1%', icon: Brain },
    { label: 'Processing Speed', value: '2.3s', change: '-15%', icon: Zap }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-indigo-50/50">
      {/* Professional Header */}
      <ProfessionalHeader 
        title="Medical Annotation System"
        subtitle="AI-Powered Medical Image Analysis Platform"
        onToolClick={handleToolClick}
        activeTools={activeTools}
      />

      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-indigo-600/10"></div>
        <div className="relative max-w-7xl mx-auto px-6 py-16">
          <div className="text-center">
            <h1 className="text-5xl font-bold text-gray-900 mb-6 leading-tight">
              Next-Generation
              <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent"> Medical AI</span>
            </h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8 leading-relaxed">
              Revolutionizing medical image analysis with advanced AI, collaborative tools, and professional workflows 
              designed for healthcare professionals.
            </p>
            <div className="flex items-center justify-center gap-4 flex-wrap">
              <button className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all transform hover:scale-105 font-semibold shadow-lg shadow-blue-500/25">
                Start Analyzing
              </button>
              <button className="px-8 py-3 bg-white/80 backdrop-blur-sm text-gray-700 rounded-lg hover:bg-white transition-all border border-gray-200 font-semibold">
                View Documentation
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <div key={index} className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 shadow-xl border border-gray-200/50">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-indigo-600 rounded-xl flex items-center justify-center">
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <span className={`text-sm font-semibold px-2 py-1 rounded-full ${
                    stat.change.startsWith('+') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {stat.change}
                  </span>
                </div>
                <div className="text-3xl font-bold text-gray-900 mb-1">{stat.value}</div>
                <div className="text-gray-600 text-sm">{stat.label}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Features Section */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Platform Features</h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Comprehensive suite of tools designed for medical professionals, researchers, and AI specialists
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div key={index} className="group">
                <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 shadow-xl border border-gray-200/50 hover:shadow-2xl transition-all duration-300 hover:scale-105">
                  <div className="flex items-center gap-4 mb-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      feature.status === 'completed' ? 'bg-gradient-to-br from-green-400 to-emerald-600' :
                      feature.status === 'active' ? 'bg-gradient-to-br from-blue-400 to-indigo-600' :
                      'bg-gradient-to-br from-gray-400 to-gray-600'
                    }`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
                      feature.status === 'completed' ? 'bg-green-100 text-green-700' :
                      feature.status === 'active' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {feature.status}
                    </span>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">{feature.title}</h3>
                  <p className="text-gray-600 leading-relaxed">{feature.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Interactive Demo Section */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200/50 overflow-hidden">
          <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-8">
            <div className="text-center">
              <h2 className="text-3xl font-bold text-white mb-4">Interactive Demo</h2>
              <p className="text-purple-100 max-w-2xl mx-auto">
                Experience the new professional interface with live commenting system and real-time collaboration
              </p>
            </div>
          </div>

          <div className="p-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Demo Controls */}
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Demo Controls</h3>
                  <div className="space-y-3">
                    <button
                      onClick={() => setSelectedView('overview')}
                      className={`w-full text-left p-4 rounded-lg transition-all ${
                        selectedView === 'overview' 
                          ? 'bg-blue-50 border-2 border-blue-500 text-blue-900' 
                          : 'bg-gray-50 border-2 border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Globe className="w-5 h-5" />
                        <div>
                          <div className="font-semibold">System Overview</div>
                          <div className="text-sm text-gray-600">View overall system capabilities</div>
                        </div>
                      </div>
                    </button>

                    <button
                      onClick={() => setSelectedView('comments')}
                      className={`w-full text-left p-4 rounded-lg transition-all ${
                        selectedView === 'comments' 
                          ? 'bg-blue-50 border-2 border-blue-500 text-blue-900' 
                          : 'bg-gray-50 border-2 border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Users className="w-5 h-5" />
                        <div>
                          <div className="font-semibold">Live Comments Demo</div>
                          <div className="text-sm text-gray-600">Test real-time commenting system</div>
                        </div>
                      </div>
                    </button>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-200">
                  <div className="flex items-center gap-3 mb-4">
                    <CheckCircle className="w-6 h-6 text-blue-600" />
                    <h4 className="font-semibold text-blue-900">Ready for Production</h4>
                  </div>
                  <ul className="space-y-2 text-sm text-blue-800">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      Professional UI Components
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      User Authentication System
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      Real-time Collaboration
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      Database Integration
                    </li>
                  </ul>
                </div>
              </div>

              {/* Demo Content */}
              <div className="bg-gray-50 rounded-xl p-6 min-h-96">
                {selectedView === 'overview' && (
                  <div className="text-center py-12">
                    <div className="w-20 h-20 bg-gradient-to-br from-blue-400 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6">
                      <Star className="w-10 h-10 text-white" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-4">System Overview</h3>
                    <p className="text-gray-600 mb-6 max-w-md mx-auto">
                      The new Medical Annotation System combines powerful AI tools with intuitive user interface 
                      for enhanced medical image analysis workflows.
                    </p>
                    <div className="grid grid-cols-2 gap-4 text-center">
                      <div className="bg-white rounded-lg p-4">
                        <div className="text-2xl font-bold text-blue-600">99.5%</div>
                        <div className="text-sm text-gray-600">Uptime</div>
                      </div>
                      <div className="bg-white rounded-lg p-4">
                        <div className="text-2xl font-bold text-green-600">2.1s</div>
                        <div className="text-sm text-gray-600">Avg Response</div>
                      </div>
                    </div>
                  </div>
                )}

                {selectedView === 'comments' && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Live Comments System</h3>
                    <div className="bg-white rounded-lg p-4 mb-4">
                      <p className="text-gray-600 text-sm mb-3">
                        The floating comments panel will appear when you have valid task and series parameters in the URL.
                      </p>
                      <div className="text-xs text-gray-500 bg-gray-50 rounded p-3 font-mono">
                        URL Format: ?taskId=6514b2fe-0bb1-4e83-81c5-be624e3f3bed&StudyInstanceUIDs=1.2.840.113704.1.111.6904.1682663281.1
                      </div>
                    </div>
                    
                    <div className="text-center py-8">
                      <div className="w-16 h-16 bg-gradient-to-br from-purple-400 to-pink-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Users className="w-8 h-8 text-white" />
                      </div>
                      <p className="text-gray-600">
                        Visit the <strong>TestComments</strong> page to see the live commenting system in action!
                      </p>
                      <a 
                        href="/test-comments" 
                        className="inline-block mt-4 px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all font-medium"
                      >
                        Go to Test Comments
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Comments Component (will only show if URL has proper parameters) */}
      <FloatingSegmentationComments
        activeSegmentId={1}
        segmentation={null}
        representation={null}
        servicesManager={null}
      />
    </div>
  );
};

export default ProfessionalDemo; 