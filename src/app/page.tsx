import Link from "next/link";
import {
  GraduationCap,
  Wallet,
  CheckCircle2,
  ShieldCheck,
  Lock,
  ArrowRight,
  Fingerprint,
  Zap,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex-1 flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full space-y-12">
      {/* Hero Section */}
      <div className="text-center space-y-4 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-xs font-semibold text-indigo-300">
          <Zap className="h-3.5 w-3.5 text-indigo-400" />
          <span>Deployed on Polygon Amoy Testnet (Chain ID 80002)</span>
        </div>

        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
          Decentralized Academic Credentials with{" "}
          <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-pink-400 bg-clip-text text-transparent">
            ERC-5192 Soulbound Tokens
          </span>
        </h1>

        <p className="text-base sm:text-lg text-slate-400 leading-relaxed max-w-2xl mx-auto">
          VeriVault provides tamper-proof, non-transferable degree verification with
          privacy-preserving selective disclosure proofs for students, universities, and employers.
        </p>
      </div>

      {/* 3 Core Portals Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
        {/* Portal 1: University Issuer */}
        <Card className="flex flex-col justify-between border-slate-800 bg-gradient-to-b from-slate-900 to-slate-950 hover:border-indigo-500/50 transition-all hover:shadow-indigo-500/10 hover:shadow-lg group">
          <CardHeader>
            <div className="h-12 w-12 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
              <GraduationCap className="h-6 w-6" />
            </div>
            <CardTitle className="text-xl">University Portal</CardTitle>
            <CardDescription>
              Authorized institution interface for issuing ERC-5192 Soulbound credentials and managing on-chain revocations.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="text-xs text-slate-400 space-y-1.5 list-disc list-inside">
              <li>Role-based access (`ISSUER_ROLE`)</li>
              <li>Gas-optimized Merkle root commitment</li>
              <li>Audit-logged credential revocation</li>
            </ul>
            <Link href="/issuer" className="block pt-2">
              <Button className="w-full gap-2 group-hover:bg-indigo-500 transition-colors">
                Launch Portal
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Portal 2: Student Wallet */}
        <Card className="flex flex-col justify-between border-slate-800 bg-gradient-to-b from-slate-900 to-slate-950 hover:border-violet-500/50 transition-all hover:shadow-violet-500/10 hover:shadow-lg group">
          <CardHeader>
            <div className="h-12 w-12 rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/20 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
              <Wallet className="h-6 w-6" />
            </div>
            <CardTitle className="text-xl">Student Privacy Wallet</CardTitle>
            <CardDescription>
              Self-sovereign vault holding non-transferable degree tokens with selective disclosure proof generation.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="text-xs text-slate-400 space-y-1.5 list-disc list-inside">
              <li>Soulbound SBT storage (EIP-5192)</li>
              <li>Selective attribute disclosure</li>
              <li>Zero-knowledge proof export</li>
            </ul>
            <Link href="/wallet" className="block pt-2">
              <Button variant="secondary" className="w-full gap-2 hover:bg-slate-700 transition-colors">
                Open Wallet
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Portal 3: Public Verifier */}
        <Card className="flex flex-col justify-between border-slate-800 bg-gradient-to-b from-slate-900 to-slate-950 hover:border-emerald-500/50 transition-all hover:shadow-emerald-500/10 hover:shadow-lg group">
          <CardHeader>
            <div className="h-12 w-12 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <CardTitle className="text-xl">Public Verifier</CardTitle>
            <CardDescription>
              Frictionless verification portal for employers and institutions to instantly validate diplomas without intermediaries.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="text-xs text-slate-400 space-y-1.5 list-disc list-inside">
              <li>Instant on-chain queries (no wallet needed)</li>
              <li>Real-time revocation check</li>
              <li>Cryptographic authenticity guarantee</li>
            </ul>
            <Link href="/verify" className="block pt-2">
              <Button variant="outline" className="w-full gap-2 hover:bg-slate-800 transition-colors">
                Verify Credential
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Protocol Architecture Features */}
      <div className="border border-slate-800 rounded-2xl bg-slate-900/40 p-6 sm:p-8 w-full max-w-4xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
          <div className="space-y-1.5">
            <Lock className="h-5 w-5 text-indigo-400 mx-auto" />
            <h4 className="text-sm font-semibold text-white">ERC-5192 Soulbound</h4>
            <p className="text-xs text-slate-400">
              Permanently locked tokens preventing academic credential trading or impersonation.
            </p>
          </div>
          <div className="space-y-1.5">
            <Fingerprint className="h-5 w-5 text-violet-400 mx-auto" />
            <h4 className="text-sm font-semibold text-white">Merkle Root Attestations</h4>
            <p className="text-xs text-slate-400">
              Compact 32-byte cryptographic hashes commit to complete transcript structures.
            </p>
          </div>
          <div className="space-y-1.5">
            <ShieldCheck className="h-5 w-5 text-emerald-400 mx-auto" />
            <h4 className="text-sm font-semibold text-white">Polygon Amoy Scalability</h4>
            <p className="text-xs text-slate-400">
              Low gas fees, sub-second confirmations, and full EVM developer toolchain compatibility.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
