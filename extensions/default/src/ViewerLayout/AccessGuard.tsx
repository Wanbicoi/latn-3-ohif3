import React, { useState, useEffect } from 'react';
import { supabaseClient } from '../../../../platform/ui-next/src/lib/utils';

interface AccessGuardProps {
  children: React.ReactNode;
}

interface AccessDeniedModalProps {
  isOpen: boolean;
  onRetry: () => void;
  missingConditions: string[];
}

const AccessDeniedModal: React.FC<AccessDeniedModalProps> = ({ isOpen, onRetry, missingConditions }) => {
  if (!isOpen) return null;

  const handleGoToDashboard = () => {
    window.location.href = 'http://localhost:3000';
  };

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.95)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        animation: 'fadeIn 0.5s ease-in-out',
      }}
    >
      <div 
        style={{
          backgroundColor: '#1f2937',
          borderRadius: '24px',
          padding: '48px',
          maxWidth: '600px',
          width: '90%',
          boxShadow: '0 30px 60px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.1)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          animation: 'slideIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
          position: 'relative',
          overflow: 'hidden',
          textAlign: 'center',
        }}
      >
        {/* Medical Background Pattern */}
        <div 
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '150px',
            background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(185, 28, 28, 0.1) 100%)',
            borderRadius: '24px 24px 0 0',
          }}
        />

        {/* Medical Cross Pattern */}
        <div 
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            width: '60px',
            height: '60px',
            opacity: 0.1,
            background: 'repeating-linear-gradient(45deg, rgba(239, 68, 68, 0.3) 0px, rgba(239, 68, 68, 0.3) 2px, transparent 2px, transparent 8px)',
          }}
        />

        {/* Error Icon */}
        <div style={{ position: 'relative', zIndex: 1, marginBottom: '32px' }}>
          <div 
            style={{
              width: '100px',
              height: '100px',
              background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto',
              fontSize: '40px',
              boxShadow: '0 12px 40px rgba(239, 68, 68, 0.4)',
              animation: 'pulse 2s infinite',
              border: '4px solid rgba(255, 255, 255, 0.2)',
            }}
          >
            🚫
          </div>
        </div>

        {/* Title */}
        <h1 
          style={{
            color: '#ffffff',
            fontSize: '28px',
            fontWeight: '700',
            marginBottom: '12px',
            letterSpacing: '-0.02em',
          }}
        >
          Access Denied
        </h1>

        {/* Subtitle */}
        <p 
          style={{
            color: '#9ca3af',
            fontSize: '16px',
            marginBottom: '32px',
            fontWeight: '500',
          }}
        >
          Medical Imaging System - Unauthorized Access
        </p>

        {/* Error Details Card */}
        <div 
          style={{
            backgroundColor: 'rgba(17, 24, 39, 0.8)',
            borderRadius: '20px',
            padding: '32px',
            marginBottom: '32px',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            textAlign: 'left',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
            <div 
              style={{
                width: '48px',
                height: '48px',
                backgroundColor: 'rgba(239, 68, 68, 0.2)',
                borderRadius: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: '16px',
                fontSize: '20px',
              }}
            >
              🏥
            </div>
            <div>
              <h3 
                style={{
                  color: '#ffffff',
                  fontSize: '18px',
                  fontWeight: '600',
                  margin: 0,
                  marginBottom: '4px',
                }}
              >
                Missing Required Credentials
              </h3>
              <p 
                style={{
                  color: '#6b7280',
                  fontSize: '14px',
                  margin: 0,
                }}
              >
                Medical system access requires valid authentication
              </p>
            </div>
          </div>
          
          <div 
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '16px',
              padding: '20px',
              marginBottom: '20px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
              <span style={{ fontSize: '18px', marginRight: '12px' }}>⚕️</span>
              <h4 
                style={{
                  color: '#fca5a5',
                  fontSize: '16px',
                  fontWeight: '600',
                  margin: 0,
                }}
              >
                Required for Medical Imaging Access:
              </h4>
            </div>
            <ul style={{ margin: 0, paddingLeft: '20px', color: '#fca5a5', fontSize: '14px', lineHeight: '1.6' }}>
              {missingConditions.map((condition, index) => (
                <li key={index} style={{ marginBottom: '8px' }}>
                  <strong>{condition}</strong> - Missing or Invalid
                </li>
              ))}
            </ul>
          </div>

          <div 
            style={{
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              borderRadius: '12px',
              padding: '16px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <span style={{ fontSize: '16px', marginRight: '12px' }}>💡</span>
            <p 
              style={{
                color: '#93c5fd',
                fontSize: '13px',
                margin: 0,
                lineHeight: '1.4',
              }}
            >
              <strong>Solution:</strong> Please ensure you have a valid task assignment and are properly authenticated before accessing medical imaging data.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div 
          style={{
            display: 'flex',
            gap: '16px',
            justifyContent: 'center',
            flexWrap: 'wrap',
          }}
        >
          <button
            onClick={onRetry}
            style={{
              backgroundColor: 'rgba(59, 130, 246, 0.8)',
              color: '#ffffff',
              border: '1px solid rgba(59, 130, 246, 0.5)',
              borderRadius: '12px',
              padding: '16px 32px',
              fontSize: '15px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              minWidth: '140px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 1)';
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 8px 25px rgba(59, 130, 246, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.8)';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <span>🔄</span>
            <span>Retry Access</span>
          </button>
          <button
            onClick={handleGoToDashboard}
            style={{
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '12px',
              padding: '16px 32px',
              fontSize: '15px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              minWidth: '140px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 4px 20px rgba(16, 185, 129, 0.4)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, #059669 0%, #047857 100%)';
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 8px 30px rgba(16, 185, 129, 0.6)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 20px rgba(16, 185, 129, 0.4)';
            }}
          >
            <span>🏠</span>
            <span>Go to Dashboard</span>
          </button>
        </div>

        {/* Footer */}
        <div 
          style={{
            marginTop: '32px',
            paddingTop: '24px',
            borderTop: '1px solid rgba(55, 65, 81, 0.5)',
            color: '#6b7280',
            fontSize: '12px',
            textAlign: 'center',
          }}
        >
          <p style={{ margin: 0, marginBottom: '8px' }}>
            🔒 <strong>Secure Medical Environment</strong>
          </p>
          <p style={{ margin: 0 }}>
            All access is monitored for compliance and security
          </p>
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
            transform: translateY(-40px) scale(0.9);
          }
          to { 
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); box-shadow: 0 12px 40px rgba(239, 68, 68, 0.4); }
          50% { transform: scale(1.05); box-shadow: 0 16px 50px rgba(239, 68, 68, 0.6); }
        }
      `}</style>
    </div>
  );
};

const AccessGuard: React.FC<AccessGuardProps> = ({ children }) => {
  const [accessStatus, setAccessStatus] = useState<'checking' | 'granted' | 'denied'>('checking');
  const [missingConditions, setMissingConditions] = useState<string[]>([]);
  const [retryCount, setRetryCount] = useState(0);

  const checkAccess = async () => {
    setAccessStatus('checking');
    
    try {
      // Get URL parameters
      const urlParams = new URLSearchParams(window.location.search);
      const taskAssignmentId = urlParams.get('taskId');
      
      // Get user authentication
      const { data: userData, error: authError } = await supabaseClient.auth.getUser();
      const userId = userData?.user?.id;
      
      // Check conditions
      const missing: string[] = [];
      
      if (!taskAssignmentId) {
        missing.push('Task Assignment ID');
      }
      
      if (authError || !userId) {
        missing.push('User Authentication');
      }
      
      if (missing.length > 0) {
        setMissingConditions(missing);
        setAccessStatus('denied');
        console.warn('🚫 Access denied - Missing conditions:', missing);
        return;
      }
      
      // Additional validation: Check if task assignment exists
      if (taskAssignmentId && userId) {
        const { data: taskData, error: taskError } = await supabaseClient
          .from('_task_assignments')
          .select('id, task_id')
          .eq('id', taskAssignmentId)
          .single();
        
        if (taskError || !taskData) {
          setMissingConditions(['Valid Task Assignment']);
          setAccessStatus('denied');
          console.warn('🚫 Access denied - Invalid task assignment:', taskAssignmentId);
          return;
        }
      }
      
      // All checks passed
      setAccessStatus('granted');
      console.log('✅ Access granted - All conditions met');
      
    } catch (error) {
      console.error('❌ Error checking access:', error);
      setMissingConditions(['System Authentication Error']);
      setAccessStatus('denied');
    }
  };

  useEffect(() => {
    checkAccess();
  }, [retryCount]);

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
  };

  // Loading state
  if (accessStatus === 'checking') {
    return (
      <div 
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: '#0f172a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div 
            style={{
              width: '80px',
              height: '80px',
              background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 24px',
              fontSize: '32px',
              animation: 'pulse 1.5s infinite',
              boxShadow: '0 8px 32px rgba(59, 130, 246, 0.3)',
            }}
          >
            🏥
          </div>
          <h2 style={{ color: '#ffffff', fontSize: '24px', fontWeight: '600', marginBottom: '12px' }}>
            Verifying Medical Access
          </h2>
          <p style={{ color: '#9ca3af', fontSize: '16px', margin: 0 }}>
            Checking credentials and permissions...
          </p>
        </div>
      </div>
    );
  }

  // Access denied
  if (accessStatus === 'denied') {
    return (
      <AccessDeniedModal
        isOpen={true}
        onRetry={handleRetry}
        missingConditions={missingConditions}
      />
    );
  }

  // Access granted - render children
  return <>{children}</>;
};

export default AccessGuard; 