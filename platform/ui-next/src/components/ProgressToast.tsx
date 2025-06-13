import React from 'react';

interface ProgressToastProps {
  progress: number;
  message: string;
  isVisible: boolean;
}

export const ProgressToast: React.FC<ProgressToastProps> = ({ progress, message, isVisible }) => {
  if (!isVisible) return null;

  return (
    <div className="fixed top-4 right-4 z-50 bg-gray-900/95 backdrop-blur-sm border border-gray-600 rounded-lg shadow-2xl p-4 min-w-[300px]">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
        <div className="flex-1">
          <div className="text-white font-semibold text-sm mb-2">{message}</div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div 
              className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="text-gray-300 text-xs mt-1">{progress}% complete</div>
        </div>
      </div>
    </div>
  );
}; 