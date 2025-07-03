import React from 'react';
import TabbedSegmentationPanel from './components/TabbedSegmentationPanel';

function getPanelModule({
  commandsManager,
  extensionManager,
  servicesManager,
}) {
  const WrappedTabbedSegmentationPanel = () => {
    return (
      <TabbedSegmentationPanel
        commandsManager={commandsManager}
        servicesManager={servicesManager}
        extensionManager={extensionManager}
      />
    );
  };

  return [
    {
      name: 'tabbed-segmentation',
      iconName: 'tab-segmentation',
      iconLabel: 'Segmentation',
      label: 'Segmentation',
      secondaryLabel: 'Manual & AI Segmentation',
      component: WrappedTabbedSegmentationPanel,
    },
  ];
}

export default getPanelModule;
