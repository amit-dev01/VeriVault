import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { polygonAmoy } from "wagmi/chains";
import { amoyTransport } from "@/lib/rpc";

// Standard public WalletConnect Project ID for demo / testnet environments
// Can be customized with NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
const walletConnectProjectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ||
  "3a8170812b534d0ff9d794f19a901d64";

export const wagmiConfig = getDefaultConfig({
  appName: "VeriVault Credentialing",
  projectId: walletConnectProjectId,
  chains: [polygonAmoy],
  transports: {
    [polygonAmoy.id]: amoyTransport,
  },
  ssr: true,
});
