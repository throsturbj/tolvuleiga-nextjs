// Test Supabase connection
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://aowkzhwmazgsuxuyfhgb.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFvd2t6aHdtYXpnc3V4dXlmaGdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA2MDgyOTMsImV4cCI6MjA3NjE4NDI5M30.B-Slkijbt_fjHVpY8-Z8_O-q8P5qNgqRWbpcu1STIAY';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testSupabase() {
  console.log('Testing Supabase connection...');
  
  try {
    // Test auth service
    console.log('Testing auth service...');
    const { data: authData, error: authError } = await supabase.auth.getSession();
    
    if (authError) {
      console.log('❌ Auth service error:', authError);
    } else {
      console.log('✅ Auth service accessible!');
    }
    
    // Test orders table
    console.log('Testing orders table...');
    const { data: ordersData, error: ordersError } = await supabase
      .from('orders')
      .select('*')
      .limit(1);
    
    if (ordersError) {
      console.log('❌ Orders table error:', ordersError);
      console.log('Error details:', {
        message: ordersError.message,
        details: ordersError.details,
        hint: ordersError.hint,
        code: ordersError.code
      });
    } else {
      console.log('✅ Orders table accessible!');
      console.log('Sample data:', ordersData);
    }
    
    // Test users table
    console.log('Testing users table...');
    const { data: usersData, error: usersError } = await supabase
      .from('users')
      .select('*')
      .limit(1);
    
    if (usersError) {
      console.log('❌ Users table error:', usersError);
    } else {
      console.log('✅ Users table accessible!');
    }
    
  } catch (error) {
    console.log('❌ Connection failed:', error);
  }
}

testSupabase();
