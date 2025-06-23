// @ts-nocheck
import React from 'react';
import BaseTab from './BaseTab';
import { Toolbox, Button } from '@ohif/ui-next';
import { PanelSegmentation } from '@ohif/extension-cornerstone';

export default class SegmentationTools extends BaseTab {
  constructor(props) {
    super(props);
    this.state = {
      // Removed training and saving related state variables
    };
  }

  async componentDidMount() {
    // Component initialization - no training status checks needed
  }

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
          {/* Note */}
          <div className="mb-4 p-3 border border-blue-500 rounded bg-blue-900 bg-opacity-20">
            <h4 className="text-sm font-semibold mb-2 text-blue-200 flex items-center">
              <span className="mr-2">ℹ️</span>
              Note
            </h4>
            <div className="mt-2 p-2 bg-yellow-900 bg-opacity-30 rounded border-l-2 border-yellow-500">
              <p className="text-xs text-yellow-200">
                <strong>Important:</strong> AI Server connection is required before using segmentation features.
              </p>
            </div>
            <div className="mt-2 p-2 bg-blue-900 bg-opacity-30 rounded border-l-2 border-orange-500">
              <p className="text-xs text-orange-200">
                <strong>Medical Safety Protocol:</strong> Page reload after each case ensures proper memory cleanup, prevents cross-case data contamination, and maintains optimal AI model performance for accurate diagnosis.
              </p>
            </div>
          </div>

          {/* AI Tools */}
          <div className="flex gap-2 mb-3">
            <Button size="sm" variant="ghost" onClick={this.props.runAutoSegmentation}>
              AI Segment
            </Button>
            <Button size="sm" variant="ghost" onClick={this.props.revert}>
              Revert
            </Button>
          </div>

          {/* Segmentation Toolbox */}
          <Toolbox
            commandsManager={this.props.commandsManager}
            servicesManager={this.props.servicesManager}
            extensionManager={this.props.extensionManager}
            buttonSectionId="segmentationToolbox"
            title="Segmentation Tools"
          />
          
          {/* Segmentation Panel */}
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