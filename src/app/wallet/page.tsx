"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import {
  Wallet,
  ShieldCheck,
  Upload,
  Copy,
  Check,
  Eye,
  EyeOff,
  ExternalLink,
  QrCode,
  Sparkles,
  Award,
  AlertCircle,
  Trash2,
  FolderOpen,
} from "lucide-react";

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

import {
  FullCredentialPayload,
  buildSelectiveDisclosurePayload,
  compressPayload,
} from "@/lib/crypto";

// Default disclosure presets as specified
const DEFAULT_DISCLOSED_KEYS: Record<string, boolean> = {
  DEGREE: true,
  GRAD_YEAR: true,
  CGPA_CLAIM: true,
  NAME: false,
  ROLL_NO: false,
};

// Friendly labels for credential attributes
const ATTRIBUTE_LABELS: Record<string, { title: string; description: string }> = {
  DEGREE: {
    title: "Degree / Program",
    description: "Your official conferred degree and major",
  },
  GRAD_YEAR: {
    title: "Graduation Year",
    description: "The cohort or completion year",
  },
  CGPA_CLAIM: {
    title: "CGPA Claim / Merit Level",
    description: "Zero-knowledge claim (e.g. CGPA >= 8.5) without revealing exact GPA",
  },
  NAME: {
    title: "Student Full Name",
    description: "Legal name (keep hidden for anonymous job applications)",
  },
  ROLL_NO: {
    title: "Roll / Registration Number",
    description: "Institutional student identity number",
  },
};

const LOCAL_STORAGE_KEY = "verivault_stored_credential";

