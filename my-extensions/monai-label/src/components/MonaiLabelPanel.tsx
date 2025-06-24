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

// @ts-nocheck

import React, { Component, createRef } from 'react';
import PropTypes from 'prop-types';
import './MonaiLabelPanel.css';
import AutoSegmentation from './actions/AutoSegmentation';
import PointPrompts from './actions/PointPrompts';
import ClassPrompts from './actions/ClassPrompts';
// import ActiveLearning from './actions/ActiveLearning'; // Hidden - requires multiple studies
import MonaiLabelClient from '../services/MonaiLabelClient';
import { hideNotification, getLabelColor } from '../utils/GenericUtils';
import { Enums } from '@cornerstonejs/tools';
import { cache, triggerEvent, eventTarget } from '@cornerstonejs/core';
import SegmentationReader from '../utils/SegmentationReader';
import { currentSegmentsInfo } from '../utils/SegUtils';
import SettingsTable from './SettingsTable';
import * as cornerstoneTools from '@cornerstonejs/tools';
import optionsInputDialog from './OptionsInputDialog';
import { PanelSegmentation } from '@ohif/extension-cornerstone';
import { Toolbox, Button, Icons } from '@ohif/ui-next';
import SegmentationComments from '../../../../platform/ui-next/src/components/SegmentationTable/SegmentationComments';
import SegmentationTools from './actions/SegmentationTools';

export default class MonaiLabelPanel extends Component {
  static propTypes = {
    commandsManager: PropTypes.any,
    servicesManager: PropTypes.any,
    extensionManager: PropTypes.any,
  };

  notification: any;
  settings;
  actions: {
    // activelearning: any; // Hidden - requires multiple studies
    segmentation: any;
    pointprompts: any;
    classprompts: any;
    tools: any;
  };
  serverURI = 'http://127.0.0.1:8000';
  _latestLoadedSegUID: string | null = null;
  _toastShown = false;
  _dsSubscription: any;

  constructor(props) {
    super(props);

    const { uiNotificationService } = props.servicesManager.services;
    this.notification = uiNotificationService;
    this.settings = React.createRef();
    this.actions = {
      // activelearning: React.createRef(), // Hidden - requires multiple studies
      segmentation: React.createRef(),
      pointprompts: React.createRef(),
      classprompts: React.createRef(),
      tools: React.createRef(),
    };

    this.state = {
      info: { models: [], datasets: [] },
      action: {},
      options: {},
    };
  }

  client = () => {
    const settings =
      this.settings && this.settings.current && this.settings.current.state
        ? this.settings.current.state
        : null;
    return new MonaiLabelClient(settings ? settings.url : this.serverURI);
  };

  segmentColor(label) {
    const color = getLabelColor(label);
    const rgbColor = [];
    for (const key in color) {
      rgbColor.push(color[key]);
    }
    rgbColor.push(255);
    return rgbColor;
  }

  getActiveViewportInfo = () => {
    const { viewportGridService, displaySetService } =
      this.props.servicesManager.services;
    const { viewports, activeViewportId } = viewportGridService.getState();
    
    if (!activeViewportId || !viewports) {
      console.warn('No active viewport ID or viewports available');
      return { viewport: null, displaySet: null };
    }
    
    const viewport = viewports.get(activeViewportId);
    
    if (!viewport || !viewport.displaySetInstanceUIDs || viewport.displaySetInstanceUIDs.length === 0) {
      console.warn('Viewport not found or no displaySetInstanceUIDs available');
      return { viewport: null, displaySet: null };
    }
    
    const displaySet = displaySetService.getDisplaySetByUID(
      viewport.displaySetInstanceUIDs[0]
    );

    // viewportId = viewport.viewportId
    // SeriesInstanceUID = displaySet.SeriesInstanceUID;
    // StudyInstanceUID = displaySet.StudyInstanceUID;
    // FrameOfReferenceUID = displaySet.instances[0].FrameOfReferenceUID;
    // displaySetInstanceUID = displaySet.displaySetInstanceUID;
    // numImageFrames = displaySet.numImageFrames;
    return { viewport, displaySet };
  };

