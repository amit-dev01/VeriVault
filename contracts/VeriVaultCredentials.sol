// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC5192} from "./interfaces/IERC5192.sol";

/**
 * @title VeriVaultCredentials
 * @notice ERC-5192 Soulbound Token smart contract for decentralized academic credentialing.
 */
contract VeriVaultCredentials is ERC721, AccessControl, IERC5192 {
    // --- Roles ---
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");

    // --- Custom Errors ---
    error ErrSoulboundToken();
    error ErrTokenNotFound();
    error ErrAlreadyRevoked();
    error ErrInvalidRecipient();
    error ErrInvalidRootHash();

    // --- State Storage ---
    struct Credential {
        bytes32 rootHash;
        address issuer;
        uint64 issuedAt;
        bool revoked;
        uint64 revokedAt;
        string revocationReason;
    }

    uint256 private _nextTokenId;
    mapping(uint256 => Credential) private _credentials;

    // --- Events ---
    event CredentialIssued(
        uint256 indexed tokenId,
        address indexed recipient,
        address indexed issuer,
        bytes32 rootHash,
        uint64 issuedAt
    );

    event CredentialRevoked(
        uint256 indexed tokenId,
        address indexed revoker,
        uint64 revokedAt,
        string reason
    );

    /**
     * @notice Initializes the VeriVault credential contract.
     * @param defaultAdmin Address to receive the DEFAULT_ADMIN_ROLE and ISSUER_ROLE.
     */
    constructor(address defaultAdmin) ERC721("VeriVault Academic Credential", "VVAC") {
        address admin = defaultAdmin == address(0) ? msg.sender : defaultAdmin;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ISSUER_ROLE, admin);
    }

    /**
     * @notice Issues an academic credential as a Soulbound Token.
     * @param recipient The student or recipient address.
     * @param rootHash The cryptographic root hash (e.g. Merkle root / IPFS digest) representing the credential.
     * @return tokenId The newly minted credential token identifier.
     */
    function issueCredential(
        address recipient,
        bytes32 rootHash
    ) external onlyRole(ISSUER_ROLE) returns (uint256) {
        if (recipient == address(0)) {
            revert ErrInvalidRecipient();
        }
        if (rootHash == bytes32(0)) {
            revert ErrInvalidRootHash();
        }

        uint256 tokenId = ++_nextTokenId;

        _safeMint(recipient, tokenId);

        uint64 timestamp = uint64(block.timestamp);

        _credentials[tokenId] = Credential({
            rootHash: rootHash,
            issuer: msg.sender,
            issuedAt: timestamp,
            revoked: false,
            revokedAt: 0,
            revocationReason: ""
        });

        // ERC-5192 event indicating this token is soulbound / permanently locked
        emit Locked(tokenId);

        // Custom domain event
        emit CredentialIssued(tokenId, recipient, msg.sender, rootHash, timestamp);

        return tokenId;
    }

    /**
     * @notice Revokes an issued credential with an on-chain reason.
     * @param tokenId The identifier of the credential to revoke.
     * @param reason The explanatory reason for revocation.
     */
    function revokeCredential(
        uint256 tokenId,
        string calldata reason
    ) external onlyRole(ISSUER_ROLE) {
        if (_ownerOf(tokenId) == address(0)) {
            revert ErrTokenNotFound();
        }

        Credential storage cred = _credentials[tokenId];
        if (cred.revoked) {
            revert ErrAlreadyRevoked();
        }

        uint64 timestamp = uint64(block.timestamp);
        cred.revoked = true;
        cred.revokedAt = timestamp;
        cred.revocationReason = reason;

        emit CredentialRevoked(tokenId, msg.sender, timestamp, reason);
    }

    /**
     * @notice Fetches the full credential data for a given token ID.
     * @param tokenId The identifier of the credential.
     */
    function getCredential(
        uint256 tokenId
    )
        external
        view
        returns (
            bytes32 rootHash,
            address issuer,
            uint64 issuedAt,
            bool revoked,
            uint64 revokedAt,
            string memory revocationReason
        )
    {
        if (_ownerOf(tokenId) == address(0)) {
            revert ErrTokenNotFound();
        }

        Credential storage cred = _credentials[tokenId];
        return (
            cred.rootHash,
            cred.issuer,
            cred.issuedAt,
            cred.revoked,
            cred.revokedAt,
            cred.revocationReason
        );
    }

    /**
     * @notice ERC-5192 standard function to check if a token is locked.
     * @param tokenId The identifier of the token.
     * @return True if the token is locked.
     */
    function locked(uint256 tokenId) external view override returns (bool) {
        if (_ownerOf(tokenId) == address(0)) {
            revert ErrTokenNotFound();
        }
        return true;
    }

    /**
     * @notice Returns total number of credentials minted.
     */
    function totalCredentials() external view returns (uint256) {
        return _nextTokenId;
    }

    /**
     * @dev Prevents any token transfer other than minting (from == 0) and burning (to == 0).
     */
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal virtual override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) {
            revert ErrSoulboundToken();
        }
        return super._update(to, tokenId, auth);
    }

    /**
     * @dev Interface support check for ERC721, AccessControl, and ERC-5192.
     */
    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual override(ERC721, AccessControl) returns (bool) {
        return interfaceId == type(IERC5192).interfaceId || super.supportsInterface(interfaceId);
    }
}
