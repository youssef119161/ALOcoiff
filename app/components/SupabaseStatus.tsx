"use client";

import { useEffect, useState } from "react";
import { isSupabaseConfigured } from "../../lib/supabase";

export function SupabaseStatus() {
  const [isConfigured, setIsConfigured] = useState(false);
  const [showStatus, setShowStatus] = useState(false);

  useEffect(() => {
    const configured = isSupabaseConfigured();
    setIsConfigured(configured);
    
    // Show status for 5 seconds on mount
    setShowStatus(true);
    const timer = setTimeout(() => setShowStatus(false), 5000);
    
    return () => clearTimeout(timer);
  }, []);

  if (!showStatus) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-fade-in">
      <div
        className={`px-4 py-3 rounded-lg shadow-lg border ${
          isConfigured
            ? "bg-green-500/10 border-green-500/30 text-green-400"
            : "bg-yellow-500/10 border-yellow-500/30 text-yellow-400"
        }`}
      >
        <div className="flex items-center gap-2">
          {isConfigured ? (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm font-medium">Supabase connecté</span>
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="text-sm font-medium">Mode localStorage uniquement</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