export default function WalletPage() {
  const [credential, setCredential] = useState<FullCredentialPayload | null>(null);
  const [disclosedKeys, setDisclosedKeys] = useState<Record<string, boolean>>(DEFAULT_DISCLOSED_KEYS);
  const [compressedString, setCompressedString] = useState<string>("");
  const [copiedLink, setCopiedLink] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --------------------------------------------------------------------------
  // 1. Initial Load from LocalStorage
  // --------------------------------------------------------------------------
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as FullCredentialPayload;
        if (parsed.attributes && parsed.rootHash) {
          setCredential(parsed);
        }
      }
    } catch (e) {
      console.warn("Failed to read from localStorage:", e);
    }
  }, []);

  // --------------------------------------------------------------------------
  // 2. Dynamic QR & Proof Generation Pipeline
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!credential || !credential.attributes || credential.attributes.length === 0) {
      setCompressedString("");
      return;
    }

    const activeKeys = Object.entries(disclosedKeys)
      .filter(([, isRevealed]) => isRevealed)
      .map(([key]) => key);

    if (activeKeys.length === 0) {
      setCompressedString("");
      return;
    }

    try {
      // Build selective disclosure payload using cryptographic Merkle tree engine
      const payload = buildSelectiveDisclosurePayload(credential, activeKeys);

      // Compress to URI-safe string for QR Code & URL sharing
      const compressed = compressPayload(payload);
      setCompressedString(compressed);
    } catch (err) {
      console.error("Proof generation error:", err);
      toast.error("Failed to construct selective disclosure proof.");
    }
  }, [credential, disclosedKeys]);

  // --------------------------------------------------------------------------
  // 3. File Drop & Ingestion Handlers
  // --------------------------------------------------------------------------
  const processJsonFile = (file: File) => {
    if (!file.name.endsWith(".json")) {
      toast.error("Please upload a valid VeriVault-Credential-*.json file.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = JSON.parse(content) as FullCredentialPayload;

        if (!parsed.attributes || !parsed.rootHash) {
          throw new Error("Missing required credential attributes or Merkle root hash.");
        }

        setCredential(parsed);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(parsed));
        toast.success(`Loaded credential for Token #${parsed.tokenId || "N/A"}`);
      } catch (err: unknown) {
        console.error("File parse error:", err);
        const message = err instanceof Error ? err.message : "Malformed JSON file";
        toast.error(`Invalid Credential File: ${message}`);
      }
    };
    reader.readAsText(file);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processJsonFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processJsonFile(file);
    }
  };

  // --------------------------------------------------------------------------
  // 4. Sample Credential Loader (Demo Helper)
  // --------------------------------------------------------------------------
  const loadDemoCredential = () => {
    const demoPayload: FullCredentialPayload = {
      tokenId: 1,
      contractAddress: "0x1Ba155930d87C46B53849e3E3Cfa7C3052EC7D9c",
      issuerAddress: "0x95c9F3704D9851087C120B2f2de8369C9Bf66cb2",
      rootHash: "0x72a956625402f4270fa0e93b01cace5de4b6a9dd20f684ede3bf05bd7c0fb07d",
      attributes: [
        {
          key: "NAME",
          value: "Aarav Sharma",
          salt: "0xa1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0",
        },
        {
          key: "ROLL_NO",
          value: "JU-CSE-2024-042",
          salt: "0xb2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef01",
        },
        {
          key: "DEGREE",
          value: "B.Tech Computer Science & Engineering",
          salt: "0xc3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef012",
        },
        {
          key: "GRAD_YEAR",
          value: "2028",
          salt: "0xd4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0123",
        },
        {
          key: "CGPA_CLAIM",
          value: "CGPA >= 8.5",
          salt: "0xe5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef01234",
        },
      ],
    };

    setCredential(demoPayload);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(demoPayload));
    toast.success("Loaded demo academic credential.");
  };

  const handleClearCredential = () => {
    setCredential(null);
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    toast.info("Cleared credential from wallet memory.");
  };

  // --------------------------------------------------------------------------
  // 5. Toggle Switch Handler
  // --------------------------------------------------------------------------
  const toggleAttribute = (key: string) => {
    setDisclosedKeys((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // --------------------------------------------------------------------------
  // 6. Copy Verification URL
  // --------------------------------------------------------------------------
  const getVerificationUrl = () => {
    if (typeof window === "undefined" || !compressedString) return "";
    return `${window.location.origin}/verify?data=${compressedString}`;
  };

  const copyVerificationLink = () => {
    const url = getVerificationUrl();
    if (!url) return;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    toast.success("Verification link copied to clipboard!");
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const disclosedCount = Object.values(disclosedKeys).filter(Boolean).length;
  const degreeAttr = credential?.attributes?.find((a) => a.key === "DEGREE")?.value || "Academic Credential";

  return (
    <div className="container max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-600/20">
            <Wallet className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
              Student Privacy Wallet
              <Badge variant="outline" className="border-violet-500/40 text-violet-300 font-mono text-[10px]">
                Zero-Knowledge Proof Vault
              </Badge>
            </h1>
            <p className="text-sm text-slate-400">
              Manage Soulbound degrees, control selective disclosure, and generate verifiable cryptographic proofs
            </p>
          </div>
        </div>

        {credential && (
          <Button
            size="sm"
            variant="ghost"
            onClick={handleClearCredential}
            className="text-xs text-slate-400 hover:text-red-400 gap-1.5 self-start sm:self-auto"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear Credential
          </Button>
        )}
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* 1. File Upload Dropzone / Ingestion                                   */}
      {/* -------------------------------------------------------------------- */}
      {!credential ? (
        <Card
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed transition-all text-center p-8 sm:p-12 ${
            isDragging
              ? "border-indigo-500 bg-indigo-950/30 scale-[1.01]"
              : "border-slate-800 bg-slate-900/40 hover:border-slate-700"
          }`}
        >
          <div className="max-w-md mx-auto space-y-4">
            <div className="h-16 w-16 rounded-2xl bg-indigo-500/10 text-indigo-400 mx-auto flex items-center justify-center border border-indigo-500/20 shadow-inner">
              <Upload className="h-8 w-8" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-lg font-bold text-white">Import Your Soulbound Credential</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Drag and drop your issued <code className="font-mono text-indigo-300">VeriVault-Credential-*.json</code> file,
                or browse your file system.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                className="w-full sm:w-auto gap-2"
              >
                <FolderOpen className="h-4 w-4" />
                Browse File
              </Button>
              <Button
                variant="secondary"
                onClick={loadDemoCredential}
                className="w-full sm:w-auto gap-2 border border-slate-700"
              >
                <Sparkles className="h-4 w-4 text-violet-400" />
                Load Sample Degree
              </Button>
            </div>
            <p className="text-[11px] text-slate-500">
              All processing happens 100% locally in your browser. No private keys or unhashed credentials are sent to any server.
            </p>
          </div>
        </Card>
      ) : (
        /* ------------------------------------------------------------------ */
        /* Main Wallet Interface: Degree Card + Selective Disclosure Matrix  */
        /* ------------------------------------------------------------------ */
        <div className="space-y-8">
          {/* Degree Card (Visual Certificate Shell) */}
          <Card className="relative overflow-hidden border-indigo-950/60 bg-gradient-to-br from-slate-900 via-indigo-950/30 to-slate-950 shadow-2xl p-6 sm:p-8">
            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
              <Award className="h-48 w-48 text-indigo-400" />
            </div>

            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="default" className="text-xs">
                    ERC-5192 Soulbound
                  </Badge>
                  <Badge variant="success" className="text-xs">
                    Polygon Amoy
                  </Badge>
                  <span className="text-xs font-mono text-indigo-300">
                    Token #{credential.tokenId || 1}
                  </span>
                </div>

                <div>
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                    {degreeAttr}
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-400 mt-1 flex items-center gap-2">
                    <span>Issued by:</span>
                    <span className="font-mono text-indigo-300">
                      {credential.issuerAddress}
                    </span>
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300 pt-1">
                  <div>
                    <span className="text-slate-500">Contract:</span>{" "}
                    <span className="font-mono">{credential.contractAddress?.slice(0, 8)}...</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Committed Root:</span>{" "}
                    <span className="font-mono text-indigo-300">
                      {credential.rootHash?.slice(0, 10)}...{credential.rootHash?.slice(-6)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="gap-2 border-slate-700 text-xs"
                >
                  <Upload className="h-3.5 w-3.5" />
                  Replace Credential
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
            </div>
          </Card>

          {/* ---------------------------------------------------------------- */}
          {/* Selective Disclosure Matrix & Live QR Pipeline                   */}
          {/* ---------------------------------------------------------------- */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column: Selective Disclosure Matrix */}
            <div className="lg:col-span-7 space-y-4">
              <Card className="border-slate-800 bg-slate-900/60 shadow-xl">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-indigo-400" />
                      Selective Disclosure Matrix
                    </CardTitle>
                    <Badge variant="outline" className="text-xs">
                      {disclosedCount} of {credential.attributes.length} Disclosed
                    </Badge>
                  </div>
                  <CardDescription>
                    Toggle which attributes are revealed to the verifier. Attributes toggled &quot;Hide&quot; remain
                    cryptographically blinded and impossible to deduce.
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
                  {credential.attributes.map((attr) => {
                    const isRevealed = disclosedKeys[attr.key] ?? false;
                    const meta = ATTRIBUTE_LABELS[attr.key] || {
                      title: attr.key,
                      description: "Credential claim property",
                    };

                    return (
                      <div
                        key={attr.key}
                        className={`p-4 rounded-xl border transition-all flex items-center justify-between gap-4 ${
                          isRevealed
                            ? "border-indigo-500/40 bg-indigo-950/20"
                            : "border-slate-800/80 bg-slate-950/40 opacity-75"
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-white">
                              {meta.title}
                            </span>
                            {isRevealed ? (
                              <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                                <Eye className="h-3 w-3" /> Revealed
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-[10px] font-semibold text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                                <EyeOff className="h-3 w-3" /> Hidden (Blinded)
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400">{meta.description}</p>
                          <div className="pt-1 flex items-center gap-2">
                            <span className="text-xs font-mono font-medium text-indigo-300">
                              {isRevealed ? attr.value : "••••••••••••••••"}
                            </span>
                            {isRevealed && (
                              <span className="text-[10px] text-slate-500 font-mono truncate max-w-[140px]">
                                salt: {attr.salt.slice(0, 10)}...
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Toggle Switch */}
                        <div className="flex items-center gap-2">
                          <Switch
                            id={`switch-${attr.key}`}
                            checked={isRevealed}
                            onCheckedChange={() => toggleAttribute(attr.key)}
                          />
                        </div>
                      </div>
                    );
                  })}

                  {disclosedCount === 0 && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>No Attributes Selected</AlertTitle>
                      <AlertDescription>
                        You must disclose at least one attribute to generate a valid cryptographic proof.
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right Column: Live QR Code & Sharing Link */}
            <div className="lg:col-span-5 space-y-6">
              <Card className="border-slate-800 bg-slate-900/80 shadow-2xl">
                <CardHeader className="text-center pb-2">
                  <div className="mx-auto h-10 w-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20 mb-2">
                    <QrCode className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-base">Instant Verification QR Code</CardTitle>
                  <CardDescription className="text-xs">
                    Scan with any smartphone or camera to instantly verify disclosed credentials against Polygon Amoy.
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-6 flex flex-col items-center pt-2">
                  {/* Dynamic QR Code Canvas */}
                  <div className="p-4 bg-white rounded-2xl shadow-xl flex items-center justify-center border-4 border-indigo-500/20">
                    {compressedString ? (
                      <QRCodeSVG
                        value={getVerificationUrl()}
                        size={210}
                        level="M"
                        includeMargin={false}
                      />
                    ) : (
                      <div className="h-[210px] w-[210px] flex items-center justify-center text-slate-400 text-xs text-center p-4">
                        Select at least one attribute to generate proof QR
                      </div>
                    )}
                  </div>

                  {/* Summary of Disclosure */}
                  <div className="w-full text-xs text-slate-400 space-y-1.5 p-3 rounded-lg bg-slate-950/70 border border-slate-800">
                    <div className="flex justify-between items-center text-slate-300">
                      <span>Disclosed Claims:</span>
                      <span className="font-semibold text-indigo-400">
                        {disclosedCount} properties
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-slate-300">
                      <span>Payload Compression:</span>
                      <span className="font-mono text-emerald-400">
                        {compressedString ? `${compressedString.length} chars (LZ-String)` : "None"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-slate-300">
                      <span>Target Token ID:</span>
                      <span className="font-mono">#{credential.tokenId || 1}</span>
                    </div>
                  </div>

                  {/* Copy Link & Direct Open Actions */}
                  <div className="w-full space-y-2.5">
                    <Button
                      onClick={copyVerificationLink}
                      disabled={!compressedString}
                      className="w-full gap-2 text-sm"
                    >
                      {copiedLink ? (
                        <>
                          <Check className="h-4 w-4 text-emerald-300" />
                          Link Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4" />
                          Copy Instant Verification Link
                        </>
                      )}
                    </Button>

                    {compressedString && (
                      <Link
                        href={`/verify?data=${compressedString}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-full"
                      >
                        <Button
                          variant="secondary"
                          className="w-full gap-2 text-xs border border-slate-700 text-slate-300 hover:text-white"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          Test in Verification Portal
                        </Button>
                      </Link>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Security Explainer Card */}
              <Card className="border-slate-800 bg-slate-950/40">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-emerald-400" />
                    How Selective Disclosure Works
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-[11px] text-slate-400 space-y-2 leading-relaxed">
                  <p>
                    When you hide an attribute (like your Name or Roll Number), its raw string and salt
                    are removed from the generated payload.
                  </p>
                  <p>
                    Only the cryptographic hashes of sibling branches are sent. The verifier proves mathematically
                    that your revealed claims combine with those sibling hashes to match the official Merkle root on Polygon Amoy.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
