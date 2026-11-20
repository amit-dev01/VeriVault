"use client";

import React, { useState } from "react";
import { RotateCcw, Check, ShieldCheck, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { VERIVAULT_CONTRACT_ADDRESS } from "@/config/contract";

export function Footer() {
  const [cleared, setCleared] = useState(false);

  const handleClearCache = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
      setCleared(true);
      toast.success("Local cache cleared. Demo environment reset to clean state.");
      setTimeout(() => {
        setCleared(false);
        window.location.reload();
      }, 1000);
    } catch {
      toast.error("Failed to clear local cache.");
    }
  };

  return (
    <footer className="border-t border-slate-900 bg-slate-950/80 backdrop-blur-md py-6 text-xs text-slate-500">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Left: Brand & Copyright */}
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-indigo-400" />
          <span>VeriVault © 2026. Decentralized Academic Credentialing System.</span>
        </div>

        {/* Center: Amoy Status & Contract Link */}
        <div className="flex flex-wrap items-center justify-center gap-4 text-[11px]">
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-slate-400 font-medium">Polygon Amoy (80002)</span>
          </div>
          <span>•</span>
          <a
            href={`https://amoy.polygonscan.com/address/${VERIVAULT_CONTRACT_ADDRESS}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-mono transition-colors"
          >
            Contract
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        {/* Right: Demo Reset Button */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleClearCache}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-xs font-medium transition-all shadow-sm active:scale-95"
            title="Reset browser storage to re-run demo from scratch"
          >
            {cleared ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-emerald-400">Resetting...</span>
              </>
            ) : (
              <>
                <RotateCcw className="h-3.5 w-3.5 text-indigo-400" />
                <span>Clear Local Cache</span>
              </>
            )}
          </button>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
