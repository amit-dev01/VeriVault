"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useChainId } from "wagmi";
import {
  ShieldCheck,
  GraduationCap,
  Wallet,
  CheckCircle2,
  Menu,
  X,
  Radio,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  {
    name: "University Portal",
    href: "/issuer",
    icon: GraduationCap,
    description: "Issue & Revoke Credentials",
  },
  {
    name: "Student Wallet",
    href: "/wallet",
    icon: Wallet,
    description: "Soulbound SBT Vault",
  },
  {
    name: "Public Verifier",
    href: "/verify",
    icon: CheckCircle2,
    description: "Cryptographic Proofs",
  },
];

export function Navbar() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isConnected } = useAccount();
  const chainId = useChainId();

  const isPolygonAmoy = chainId === 80002;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-800/80 bg-slate-950/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand / Logo */}
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="flex items-center gap-2.5 transition-opacity hover:opacity-90"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 text-white shadow-md shadow-indigo-500/20">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-base font-bold tracking-tight text-white flex items-center gap-1.5">
                VeriVault
                <span className="text-[10px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  Amoy
                </span>
              </span>
              <span className="text-[10px] text-slate-400 -mt-1 hidden sm:inline">
                Decentralized Academic Credentials
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center space-x-1 pl-4 border-l border-slate-800">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-all",
                    isActive
                      ? "bg-slate-800 text-white shadow-sm ring-1 ring-slate-700"
                      : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4",
                      isActive ? "text-indigo-400" : "text-slate-400"
                    )}
                  />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right side: Network Status & Connect Button */}
        <div className="flex items-center gap-3">
          {/* Network indicator badge */}
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs">
            <Radio
              className={cn(
                "h-3 w-3 animate-pulse",
                isConnected
                  ? isPolygonAmoy
                    ? "text-emerald-400"
                    : "text-amber-400"
                  : "text-slate-500"
              )}
            />
            <span className="text-slate-300 font-medium">Polygon Amoy</span>
            <span className="text-slate-500 font-mono text-[10px]">(80002)</span>
          </div>

          {/* RainbowKit ConnectButton */}
          <ConnectButton
            accountStatus="avatar"
            chainStatus="icon"
            showBalance={false}
          />

          {/* Mobile menu button */}
          <button
            type="button"
            className="md:hidden inline-flex items-center justify-center p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 focus:outline-none"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-slate-800 bg-slate-950 px-4 py-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-slate-800 text-white"
                    : "text-slate-400 hover:bg-slate-900 hover:text-white"
                )}
              >
                <Icon
                  className={cn(
                    "h-5 w-5",
                    isActive ? "text-indigo-400" : "text-slate-400"
                  )}
                />
                <div>
                  <div>{item.name}</div>
                  <div className="text-xs text-slate-500">
                    {item.description}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </header>
  );
}

export default Navbar;
