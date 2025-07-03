import React, { useState } from 'react';
import MonaiLabelPanel from './MonaiLabelPanel';
import ManualSegmentationPanel from './ManualSegmentationPanel';

interface TabbedSegmentationPanelProps {
  commandsManager: any;
  servicesManager: any;
  extensionManager: any;
}

interface WarningDialogProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  targetTab: string;
}

const WarningDialog: React.FC<WarningDialogProps> = ({ isOpen, onConfirm, onCancel, targetTab }) => {
  if (!isOpen) return null;

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        animation: 'fadeIn 0.3s ease-in-out',
      }}
    >
      <div 
        style={{
          backgroundColor: '#1f2937',
          borderRadius: '20px',
          padding: '40px',
          maxWidth: '500px',
          width: '90%',
          boxShadow: '0 25px 50px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.1)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          animation: 'slideIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Background Gradient */}
        <div 
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '120px',
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(147, 51, 234, 0.1) 100%)',
            borderRadius: '20px 20px 0 0',
          }}
        />

        {/* Warning Icon */}
        <div style={{ textAlign: 'center', marginBottom: '28px', position: 'relative', zIndex: 1 }}>
          <div 
            style={{
              width: '80px',
              height: '80px',
              background: 'linear-gradient(135deg, #f59e0b 0%, #f97316 100%)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto',
              fontSize: '32px',
              boxShadow: '0 8px 32px rgba(245, 158, 11, 0.3)',
              animation: 'pulse 2s infinite',
            }}
          >
            ⚠️
          </div>
        </div>

        {/* Title */}
        <h2 
          style={{
            color: '#ffffff',
            fontSize: '24px',
            fontWeight: '700',
            textAlign: 'center',
            marginBottom: '8px',
            margin: 0,
            letterSpacing: '-0.02em',
          }}
        >
          Confirm Tab Switch
        </h2>

        {/* Subtitle */}
        <p 
          style={{
            color: '#9ca3af',
            fontSize: '14px',
            textAlign: 'center',
            marginBottom: '32px',
            margin: 0,
            fontWeight: '500',
          }}
        >
          This action will affect your current work
        </p>

        {/* Message Card */}
        <div 
          style={{
            backgroundColor: 'rgba(17, 24, 39, 0.8)',
            borderRadius: '16px',
            padding: '24px',
            marginBottom: '32px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
            <div 
              style={{
                width: '40px',
                height: '40px',
                backgroundColor: 'rgba(59, 130, 246, 0.2)',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: '16px',
                fontSize: '18px',
              }}
            >
              🔄
            </div>
            <div>
              <p 
                style={{
                  color: '#ffffff',
                  fontSize: '16px',
                  fontWeight: '600',
                  margin: 0,
                  marginBottom: '4px',
                }}
              >
                Switching to: <span style={{ color: '#60a5fa' }}>{targetTab}</span>
              </p>
              <p 
                style={{
                  color: '#6b7280',
                  fontSize: '13px',
                  margin: 0,
                }}
              >
                All current segmentation work will be lost
              </p>
            </div>
          </div>
          
          <div 
            style={{
              backgroundColor: 'rgba(220, 38, 38, 0.1)',
              border: '1px solid rgba(220, 38, 38, 0.2)',
              borderRadius: '12px',
              padding: '16px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <span style={{ fontSize: '16px', marginRight: '12px' }}>💾</span>
            <p 
              style={{
                color: '#fca5a5',
                fontSize: '14px',
                margin: 0,
                lineHeight: '1.4',
              }}
            >
              <strong>Warning:</strong> Any unsaved segments and labels will be permanently deleted and cannot be recovered.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div 
          style={{
            display: 'flex',
            gap: '16px',
            justifyContent: 'center',
          }}
        >
          <button
            onClick={onCancel}
            style={{
              backgroundColor: 'rgba(55, 65, 81, 0.8)',
              color: '#e5e7eb',
              border: '1px solid rgba(75, 85, 99, 0.5)',
              borderRadius: '12px',
              padding: '14px 28px',
              fontSize: '15px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              minWidth: '120px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(75, 85, 99, 0.8)';
              e.currentTarget.style.borderColor = 'rgba(107, 114, 128, 0.8)';
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 8px 25px rgba(0, 0, 0, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(55, 65, 81, 0.8)';
              e.currentTarget.style.borderColor = 'rgba(75, 85, 99, 0.5)';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <span>✖️</span>
            <span>Cancel</span>
          </button>
          <button
            onClick={onConfirm}
            style={{
              background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '12px',
              padding: '14px 28px',
              fontSize: '15px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              minWidth: '120px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 4px 20px rgba(220, 38, 38, 0.4)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, #b91c1c 0%, #991b1b 100%)';
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 8px 30px rgba(220, 38, 38, 0.6)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 20px rgba(220, 38, 38, 0.4)';
            }}
          >
            <span>🗑️</span>
            <span>Continue</span>
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideIn {
          from { 
            opacity: 0;
            transform: translateY(-30px) scale(0.9);
          }
          to { 
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
      `}</style>
    </div>
  );
};

export default function TabbedSegmentationPanel({
  commandsManager,
  servicesManager,
  extensionManager,
}: TabbedSegmentationPanelProps) {
  const [activeTab, setActiveTab] = useState<'manual' | 'monai'>('manual');
  const [showWarning, setShowWarning] = useState(false);
  const [pendingTab, setPendingTab] = useState<'manual' | 'monai' | null>(null);

  const tabs = [
    { id: 'manual', label: 'Manual Label', icon: '✋' },
    { id: 'monai', label: 'MONAI Label', icon: '🤖' },
  ];

  const clearCurrentSegmentations = () => {
    try {
      const { segmentationService } = servicesManager.services;
      const segmentations = segmentationService.getSegmentations();
      segmentations.forEach(seg => {
        try {
          segmentationService.remove(seg.segmentationId);
        } catch (error) {
          console.warn('Failed to remove segmentation:', error);
        }
      });
    } catch (error) {
      console.warn('Failed to clear segmentations:', error);
    }
  };

  const handleTabSwitch = (tabId: 'manual' | 'monai') => {
    if (tabId === activeTab) return;
    
    // Check if there are any existing segmentations
    const { segmentationService } = servicesManager.services;
    const existingSegmentations = segmentationService.getSegmentations();
    
    if (existingSegmentations.length > 0) {
      // Show professional warning dialog
      setPendingTab(tabId);
      setShowWarning(true);
    } else {
      // No existing segmentations, switch directly
      setActiveTab(tabId);
    }
  };

  const handleConfirmSwitch = () => {
    if (pendingTab) {
      clearCurrentSegmentations();
      setActiveTab(pendingTab);
    }
    setShowWarning(false);
    setPendingTab(null);
  };

  const handleCancelSwitch = () => {
    setShowWarning(false);
    setPendingTab(null);
  };

  const getTabDisplayName = (tabId: 'manual' | 'monai') => {
    return tabId === 'manual' ? 'Manual Label' : 'MONAI Label';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#1a1a1a' }}>
      {/* Warning Dialog */}
      <WarningDialog
        isOpen={showWarning}
        onConfirm={handleConfirmSwitch}
        onCancel={handleCancelSwitch}
        targetTab={pendingTab ? getTabDisplayName(pendingTab) : ''}
      />

      {/* Tab Header */}
      <div style={{ display: 'flex', borderBottom: '1px solid #333', backgroundColor: '#2a2a2a' }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabSwitch(tab.id as 'manual' | 'monai')}
            style={{
              flex: 1,
              padding: '12px 16px',
              fontSize: '14px',
              fontWeight: '500',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              backgroundColor: activeTab === tab.id ? '#3b82f6' : 'transparent',
              color: activeTab === tab.id ? 'white' : '#9ca3af',
              borderBottom: activeTab === tab.id ? '2px solid #60a5fa' : 'none',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              if (activeTab !== tab.id) {
                e.currentTarget.style.backgroundColor = '#374151';
                e.currentTarget.style.color = 'white';
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== tab.id) {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = '#9ca3af';
              }
            }}
          >
            <span style={{ fontSize: '18px' }}>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {activeTab === 'manual' && (
          <ManualSegmentationPanel
            commandsManager={commandsManager}
            servicesManager={servicesManager}
            extensionManager={extensionManager}
          />
        )}
        {activeTab === 'monai' && (
          <MonaiLabelPanel
            commandsManager={commandsManager}
            servicesManager={servicesManager}
            extensionManager={extensionManager}
          />
        )}
      </div>
    </div>
  );
} 