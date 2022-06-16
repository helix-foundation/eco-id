// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

import "hardhat/console.sol";

//https://github.com/ethereum/EIPs/pull/5114/files#diff-875fb8de4b6b6fd699da1b847c9675de00581e10f3f51a78d7241e3380837a6f
contract EcoNFT is ERC721 {
    string private greeting;

    constructor() ERC721("EcoNFT", "EcoNFT") {
        console.log("Deploying a EcoNFT");
    }
}
