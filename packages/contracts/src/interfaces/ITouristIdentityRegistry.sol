// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ERC-5192 Minimal Soulbound Token interface
/// @dev A token is "locked" when it cannot be transferred. Tourist credentials
///      are permanently locked: transferring a government-issued identity would
///      defeat its purpose and create an obvious attack surface.
interface IERC5192 {
    event Locked(uint256 tokenId);
    event Unlocked(uint256 tokenId);

    /// @notice Returns the locking status of a token.
    /// @dev Reverts if the token does not exist.
    function locked(uint256 tokenId) external view returns (bool);
}

/// @title ITouristIdentityRegistry
/// @notice On-chain registry of tamper-evident, privacy-preserving tourist
///         identity credentials for the Smart Tourist Safety System.
///
/// @dev DESIGN INVARIANTS — these are the answers to the jury's questions:
///
///      1. NO PERSONAL DATA ON CHAIN. The registry stores only
///         `kycCommitment = keccak256(abi.encodePacked(kycType, kycNumber, salt))`.
///         The salt is a 32-byte random value stored encrypted off-chain in
///         Postgres. Without it, the commitment is computationally unlinkable
///         to any real person, satisfying data-minimisation obligations under
///         India's DPDP Act 2023 and the GDPR for foreign nationals.
///
///      2. SOULBOUND. Implements ERC-5192 with `locked() == true` for every
///         token. All transfer paths revert.
///
///      3. TIME-BOUND. `validFrom`/`validUntil` mirror the visa or trip window.
///         Expiry needs no off-chain job; `verify()` computes it from block time.
///
///      4. MULTI-PARTY REVOCATION REGISTRY. This is the actual reason a chain
///         is used rather than a database: the issuing state tourism department,
///         a hotel in another state, a forest permit office, and MDoNER as
///         auditor have no shared database. They share this registry.
///
///      5. APPEND-ONLY AUDIT. Every issuance, extension and revocation emits an
///         event. Nothing can be silently backdated or deleted.
///
///      6. GASLESS FOR TOURISTS. Only ISSUER_ROLE addresses (the backend
///         relayer) transact. Tourists never hold keys or gas.
interface ITouristIdentityRegistry is IERC5192 {
    // -------------------------------------------------------------------------
    // Types
    // -------------------------------------------------------------------------

    enum Status {
        None,       // 0 — token does not exist
        Active,     // 1 — issued and within its validity window
        Revoked,    // 2 — cancelled by an issuer (fraud, misuse, trip abort)
        Suspended   // 3 — temporarily frozen pending investigation
    }

    struct Identity {
        bytes32 kycCommitment;  // keccak256(kycType ‖ kycNumber ‖ salt)
        bytes32 itineraryHash;  // keccak256(canonical planned-itinerary JSON)
        uint64  validFrom;      // unix seconds
        uint64  validUntil;     // unix seconds
        uint64  issuedAt;       // unix seconds
        Status  status;
        uint8   kycType;        // 1 passport · 2 aadhaar · 3 voter · 4 licence
        bytes2  nationality;    // ISO 3166-1 alpha-2, e.g. "IN"
        address issuer;         // the authority that issued this credential
    }

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event IdentityIssued(
        uint256 indexed tokenId,
        address indexed holder,
        address indexed issuer,
        bytes32 kycCommitment,
        uint64  validFrom,
        uint64  validUntil
    );

    event IdentityRevoked(
        uint256 indexed tokenId,
        address indexed issuer,
        bytes32 reasonCode,
        uint64  revokedAt
    );

    event IdentitySuspended(uint256 indexed tokenId, address indexed issuer, bytes32 reasonCode);
    event IdentityReinstated(uint256 indexed tokenId, address indexed issuer);

    event ValidityExtended(
        uint256 indexed tokenId,
        uint64  previousValidUntil,
        uint64  newValidUntil
    );

    event ItineraryUpdated(
        uint256 indexed tokenId,
        bytes32 previousHash,
        bytes32 newHash,
        uint64  updatedAt
    );

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    error SoulboundTokenNonTransferable();
    error IdentityNotFound(uint256 tokenId);
    error HolderAlreadyHasActiveIdentity(address holder);
    error InvalidValidityWindow(uint64 validFrom, uint64 validUntil);
    error ValidityWindowTooLong(uint64 requested, uint64 maximum);
    error EmptyCommitment();
    error NotActive(uint256 tokenId, Status status);
    error CannotShortenValidity();

