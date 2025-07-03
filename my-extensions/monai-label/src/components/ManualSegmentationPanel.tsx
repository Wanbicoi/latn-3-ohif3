import React, { useEffect } from 'react';
import { Toolbox } from '@ohif/ui-next';
import PanelSegmentation from '../../../../extensions/cornerstone/src/panels/PanelSegmentation';

interface ManualSegmentationPanelProps {
  commandsManager: any;
  servicesManager: any;
  extensionManager: any;
}

export default function ManualSegmentationPanel({
  commandsManager,
  servicesManager,
  extensionManager,
}: ManualSegmentationPanelProps) {
  const { segmentationService, viewportGridService } = servicesManager.services;

  useEffect(() => {
    const initializeSegmentation = async () => {
      try {
        // Get the active viewport
        const { activeViewportId } = viewportGridService.getState();
        if (!activeViewportId) {
          console.warn('No active viewport available for manual segmentation');
          return;
        }

        // Check if we already have a manual segmentation
        const existingSegmentations = segmentationService.getSegmentations();
        const manualSegmentation = existingSegmentations.find(
          seg => seg.segmentationId === 'manual-segmentation'
        );

        if (!manualSegmentation) {
          // Create a new segmentation for manual labeling
          const segmentationId = await commandsManager.run('createLabelmapForViewport', {
            viewportId: activeViewportId,
            options: {
              segmentationId: 'manual-segmentation',
              label: 'Manual Segmentation',
              createInitialSegment: false,
            },
          });

          console.log('Created manual segmentation:', segmentationId);
        }
      } catch (error) {
        console.error('Failed to initialize manual segmentation:', error);
      }
    };

    initializeSegmentation();
  }, [commandsManager, segmentationService, viewportGridService]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#1a1a1a' }}>
      {/* Segmentation Tools */}
      <div style={{ borderBottom: '1px solid #333', backgroundColor: '#2a2a2a', padding: '16px' }}>
        <h3 style={{ color: 'white', fontSize: '14px', marginBottom: '12px' }}>
          🛠️ Manual Segmentation Tools
        </h3>
        <Toolbox
          commandsManager={commandsManager}
          servicesManager={servicesManager}
          extensionManager={extensionManager}
          buttonSectionId="segmentationToolbox"
          title=""
          configuration={{}}
        />
      </div>

      {/* Segmentation Management Panel */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
        <h3 style={{ color: 'white', fontSize: '14px', marginBottom: '12px' }}>
          📋 Segment Management
        </h3>
        <PanelSegmentation
          commandsManager={commandsManager}
          servicesManager={servicesManager}
          extensionManager={extensionManager}
          configuration={{
            showAddSegment: true,
            disableExport: false,
          }}
        />
      </div>

      {/* Instructions */}
      <div style={{ borderTop: '1px solid #333', backgroundColor: '#2a2a2a', padding: '16px' }}>
        <div style={{ fontSize: '12px', color: '#888' }}>
          <p style={{ marginBottom: '8px' }}>
            <strong style={{ color: 'white' }}>Instructions:</strong>
          </p>
          <ul style={{ listStyle: 'disc', paddingLeft: '20px' }}>
            <li>Use segmentation tools above to draw on images</li>
            <li>Add new segments using the "+" button</li>
            <li>Click segment names to jump to their center</li>
            <li>Edit colors and labels by clicking on them</li>
          </ul>
        </div>
      </div>
    </div>
  );
} 