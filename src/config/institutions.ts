/**
 * VeriVault Institutional Registry & Accreditation Directory
 * Inspired by GovTech Singapore's OpenCerts standard (DNS-TXT + On-Chain Issuer Identity Verification).
 */

export interface InstitutionalRegistryEntry {
  name: string;
  domain: string;
  accreditation: string;
  registryId: string;
  portalUrl: string;
  established: string;
  location: string;
}

export const KNOWN_INSTITUTIONS: Record<string, InstitutionalRegistryEntry> = {
  // Official Jadavpur University deployer/issuer account on Polygon Amoy
  "0x95c9f3704d9851087c120b2f2de8369c9bf66cb2": {
    name: "Jadavpur University",
    domain: "jadavpuruniversity.in",
    accreditation: "Approved by UGC & NAAC Grade A+",
    registryId: "AISHE: U-0570 | WB-STATE-1955",
    portalUrl: "https://jadavpuruniversity.in",
    established: "1955",
    location: "Kolkata, West Bengal, India",
  },
  // Local Hardhat node test account fallback
  "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266": {
    name: "Jadavpur University",
    domain: "jadavpuruniversity.in",
    accreditation: "Approved by UGC & NAAC Grade A+",
    registryId: "AISHE: U-0570 | WB-STATE-1955",
    portalUrl: "https://jadavpuruniversity.in",
    established: "1955",
    location: "Kolkata, West Bengal, India",
  },
};

/**
 * Resolves verified institutional metadata given an on-chain issuer address.
 * Case-insensitive lookup matching GovTech OpenCerts issuer identification.
 */
export function getInstitutionalData(issuerAddress: string): InstitutionalRegistryEntry | null {
  if (!issuerAddress) return null;
  return KNOWN_INSTITUTIONS[issuerAddress.toLowerCase().trim()] || null;
}
