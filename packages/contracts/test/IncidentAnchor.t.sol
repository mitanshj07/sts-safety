// packages/contracts/test/IncidentAnchor.t.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";

import {IncidentAnchor} from "../src/IncidentAnchor.sol";

contract IncidentAnchorTest is Test {
    IncidentAnchor internal anchors;

    address internal admin;
    address internal relayer;
    address internal stranger;
    bytes32 internal anchorRole;

    bytes16 internal constant INCIDENT_A = bytes16(uint128(0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa));
    bytes16 internal constant INCIDENT_B = bytes16(uint128(0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb));

    bytes32 internal constant HASH_V1 = keccak256("incident-core-v1");
    bytes32 internal constant HASH_V2 = keccak256("incident-core-v2");
    bytes32 internal constant HASH_RESOLVED = keccak256("resolution-core");

    function setUp() public {
        admin = makeAddr("admin");
        relayer = makeAddr("relayer");
        stranger = makeAddr("stranger");

        anchors = new IncidentAnchor(admin);
        anchorRole = anchors.ANCHOR_ROLE();
        vm.prank(admin);
        anchors.grantRole(anchorRole, relayer);
    }

    function _anchor(
        bytes16 incidentId,
        bytes32 recordHash,
        uint256 touristToken,
        IncidentAnchor.AnchorKind kind,
        uint8 severity,
        uint64 occurredAt
    ) internal returns (uint256 sequence) {
        vm.prank(relayer);
        sequence = anchors.anchor(incidentId, recordHash, touristToken, kind, severity, occurredAt);
    }

    function test_anchorIsAppendOnly() public {
        uint256 seq0 = _anchor(INCIDENT_A, HASH_V1, 1, IncidentAnchor.AnchorKind.Incident, 3, 1_700_000_000);
        uint256 seq1 = _anchor(INCIDENT_A, HASH_RESOLVED, 1, IncidentAnchor.AnchorKind.Resolution, 3, 1_700_000_100);
        uint256 seq2 = _anchor(INCIDENT_A, HASH_V2, 1, IncidentAnchor.AnchorKind.EFIR, 4, 1_700_000_200);

        assertEq(seq0, 0);
        assertEq(seq1, 1);
        assertEq(seq2, 2);
        assertEq(anchors.anchorCount(INCIDENT_A), 3);
        assertEq(anchors.totalAnchors(), 3);

        IncidentAnchor.Anchor[] memory list = anchors.anchorsOf(INCIDENT_A);
        assertEq(list.length, 3);
        assertEq(list[0].recordHash, HASH_V1);
        assertEq(list[1].recordHash, HASH_RESOLVED);
        assertEq(list[2].recordHash, HASH_V2);
        assertEq(uint8(list[0].kind), uint8(IncidentAnchor.AnchorKind.Incident));
        assertEq(list[0].submitter, relayer);
        assertEq(list[0].touristToken, 1);

        IncidentAnchor.Anchor memory latest = anchors.latestAnchor(INCIDENT_A);
        assertEq(latest.recordHash, HASH_V2);
        assertEq(uint8(latest.kind), uint8(IncidentAnchor.AnchorKind.EFIR));
    }

    function test_verifyIntegrityTrueAndFalsePaths() public {
        vm.warp(1_800_000_000);
        _anchor(INCIDENT_A, HASH_V1, 7, IncidentAnchor.AnchorKind.Incident, 2, 1_799_999_000);

        (bool matched, uint64 anchoredAt) = anchors.verifyIntegrity(INCIDENT_A, HASH_V1);
        assertTrue(matched);
        assertEq(anchoredAt, 1_800_000_000);

        (bool missed, uint64 zeroAt) = anchors.verifyIntegrity(INCIDENT_A, HASH_V2);
        assertFalse(missed);
        assertEq(zeroAt, 0);

        (bool unknown, uint64 unknownAt) = anchors.verifyIntegrity(INCIDENT_B, HASH_V1);
        assertFalse(unknown);
        assertEq(unknownAt, 0);
    }

    function test_verifyIntegrityWalksNewestFirst() public {
        vm.warp(1_000);
        _anchor(INCIDENT_A, HASH_V1, 1, IncidentAnchor.AnchorKind.Incident, 1, 900);

        vm.warp(2_000);
        _anchor(INCIDENT_A, HASH_V2, 1, IncidentAnchor.AnchorKind.EFIR, 1, 1_900);

        vm.warp(3_000);
        _anchor(INCIDENT_A, HASH_V1, 1, IncidentAnchor.AnchorKind.EFIR, 1, 2_900);

        (bool matched, uint64 anchoredAt) = anchors.verifyIntegrity(INCIDENT_A, HASH_V1);
        assertTrue(matched);
        assertEq(anchoredAt, 3_000, "newest matching hash must win");
    }

    function test_anchorBatch() public {
        bytes16[] memory ids = new bytes16[](3);
        bytes32[] memory hashes = new bytes32[](3);
        uint256[] memory tokens = new uint256[](3);
        IncidentAnchor.AnchorKind[] memory kinds = new IncidentAnchor.AnchorKind[](3);
        uint8[] memory severities = new uint8[](3);
        uint64[] memory occurred = new uint64[](3);

        ids[0] = INCIDENT_A;
        ids[1] = INCIDENT_B;
        ids[2] = INCIDENT_A;
        hashes[0] = HASH_V1;
        hashes[1] = HASH_V2;
        hashes[2] = HASH_RESOLVED;
        tokens[0] = 1;
        tokens[1] = 2;
        tokens[2] = 1;
        kinds[0] = IncidentAnchor.AnchorKind.Incident;
        kinds[1] = IncidentAnchor.AnchorKind.Incident;
        kinds[2] = IncidentAnchor.AnchorKind.Resolution;
        severities[0] = 3;
        severities[1] = 4;
        severities[2] = 3;
        occurred[0] = 10;
        occurred[1] = 11;
        occurred[2] = 12;

        vm.prank(relayer);
        anchors.anchorBatch(ids, hashes, tokens, kinds, severities, occurred);

        assertEq(anchors.totalAnchors(), 3);
        assertEq(anchors.anchorCount(INCIDENT_A), 2);
        assertEq(anchors.anchorCount(INCIDENT_B), 1);

        (bool okA,) = anchors.verifyIntegrity(INCIDENT_A, HASH_RESOLVED);
        (bool okB,) = anchors.verifyIntegrity(INCIDENT_B, HASH_V2);
        assertTrue(okA);
        assertTrue(okB);
        assertEq(anchors.latestAnchor(INCIDENT_A).recordHash, HASH_RESOLVED);
    }

    function test_anchorBatchLengthMismatchAndEmptyHash() public {
        bytes16[] memory ids = new bytes16[](2);
        bytes32[] memory hashes = new bytes32[](1);
        uint256[] memory tokens = new uint256[](2);
        IncidentAnchor.AnchorKind[] memory kinds = new IncidentAnchor.AnchorKind[](2);
        uint8[] memory severities = new uint8[](2);
        uint64[] memory occurred = new uint64[](2);
        ids[0] = INCIDENT_A;
        ids[1] = INCIDENT_B;

        vm.prank(relayer);
        vm.expectRevert("length mismatch");
        anchors.anchorBatch(ids, hashes, tokens, kinds, severities, occurred);

        bytes32[] memory emptyHashes = new bytes32[](2);
        emptyHashes[0] = HASH_V1;
        emptyHashes[1] = bytes32(0);
        uint256[] memory okTokens = new uint256[](2);

        vm.prank(relayer);
        vm.expectRevert(IncidentAnchor.EmptyHash.selector);
        anchors.anchorBatch(ids, emptyHashes, okTokens, kinds, severities, occurred);
    }

    function test_anchorRevertsEmptyHashAndUnauthorized() public {
        vm.prank(relayer);
        vm.expectRevert(IncidentAnchor.EmptyHash.selector);
        anchors.anchor(INCIDENT_A, bytes32(0), 1, IncidentAnchor.AnchorKind.Incident, 1, 1);

        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector,
                stranger,
                anchorRole
            )
        );
        anchors.anchor(INCIDENT_A, HASH_V1, 1, IncidentAnchor.AnchorKind.Incident, 1, 1);
    }

    function test_latestAnchorRevertsIfMissing() public {
        vm.expectRevert(abi.encodeWithSelector(IncidentAnchor.NotAnchored.selector, INCIDENT_A));
        anchors.latestAnchor(INCIDENT_A);

        assertEq(anchors.anchorCount(INCIDENT_A), 0);
        IncidentAnchor.Anchor[] memory empty = anchors.anchorsOf(INCIDENT_A);
        assertEq(empty.length, 0);
    }

    function test_anchorBatchUnauthorized() public {
        bytes16[] memory ids = new bytes16[](0);
        bytes32[] memory hashes = new bytes32[](0);
        uint256[] memory tokens = new uint256[](0);
        IncidentAnchor.AnchorKind[] memory kinds = new IncidentAnchor.AnchorKind[](0);
        uint8[] memory severities = new uint8[](0);
        uint64[] memory occurred = new uint64[](0);

        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector,
                stranger,
                anchorRole
            )
        );
        anchors.anchorBatch(ids, hashes, tokens, kinds, severities, occurred);
    }

    function test_emptyBatchIsNoop() public {
        bytes16[] memory ids = new bytes16[](0);
        bytes32[] memory hashes = new bytes32[](0);
        uint256[] memory tokens = new uint256[](0);
        IncidentAnchor.AnchorKind[] memory kinds = new IncidentAnchor.AnchorKind[](0);
        uint8[] memory severities = new uint8[](0);
        uint64[] memory occurred = new uint64[](0);

        vm.prank(relayer);
        anchors.anchorBatch(ids, hashes, tokens, kinds, severities, occurred);
        assertEq(anchors.totalAnchors(), 0);
    }

    function test_zoneDefinitionKind() public {
        uint256 seq = _anchor(
            INCIDENT_B, keccak256("zone-def"), 0, IncidentAnchor.AnchorKind.ZoneDefinition, 0, 42
        );
        assertEq(seq, 0);
        IncidentAnchor.Anchor memory row = anchors.latestAnchor(INCIDENT_B);
        assertEq(uint8(row.kind), uint8(IncidentAnchor.AnchorKind.ZoneDefinition));
        assertEq(row.touristToken, 0);
        assertEq(row.severity, 0);
        assertEq(row.occurredAt, 42);
    }
}
