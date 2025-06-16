# Slice Interpolation Feature

## Tổng quan
Tính năng **Slice Interpolation** cho phép bác sĩ thực hiện phân đoạn thông minh giữa các slice bằng cách sử dụng AI để tự động dự đoán và tạo segmentation cho các slice ở giữa.

## Cách sử dụng

### Bước 1: Kết nối MONAI Label Server
1. Nhập URL server MONAI Label (mặc định: `http://localhost:8000`)
2. Nhấn **Connect** để kết nối

### Bước 2: Chọn Model phù hợp
- Chỉ hỗ trợ **DeepEdit** hoặc **Vista3D** models
- Các model khác sẽ không hiển thị tab Slice Interpolation

### Bước 3: Thực hiện Slice Interpolation

#### 3.1 Chọn Anatomy/Organ
- Từ danh sách "Available Organ(s)", chọn organ cần phân đoạn
- **Lưu ý**: Không chọn "background"

#### 3.2 Đặt Start Slice
1. Navigate đến slice đầu tiên cần phân đoạn
2. Click để đặt foreground/background points trên slice
3. Nhấn **"Set Start Slice"** 
4. Nút sẽ chuyển màu xanh lá và hiển thị số slice

#### 3.3 Đặt End Slice  
1. Navigate đến slice cuối cần phân đoạn
2. Click để đặt points tương tự như start slice
3. Nhấn **"Set End Slice"**
4. Nút sẽ chuyển màu cam và hiển thị số slice

#### 3.4 Thực hiện Interpolation
1. Khi đã có cả start và end slice, nhấn **"🚀 Interpolate"**
2. AI sẽ tự động tạo segmentation cho tất cả slice ở giữa
3. Quá trình hoàn tất khi thấy thông báo "Slice Interpolation completed successfully!"

### Bước 4: Reset (nếu cần)
- Nhấn **"🔄 Reset"** để xóa start/end slice và bắt đầu lại

## Tính năng UI

### Scroll Support
- Container có scroll để xem được toàn bộ nội dung
- Organs list có scroll riêng khi danh sách dài

### Dismiss "No SEG Series" Notification
- Thông báo "No SEG Series" có nút **X** để tắt
- Trạng thái tắt được lưu trong localStorage
- Không hiển thị lại cho đến khi clear browser data

### Visual Feedback
- **Start Slice**: Nút màu tím khi active
- **End Slice**: Nút màu cam khi active  
- **Status**: Hiển thị "Ready to interpolate from slice X to Y"
- **Progress**: Nút "Interpolate" hiển thị "🔄 Interpolating..." khi đang xử lý

## Lưu ý kỹ thuật

### Model Requirements
- **DeepEdit**: Hỗ trợ đầy đủ slice interpolation
- **Vista3D**: Hỗ trợ với point prompts
- **Deepgrow**: Không hỗ trợ (chỉ single slice)

### API Parameters
```javascript
{
  slice_interpolation: true,
  start_slice: <number>,
  end_slice: <number>,
  // + model-specific parameters
}
```

### Error Handling
- Validation đầy đủ trước khi gửi request
- Thông báo lỗi rõ ràng cho user
- Tự động cleanup khi có lỗi

## Troubleshooting

### "No active viewport" error
- Đảm bảo đã load DICOM series
- Kiểm tra viewport đang active

### "Model not supported" error  
- Chỉ sử dụng DeepEdit hoặc Vista3D models
- Kiểm tra server MONAI Label có model phù hợp

### "Unable to determine slice index" error
- Đảm bảo đang ở chế độ xem slice (không phải 3D)
- Thử navigate sang slice khác rồi quay lại

### Interpolation failed
- Kiểm tra kết nối server
- Đảm bảo đã đặt đủ points trên cả 2 slice
- Thử với khoảng cách slice nhỏ hơn

## Performance Tips

1. **Khoảng cách slice**: Tốt nhất là 5-10 slice giữa start và end
2. **Point quality**: Đặt points rõ ràng, tránh vùng mờ
3. **Model selection**: Vista3D thường nhanh hơn DeepEdit
4. **Memory**: Với volume lớn, chia nhỏ thành nhiều lần interpolation

---

*Tính năng này được phát triển để tăng tốc độ phân đoạn y tế, giúp bác sĩ tiết kiệm thời gian đáng kể so với việc phân đoạn từng slice thủ công.* 