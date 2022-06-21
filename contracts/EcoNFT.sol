// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import "hardhat/console.sol";

//https://github.com/ethereum/EIPs/pull/5114/files#diff-875fb8de4b6b6fd699da1b847c9675de00581e10f3f51a78d7241e3380837a6f
contract EcoNFT is ERC721, Ownable {
    string private greeting;
    using ECDSA for bytes32;

    /** Event for when an EcoNFT is minted
     */
    event MintEvent(address indexed addr);

    /**
     * The data for each EcoNFT that links the user address to the its social media ids
     */
    struct Social {
        bytes discordID;
        bytes twitterID;
    }

    // Mapping the discord and twitter IDs agains the owning address of an EcoNFT if it has been minted.
    mapping(address => Social) private _mintedAccounts;
    mapping(bytes => address) private _socialAccountsMap;

    constructor() ERC721("EcoNFT", "EcoNFT") Ownable() {
        console.log("Deploying a EcoNFT");
    }

    /**
     * Mints an EcoNFT if the discord and twitter IDs have not been claimed yet, and only when the owener of this EcoNFT contract
     * has signed off on the minting
     *
     * Parameters:
     *  - discordID/twitterID the social ids of the user
     *  - signature is signature that we are validating comes from the owner of this contract, ie the minter account has signed off
     */
    function mintEcoNFT(
        bytes memory discordID,
        bytes memory twitterID,
        bytes memory signature
    ) external {
        require(hasNotBeenMinted(discordID, twitterID), "id has minted token");
        require(
            _verifyMint(discordID, twitterID, signature),
            "signature did not match"
        );
        _safeMint(msg.sender, socialToNFTID(discordID, twitterID));
        _mintedAccounts[msg.sender] = Social({
            discordID: discordID,
            twitterID: twitterID
        });
        if(discordID.length > 0){
            _socialAccountsMap[discordID] = msg.sender;
        }
        if(twitterID.length > 0){
            _socialAccountsMap[twitterID] = msg.sender;
        }
       
        emit MintEvent(msg.sender);
    }

    /**
     * Returns the NTF ID for a given social id that we have linked the user too. The function takes the
     * hash of the social id and returns it as a token id uint256
     */
    function socialToNFTID(bytes memory discordID, bytes memory twitterID)
        internal
        pure
        returns (uint256)
    {
        return uint256(keccak256(abi.encodePacked(discordID, twitterID)));
    }

    /**
     * Checks that the social id has not had an EcoNFT already minted
     *
     * Parameters:
     *  - discordID/twitterID the social ids of the user
     */
    function hasNotBeenMinted(bytes memory discordID, bytes memory twitterID)
        internal
        view
        returns (bool)
    {
        return
            _socialAccountsMap[discordID] == address(0) &&
            _socialAccountsMap[twitterID] == address(0);
    }

    /**
     * Verifies the signature supplied belongs to the owner address.
     *
     * Parameters:
     *  - discordID/twitterID the social ids of the user
     *  - signature is signature that we are validating comes from the owner of this contract, ie the minter account has signed off
     *
     * Returns:
     *  - true if the signature is valid, false otherwise
     */
    function _verifyMint(
        bytes memory discordID,
        bytes memory twitterID,
        bytes memory signature
    ) internal view returns (bool) {
        bytes32 hash = getNftHash(discordID, twitterID);
        return hash.recover(signature) == owner();
    }

    /**
     * Hashes the input parameters and hashes using keccak256,
     * attaches eth_sign_message for a validator verification
     */
    function getNftHash(bytes memory discordID, bytes memory twitterID)
        private
        pure
        returns (bytes32)
    {
        return
            keccak256(abi.encodePacked(discordID, twitterID))
                .toEthSignedMessageHash();
    }

    /**
     * @dev Disables the transferFrom and safeTransferFrom calls in the parent contract bounding this token to
     * the original address that it was minted for
     */
    function _isApprovedOrOwner(address, uint256)
        internal
        view
        virtual
        override
        returns (bool)
    {
        return false;
    }
}
