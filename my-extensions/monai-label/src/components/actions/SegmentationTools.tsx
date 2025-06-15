// @ts-nocheck
import React from 'react';
import BaseTab from './BaseTab';
import { Toolbox, Button } from '@ohif/ui-next';
import { PanelSegmentation } from '@ohif/extension-cornerstone';

export default class SegmentationTools extends BaseTab {
  constructor(props) {
    super(props);
    this.state = {
      training: false,
      selectedModel: 'segmentation', // Default model for training
      saving: false,
    };
  }

  onClickSaveToMONAI = async () => {
    const { segmentationService } = this.props.servicesManager.services;
    const { viewport, displaySet } = this.props.getActiveViewportInfo();
    
    if (!viewport || !displaySet) {
      this.notification.show({
        title: 'MONAI Label',
        message: 'No active viewport or display set found',
        type: 'error',
        duration: 3000,
      });
      return;
    }

    this.setState({ saving: true });
    
    const nid = this.notification.show({
      title: 'MONAI Label',
      message: 'Saving annotations to MONAI Label datastore...',
      type: 'info',
      duration: 60000,
    });

    try {
      // Get the segmentation data
      const volumeLoadObject = segmentationService.getLabelmapVolume('1');
      if (!volumeLoadObject) {
        throw new Error('No segmentation data found');
      }

      const { voxelManager } = volumeLoadObject;
      const scalarData = voxelManager?.getCompleteScalarDataArray();
      
      if (!scalarData) {
        throw new Error('No segmentation scalar data found');
      }

      // Convert to binary data for MONAI Label (keep as Uint8Array, not Blob)
      const labelData = new Uint8Array(scalarData);
      
      // Use the known MONAI Label image ID from datastore
      const imageId = "1.2.840.113704.1.111.13428.1678779145.31";
      
      // Save to MONAI Label datastore
      const response = await this.props.client().save_label(
        imageId,
        labelData,
        {
          label_info: {
            name: `segmentation_${Date.now()}`,
            description: 'Segmentation saved from OHIF',
            timestamp: new Date().toISOString(),
          }
        }
      );

      if (!nid) {
        window.snackbar.hideAll();
      } else {
        this.notification.hide(nid);
      }

      if (response.status !== 200) {
        throw new Error(`Failed to save: ${response.statusText || 'Unknown error'}`);
      }

      this.notification.show({
        title: 'MONAI Label',
        message: 'Annotations saved to MONAI Label successfully! Ready for training.',
        type: 'success',
        duration: 5000,
      });

    } catch (error) {
      console.error('Save to MONAI failed:', error);
      
      if (!nid) {
        window.snackbar.hideAll();
      } else {
        this.notification.hide(nid);
      }
      
      this.notification.show({
        title: 'MONAI Label',
        message: `Failed to save annotations: ${error.message}`,
        type: 'error',
        duration: 5000,
      });
    } finally {
      this.setState({ saving: false });
    }
  };

  onClickUpdateModel = async () => {
    const training = this.state.training;
    console.debug('Current training status: ' + training);
    
    const nid = this.notification.show({
      title: 'MONAI Label',
      message: training ? 'Stopping model training...' : 'Starting model training from annotations...',
      type: 'info',
      duration: 60000,
    });

    const response = training
      ? await this.props.client().stop_train()
      : await this.props.client().run_train({
          model: this.state.selectedModel,
          max_epochs: 10, // Reduced for faster training
          val_split: 0.2,
          train_batch_size: 1,
          val_batch_size: 1,
        });

    if (!nid) {
      window.snackbar.hideAll();
    } else {
      this.notification.hide(nid);
    }

    if (response.status !== 200) {
      this.notification.show({
        title: 'MONAI Label',
        message: 'Failed to ' + (training ? 'STOP' : 'START') + ' training',
        type: 'error',
        duration: 5000,
      });
    } else {
      this.notification.show({
        title: 'MONAI Label',
        message: 'Model training ' + (training ? 'STOPPED' : 'STARTED') + ' successfully',
        type: 'success',
        duration: 3000,
      });
      this.setState({ training: !training });
    }
  };

  onChangeModel = (event) => {
    this.setState({ selectedModel: event.target.value });
  };

  async componentDidMount() {
    // Check if training is already running
    try {
      const training = await this.props.client().is_train_running();
      this.setState({ training: training });
    } catch (error) {
      console.warn('Could not check training status:', error);
    }
  }

  render() {
    const availableModels = [
      { value: 'segmentation', label: 'General Segmentation' },
      { value: 'segmentation_spleen', label: 'Spleen Segmentation' },
      { value: 'segmentation_vertebra', label: 'Vertebra Segmentation' },
      { value: 'deepedit', label: 'DeepEdit' },
      { value: 'deepgrow_3d', label: 'DeepGrow 3D' },
    ];

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
          {/* AI Tools */}
          <div className="flex gap-2 mb-3">
            <Button size="sm" variant="ghost" onClick={this.props.runAutoSegmentation}>
              AI Segment
            </Button>
            <Button size="sm" variant="ghost" onClick={this.props.revert}>
              Revert
            </Button>
          </div>

          {/* Save to MONAI Section */}
          <div className="mb-4 p-3 border border-green-600 rounded">
            <h4 className="text-sm font-semibold mb-2 text-white">Save for Training</h4>
            <p className="text-xs text-gray-300 mb-2">
              Save current annotations to MONAI Label datastore for model training
            </p>
            <Button
              size="sm"
              variant="primary"
              onClick={this.onClickSaveToMONAI}
              disabled={this.state.saving}
              className="w-full mb-2"
            >
              {this.state.saving ? 'Saving...' : 'Save to MONAI'}
            </Button>
            <p className="text-xs text-yellow-400">
              💡 Save annotations first, then train model below
            </p>
          </div>

          {/* Model Training Section */}
          <div className="mb-4 p-3 border border-gray-600 rounded">
            <h4 className="text-sm font-semibold mb-2 text-white">Model Training</h4>
            <div className="mb-2">
              <label className="text-xs text-gray-300 block mb-1">Select Model:</label>
              <select
                className="actionInput w-full text-xs"
                value={this.state.selectedModel}
                onChange={this.onChangeModel}
                style={{ fontSize: '12px', padding: '4px' }}
              >
                {availableModels.map((model) => (
                  <option key={model.value} value={model.value}>
                    {model.label}
                  </option>
                ))}
              </select>
            </div>
            <Button
              size="sm"
              variant={this.state.training ? "destructive" : "primary"}
              onClick={this.onClickUpdateModel}
              className="w-full"
            >
              {this.state.training ? 'Stop Training' : 'Train from Annotations'}
            </Button>
            {this.state.training && (
              <p className="text-xs text-yellow-400 mt-1">
                Training in progress... Check server logs for details.
              </p>
            )}
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