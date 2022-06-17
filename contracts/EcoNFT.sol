// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "hardhat/console.sol";

//https://github.com/ethereum/EIPs/pull/5114/files#diff-875fb8de4b6b6fd699da1b847c9675de00581e10f3f51a78d7241e3380837a6f
contract EcoNFT is ERC721, Ownable {
    string private greeting;

    constructor() ERC721("EcoNFT", "EcoNFT") Ownable() {
        console.log("Deploying a EcoNFT");
    }

    /**
     * @dev Disables the transferFrom and safeTransferFrom calls in the parent contract bounding this token to
     * the original address that it was minted for
     *
     */
    function _isApprovedOrOwner(address, uint256)
        internal
        view
        virtual
        override
        onlyOwner
        returns (bool)
    {
        return false;
    }
}
