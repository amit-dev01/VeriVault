import { NextResponse } from "next/server";
import { createWalletClient, createPublicClient, http, keccak256, toHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { polygonAmoy } from "viem/chains";
import { VERIVAULT_CONTRACT_ADDRESS, VERIVAULT_ABI } from "@/config/contract";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { targetAddress } = body;

    if (!targetAddress || !targetAddress.startsWith("0x")) {
      return NextResponse.json(
        { error: "Invalid target Ethereum address provided." },
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

    const issuerRoleHash = keccak256(toHex("ISSUER_ROLE"));

    // Check if target already has role
    const alreadyHasRole = await publicClient.readContract({
      address: VERIVAULT_CONTRACT_ADDRESS,
      abi: VERIVAULT_ABI,
      functionName: "hasRole",
      args: [issuerRoleHash, targetAddress as `0x${string}`],
    });

    if (alreadyHasRole) {
      return NextResponse.json({
        success: true,
        alreadyAuthorized: true,
        message: "Address is already authorized as an accredited issuer.",
      });
    }

    // Submit grantRole transaction
    const txHash = await walletClient.writeContract({
      address: VERIVAULT_CONTRACT_ADDRESS,
      abi: VERIVAULT_ABI,
      functionName: "grantRole",
      args: [issuerRoleHash, targetAddress as `0x${string}`],
    });

    // Wait for 1 confirmation
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

    return NextResponse.json({
      success: true,
      txHash,
      blockNumber: receipt.blockNumber.toString(),
      message: `Successfully granted ISSUER_ROLE to ${targetAddress} on Polygon Amoy.`,
    });
  } catch (error: unknown) {
    console.error("Failed to grant role:", error);
    const err = error as { message?: string };
    return NextResponse.json(
      { error: err?.message || "Failed to grant ISSUER_ROLE on Polygon Amoy." },
      { status: 500 }
    );
  }
}
