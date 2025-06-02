import React, { useState } from 'react';
import { Button, Icons, Modal, Select, Progress, Tooltip } from '../index';
import { Download, FileText, Image, Archive, Check, Loader2 } from 'lucide-react';

interface SeriesDownloadButtonProps {
  seriesInstanceUID: string;
  studyInstanceUID: string;
  seriesDescription?: string;
  modality?: string;
  onDownloadComplete?: (file: string) => void;
}

interface DownloadFormat {
  id: string;
  name: string;
  description: string;
  extension: string;
  icon: React.ComponentType<any>;
  orthanc_format: string;
}

const DOWNLOAD_FORMATS: DownloadFormat[] = [
  {
    id: 'dicom',
    name: 'DICOM-SEG',
    description: 'Standard DICOM segmentation format',
    extension: '.dcm',
    icon: FileText,
    orthanc_format: 'dicom'
  },
  {
    id: 'nifti',
    name: 'NIfTI',
    description: 'Neuroimaging format for research',
    extension: '.nii.gz',
    icon: Image,
    orthanc_format: 'nifti'
  },
  {
    id: 'zip',
    name: 'ZIP Archive',
    description: 'Compressed folder with all files',
    extension: '.zip',
    icon: Archive,
    orthanc_format: 'zip'
  }
];

export const SeriesDownloadButton: React.FC<SeriesDownloadButtonProps> = ({
  seriesInstanceUID,
  studyInstanceUID,
  seriesDescription = 'Medical Series',
  modality = 'SEG',
  onDownloadComplete
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<DownloadFormat>(DOWNLOAD_FORMATS[0]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadComplete, setDownloadComplete] = useState(false);

  const handleDownload = async () => {
    if (!selectedFormat) return;

    setIsDownloading(true);
    setDownloadProgress(0);

    try {
      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setDownloadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + Math.random() * 15;
        });
      }, 200);

      // Call Orthanc API for download
      const orthancUrl = process.env.REACT_APP_ORTHANC_URL || 'http://localhost:8042';
      const downloadUrl = `${orthancUrl}/series/${seriesInstanceUID}/archive?format=${selectedFormat.orthanc_format}`;
      
      const response = await fetch(downloadUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/octet-stream',
        },
      });

      if (!response.ok) {
        throw new Error(`Download failed: ${response.statusText}`);
      }

      // Create download blob
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      // Generate filename
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      const filename = `${seriesDescription}_${modality}_${timestamp}${selectedFormat.extension}`;
      
      // Trigger download
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      clearInterval(progressInterval);
      setDownloadProgress(100);
      setDownloadComplete(true);
      
      // Success notification
      setTimeout(() => {
        setIsModalOpen(false);
        setIsDownloading(false);
        setDownloadComplete(false);
        setDownloadProgress(0);
        onDownloadComplete?.(filename);
      }, 1500);

    } catch (error) {
      console.error('Download failed:', error);
      setIsDownloading(false);
      setDownloadProgress(0);
      // TODO: Show error notification
    }
  };

  const formatOptions = DOWNLOAD_FORMATS.map(format => ({
    value: format.id,
    label: (
      <div className="flex items-center gap-3">
        <format.icon className="w-4 h-4 text-blue-500" />
        <div>
          <div className="font-medium">{format.name}</div>
          <div className="text-xs text-gray-500">{format.description}</div>
        </div>
      </div>
    )
  }));

  return (
    <>
      <Tooltip content="Download medical imaging series" position="top">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsModalOpen(true)}
          className="opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-blue-50 hover:text-blue-600 p-2 rounded-md"
        >
          <Download className="w-4 h-4" />
        </Button>
      </Tooltip>

      <Modal
        isOpen={isModalOpen}
        onClose={() => !isDownloading && setIsModalOpen(false)}
        title="Download Medical Series"
        size="md"
      >
        <div className="space-y-6">
          {/* Series Information */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-2">Series Details</h3>
            <div className="space-y-1 text-sm">
              <div><span className="font-medium">Description:</span> {seriesDescription}</div>
              <div><span className="font-medium">Modality:</span> {modality}</div>
              <div><span className="font-medium">Series ID:</span> {seriesInstanceUID.slice(0, 20)}...</div>
            </div>
          </div>

          {/* Format Selection */}
          {!isDownloading && !downloadComplete && (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">
                Select Download Format
              </label>
              <Select
                value={selectedFormat.id}
                onChange={(value) => {
                  const format = DOWNLOAD_FORMATS.find(f => f.id === value);
                  if (format) setSelectedFormat(format);
                }}
                options={formatOptions}
                className="w-full"
              />
              <div className="text-xs text-gray-500">
                Files will be downloaded in {selectedFormat.name} format ({selectedFormat.extension})
              </div>
            </div>
          )}

          {/* Download Progress */}
          {isDownloading && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                <span className="text-sm font-medium">Preparing download...</span>
              </div>
              <Progress value={downloadProgress} className="w-full" />
              <div className="text-xs text-gray-500 text-center">
                {downloadProgress < 100 ? `${Math.round(downloadProgress)}% complete` : 'Finalizing...'}
              </div>
            </div>
          )}

          {/* Success State */}
          {downloadComplete && (
            <div className="text-center space-y-3">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <Check className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold text-green-900">Download Complete!</h3>
                <p className="text-sm text-gray-600">Your medical imaging file has been downloaded successfully.</p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 justify-end pt-4">
            <Button
              variant="ghost"
              onClick={() => setIsModalOpen(false)}
              disabled={isDownloading}
            >
              {downloadComplete ? 'Close' : 'Cancel'}
            </Button>
            {!isDownloading && !downloadComplete && (
              <Button
                onClick={handleDownload}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Download className="w-4 h-4 mr-2" />
                Download {selectedFormat.name}
              </Button>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}; 