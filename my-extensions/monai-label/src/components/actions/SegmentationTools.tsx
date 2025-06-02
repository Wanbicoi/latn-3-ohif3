// @ts-nocheck
import React from 'react';
import BaseTab from './BaseTab';
import { Toolbox, Button } from '@ohif/ui-next';
import { PanelSegmentation } from '@ohif/extension-cornerstone';

export default class SegmentationTools extends BaseTab {
  render() {
    return (
      <div className="tab">
        <input
          type="radio"
          name="rd"
          id={this.tabId}
          className="tab-switch"
          defaultValue="tools"
          onClick={this.onSelectActionTab}
        />
        <label htmlFor={this.tabId} className="tab-label">
          Segmentation Tools
        </label>
        <div className="tab-content" style={{ width: '100%' }}>
          <div className="flex gap-2 mb-1">
            <Button size="sm" variant="ghost" onClick={this.props.runAutoSegmentation}>
              AI Segment
            </Button>
            <Button size="sm" variant="ghost" onClick={this.props.revert}>
              Revert
            </Button>
          </div>
          <Toolbox
            commandsManager={this.props.commandsManager}
            servicesManager={this.props.servicesManager}
            extensionManager={this.props.extensionManager}
            buttonSectionId="segmentationToolbox"
            title="Segmentation Tools"
          />
          <div style={{ paddingBottom: '150px' }}>
            <PanelSegmentation
              servicesManager={this.props.servicesManager}
              commandsManager={this.props.commandsManager}
              extensionManager={this.props.extensionManager}
              style={{ paddingLeft: 0, paddingRight: 0 }}
            />
          </div>
        </div>
      </div>
    );
  }
} 