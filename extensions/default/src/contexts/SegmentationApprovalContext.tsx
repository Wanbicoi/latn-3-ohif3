import React, { createContext, useContext, useState, ReactNode } from 'react';

interface SelectedSegmentation {
  segmentationId: string;
  seriesInstanceUID: string;
  label: string;
  timestamp: number;
}

interface SegmentationApprovalContextType {
  selectedSegmentation: SelectedSegmentation | null;
  setSelectedSegmentation: (segmentation: SelectedSegmentation | null) => void;
  isHighlighted: (segmentationId: string) => boolean;
}

const SegmentationApprovalContext = createContext<SegmentationApprovalContextType | undefined>(undefined);

export const SegmentationApprovalProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [selectedSegmentation, setSelectedSegmentation] = useState<SelectedSegmentation | null>(null);

  const isHighlighted = (segmentationId: string): boolean => {
    return selectedSegmentation?.segmentationId === segmentationId;
  };

  return (
    <SegmentationApprovalContext.Provider 
      value={{ 
        selectedSegmentation, 
        setSelectedSegmentation, 
        isHighlighted 
      }}
    >
      {children}
    </SegmentationApprovalContext.Provider>
  );
};

export const useSegmentationApproval = (): SegmentationApprovalContextType => {
  const context = useContext(SegmentationApprovalContext);
  if (context === undefined) {
    throw new Error('useSegmentationApproval must be used within a SegmentationApprovalProvider');
  }
  return context;
}; 