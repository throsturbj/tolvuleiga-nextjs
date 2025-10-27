"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

export default function DebugOrders() {
  const { user } = useAuth();
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const testQuery = async () => {
    if (!user) return;
    
    setLoading(true);
    setResult(null);
    
    try {
      console.log('Debug: Starting query with direct REST API call...');
      
      const url = `https://aowkzhwmazgsuxuyfhgb.supabase.co/rest/v1/orders?auth_uid=eq.${user.auth_uid}&select=*`;
      console.log('Debug: API URL:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFvd2t6aHdtYXpnc3V4dXlmaGdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA2MDgyOTMsImV4cCI6MjA3NjE4NDI5M30.B-Slkijbt_fjHVpY8-Z8_O-q8P5qNgqRWbpcu1STIAY',
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFvd2t6aHdtYXpnc3V4dXlmaGdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA2MDgyOTMsImV4cCI6MjA3NjE4NDI5M30.B-Slkijbt_fjHVpY8-Z8_O-q8P5qNgqRWbpcu1STIAY',
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Debug: Response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const ordersData = await response.json();
      console.log('Debug: REST API query completed:', ordersData);
      
      setResult({ data: ordersData, error: null });
    } catch (err) {
      console.error('Debug: Query error:', err);
      setResult({ data: null, error: err });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      testQuery();
    }
  }, [user]);

  return (
    <div className="p-4 border rounded">
      <h3>Debug Orders Query</h3>
      <p>User: {user?.auth_uid}</p>
      <button 
        onClick={testQuery} 
        disabled={loading}
        className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
      >
        {loading ? 'Testing...' : 'Test Query'}
      </button>
      <pre className="mt-4 p-2 bg-gray-100 rounded text-sm overflow-auto">
        {JSON.stringify(result, null, 2)}
      </pre>
    </div>
  );
}
