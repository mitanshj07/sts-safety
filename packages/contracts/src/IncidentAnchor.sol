// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @title IncidentAnchor
/// @notice Tamper-evident anchoring of safety incidents, resolutions and E-FIR
///         documents produced by the Smart Tourist Safety System.
///
/// @dev WHY THIS EXISTS — the honest answer to "why blockchain?"
///
///      An incident record in Postgres can be edited or deleted by whoever holds
///      the database credentials. For a system whose output may become evidence
///      in a missing-person case, that is a real problem: a district
///      administration with a poor safety record has an incentive to quietly
///      revise history, and there is currently no way for MDoNER or a court to
///      detect it.
///
///      This contract stores only `keccak256` of the canonical incident record
///      plus the block timestamp. Nothing about the tourist, the location, or
///      the nature of the incident is published. Later, anyone can recompute the
///      hash from the database record and compare. A mismatch proves mutation;
///      a match plus the block timestamp proves the record existed, unchanged,
///      at that time. Backdating is impossible because the timestamp is the
///      chain's, not the application's.
///
///      That is the entire claim. It is small, it is verifiable, and it is
///      something a centralised database genuinely cannot do.
contract IncidentAnchor is AccessControl {
    bytes32 public constant ANCHOR_ROLE = keccak256("ANCHOR_ROLE");

    enum AnchorKind {
        None,
        Incident,
        Resolution,
        EFIR,
        ZoneDefinition
    }

    struct Anchor {
        bytes32 recordHash;   // keccak256 of the canonical JSON record
        uint256 touristToken; // TDID token id, 0 if not tourist-specific
        uint64 occurredAt;    // application-reported time of the event
        uint64 anchoredAt;    // block.timestamp — the authoritative one
        AnchorKind kind;
        uint8 severity;       // 0 info … 4 critical
        address submitter;
    }

    /// @dev incidentId is a UUID narrowed to bytes16 — collision-free for our scale
    ///      and half the calldata of bytes32.
    mapping(bytes16 incidentId => Anchor[]) private _anchors;

    uint256 public totalAnchors;

    event Anchored(
        bytes16 indexed incidentId,
        uint256 indexed touristToken,
        AnchorKind indexed kind,
        bytes32 recordHash,
        uint8 severity,
        uint64 occurredAt,
        uint64 anchoredAt,
        uint256 sequence
    );

    error NotAnchored(bytes16 incidentId);
    error EmptyHash();

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ANCHOR_ROLE, admin);
    }

    /// @notice Anchor a record. Multiple anchors per incident are expected:
    ///         one at creation, one at resolution, one per E-FIR revision.
    ///         The array is append-only, so the full chain of custody is on chain.
    function anchor(
        bytes16 incidentId,
        bytes32 recordHash,
        uint256 touristToken,
        AnchorKind kind,
        uint8 severity,
        uint64 occurredAt
    ) external onlyRole(ANCHOR_ROLE) returns (uint256 sequence) {
        sequence = _push(incidentId, recordHash, touristToken, kind, severity, occurredAt);
        unchecked {
            ++totalAnchors;
        }
    }

    /// @notice Gas-efficient batch anchoring, drained from the pending queue by
    ///         the pg_cron retry job.
    function anchorBatch(
        bytes16[] calldata incidentIds,
        bytes32[] calldata recordHashes,
        uint256[] calldata touristTokens,
        AnchorKind[] calldata kinds,
        uint8[] calldata severities,
        uint64[] calldata occurredAts
    ) external onlyRole(ANCHOR_ROLE) {
        uint256 n = incidentIds.length;
        require(
            recordHashes.length == n && touristTokens.length == n && kinds.length == n
                && severities.length == n && occurredAts.length == n,
            "length mismatch"
        );

        for (uint256 i; i < n; ++i) {
            _push(
                incidentIds[i],
                recordHashes[i],
                touristTokens[i],
                kinds[i],
                severities[i],
                occurredAts[i]
            );
        }

        unchecked {
            totalAnchors += n;
        }
    }

    /// @dev Shared append. Extracted so `anchorBatch` stays under the stack limit
    ///      without via-IR. Still append-only: no slot is ever overwritten.
    function _push(
        bytes16 incidentId,
        bytes32 recordHash,
        uint256 touristToken,
        AnchorKind kind,
        uint8 severity,
        uint64 occurredAt
    ) internal returns (uint256 sequence) {
        if (recordHash == bytes32(0)) revert EmptyHash();

        sequence = _anchors[incidentId].length;
        _anchors[incidentId].push(
            Anchor({
                recordHash: recordHash,
                touristToken: touristToken,
                occurredAt: occurredAt,
                anchoredAt: uint64(block.timestamp),
                kind: kind,
                severity: severity,
                submitter: msg.sender
            })
        );

        emit Anchored(
            incidentId, touristToken, kind, recordHash, severity,
            occurredAt, uint64(block.timestamp), sequence
        );
    }

    /// @notice THE integrity check. The dashboard calls this and renders a green
    ///         "verified on chain" badge or a red "integrity broken" badge.
    /// @param incidentId  UUID of the incident, narrowed to bytes16.
    /// @param recordHash  Hash recomputed from the current database record.
    /// @return matched    True if any anchor for this incident carries that hash.
    /// @return anchoredAt Block timestamp of the matching anchor, 0 if none.
    function verifyIntegrity(bytes16 incidentId, bytes32 recordHash)
        external
        view
        returns (bool matched, uint64 anchoredAt)
    {
        Anchor[] storage list = _anchors[incidentId];
        for (uint256 i = list.length; i > 0; --i) {
            if (list[i - 1].recordHash == recordHash) {
                return (true, list[i - 1].anchoredAt);
            }
        }
        return (false, 0);
    }

    function anchorsOf(bytes16 incidentId) external view returns (Anchor[] memory) {
        return _anchors[incidentId];
    }

    function anchorCount(bytes16 incidentId) external view returns (uint256) {
        return _anchors[incidentId].length;
    }

    function latestAnchor(bytes16 incidentId) external view returns (Anchor memory) {
        Anchor[] storage list = _anchors[incidentId];
        if (list.length == 0) revert NotAnchored(incidentId);
        return list[list.length - 1];
    }
}