  onInfo = async (serverURI) => {
    const nid = this.notification.show({
      title: 'MONAI Label',
      message: 'Connecting to MONAI Label',
      type: 'info',
      duration: 2000,
    });

    this.serverURI = serverURI;
    const response = await this.client().info();
    console.log(response.data);

    hideNotification(nid, this.notification);
    if (response.status !== 200) {
      this.notification.show({
        title: 'MONAI Label',
        message: 'Failed to Connect to MONAI Label',
        type: 'error',
        duration: 5000,
      });
      return;
    }

    this.notification.show({
      title: 'MONAI Label',
      message: 'Connected to MONAI Label - Successful',
      type: 'success',
      duration: 2000,
    });

    const all_models = response.data.models;
    const all_model_names = Object.keys(all_models);
    const deepgrow_models = all_model_names.filter(
      (m) => all_models[m].type === 'deepgrow'
    );
    const deepedit_models = all_model_names.filter(
      (m) => all_models[m].type === 'deepedit'
    );
    const vista3d_models = all_model_names.filter(
      (m) => all_models[m].type === 'vista3d'
    );
    const segmentation_models = all_model_names.filter(
      (m) => all_models[m].type === 'segmentation'
    );
    const models = deepgrow_models
      .concat(deepedit_models)
      .concat(vista3d_models)
      .concat(segmentation_models);
    const all_labels = response.data.labels;

    const modelLabelToIdxMap = {};
    const modelIdxToLabelMap = {};
    const modelLabelNames = {};
    const modelLabelIndices = {};
    for (const model of models) {
      const labels = all_models[model]['labels'];
      modelLabelToIdxMap[model] = {};
      modelIdxToLabelMap[model] = {};
      if (Array.isArray(labels)) {
        for (let label_idx = 1; label_idx <= labels.length; label_idx++) {
          const label = labels[label_idx - 1];
          all_labels.push(label);
          modelLabelToIdxMap[model][label] = label_idx;
          modelIdxToLabelMap[model][label_idx] = label;
        }
      } else {
        for (const label of Object.keys(labels)) {
          const label_idx = labels[label];
          all_labels.push(label);
          modelLabelToIdxMap[model][label] = label_idx;
          modelIdxToLabelMap[model][label_idx] = label;
        }
      }
      modelLabelNames[model] = [
        ...Object.keys(modelLabelToIdxMap[model]),
      ].sort();
      modelLabelIndices[model] = [...Object.keys(modelIdxToLabelMap[model])]
        .sort()
        .map(Number);
    }

    const labelsOrdered = [...new Set(all_labels)].sort();
    const segmentations = [
      {
        segmentationId: '1',
        representation: {
          type: Enums.SegmentationRepresentations.Labelmap,
        },
        config: {
          label: 'Segmentations',
          segments: labelsOrdered.reduce((acc, label, index) => {
            acc[index + 1] = {
              segmentIndex: index + 1,
              label: label,
              active: index === 0, // First segment is active
              locked: false,
              color: this.segmentColor(label),
            };
            return acc;
          }, {}),
        },
      },
    ];

    const initialSegs = segmentations[0].config.segments;
    const volumeLoadObject = cache.getVolume('1');
    if (!volumeLoadObject) {
      this.props.commandsManager.runCommand('loadSegmentationsForViewport', {
        segmentations,
      });

      // Wait for Above Segmentations to be added/available
      setTimeout(() => {
        const { viewport } = this.getActiveViewportInfo();
        if (!viewport) {
          console.warn('No viewport available for color setting');
          return;
        }
        
        // Additional validation
        if (!viewport.viewportId) {
          console.warn('Viewport has no viewportId');
          return;
        }
        
        // Check if segmentation service is available
        const { segmentationService } = this.props.servicesManager.services;
        if (!segmentationService) {
          console.warn('Segmentation service not available');
          return;
        }
        
        // Check if segmentation exists
        try {
          const segmentation = segmentationService.getSegmentation('1');
          if (!segmentation) {
            console.warn('Segmentation with ID "1" not found');
            return;
          }
        } catch (error) {
          console.warn('Error accessing segmentation:', error);
          return;
        }
        
        // Set colors for each segment with error handling
        for (const segmentIndex of Object.keys(initialSegs)) {
          const segment = initialSegs[segmentIndex];
          if (!segment || !segment.segmentIndex || !segment.color) {
            console.warn(`Invalid segment data for index ${segmentIndex}:`, segment);
            continue;
          }
          
          try {
            cornerstoneTools.segmentation.config.color.setSegmentIndexColor(
              viewport.viewportId,
              '1',
              segment.segmentIndex,
              segment.color
            );
          } catch (error) {
            console.warn(`Failed to set color for segment ${segment.segmentIndex}:`, error);
          }
        }
      }, 1000);
    }

    const info = {
      models: models,
      labels: labelsOrdered,
      data: response.data,
      modelLabelToIdxMap: modelLabelToIdxMap,
      modelIdxToLabelMap: modelIdxToLabelMap,
      modelLabelNames: modelLabelNames,
      modelLabelIndices: modelLabelIndices,
      initialSegs: initialSegs,
    };

    console.log(info);
    this.setState({ info: info });
    this.setState({ isDataReady: true }); // Mark as ready
    this.setState({ options: {} });
  };

