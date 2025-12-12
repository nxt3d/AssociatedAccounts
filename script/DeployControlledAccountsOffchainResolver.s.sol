// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {ControlledAccountsOffchainResolver} from "../src/ControlledAccountsOffchainResolver.sol";

/// @notice Deployment script for ControlledAccountsOffchainResolver.
/// @dev Run with:
///   forge script script/DeployControlledAccountsOffchainResolver.s.sol:DeployControlledAccountsOffchainResolver \
///     --rpc-url <RPC_URL> --broadcast
/// Expects environment variables:
///  - DEPLOYER_PRIVATE_KEY (uint256): private key for the deployer
///  - OFFCHAIN_GATEWAY_URL (string): base URL for the CCIP-Read HTTP gateway
contract DeployControlledAccountsOffchainResolver is Script {
    function run() public {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        string memory gatewayUrl = vm.envString("OFFCHAIN_GATEWAY_URL");

        vm.startBroadcast(deployerPrivateKey);

        ControlledAccountsOffchainResolver resolver =
            new ControlledAccountsOffchainResolver(gatewayUrl);

        vm.stopBroadcast();

        console2.log("ControlledAccountsOffchainResolver deployed at:", address(resolver));
        console2.log("Gateway URL:", gatewayUrl);
        console2.log("Chain ID:", block.chainid);
    }
}

