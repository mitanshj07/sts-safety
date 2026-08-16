// packages/contracts/test/Invariants.t.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {TouristIdentityRegistry} from "../src/TouristIdentityRegistry.sol";
import {ITouristIdentityRegistry} from "../src/interfaces/ITouristIdentityRegistry.sol";

/// @dev Stateful fuzzer. Every issued token must remain with its original
///      non-zero mintee — no sequence of calls may move it to another EOA.
contract IdentityHandler is Test {
    TouristIdentityRegistry public immutable registry;
    address public immutable admin;

    address[] public tourists;
    uint256[] public issuedIds;
    mapping(uint256 tokenId => address mintee) public minteeOf;

    uint256 public ghostIssued;

    constructor(TouristIdentityRegistry registry_, address admin_, address[] memory tourists_) {
        registry = registry_;
        admin = admin_;
        for (uint256 i; i < tourists_.length; ++i) {
            tourists.push(tourists_[i]);
        }
    }

    function issuedCount() external view returns (uint256) {
        return issuedIds.length;
    }

    function touristCount() external view returns (uint256) {
        return tourists.length;
    }

    function issue(uint256 touristIdx, uint64 duration, bytes32 salt) public {
        address to = tourists[touristIdx % tourists.length];
        uint256 existing = registry.activeTokenOf(to);
        if (existing != 0) {
            ITouristIdentityRegistry.Identity memory current = registry.identityOf(existing);
            if (current.status == ITouristIdentityRegistry.Status.Active) return;
        }

        duration = uint64(bound(duration, 1, registry.MAX_VALIDITY()));
        uint64 validFrom = uint64(block.timestamp);
        bytes32 commitment = salt;
        if (commitment == bytes32(0)) {
            commitment = keccak256(abi.encode(to, ghostIssued, duration));
        }

        vm.prank(admin);
        uint256 tokenId = registry.issue(
            to, commitment, keccak256(abi.encode(ghostIssued)), validFrom, validFrom + duration, 1, bytes2("IN"), ""
        );
        minteeOf[tokenId] = to;
        issuedIds.push(tokenId);
        ++ghostIssued;
    }

    function revoke(uint256 idIdx, bytes32 reason) public {
        if (issuedIds.length == 0) return;
        uint256 tokenId = issuedIds[idIdx % issuedIds.length];
        ITouristIdentityRegistry.Identity memory id = registry.identityOf(tokenId);
        if (id.status == ITouristIdentityRegistry.Status.Revoked) return;
        vm.prank(admin);
        registry.revoke(tokenId, reason);
    }

    function suspend(uint256 idIdx) public {
        if (issuedIds.length == 0) return;
        uint256 tokenId = issuedIds[idIdx % issuedIds.length];
        ITouristIdentityRegistry.Identity memory id = registry.identityOf(tokenId);
        if (id.status != ITouristIdentityRegistry.Status.Active) return;
        vm.prank(admin);
        registry.suspend(tokenId, bytes32("INVESTIGATION"));
    }

    function reinstate(uint256 idIdx) public {
        if (issuedIds.length == 0) return;
        uint256 tokenId = issuedIds[idIdx % issuedIds.length];
        ITouristIdentityRegistry.Identity memory id = registry.identityOf(tokenId);
        if (id.status != ITouristIdentityRegistry.Status.Suspended) return;
        vm.prank(admin);
        registry.reinstate(tokenId);
    }

    function extendValidity(uint256 idIdx, uint64 extra) public {
        if (issuedIds.length == 0) return;
        uint256 tokenId = issuedIds[idIdx % issuedIds.length];
        ITouristIdentityRegistry.Identity memory id = registry.identityOf(tokenId);
        if (id.status != ITouristIdentityRegistry.Status.Active) return;
        extra = uint64(bound(extra, 1, 30 days));
        uint64 newUntil = id.validUntil + extra;
        if (newUntil - id.validFrom > registry.MAX_VALIDITY()) return;
        vm.prank(admin);
        registry.extendValidity(tokenId, newUntil);
    }

    function updateItinerary(uint256 idIdx, bytes32 newHash) public {
        if (issuedIds.length == 0) return;
        uint256 tokenId = issuedIds[idIdx % issuedIds.length];
        ITouristIdentityRegistry.Identity memory id = registry.identityOf(tokenId);
        if (id.status != ITouristIdentityRegistry.Status.Active) return;
        vm.prank(admin);
        registry.updateItinerary(tokenId, newHash);
    }

    function tryTransferFrom(uint256 idIdx, uint256 toIdx) public {
        if (issuedIds.length == 0) return;
        uint256 tokenId = issuedIds[idIdx % issuedIds.length];
        address from = registry.ownerOf(tokenId);
        address to = tourists[toIdx % tourists.length];
        if (to == from) {
            to = tourists[(toIdx + 1) % tourists.length];
        }
        vm.prank(from);
        try registry.transferFrom(from, to, tokenId) {} catch {}
    }

    function trySafeTransferFrom(uint256 idIdx, uint256 toIdx) public {
        if (issuedIds.length == 0) return;
        uint256 tokenId = issuedIds[idIdx % issuedIds.length];
        address from = registry.ownerOf(tokenId);
        address to = tourists[toIdx % tourists.length];
        if (to == from) {
            to = tourists[(toIdx + 1) % tourists.length];
        }
        vm.prank(from);
        try registry.safeTransferFrom(from, to, tokenId) {} catch {}
    }

    function trySafeTransferFromWithData(uint256 idIdx, uint256 toIdx) public {
        if (issuedIds.length == 0) return;
        uint256 tokenId = issuedIds[idIdx % issuedIds.length];
        address from = registry.ownerOf(tokenId);
        address to = tourists[toIdx % tourists.length];
        if (to == from) {
            to = tourists[(toIdx + 1) % tourists.length];
        }
        vm.prank(from);
        try registry.safeTransferFrom(from, to, tokenId, bytes("sbt")) {} catch {}
    }

    function tryApprove(uint256 idIdx, uint256 toIdx) public {
        if (issuedIds.length == 0) return;
        uint256 tokenId = issuedIds[idIdx % issuedIds.length];
        address from = registry.ownerOf(tokenId);
        address to = tourists[toIdx % tourists.length];
        vm.prank(from);
        try registry.approve(to, tokenId) {} catch {}
    }

    function trySetApprovalForAll(uint256 toIdx, bool approved) public {
        address from = tourists[toIdx % tourists.length];
        address operator = tourists[(toIdx + 1) % tourists.length];
        vm.prank(from);
        try registry.setApprovalForAll(operator, approved) {} catch {}
    }
}

contract InvariantsTest is Test {
    TouristIdentityRegistry internal registry;
    IdentityHandler internal handler;

    function setUp() public {
        address admin = makeAddr("inv-admin");
        registry = new TouristIdentityRegistry(admin);

        address[] memory tourists = new address[](8);
        for (uint256 i; i < tourists.length; ++i) {
            tourists[i] = makeAddr(string.concat("inv-tourist-", vm.toString(i)));
        }

        handler = new IdentityHandler(registry, admin, tourists);
        targetContract(address(handler));
    }

    /// @dev No call sequence may move a token from one non-zero address to another.
    function invariant_noTokenMovesBetweenNonZeroAddresses() public view {
        uint256 n = handler.issuedCount();
        for (uint256 i; i < n; ++i) {
            uint256 tokenId = handler.issuedIds(i);
            address mintee = handler.minteeOf(tokenId);
            assertTrue(mintee != address(0), "mintee recorded as zero");
            assertEq(registry.ownerOf(tokenId), mintee, "soulbound token moved between holders");
        }
    }

    function invariant_totalIssuedMatchesGhost() public view {
        assertEq(registry.totalIssued(), handler.ghostIssued());
    }
}
