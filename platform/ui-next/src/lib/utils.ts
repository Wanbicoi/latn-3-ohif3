import { createClient } from '@supabase/supabase-js';

// Supabase configuration - Updated with new database credentials
const supabaseUrl = 'https://bmeemseeqpnsqgwdpcoj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJtZWVtc2VlcXBuc3Fnd2RwY29qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM4MjM0OTcsImV4cCI6MjA1OTM5OTQ5N30.qGfF6_6sw5K-9QzDOcwjE-XOpMb-q2D5HgxFRB8LcYA';
// Note: If 6LiR1SKmg6bMcgMT is the new service role key, replace the above key

export const supabaseClient = createClient(supabaseUrl, supabaseKey, {
  db: {
    schema: 'public_v2'
  },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

// Test Supabase connection
export async function testSupabaseConnection() {
  try {
    console.log('🔌 Testing Supabase connection...');
    const { data, error } = await supabaseClient
      .from('_annotation_comments')
      .select('count')
      .limit(1);
    
    if (error) {
      console.error('❌ Supabase connection failed:', error);
      return { success: false, error: error.message };
    } else {
      console.log('✅ Supabase connection successful');
      return { success: true, data };
    }
  } catch (error) {
    console.error('❌ Supabase connection error:', error);
    return { success: false, error: error.message };
  }
}

// Debug database schema
export async function debugDatabaseSchema() {
  console.log('🔍 Debugging database schema...');
  
  try {
    // Test _annotation_comments table
    console.log('📋 Testing _annotation_comments table...');
    const { data: commentsTest, error: commentsError } = await supabaseClient
      .from('_annotation_comments')
      .select('*')
      .limit(1);
    
    if (commentsError) {
      console.error('❌ _annotation_comments table error:', commentsError);
    } else {
      console.log('✅ _annotation_comments table accessible');
      console.log('📄 Sample record structure:', commentsTest?.[0] || 'No records');
    }

    // Test _users table (correct table name)
    console.log('👤 Testing _users table...');
    const { data: usersTest, error: usersError } = await supabaseClient
      .from('_users')
      .select('*')
      .limit(1);
    
    if (usersError) {
      console.error('❌ _users table error:', usersError);
      console.log('💡 _users table may not be accessible');
    } else {
      console.log('✅ _users table accessible');
      console.log('👤 Sample user structure:', usersTest?.[0] || 'No records');
    }

    // Test foreign key relationship with correct table name
    console.log('🔗 Testing foreign key relationship...');
    const { data: joinTest, error: joinError } = await supabaseClient
      .from('_annotation_comments')
      .select(`
        id,
        author_id,
        _users!_annotation_comments_author_id_fkey (
          full_name,
          avatar_url
        )
      `)
      .limit(1);
    
    if (joinError) {
      console.error('❌ Foreign key relationship error:', joinError);
      console.log('💡 Foreign key constraint may not exist');
    } else {
      console.log('✅ Foreign key relationship working');
    }

    return {
      commentsTable: !commentsError,
      usersTable: !usersError,
      foreignKey: !joinError
    };

  } catch (error) {
    console.error('❌ Schema debug failed:', error);
    return { error: error.message };
  }
}

// Check table permissions and RLS policies
export async function checkTablePermissions() {
  console.log('🔒 Checking table permissions and RLS policies...');
  
  try {
    // Test INSERT permission on _annotation_comments
    console.log('📝 Testing INSERT permission on _annotation_comments...');
    const testComment = {
      task_assignment_id: 'test-task-id',
      author_id: 'test-author-id', 
      comment: 'Test comment for permission check',
      series_instance_uid: 'test-series-uid',
      data: { test: true }
    };
    
    const { data: insertTest, error: insertError } = await supabaseClient
      .from('_annotation_comments')
      .insert(testComment)
      .select()
      .single();
    
    if (insertError) {
      console.error('❌ INSERT permission failed:', {
        message: insertError.message,
        details: insertError.details,
        hint: insertError.hint,
        code: insertError.code
      });
    } else {
      console.log('✅ INSERT permission successful');
      
      // Clean up test record
      await supabaseClient
        .from('_annotation_comments')
        .delete()
        .eq('id', insertTest.id);
      console.log('🧹 Test record cleaned up');
    }

    // Test INSERT permission on _users
    console.log('👤 Testing INSERT permission on _users...');
    const testUser = {
      id: 'test-user-id-' + Date.now(),
      full_name: 'Test User',
      is_system: false
    };
    
    const { data: userInsertTest, error: userInsertError } = await supabaseClient
      .from('_users')
      .insert(testUser)
      .select()
      .single();
    
    if (userInsertError) {
      console.error('❌ _users INSERT permission failed:', {
        message: userInsertError.message,
        details: userInsertError.details,
        hint: userInsertError.hint,
        code: userInsertError.code
      });
    } else {
      console.log('✅ _users INSERT permission successful');
      
      // Clean up test user
      await supabaseClient
        .from('_users')
        .delete()
        .eq('id', testUser.id);
      console.log('🧹 Test user cleaned up');
    }

    return {
      commentInsert: !insertError,
      userInsert: !userInsertError
    };

  } catch (error) {
    console.error('❌ Permission check failed:', error);
    return { error: error.message };
  }
}

// Auto-test connection on load
testSupabaseConnection();

// Utility function to combine class names
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}
