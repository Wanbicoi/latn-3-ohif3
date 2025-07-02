# 🧪 Test Guide: Series-Based Comments

## 📋 **Tổng quan**

Logic mới cho comment system:
- **OLD**: Comments theo `task_id` + `segment_id` + `series_instance_uid` 
- **NEW**: Comments theo `task_assignment_id` + `series_instance_uid` (không theo segment nữa)

## 🎯 **Logic mới**

### **1. URL Structure**
```
http://localhost:3001/ohif3/monai-label?StudyInstanceUIDs=1.2.840.113704.1.111.6904.1682663281.1&taskId=6514b2fe-0bb1-4e83-81c5-be624e3f3bed
```

- `taskId` = `task_assignment_id` trong database
- `StudyInstanceUIDs` = `series_instance_uid` 

### **2. Database Schema**
```sql
-- Table structure
public_v2._annotation_comments (
  id uuid PRIMARY KEY,
  task_assignment_id uuid NOT NULL,  -- Links to workflow task
  author_id uuid NOT NULL,           -- User who wrote comment
  comment text,                      -- Comment content
  series_instance_uid text,          -- 🆕 NEW: Which SEG image
  data jsonb DEFAULT '{}',           -- Extra metadata
  created_at timestamp
)
```

### **3. Comment Grouping**
- **Per Project**: Different projects = separate comment threads
- **Per Task Assignment**: Different task assignments = separate threads  
- **Per Series**: Different SEG images = separate comment boxes

## 🚀 **Cách Test**

### **Step 1: Setup Database**
```bash
# Đã hoàn thành - migration đã chạy
# Cột series_instance_uid đã được thêm vào _annotation_comments
```

### **Step 2: Test Component**
```bash
# Start OHIF
cd latn-3-ohif3
yarn dev

# Truy cập test page
http://localhost:3001/test-comments
```

### **Step 3: Test Scenarios**

#### **Scenario 1: Basic Comment Testing**
1. Mở test page: `http://localhost:3001/test-comments`
2. Dùng task assignment ID từ database: `421e1138-860a-41b0-9db4-ce5ea60088f`
3. Dùng series UID: `1.2.840.113704.1.111.6904.1682663281.1`
4. Add comment "Test comment 1"
5. Verify comment appears immediately
6. Check database for new record

#### **Scenario 2: Multiple Series Testing**
1. Same task assignment ID
2. Change series UID to: `1.2.840.113704.1.111.6904.1682663281.2`
3. Add comment "Test comment for series 2"
4. Verify this appears as separate thread
5. Switch back to first series UID
6. Verify first comment still there

#### **Scenario 3: OHIF Integration Testing**
1. Open OHIF with URL: `http://localhost:3001/ohif3/monai-label?StudyInstanceUIDs=1.2.840.113704.1.111.6904.1682663281.1&taskId=421e1138-860a-41b0-9db4-ce5ea60088f`
2. Look for FloatingSegmentationComments component
3. Test adding comments through OHIF UI
4. Verify comments persist and sync

### **Step 4: Database Verification**

#### **Check Comments**
```sql
SELECT 
  ac.*,
  u.full_name,
  ta.task_id,
  ta.status
FROM public_v2._annotation_comments ac
JOIN public_v2._users u ON ac.author_id = u.id  
JOIN public_v2._task_assignments ta ON ac.task_assignment_id = ta.id
ORDER BY ac.created_at DESC;
```

#### **Check Task Assignments**
```sql
SELECT 
  ta.id as assignment_id,
  ta.task_id,
  ta.status,
  t.project_id,
  p.name as project_name
FROM public_v2._task_assignments ta
JOIN public_v2._tasks t ON ta.task_id = t.id
JOIN public_v2._projects p ON t.project_id = p.id
ORDER BY ta.created_at DESC;
```

## 📊 **Expected Results**

### **✅ Success Criteria**
- [ ] Comments load for existing task assignments
- [ ] New comments save with correct `task_assignment_id` and `series_instance_uid`
- [ ] Different series show separate comment threads
- [ ] OHIF FloatingSegmentationComments works with URL parameters
- [ ] User information displays correctly in comments
- [ ] Real-time updates work (comments appear immediately)

### **🔍 Database Checks**
- [ ] `series_instance_uid` column populated correctly
- [ ] `task_assignment_id` links to valid workflow task
- [ ] `author_id` links to authenticated user
- [ ] Comments grouped by `task_assignment_id` + `series_instance_uid`

## 🐛 **Common Issues & Solutions**

### **Issue 1: "Missing task or series information in URL"**
**Cause**: URL doesn't have required parameters
**Solution**: Use format: `?taskId=<assignment_id>&StudyInstanceUIDs=<series_uid>`

### **Issue 2: "User not authenticated"**
**Cause**: Not logged into Supabase
**Solution**: Check browser console, login via Supabase auth

### **Issue 3: Comments not showing**
**Cause**: Invalid task assignment ID or series UID
**Solution**: Use existing IDs from database, check task_assignments table

### **Issue 4: Cannot add comments**
**Cause**: Database permissions or invalid foreign keys
**Solution**: Verify task_assignment_id exists and user has permissions

## 🔧 **Debug Tools**

### **Browser Console Logs**
```javascript
// Look for these logs
"🧪 Test: Fetching comments for:" 
"✅ Comments loaded:"
"💬 Adding comment:"
"✅ Comment added successfully"
```

### **Network Tab**
- Check POST requests to `_annotation_comments`
- Verify response status 201 for successful inserts
- Check request payload has all required fields

### **Database Direct Query**
```sql
-- Quick check for recent comments
SELECT * FROM public_v2._annotation_comments 
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;
```

## 📈 **Next Steps**

After successful testing:

1. **Update CommentsWorkspace** to use new logic
2. **Add real-time synchronization** between OHIF and management system
3. **Implement comment notifications** 
4. **Add comment editing/deletion** features
5. **Performance optimization** with proper indexing

## 🎉 **Test Complete Checklist**

- [ ] Test page accessible at `/test-comments`
- [ ] Can load existing comments by task assignment + series
- [ ] Can add new comments successfully
- [ ] Comments appear in database with correct schema
- [ ] Different series show separate threads
- [ ] OHIF integration works with URL parameters
- [ ] User information displays correctly
- [ ] No console errors or network failures 