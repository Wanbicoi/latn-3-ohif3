# 📥 Medical Series Download System

## 🎯 Overview

This system provides an elegant download experience for medical imaging series, specifically designed for doctors and medical professionals. The download feature integrates seamlessly into the existing Studies Panel with sophisticated UX patterns.

## ✨ Key Features

### 🔧 **Technical Features:**
- **Multi-format support**: DICOM-SEG, NIfTI, ZIP
- **Orthanc integration**: Direct API calls to PACS server
- **Progress indication**: Real-time download status
- **Error handling**: Graceful failure management
- **TypeScript support**: Full type safety

### 🎨 **UX Features:**
- **Hover reveal**: Download button appears on series hover
- **Format selection**: Dropdown with format descriptions
- **Visual feedback**: Loading states and success indicators
- **Responsive design**: Works on desktop and mobile
- **Accessibility**: Screen reader support and keyboard navigation

## 🚀 Quick Start

### 1. **Basic Integration**

```tsx
import { SeriesDownloadButton } from './SegmentationTable/SeriesDownloadButton';

// In your Series component
<div className="group series-item">
  {/* Series info */}
  <div className="series-details">
    <h3>{seriesDescription}</h3>
    <span>{modality} • S:{seriesNumber}</span>
  </div>
  
  {/* Download button - appears on hover */}
  <SeriesDownloadButton
    seriesInstanceUID={seriesInstanceUID}
    studyInstanceUID={studyInstanceUID}
    seriesDescription={seriesDescription}
    modality={modality}
    onDownloadComplete={(filename) => {
      console.log('Downloaded:', filename);
      showToast('Download completed successfully!');
    }}
  />
</div>
```

### 2. **Studies Panel Integration**

For the left sidebar Studies panel, add to `Thumbnail.tsx`:

```tsx
// Add to the dropdown menu section
{modality === 'SEG' && (
  <DropdownMenuItem
    onSelect={() => {/* trigger download */}}
    className="gap-[6px]"
  >
    <Icons.Download />
    Download Series
  </DropdownMenuItem>
)}
```

### 3. **Environment Setup**

Add to your `.env` file:
```bash
REACT_APP_ORTHANC_URL=http://localhost:8042
```

## 📋 API Reference

### SeriesDownloadButton Props

```typescript
interface SeriesDownloadButtonProps {
  seriesInstanceUID: string;        // Required - Series to download
  studyInstanceUID?: string;        // Optional - Parent study ID
  seriesDescription?: string;       // Optional - Display name
  modality?: string;               // Optional - Modality type (SEG, CT, etc.)
  onDownloadComplete?: (file: string) => void; // Optional - Success callback
  className?: string;              // Optional - CSS classes
}
```

### Download Formats

```typescript
const DOWNLOAD_FORMATS = [
  {
    id: 'dicom',
    name: 'DICOM-SEG',
    description: 'Standard DICOM segmentation format',
    extension: '.dcm'
  },
  {
    id: 'nifti',
    name: 'NIfTI', 
    description: 'Research format (.nii.gz)',
    extension: '.nii.gz'
  },
  {
    id: 'zip',
    name: 'ZIP Archive',
    description: 'Compressed folder with all files',
    extension: '.zip'
  }
];
```

## 🏥 Medical Workflow Integration

### **Typical Doctor Workflow:**

1. **Browse Studies** → Doctor opens patient studies in left panel
2. **Identify Series** → Finds relevant SEG/analysis series
3. **Hover & Download** → Hovers over series, download button appears  
4. **Select Format** → Chooses appropriate format (DICOM for clinical, NIfTI for research)
5. **Download** → File downloads with descriptive filename
6. **Use Externally** → Opens in external software (3D Slicer, OsiriX, etc.)

### **Filename Convention:**
```
{SeriesDescription}_{Modality}_{Timestamp}.{Extension}

Examples:
- SEG_Vertebra_Detection_SEG_2024-01-15T10-30-45.dcm
- Liver_Segmentation_SEG_2024-01-15T10-31-20.nii.gz
- Heart_Analysis_SEG_2024-01-15T10-32-15.zip
```

