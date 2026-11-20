import { expect } from "chai";
import hre from "hardhat";
import { VeriVaultCredentials } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

const { ethers } = hre;

describe("VeriVaultCredentials Smart Contract", function () {
  let contract: VeriVaultCredentials;
  let admin: HardhatEthersSigner;
  let issuer: HardhatEthersSigner;
  let student1: HardhatEthersSigner;
  let student2: HardhatEthersSigner;
  let nonAuthorized: HardhatEthersSigner;

  const sampleRootHash = ethers.keccak256(ethers.toUtf8Bytes("diploma-root-hash-student-1"));
  const sampleRootHash2 = ethers.keccak256(ethers.toUtf8Bytes("diploma-root-hash-student-2"));

  beforeEach(async function () {
    [admin, issuer, student1, student2, nonAuthorized] = await ethers.getSigners();

    const VeriVaultCredentialsFactory = await ethers.getContractFactory("VeriVaultCredentials");
    contract = await VeriVaultCredentialsFactory.deploy(admin.address);
    await contract.waitForDeployment();

    // Grant ISSUER_ROLE to issuer account
    const ISSUER_ROLE = await contract.ISSUER_ROLE();
    await contract.connect(admin).grantRole(ISSUER_ROLE, issuer.address);
  });

  describe("Initialization & Roles", function () {
    it("should set DEFAULT_ADMIN_ROLE and ISSUER_ROLE to the initial admin", async function () {
      const DEFAULT_ADMIN_ROLE = await contract.DEFAULT_ADMIN_ROLE();
      const ISSUER_ROLE = await contract.ISSUER_ROLE();

      expect(await contract.hasRole(DEFAULT_ADMIN_ROLE, admin.address)).to.be.true;
      expect(await contract.hasRole(ISSUER_ROLE, admin.address)).to.be.true;
      expect(await contract.hasRole(ISSUER_ROLE, issuer.address)).to.be.true;
      expect(await contract.hasRole(ISSUER_ROLE, nonAuthorized.address)).to.be.false;
    });

    it("should support ERC-5192, ERC-721, and AccessControl interfaces", async function () {
      const ERC5192_INTERFACE_ID = "0xb45a3c0e";
      const ERC721_INTERFACE_ID = "0x80ac58cd";
      const ACCESS_CONTROL_INTERFACE_ID = "0x7965db0b";

      expect(await contract.supportsInterface(ERC5192_INTERFACE_ID)).to.be.true;
      expect(await contract.supportsInterface(ERC721_INTERFACE_ID)).to.be.true;
      expect(await contract.supportsInterface(ACCESS_CONTROL_INTERFACE_ID)).to.be.true;
    });
  });

  describe("Credential Issuance", function () {
    it("should allow an account with ISSUER_ROLE to issue a credential", async function () {
      const tx = await contract.connect(issuer).issueCredential(student1.address, sampleRootHash);
      await tx.wait();

      expect(await contract.ownerOf(1)).to.equal(student1.address);
      expect(await contract.totalCredentials()).to.equal(1);

      // Verify ERC-5192 Locked event and CredentialIssued event
      await expect(contract.connect(issuer).issueCredential(student2.address, sampleRootHash2))
        .to.emit(contract, "Locked")
        .withArgs(2)
        .and.to.emit(contract, "CredentialIssued");
    });

    it("should revert if a non-issuer tries to issue a credential", async function () {
      await expect(
        contract.connect(nonAuthorized).issueCredential(student1.address, sampleRootHash)
      ).to.be.revertedWithCustomError(contract, "AccessControlUnauthorizedAccount");
    });

    it("should revert if recipient is zero address or rootHash is zero", async function () {
      await expect(
        contract.connect(issuer).issueCredential(ethers.ZeroAddress, sampleRootHash)
      ).to.be.revertedWithCustomError(contract, "ErrInvalidRecipient");

      await expect(
        contract.connect(issuer).issueCredential(student1.address, ethers.ZeroHash)
      ).to.be.revertedWithCustomError(contract, "ErrInvalidRootHash");
    });

    it("should correctly store credential data and retrieve via getCredential", async function () {
      await contract.connect(issuer).issueCredential(student1.address, sampleRootHash);

      const [rootHash, issuerAddress, issuedAt, revoked, revokedAt, revocationReason] =
        await contract.getCredential(1);

      expect(rootHash).to.equal(sampleRootHash);
      expect(issuerAddress).to.equal(issuer.address);
      expect(issuedAt).to.be.greaterThan(0);
      expect(revoked).to.be.false;
      expect(revokedAt).to.equal(0);
      expect(revocationReason).to.equal("");
    });

    it("should return locked = true for valid tokens and revert for non-existent tokens", async function () {
      await contract.connect(issuer).issueCredential(student1.address, sampleRootHash);

      expect(await contract.locked(1)).to.be.true;

      await expect(contract.locked(999)).to.be.revertedWithCustomError(
        contract,
        "ErrTokenNotFound"
      );
    });
  });

  describe("Soulbound Transfer Restriction", function () {
    it("should revert on standard transferFrom with ErrSoulboundToken", async function () {
      await contract.connect(issuer).issueCredential(student1.address, sampleRootHash);

      await expect(
        contract.connect(student1).transferFrom(student1.address, student2.address, 1)
      ).to.be.revertedWithCustomError(contract, "ErrSoulboundToken");
    });

    it("should revert on safeTransferFrom with ErrSoulboundToken", async function () {
      await contract.connect(issuer).issueCredential(student1.address, sampleRootHash);

      await expect(
        contract.connect(student1)["safeTransferFrom(address,address,uint256)"](
          student1.address,
          student2.address,
          1
        )
      ).to.be.revertedWithCustomError(contract, "ErrSoulboundToken");
    });
  });

  describe("Credential Revocation", function () {
    beforeEach(async function () {
      await contract.connect(issuer).issueCredential(student1.address, sampleRootHash);
    });

    it("should allow ISSUER_ROLE to revoke a credential and record reason", async function () {
      const reason = "Degree revoked due to academic dishonesty";

      await expect(contract.connect(issuer).revokeCredential(1, reason))
        .to.emit(contract, "CredentialRevoked");

      const [, , , revoked, revokedAt, recordedReason] = await contract.getCredential(1);

      expect(revoked).to.be.true;
      expect(revokedAt).to.be.greaterThan(0);
      expect(recordedReason).to.equal(reason);
    });

    it("should revert if non-issuer attempts revocation", async function () {
      await expect(
        contract.connect(nonAuthorized).revokeCredential(1, "unauthorized attempt")
      ).to.be.revertedWithCustomError(contract, "AccessControlUnauthorizedAccount");
    });

    it("should revert if token does not exist", async function () {
      await expect(
        contract.connect(issuer).revokeCredential(999, "Token does not exist")
      ).to.be.revertedWithCustomError(contract, "ErrTokenNotFound");
    });

    it("should revert if token is already revoked", async function () {
      await contract.connect(issuer).revokeCredential(1, "First revocation");

      await expect(
        contract.connect(issuer).revokeCredential(1, "Second revocation attempt")
      ).to.be.revertedWithCustomError(contract, "ErrAlreadyRevoked");
    });
  });
});
