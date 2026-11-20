"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Html5Qrcode } from "html5-qrcode";
import { toast } from "sonner";
import {
  CheckCircle2,
  Search,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Camera,
  CameraOff,
  ExternalLink,
  Clock,
  UserCheck,
  Ban,
  Fingerprint,
  Loader2,
  Lock,
  HelpCircle,
  FileCheck,
  Sparkles,
  Landmark,
  BadgeCheck,
  Award,
} from "lucide-react";

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

import { VERIVAULT_CONTRACT_ADDRESS, VERIVAULT_ABI } from "@/config/contract";
import { getInstitutionalData } from "@/config/institutions";
import { publicClient } from "@/lib/rpc";
import {
  decompressPayload,
  hashLeaf,
  verifyLeaf,
  VerificationProofPayload,
} from "@/lib/crypto";

enum VerificationStatus {
  IDLE = "IDLE",
  VERIFYING = "VERIFYING",
  AUTHENTIC = "AUTHENTIC",
  REVOKED = "REVOKED",
  TAMPERED = "TAMPERED",
}

interface VerificationResult {
  status: VerificationStatus;
  tokenId: number;
  onChainRoot: string;
  issuerAddress: string;
  issuedAt: number;
  revoked: boolean;
  revokedAt: number;
  revocationReason: string;
  executionTimeMs: number;
  disclosedAttributes: {
    key: string;
    value: string;
    isValid: boolean;
  }[];
  errorMessage?: string;
}

// Demo strings for instant 1-click test during presentations (Matches on-chain Token #1 on Polygon Amoy)
const DEMO_VALID_PAYLOAD =
  "N4IgLg9g1gpgdgSQCYgFwEYA0IkEsDOAxgDYT4xICCYYATrgEYCuYM+aA2qLAJ5ogARAKIBxAEpChIbADcAhsSYx+AIQB0AFRiEAFgAIAwhAC2ABxYxaegMqFc8QjD0AyPULgBzXHBiXvH6RB8BTB+AAYAD0IAZiQAFhgAVgAzADYwgHZ0AA4AJgBOaLk4hkTCVKQMmGzk-LD0XOi4xNSM7Py5BkIkGGT6xubW9s7u3v6QAF9Mbhg+VBADEQAFSgB9AwAZSgQAWUD5RWV5xZW9AD4AXj1stUTA4OJQ+ciktMycgqKSsoqqmrqGk0Wm0Ol0en1AYMQSNwf0mpMALrYUy0CAQZLsVAcDggSLFdCpOLJYrJdq5dDoQi5XJyaKEKphVK5OLZRK5MLJaL5fJIfKEMJ8-K5VL5Bg89nRBjJOKpQjoBgVaKJdBtQKRZkUuKEbLoUVNHLdVlIEXJGAMBhyJByDrRDJyQgMckMMIMaKpdBIJA6gkZMUJMJyhq5DL85JqiKJT0MDIJbJIZW1e3RbLOjL5ZLM7VyzK+dIy3V2gNxW26uJWwjc7phMJsl0slBInGReKs23x3LdJCu9BxdBhGBuuL5Uu5bTZdKOmDoKeU+LZmDDtnZQh9bKW12k6IUEAIpEgFFosNY3ERfGE4lEskUqk0ukMpks2uc7m8-mC4Wi8VhSXS2XyxXKqq2Dqr2Pbarqrq9suXqRiaZoWlaNp2g6Toum6HpehSrR+jAAYUtSIYcuGkZdjG1TxugiYxCmmTppmy59lUMB5u6+SFoQxZZPkZb2pWSDVrWDD1juExAA";

