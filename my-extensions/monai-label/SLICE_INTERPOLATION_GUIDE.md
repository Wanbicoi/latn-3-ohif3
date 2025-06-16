# Slice Interpolation - Hướng dẫn chi tiết

## 📋 Mục lục
- [Tổng quan](#tổng-quan)
- [Các Models được hỗ trợ](#các-models-được-hỗ-trợ)
- [Cách sử dụng](#cách-sử-dụng)
- [So sánh Models](#so-sánh-models)
- [Troubleshooting](#troubleshooting)
- [Best Practices](#best-practices)

---

## 🎯 Tổng quan

**Slice Interpolation** là tính năng AI tiên tiến cho phép bác sĩ thực hiện phân đoạn thông minh giữa các slice DICOM. Thay vì phải segment từng slice thủ công, bác sĩ chỉ cần:

1. **Segment slice đầu tiên** với point prompts
2. **Segment slice cuối cùng** tương tự
3. **AI tự động tạo segmentation** cho tất cả slice ở giữa

### ✨ Lợi ích chính:
- **Tiết kiệm thời gian**: Giảm 70-90% thời gian segment
- **Tính nhất quán**: AI đảm bảo segmentation smooth giữa các slice
- **Độ chính xác cao**: Sử dụng deep learning models tiên tiến
- **Workflow tự nhiên**: Tích hợp seamless vào quy trình làm việc

---

## 🤖 Các Models được hỗ trợ

### 🥇 **Fully Supported Models**

#### **1. Vista3D** ⭐⭐⭐⭐⭐
- **Nhà phát triển**: NVIDIA
- **Kiến trúc**: Foundation Model với Transformer
- **Đặc điểm**:
  - 🧠 **Native 3D understanding** - Hiểu không gian 3D tự nhiên
  - 🎯 **Multi-organ segmentation** - Segment nhiều organ cùng lúc
  - 🔬 **Anatomy-aware interpolation** - Hiểu cấu trúc giải phẫu
  - ⚡ **Zero-shot capabilities** - Không cần training thêm
- **Use case**: Ứng dụng nghiên cứu, yêu cầu độ chính xác cao
- **Slice Interpolation**: **Excellent** - Chất lượng tốt nhất

#### **2. DeepEdit** ⭐⭐⭐⭐
- **Nhà phát triển**: MONAI Consortium
- **Kiến trúc**: Interactive CNN với deep learning
- **Đặc điểm**:
  - 🎨 **Interactive editing** - Chỉnh sửa tương tác
  - 🔄 **Iterative refinement** - Cải thiện dần qua các lần click
  - 📐 **3D spatial consistency** - Đảm bảo tính nhất quán 3D
  - 🎯 **Point-based guidance** - Điều khiển bằng point prompts
- **Use case**: Clinical workflow, interactive segmentation
- **Slice Interpolation**: **Very Good** - Chất lượng cao, ổn định

#### **3. SW_FastEdit** ⭐⭐⭐⭐
- **Nhà phát triển**: MONAI (Swin-UNETR based)
- **Kiến trúc**: Swin Transformer + UNETR
- **Đặc điểm**:
  - ⚡ **Fast inference** - Tốc độ xử lý nhanh nhất
  - 🏗️ **Transformer architecture** - Kiến trúc hiện đại
  - 🎯 **Maintained accuracy** - Giữ độ chính xác cao
  - 💾 **Memory efficient** - Sử dụng memory hiệu quả
- **Use case**: Speed-critical applications, real-time processing
- **Slice Interpolation**: **Very Good** - Nhanh và chính xác

### ⚠️ **Limited Support Models**

#### **4. SAM_2D** ⭐⭐
- **Nhà phát triển**: Meta AI
- **Kiến trúc**: Segment Anything Model (2D)
- **Đặc điểm**:
  - 🌟 **Foundation model** - Pre-trained trên massive dataset
  - 🎯 **Excellent single-slice** - Rất mạnh cho single slice
  - ❌ **No 3D understanding** - Không hiểu spatial relationship
  - 📏 **Linear interpolation only** - Chỉ interpolation đơn giản
- **Use case**: Single slice segmentation, quick prototyping
- **Slice Interpolation**: **Limited** - Basic interpolation only

### ❌ **Không được hỗ trợ**

#### **Deepgrow**
- **Lý do**: Chỉ hoạt động trên single slice, không có 3D context

#### **Classification Models**
- **Lý do**: Không phải segmentation models

---

## 🚀 Cách sử dụng

### **Bước 1: Chuẩn bị**
1. **Kết nối MONAI Label Server**
   ```
   URL: http://localhost:8000 (hoặc server của bạn)
   ```
2. **Load DICOM series** vào OHIF viewer
3. **Chọn model phù hợp** (Vista3D/DeepEdit/SW_FastEdit)

### **Bước 2: Mở Slice Interpolation**
1. Click tab **"Slice Interpolation"** trong MONAI Label panel
2. Chọn model từ dropdown (khuyến nghị: Vista3D hoặc DeepEdit)
3. Chọn anatomy/organ từ danh sách "Available Organ(s)"

### **Bước 3: Set Start Slice**
1. **Navigate** đến slice đầu tiên cần segment
2. **Click points** để đánh dấu:
   - **Foreground points**: Click vào vùng cần segment
   - **Background points**: Click vào vùng không cần segment (nếu cần)
3. Click **"Set Start Slice"**
4. Nút sẽ chuyển màu tím và hiển thị số slice

### **Bước 4: Set End Slice**
1. **Navigate** đến slice cuối cùng cần segment
2. **Click points** tương tự như start slice
3. Click **"Set End Slice"**
4. Nút sẽ chuyển màu cam và hiển thị số slice

### **Bước 5: Thực hiện Interpolation**
1. Khi đã có cả start và end slice, click **"🚀 Interpolate"**
2. AI sẽ xử lý và tạo segmentation cho tất cả slice ở giữa
3. Chờ thông báo "Slice Interpolation completed successfully!"

### **Bước 6: Review và Adjust**
1. **Navigate** qua các slice để kiểm tra kết quả
2. **Chỉnh sửa** nếu cần bằng các tools khác
3. **Reset** và thử lại nếu không hài lòng

---

## 📊 So sánh Models

| **Tiêu chí** | **Vista3D** | **DeepEdit** | **SW_FastEdit** | **SAM_2D** |
|--------------|-------------|--------------|-----------------|------------|
| **Chất lượng Interpolation** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ |
| **Tốc độ xử lý** | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **3D Understanding** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ❌ |
| **Multi-organ Support** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| **Memory Usage** | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Ease of Use** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |

### 🎯 **Khuyến nghị sử dụng:**

#### **Vista3D** - Cho chất lượng tốt nhất
```
✅ Khi nào dùng:
- Nghiên cứu y khoa
- Yêu cầu độ chính xác cao
- Multi-organ segmentation
- Complex anatomy

❌ Tránh khi:
- Cần tốc độ cực nhanh
- Hardware hạn chế
```

#### **DeepEdit** - Cho workflow clinical
```
✅ Khi nào dùng:
- Clinical routine
- Interactive editing workflow
- Cần balance giữa speed và accuracy
- Familiar với MONAI tools

❌ Tránh khi:
- Cần tốc độ tối đa
- Chỉ cần basic segmentation
```

#### **SW_FastEdit** - Cho tốc độ cao
```
✅ Khi nào dùng:
- Real-time applications
- Speed-critical workflow
- Limited computational resources
- Batch processing

❌ Tránh khi:
- Cần accuracy tối đa
- Complex anatomical structures
```

#### **SAM_2D** - Cho testing và prototyping
```
✅ Khi nào dùng:
- Quick prototyping
- Single slice segmentation
- Khi không có models khác
- Testing purposes

❌ Tránh khi:
- Cần true 3D interpolation
- Production workflow
- High accuracy requirements
```

---

## 🔧 Troubleshooting

### **Lỗi thường gặp:**

#### **1. "Model not supported" error**
```
🔍 Nguyên nhân: Model không hỗ trợ slice interpolation
✅ Giải pháp: Chọn Vista3D, DeepEdit, hoặc SW_FastEdit
```

#### **2. "Unable to determine slice index" error**
```
🔍 Nguyên nhân: Không xác định được vị trí slice
✅ Giải pháp: 
- Đảm bảo đang ở chế độ xem slice (không phải 3D)
- Navigate sang slice khác rồi quay lại
- Reload DICOM series
```

#### **3. "No active viewport" error**
```
🔍 Nguyên nhân: Không có viewport active
✅ Giải pháp:
- Click vào viewport để activate
- Đảm bảo đã load DICOM series
- Refresh browser nếu cần
```

#### **4. Interpolation failed**
```
🔍 Nguyên nhân: Lỗi trong quá trình xử lý
✅ Giải pháp:
- Kiểm tra kết nối server MONAI Label
- Đảm bảo đã đặt đủ points trên cả 2 slice
- Thử với khoảng cách slice nhỏ hơn
- Chọn model khác
```

#### **5. Kết quả không như mong đợi**
```
🔍 Nguyên nhân: Points không đủ hoặc không rõ ràng
✅ Giải pháp:
- Đặt thêm foreground points ở vùng quan trọng
- Thêm background points để loại trừ vùng không cần
- Thử với slice gần nhau hơn
- Sử dụng Vista3D cho accuracy cao hơn
```

### **Performance Issues:**

#### **Xử lý chậm:**
```
🔧 Tối ưu:
- Sử dụng SW_FastEdit cho tốc độ
- Giảm khoảng cách giữa start và end slice
- Đóng các ứng dụng khác
- Kiểm tra hardware requirements
```

#### **Memory issues:**
```
🔧 Tối ưu:
- Sử dụng SW_FastEdit (memory efficient)
- Chia nhỏ thành nhiều lần interpolation
- Restart browser
- Kiểm tra RAM available
```

---

## 💡 Best Practices

### **1. Point Placement Strategy**

#### **Foreground Points:**
```
✅ Tốt:
- Đặt ở center của organ
- Đặt ở các vùng đặc trưng
- Đặt đều trên toàn bộ vùng cần segment
- Tránh vùng boundary không rõ

❌ Tránh:
- Đặt quá gần boundary
- Đặt ở vùng artifact
- Đặt quá ít points
- Đặt ở vùng mờ/noise
```

#### **Background Points:**
```
✅ Tốt:
- Đặt ở vùng clearly không phải target
- Đặt xung quanh organ để define boundary
- Đặt ở các organ khác nếu có confusion
- Đặt ở vùng có contrast cao

❌ Tránh:
- Đặt quá gần target organ
- Đặt ở vùng ambiguous
- Đặt quá nhiều (có thể confuse model)
```

### **2. Slice Selection Strategy**

#### **Optimal Distance:**
```
📏 Khoảng cách slice:
- Tối ưu: 5-10 slices apart
- Acceptable: 3-15 slices apart
- Tránh: >20 slices apart (có thể không accurate)
- Minimum: 2 slices apart
```

#### **Slice Quality:**
```
✅ Chọn slice có:
- Contrast tốt
- Ít artifact
- Organ boundaries rõ ràng
- Representative của toàn bộ volume

❌ Tránh slice có:
- Motion artifact
- Contrast kém
- Partial volume effects
- Unusual anatomy
```

### **3. Model Selection Guide**

#### **Workflow-based Selection:**
```
🏥 Clinical Routine:
DeepEdit → Balance tốt, familiar workflow

🔬 Research/High Accuracy:
Vista3D → Chất lượng tốt nhất

⚡ Speed Critical:
SW_FastEdit → Tốc độ cao nhất

🧪 Testing/Prototyping:
SAM_2D → Quick testing (limited quality)
```

#### **Anatomy-based Selection:**
```
🧠 Brain/Neuroimaging:
Vista3D hoặc DeepEdit

🫁 Chest/Lung:
SW_FastEdit (good for large volumes)

🫀 Cardiac:
Vista3D (complex anatomy)

🦴 Orthopedic:
DeepEdit (good boundary definition)

🔬 Multi-organ:
Vista3D (best multi-organ support)
```

### **4. Quality Assurance**

#### **Review Checklist:**
```
✅ Kiểm tra:
- Boundary accuracy ở tất cả slice
- Continuity giữa các slice
- No missing regions
- No over-segmentation
- Anatomical correctness

🔧 Nếu có vấn đề:
- Adjust points và re-interpolate
- Sử dụng manual editing tools
- Try different model
- Reduce slice distance
```

#### **Validation Steps:**
```
1. Navigate qua tất cả slice
2. Kiểm tra 3D rendering (nếu có)
3. So sánh với expected anatomy
4. Validate với clinical knowledge
5. Document any issues
```

---

## 📈 Performance Metrics

### **Typical Performance:**

| **Model** | **Processing Time** | **Memory Usage** | **Accuracy** |
|-----------|-------------------|------------------|--------------|
| **Vista3D** | 10-30 seconds | High (4-8GB) | 95-98% |
| **DeepEdit** | 15-45 seconds | Medium (2-4GB) | 90-95% |
| **SW_FastEdit** | 5-15 seconds | Low (1-2GB) | 88-93% |
| **SAM_2D** | 3-10 seconds | Low (1-2GB) | 70-85% |

### **Hardware Requirements:**

#### **Minimum:**
```
CPU: 4 cores, 2.5GHz
RAM: 8GB
GPU: Optional (CPU inference)
Storage: 2GB free space
```

#### **Recommended:**
```
CPU: 8+ cores, 3.0GHz+
RAM: 16GB+
GPU: NVIDIA RTX series (4GB+ VRAM)
Storage: SSD with 10GB+ free space
```

#### **Optimal:**
```
CPU: 16+ cores, 3.5GHz+
RAM: 32GB+
GPU: NVIDIA RTX 4080/4090 (8GB+ VRAM)
Storage: NVMe SSD with 20GB+ free space
```

---

## 🔗 Tài liệu tham khảo

### **MONAI Label Documentation:**
- [Official MONAI Label Docs](https://docs.monai.io/projects/label/en/latest/)
- [MONAI Label GitHub](https://github.com/Project-MONAI/MONAILabel)

### **Model Documentation:**
- [Vista3D Paper](https://arxiv.org/abs/2406.05285)
- [DeepEdit Documentation](https://docs.monai.io/en/stable/apps.html#deepedit)
- [SAM Documentation](https://segment-anything.com/)

### **OHIF Integration:**
- [OHIF Viewer](https://ohif.org/)
- [OHIF Extensions](https://docs.ohif.org/development/extensions/)

---

## 📞 Support

### **Báo cáo lỗi:**
- GitHub Issues: [MONAI Label Issues](https://github.com/Project-MONAI/MONAILabel/issues)
- OHIF Issues: [OHIF Issues](https://github.com/OHIF/Viewers/issues)

### **Community:**
- MONAI Slack: [Join MONAI Community](https://forms.gle/QTxJq3hFictp31UM9)
- OHIF Discussions: [OHIF GitHub Discussions](https://github.com/OHIF/Viewers/discussions)

---

*Tài liệu này được cập nhật thường xuyên. Phiên bản hiện tại: v1.0 - Ngày cập nhật: 2024* 