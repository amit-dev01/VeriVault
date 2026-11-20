import { createPublicClient, http, fallback } from "viem";
import { polygonAmoy } from "viem/chains";

/**
 * High-availability public RPC endpoints for Polygon Amoy Testnet (Chain ID: 80002).
 * Multiple public nodes ensure continuous uptime and zero rate-limiting during live demos.
 */
export const POLYGON_AMOY_RPC_URLS = [
  process.env.NEXT_PUBLIC_POLYGON_AMOY_RPC_URL,
  "https://rpc-amoy.polygon.technology",
  "https://polygon-amoy.drpc.org",
  "https://rpc.ankr.com/polygon_amoy",
  "https://polygon-amoy-bor-rpc.publicnode.com",
].filter(Boolean) as string[];

/**
 * Resilient Viem transport combining multiple RPC providers with automatic failover.
 */
export const amoyTransport = fallback(
  POLYGON_AMOY_RPC_URLS.map((url) =>
    http(url, {
      timeout: 10_000,
      retryCount: 3,
      retryDelay: 800,
    })
  )
);

/**
 * Shared singleton public client for Polygon Amoy.
 * Executes contract reads and state checks without requiring user wallet signatures.
 */
export const publicClient = createPublicClient({
  chain: polygonAmoy,
  transport: amoyTransport,
});