function VerifierContent() {
  const searchParams = useSearchParams();
  const [dataInput, setDataInput] = useState("");
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isScanningRef = useRef(false);

  // --------------------------------------------------------------------------
  // Core Verification Engine (Target < 2 Seconds)
  // --------------------------------------------------------------------------
  const runVerification = async (rawString: string) => {
    if (!rawString.trim()) {
      toast.error("Please provide a verification payload or scan a QR code.");
      return;
    }

    const startTime = performance.now();
    setIsVerifying(true);
    setVerificationResult(null);

    try {
      // Clean string if a full URL was pasted or scanned
      let compressedPayload = rawString.trim();
      if (compressedPayload.includes("data=")) {
        const urlObj = new URL(compressedPayload, "https://verivault.local");
        compressedPayload = urlObj.searchParams.get("data") || compressedPayload;
      }

      // Step A: Decompress payload
      let payload: VerificationProofPayload;
      try {
        payload = decompressPayload(compressedPayload);
      } catch {
        throw new Error(
          "Invalid or corrupted verification payload string. Unable to decode LZ-String data."
        );
      }

      if (!payload.tokenId || !payload.disclosedAttributes || payload.disclosedAttributes.length === 0) {
        throw new Error("Payload does not contain valid token ID or disclosed attributes.");
      }

      // Step B: Blockchain State Check via direct Viem client (no wallet required)
      let onChainData: readonly [
        `0x${string}`,
        `0x${string}`,
        bigint,
        boolean,
        bigint,
        string
      ];

      try {
        onChainData = (await publicClient.readContract({
          address: VERIVAULT_CONTRACT_ADDRESS,
          abi: VERIVAULT_ABI,
          functionName: "getCredential",
          args: [BigInt(payload.tokenId)],
        })) as [
          `0x${string}`,
          `0x${string}`,
          bigint,
          boolean,
          bigint,
          string
        ];
      } catch (rpcErr: unknown) {
        console.error("Contract query failed:", rpcErr);
        const elapsed = Math.round(performance.now() - startTime);
        setVerificationResult({
          status: VerificationStatus.TAMPERED,
          tokenId: payload.tokenId,
          onChainRoot: "0x0",
          issuerAddress: "Unknown",
          issuedAt: 0,
          revoked: false,
          revokedAt: 0,
          revocationReason: "",
          executionTimeMs: elapsed,
          disclosedAttributes: [],
          errorMessage: `Token #${payload.tokenId} does not exist on Polygon Amoy contract (${VERIVAULT_CONTRACT_ADDRESS}) or registry query failed.`,
        });
        setIsVerifying(false);
        return;
      }

      const onChainRoot = onChainData[0];
      const issuer = onChainData[1];
      const issuedAt = Number(onChainData[2]);
      const revoked = onChainData[3];
      const revokedAt = Number(onChainData[4]);
      const revocationReason = onChainData[5];

      // Step C: Cryptographic Math Check
      let allLeavesValid = true;
      const checkedAttributes = [];

      for (let i = 0; i < payload.disclosedAttributes.length; i++) {
        const attr = payload.disclosedAttributes[i];
        const leaf = hashLeaf(attr);

        // Support multi-proofs array or single proof fallback
        const proof =
          payload.proofs && payload.proofs[i] ? payload.proofs[i] : payload.proof;

        const isValid = verifyLeaf(leaf, proof, onChainRoot);

        checkedAttributes.push({
          key: attr.key,
          value: attr.value,
          isValid,
        });

        if (!isValid) {
          allLeavesValid = false;
        }
      }

      const elapsed = Math.round(performance.now() - startTime);

      // Determine Outcome State
      if (!allLeavesValid) {
        setVerificationResult({
          status: VerificationStatus.TAMPERED,
          tokenId: payload.tokenId,
          onChainRoot,
          issuerAddress: issuer,
          issuedAt,
          revoked,
          revokedAt,
          revocationReason,
          executionTimeMs: elapsed,
          disclosedAttributes: checkedAttributes,
          errorMessage:
            "CRYPTOGRAPHIC PROOF FAILED: Potential document forgery detected. One or more attributes failed Merkle root inclusion.",
        });
      } else if (revoked) {
        setVerificationResult({
          status: VerificationStatus.REVOKED,
          tokenId: payload.tokenId,
          onChainRoot,
          issuerAddress: issuer,
          issuedAt,
          revoked,
          revokedAt,
          revocationReason,
          executionTimeMs: elapsed,
          disclosedAttributes: checkedAttributes,
        });
      } else {
        setVerificationResult({
          status: VerificationStatus.AUTHENTIC,
          tokenId: payload.tokenId,
          onChainRoot,
          issuerAddress: issuer,
          issuedAt,
          revoked,
          revokedAt,
          revocationReason,
          executionTimeMs: elapsed,
          disclosedAttributes: checkedAttributes,
        });
      }
    } catch (err: unknown) {
      console.error("Verification error:", err);
      const elapsed = Math.round(performance.now() - startTime);
      const message = err instanceof Error ? err.message : "Verification error occurred";
      setVerificationResult({
        status: VerificationStatus.TAMPERED,
        tokenId: 0,
        onChainRoot: "0x0",
        issuerAddress: "Unknown",
        issuedAt: 0,
        revoked: false,
        revokedAt: 0,
        revocationReason: "",
        executionTimeMs: elapsed,
        disclosedAttributes: [],
        errorMessage: message,
      });
    } finally {
      setIsVerifying(false);
    }
  };

  // --------------------------------------------------------------------------
  // 1. Auto-Verify on Page Load from URL Query Param ?data=...
  // --------------------------------------------------------------------------
  useEffect(() => {
    const dataParam = searchParams.get("data");
    if (dataParam) {
      setDataInput(dataParam);
      runVerification(dataParam);
    }
  }, [searchParams]);

  // --------------------------------------------------------------------------
  // 2. Camera QR Scanner Lifecycle (html5-qrcode)
  // --------------------------------------------------------------------------
  const startCameraScanner = async () => {
    setIsCameraActive(true);
    setVerificationResult(null);

    setTimeout(async () => {
      try {
        const html5QrCode = new Html5Qrcode("qr-reader");
        scannerRef.current = html5QrCode;

        await html5QrCode.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
          },
          (decodedText) => {
            stopCameraScanner();
            setDataInput(decodedText);
            toast.success("QR Code detected!");
            runVerification(decodedText);
          },
          () => {}
        );
        isScanningRef.current = true;
      } catch (err) {
        console.error("Camera access failed:", err);
        toast.error("Unable to access camera. Please grant camera permissions or paste the payload.");
        setIsCameraActive(false);
      }
    }, 150);
  };

  const stopCameraScanner = async () => {
    if (scannerRef.current && isScanningRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch (err) {
        console.warn("Camera stop error:", err);
      } finally {
        scannerRef.current = null;
        isScanningRef.current = false;
        setIsCameraActive(false);
      }
    } else {
      setIsCameraActive(false);
    }
  };

  useEffect(() => {
    return () => {
      if (scannerRef.current && isScanningRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  return (
    <div className="container max-w-5xl mx-auto px-3 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-2 sm:p-2.5 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-600/20 shrink-0">
            <CheckCircle2 className="h-6 w-6 sm:h-7 sm:w-7" />
          </div>
          <div>
            <h1 className="text-xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
              Public Instant Verifier
              <Badge variant="success" className="text-[10px] sm:text-xs">
                Sub-2s Engine
              </Badge>
            </h1>
            <p className="text-xs sm:text-sm text-slate-400">
              Zero-Trust Proof Engine on Polygon Amoy — No Web3 Wallet Required
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Badge variant="outline" className="text-xs font-mono">
            Polygon Amoy (80002)
          </Badge>
          <a
            href={`https://amoy.polygonscan.com/address/${VERIVAULT_CONTRACT_ADDRESS}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-mono"
          >
            Contract
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* Input Handling: Camera Scanner / URL / Paste                         */}
      {/* -------------------------------------------------------------------- */}
      <Card className="border-slate-800 bg-slate-900/70 shadow-xl">
        <CardHeader className="p-4 sm:p-6 pb-3 sm:pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <Search className="h-5 w-5 text-indigo-400" />
                Scan or Paste Credential Proof
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Point your phone camera at the student&apos;s dynamic QR code or paste a verification string.
              </CardDescription>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant={isCameraActive ? "destructive" : "secondary"}
                size="sm"
                onClick={isCameraActive ? stopCameraScanner : startCameraScanner}
                className="gap-2 shrink-0 border border-slate-700 w-full sm:w-auto"
              >
                {isCameraActive ? (
                  <>
                    <CameraOff className="h-4 w-4" />
                    Close Camera
                  </>
                ) : (
                  <>
                    <Camera className="h-4 w-4 text-emerald-400" />
                    Scan with Camera
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-6 pt-0 space-y-4">
          {/* Camera Viewport */}
          {isCameraActive && (
            <div className="space-y-3 p-3 sm:p-4 rounded-xl border border-indigo-500/40 bg-slate-950 flex flex-col items-center">
              <div
                id="qr-reader"
                className="w-full max-w-[280px] sm:max-w-sm rounded-lg overflow-hidden border border-slate-800 bg-black aspect-square"
              />
              <p className="text-xs text-slate-400 text-center flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-400" />
                Hold phone camera steady over the VeriVault QR code
              </p>
            </div>
          )}

          {/* Manual Input / Paste Field */}
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Input
                placeholder="Paste verification link or compressed proof payload (e.g. N4IgLg9g...)"
                value={dataInput}
                onChange={(e) => setDataInput(e.target.value)}
                disabled={isVerifying}
                className="font-mono text-xs pr-12 h-11"
              />
              {dataInput && (
                <button
                  type="button"
                  onClick={() => setDataInput("")}
                  className="absolute right-3 top-3 text-xs text-slate-500 hover:text-slate-300 font-medium"
                >
                  Clear
                </button>
              )}
            </div>

            <Button
              onClick={() => runVerification(dataInput)}
              disabled={isVerifying || !dataInput.trim()}
              className="gap-2 shrink-0 font-semibold h-11 px-6 w-full sm:w-auto"
            >
              {isVerifying ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <FileCheck className="h-4 w-4" />
                  Verify Instantly
                </>
              )}
            </Button>
          </div>

          {/* Quick Demo Buttons for Hackathon Presenters */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-[11px] text-slate-500 font-medium">Quick Demo Test:</span>
            <button
              type="button"
              onClick={() => {
                setDataInput(DEMO_VALID_PAYLOAD);
                runVerification(DEMO_VALID_PAYLOAD);
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-indigo-950/40 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-900/50 text-[11px] transition-colors"
            >
              <Sparkles className="h-3 w-3 text-indigo-400" />
              Load Sample Valid Proof
            </button>
            <button
              type="button"
              onClick={() => {
                // Modified tamper payload: fake degree attribute with invalid salt
                const forgedPayload = DEMO_VALID_PAYLOAD.slice(0, -6) + "FAKE99";
                setDataInput(forgedPayload);
                runVerification(forgedPayload);
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-red-950/40 border border-red-500/30 text-red-300 hover:bg-red-900/50 text-[11px] transition-colors"
            >
              <AlertTriangle className="h-3 w-3 text-red-400" />
              Test Forged / Tampered Proof
            </button>
          </div>
        </CardContent>
      </Card>

      {/* -------------------------------------------------------------------- */}
      {/* Verification In-Progress Indicator                                   */}
      {/* -------------------------------------------------------------------- */}
      {isVerifying && (
        <Card className="border-indigo-900/50 bg-indigo-950/20 p-8 text-center animate-pulse">
          <div className="max-w-sm mx-auto space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-400 mx-auto" />
            <h4 className="text-base font-bold text-white">
              Executing In-Browser Verification
            </h4>
            <p className="text-xs text-slate-400">
              Querying Polygon Amoy node state & validating Keccak-256 Merkle proofs...
            </p>
          </div>
        </Card>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* Immediate Visual States: GREEN, RED (REVOKED), RED (TAMPERED)        */}
      {/* HIGH-CONTRAST FOR MOBILE SCREENS (iPhone Safari & Android Chrome)     */}
      {/* -------------------------------------------------------------------- */}
      {verificationResult && (
        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
          {/* ================================================================= */}
          {/* STATE 1: GREEN (VERIFIED & AUTHENTIC)                             */}
          {/* ================================================================= */}
          {verificationResult.status === VerificationStatus.AUTHENTIC && (
            <Card className="border-2 border-emerald-500 bg-gradient-to-b from-emerald-950/80 via-slate-900 to-slate-950 shadow-2xl ring-4 ring-emerald-500/20 overflow-hidden">
              {/* High-contrast Mobile-Optimized Status Header */}
              <div className="border-b border-emerald-500/40 bg-emerald-900/50 px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 sm:p-2.5 rounded-xl bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/30 shrink-0">
                    <ShieldCheck className="h-7 w-7 sm:h-9 sm:w-9" />
                  </div>
                  <div>
                    <h3 className="text-xl sm:text-2xl font-black text-emerald-200 tracking-tight flex items-center gap-2">
                      VERIFIED & AUTHENTIC
                      <Badge variant="success" className="text-xs px-2 py-0.5 bg-emerald-500 text-slate-950 font-bold">
                        {verificationResult.executionTimeMs} ms
                      </Badge>
                    </h3>
                    <p className="text-xs sm:text-sm text-emerald-300 font-medium">
                      Cryptographically valid against Polygon Amoy on-chain commitment
                    </p>
                  </div>
                </div>

                <Badge variant="outline" className="border-emerald-400 text-emerald-300 font-mono text-xs sm:text-sm px-2.5 py-1 self-start sm:self-auto bg-slate-950/60">
                  Token #{verificationResult.tokenId}
                </Badge>
              </div>

              <CardContent className="p-4 sm:p-6 space-y-6">
                {/* ============================================================= */}
                {/* GovTech Singapore OpenCerts Institutional Identity Card       */}
                {/* ============================================================= */}
                {(() => {
                  const institution = getInstitutionalData(verificationResult.issuerAddress);
                  if (institution) {
                    return (
                      <div className="rounded-2xl border-2 border-emerald-500/50 bg-gradient-to-r from-emerald-950/70 via-slate-900 to-indigo-950/60 p-5 shadow-2xl relative overflow-hidden ring-2 ring-emerald-500/20">
                        {/* Glow accent */}
                        <div className="absolute -top-12 -right-12 w-40 h-40 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
                          {/* Main Institutional Identity Info */}
                          <div className="flex items-start gap-4">
                            <div className="p-3 sm:p-3.5 rounded-2xl bg-emerald-500/20 border-2 border-emerald-500/40 text-emerald-400 shrink-0 shadow-lg shadow-emerald-900/30">
                              <Landmark className="h-7 w-7" />
                            </div>

                            <div className="space-y-1.5">
                              {/* OpenCerts Standard Badge */}
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold tracking-wide uppercase shadow-sm">
                                  <BadgeCheck className="h-3.5 w-3.5 text-emerald-400" />
                                  GovTech OpenCerts Verified
                                </span>
                                <span className="text-[11px] text-slate-400 font-mono">
                                  {institution.registryId}
                                </span>
                              </div>

                              {/* Verified Issuer Name */}
                              <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                                Verified Issuer: {institution.name}
                              </h3>

                              {/* Domain & Accreditation Row */}
                              <div className="flex flex-wrap items-center gap-y-1.5 gap-x-4 text-xs sm:text-sm text-slate-300 pt-0.5">
                                {/* Official Institutional Domain */}
                                <a
                                  href={institution.portalUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 font-semibold text-emerald-300 hover:text-emerald-200 hover:underline transition-colors group"
                                  title="Visit Official Institutional Portal"
                                >
                                  <Lock className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                                  <span>Official Institutional Domain: {institution.domain}</span>
                                  <ExternalLink className="h-3.5 w-3.5 text-emerald-400/80 group-hover:text-emerald-200 shrink-0" />
                                </a>

                                <span className="text-slate-600 hidden sm:inline">•</span>

                                {/* Regulatory Registry */}
                                <span className="inline-flex items-center gap-1.5 text-slate-200 font-medium">
                                  <Award className="h-4 w-4 text-amber-400 shrink-0" />
                                  <span>Regulatory Registry: {institution.accreditation}</span>
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* On-Chain Coordinates on Polygon Amoy */}
                          <div className="flex flex-col sm:flex-row lg:flex-col items-start lg:items-end justify-between border-t lg:border-t-0 border-slate-800 pt-3 lg:pt-0 shrink-0 gap-1.5">
                            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                              On-Chain Coordinates
                            </span>
                            <a
                              href={`https://amoy.polygonscan.com/address/${VERIVAULT_CONTRACT_ADDRESS}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-950/60 hover:bg-indigo-900/60 border border-indigo-500/40 text-xs font-mono text-indigo-300 hover:text-indigo-200 transition-all shadow-md group"
                              title="Inspect smart contract on Polygonscan"
                            >
                              <Fingerprint className="h-3.5 w-3.5 text-indigo-400" />
                              <span>Polygon Amoy Contract</span>
                              <ExternalLink className="h-3.5 w-3.5 text-indigo-400 group-hover:translate-x-0.5 transition-transform" />
                            </a>
                            <span className="text-[10px] text-slate-500 font-mono">
                              Chain ID: 80002 • Cancun EVM
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // Unknown / Unregistered Issuer State
                  return (
                    <div className="rounded-2xl border-2 border-amber-500/60 bg-gradient-to-r from-amber-950/70 via-slate-900 to-slate-950 p-5 shadow-2xl ring-2 ring-amber-500/20">
                      <div className="flex items-start gap-4">
                        <div className="p-3 sm:p-3.5 rounded-2xl bg-amber-500/20 border-2 border-amber-500/40 text-amber-400 shrink-0">
                          <AlertTriangle className="h-7 w-7" />
                        </div>
                        <div className="space-y-2 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[11px] font-bold uppercase tracking-wide">
                              <AlertTriangle className="h-3 w-3" />
                              Unregistered Issuer
                            </span>
                            <span className="text-[11px] text-amber-400/80 font-mono">
                              OpenCerts Trust Warning
                            </span>
                          </div>

                          <h3 className="text-base sm:text-lg font-bold text-amber-200 leading-snug">
                            Unregistered Issuer: This credential was signed by an unverified wallet address ({verificationResult.issuerAddress.slice(0, 8)}...{verificationResult.issuerAddress.slice(-6)}). Proceed with caution.
                          </h3>

                          <p className="text-xs text-slate-300 leading-relaxed">
                            While the cryptographic Merkle tree integrity check passed against the on-chain root, this signing address is <strong>not registered</strong> in the National Institutional Accreditation Directory or GovTech OpenCerts registry.
                          </p>

                          <div className="pt-1 flex flex-wrap items-center gap-3">
                            <a
                              href={`https://amoy.polygonscan.com/address/${verificationResult.issuerAddress}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs text-amber-300 hover:text-amber-200 underline font-mono"
                            >
                              Inspect Issuer Wallet on Polygonscan <ExternalLink className="h-3 w-3" />
                            </a>
                            <span className="text-slate-600">•</span>
                            <a
                              href={`https://amoy.polygonscan.com/address/${VERIVAULT_CONTRACT_ADDRESS}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs text-indigo-300 hover:text-indigo-200 underline font-mono"
                            >
                              Contract Coordinates on Amoy <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* On-Chain Attestation Details */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                    <span className="text-[11px] text-slate-400 flex items-center gap-1 font-medium">
                      <UserCheck className="h-3.5 w-3.5 text-indigo-400" />
                      Authorized Issuer
                    </span>
                    <p className="font-mono text-xs text-white break-all" title={verificationResult.issuerAddress}>
                      {verificationResult.issuerAddress}
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                    <span className="text-[11px] text-slate-400 flex items-center gap-1 font-medium">
                      <Clock className="h-3.5 w-3.5 text-indigo-400" />
                      Conferred / Issued Date
                    </span>
                    <p className="text-xs sm:text-sm font-semibold text-white">
                      {new Date(verificationResult.issuedAt * 1000).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                    <span className="text-[11px] text-slate-400 flex items-center gap-1 font-medium">
                      <Fingerprint className="h-3.5 w-3.5 text-indigo-400" />
                      Committed Merkle Root
                    </span>
                    <p className="font-mono text-xs text-indigo-300 break-all" title={verificationResult.onChainRoot}>
                      {verificationResult.onChainRoot}
                    </p>
                  </div>
                </div>

                {/* Disclosed Verified Attributes List */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      Disclosed Verified Attributes ({verificationResult.disclosedAttributes.length})
                    </h4>
                    <span className="text-xs text-emerald-400 font-mono font-medium">
                      All proofs matched
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {verificationResult.disclosedAttributes.map((attr) => (
                      <div
                        key={attr.key}
                        className="p-4 rounded-xl border-2 border-emerald-500/30 bg-emerald-950/20 flex items-center justify-between gap-3 shadow-md"
                      >
                        <div>
                          <span className="text-[10px] font-bold tracking-wider uppercase text-emerald-400/90">
                            {attr.key.replace(/_/g, " ")}
                          </span>
                          <p className="text-sm sm:text-base font-extrabold text-white mt-0.5">
                            {attr.value}
                          </p>
                        </div>
                        <CheckCircle2 className="h-6 w-6 text-emerald-400 shrink-0" />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Privacy Guarantee Notice */}
                <Alert variant="info" className="border-indigo-900/40 bg-indigo-950/40 p-4">
                  <Lock className="h-4 w-4 text-indigo-400" />
                  <AlertTitle className="text-indigo-200 text-xs font-bold">
                    Zero-Knowledge Privacy Guarantee
                  </AlertTitle>
                  <AlertDescription className="text-slate-200 text-xs leading-relaxed mt-1">
                    All undisclosed fields remain mathematically sealed and cryptographically unexposed.
                    The student has chosen to selectively prove only the attributes listed above.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          )}

          {/* ================================================================= */}
          {/* STATE 2: RED (REVOKED BY ISSUER)                                  */}
          {/* ================================================================= */}
          {verificationResult.status === VerificationStatus.REVOKED && (
            <Card className="border-2 border-red-500 bg-gradient-to-b from-red-950/80 via-slate-900 to-slate-950 shadow-2xl ring-4 ring-red-500/20">
              <div className="border-b border-red-500/50 bg-red-900/50 px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="p-2 sm:p-2.5 rounded-xl bg-red-500 text-slate-950 shadow-lg shadow-red-500/30 shrink-0">
                    <Ban className="h-7 w-7 sm:h-9 sm:w-9" />
                  </div>
                  <div>
                    <h3 className="text-xl sm:text-2xl font-black text-red-200 tracking-tight">
                      CREDENTIAL HAS BEEN REVOKED
                    </h3>
                    <p className="text-xs sm:text-sm text-red-300 font-medium">
                      The issuing university has officially cancelled this academic credential on Polygon Amoy
                    </p>
                  </div>
                </div>

                <Badge variant="destructive" className="text-xs px-2.5 py-1 self-start sm:self-auto bg-red-600 font-bold">
                  Revoked Token #{verificationResult.tokenId}
                </Badge>
              </div>

              <CardContent className="p-4 sm:p-6 space-y-4">
                <div className="p-4 rounded-xl bg-red-950/60 border-2 border-red-500/50 space-y-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-red-400 flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4" />
                    Official On-Chain Revocation Reason
                  </span>
                  <p className="text-base sm:text-lg font-black text-white">
                    &quot;{verificationResult.revocationReason}&quot;
                  </p>
                  <p className="text-xs text-slate-300 pt-1">
                    Revocation Timestamp:{" "}
                    <span className="text-white font-semibold">
                      {new Date(verificationResult.revokedAt * 1000).toUTCString()}
                    </span>
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-400">
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                    <span className="font-medium text-slate-400">Issuing Institution:</span>{" "}
                    <span className="font-mono text-white block mt-0.5 break-all">
                      {verificationResult.issuerAddress}
                    </span>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                    <span className="font-medium text-slate-400">Original Issuance:</span>{" "}
                    <span className="text-white block mt-0.5 font-semibold">
                      {new Date(verificationResult.issuedAt * 1000).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ================================================================= */}
          {/* STATE 3: RED (TAMPERED / INVALID)                                 */}
          {/* ================================================================= */}
          {verificationResult.status === VerificationStatus.TAMPERED && (
            <Card className="border-2 border-red-500 bg-gradient-to-b from-red-950/80 via-slate-900 to-slate-950 shadow-2xl ring-4 ring-red-500/20">
              <div className="border-b border-red-500/50 bg-red-900/50 px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 sm:p-2.5 rounded-xl bg-red-500 text-slate-950 shadow-lg shadow-red-500/30 shrink-0">
                    <ShieldAlert className="h-7 w-7 sm:h-9 sm:w-9" />
                  </div>
                  <div>
                    <h3 className="text-xl sm:text-2xl font-black text-red-200 tracking-tight">
                      CRYPTOGRAPHIC PROOF FAILED
                    </h3>
                    <p className="text-xs sm:text-sm text-red-300 font-medium">
                      Potential document forgery detected. Credential cannot be verified.
                    </p>
                  </div>
                </div>

                <Badge variant="destructive" className="bg-red-600 font-bold self-start sm:self-auto">
                  Invalid / Forged
                </Badge>
              </div>

              <CardContent className="p-4 sm:p-6 space-y-4">
                <Alert variant="destructive" className="bg-red-950/60 border-red-500/40 p-4">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle className="text-xs font-bold">Document Integrity Alert</AlertTitle>
                  <AlertDescription className="text-xs leading-relaxed mt-1 text-red-200">
                    {verificationResult.errorMessage ||
                      "The disclosed attributes do not match the immutable Merkle root committed on Polygon Amoy. The data may have been altered, fabricated, or forged."}
                  </AlertDescription>
                </Alert>

                {verificationResult.disclosedAttributes.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-slate-300">
                      Attribute Invariant Check Breakdown:
                    </span>
                    <div className="space-y-2">
                      {verificationResult.disclosedAttributes.map((attr) => (
                        <div
                          key={attr.key}
                          className="p-3 rounded-xl border border-slate-800 bg-slate-950 flex items-center justify-between text-xs"
                        >
                          <div>
                            <span className="text-slate-400 font-mono mr-2">{attr.key}:</span>
                            <span className="text-white font-semibold">{attr.value}</span>
                          </div>
                          {attr.isValid ? (
                            <span className="text-emerald-400 font-bold flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Valid
                            </span>
                          ) : (
                            <span className="text-red-400 font-bold flex items-center gap-1 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">
                              <Ban className="h-3.5 w-3.5" /> FAILED
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Verification Protocol Explainer */}
      <Card className="border-slate-800 bg-slate-950/40">
        <CardHeader className="p-4 sm:p-6 pb-2">
          <CardTitle className="text-xs sm:text-sm font-semibold text-slate-300 flex items-center gap-2">
            <HelpCircle className="h-4 w-4 text-indigo-400" />
            Why VeriVault Verifications Complete in Milliseconds
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0 text-xs text-slate-400 space-y-2 leading-relaxed">
          <p>
            Traditional credential verifiers take days or weeks communicating with university registrars.
            VeriVault executes in milliseconds by reading the immutable 32-byte Merkle root on Polygon Amoy
            and proving Keccak-256 leaf commitments client-side.
          </p>
          <p>
            No user tracking, no cookies, no Web3 wallet connection required for employers or verifiers.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="container max-w-5xl mx-auto px-4 py-16 text-center text-slate-400 space-y-3">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-indigo-400" />
          <p className="text-sm">Initializing Public Instant Verifier...</p>
        </div>
      }
    >
      <VerifierContent />
    </Suspense>
  );
}
