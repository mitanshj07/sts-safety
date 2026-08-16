// packages/contracts/test/TouristIdentityRegistry.t.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

import {TouristIdentityRegistry} from "../src/TouristIdentityRegistry.sol";
import {
    ITouristIdentityRegistry,
    IERC5192
} from "../src/interfaces/ITouristIdentityRegistry.sol";

/// @dev Required suite from docs/04-DATA-MODEL.md §4.4, plus branch coverage.
contract TouristIdentityRegistryTest is Test {
    TouristIdentityRegistry internal registry;

    address internal admin;
    address internal issuer;
    address internal supervisor;
    address internal stranger;
    address internal holder;
    address internal other;

    bytes32 internal issuerRole;
    bytes32 internal supervisorRole;
    bytes32 internal adminRole;
    uint64 internal maxValidity;

    bytes32 internal constant DEMO_SALT =
        hex"1111111111111111111111111111111111111111111111111111111111111111";

    /// @dev keccak256(abi.encodePacked(uint8(1), "A1234567", DEMO_SALT))
    ///      Matches viem encodePacked(['uint8','string','bytes32'], [1, 'A1234567', salt])
    ///      for kycCommitment(1, "a12-34567", salt) after uppercase + strip [-\\s].
    bytes32 internal constant TS_KYC_COMMITMENT =
        hex"dd744635e9514ef0d5d9a89aab03f726e46ac331136278d8021c48cc1785b1ef";

    uint8 internal constant KYC_PASSPORT = 1;
    bytes2 internal constant NAT_IN = bytes2("IN");

    function setUp() public {
        admin = makeAddr("admin");
        issuer = makeAddr("issuer");
        supervisor = makeAddr("supervisor");
        stranger = makeAddr("stranger");
        holder = makeAddr("holder");
        other = makeAddr("other");

        registry = new TouristIdentityRegistry(admin);
        issuerRole = registry.ISSUER_ROLE();
        supervisorRole = registry.SUPERVISOR_ROLE();
        adminRole = registry.DEFAULT_ADMIN_ROLE();
        maxValidity = registry.MAX_VALIDITY();

        vm.startPrank(admin);
        registry.grantRole(issuerRole, issuer);
        registry.grantRole(supervisorRole, supervisor);
        vm.stopPrank();
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    function _window() internal view returns (uint64 validFrom, uint64 validUntil) {
        validFrom = uint64(block.timestamp);
        validUntil = validFrom + 30 days;
    }

    function _commitment(address who) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked("kyc", who));
    }

    function _issueTo(address to) internal returns (uint256 tokenId) {
        (uint64 validFrom, uint64 validUntil) = _window();
        vm.prank(issuer);
        tokenId = registry.issue(
            to,
            _commitment(to),
            keccak256("itinerary"),
            validFrom,
            validUntil,
            KYC_PASSPORT,
            NAT_IN,
            ""
        );
    }

    function _issueWithCommitment(address to, bytes32 commitment, string memory uri)
        internal
        returns (uint256 tokenId)
    {
        (uint64 validFrom, uint64 validUntil) = _window();
        vm.prank(issuer);
        tokenId = registry.issue(
            to, commitment, keccak256("itinerary"), validFrom, validUntil, KYC_PASSPORT, NAT_IN, uri
        );
    }

    function _expectIssuerUnauthorized(address account) internal {
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, account, issuerRole
            )
        );
    }

    function _expectSupervisorUnauthorized(address account) internal {
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, account, supervisorRole
            )
        );
    }

    // -------------------------------------------------------------------------
    // 1. Issue then transferFrom reverts SoulboundTokenNonTransferable
    // -------------------------------------------------------------------------

    function test_issueThenTransferFromRevertsSoulbound() public {
        uint256 tokenId = _issueTo(holder);

        vm.prank(holder);
        vm.expectRevert(ITouristIdentityRegistry.SoulboundTokenNonTransferable.selector);
        registry.transferFrom(holder, other, tokenId);

        assertEq(registry.ownerOf(tokenId), holder);
        assertEq(registry.balanceOf(holder), 1);
        assertEq(registry.balanceOf(other), 0);
    }

    // -------------------------------------------------------------------------
    // 2. Issue then safeTransferFrom (both overloads) reverts
    // -------------------------------------------------------------------------

    function test_issueThenSafeTransferFromBothOverloadsRevert() public {
        uint256 tokenId = _issueTo(holder);

        vm.prank(holder);
        vm.expectRevert(ITouristIdentityRegistry.SoulboundTokenNonTransferable.selector);
        registry.safeTransferFrom(holder, other, tokenId);

        vm.prank(holder);
        vm.expectRevert(ITouristIdentityRegistry.SoulboundTokenNonTransferable.selector);
        registry.safeTransferFrom(holder, other, tokenId, bytes("payload"));

        assertEq(registry.ownerOf(tokenId), holder);
    }

    // -------------------------------------------------------------------------
    // 3. approve and setApprovalForAll revert
    // -------------------------------------------------------------------------

    function test_approveAndSetApprovalForAllRevert() public {
        uint256 tokenId = _issueTo(holder);

        vm.prank(holder);
        vm.expectRevert(ITouristIdentityRegistry.SoulboundTokenNonTransferable.selector);
        registry.approve(other, tokenId);

        vm.prank(holder);
        vm.expectRevert(ITouristIdentityRegistry.SoulboundTokenNonTransferable.selector);
        registry.setApprovalForAll(other, true);
    }

    // -------------------------------------------------------------------------
    // 4. Fuzz: non-zero holder balance never decreases except via burn
    // -------------------------------------------------------------------------

    function testFuzz_nonZeroHolderBalanceNeverDecreasesExceptBurn(uint256 holderSeed, uint256 recipientSeed)
        public
    {
        holderSeed = bound(holderSeed, 1, 10_000);
        recipientSeed = bound(recipientSeed, 1, 10_000);
        vm.assume(holderSeed != recipientSeed);

        address fuzzHolder = makeAddr(string.concat("fuzz-holder-", vm.toString(holderSeed)));
        address fuzzRecipient = makeAddr(string.concat("fuzz-recipient-", vm.toString(recipientSeed)));

        uint256 tokenId = _issueTo(fuzzHolder);
        uint256 balanceBefore = registry.balanceOf(fuzzHolder);

        vm.prank(fuzzHolder);
        try registry.transferFrom(fuzzHolder, fuzzRecipient, tokenId) {} catch {}

        vm.prank(fuzzHolder);
        try registry.safeTransferFrom(fuzzHolder, fuzzRecipient, tokenId) {} catch {}

        vm.prank(fuzzHolder);
        try registry.safeTransferFrom(fuzzHolder, fuzzRecipient, tokenId, hex"01") {} catch {}

        vm.prank(fuzzRecipient);
        try registry.transferFrom(fuzzHolder, fuzzRecipient, tokenId) {} catch {}

        assertEq(registry.balanceOf(fuzzHolder), balanceBefore);
        assertEq(registry.ownerOf(tokenId), fuzzHolder);
        assertEq(registry.balanceOf(fuzzRecipient), 0);
    }

    // -------------------------------------------------------------------------
    // 5. verify returns false after validUntil (vm.warp)
    // -------------------------------------------------------------------------

    function test_verifyReturnsFalseAfterExpiry() public {
        uint64 validFrom = uint64(block.timestamp);
        uint64 validUntil = validFrom + 7 days;

        vm.prank(issuer);
        uint256 tokenId = registry.issue(
            holder, _commitment(holder), bytes32(0), validFrom, validUntil, KYC_PASSPORT, NAT_IN, ""
        );

        (bool validBefore, ITouristIdentityRegistry.Status statusBefore,,) = registry.verify(tokenId);
        assertTrue(validBefore);
        assertEq(uint8(statusBefore), uint8(ITouristIdentityRegistry.Status.Active));
        assertTrue(registry.isValid(tokenId));

        vm.warp(uint256(validUntil) + 1);

        (bool validAfter, ITouristIdentityRegistry.Status statusAfter, uint64 untilAfter,) =
            registry.verify(tokenId);
        assertFalse(validAfter);
        assertEq(uint8(statusAfter), uint8(ITouristIdentityRegistry.Status.Active));
        assertEq(untilAfter, validUntil);
        assertFalse(registry.isValid(tokenId));
    }

    function test_verifyReturnsFalseBeforeValidFrom() public {
        uint64 validFrom = uint64(block.timestamp + 1 days);
        uint64 validUntil = validFrom + 7 days;

        vm.prank(issuer);
        uint256 tokenId = registry.issue(
            holder, _commitment(holder), bytes32(0), validFrom, validUntil, KYC_PASSPORT, NAT_IN, ""
        );

        (bool valid,,,) = registry.verify(tokenId);
        assertFalse(valid);
        assertFalse(registry.isValid(tokenId));

        vm.warp(validFrom);
        (valid,,,) = registry.verify(tokenId);
        assertTrue(valid);
    }

    // -------------------------------------------------------------------------
    // 6. verify returns false after revoke
    // -------------------------------------------------------------------------

    function test_verifyReturnsFalseAfterRevoke() public {
        uint256 tokenId = _issueTo(holder);

        vm.prank(issuer);
        registry.revoke(tokenId, bytes32("TRIP_ABORTED"));

        (bool valid, ITouristIdentityRegistry.Status status,,) = registry.verify(tokenId);
        assertFalse(valid);
        assertEq(uint8(status), uint8(ITouristIdentityRegistry.Status.Revoked));
        assertFalse(registry.isValid(tokenId));
        assertEq(registry.activeTokenOf(holder), 0);
        assertEq(registry.ownerOf(tokenId), holder);
    }

    // -------------------------------------------------------------------------
    // 7. Non-issuer calling issue reverts with AccessControl error
    // -------------------------------------------------------------------------

    function test_nonIssuerIssueRevertsAccessControl() public {
        (uint64 validFrom, uint64 validUntil) = _window();

        vm.prank(stranger);
        _expectIssuerUnauthorized(stranger);
        registry.issue(
            holder, _commitment(holder), bytes32(0), validFrom, validUntil, KYC_PASSPORT, NAT_IN, ""
        );

        vm.prank(supervisor);
        _expectIssuerUnauthorized(supervisor);
        registry.issue(
            holder, _commitment(holder), bytes32(0), validFrom, validUntil, KYC_PASSPORT, NAT_IN, ""
        );
    }

    // -------------------------------------------------------------------------
    // 8. Second issue to active holder reverts; succeeds after revoke
    // -------------------------------------------------------------------------

    function test_secondIssueRevertsUntilRevoke() public {
        uint256 first = _issueTo(holder);
        assertEq(first, 1);

        (uint64 validFrom, uint64 validUntil) = _window();
        vm.prank(issuer);
        vm.expectRevert(
            abi.encodeWithSelector(
                ITouristIdentityRegistry.HolderAlreadyHasActiveIdentity.selector, holder
            )
        );
        registry.issue(
            holder, _commitment(other), bytes32(0), validFrom, validUntil, KYC_PASSPORT, NAT_IN, ""
        );

        vm.prank(issuer);
        registry.revoke(first, bytes32("FRAUD"));

        uint256 second = _issueTo(holder);
        assertEq(second, 2);
        assertEq(registry.activeTokenOf(holder), 2);
        assertEq(registry.totalIssued(), 2);
        assertEq(registry.issuedByAuthority(issuer), 2);
    }

    // -------------------------------------------------------------------------
    // 9. extendValidity beyond MAX_VALIDITY reverts
    // -------------------------------------------------------------------------

    function test_extendValidityBeyondMaxReverts() public {
        uint256 tokenId = _issueTo(holder);
        ITouristIdentityRegistry.Identity memory id = registry.identityOf(tokenId);
        uint64 tooLong = id.validFrom + maxValidity + 1;

        vm.expectRevert(
            abi.encodeWithSelector(
                ITouristIdentityRegistry.ValidityWindowTooLong.selector,
                tooLong - id.validFrom,
                maxValidity
            )
        );
        vm.prank(issuer);
        registry.extendValidity(tokenId, tooLong);
    }

    function test_extendValiditySuccessAndCannotShorten() public {
        uint256 tokenId = _issueTo(holder);
        ITouristIdentityRegistry.Identity memory id = registry.identityOf(tokenId);
        uint64 previous = id.validUntil;
        uint64 extended = previous + 14 days;

        vm.prank(issuer);
        registry.extendValidity(tokenId, extended);
        assertEq(registry.identityOf(tokenId).validUntil, extended);

        vm.prank(issuer);
        vm.expectRevert(ITouristIdentityRegistry.CannotShortenValidity.selector);
        registry.extendValidity(tokenId, extended);

        vm.prank(issuer);
        vm.expectRevert(ITouristIdentityRegistry.CannotShortenValidity.selector);
        registry.extendValidity(tokenId, previous);
    }

    // -------------------------------------------------------------------------
    // 10. Cross-language commitment vector matches TypeScript output
    // -------------------------------------------------------------------------

    function test_crossLanguageCommitmentVectorMatchesTypeScript() public {
        bytes32 packed = keccak256(abi.encodePacked(uint8(1), "A1234567", DEMO_SALT));
        assertEq(packed, TS_KYC_COMMITMENT, "Solidity packing must match viem encodePacked");

        uint256 tokenId = _issueWithCommitment(holder, TS_KYC_COMMITMENT, "ipfs://tdid/1");

        assertTrue(registry.verifyKyc(tokenId, 1, "A1234567", DEMO_SALT));
        // Un-normalised input must not match — normalisation is off-chain.
        assertFalse(registry.verifyKyc(tokenId, 1, "a12-34567", DEMO_SALT));
        assertFalse(registry.verifyKyc(tokenId, 2, "A1234567", DEMO_SALT));
        assertFalse(registry.verifyKyc(tokenId, 1, "A1234567", bytes32(uint256(2))));
        assertFalse(registry.verifyKyc(999, 1, "A1234567", DEMO_SALT));
        assertEq(registry.tokenURI(tokenId), "ipfs://tdid/1");
    }

    // -------------------------------------------------------------------------
    // Additional coverage: issuance guards, batch, lifecycle, views, pause
    // -------------------------------------------------------------------------

    function test_issueRevertsEmptyCommitment() public {
        (uint64 validFrom, uint64 validUntil) = _window();
        vm.prank(issuer);
        vm.expectRevert(ITouristIdentityRegistry.EmptyCommitment.selector);
        registry.issue(holder, bytes32(0), bytes32(0), validFrom, validUntil, KYC_PASSPORT, NAT_IN, "");
    }

    function test_issueRevertsInvalidValidityWindow() public {
        uint64 validFrom = uint64(block.timestamp);
        vm.prank(issuer);
        vm.expectRevert(
            abi.encodeWithSelector(
                ITouristIdentityRegistry.InvalidValidityWindow.selector, validFrom, validFrom
            )
        );
        registry.issue(
            holder, _commitment(holder), bytes32(0), validFrom, validFrom, KYC_PASSPORT, NAT_IN, ""
        );
    }

    function test_issueRevertsValidityWindowTooLong() public {
        uint64 validFrom = uint64(block.timestamp);
        uint64 validUntil = validFrom + maxValidity + 1;
        vm.expectRevert(
            abi.encodeWithSelector(
                ITouristIdentityRegistry.ValidityWindowTooLong.selector,
                validUntil - validFrom,
                maxValidity
            )
        );
        vm.prank(issuer);
        registry.issue(
            holder, _commitment(holder), bytes32(0), validFrom, validUntil, KYC_PASSPORT, NAT_IN, ""
        );
    }

    function test_issueBatchAndLengthMismatch() public {
        address[] memory to = new address[](2);
        bytes32[] memory commitments = new bytes32[](2);
        to[0] = holder;
        to[1] = other;
        commitments[0] = _commitment(holder);
        commitments[1] = _commitment(other);

        (uint64 validFrom, uint64 validUntil) = _window();
        vm.prank(issuer);
        uint256[] memory ids = registry.issueBatch(
            to, commitments, keccak256("group-itinerary"), validFrom, validUntil, KYC_PASSPORT, NAT_IN
        );

        assertEq(ids.length, 2);
        assertEq(ids[0], 1);
        assertEq(ids[1], 2);
        assertEq(registry.totalIssued(), 2);
        assertTrue(registry.locked(1));
        assertTrue(registry.locked(2));

        address[] memory badTo = new address[](2);
        bytes32[] memory badCommitments = new bytes32[](1);
        badTo[0] = makeAddr("a");
        badTo[1] = makeAddr("b");
        badCommitments[0] = _commitment(badTo[0]);

        vm.prank(issuer);
        vm.expectRevert("length mismatch");
        registry.issueBatch(
            badTo, badCommitments, bytes32(0), validFrom, validUntil, KYC_PASSPORT, NAT_IN
        );
    }

    function test_suspendReinstateAndRoleGates() public {
        uint256 tokenId = _issueTo(holder);

        vm.prank(issuer);
        _expectSupervisorUnauthorized(issuer);
        registry.suspend(tokenId, bytes32("INVESTIGATION"));

        vm.prank(supervisor);
        registry.suspend(tokenId, bytes32("INVESTIGATION"));

        (bool valid, ITouristIdentityRegistry.Status status,,) = registry.verify(tokenId);
        assertFalse(valid);
        assertEq(uint8(status), uint8(ITouristIdentityRegistry.Status.Suspended));

        vm.prank(issuer);
        vm.expectRevert(
            abi.encodeWithSelector(
                ITouristIdentityRegistry.NotActive.selector,
                tokenId,
                ITouristIdentityRegistry.Status.Suspended
            )
        );
        registry.extendValidity(tokenId, uint64(block.timestamp + 60 days));

        vm.prank(supervisor);
        registry.reinstate(tokenId);
        (valid, status,,) = registry.verify(tokenId);
        assertTrue(valid);
        assertEq(uint8(status), uint8(ITouristIdentityRegistry.Status.Active));

        vm.prank(supervisor);
        vm.expectRevert(
            abi.encodeWithSelector(
                ITouristIdentityRegistry.NotActive.selector,
                tokenId,
                ITouristIdentityRegistry.Status.Active
            )
        );
        registry.reinstate(tokenId);
    }

    function test_revokeAlreadyRevokedAndMissing() public {
        uint256 tokenId = _issueTo(holder);

        vm.prank(issuer);
        registry.revoke(tokenId, bytes32("FRAUD"));

        vm.prank(issuer);
        vm.expectRevert(
            abi.encodeWithSelector(
                ITouristIdentityRegistry.NotActive.selector,
                tokenId,
                ITouristIdentityRegistry.Status.Revoked
            )
        );
        registry.revoke(tokenId, bytes32("FRAUD"));

        vm.prank(issuer);
        vm.expectRevert(
            abi.encodeWithSelector(ITouristIdentityRegistry.IdentityNotFound.selector, 99)
        );
        registry.revoke(99, bytes32("MISSING"));

        vm.prank(supervisor);
        vm.expectRevert(
            abi.encodeWithSelector(
                ITouristIdentityRegistry.NotActive.selector,
                tokenId,
                ITouristIdentityRegistry.Status.Revoked
            )
        );
        registry.suspend(tokenId, bytes32("NOPE"));
    }

    function test_updateItinerary() public {
        uint256 tokenId = _issueTo(holder);
        bytes32 previous = registry.identityOf(tokenId).itineraryHash;
        bytes32 nextHash = keccak256("revised-itinerary");

        vm.prank(stranger);
        _expectIssuerUnauthorized(stranger);
        registry.updateItinerary(tokenId, nextHash);

        vm.prank(issuer);
        registry.updateItinerary(tokenId, nextHash);
        assertEq(registry.identityOf(tokenId).itineraryHash, nextHash);
        assertTrue(previous != nextHash);

        vm.prank(issuer);
        registry.revoke(tokenId, bytes32("TRIP_ABORTED"));
        vm.prank(issuer);
        vm.expectRevert(
            abi.encodeWithSelector(
                ITouristIdentityRegistry.NotActive.selector,
                tokenId,
                ITouristIdentityRegistry.Status.Revoked
            )
        );
        registry.updateItinerary(tokenId, keccak256("after-revoke"));
    }

    function test_lockedRevertsIfMissing() public {
        vm.expectRevert(
            abi.encodeWithSelector(ITouristIdentityRegistry.IdentityNotFound.selector, 1)
        );
        registry.locked(1);
    }

    function test_viewsAndSupportsInterface() public {
        uint256 tokenId = _issueWithCommitment(holder, TS_KYC_COMMITMENT, "");
        ITouristIdentityRegistry.Identity memory id = registry.identityOf(tokenId);
        assertEq(id.kycCommitment, TS_KYC_COMMITMENT);
        assertEq(id.issuer, issuer);
        assertEq(id.nationality, NAT_IN);
        assertEq(id.kycType, KYC_PASSPORT);
        assertEq(registry.activeTokenOf(holder), tokenId);
        assertEq(registry.totalIssued(), 1);
        assertEq(registry.tokenURI(tokenId), "");

        assertTrue(registry.supportsInterface(type(IERC5192).interfaceId));
        assertTrue(registry.supportsInterface(type(IERC721).interfaceId));
        assertTrue(registry.supportsInterface(type(IAccessControl).interfaceId));
        assertTrue(registry.supportsInterface(type(IERC165).interfaceId));
        assertFalse(registry.supportsInterface(0xffffffff));
    }

    function test_pauseUnpauseGatesIssuance() public {
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, adminRole
            )
        );
        vm.prank(stranger);
        registry.pause();

        vm.prank(admin);
        registry.pause();

        (uint64 validFrom, uint64 validUntil) = _window();
        vm.prank(issuer);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        registry.issue(
            holder, _commitment(holder), bytes32(0), validFrom, validUntil, KYC_PASSPORT, NAT_IN, ""
        );

        vm.prank(admin);
        registry.unpause();
        uint256 tokenId = _issueTo(holder);
        assertEq(tokenId, 1);

        // Revoke remains available while paused so credentials can still be cancelled.
        vm.prank(admin);
        registry.pause();
        vm.prank(issuer);
        registry.revoke(tokenId, bytes32("EMERGENCY"));
        assertEq(uint8(registry.identityOf(tokenId).status), uint8(ITouristIdentityRegistry.Status.Revoked));
    }

    function test_issueBatchWhenPausedReverts() public {
        address[] memory to = new address[](1);
        bytes32[] memory commitments = new bytes32[](1);
        to[0] = holder;
        commitments[0] = _commitment(holder);
        (uint64 validFrom, uint64 validUntil) = _window();

        vm.prank(admin);
        registry.pause();

        vm.prank(issuer);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        registry.issueBatch(to, commitments, bytes32(0), validFrom, validUntil, KYC_PASSPORT, NAT_IN);
    }

    function test_secondIssueAllowedWhileSuspended() public {
        uint256 first = _issueTo(holder);
        vm.prank(supervisor);
        registry.suspend(first, bytes32("INVESTIGATION"));

        uint256 second = _issueTo(other);
        assertEq(second, 2);

        // Suspended holder is not Active, so a new credential can be issued to them.
        uint256 replacement = _issueTo(holder);
        assertEq(replacement, 3);
        assertEq(registry.activeTokenOf(holder), 3);
    }

    function test_secondIssueAllowedAfterExpiryStillActiveStatus() public {
        // Expired-but-Active still counts as Active for the one-credential rule.
        uint64 validFrom = uint64(block.timestamp);
        uint64 validUntil = validFrom + 1 days;
        vm.prank(issuer);
        registry.issue(
            holder, _commitment(holder), bytes32(0), validFrom, validUntil, KYC_PASSPORT, NAT_IN, ""
        );

        vm.warp(uint256(validUntil) + 1);
        (uint64 nextFrom, uint64 nextUntil) = _window();
        vm.prank(issuer);
        vm.expectRevert(
            abi.encodeWithSelector(
                ITouristIdentityRegistry.HolderAlreadyHasActiveIdentity.selector, holder
            )
        );
        registry.issue(
            holder, _commitment(other), bytes32(0), nextFrom, nextUntil, KYC_PASSPORT, NAT_IN, ""
        );
    }
}
