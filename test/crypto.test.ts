import hre from "hardhat";
import { expect } from "chai";
import {
  generateSalt,
  hashLeaf,
  hashLeafHex,
  buildMerkleTree,
  generateProof,
  verifyLeaf,
  compressPayload,
  decompressPayload,
  AcademicAttribute,
  VerificationProofPayload,
} from "../src/lib/crypto.ts";

describe("VeriVault Client-Side Cryptographic Engine", function () {
  const sampleAttributes: AcademicAttribute[] = [
    {
      key: "NAME",
      value: "Aarav Sharma",
      salt: "0x1111111111111111111111111111111111111111111111111111111111111111",
    },
    {
      key: "DEGREE",
      value: "B.Tech Computer Science & Engineering",
      salt: "0x2222222222222222222222222222222222222222222222222222222222222222",
    },
    {
      key: "GRAD_YEAR",
      value: "2028",
      salt: "0x3333333333333333333333333333333333333333333333333333333333333333",
    },
    {
      key: "CGPA_CLAIM",
      value: "CGPA >= 8.5",
      salt: "0x4444444444444444444444444444444444444444444444444444444444444444",
    },
  ];

  describe("generateSalt()", function () {
    it("should generate a 0x-prefixed 64-character hex string (32 bytes)", function () {
      const salt = generateSalt();
      expect(salt).to.match(/^0x[0-9a-fA-F]{64}$/);
      expect(salt.length).to.equal(66);
    });

    it("should generate unique cryptographically random salts on consecutive calls", function () {
      const saltA = generateSalt();
      const saltB = generateSalt();
      expect(saltA).to.not.equal(saltB);
    });
  });

  describe("hashLeaf() and hashLeafHex()", function () {
    it("should return a 32-byte Buffer", function () {
      const leaf = hashLeaf(sampleAttributes[0]);
      expect(Buffer.isBuffer(leaf)).to.be.true;
      expect(leaf.length).to.equal(32);
    });

    it("should be deterministic for identical inputs", function () {
      const leaf1 = hashLeaf(sampleAttributes[0]);
      const leaf2 = hashLeaf(sampleAttributes[0]);
      expect(leaf1.equals(leaf2)).to.be.true;
    });

    it("should produce a different hash when key, value, or salt changes", function () {
      const leafOriginal = hashLeaf(sampleAttributes[0]);

      const tamperedValue = hashLeaf({
        ...sampleAttributes[0],
        value: "Vikram Sharma",
      });
      const tamperedSalt = hashLeaf({
        ...sampleAttributes[0],
        salt: generateSalt(),
      });
      const tamperedKey = hashLeaf({
        ...sampleAttributes[0],
        key: "STUDENT_NAME",
      });

      expect(leafOriginal.equals(tamperedValue)).to.be.false;
      expect(leafOriginal.equals(tamperedSalt)).to.be.false;
      expect(leafOriginal.equals(tamperedKey)).to.be.false;
    });

    it("should format hashLeafHex with 0x prefix and 64 hex characters", function () {
      const hex = hashLeafHex(sampleAttributes[0]);
      expect(hex).to.match(/^0x[0-9a-fA-F]{64}$/);
      expect(hex.length).to.equal(66);
    });
  });

  describe("buildMerkleTree() & Merkle Proofs", function () {
    it("should build a Merkle tree and return a 32-byte root hash", function () {
      const { tree, root } = buildMerkleTree(sampleAttributes);

      expect(tree).to.exist;
      expect(root).to.match(/^0x[0-9a-fA-F]{64}$/);
      expect(root.length).to.equal(66);
    });

    it("should generate and verify valid Merkle proofs for every leaf", function () {
      const { tree, root } = buildMerkleTree(sampleAttributes);

      sampleAttributes.forEach((attr) => {
        const leaf = hashLeaf(attr);
        const proof = generateProof(tree, leaf);

        expect(Array.isArray(proof)).to.be.true;
        expect(proof.length).to.be.greaterThan(0);

        const isValid = verifyLeaf(leaf, proof, root);
        expect(isValid).to.be.true;
      });
    });

    it("should reject tampered leaf data against an authentic root", function () {
      const { tree, root } = buildMerkleTree(sampleAttributes);

      // Legit proof for DEGREE
      const targetAttr = sampleAttributes[1];
      const genuineLeaf = hashLeaf(targetAttr);
      const proof = generateProof(tree, genuineLeaf);

      // Fraudulent claim (fake degree with real salt)
      const tamperedAttr: AcademicAttribute = {
        ...targetAttr,
        value: "Ph.D. in Artificial Intelligence",
      };
      const forgedLeaf = hashLeaf(tamperedAttr);

      const isValid = verifyLeaf(forgedLeaf, proof, root);
      expect(isValid).to.be.false;
    });

    it("should reject valid proofs checked against an incorrect root", function () {
      const { tree: treeA } = buildMerkleTree(sampleAttributes);
      const { root: rootB } = buildMerkleTree([
        {
          key: "OTHER",
          value: "Unrelated Institution",
          salt: generateSalt(),
        },
      ]);

      const leaf = hashLeaf(sampleAttributes[0]);
      const proof = generateProof(treeA, leaf);

      const isValid = verifyLeaf(leaf, proof, rootB);
      expect(isValid).to.be.false;
    });
  });

  describe("Serialization & QR Compression Helpers", function () {
    it("should compress and decompress VerificationProofPayload without data loss", function () {
      const { tree } = buildMerkleTree(sampleAttributes);
      const targetAttr = sampleAttributes[3]; // CGPA_CLAIM
      const leaf = hashLeaf(targetAttr);
      const proof = generateProof(tree, leaf);

      const payload: VerificationProofPayload = {
        tokenId: 42,
        disclosedAttributes: [
          {
            key: targetAttr.key,
            value: targetAttr.value,
            salt: targetAttr.salt,
          },
        ],
        proof,
        leafIndexes: [3],
      };

      const compressed = compressPayload(payload);
      expect(typeof compressed).to.equal("string");
      expect(compressed.length).to.be.greaterThan(0);

      const restored = decompressPayload(compressed);
      expect(restored.tokenId).to.equal(payload.tokenId);
      expect(restored.disclosedAttributes).to.deep.equal(payload.disclosedAttributes);
      expect(restored.proof).to.deep.equal(payload.proof);
      expect(restored.leafIndexes).to.deep.equal(payload.leafIndexes);
    });

    it("should throw an error when decompressing malformed input", function () {
      expect(() => decompressPayload("invalid-corrupted-lz-string!@#$")).to.throw();
    });
  });

  describe("End-to-End Selective Disclosure Flow", function () {
    it("allows a student to disclose only CGPA without revealing Name or Graduation Year", function () {
      // 1. University issues credential with 4 attributes
      const { tree, root } = buildMerkleTree(sampleAttributes);

      // 2. Student chooses to disclose ONLY CGPA_CLAIM (e.g. for job application minimum GPA check)
      const disclosedAttr = sampleAttributes[3]; // CGPA_CLAIM: "CGPA >= 8.5"
      const leaf = hashLeaf(disclosedAttr);
      const proof = generateProof(tree, leaf);

      // 3. Student exports QR payload with ONLY the disclosed attribute and Merkle proof
      const proofPayload: VerificationProofPayload = {
        tokenId: 1,
        disclosedAttributes: [disclosedAttr],
        proof,
        leafIndexes: [3],
      };

      const qrString = compressPayload(proofPayload);

      // 4. Employer scans QR code and decompresses payload
      const receivedPayload = decompressPayload(qrString);

      // Employer recreates leaf from disclosed key, value, and salt
      const recreatedLeaf = hashLeaf(receivedPayload.disclosedAttributes[0]);

      // Employer validates leaf against on-chain root
      const isAuthentic = verifyLeaf(recreatedLeaf, receivedPayload.proof, root);

      expect(isAuthentic).to.be.true;
      expect(receivedPayload.disclosedAttributes[0].value).to.equal("CGPA >= 8.5");

      // Verify that employer NEVER received student's name, degree, or grad year
      expect(receivedPayload.disclosedAttributes.some((a) => a.key === "NAME")).to.be.false;
      expect(receivedPayload.disclosedAttributes.some((a) => a.key === "GRAD_YEAR")).to.be.false;
    });
  });
});