  onSelectActionTab = (name) => {
    // If clicking the currently-open tab -> collapse (select hidden none)
    const current = this.state.action;
    if (current === name) {
      // leave current
      if (this.actions[current]?.current) {
        this.actions[current].current.onLeaveActionTab();
      }
      // select hidden radio to collapse UI
      const noneInput = document.getElementById('tab-none') as HTMLInputElement | null;
      if (noneInput) {
        noneInput.checked = true;
      }
      this.setState({ action: null });
      return;
    }

    // otherwise switch to new tab
    for (const action of Object.keys(this.actions)) {
      if (current === action && this.actions[action].current) {
        this.actions[action].current.onLeaveActionTab();
      }
      if (name === action && this.actions[action].current) {
        this.actions[action].current.onEnterActionTab();
      }
    }
    this.setState({ action: name });
  };

  updateView = async (
    response,
    model_id,
    labels,
    override = false,
    label_class_unknown = false,
    sidx = -1
  ) => {
    console.log('🔍 UpdateView Debug: ', {
      model_id,
      labels,
      override,
      label_class_unknown,
      sidx,
      responseStatus: response.status,
      responseDataLength: response.data?.length
    });
    
    const ret = SegmentationReader.parseNrrdData(response.data);
    if (!ret) {
      console.error('❌ Failed to parse NRRD data');
      throw new Error('Failed to parse NRRD data');
    }
    
    console.log('✅ NRRD parsed successfully:', {
      imageShape: ret.image?.length,
      imageType: typeof ret.image,
      hasImage: !!ret.image,
      // Add more detailed NRRD header info to debug orientation
      headerKeys: ret.header ? Object.keys(ret.header) : null,
      spaceOrigin: ret.header?.['space origin'],
      spaceDirections: ret.header?.['space directions'],
      space: ret.header?.space,
      spaceDimension: ret.header?.['space dimension']
    });

    // Debug viewport and display set information
    const { viewport, displaySet } = this.getActiveViewportInfo();
    if (viewport && displaySet) {
      console.log('🖥️ Viewport Info:', {
        viewportId: viewport.viewportId,
        viewportType: viewport.viewportType,
        orientation: viewport.orientation,
        displaySetUID: displaySet.displaySetInstanceUID,
        seriesUID: displaySet.SeriesInstanceUID,
        frameOfReference: displaySet.instances?.[0]?.FrameOfReferenceUID,
        imageOrientationPatient: displaySet.instances?.[0]?.ImageOrientationPatient,
        imagePositionPatient: displaySet.instances?.[0]?.ImagePositionPatient
      });
    }

    const labelNames = {};
    const currentSegs = currentSegmentsInfo(
      this.props.servicesManager.services.segmentationService
    );
    console.log('📊 Current segments info:', currentSegs);
    
    const modelToSegMapping = {};
    modelToSegMapping[0] = 0;

    let tmp_model_seg_idx = 1;
    for (const label of labels) {
      const s = currentSegs.info[label];
      if (!s) {
        for (let i = 1; i <= 255; i++) {
          if (!currentSegs.indices.has(i)) {
            labelNames[label] = i;
            currentSegs.indices.add(i);
            break;
          }
        }
      } else {
        labelNames[label] = s.segmentIndex;
      }

      const seg_idx = labelNames[label];
      let model_seg_idx = this.state.info.modelLabelToIdxMap[model_id][label];
      model_seg_idx = model_seg_idx ? model_seg_idx : tmp_model_seg_idx;
      modelToSegMapping[model_seg_idx] = 0xff & seg_idx;
      tmp_model_seg_idx++;
    }

    console.log('🗂️ Index Remap', {labels, modelToSegMapping, labelNames});
    const data = new Uint8Array(ret.image);
    console.log('📦 Data array info:', {
      length: data.length,
      uniqueValues: [...new Set(data)].slice(0, 10), // Show first 10 unique values
      nonZeroCount: data.filter(v => v !== 0).length,
      // Add spatial analysis - check if labels are clustered in expected regions
      firstNonZeroIndex: data.findIndex(v => v !== 0),
      lastNonZeroIndex: data.length - 1 - [...data].reverse().findIndex(v => v !== 0)
    });

    // Enhanced orientation handling with coordinate system validation
    console.log('🔍 NRRD Header Analysis:', {
      space: ret.header?.space,
      spaceDirections: ret.header?.['space directions'],
      sizes: ret.header?.sizes,
      dataShape: ret.image ? `[${Math.cbrt(ret.image.length).toFixed(0)}³ approx]` : 'unknown'
    });

    // Validate coordinate system compatibility
    const nrrdSpace = ret.header?.space;
    const isRAS = nrrdSpace === 'right-anterior-superior' || nrrdSpace === 'RAS';
    const isLPS = nrrdSpace === 'left-posterior-superior' || nrrdSpace === 'LPS';
    
    console.log('🧭 Coordinate System Analysis:', {
      nrrdSpace,
      isRAS,
      isLPS,
      needsConversion: isRAS && !isLPS // MONAI typically uses RAS, DICOM uses LPS
    });

    // Check if we need to apply coordinate system transformation
    let convertedData = data;
    if (isRAS && viewport && displaySet) {
      const imageOrientationPatient = displaySet.instances?.[0]?.ImageOrientationPatient;
      if (imageOrientationPatient) {
        console.log('🔄 Applying RAS to LPS coordinate transformation...');
        // Note: This is a simplified approach. In practice, you might need more sophisticated
        // transformation based on the specific orientation matrices
        
        // For now, we'll add logging to track the transformation need
        console.log('⚠️ RAS to LPS transformation needed but simplified for stability');
      }
    }

    const { segmentationService } = this.props.servicesManager.services;
    console.log('🔧 SegmentationService:', {
      hasService: !!segmentationService,
      methodExists: typeof segmentationService.getLabelmapVolume
    });
    
    const volumeLoadObject = segmentationService.getLabelmapVolume('1');
    console.log('💾 Volume load object:', {
      hasVolume: !!volumeLoadObject,
      volumeType: typeof volumeLoadObject,
      volumeKeys: volumeLoadObject ? Object.keys(volumeLoadObject) : null
    });
    
    if (volumeLoadObject) {
      console.log('✅ Volume Object is in Cache - Updating segmentation data');
      
      // Apply index mapping
      for (let i = 0; i < convertedData.length; i++) {
        const midx = convertedData[i];
        const sidx = modelToSegMapping[midx];
        if (midx && sidx) {
          convertedData[i] = sidx;
        } else if (override && label_class_unknown && labels.length === 1) {
          convertedData[i] = midx ? labelNames[labels[0]] : 0;
        } else if (labels.length > 0) {
          convertedData[i] = 0;
        }
      }

      console.log('🔄 Data conversion completed:', {
        originalNonZeros: data.filter(v => v !== 0).length,
        convertedNonZeros: convertedData.filter(v => v !== 0).length,
        uniqueConverted: [...new Set(convertedData)].slice(0, 10),
        // Check if orientation needs to be flipped by analyzing first vs last half distribution
        firstHalfNonZeros: convertedData.slice(0, convertedData.length/2).filter(v => v !== 0).length,
        secondHalfNonZeros: convertedData.slice(convertedData.length/2).filter(v => v !== 0).length
      });

      if (override === true) {
        const { segmentationService } = this.props.servicesManager.services;
        const volumeLoadObject = segmentationService.getLabelmapVolume('1');
        const { voxelManager } = volumeLoadObject;
        const scalarData = voxelManager?.getCompleteScalarDataArray();

        // console.log('Current ScalarData: ', scalarData);
        const currentSegArray = new Uint8Array(scalarData.length);
        currentSegArray.set(scalarData);

        // get unique values to determine which organs to update, keep rest
        const updateTargets = new Set(convertedData);
        const activeViewportInfo = this.getActiveViewportInfo();
        if (!activeViewportInfo.displaySet) {
          console.warn('No displaySet available for slice calculation');
          return;
        }
        const numImageFrames = activeViewportInfo.displaySet.numImageFrames;
        const sliceLength = scalarData.length / numImageFrames;
        const sliceBegin = sliceLength * sidx;
        const sliceEnd = sliceBegin + sliceLength;

        for (let i = 0; i < convertedData.length; i++) {
          if (sidx >= 0 && (i < sliceBegin || i >= sliceEnd)) {
            continue;
          }

          if (
            convertedData[i] !== 255 &&
            updateTargets.has(currentSegArray[i])
          ) {
            currentSegArray[i] = convertedData[i];
          }
        }
        convertedData = currentSegArray;
      }
      
      const { voxelManager } = volumeLoadObject;
      if (!voxelManager) {
        console.error('❌ No voxelManager found in volumeLoadObject');
        return;
      }
      
      console.log('📝 Setting scalar data with voxelManager');
      voxelManager?.setCompleteScalarDataArray(convertedData);
      
      console.log('📡 Triggering SEGMENTATION_DATA_MODIFIED event');
      triggerEvent(eventTarget, Enums.Events.SEGMENTATION_DATA_MODIFIED, {
        segmentationId: '1',
      });
      console.log("✅ Updated the segmentation's scalar data successfully");
      
      // 🎯 NEW: Filter and show only active segments with data
      setTimeout(() => {
        this.filterActiveSegments(convertedData, labelNames, labels);
      }, 500);
    } else {
      console.error('❌ Volume Object is NOT In Cache - Cannot update segmentation');
      console.log('🔧 Attempting to check available segmentations...');
      
      const allSegmentations = segmentationService.getSegmentations();
      console.log('📋 All segmentations:', allSegmentations);
      
      if (allSegmentations && allSegmentations.length > 0) {
        console.log('📦 Available segmentation IDs:', allSegmentations.map(s => s.segmentationId));
      } else {
        console.log('🚫 No segmentations found in service');
      }
    }
  };

