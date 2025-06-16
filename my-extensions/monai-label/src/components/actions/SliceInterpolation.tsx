/*
Copyright (c) MONAI Consortium
Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at
    http://www.apache.org/licenses/LICENSE-2.0
Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import React from 'react';
import './SliceInterpolation.css';
import BaseTab from './BaseTab';
import * as cornerstoneTools from '@cornerstonejs/tools';
import { hideNotification } from '../../utils/GenericUtils';
import { cache } from '@cornerstonejs/core';

export default class SliceInterpolation extends BaseTab {
  constructor(props) {
    super(props);

    this.state = {
      currentModel: null,
      currentLabel: null,
      clickPoints: new Map(),
      availableOrgans: {},
      // Slice Interpolation state
      sliceInterpolation: {
        startSlice: null,
        endSlice: null,
        startSlicePoints: new Map(),
        endSlicePoints: new Map(),
        mode: false,
      },
      interpolating: false,
    };
  }

  onSelectModel = (model) => {
    const currentLabel = null;
    const clickPoints = new Map();
    this.setState({
      currentModel: model,
      currentLabel: currentLabel,
      clickPoints: clickPoints,
      availableOrgans: this.getModelLabels(model),
    });

    this.clearAllPoints();
  };

  onEnterActionTab = () => {
    this.props.commandsManager.runCommand('setToolActive', {
      toolName: 'ProbeMONAILabel',
    });
  };

  onLeaveActionTab = () => {
    this.onChangeLabel(null);
    this.props.commandsManager.runCommand('setToolDisable', {
      toolName: 'ProbeMONAILabel',
    });
  };

  // Get current slice index from viewport
  getCurrentSliceIndex = () => {
    try {
      const { viewport } = this.props.getActiveViewportInfo();
      if (!viewport) {
        console.warn('No viewport available');
        return null;
      }

      const { cornerstoneViewportService } = this.props.servicesManager.services;
      const viewportInfo = cornerstoneViewportService.getViewportInfo(viewport.viewportId);
      
      if (viewportInfo?.viewportData?.data?.[0]?.volume) {
        const volume = viewportInfo.viewportData.data[0].volume;
        
        // Get the actual cornerstone viewport
        const cornerstoneViewport = cornerstoneViewportService.getCornerstoneViewport(viewport.viewportId);
        
        if (!cornerstoneViewport || typeof cornerstoneViewport.getCamera !== 'function') {
          console.warn('Cornerstone viewport not available or getCamera method missing');
          return null;
        }
        
        const camera = cornerstoneViewport.getCamera();
        const { focalPoint } = camera;
        const { imageData } = volume;
        const { worldToIndex } = imageData;
        
        const indexPoint = worldToIndex(focalPoint);
        const sliceIndex = Math.round(indexPoint[2]);
        
        // Fix the slice numbering - convert from 0-based to 1-based and handle reversal
        const dimensions = imageData.getDimensions();
        const totalSlices = dimensions[2];
        
        // Convert from internal index to display index (1-based, not reversed)
        const displaySliceIndex = sliceIndex + 1;
        
        console.log(`Raw slice index: ${sliceIndex}, Display index: ${displaySliceIndex}, Total slices: ${totalSlices}`);
        return displaySliceIndex;
      }
      
      // Fallback: try to get slice index from viewport properties
      if (viewport.sliceIndex !== undefined) {
        return viewport.sliceIndex + 1; // Convert to 1-based
      }
      
      // Another fallback: check viewportInfo for slice information
      if (viewportInfo?.viewportData?.data?.[0]?.imageIndex !== undefined) {
        return viewportInfo.viewportData.data[0].imageIndex + 1; // Convert to 1-based
      }
      
      console.warn('Unable to determine slice index from viewport');
      return null;
      
    } catch (error) {
      console.error('Error getting current slice index:', error);
      return null;
    }
  };

  // Set start slice for Slice Interpolation
  onSetStartSlice = () => {
    const currentSlice = this.getCurrentSliceIndex();
    if (currentSlice === null) {
      this.notification.show({
        title: 'Slice Interpolation',
        message: 'Unable to determine current slice index',
        type: 'error',
        duration: 3000,
      });
      return;
    }

    const manager = cornerstoneTools.annotation.state.getAnnotationManager();
    const currentPoints = manager.saveAnnotations(null, 'ProbeMONAILabel');
    
    this.setState(prevState => ({
      sliceInterpolation: {
        ...prevState.sliceInterpolation,
        startSlice: currentSlice,
        startSlicePoints: new Map(this.state.clickPoints),
        mode: true,
      }
    }));

    this.notification.show({
      title: 'Slice Interpolation',
      message: `Start slice set to: ${currentSlice}`,
      type: 'success',
      duration: 2000,
    });
  };

  // Set end slice for Slice Interpolation
  onSetEndSlice = () => {
    const currentSlice = this.getCurrentSliceIndex();
    if (currentSlice === null) {
      this.notification.show({
        title: 'Slice Interpolation',
        message: 'Unable to determine current slice index',
        type: 'error',
        duration: 3000,
      });
      return;
    }

    if (this.state.sliceInterpolation.startSlice === null) {
      this.notification.show({
        title: 'Slice Interpolation',
        message: 'Please set start slice first',
        type: 'warning',
        duration: 3000,
      });
      return;
    }

    if (currentSlice === this.state.sliceInterpolation.startSlice) {
      this.notification.show({
        title: 'Slice Interpolation',
        message: 'End slice must be different from start slice',
        type: 'warning',
        duration: 3000,
      });
      return;
    }

    const manager = cornerstoneTools.annotation.state.getAnnotationManager();
    const currentPoints = manager.saveAnnotations(null, 'ProbeMONAILabel');
    
    this.setState(prevState => ({
      sliceInterpolation: {
        ...prevState.sliceInterpolation,
        endSlice: currentSlice,
        endSlicePoints: new Map(this.state.clickPoints),
      }
    }));

    this.notification.show({
      title: 'Slice Interpolation',
      message: `End slice set to: ${currentSlice}`,
      type: 'success',
      duration: 2000,
    });
  };

  // Execute Slice Interpolation
  onSliceInterpolation = async () => {
    const { currentModel, currentLabel, sliceInterpolation } = this.state;
    const { info } = this.props;
    const { viewport, displaySet } = this.props.getActiveViewportInfo();

    // Validation
    if (!viewport || !displaySet) {
      this.notification.show({
        title: 'Slice Interpolation',
        message: 'No active viewport or display set available',
        type: 'error',
        duration: 5000,
      });
      return;
    }

    if (!currentModel || !currentLabel || currentLabel === 'background') {
      this.notification.show({
        title: 'Slice Interpolation',
        message: 'Please select a model and foreground label first',
        type: 'error',
        duration: 5000,
      });
      return;
    }

    if (sliceInterpolation.startSlice === null || sliceInterpolation.endSlice === null) {
      this.notification.show({
        title: 'Slice Interpolation',
        message: 'Please set both start and end slices',
        type: 'error',
        duration: 5000,
      });
      return;
    }

    // Check if model supports interpolation
    const modelType = info.data.models[currentModel]?.type;
    const supportLevel = this.getModelSupportLevel(modelType, currentModel);
    
    if (supportLevel === 'none') {
      this.notification.show({
        title: 'Slice Interpolation',
        message: 'This model does not support slice interpolation',
        type: 'error',
        duration: 5000,
      });
      return;
    }

    // Show warning for limited support models
    if (supportLevel === 'limited') {
      this.notification.show({
        title: 'Slice Interpolation',
        message: 'SAM_2D has limited interpolation capabilities. Results may be basic.',
        type: 'warning',
        duration: 4000,
      });
    }

    this.setState({ interpolating: true });

    const nid = this.notification.show({
      title: 'MONAI Label - Slice Interpolation',
      message: 'Running Slice Interpolation between slices...',
      type: 'info',
      duration: 0,
    });

    try {
      const { cornerstoneViewportService } = this.props.servicesManager.services;
      const viewportInfo = cornerstoneViewportService.getViewportInfo(viewport.viewportId);
      const { worldToIndex } = viewportInfo.viewportData.data[0].volume.imageData;

      // Collect points from both slices
      const startPoints = this.collectPointsFromMap(sliceInterpolation.startSlicePoints, worldToIndex, currentLabel);
      const endPoints = this.collectPointsFromMap(sliceInterpolation.endSlicePoints, worldToIndex, currentLabel);

      const config = this.props.onOptionsConfig();
      const params = config && config.infer && config.infer[currentModel] ? config.infer[currentModel] : {};

      // Prepare Slice Interpolation parameters
      params['slice_interpolation'] = true;
      params['start_slice'] = sliceInterpolation.startSlice - 1;
      params['end_slice'] = sliceInterpolation.endSlice - 1;
      
      if (modelType === 'deepedit') {
        params['background'] = [
          ...(startPoints.background || []),
          ...(endPoints.background || [])
        ];
        params[currentLabel] = [
          ...(startPoints.foreground || []),
          ...(endPoints.foreground || [])
        ];
      } else if (modelType === 'vista3d') {
        const allForegroundPoints = [
          ...(startPoints.foreground || []),
          ...(endPoints.foreground || [])
        ];
        const allBackgroundPoints = [
          ...(startPoints.background || []),
          ...(endPoints.background || [])
        ];

        params['points'] = allForegroundPoints;
        params['point_labels'] = new Array(allForegroundPoints.length).fill(1);
        
        if (allBackgroundPoints.length > 0) {
          params['points'] = params['points'].concat(allBackgroundPoints);
          params['point_labels'] = params['point_labels'].concat(
            new Array(allBackgroundPoints.length).fill(0)
          );
        }
        
        params['label_prompt'] = [info.modelLabelToIdxMap[currentModel][currentLabel]];
      } else if (modelType === 'sw_fastedit') {
        // SW_FastEdit uses similar format to DeepEdit
        params['background'] = [
          ...(startPoints.background || []),
          ...(endPoints.background || [])
        ];
        params[currentLabel] = [
          ...(startPoints.foreground || []),
          ...(endPoints.foreground || [])
        ];
      } else if (currentModel === 'sam_2d' && modelType === 'deepgrow') {
        // SAM_2D uses point prompts format
        const allForegroundPoints = [
          ...(startPoints.foreground || []),
          ...(endPoints.foreground || [])
        ];
        const allBackgroundPoints = [
          ...(startPoints.background || []),
          ...(endPoints.background || [])
        ];

        params['points'] = allForegroundPoints;
        params['point_labels'] = new Array(allForegroundPoints.length).fill(1);
        
        if (allBackgroundPoints.length > 0) {
          params['points'] = params['points'].concat(allBackgroundPoints);
          params['point_labels'] = params['point_labels'].concat(
            new Array(allBackgroundPoints.length).fill(0)
          );
        }
        
        // SAM_2D specific: basic interpolation mode
        params['interpolation_mode'] = 'linear';
      }

      console.log('🔄 Slice Interpolation params:', params);

      const response = await this.props.client().infer(currentModel, displaySet.SeriesInstanceUID, params);

      hideNotification(nid, this.notification);

      if (response.status !== 200) {
        throw new Error(`Failed to run Slice Interpolation: ${response.statusText || 'Unknown error'}`);
      }

      this.notification.show({
        title: 'MONAI Label - Slice Interpolation',
        message: 'Slice Interpolation completed successfully!',
        type: 'success',
        duration: 4000,
      });

      this.props.updateView(
        response,
        currentModel,
        [currentLabel],
        true,
        false,
        -1
      );

    } catch (error) {
      console.error('Slice Interpolation failed:', error);
      hideNotification(nid, this.notification);
      
      this.notification.show({
        title: 'MONAI Label - Slice Interpolation',
        message: `Slice Interpolation failed: ${error.message}`,
        type: 'error',
        duration: 6000,
      });
    } finally {
      this.setState({ interpolating: false });
    }
  };

  // Helper function to collect points from a points map
  collectPointsFromMap = (pointsMap, worldToIndex, currentLabel) => {
    const points = { foreground: [], background: [] };
    
    for (const label in pointsMap) {
      for (const uid in pointsMap[label]) {
        const annotations = pointsMap[label][uid]['ProbeMONAILabel'];
        if (!annotations) continue;

        for (const annotation of annotations) {
          const pt = annotation.data.handles.points[0];
          const indexPoint = worldToIndex(pt).map(Math.round);
          
          if (label === 'background') {
            points.background.push(indexPoint);
          } else if (label === currentLabel) {
            points.foreground.push(indexPoint);
          }
        }
      }
    }
    
    return points;
  };

  // Reset Slice Interpolation state
  onResetSliceInterpolation = () => {
    this.setState({
      sliceInterpolation: {
        startSlice: null,
        endSlice: null,
        startSlicePoints: new Map(),
        endSlicePoints: new Map(),
        mode: false,
      }
    });

    this.notification.show({
      title: 'Slice Interpolation',
      message: 'Slice Interpolation reset',
      type: 'info',
      duration: 2000,
    });
  };

  initPoints = () => {
    const label = this.state.currentLabel;
    if (!label) {
      console.log('Current Label is Null (No need to init)');
      return;
    }

    const { toolGroupService, viewportGridService } =
      this.props.servicesManager.services;
    const { viewports, activeViewportId } = viewportGridService.getState();
    const viewport = viewports.get(activeViewportId);
    const { viewportOptions } = viewport;
    const toolGroupId = viewportOptions.toolGroupId;

    const colorMap = this.segmentInfo();
    const customColor = this.segColorToRgb(colorMap[label]);
    toolGroupService.setToolConfiguration(toolGroupId, 'ProbeMONAILabel', {
      customColor: customColor,
    });

    const annotations = this.state.clickPoints[label];
    if (annotations) {
      const manager = cornerstoneTools.annotation.state.getAnnotationManager();
      manager.restoreAnnotations(annotations, null, 'ProbeMONAILabel');
    }
  };

  clearPoints = () => {
    cornerstoneTools.annotation.state
      .getAnnotationManager()
      .removeAllAnnotations();
    this.props.servicesManager.services.cornerstoneViewportService
      .getRenderingEngine()
      .render();
  };

  clearAllPoints = () => {
    const clickPoints = new Map();
    this.setState({ clickPoints: clickPoints });
    this.clearPoints();
  };

  segColorToRgb(s) {
    const c = s && s.color && Array.isArray(s.color) ? s.color : [0, 0, 0];
    return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
  }

  onChangeLabel = (name) => {
    console.log(name, this.state.currentLabel);
    if (name === this.state.currentLabel) {
      console.log('Both new and prev are same');
      return;
    }

    const prev = this.state.currentLabel;
    const clickPoints = this.state.clickPoints;
    if (prev) {
      const manager = cornerstoneTools.annotation.state.getAnnotationManager();
      const annotations = manager.saveAnnotations(null, 'ProbeMONAILabel');
      console.log('Saving Prev annotations...', annotations);

      this.state.clickPoints[prev] = annotations;
      this.clearPoints();
    }

    this.state.currentLabel = name;
    this.setState({ currentLabel: name, clickPoints: clickPoints });
    this.initPoints();
  };

  getModels() {
    const { info } = this.props;
    const models = Object.keys(info.data.models).filter(
      (m) =>
        info.data.models[m].type === 'deepedit' ||
        info.data.models[m].type === 'vista3d' ||
        info.data.models[m].type === 'sw_fastedit' ||
        (m === 'sam_2d' && info.data.models[m].type === 'deepgrow') // SAM_2D is actually type deepgrow
    );
    return models;
  }

  getModelLabels(model) {
    const { info } = this.props;
    if (model && info.modelLabelNames[model].length) {
      return info.modelLabelNames[model];
    }
    return info.labels;
  }

  getSelectedModel() {
    let selectedModel = 0;
    const models = this.getModels();
    for (const model of models) {
      if (!this.state.currentModel || model === this.state.currentModel) {
        break;
      }
      selectedModel++;
    }
    const model = models.length > 0 ? models[selectedModel] : null;
    if (!model) {
      console.log('Something went error..');
      return null;
    }
    return model;
  }

  // Check if model fully supports slice interpolation
  isModelFullySupported = (modelType) => {
    return modelType === 'deepedit' || 
           modelType === 'vista3d' || 
           modelType === 'sw_fastedit';
  };

  // Get model support level
  getModelSupportLevel = (modelType, modelName = null) => {
    if (modelType === 'deepedit' || modelType === 'vista3d' || modelType === 'sw_fastedit') {
      return 'full'; // Full 3D interpolation support
    } else if (modelName === 'sam_2d' && modelType === 'deepgrow') {
      return 'limited'; // Only simple interpolation
    }
    return 'none';
  };

  render() {
    const models = this.getModels();
    const display = models.length > 0 ? 'block' : 'none';
    const segInfo = this.segmentInfo();
    const labels = this.getModelLabels(this.getSelectedModel());
    const { sliceInterpolation, interpolating } = this.state;

    // Check current model support level
    const currentModelType = this.state.currentModel ? 
      this.props.info?.data?.models?.[this.state.currentModel]?.type : null;
    const supportLevel = currentModelType ? this.getModelSupportLevel(currentModelType, this.state.currentModel) : 'none';

    return (
      <div className="tab" style={{ display: display }}>
        <input
          type="radio"
          name="rd"
          id={this.tabId}
          className="tab-switch"
          defaultValue="sliceinterpolation"
          onClick={this.onSelectActionTab}
        />
        <label htmlFor={this.tabId} className="tab-label">
          Slice Interpolation
        </label>
        <div className="tab-content slice-interpolation-tab-content">
          {/* Custom Model Selection */}
          <div className="slice-interpolation-model-section">
            <h4 className="slice-interpolation-model-header">
              <span style={{ marginRight: '8px' }}>🤖</span>
              Model Selection
            </h4>
            
            <div className="slice-interpolation-model-dropdown">
              <label htmlFor="model-select" className="model-label">Choose Model:</label>
              <select
                id="model-select"
                value={this.state.currentModel || ''}
                onChange={(e) => this.onSelectModel(e.target.value)}
                className="model-select-dropdown"
              >
                <option value="" disabled>Select a model...</option>
                {models.map((model) => {
                  const modelType = this.props.info?.data?.models?.[model]?.type;
                  const modelSupportLevel = this.getModelSupportLevel(modelType, model);
                  const supportIcon = modelSupportLevel === 'full' ? '✅' : 
                                    modelSupportLevel === 'limited' ? '⚠️' : '❌';
                  
                  return (
                    <option key={model} value={model}>
                      {supportIcon} {model} ({modelType})
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Model Info Display */}
            {this.state.currentModel && (
              <div className="slice-interpolation-model-info">
                <div className="model-info-item">
                  <strong>Selected:</strong> {this.state.currentModel}
                </div>
                <div className="model-info-item">
                  <strong>Type:</strong> {currentModelType}
                </div>
                <div className="model-info-item">
                  <strong>Support:</strong> 
                  <span className={`support-level ${supportLevel}`}>
                    {supportLevel === 'full' ? '✅ Full 3D Interpolation' : 
                     supportLevel === 'limited' ? '⚠️ Limited (Linear only)' : 
                     '❌ Not Supported'}
                  </span>
                </div>
              </div>
            )}

            {/* Usage Instructions */}
            <div className="slice-interpolation-usage">
              <p><strong>🎯 Workflow:</strong></p>
              <div className="usage-steps">
                <div className="usage-step">1. Select model above</div>
                <div className="usage-step">2. Choose anatomy below</div>
                <div className="usage-step">3. Add points → Set Start</div>
                <div className="usage-step">4. Navigate → Add points → Set End</div>
                <div className="usage-step">5. Click Interpolate</div>
              </div>
              
              {/* Model Support Warning */}
              {supportLevel === 'limited' && (
                <div className="support-warning">
                  <p><strong>⚠️ Limited Support</strong></p>
                  <p>SAM_2D only supports basic linear interpolation. For advanced 3D interpolation, use DeepEdit, Vista3D, or SW_FastEdit.</p>
                </div>
              )}
              
              <div className="clear-actions">
                <u>
                  <a
                    style={{ color: 'red', cursor: 'pointer' }}
                    onClick={() => this.clearPoints()}
                  >
                    Clear Points
                  </a>
                </u>{' '}
                |{' '}
                <u>
                  <a
                    style={{ color: 'red', cursor: 'pointer' }}
                    onClick={() => this.clearAllPoints()}
                  >
                    Clear All Points
                  </a>
                </u>
              </div>
            </div>
          </div>
          
          {/* Slice Interpolation Controls */}
          <div className="slice-interpolation-container">
            <h4 className="slice-interpolation-header">
              <span style={{ marginRight: '8px' }}>🔄</span>
              Slice Interpolation Controls
              {supportLevel === 'limited' && (
                <span style={{ 
                  marginLeft: '8px', 
                  fontSize: '10px', 
                  color: '#ffc107',
                  backgroundColor: 'rgba(255, 193, 7, 0.2)',
                  padding: '2px 6px',
                  borderRadius: '3px'
                }}>
                  LIMITED
                </span>
              )}
            </h4>
            
            <div className="slice-interpolation-instructions">
              <p>Add points on first slice and click "Set Start"</p>
              <p>Navigate to different slice, add points and click "Set End"</p>
              <p>Click "Interpolate" to segment between slices</p>
            </div>

            <div style={{ marginBottom: '8px' }}>
              <div className="slice-interpolation-buttons">
                <button
                  onClick={this.onSetStartSlice}
                  disabled={interpolating}
                  className={`slice-interpolation-btn start ${sliceInterpolation.startSlice !== null ? 'active' : ''}`}
                >
                  {sliceInterpolation.startSlice !== null 
                    ? `Start: ${sliceInterpolation.startSlice}`
                    : 'Set Start Slice'
                  }
                </button>
                
                <button
                  onClick={this.onSetEndSlice}
                  disabled={interpolating || sliceInterpolation.startSlice === null}
                  className={`slice-interpolation-btn end ${sliceInterpolation.endSlice !== null ? 'active' : ''}`}
                >
                  {sliceInterpolation.endSlice !== null 
                    ? `End: ${sliceInterpolation.endSlice}`
                    : 'Set End Slice'
                  }
                </button>
              </div>

              <div className="slice-interpolation-main-buttons">
                <button
                  onClick={this.onSliceInterpolation}
                  disabled={interpolating || sliceInterpolation.startSlice === null || sliceInterpolation.endSlice === null}
                  className="slice-interpolation-btn interpolate"
                >
                  {interpolating ? '🔄 Interpolating...' : '🚀 Interpolate'}
                </button>
                
                <button
                  onClick={this.onResetSliceInterpolation}
                  disabled={interpolating}
                  className="slice-interpolation-btn reset"
                >
                  🔄 Reset
                </button>
              </div>
            </div>

            {sliceInterpolation.startSlice !== null && sliceInterpolation.endSlice !== null && (
              <div className="slice-interpolation-status">
                ✅ Ready to interpolate from slice {sliceInterpolation.startSlice} to {sliceInterpolation.endSlice}
              </div>
            )}
          </div>

          <div className="optionsTableContainer">
            <hr />
            <p>Available Organ(s):</p>
            <hr />
            <div className="bodyTableContainer slice-interpolation-organs-container">
              <table className="optionsTable">
                <tbody>
                  <tr
                    key="background"
                    className="clickable-row"
                    style={{
                      backgroundColor:
                        this.state.currentLabel === 'background'
                          ? 'darkred'
                          : 'transparent',
                    }}
                    onClick={() => this.onChangeLabel('background')}
                  >
                    <td>
                      <span
                        className="segColor"
                        style={{
                          backgroundColor: this.segColorToRgb(
                            segInfo['background']
                          ),
                        }}
                      />
                    </td>
                    <td>background</td>
                  </tr>
                  {labels
                    .filter((l) => l !== 'background')
                    .map((label) => (
                      <tr
                        key={label}
                        className="clickable-row"
                        style={{
                          backgroundColor:
                            this.state.currentLabel === label
                              ? 'darkblue'
                              : 'transparent',
                          cursor: 'pointer',
                        }}
                        onClick={() => this.onChangeLabel(label)}
                      >
                        <td>
                          <span
                            className="segColor"
                            style={{
                              backgroundColor: this.segColorToRgb(
                                segInfo[label]
                              ),
                            }}
                          />
                        </td>
                        <td>{label}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  }
} 