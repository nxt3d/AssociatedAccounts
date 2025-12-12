// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ControlledAccountsOffchainResolver
/// @notice Minimal ENS-compatible resolver that serves controlled-accounts
///         YAML via CCIP-Read to a HTTP gateway.
contract ControlledAccountsOffchainResolver {
    /// @dev CCIP-Read error as specified by ERC-3668.
    error OffchainLookup(
        address sender,
        string[] urls,
        bytes callData,
        bytes4 callbackFunction,
        bytes extraData
    );

    /// @notice Base URL for the offchain gateway (e.g. your ngrok URL).
    string public url;
    address private owner; // only for demo

    constructor(string memory _url) {
        owner = msg.sender;
        url = _url;
    }

    /// @notice Update the gateway URL. only for demo
    function setUrl(string calldata newUrl) external {
        require(msg.sender == owner, "not owner");
        url = newUrl;
    }

    /// @notice ENS text() resolution entrypoint.
    /// @dev For controlled-accounts keys, this will always trigger an
    ///      OffchainLookup that asks the HTTP gateway for the YAML payload.
    function text(
        bytes32 node,
        string calldata key
    ) external view returns (string memory) {
        // Encode the request context for the gateway. The format is up to us;
        // here we simply ABI-encode (node, key).
        bytes memory callData = abi.encode(node, key);

        string[] memory urls = new string[](1);
        urls[0] = url;

        // extraData can be used to carry context into the callback; for now we
        // simply pass (node, key) again.
        bytes memory extraData = abi.encode(node, key);

        revert OffchainLookup(
            address(this),
            urls,
            callData,
            this.textWithProof.selector,
            extraData
        );
    }

    /// @notice Callback that receives the gateway's response.
    /// @param response ABI-encoded (string) YAML from the gateway.
    /// extraData Extra data provided in the OffchainLookup (unused for now).
    function textWithProof(
        bytes calldata response,
        bytes calldata /*extraData*/
    ) external pure returns (string memory) {
        // In a production resolver you would verify signatures / proofs here
        // before returning. For this demo we trust the gateway and just decode.
        string memory yaml = abi.decode(response, (string));
        return yaml;
    }

    /// @notice Minimal ERC-165-style interface detection.
    /// @dev 0x59d1d43c = bytes4(keccak256("text(bytes32,string)"))
    function supportsInterface(
        bytes4 interfaceID
    ) external pure returns (bool) {
        return
            interfaceID == this.supportsInterface.selector ||
            interfaceID == 0x59d1d43c;
    }
}
