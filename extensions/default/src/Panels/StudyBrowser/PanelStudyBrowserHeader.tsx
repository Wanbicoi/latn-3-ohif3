import React from 'react';
import { ToggleGroup, ToggleGroupItem } from '@ohif/ui-next';
import { Icons } from '@ohif/ui-next';
import { actionIcon, viewPreset } from './types';

function PanelStudyBrowserHeader({
  viewPresets,
  updateViewPresetValue,
  actionIcons,
  updateActionIconValue,
}: {
  viewPresets: viewPreset[];
  updateViewPresetValue: (viewPreset: viewPreset) => void;
  actionIcons: actionIcon[];
  updateActionIconValue: (actionIcon: actionIcon) => void;
}) {
  return (
    <>
      <div className="bg-muted flex h-[56px] select-none rounded-t p-2">
        <div className={'flex h-[40px] w-full select-none justify-center self-center text-[14px]'}>
          <div className="flex w-full items-center gap-[10px]">
            <div className="flex items-center justify-center">
              <div className="text-primary-active flex items-center space-x-1">
                {actionIcons.map((icon: actionIcon, index) => {
                  // Special handling for downloadFullStudy button
                  if (icon.id === 'downloadFullStudy') {
                    return (
                      <div key={index} className="relative group">
                        <button
                          onClick={() => updateActionIconValue(icon)}
                          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105"
                          title="Download entire study with all images and segmentations as ZIP archive"
                        >
                          <Icons.Download className="w-5 h-5" />
                          <div className="flex flex-col items-start">
                            <span className="text-sm font-bold leading-tight">Download Study</span>
                            <span className="text-xs opacity-90">Full Archive</span>
                          </div>
                        </button>
                        <div className="absolute -bottom-8 left-0 hidden group-hover:block bg-gray-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10">
                          Download all images and segmentations
                        </div>
                      </div>
                    );
                  }
                  
                  // Regular icons
                  return React.createElement(Icons[icon.iconName] || Icons.MissingIcon, {
                    key: index,
                    onClick: () => updateActionIconValue(icon),
                    className: `cursor-pointer hover:text-primary transition-colors`,
                  });
                })}
              </div>
            </div>
            <div className="ml-auto flex h-full items-center justify-center">
              <ToggleGroup
                type="single"
                value={viewPresets.filter(preset => preset.selected)[0].id}
                onValueChange={value => {
                  const selectedViewPreset = viewPresets.find(preset => preset.id === value);
                  updateViewPresetValue(selectedViewPreset);
                }}
              >
                {viewPresets.map((viewPreset: viewPreset, index) => (
                  <ToggleGroupItem
                    key={index}
                    aria-label={viewPreset.id}
                    value={viewPreset.id}
                    className="text-actions-primary"
                  >
                    {React.createElement(Icons[viewPreset.iconName] || Icons.MissingIcon)}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export { PanelStudyBrowserHeader };
