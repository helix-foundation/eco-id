// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import "../Base64.sol";
import "../EcoID.sol";

/**
 * This is the EcoNFT for verifying an arbitraty claim.
 */
contract EcoID2 is EcoID {
    /**
     * New veriable
     */
    uint256 public _totalNfts;

    /**
     * Disable the implementation contract
     */
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * Proxy initializer
     */
    function initialize2(uint256 totalNFTs) public virtual {
        _totalNfts = totalNFTs;
    }
}
