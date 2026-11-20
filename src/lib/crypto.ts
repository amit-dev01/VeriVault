import { Buffer } from "buffer";
import { MerkleTree } from "merkletreejs";
import keccak256 from "keccak256";
import LZString from "lz-string";

// ============================================================================
// 1. Type Definitions
// ============================================================================

export interface AcademicAttribute {
  key: string; // e.g. "NAME", "DEGREE", "GRAD_YEAR", "CGPA_CLAIM"
  value: string; // e.g. "Aarav Sharma", "B.Tech CSE", "2028", "CGPA >= 8.0"
  salt: string; // 32-byte hex string (0x-prefixed 64 hex characters)
}

export interface FullCredentialPayload {
  tokenId?: number;
  contractAddress: string;
  issuerAddress: string;
  attributes: AcademicAttribute[];
  rootHash: string;
}

export interface VerificationProofPayload {
  tokenId: number;
  disclosedAttributes: {
    key: string;
    value: string;
    salt: string;
  }[];
  proof: string[]; // Merkle proof siblings in hex
  leafIndexes: number[];
  proofs?: string[][]; // Optional individual proofs for each disclosed attribute
}

// ============================================================================
// 2. Core Cryptographic Functions
// ============================================================================

/**
 * Generates a cryptographically secure random 32-byte salt.
 * Returns a 0x-prefixed 64-character hex string.
 */
export function generateSalt(): string {
  const bytes = new Uint8Array(32);
  const cryptoObj =
    typeof globalThis !== "undefined" && globalThis.crypto
      ? globalThis.crypto
      : typeof window !== "undefined"
      ? window.crypto
      : undefined;

  if (cryptoObj?.getRandomValues) {
    cryptoObj.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 32; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `0x${hex}`;
}

/**
 * Computes keccak256 hash of a single academic attribute leaf formatted as:
 * "${attr.key}:${attr.value}:${attr.salt}"
 *
 * @param attr The academic attribute with key, value, and salt
 * @returns 32-byte Buffer containing the keccak256 leaf digest
 */
export function hashLeaf(attr: AcademicAttribute): Buffer {
  const rawString = `${attr.key}:${attr.value}:${attr.salt}`;
  const utf8Bytes = Buffer.from(rawString, "utf-8");
  return keccak256(utf8Bytes);
}

/**
 * Helper to get the 0x-prefixed hex representation of a hashed leaf.
 */
export function hashLeafHex(attr: AcademicAttribute): string {
  return `0x${hashLeaf(attr).toString("hex")}`;
}

/**
 * Constructs a Merkle tree from an array of academic attributes.
 * Uses keccak256 hashing and sortPairs: true for deterministic tree generation.
 *
 * @param attributes Array of AcademicAttribute objects
 * @returns Object containing the MerkleTree instance and hex root string
 */
export function buildMerkleTree(attributes: AcademicAttribute[]): {
  tree: MerkleTree;
  root: string;
} {
  const leaves = attributes.map((attr) => hashLeaf(attr));
  const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
  return {
    tree,
    root: tree.getHexRoot(),
  };
}

/**
 * Generates the Merkle proof for a target leaf in the tree.
 *
 * @param tree The constructed MerkleTree
 * @param targetLeaf The 32-byte Buffer of the leaf to prove
 * @returns Array of hex strings representing the Merkle proof siblings
 */
export function generateProof(tree: MerkleTree, targetLeaf: Buffer): string[] {
  return tree.getHexProof(targetLeaf);
}

/**
 * Validates a single leaf against the given Merkle root using the provided proof.
 *
 * @param leaf The 32-byte Buffer of the target leaf
 * @param proof Array of hex strings for the Merkle proof
 * @param root The 0x-prefixed hex string of the expected Merkle root
 * @returns True if the proof is cryptographically valid against the root
 */
export function verifyLeaf(
  leaf: Buffer,
  proof: string[],
  root: string
): boolean {
  return MerkleTree.verify(proof, leaf, root, keccak256, { sortPairs: true });
}

/**
 * Assembles a selective disclosure VerificationProofPayload from full credential attributes
 * and a list of disclosed attribute keys.
 */
export function buildSelectiveDisclosurePayload(
  fullCredential: FullCredentialPayload,
  disclosedKeys: string[]
): VerificationProofPayload {
  const { tree } = buildMerkleTree(fullCredential.attributes);
  const disclosedAttributes: AcademicAttribute[] = [];
  const leafIndexes: number[] = [];
  const proofs: string[][] = [];

  fullCredential.attributes.forEach((attr, idx) => {
    if (disclosedKeys.includes(attr.key)) {
      disclosedAttributes.push(attr);
      leafIndexes.push(idx);
      const leaf = hashLeaf(attr);
      proofs.push(tree.getHexProof(leaf));
    }
  });

  return {
    tokenId: fullCredential.tokenId || 0,
    disclosedAttributes,
    proof: proofs[0] || [],
    leafIndexes,
    proofs,
  };
}

// ============================================================================
// 3. Serialization & QR Compression Helpers
// ============================================================================

/**
 * Serializes a verification proof payload to JSON and compresses it
 * using LZ-String for efficient QR code generation and URL sharing.
 *
 * @param data VerificationProofPayload containing disclosed attributes and proof
 * @returns Compressed URI-encoded string
 */
export function compressPayload(data: VerificationProofPayload): string {
  const jsonString = JSON.stringify(data);
  return LZString.compressToEncodedURIComponent(jsonString);
}

/**
 * Decompresses an LZ-String URI-encoded string and parses it back
 * into a VerificationProofPayload object.
 *
 * @param compressed The compressed URI string
 * @returns VerificationProofPayload
 */
export function decompressPayload(compressed: string): VerificationProofPayload {
  const decompressed = LZString.decompressFromEncodedURIComponent(compressed);
  if (!decompressed) {
    throw new Error(
      "Failed to decompress proof payload: invalid, truncated, or corrupted data."
    );
  }
  return JSON.parse(decompressed) as VerificationProofPayload;
}