    // -------------------------------------------------------------------------
    // Write — restricted to ISSUER_ROLE
    // -------------------------------------------------------------------------

    /// @notice Issue a new soulbound tourist identity credential.
    /// @param to            Custodial address derived for this tourist (BIP-44).
    /// @param kycCommitment keccak256(kycType ‖ kycNumber ‖ salt). Must be non-zero.
    /// @param itineraryHash keccak256 of the canonical planned itinerary. May be zero.
    /// @param validFrom     Trip start, unix seconds.
    /// @param validUntil    Trip end + grace, unix seconds. Capped by MAX_VALIDITY.
    /// @param kycType       1 passport, 2 aadhaar, 3 voter id, 4 driving licence.
    /// @param nationality   ISO 3166-1 alpha-2 as bytes2.
    /// @param metadataURI_  Pointer to the signed W3C Verifiable Credential.
    /// @return tokenId      The newly minted, permanently locked token id.
    function issue(
        address to,
        bytes32 kycCommitment,
        bytes32 itineraryHash,
        uint64  validFrom,
        uint64  validUntil,
        uint8   kycType,
        bytes2  nationality,
        string calldata metadataURI_
    ) external returns (uint256 tokenId);

    /// @notice Batch issuance for a tour group arriving together. Saves gas and
    ///         matches the real-world check-post workflow.
    function issueBatch(
        address[] calldata to,
        bytes32[] calldata kycCommitments,
        bytes32   itineraryHash,
        uint64    validFrom,
        uint64    validUntil,
        uint8     kycType,
        bytes2    nationality
    ) external returns (uint256[] memory tokenIds);

    /// @notice Permanently revoke a credential.
    /// @param reasonCode Short bytes32 code, e.g. bytes32("FRAUD"), bytes32("TRIP_ABORTED").
    function revoke(uint256 tokenId, bytes32 reasonCode) external;

    /// @notice Temporarily suspend a credential pending investigation.
    function suspend(uint256 tokenId, bytes32 reasonCode) external;

    /// @notice Lift a suspension.
    function reinstate(uint256 tokenId) external;

    /// @notice Extend the validity window (visa extension, delayed departure).
    /// @dev Must not shorten; shortening is `revoke`.
    function extendValidity(uint256 tokenId, uint64 newValidUntil) external;

    /// @notice Record an itinerary change. Emits both hashes so the full history
    ///         of declared plans is reconstructable from events alone.
    function updateItinerary(uint256 tokenId, bytes32 newItineraryHash) external;

    // -------------------------------------------------------------------------
    // Read — free, permissionless. This is what a hotel or checkpoint calls.
    // -------------------------------------------------------------------------

    /// @notice Single-call verification. The primary integration point.
    /// @return valid       True iff Active and block.timestamp is inside the window.
    /// @return status      Raw status.
    /// @return validUntil  Expiry, so the verifier can display it.
    /// @return commitment  For optional selective-disclosure proof (see verifyKyc).
    function verify(uint256 tokenId)
        external
        view
        returns (bool valid, Status status, uint64 validUntil, bytes32 commitment);

    /// @notice Selective disclosure. A verifier who is handed (kycNumber, salt)
    ///         by the tourist can confirm the credential belongs to that document
    ///         without the number ever being written on chain.
    /// @dev Pure comparison against the stored commitment. Nothing is logged.
    function verifyKyc(uint256 tokenId, uint8 kycType, string calldata kycNumber, bytes32 salt)
        external
        view
        returns (bool matches);

    /// @notice Full identity record.
    function identityOf(uint256 tokenId) external view returns (Identity memory);

    /// @notice The active token for a holder address, or 0 if none.
    function activeTokenOf(address holder) external view returns (uint256);

    /// @notice Convenience predicate used by the dashboard's green/amber/red badge.
    function isValid(uint256 tokenId) external view returns (bool);

    /// @notice Total credentials ever issued. Used for the public stats panel.
    function totalIssued() external view returns (uint256);
}