## 🔧 Orthanc API Integration

### **Download Endpoint:**
```
GET /series/{seriesInstanceUID}/archive
```

### **Response:**
- **Content-Type**: `application/octet-stream`
- **Content-Disposition**: `attachment; filename=archive.zip`

### **Error Handling:**
```typescript
try {
  const response = await fetch(downloadUrl);
  if (!response.ok) {
    throw new Error(`Download failed: ${response.statusText}`);
  }
  // Handle successful download
} catch (error) {
  console.error('Download failed:', error);
  showErrorNotification(error.message);
}
```

## 🎨 Styling Guide

### **CSS Classes Used:**
```css
.group                    // Hover group container
.opacity-0               // Hidden by default
.group-hover:opacity-100 // Visible on group hover
.transition-all          // Smooth transitions
.hover:bg-blue-50        // Hover background
.animate-spin            // Loading spinner
```

### **Color Scheme:**
- **Primary**: Blue (#3B82F6) - Download buttons
- **Success**: Green (#10B981) - Completion states  
- **Warning**: Orange (#F59E0B) - Loading states
- **Error**: Red (#EF4444) - Error states
- **Neutral**: Gray (#6B7280) - Secondary text

## 📱 Responsive Design

### **Desktop (>= 768px):**
- Full button with icon and text
- Detailed tooltips
- Expanded dropdown menus

### **Mobile (< 768px):**
- Icon-only buttons
- Simplified tooltips
- Compact dropdown menus

## 🔒 Security Considerations

### **CORS Setup:**
Ensure Orthanc server allows CORS requests:
```json
{
  "RemoteAccessAllowed": true,
  "HttpsVerifyPeers": false,
  "HttpsCACertificates": ""
}
```

### **Authentication:**
If Orthanc requires auth, modify fetch headers:
```typescript
const response = await fetch(downloadUrl, {
  headers: {
    'Authorization': `Basic ${btoa(username + ':' + password)}`,
    'Accept': 'application/octet-stream'
  }
});
```

## 🐛 Troubleshooting

### **Common Issues:**

**1. CORS Errors:**
```
Access to fetch blocked by CORS policy
```
**Solution:** Configure Orthanc CORS or use proxy

**2. Network Timeouts:**
```
Failed to fetch
```
**Solution:** Check Orthanc server status and network connectivity

**3. Download Failed:**
```
Download failed: 404 Not Found
```
**Solution:** Verify seriesInstanceUID exists in Orthanc

### **Debug Mode:**
Add to component for debugging:
```typescript
const DEBUG = process.env.NODE_ENV === 'development';

if (DEBUG) {
  console.log('Download request:', {
    seriesInstanceUID,
    downloadUrl,
    format
  });
}
```

## 🚀 Future Enhancements

### **Phase 2 Features:**
- [ ] **Batch download**: Multiple series at once
- [ ] **Cloud storage**: Upload to AWS S3/Google Drive  
- [ ] **Format conversion**: Real-time DICOM ↔ NIfTI conversion
- [ ] **Progress tracking**: Detailed download progress
- [ ] **Download history**: Track previous downloads
- [ ] **Sharing**: Send download links to colleagues

### **Phase 3 Features:**
- [ ] **AI integration**: Auto-suggest optimal format
- [ ] **Version control**: Track series versions
- [ ] **Annotations**: Include annotations in downloads
- [ ] **Compression**: Smart compression options
- [ ] **Streaming**: Stream large files
- [ ] **Offline sync**: Offline download queue

## 💡 Best Practices

### **Performance:**
- Use React.memo for expensive renders
- Implement virtual scrolling for large series lists
- Cache download URLs for better UX

### **UX:**
- Always provide visual feedback
- Show estimated download time for large files
- Allow download cancellation
- Provide clear error messages

### **Code Quality:**
- Use TypeScript for type safety
- Implement proper error boundaries
- Add comprehensive tests
- Document all props and methods

---

**🏥 Built for medical professionals with ❤️** 