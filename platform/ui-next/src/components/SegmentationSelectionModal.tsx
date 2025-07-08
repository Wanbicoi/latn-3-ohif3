import React from 'react';
import { Button } from './Button';

interface SegmentationSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  currentSelection: string;
  newSelection: string;
}

export const SegmentationSelectionModal: React.FC<SegmentationSelectionModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  currentSelection,
  newSelection,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-slate-900 rounded-2xl shadow-2xl border border-slate-700 max-w-md mx-4 w-full transform transition-all duration-300 scale-100">
        {/* Header */}
        <div className="text-center p-6 pb-4">
          <div className="flex items-center justify-center mb-4">
            <div className="bg-amber-100 dark:bg-amber-900/30 rounded-full p-3">
              <svg 
                className="w-6 h-6 text-amber-600 dark:text-amber-500" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" 
                />
              </svg>
            </div>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">
            Clinical Validation Selection
          </h2>
          <p className="text-slate-300 text-sm">
            Only one segmentation can be selected for clinical validation at a time
          </p>
        </div>

        {/* Content */}
        <div className="px-6 pb-2">
          <div className="space-y-4">
            {/* Current Selection */}
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-600">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-green-500 rounded-full flex-shrink-0"></div>
                <div>
                  <div className="text-sm text-slate-400 mb-1">Currently Selected</div>
                  <div className="text-white font-medium">{currentSelection}</div>
                </div>
              </div>
            </div>

            {/* Arrow */}
            <div className="flex justify-center">
              <svg 
                className="w-6 h-6 text-slate-500" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M19 14l-7 7m0 0l-7-7m7 7V3" 
                />
              </svg>
            </div>

            {/* New Selection */}
            <div className="bg-slate-800 rounded-lg p-4 border border-blue-500 border-dashed">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-blue-500 rounded-full flex-shrink-0"></div>
                <div>
                  <div className="text-sm text-slate-400 mb-1">Switch To</div>
                  <div className="text-white font-medium">{newSelection}</div>
                </div>
              </div>
            </div>

            {/* Question */}
            <div className="text-center py-3">
              <p className="text-slate-200 font-medium">
                Do you want to switch your clinical validation selection?
              </p>
              <p className="text-sm text-slate-400 mt-1">
                This action will update which segmentation is used for task approval
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 p-6 pt-4 border-t border-slate-700">
          <Button
            variant="ghost"
            onClick={onClose}
            className="flex-1 border border-slate-600 hover:bg-slate-800 text-slate-300 hover:text-white"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Keep Current
          </Button>
          <Button
            onClick={onConfirm}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Switch Selection
          </Button>
        </div>
      </div>
    </div>
  );
}; 