import React from 'react';
import { Icons, Button } from '../../components';
import { useSegmentationTableContext } from './SegmentationTableContext';

export const SegmentationSelectorHeader = () => {
  const { data, activeSegmentationId, mode, storeSegmentation } = useSegmentationTableContext(
    'SegmentationTable.HeaderCollapsed'
  );

  if (mode !== 'collapsed' || !data?.length) {
    return null;
  }

  const activeSegmentationObj = data.find(
    seg => seg.segmentation.segmentationId === activeSegmentationId
  );

  const activeSegmentation = {
    id: activeSegmentationObj?.segmentation.segmentationId,
    label: activeSegmentationObj?.segmentation.label,
    info: activeSegmentationObj?.segmentation.cachedStats?.info,
  };

  return (
    <div className="bg-primary-dark flex h-10 w-full items-center space-x-1 rounded-t px-1.5">
      <Button
        onClick={() => storeSegmentation(activeSegmentation.id)}
        variant="default"
        size="default"
        className="flex-auto"
      >
        <Icons.Download className="text-foreground" />
        <span className="pl-2">Save</span>
      </Button>
    </div>
  );
};
