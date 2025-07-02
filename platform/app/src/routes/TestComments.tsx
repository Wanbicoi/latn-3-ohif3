import React, { useState } from 'react';
import { ProfessionalHeader } from '../../../ui-next/src/components/ProfessionalHeader';
import { TestSeriesComments } from '../../../ui-next/src/components/TestSeriesComments';
import { 
  Database, 
  TestTube, 
  Play, 
  ExternalLink, 
  CheckCircle, 
  AlertCircle,
  Clipboard,
  Eye,
  Settings2,
  Monitor
} from 'lucide-react';

const TestComments: React.FC = () => {
  const [activeTools, setActiveTools] = useState<string[]>(['segmentation']);
  const [selectedTest, setSelectedTest] = useState<string>('basic');

  const handleToolClick = (tool: string) => {
    setActiveTools(prev => 
      prev.includes(tool) 
        ? prev.filter(t => t !== tool)
        : [...prev, tool]
    );
  };

  const testScenarios = [
    {
      id: 'basic',
      name: 'Basic Test',
      description: 'Simple comment functionality test',
      taskId: '6514b2fe-0bb1-4e83-81c5-be624e3f3bed',
      seriesId: '1.2.840.113704.1.111.6904.1682663281.1',
      status: 'ready',
      icon: TestTube
    },
    {
      id: 'multiple',
      name: 'Multiple Series',
      description: 'Test with different series IDs',
      taskId: '7625c3ef-1cc2-5f94-92d6-cf735e4f4cfe', 
      seriesId: '1.3.950.124.815.7915.1693894362.2',
      status: 'ready',
      icon: Database
    },
    {
      id: 'ohif-integration',
      name: 'OHIF Integration',
      description: 'Full OHIF viewer integration test',
      taskId: '8736d4f0-2dd3-6005-a3e7-d0846f5f5d0f',
      seriesId: '1.4.061.235.916.8026.1704005473.3',
      status: 'experimental',
      icon: Monitor
    }
  ];

  const databaseQueries = [
    {
      name: 'View All Comments',
      query: `SELECT ac.*, u.full_name 
FROM _annotation_comments ac 
JOIN _users u ON ac.author_id = u.id 
ORDER BY ac.created_at DESC;`,
      description: 'See all comments in the system'
    },
    {
      name: 'Comments by Task',
      query: `SELECT * FROM _annotation_comments 
WHERE task_assignment_id = '6514b2fe-0bb1-4e83-81c5-be624e3f3bed';`,
      description: 'Filter comments by specific task'
    },
    {
      name: 'Series Comments',
      query: `SELECT * FROM _annotation_comments 
WHERE series_instance_uid = '1.2.840.113704.1.111.6904.1682663281.1';`,
      description: 'Filter by series instance UID'
    }
  ];

  const selectedScenario = testScenarios.find(t => t.id === selectedTest);
  const ohifUrl = selectedScenario 
    ? `http://localhost:3001/ohif3/monai-label?StudyInstanceUIDs=${selectedScenario.seriesId}&taskId=${selectedScenario.taskId}` 
    : '';

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-indigo-50/50">
      {/* Professional Header */}
      <ProfessionalHeader 
        title="Comments Testing Suite"
        subtitle="Series Comments Validation & Testing"
        onToolClick={handleToolClick}
        activeTools={activeTools}
      />

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Panel - Test Scenarios */}
          <div className="lg:col-span-1">
            <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-gray-200/50 overflow-hidden">
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                    <TestTube className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-white font-semibold text-lg">Test Scenarios</h2>
                    <p className="text-blue-100 text-sm">Select a test case to run</p>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-4">
                {testScenarios.map((scenario) => {
                  const Icon = scenario.icon;
                  const isSelected = selectedTest === scenario.id;
                  
                  return (
                    <button
                      key={scenario.id}
                      onClick={() => setSelectedTest(scenario.id)}
                      className={`
                        w-full text-left p-4 rounded-xl border-2 transition-all duration-200
                        ${isSelected 
                          ? 'border-blue-500 bg-blue-50 shadow-lg shadow-blue-500/10' 
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }
                      `}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`
                          w-10 h-10 rounded-lg flex items-center justify-center
                          ${isSelected ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'}
                        `}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className={`font-semibold ${isSelected ? 'text-blue-900' : 'text-gray-900'}`}>
                              {scenario.name}
                            </h3>
                            <span className={`
                              text-xs px-2 py-1 rounded-full font-medium
                              ${scenario.status === 'ready' 
                                ? 'bg-green-100 text-green-700' 
                                : 'bg-yellow-100 text-yellow-700'
                              }
                            `}>
                              {scenario.status}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">
                            {scenario.description}
                          </p>
                          <div className="text-xs text-gray-500 space-y-1">
                            <div className="truncate">Task: {scenario.taskId}</div>
                            <div className="truncate">Series: {scenario.seriesId}</div>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Database Queries */}
            <div className="mt-6 bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-gray-200/50 overflow-hidden">
              <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                    <Database className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold">Database Queries</h3>
                    <p className="text-emerald-100 text-sm">Debug & verification</p>
                  </div>
                </div>
              </div>

              <div className="p-4 space-y-3">
                {databaseQueries.map((query, index) => (
                  <div key={index} className="group">
                    <button 
                      onClick={() => navigator.clipboard.writeText(query.query)}
                      className="w-full text-left p-3 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Clipboard className="w-4 h-4 text-gray-500 group-hover:text-blue-500" />
                        <span className="font-medium text-gray-900 text-sm">{query.name}</span>
                      </div>
                      <p className="text-xs text-gray-600">{query.description}</p>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Panel - Test Results & OHIF Integration */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Test Status Card */}
            <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-gray-200/50 overflow-hidden">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-emerald-600 rounded-xl flex items-center justify-center">
                      <CheckCircle className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h2 className="text-gray-900 font-semibold text-lg">Test Status</h2>
                      <p className="text-gray-600 text-sm">Current test scenario: {selectedScenario?.name}</p>
                    </div>
                  </div>
                  
                  {/* OHIF Integration Button */}
                  <a
                    href={ohifUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all transform hover:scale-105 font-medium shadow-lg"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Open in OHIF
                  </a>
                </div>

                {/* Test Parameters */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Settings2 className="w-4 h-4 text-gray-600" />
                      <span className="font-medium text-gray-900">Task Assignment ID</span>
                    </div>
                    <code className="text-sm text-blue-600 bg-blue-50 px-2 py-1 rounded font-mono block truncate">
                      {selectedScenario?.taskId}
                    </code>
                  </div>
                  
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Eye className="w-4 h-4 text-gray-600" />
                      <span className="font-medium text-gray-900">Series Instance UID</span>
                    </div>
                    <code className="text-sm text-blue-600 bg-blue-50 px-2 py-1 rounded font-mono block truncate">
                      {selectedScenario?.seriesId}
                    </code>
                  </div>
                </div>

                {/* URL Example */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Play className="w-4 h-4 text-blue-600" />
                    <span className="font-medium text-blue-900">Test URL</span>
                  </div>
                  <code className="text-sm text-blue-700 break-all font-mono">
                    {ohifUrl}
                  </code>
                </div>
              </div>
            </div>

            {/* Live Test Component */}
            <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-gray-200/50 overflow-hidden">
              <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                    <TestTube className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold">Live Test Component</h3>
                    <p className="text-purple-100 text-sm">Interactive testing environment</p>
                  </div>
                </div>
              </div>

              <div className="p-6">
                {selectedScenario && (
                  <TestSeriesComments
                    taskAssignmentId={selectedScenario.taskId}
                    seriesInstanceUID={selectedScenario.seriesId}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestComments; 