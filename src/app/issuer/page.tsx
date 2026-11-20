"use client";

import React, { useState } from "react";
import {
  useAccount,
  useChainId,
  useSwitchChain,
  useReadContract,
  useWriteContract,
  usePublicClient,
} from "wagmi";
import { polygonAmoy } from "wagmi/chains";
import { parseEventLogs, isAddress } from "viem";
import { toast } from "sonner";
import {
  GraduationCap,
  Award,
  Send,
  Ban,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  Download,
  CheckCircle2,
  Hash,
  User,
  BookOpen,
  Calendar,
  Sparkles,
  FileCode,
  Info,
  Wallet,
  Radio,
  Zap,
  Building2,
} from "lucide-react";
import { useConnectModal } from "@rainbow-me/rainbowkit";

import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

import { VERIVAULT_CONTRACT_ADDRESS, VERIVAULT_ABI } from "@/config/contract";
import {
  generateSalt,
  buildMerkleTree,
  AcademicAttribute,
  FullCredentialPayload,
} from "@/lib/crypto";

export default function IssuerPage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const { openConnectModal } = useConnectModal();

  const isPolygonAmoy = chainId === polygonAmoy.id;

  // --------------------------------------------------------------------------
  // 1. Role Verification
  // --------------------------------------------------------------------------
  const { data: issuerRoleHash } = useReadContract({
    address: VERIVAULT_CONTRACT_ADDRESS,
    abi: VERIVAULT_ABI,
    functionName: "ISSUER_ROLE",
    chainId: polygonAmoy.id,
  });

  const { data: hasIssuerRole, isLoading: isRoleLoading, refetch: refetchIssuerRole } = useReadContract({
    address: VERIVAULT_CONTRACT_ADDRESS,
    abi: VERIVAULT_ABI,
    functionName: "hasRole",
    args: address && issuerRoleHash ? [issuerRoleHash, address] : undefined,
    chainId: polygonAmoy.id,
    query: {
      enabled: !!address && !!issuerRoleHash && isPolygonAmoy,
    },
  });

  // --------------------------------------------------------------------------
  // 2. Issuance Form State
  // --------------------------------------------------------------------------
  const [mintMethod, setMintMethod] = useState<"relayer" | "wallet">("relayer");
  const [isAuthorizingRole, setIsAuthorizingRole] = useState(false);
  const [studentAddress, setStudentAddress] = useState("");
  const [fullName, setFullName] = useState("");
  const [rollNumber, setRollNumber] = useState("");
  const [degree, setDegree] = useState("");
  const [gradYear, setGradYear] = useState("2028");
  const [cgpaClaim, setCgpaClaim] = useState("CGPA >= 8.0");

  const [isMinting, setIsMinting] = useState(false);
  const [mintProgressStep, setMintProgressStep] = useState<string>("");
  const [mintedResult, setMintedResult] = useState<{
    tokenId: number;
    rootHash: string;
    txHash: string;
    payload: FullCredentialPayload;
  } | null>(null);

  // --------------------------------------------------------------------------
  // 3. Revocation Form State
  // --------------------------------------------------------------------------
  const [revokeTokenId, setRevokeTokenId] = useState("");
  const [revokeReason, setRevokeReason] = useState("");
  const [isRevoking, setIsRevoking] = useState(false);
  const [revokedResult, setRevokedResult] = useState<{
    tokenId: string;
    reason: string;
    txHash: string;
  } | null>(null);

  // --------------------------------------------------------------------------
  // Helper: Trigger JSON Download
  // --------------------------------------------------------------------------
  const triggerPayloadDownload = (payload: FullCredentialPayload, tokenId: number) => {
    const jsonString = JSON.stringify(payload, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `VeriVault-Credential-${tokenId}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  // --------------------------------------------------------------------------
  // Helper: Fill Demo Preset for Jadavpur University
  // --------------------------------------------------------------------------
  const fillDemoData = () => {
    setStudentAddress(address || "0x70997970C51812dc3A010C7d01b50e0d17dc79C8");
    setFullName("Aarav Sharma");
    setRollNumber("JU-CSE-2024-042");
    setDegree("B.Tech Computer Science & Engineering");
    setGradYear("2028");
    setCgpaClaim("CGPA >= 8.0");
    toast.success("Loaded mock data for Jadavpur University!");
  };

  // --------------------------------------------------------------------------
  // Handler: Self-Authorize Connected Wallet as Registrar (1-Click Testnet Demo)
  // --------------------------------------------------------------------------
  const handleSelfAuthorize = async () => {
    if (!address) {
      toast.error("Please connect your wallet first.");
      return;
    }
    try {
      setIsAuthorizingRole(true);
      const res = await fetch("/api/issuer/authorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetAddress: address }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to authorize address");
      }
      toast.success("Wallet successfully granted ISSUER_ROLE on Polygon Amoy!");
      await refetchIssuerRole();
    } catch (err: unknown) {
      const error = err as { message?: string };
      toast.error(`Authorization error: ${error?.message || "Failed"}`);
    } finally {
      setIsAuthorizingRole(false);
    }
  };

  // --------------------------------------------------------------------------
  // Handler: Generate & Mint Credential
  // --------------------------------------------------------------------------
  const handleIssueCredential = async (e: React.FormEvent) => {
    e.preventDefault();

    if (mintMethod === "wallet") {
      if (!isConnected) {
        toast.error("Please connect your wallet first.");
        return;
      }
      if (!isPolygonAmoy) {
        toast.error("Please switch your network to Polygon Amoy Testnet (Chain ID 80002).");
        return;
      }
    }

    if (!isAddress(studentAddress)) {
      toast.error("Invalid student Ethereum address. Please enter a valid 0x address.");
      return;
    }
    if (!fullName.trim() || !rollNumber.trim() || !degree.trim() || !gradYear.trim() || !cgpaClaim.trim()) {
      toast.error("Please fill in all credential fields.");
      return;
    }

    try {
      setIsMinting(true);
      setMintedResult(null);

      // Step 1: Generate individual cryptographic salts for each attribute
      setMintProgressStep("Generating cryptographically secure salts for each claim...");
      const attributes: AcademicAttribute[] = [
        {
          key: "NAME",
          value: fullName.trim(),
          salt: generateSalt(),
        },
        {
          key: "ROLL_NO",
          value: rollNumber.trim(),
          salt: generateSalt(),
        },
        {
          key: "DEGREE",
          value: degree.trim(),
          salt: generateSalt(),
        },
        {
          key: "GRAD_YEAR",
          value: gradYear.trim(),
          salt: generateSalt(),
        },
        {
          key: "CGPA_CLAIM",
          value: cgpaClaim.trim(),
          salt: generateSalt(),
        },
      ];

      // Step 2: Build Merkle Tree & extract rootHash
      setMintProgressStep("Constructing sorted Keccak-256 Merkle tree & computing root...");
      const { root: rootHash } = buildMerkleTree(attributes);

      let txHash = "";
      let mintedTokenId = 1;
      let actualIssuer = address || "0x95c9F3704D9851087C120B2f2de8369C9Bf66cb2";

      if (mintMethod === "relayer") {
        setMintProgressStep("Submitting on-chain via University Registrar Relayer (gasless)...");
        const res = await fetch("/api/issuer/mint-relayer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            studentAddress: studentAddress.trim(),
            rootHash,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || "Failed to mint via university relayer");
        }
        txHash = data.txHash;
        mintedTokenId = data.tokenId;
        actualIssuer = data.issuerAddress;
      } else {
        if (!publicClient) {
          throw new Error("Blockchain client is unavailable. Please check your connection.");
        }
        setMintProgressStep("Requesting signature: minting Soulbound Token on Polygon Amoy...");
        txHash = await writeContractAsync({
          address: VERIVAULT_CONTRACT_ADDRESS,
          abi: VERIVAULT_ABI,
          functionName: "issueCredential",
          args: [studentAddress as `0x${string}`, rootHash as `0x${string}`],
        });

        // Wait for block confirmation
        setMintProgressStep(`Awaiting block confirmation for transaction ${txHash.slice(0, 10)}...`);
        const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash as `0x${string}` });

        // Extract tokenId from event logs
        setMintProgressStep("Extracting minted Token ID from event logs...");
        try {
          const credentialLogs = parseEventLogs({
            abi: VERIVAULT_ABI,
            eventName: "CredentialIssued",
            logs: receipt.logs,
          });

          if (credentialLogs.length > 0 && credentialLogs[0].args.tokenId) {
            mintedTokenId = Number(credentialLogs[0].args.tokenId);
          } else {
            const transferLogs = parseEventLogs({
              abi: VERIVAULT_ABI,
              eventName: "Transfer",
              logs: receipt.logs,
            });
            if (transferLogs.length > 0 && transferLogs[0].args.tokenId) {
              mintedTokenId = Number(transferLogs[0].args.tokenId);
            }
          }
        } catch (err) {
          console.warn("Could not parse event log directly, defaulting tokenId to 1", err);
        }
      }

      // Step 6: Assemble FullCredentialPayload
      const payload: FullCredentialPayload = {
        tokenId: mintedTokenId,
        contractAddress: VERIVAULT_CONTRACT_ADDRESS,
        issuerAddress: actualIssuer,
        attributes,
        rootHash,
      };

      // Step 7: Automatically trigger download of credential file
      triggerPayloadDownload(payload, mintedTokenId);

      setMintedResult({
        tokenId: mintedTokenId,
        rootHash,
        txHash,
        payload,
      });

      toast.success(
        `Soulbound Credential #${mintedTokenId} successfully minted! Backup JSON downloaded.`
      );

      // Reset form fields
      setStudentAddress("");
      setFullName("");
      setRollNumber("");
      setDegree("");
    } catch (error: unknown) {
      console.error("Issuance failed:", error);
      const err = error as { shortMessage?: string; message?: string };
      const message =
        err?.shortMessage || err?.message || "Transaction failed. Please check permissions.";
      toast.error(`Issuance Error: ${message}`);
    } finally {
      setIsMinting(false);
      setMintProgressStep("");
    }
  };

  // --------------------------------------------------------------------------
  // Handler: Revoke Credential
  // --------------------------------------------------------------------------
  const handleRevokeCredential = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isConnected) {
      toast.error("Please connect your wallet first.");
      return;
    }
    if (!isPolygonAmoy) {
      toast.error("Please switch your network to Polygon Amoy Testnet (Chain ID 80002).");
      return;
    }
    if (!revokeTokenId.trim() || isNaN(Number(revokeTokenId))) {
      toast.error("Please provide a valid numeric Token ID.");
      return;
    }
    if (!revokeReason.trim()) {
      toast.error("Please provide a specific revocation reason for the audit trail.");
      return;
    }
    if (!publicClient) {
      toast.error("Blockchain client unavailable.");
      return;
    }

    try {
      setIsRevoking(true);
      setRevokedResult(null);

      const tokenIdBigInt = BigInt(revokeTokenId.trim());

      const txHash = await writeContractAsync({
        address: VERIVAULT_CONTRACT_ADDRESS,
        abi: VERIVAULT_ABI,
        functionName: "revokeCredential",
        args: [tokenIdBigInt, revokeReason.trim()],
      });

      await publicClient.waitForTransactionReceipt({ hash: txHash });

      setRevokedResult({
        tokenId: revokeTokenId.trim(),
        reason: revokeReason.trim(),
        txHash,
      });

      toast.success(`Credential #${revokeTokenId} revoked successfully.`);
      setRevokeTokenId("");
      setRevokeReason("");
    } catch (error: unknown) {
      console.error("Revocation failed:", error);
      const err = error as { shortMessage?: string; message?: string };
      const message =
        err?.shortMessage || err?.message || "Revocation failed. Ensure token exists and is active.";
      toast.error(`Revocation Error: ${message}`);
    } finally {
      setIsRevoking(false);
    }
  };

  return (
    <div className="container max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-600/20">
            <GraduationCap className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
              University Portal
              <Badge variant="outline" className="border-indigo-500/40 text-indigo-300 font-mono text-[10px]">
                Issuer Gateway
              </Badge>
            </h1>
            <p className="text-sm text-slate-400">
              Authorized Institution Interface for EIP-5192 Soulbound Degree Minting & Revocation
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Badge variant={isPolygonAmoy ? "success" : "destructive"} className="text-xs">
            {isPolygonAmoy ? "Polygon Amoy (80002)" : "Wrong Network"}
          </Badge>
          <a
            href={`https://amoy.polygonscan.com/address/${VERIVAULT_CONTRACT_ADDRESS}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-mono"
            title="Inspect on Polygonscan"
          >
            Contract
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* 1. Wallet & Role Verification Banners                                */}
      {/* -------------------------------------------------------------------- */}
      {!isConnected ? (
        <Alert variant="warning" className="border-amber-600/30 bg-amber-950/20">
          <ShieldAlert className="h-5 w-5 text-amber-400" />
          <AlertTitle className="text-amber-200">Wallet Not Connected</AlertTitle>
          <AlertDescription className="text-amber-300/80">
            You must connect an authorized university registrar wallet using the{" "}
            <strong>Connect Wallet</strong> button in the navigation bar to access issuance and
            revocation features.
          </AlertDescription>
        </Alert>
      ) : !isPolygonAmoy ? (
        <Alert variant="destructive">
          <ShieldAlert className="h-5 w-5 text-red-400" />
          <AlertTitle>Network Mismatch</AlertTitle>
          <AlertDescription className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-1">
            <span>
              Your wallet is connected to Chain ID {chainId}. VeriVault is deployed on{" "}
              <strong>Polygon Amoy Testnet (Chain ID 80002)</strong>.
            </span>
            <Button
              size="sm"
              variant="outline"
              className="border-red-500/50 text-red-200 hover:bg-red-900/40 shrink-0"
              onClick={() => switchChain?.({ chainId: polygonAmoy.id })}
            >
              Switch to Polygon Amoy
            </Button>
          </AlertDescription>
        </Alert>
      ) : isRoleLoading ? (
        <Alert variant="info">
          <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
          <AlertTitle>Checking Issuer Authorization...</AlertTitle>
          <AlertDescription>
            Validating `ISSUER_ROLE` permissions on contract {VERIVAULT_CONTRACT_ADDRESS}...
          </AlertDescription>
        </Alert>
      ) : !hasIssuerRole ? (
        <Alert variant="destructive">
          <ShieldAlert className="h-5 w-5 text-red-400" />
          <AlertTitle>Unauthorized Issuer Account</AlertTitle>
          <AlertDescription className="space-y-1">
            <p>
              Connected wallet <span className="font-mono text-red-200">{address}</span> does not
              have the <code className="px-1 py-0.5 rounded bg-red-950/60 font-mono text-[11px]">ISSUER_ROLE</code> on the VeriVault credential contract.
            </p>
            <p className="text-slate-400 text-[11px]">
              Only authorized university registrars can mint Soulbound academic credentials or
              record revocations. Please connect the contract admin or an account granted the role.
            </p>
          </AlertDescription>
        </Alert>
      ) : (
        <Alert variant="success" className="border-emerald-600/30 bg-emerald-950/20">
          <ShieldCheck className="h-5 w-5 text-emerald-400" />
          <AlertTitle className="text-emerald-200 flex items-center gap-2">
            Authorized Registrar
            <Badge variant="success" className="text-[10px] py-0 px-2">
              ISSUER_ROLE Active
            </Badge>
          </AlertTitle>
          <AlertDescription className="text-emerald-300/80">
            Authenticated as <span className="font-mono">{address}</span>. You can issue
            non-transferable Soulbound degrees and register cryptographic audit logs on Polygon Amoy.
          </AlertDescription>
        </Alert>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* Main Tabs: Issue Degree vs Revocation Registry                       */}
      {/* -------------------------------------------------------------------- */}
      <Tabs defaultValue="issue" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="issue" className="gap-2">
            <Send className="h-4 w-4" />
            Issue Degree
          </TabsTrigger>
          <TabsTrigger value="revoke" className="gap-2">
            <Ban className="h-4 w-4" />
            Revocation Registry
          </TabsTrigger>
        </TabsList>

        {/* ================================================================= */}
        {/* TAB 1: ISSUE DEGREE                                               */}
        {/* ================================================================= */}
        <TabsContent value="issue" className="space-y-6 pt-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Form Column */}
            <div className="lg:col-span-7">
              <Card className="border-slate-800 bg-slate-900/60 shadow-xl">
                <form onSubmit={handleIssueCredential}>
                  <CardHeader>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Award className="h-5 w-5 text-indigo-400" />
                        Academic Credential Specification
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={fillDemoData}
                          className="text-xs gap-1.5 h-8 border border-indigo-500/30 bg-indigo-950/40 text-indigo-300 hover:bg-indigo-900/60"
                        >
                          <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                          Fill Demo Data (Jadavpur University)
                        </Button>
                        <Badge variant="default" className="text-[10px]">
                          Zero-Plaintext
                        </Badge>
                      </div>
                    </div>
                    <CardDescription>
                      Every attribute is individually salted client-side and hashed into a Merkle tree.
                      Only the 32-byte Merkle root is recorded on Polygon Amoy.
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {/* Student Address */}
                    <div className="space-y-1.5">
                      <Label htmlFor="studentAddress" className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-indigo-400" />
                        Student Wallet Address (Recipient)
                      </Label>
                      <Input
                        id="studentAddress"
                        placeholder="0x71C...392"
                        value={studentAddress}
                        onChange={(e) => setStudentAddress(e.target.value)}
                        className="font-mono text-xs"
                        disabled={isMinting}
                        required
                      />
                      <p className="text-[11px] text-slate-500">
                        The graduate&apos;s self-custody wallet that will permanently hold the soulbound NFT.
                      </p>
                    </div>

                    {/* Student Full Name & Roll Number */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="fullName">Student Full Name</Label>
                        <Input
                          id="fullName"
                          placeholder="e.g. Aarav Sharma"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          disabled={isMinting}
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="rollNumber" className="flex items-center gap-1.5">
                          <Hash className="h-3.5 w-3.5 text-indigo-400" />
                          Roll / Registration Number
                        </Label>
                        <Input
                          id="rollNumber"
                          placeholder="e.g. JU-CSE-2024-042"
                          value={rollNumber}
                          onChange={(e) => setRollNumber(e.target.value)}
                          disabled={isMinting}
                          required
                        />
                      </div>
                    </div>

                    {/* Degree & Graduation Year */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="degree" className="flex items-center gap-1.5">
                          <BookOpen className="h-3.5 w-3.5 text-indigo-400" />
                          Degree / Program
                        </Label>
                        <Input
                          id="degree"
                          placeholder="e.g. B.Tech Computer Science"
                          value={degree}
                          onChange={(e) => setDegree(e.target.value)}
                          disabled={isMinting}
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="gradYear" className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-indigo-400" />
                          Graduation Year
                        </Label>
                        <Input
                          id="gradYear"
                          placeholder="e.g. 2028"
                          value={gradYear}
                          onChange={(e) => setGradYear(e.target.value)}
                          disabled={isMinting}
                          required
                        />
                      </div>
                    </div>

                    {/* CGPA Claim */}
                    <div className="space-y-1.5">
                      <Label htmlFor="cgpaClaim" className="flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                        Selective Disclosure Claim (CGPA / Honors)
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          id="cgpaClaim"
                          placeholder="e.g. CGPA >= 8.0"
                          value={cgpaClaim}
                          onChange={(e) => setCgpaClaim(e.target.value)}
                          disabled={isMinting}
                          className="flex-1"
                          required
                        />
                        <select
                          className="h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                          onChange={(e) => setCgpaClaim(e.target.value)}
                          disabled={isMinting}
                          defaultValue=""
                        >
                          <option value="" disabled>
                            Presets
                          </option>
                          <option value="CGPA >= 9.0">CGPA &gt;= 9.0 (Gold Medal)</option>
                          <option value="CGPA >= 8.5">CGPA &gt;= 8.5 (Distinction)</option>
                          <option value="CGPA >= 8.0">CGPA &gt;= 8.0 (First Class Honors)</option>
                          <option value="CGPA >= 7.5">CGPA &gt;= 7.5</option>
                          <option value="CGPA >= 7.0">CGPA &gt;= 7.0</option>
                        </select>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Enables zero-knowledge proof verification of academic merit without revealing exact GPA.
                      </p>
                    </div>

                    {/* Issuance Execution Channel Selection */}
                    <div className="space-y-2 pt-2">
                      <Label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                        <span>Issuance Execution Channel</span>
                        <Badge variant="outline" className="text-[10px] bg-indigo-950/40 border-indigo-500/30 text-indigo-300">
                          Polygon Amoy
                        </Badge>
                      </Label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setMintMethod("relayer")}
                          className={`p-3 rounded-lg border text-left transition-all flex flex-col justify-between ${
                            mintMethod === "relayer"
                              ? "border-indigo-500 bg-indigo-950/40 text-white shadow-sm ring-1 ring-indigo-500/50"
                              : "border-slate-800 bg-slate-900/50 text-slate-400 hover:border-slate-700"
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <Building2 className="h-4 w-4 text-indigo-400 shrink-0" />
                            <span className="text-xs font-bold text-slate-200">University Relayer</span>
                            <Badge className="ml-auto text-[9px] bg-emerald-500/20 text-emerald-400 border-0 px-1.5 py-0">Gasless</Badge>
                          </div>
                          <p className="text-[11px] text-slate-400 leading-tight">
                            Direct on-chain issuance via official registrar backend. 1-click testnet minting.
                          </p>
                        </button>

                        <button
                          type="button"
                          onClick={() => setMintMethod("wallet")}
                          className={`p-3 rounded-lg border text-left transition-all flex flex-col justify-between ${
                            mintMethod === "wallet"
                              ? "border-indigo-500 bg-indigo-950/40 text-white shadow-sm ring-1 ring-indigo-500/50"
                              : "border-slate-800 bg-slate-900/50 text-slate-400 hover:border-slate-700"
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <Wallet className="h-4 w-4 text-indigo-400 shrink-0" />
                            <span className="text-xs font-bold text-slate-200">Personal MetaMask</span>
                          </div>
                          <p className="text-[11px] text-slate-400 leading-tight">
                            Sign transaction directly using your connected browser wallet.
                          </p>
                        </button>
                      </div>
                    </div>

                    {/* Mint Progress Status */}
                    {isMinting && (
                      <div className="p-3 rounded-lg border border-indigo-500/30 bg-indigo-950/30 flex items-center gap-3">
                        <Loader2 className="h-4 w-4 animate-spin text-indigo-400 shrink-0" />
                        <span className="text-xs text-indigo-200">{mintProgressStep}</span>
                      </div>
                    )}
                  </CardContent>

                  <CardFooter className="pt-2">
                    {mintMethod === "relayer" ? (
                      <Button
                        type="submit"
                        disabled={isMinting}
                        className="w-full gap-2 text-base font-semibold py-6 bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/25 cursor-pointer"
                      >
                        {isMinting ? (
                          <>
                            <Loader2 className="h-5 w-5 animate-spin" />
                            Minting via University Registrar...
                          </>
                        ) : (
                          <>
                            <Award className="h-5 w-5" />
                            Generate & Mint Credential (Instant Relayer)
                          </>
                        )}
                      </Button>
                    ) : !isConnected ? (
                      <Button
                        type="button"
                        onClick={openConnectModal}
                        className="w-full gap-2 text-base font-semibold py-6 bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/25 cursor-pointer"
                      >
                        <Wallet className="h-5 w-5" />
                        Connect Wallet to Sign Transaction
                      </Button>
                    ) : !isPolygonAmoy ? (
                      <Button
                        type="button"
                        onClick={() => switchChain?.({ chainId: polygonAmoy.id })}
                        className="w-full gap-2 text-base font-semibold py-6 bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-500/25 cursor-pointer"
                      >
                        <Radio className="h-5 w-5 animate-pulse" />
                        Switch Network to Polygon Amoy (Chain 80002)
                      </Button>
                    ) : isRoleLoading ? (
                      <Button
                        type="button"
                        disabled
                        className="w-full gap-2 text-base font-semibold py-6 opacity-60"
                      >
                        <Loader2 className="h-5 w-5 animate-spin text-indigo-400" />
                        Verifying ISSUER_ROLE Authorization...
                      </Button>
                    ) : !hasIssuerRole ? (
                      <div className="w-full space-y-3">
                        <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-950/20 text-xs text-amber-200">
                          <div className="flex items-center gap-2 font-semibold text-amber-300 mb-1">
                            <ShieldAlert className="h-4 w-4 shrink-0" />
                            Wallet Not Yet Registered as University Issuer
                          </div>
                          <p className="text-slate-400 text-[11px]">
                            Connected: <span className="font-mono text-slate-300">{address?.slice(0, 8)}...{address?.slice(-6)}</span>.
                            You can self-authorize below for the demo, or switch to the University Relayer.
                          </p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <Button
                            type="button"
                            onClick={handleSelfAuthorize}
                            disabled={isAuthorizingRole}
                            className="w-full gap-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold py-5 cursor-pointer"
                          >
                            {isAuthorizingRole ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Authorizing On-Chain...
                              </>
                            ) : (
                              <>
                                <Zap className="h-4 w-4" />
                                ⚡ Authorize My Wallet
                              </>
                            )}
                          </Button>
                          <Button
                            type="button"
                            onClick={() => setMintMethod("relayer")}
                            variant="outline"
                            className="w-full gap-2 border-slate-700 hover:bg-slate-800 text-slate-300 text-xs font-semibold py-5 cursor-pointer"
                          >
                            <Building2 className="h-4 w-4 text-indigo-400" />
                            Use University Relayer
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        type="submit"
                        disabled={isMinting}
                        className="w-full gap-2 text-base font-semibold py-6 bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/25 cursor-pointer"
                      >
                        {isMinting ? (
                          <>
                            <Loader2 className="h-5 w-5 animate-spin" />
                            Minting Soulbound Credential...
                          </>
                        ) : (
                          <>
                            <Award className="h-5 w-5" />
                            Generate & Mint Credential (via MetaMask)
                          </>
                        )}
                      </Button>
                    )}
                  </CardFooter>
                </form>
              </Card>
            </div>

            {/* Results & Cryptographic Explainer Column */}
            <div className="lg:col-span-5 space-y-6">
              {/* Minted Success Card */}
              {mintedResult && (
                <Card className="border-emerald-600/40 bg-slate-900/90 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                  <CardHeader className="border-b border-slate-800 pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                        <CardTitle className="text-base text-emerald-200">
                          Credential #{mintedResult.tokenId} Minted
                        </CardTitle>
                      </div>
                      <Badge variant="success">EIP-5192 Soulbound</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-4 text-xs">
                    <div>
                      <span className="text-slate-400">On-Chain Token ID</span>
                      <p className="text-lg font-bold text-white font-mono">
                        #{mintedResult.tokenId}
                      </p>
                    </div>

                    <div>
                      <span className="text-slate-400">Committed Merkle Root</span>
                      <p className="font-mono text-indigo-300 break-all p-2 rounded bg-slate-950 border border-slate-800">
                        {mintedResult.rootHash}
                      </p>
                    </div>

                    <div>
                      <span className="text-slate-400">Polygon Amoy Transaction</span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="font-mono text-slate-300 truncate max-w-[220px]">
                          {mintedResult.txHash}
                        </span>
                        <a
                          href={`https://amoy.polygonscan.com/tx/${mintedResult.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-400 hover:text-white"
                          title="View on Polygonscan"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    </div>

                    <div className="pt-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                          triggerPayloadDownload(mintedResult.payload, mintedResult.tokenId)
                        }
                        className="w-full gap-2 border border-slate-700"
                      >
                        <Download className="h-4 w-4 text-indigo-400" />
                        Re-Download Credential JSON
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Protocol Architecture Card */}
              <Card className="border-slate-800 bg-slate-950/60">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2 text-slate-300">
                    <FileCode className="h-4 w-4 text-indigo-400" />
                    How VeriVault Ensures Privacy
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-xs text-slate-400 leading-relaxed">
                  <div className="flex items-start gap-2.5">
                    <span className="h-5 w-5 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                      1
                    </span>
                    <p>
                      <strong>Client-Side Salting:</strong> Every field is paired with 32 random bytes
                      to prevent dictionary and rainbow table attacks.
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="h-5 w-5 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                      2
                    </span>
                    <p>
                      <strong>Sorted Merkle Trees:</strong> Leaves are hashed as Keccak-256 digests.
                      The root is minted as a single 32-byte commitment.
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="h-5 w-5 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                      3
                    </span>
                    <p>
                      <strong>Zero Plaintext On-Chain:</strong> Student names, grades, and identifiers
                      never touch Polygon storage, ensuring full GDPR and FERPA compliance.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ================================================================= */}
        {/* TAB 2: REVOCATION REGISTRY                                        */}
        {/* ================================================================= */}
        <TabsContent value="revoke" className="space-y-6 pt-4">
          <div className="max-w-2xl mx-auto space-y-6">
            <Card className="border-red-950/40 bg-slate-900/60 shadow-xl">
              <form onSubmit={handleRevokeCredential}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2 text-red-200">
                      <Ban className="h-5 w-5 text-red-400" />
                      Revoke Issued Credential
                    </CardTitle>
                    <Badge variant="destructive">Immutable Audit</Badge>
                  </div>
                  <CardDescription>
                    Permanently flag an issued credential as revoked on Polygon Amoy with an immutable
                    on-chain explanatory reason.
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="revokeTokenId">Token ID to Revoke</Label>
                    <Input
                      id="revokeTokenId"
                      type="number"
                      min="1"
                      placeholder="e.g. 1"
                      value={revokeTokenId}
                      onChange={(e) => setRevokeTokenId(e.target.value)}
                      disabled={isRevoking}
                      className="font-mono text-sm"
                      required
                    />
                    <p className="text-[11px] text-slate-500">
                      The on-chain ERC-5192 token identifier of the target credential.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="revokeReason">Official Revocation Reason</Label>
                    <Input
                      id="revokeReason"
                      placeholder="e.g. Degree cancelled due to academic malpractice confirmed on 12-Oct-2024"
                      value={revokeReason}
                      onChange={(e) => setRevokeReason(e.target.value)}
                      disabled={isRevoking}
                      required
                    />
                    <p className="text-[11px] text-slate-500">
                      This explanation will be permanently visible to employers and verifiers worldwide.
                    </p>
                  </div>

                  <Alert variant="warning" className="border-amber-900/30 bg-amber-950/20">
                    <Info className="h-4 w-4 text-amber-400" />
                    <AlertTitle className="text-amber-300 text-xs">Irreversible Action</AlertTitle>
                    <AlertDescription className="text-slate-400 text-[11px]">
                      Once a credential is revoked on Polygon Amoy, its status cannot be undone. Public
                      verification queries will report the token as invalidated.
                    </AlertDescription>
                  </Alert>
                </CardContent>

                <CardFooter className="pt-2">
                  {!isConnected ? (
                    <Button
                      type="button"
                      onClick={openConnectModal}
                      className="w-full gap-2 text-base font-semibold py-6 bg-red-600 hover:bg-red-500 text-white shadow-lg cursor-pointer"
                    >
                      <Wallet className="h-5 w-5" />
                      Connect Wallet to Revoke Credential
                    </Button>
                  ) : !isPolygonAmoy ? (
                    <Button
                      type="button"
                      onClick={() => switchChain?.({ chainId: polygonAmoy.id })}
                      className="w-full gap-2 text-base font-semibold py-6 bg-amber-600 hover:bg-amber-500 text-white shadow-lg cursor-pointer"
                    >
                      <Radio className="h-5 w-5 animate-pulse" />
                      Switch Network to Polygon Amoy (Chain 80002)
                    </Button>
                  ) : isRoleLoading ? (
                    <Button
                      type="button"
                      disabled
                      className="w-full gap-2 text-base font-semibold py-6 opacity-60"
                    >
                      <Loader2 className="h-5 w-5 animate-spin text-red-400" />
                      Verifying ISSUER_ROLE Authorization...
                    </Button>
                  ) : !hasIssuerRole ? (
                    <div className="w-full space-y-3">
                      <div className="p-3 rounded-lg border border-red-500/30 bg-red-950/20 text-xs text-red-200">
                        <div className="flex items-center gap-2 font-semibold text-red-300 mb-1">
                          <ShieldAlert className="h-4 w-4 shrink-0" />
                          Wallet Lacks Registrar Role for Revocation
                        </div>
                        <p className="text-slate-400 text-[11px]">
                          Connected: <span className="font-mono text-slate-300">{address?.slice(0, 8)}...{address?.slice(-6)}</span>.
                          You can self-authorize below for testing on Polygon Amoy.
                        </p>
                      </div>
                      <Button
                        type="button"
                        onClick={handleSelfAuthorize}
                        disabled={isAuthorizingRole}
                        className="w-full gap-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold py-5 cursor-pointer"
                      >
                        {isAuthorizingRole ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Authorizing On-Chain...
                          </>
                        ) : (
                          <>
                            <Zap className="h-4 w-4" />
                            ⚡ 1-Click Authorize My Wallet as Registrar
                          </>
                        )}
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="submit"
                      variant="destructive"
                      disabled={isRevoking}
                      className="w-full gap-2 text-base font-semibold py-6 cursor-pointer"
                    >
                      {isRevoking ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin" />
                          Executing Revocation Transaction...
                        </>
                      ) : (
                        <>
                          <Ban className="h-5 w-5" />
                          Execute On-Chain Revocation
                        </>
                      )}
                    </Button>
                  )}
                </CardFooter>
              </form>
            </Card>

            {/* Revocation Result Card */}
            {revokedResult && (
              <Card className="border-red-900/50 bg-red-950/20 shadow-xl">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-red-400" />
                    <CardTitle className="text-base text-red-200">
                      Credential #{revokedResult.tokenId} Revoked
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-xs">
                  <div>
                    <span className="text-slate-400">Logged Reason:</span>
                    <p className="font-medium text-white mt-0.5">{revokedResult.reason}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Transaction Confirmation:</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="font-mono text-slate-300 truncate max-w-[280px]">
                        {revokedResult.txHash}
                      </span>
                      <a
                        href={`https://amoy.polygonscan.com/tx/${revokedResult.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-red-400 hover:text-red-200 inline-flex items-center gap-0.5"
                      >
                        Polygonscan
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
