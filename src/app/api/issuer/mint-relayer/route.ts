import { NextResponse } from "next/server";
import { createWalletClient, createPublicClient, http, parseEventLogs } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { polygonAmoy } from "viem/chains";
import { VERIVAULT_CONTRACT_ADDRESS, VERIVAULT_ABI } from "@/config/contract";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { studentAddress, rootHash } = body;

    if (!studentAddress || !studentAddress.startsWith("0x")) {
      return NextResponse.json(
        { error: "Invalid student recipient address." },
        { status: 400 }
      );
    }

    if (!rootHash || !rootHash.startsWith("0x")) {
      return NextResponse.json(
        { error: "Invalid Merkle root hash." },
        { status: 400 }
      );
    }

    const rawKey =
      process.env.PRIVATE_KEY ||
      "f9640baf876e3cfcb4b8744af1f2446232a2c550b3fc69c64e65f0f9e1dc474e";
    const privateKey = (rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`) as `0x${string}`;

    const account = privateKeyToAccount(privateKey);
    const rpcUrl =
      process.env.POLYGON_AMOY_RPC_URL ||
      process.env.NEXT_PUBLIC_POLYGON_AMOY_RPC_URL ||
      "https://polygon-amoy-bor-rpc.publicnode.com";

    const publicClient = createPublicClient({
      chain: polygonAmoy,
      transport: http(rpcUrl),
    });

    const walletClient = createWalletClient({
      account,
      chain: polygonAmoy,
      transport: http(rpcUrl),
    });

    // Execute issueCredential on Polygon Amoy
    const txHash = await walletClient.writeContract({
      address: VERIVAULT_CONTRACT_ADDRESS,
      abi: VERIVAULT_ABI,
      functionName: "issueCredential",
      args: [studentAddress as `0x${string}`, rootHash as `0x${string}`],
    });

    // Wait for block receipt
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

    let mintedTokenId = 1;
    try {
      const credentialLogs = parseEventLogs({
        abi: VERIVAULT_ABI,
        eventName: "CredentialIssued",
        logs: receipt.logs,
      });

      if (credentialLogs.length > 0 && credentialLogs[0].args.tokenId) {
        mintedTokenId = Number(credentialLogs[0].args.tokenId);
      }
    } catch {
      // Fallback
      mintedTokenId = 1;
    }

    return NextResponse.json({
      success: true,
      txHash,
      tokenId: mintedTokenId,
      issuerAddress: account.address,
      blockNumber: receipt.blockNumber.toString(),
    });
  } catch (error: unknown) {
    console.error("Relayer mint failed:", error);
    const err = error as { message?: string };
    return NextResponse.json(
      { error: err?.message || "Relayer failed to issue credential on Polygon Amoy." },
      { status: 500 }
    );
  }
}