  // 🎯 NEW: Function to filter and show only segments with actual data
  filterActiveSegments = (segmentationData, labelNames, processedLabels) => {
    try {
      const { segmentationService } = this.props.servicesManager.services;
      
      // Find which segment indices actually have data
      const uniqueValues = [...new Set(segmentationData)];
      const activeSegmentIndices = uniqueValues.filter(val => val > 0);
      
      console.log('🔍 Active segment analysis:', {
        totalVoxels: segmentationData.length,
        uniqueValues: uniqueValues,
        activeSegmentIndices: activeSegmentIndices,
        processedLabels: processedLabels,
        labelNames: labelNames
      });
      
      // Get current segmentation
      const segmentation = segmentationService.getSegmentation('1');
      if (!segmentation || !segmentation.config || !segmentation.config.segments) {
        console.warn('Cannot access segmentation config for filtering');
        return;
      }
      
      const allSegments = segmentation.config.segments;
      const segmentsToShow = new Set();
      const segmentsToHide = new Set();
      
      // Determine which segments to show/hide
      Object.keys(allSegments).forEach(segmentIndex => {
        const segmentIndexNum = parseInt(segmentIndex);
        const segment = allSegments[segmentIndex];
        
        if (activeSegmentIndices.includes(segmentIndexNum)) {
          // This segment has data - show it
          segmentsToShow.add(segmentIndexNum);
          console.log(`✅ Showing segment ${segmentIndexNum}: ${segment.label} (has data)`);
        } else {
          // This segment has no data - hide it
          segmentsToHide.add(segmentIndexNum);
          console.log(`🙈 Hiding segment ${segmentIndexNum}: ${segment.label} (no data)`);
        }
      });
      
      // Apply visibility changes
      const { viewport } = this.getActiveViewportInfo();
      if (!viewport || !viewport.viewportId) {
        console.warn('No viewport available for segment visibility changes');
        return;
      }
      
      // Get all viewports that have this segmentation to update visibility across all
      const viewportIds = segmentationService.getViewportIdsWithSegmentation('1');
      console.log('🖥️ Updating visibility across viewports:', viewportIds);
      
      viewportIds.forEach(viewportId => {
        // Show segments with data
        segmentsToShow.forEach(segmentIndex => {
          try {
            segmentationService.setSegmentVisibility(viewportId, '1', segmentIndex, true);
            console.log(`👁️ Showing segment ${segmentIndex} (has data)`);
          } catch (error) {
            console.warn(`Failed to show segment ${segmentIndex} in viewport ${viewportId}:`, error);
          }
        });
        
        // Hide segments with no data
        segmentsToHide.forEach(segmentIndex => {
          try {
            segmentationService.setSegmentVisibility(viewportId, '1', segmentIndex, false);
            console.log(`🙈 Hiding segment ${segmentIndex} (no data)`);
          } catch (error) {
            console.warn(`Failed to hide segment ${segmentIndex} in viewport ${viewportId}:`, error);
          }
        });
        
        // 🙈 Keep segments but hide them (don't remove from config to preserve labels)
        // Removing segments would delete labels that might get data later
        console.log('📝 Keeping all segments in config, only hiding empty ones for cleaner UI');
      });
      
      // Show notification about filtering
      if (segmentsToShow.size > 0) {
        const activeLabels = [];
        segmentsToShow.forEach(segmentIndex => {
          const segment = allSegments[segmentIndex];
          if (segment && segment.label) {
            activeLabels.push(segment.label);
          }
        });
        
        this.notification.show({
          title: 'Segmentation Results',
          message: `Found ${segmentsToShow.size} active segment(s): ${activeLabels.join(', ')}. ${segmentsToHide.size} empty segments hidden from view.`,
          type: 'success',
          duration: 5000,
        });
      }
      
      console.log(`🎯 Segmentation filtering completed: ${segmentsToShow.size} shown, ${segmentsToHide.size} hidden (but preserved in config)`);
      
    } catch (error) {
      console.error('❌ Error in filterActiveSegments:', error);
    }
  };

