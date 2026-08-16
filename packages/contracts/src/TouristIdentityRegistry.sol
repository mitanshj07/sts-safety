// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ITouristIdentityRegistry, IERC5192} from "./interfaces/ITouristIdentityRegistry.sol";

/// @title TouristIdentityRegistry
/// @notice Soulbound (ERC-5192) digital identity credentials for tourists,
///         issued by state tourism authorities and verifiable by any party.
/// @dev Reference implementation. See ITouristIdentityRegistry for the full
///      rationale behind each design invariant.
contract TouristIdentityRegistry is
    ERC721,
    AccessControl,
    Pausable,
    ITouristIdentityRegistry
{
    // -------------------------------------------------------------------------
    // Roles
    // -------------------------------------------------------------------------

    /// @dev Held by the backend relayer and by authorised state tourism desks.
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");

    /// @dev May suspend/reinstate but not issue. For police / control-room use.
    bytes32 public constant SUPERVISOR_ROLE = keccak256("SUPERVISOR_ROLE");

    /// @dev Hard cap on a credential's lifetime. A tourist visa credential
    ///      should never be effectively permanent.
    uint64 public constant MAX_VALIDITY = 365 days;

    // -------------------------------------------------------------------------
    // Storage
    // -------------------------------------------------------------------------

    uint256 private _nextTokenId = 1;
    uint256 private _totalIssued;

    mapping(uint256 tokenId => Identity) private _identities;
    mapping(uint256 tokenId => string) private _tokenURIs;
    mapping(address holder => uint256 tokenId) private _activeToken;

    /// @dev Public, append-only issuance log by issuer, for MDoNER-level audit.
    mapping(address issuer => uint256 count) public issuedByAuthority;

    // -------------------------------------------------------------------------
    // Construction
    // -------------------------------------------------------------------------

    constructor(address admin) ERC721("Tourist Digital Identity", "TDID") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ISSUER_ROLE, admin);
        _grantRole(SUPERVISOR_ROLE, admin);
    }

    // -------------------------------------------------------------------------
    // Issuance
    // -------------------------------------------------------------------------

    /// @inheritdoc ITouristIdentityRegistry
    function issue(
        address to,
        bytes32 kycCommitment,
        bytes32 itineraryHash,
        uint64 validFrom,
        uint64 validUntil,
        uint8 kycType,
        bytes2 nationality,
        string calldata metadataURI_
    ) external override onlyRole(ISSUER_ROLE) whenNotPaused returns (uint256 tokenId) {
        tokenId = _issue(
            to, kycCommitment, itineraryHash, validFrom, validUntil, kycType, nationality
        );
        if (bytes(metadataURI_).length != 0) {
            _tokenURIs[tokenId] = metadataURI_;
        }
    }

    /// @inheritdoc ITouristIdentityRegistry
    function issueBatch(
        address[] calldata to,
        bytes32[] calldata kycCommitments,
        bytes32 itineraryHash,
        uint64 validFrom,
        uint64 validUntil,
        uint8 kycType,
        bytes2 nationality
    ) external override onlyRole(ISSUER_ROLE) whenNotPaused returns (uint256[] memory tokenIds) {
        require(to.length == kycCommitments.length, "length mismatch");
        tokenIds = new uint256[](to.length);
        for (uint256 i; i < to.length; ++i) {
            tokenIds[i] = _issue(
                to[i], kycCommitments[i], itineraryHash, validFrom, validUntil, kycType, nationality
            );
        }
    }

    function _issue(
        address to,
        bytes32 kycCommitment,
        bytes32 itineraryHash,
        uint64 validFrom,
        uint64 validUntil,
        uint8 kycType,
        bytes2 nationality
    ) internal returns (uint256 tokenId) {
        if (kycCommitment == bytes32(0)) revert EmptyCommitment();
        if (validUntil <= validFrom) revert InvalidValidityWindow(validFrom, validUntil);
        if (validUntil - validFrom > MAX_VALIDITY) {
            revert ValidityWindowTooLong(validUntil - validFrom, MAX_VALIDITY);
        }

        uint256 existing = _activeToken[to];
        if (existing != 0 && _identities[existing].status == Status.Active) {
            revert HolderAlreadyHasActiveIdentity(to);
        }

        tokenId = _nextTokenId++;
        _identities[tokenId] = Identity({
            kycCommitment: kycCommitment,
            itineraryHash: itineraryHash,
            validFrom: validFrom,
            validUntil: validUntil,
            issuedAt: uint64(block.timestamp),
            status: Status.Active,
            kycType: kycType,
            nationality: nationality,
            issuer: msg.sender
        });
        _activeToken[to] = tokenId;

        unchecked {
            ++_totalIssued;
            ++issuedByAuthority[msg.sender];
        }

        _safeMint(to, tokenId);

        emit Locked(tokenId); // ERC-5192: locked at mint, forever
        emit IdentityIssued(tokenId, to, msg.sender, kycCommitment, validFrom, validUntil);
    }

    // -------------------------------------------------------------------------
    // Lifecycle
    // -------------------------------------------------------------------------

    function revoke(uint256 tokenId, bytes32 reasonCode)
        external
        override
        onlyRole(ISSUER_ROLE)
    {
        Identity storage id = _requireIdentity(tokenId);
        if (id.status == Status.Revoked) revert NotActive(tokenId, id.status);

        id.status = Status.Revoked;
        delete _activeToken[ownerOf(tokenId)];

        emit IdentityRevoked(tokenId, msg.sender, reasonCode, uint64(block.timestamp));
    }

    function suspend(uint256 tokenId, bytes32 reasonCode)
        external
        override
        onlyRole(SUPERVISOR_ROLE)
    {
        Identity storage id = _requireIdentity(tokenId);
        if (id.status != Status.Active) revert NotActive(tokenId, id.status);

        id.status = Status.Suspended;
        emit IdentitySuspended(tokenId, msg.sender, reasonCode);
    }

    function reinstate(uint256 tokenId) external override onlyRole(SUPERVISOR_ROLE) {
        Identity storage id = _requireIdentity(tokenId);
        if (id.status != Status.Suspended) revert NotActive(tokenId, id.status);

        id.status = Status.Active;
        emit IdentityReinstated(tokenId, msg.sender);
    }

    function extendValidity(uint256 tokenId, uint64 newValidUntil)
        external
        override
        onlyRole(ISSUER_ROLE)
    {
        Identity storage id = _requireIdentity(tokenId);
        if (id.status != Status.Active) revert NotActive(tokenId, id.status);
        if (newValidUntil <= id.validUntil) revert CannotShortenValidity();
        if (newValidUntil - id.validFrom > MAX_VALIDITY) {
            revert ValidityWindowTooLong(newValidUntil - id.validFrom, MAX_VALIDITY);
        }

        uint64 previous = id.validUntil;
        id.validUntil = newValidUntil;
        emit ValidityExtended(tokenId, previous, newValidUntil);
    }

    function updateItinerary(uint256 tokenId, bytes32 newItineraryHash)
        external
        override
        onlyRole(ISSUER_ROLE)
    {
        Identity storage id = _requireIdentity(tokenId);
        if (id.status != Status.Active) revert NotActive(tokenId, id.status);

        bytes32 previous = id.itineraryHash;
        id.itineraryHash = newItineraryHash;
        emit ItineraryUpdated(tokenId, previous, newItineraryHash, uint64(block.timestamp));
    }

    // -------------------------------------------------------------------------
    // Verification (free reads)
    // -------------------------------------------------------------------------

    function verify(uint256 tokenId)
        external
        view
        override
        returns (bool valid, Status status, uint64 validUntil, bytes32 commitment)
    {
        Identity memory id = _identities[tokenId];
        status = id.status;
        validUntil = id.validUntil;
        commitment = id.kycCommitment;
        valid = status == Status.Active
            && block.timestamp >= id.validFrom
            && block.timestamp <= id.validUntil;
    }

    function verifyKyc(uint256 tokenId, uint8 kycType, string calldata kycNumber, bytes32 salt)
        external
        view
        override
        returns (bool matches)
    {
        Identity memory id = _identities[tokenId];
        if (id.status == Status.None) return false;
        matches = id.kycCommitment == keccak256(abi.encodePacked(kycType, kycNumber, salt));
    }

    function identityOf(uint256 tokenId) external view override returns (Identity memory) {
        return _identities[tokenId];
    }

    function activeTokenOf(address holder) external view override returns (uint256) {
        return _activeToken[holder];
    }

    function isValid(uint256 tokenId) public view override returns (bool) {
        Identity memory id = _identities[tokenId];
        return id.status == Status.Active
            && block.timestamp >= id.validFrom
            && block.timestamp <= id.validUntil;
    }

    function totalIssued() external view override returns (uint256) {
        return _totalIssued;
    }

    // -------------------------------------------------------------------------
    // ERC-5192 soulbound enforcement
    // -------------------------------------------------------------------------

    function locked(uint256 tokenId) external view override returns (bool) {
        if (_identities[tokenId].status == Status.None) revert IdentityNotFound(tokenId);
        return true;
    }

    /// @dev The single chokepoint for every ERC-721 balance change in OZ v5.
    ///      Mint (from == 0) and burn (to == 0) are permitted; nothing else is.
    function _update(address to, uint256 tokenId, address auth)
        internal
        override
        returns (address)
    {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) {
            revert SoulboundTokenNonTransferable();
        }
        return super._update(to, tokenId, auth);
    }

    /// @dev Approvals are meaningless for a soulbound token; block them so no
    ///      integrator is misled into thinking a transfer could ever succeed.
    function approve(address, uint256) public pure override {
        revert SoulboundTokenNonTransferable();
    }

    function setApprovalForAll(address, bool) public pure override {
        revert SoulboundTokenNonTransferable();
    }

    // -------------------------------------------------------------------------
    // Metadata & introspection
    // -------------------------------------------------------------------------

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return _tokenURIs[tokenId];
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, AccessControl)
        returns (bool)
    {
        return interfaceId == type(IERC5192).interfaceId || super.supportsInterface(interfaceId);
    }

    // -------------------------------------------------------------------------
    // Emergency
    // -------------------------------------------------------------------------

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    // -------------------------------------------------------------------------
    // Internal
    // -------------------------------------------------------------------------

    function _requireIdentity(uint256 tokenId) private view returns (Identity storage id) {
        id = _identities[tokenId];
        if (id.status == Status.None) revert IdentityNotFound(tokenId);
    }
}
