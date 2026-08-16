// packages/contracts/script/Deploy.s.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";

import {TouristIdentityRegistry} from "../src/TouristIdentityRegistry.sol";
import {IncidentAnchor} from "../src/IncidentAnchor.sol";

/// @notice Deploys both contracts, grants ISSUER_ROLE and ANCHOR_ROLE to the
///         relayer (`ISSUER_ADDRESS`), and writes deployments/{network}.json.
contract Deploy is Script {
    function run() external {
        uint256 pk = vm.envUint("ISSUER_PRIVATE_KEY");
        address relayer = vm.envAddress("ISSUER_ADDRESS");

        vm.startBroadcast(pk);

        TouristIdentityRegistry registry = new TouristIdentityRegistry(msg.sender);
        IncidentAnchor incidentAnchor = new IncidentAnchor(msg.sender);

        registry.grantRole(registry.ISSUER_ROLE(), relayer);
        incidentAnchor.grantRole(incidentAnchor.ANCHOR_ROLE(), relayer);

        vm.stopBroadcast();

        _writeDeployment(address(registry), address(incidentAnchor), relayer);

        console2.log("TouristIdentityRegistry", address(registry));
        console2.log("IncidentAnchor", address(incidentAnchor));
        console2.log("relayer", relayer);
        console2.log("deployedAtBlock", block.number);
    }

    function _writeDeployment(address registry, address incidentAnchor, address relayer) internal {
        vm.createDir("deployments", true);

        string memory slug = _fileSlug();
        string memory network = _networkName();
        string memory explorerBase = vm.envOr(
            "NEXT_PUBLIC_BLOCK_EXPLORER", string("https://amoy.polygonscan.com")
        );

        string memory json = string.concat(
            "{\n",
            '  "chainId": ',
            vm.toString(block.chainid),
            ",\n",
            '  "network": "',
            network,
            '",\n',
            '  "TouristIdentityRegistry": {\n',
            '    "address": "',
            vm.toString(registry),
            '",\n',
            '    "deployedAtBlock": ',
            vm.toString(block.number),
            ",\n",
            '    "explorer": "',
            _explorer(explorerBase, registry),
            '"\n',
            "  },\n",
            '  "IncidentAnchor": {\n',
            '    "address": "',
            vm.toString(incidentAnchor),
            '",\n',
            '    "deployedAtBlock": ',
            vm.toString(block.number),
            ",\n",
            '    "explorer": "',
            _explorer(explorerBase, incidentAnchor),
            '"\n',
            "  },\n",
            '  "issuerAddress": "',
            vm.toString(relayer),
            '",\n',
            '  "deployedAt": "',
            vm.toString(block.timestamp),
            '"\n',
            "}\n"
        );

        vm.writeFile(string.concat("deployments/", slug, ".json"), json);
        console2.log("wrote", string.concat("deployments/", slug, ".json"));
    }

    function _fileSlug() internal view returns (string memory) {
        if (block.chainid == 80002) return "amoy";
        if (block.chainid == 31337) return "anvil";
        return vm.toString(block.chainid);
    }

    function _networkName() internal view returns (string memory) {
        if (block.chainid == 80002) return "polygon-amoy";
        if (block.chainid == 31337) return "anvil";
        return string.concat("chain-", vm.toString(block.chainid));
    }

    function _explorer(string memory base, address addr) internal view returns (string memory) {
        if (block.chainid == 31337) return "";
        return string.concat(base, "/address/", vm.toString(addr));
    }
}
