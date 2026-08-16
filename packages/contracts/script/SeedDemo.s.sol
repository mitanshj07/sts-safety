// packages/contracts/script/SeedDemo.s.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";

import {TouristIdentityRegistry} from "../src/TouristIdentityRegistry.sol";

/// @notice Issues 3 demo identities so Polygonscan "Read Contract" has state
///         before the pitch. No PII — only keccak256 commitments.
contract SeedDemo is Script {
    function run() external {
        uint256 pk = vm.envUint("ISSUER_PRIVATE_KEY");
        TouristIdentityRegistry registry = TouristIdentityRegistry(_registryAddress());

        vm.startBroadcast(pk);
        _seedIndian(registry);
        _seedJapanese(registry);
        _seedAmerican(registry);
        vm.stopBroadcast();

        console2.log("totalIssued", registry.totalIssued());
    }

    function _seedIndian(TouristIdentityRegistry registry) internal {
        address to = vm.addr(vm.deriveKey(_mnemonic(), 0));
        uint64 validFrom = uint64(block.timestamp);
        bytes32 salt = keccak256(abi.encodePacked("demo-salt", to));
        registry.issue(
            to,
            keccak256(abi.encodePacked(uint8(2), "999999999999", salt)),
            keccak256("guwahati-shillong-cherrapunji"),
            validFrom,
            validFrom + 30 days,
            2,
            bytes2("IN"),
            "ipfs://demo/tdid/1"
        );
        console2.log("seeded token 1 holder", to);
    }

    function _seedJapanese(TouristIdentityRegistry registry) internal {
        address to = vm.addr(vm.deriveKey(_mnemonic(), 1));
        uint64 validFrom = uint64(block.timestamp);
        bytes32 salt = keccak256(abi.encodePacked("demo-salt", to));
        registry.issue(
            to,
            keccak256(abi.encodePacked(uint8(1), "XT1234567", salt)),
            keccak256("tezpur-bomdila-tawang"),
            validFrom,
            validFrom + 14 days,
            1,
            bytes2("JP"),
            "ipfs://demo/tdid/2"
        );
        console2.log("seeded token 2 holder", to);
    }

    function _seedAmerican(TouristIdentityRegistry registry) internal {
        address to = vm.addr(vm.deriveKey(_mnemonic(), 2));
        uint64 validFrom = uint64(block.timestamp);
        bytes32 salt = keccak256(abi.encodePacked("demo-salt", to));
        registry.issue(
            to,
            keccak256(abi.encodePacked(uint8(1), "US9876543", salt)),
            keccak256("kaziranga-safari-loop"),
            validFrom,
            validFrom + 60 days,
            1,
            bytes2("US"),
            "ipfs://demo/tdid/3"
        );
        console2.log("seeded token 3 holder", to);
    }

    function _mnemonic() internal view returns (string memory) {
        return vm.envOr(
            "TOURIST_HD_MNEMONIC",
            string("test test test test test test test test test test test junk")
        );
    }

    function _registryAddress() internal view returns (address registry) {
        registry = vm.envOr("NEXT_PUBLIC_TOURIST_ID_REGISTRY_ADDRESS", address(0));
        if (registry != address(0)) return registry;

        string memory json = vm.readFile(string.concat("deployments/", _fileSlug(), ".json"));
        registry = vm.parseJsonAddress(json, ".TouristIdentityRegistry.address");
        require(registry != address(0), "SeedDemo: registry address is zero; deploy first");
    }

    function _fileSlug() internal view returns (string memory) {
        if (block.chainid == 80002) return "amoy";
        if (block.chainid == 31337) return "anvil";
        return vm.toString(block.chainid);
    }
}