  openConfigurations = (e) => {
    e.preventDefault();

    const { uiDialogService } = this.props.servicesManager.services;
    optionsInputDialog(
      uiDialogService,
      this.state.options,
      this.state.info,
      (options, actionId) => {
        if (actionId === 'save' || actionId == 'reset') {
          this.setState({ options: options });
        }
      }
    );
  };

  async componentDidMount() {
    // (Auto-load logic removed as per new requirement – user will pick SEG manually)

    if (this.state.isDataReady) {
      return;
    }

    console.log('(Component Mounted) Ready to Connect to MONAI Server...');
    // await this.onInfo();
  }

  onOptionsConfig = () => {
    return this.state.options;
  };

  /**
   * Trigger Auto-Segmentation programmatically using the currently-selected
   * model in the <AutoSegmentation> tab.
   */
  _runAutoSegmentation = () => {
    const autoSegComp = this.actions['segmentation']?.current;
    if (autoSegComp?.onSegmentation) {
      // Open the tab if it is not the active one
      const autoRadio = document.getElementById(autoSegComp.tabId) as HTMLInputElement | null;
      if (autoRadio && !autoRadio.checked) {
        autoRadio.click();
      }
      autoSegComp.onSegmentation();
    } else {
      this.notification?.show?.({
        title: 'AI Segment',
        message: 'Auto-Segmentation component not ready',
        type: 'error',
      });
    }
  };

