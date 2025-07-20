import React, { useState } from 'react';
import { Button } from '../Button';
import { Icons } from '../Icons';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../DropdownMenu';
import { TooltipTrigger, TooltipContent, Tooltip } from '../Tooltip';
import { toast } from '../Sonner';

interface SeriesDownloadButtonProps {
  seriesInstanceUID: string;
  studyInstanceUID?: string;
  seriesDescription?: string;
  modality?: string;
  onDownloadComplete?: (file: string) => void;
  className?: string;
}

interface DownloadFormat {
  id: string;
  name: string;
  description: string;
  extension: string;
}

const DOWNLOAD_FORMATS: DownloadFormat[] = [
  {
    id: 'dicom',
    name: 'DICOM-SEG',
    description: 'Standard DICOM segmentation format',
    extension: '.dcm',
  },
  {
    id: 'nifti',
    name: 'NIfTI',
    description: 'Research format (.nii.gz)',
    extension: '.nii.gz',
  },
  {
    id: 'zip',
    name: 'ZIP Archive',
    description: 'Compressed folder with all files',
    extension: '.zip',
  },
];

export const SeriesDownloadButton: React.FC<SeriesDownloadButtonProps> = ({
  seriesInstanceUID,
  studyInstanceUID = '',
  seriesDescription = 'Medical Series',
  modality = 'SEG',
  onDownloadComplete,
  className = '',
}) => {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async (format: DownloadFormat) => {
    if (isDownloading) return;

    setIsDownloading(true);

    try {
      // Call Orthanc API for download - hardcode production URL
      const orthancUrl = 'https://mediflow-latn.duckdns.org/datasource';
      const downloadUrl = `${orthancUrl}/series/${seriesInstanceUID}/archive`;

      const response = await fetch(downloadUrl, {
        method: 'GET',
        headers: {
          Accept: 'application/octet-stream',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Create download blob
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      // Generate filename
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      const cleanDescription = seriesDescription.replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `${cleanDescription}_${modality}_${timestamp}${format.extension}`;

      // Trigger download
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      onDownloadComplete?.(filename);

      // Success notification
      toast.success('Download Complete', {
        description: `Successfully downloaded: ${filename}`,
        duration: 4000,
      });
    } catch (error) {
      console.error('❌ Download failed:', error);
      // TODO: Use OHIF notification service instead of alert
      const errorMsg = error.message || 'Unknown error occurred';
      console.error(`Download failed: ${errorMsg}`);

      // Show error toast
      toast.error('Download Failed', {
        description: errorMsg,
        duration: 6000,
      });
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className={className}>
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="rounded-md p-2 opacity-0 transition-all duration-200 hover:bg-blue-50 hover:text-blue-600 group-hover:opacity-100"
                disabled={isDownloading}
              >
                {isDownloading ? (
                  <Icons.LoadingSpinner className="h-4 w-4 animate-spin" />
                ) : (
                  <Icons.Download className="h-4 w-4" />
                )}
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="top">
            <div className="flex flex-col">
              <span className="font-semibold text-white">Download Medical Series</span>
              <span className="text-sm text-gray-300">
                {seriesDescription} • {modality}
              </span>
            </div>
          </TooltipContent>
        </Tooltip>

        <DropdownMenuContent
          hideWhenDetached
          align="start"
          className="w-56"
        >
          <div className="border-b px-2 py-1.5 text-xs font-medium text-gray-500">
            📥 Download Format
          </div>
          {DOWNLOAD_FORMATS.map(format => (
            <DropdownMenuItem
              key={format.id}
              onSelect={() => handleDownload(format)}
              className="gap-3 py-2"
              disabled={isDownloading}
            >
              <div className="flex flex-col">
                <div className="font-medium">{format.name}</div>
                <div className="text-xs text-gray-500">{format.description}</div>
              </div>
            </DropdownMenuItem>
          ))}

          <div className="border-t px-2 py-1.5 text-xs text-gray-400">
            🏥 Series: {seriesInstanceUID.slice(0, 20)}...
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