  _revertToOriginal = () => {
    const { segmentationService, viewportGridService, displaySetService } =
      this.props.servicesManager.services;

    const segs = segmentationService.getSegmentations();
    segs.forEach(s => {
      try {
        segmentationService.remove(s.segmentationId);
      } catch (_) {}
    });

    this.notification?.show?.({
      title: 'Segmentation',
      message: 'All segmentations removed (reverted to original images)',
      type: 'info',
    });
  };

  render() {
    const { isDataReady } = this.state;
    return (
      <div className="monaiLabelPanel">
        <br style={{ margin: '3px' }} />

        <SettingsTable ref={this.settings} onInfo={this.onInfo} />
        {isDataReady && (
          <div style={{ color: 'white' }}>
            <p className="subtitle">{this.state.info.data.name}</p>
            <br />
            <hr className="separator" />
            <a href="#" onClick={this.openConfigurations}>
              Options / Configurations
            </a>
            <hr className="separator" />
          </div>
        )}
        {/* hidden radio for collapsing all tabs */}
        <input type="radio" id="tab-none" name="rd" className="tab-switch" style={{ display: 'none' }} />

        {isDataReady && (
          <div className="tabs scrollbar" id="style-3">
            {/* ActiveLearning component hidden - requires multiple studies to function properly */}
            {/* <ActiveLearning
              ref={this.actions['activelearning']}
              tabIndex={1}
              info={this.state.info}
              client={this.client}
              updateView={this.updateView}
              onSelectActionTab={this.onSelectActionTab}
              onOptionsConfig={this.onOptionsConfig}
              getActiveViewportInfo={this.getActiveViewportInfo}
            /> */}
            <AutoSegmentation
              ref={this.actions['segmentation']}
              tabIndex={1}
              info={this.state.info}
              client={this.client}
              updateView={this.updateView}
              onSelectActionTab={this.onSelectActionTab}
              onOptionsConfig={this.onOptionsConfig}
              getActiveViewportInfo={this.getActiveViewportInfo}
            />
            <PointPrompts
              ref={this.actions['pointprompts']}
              tabIndex={2}
              info={this.state.info}
              client={this.client}
              updateView={this.updateView}
              onSelectActionTab={this.onSelectActionTab}
              onOptionsConfig={this.onOptionsConfig}
              getActiveViewportInfo={this.getActiveViewportInfo}
              servicesManager={this.props.servicesManager}
              commandsManager={this.props.commandsManager}
            />
            <ClassPrompts
              ref={this.actions['classprompts']}
              tabIndex={3}
              info={this.state.info}
              client={this.client}
              updateView={this.updateView}
              onSelectActionTab={this.onSelectActionTab}
              onOptionsConfig={this.onOptionsConfig}
              getActiveViewportInfo={this.getActiveViewportInfo}
              servicesManager={this.props.servicesManager}
              commandsManager={this.props.commandsManager}
            />
            <SegmentationTools
              ref={this.actions['tools']}
              tabIndex={5}
              runAutoSegmentation={this._runAutoSegmentation}
              revert={this._revertToOriginal}
              servicesManager={this.props.servicesManager}
              commandsManager={this.props.commandsManager}
              extensionManager={this.props.extensionManager}
              onSelectActionTab={this.onSelectActionTab}
              client={this.client}
              getActiveViewportInfo={this.getActiveViewportInfo}
              />
            </div>
        )}
      </div>
    );
  }

  componentWillUnmount() {
    if (this._dsSubscription && this._dsSubscription.unsubscribe) {
      this._dsSubscription.unsubscribe();
    }
  }
}
