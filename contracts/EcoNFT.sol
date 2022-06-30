// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import "hardhat/console.sol";

/**
 * This is the Eco NFT for linking a user's discord and twitter ids on chain. The owner of this contract will issue a signed tx
 * on behalf of the user once they authenticate their discord and twitter ids. The user can then submit the tx to this contract and
 * mint an EcoNFT. The issued NFT is soulbound to the address it was issue to, and cannot be transfered. Only one EcoNFT can ever be
 * minted per social account.
 */
contract EcoNFT is ERC721("EcoNFT", "EcoNFT"), Ownable {
    /**
     * Use for signarture recovery and verification on minting of EcoNFT
     */
    using ECDSA for bytes32;

    /**
     * Event for when an EcoNFT is minted
     */
    event Mint(address indexed addr);

    /**
     * Mapping the attested social account id with user address
     */
    mapping(string => address) public _mintedAccounts;

    /**
     * Mapping the user address with all social accounts they have
     */
    mapping(address => string[]) public _socialAccounts;

    /**
     * Mints an EcoNFT if the discord and twitter IDs have not been claimed yet, and only when the owener of this EcoNFT contract
     * has signed off on the minting
     *
     * Parameters:
     *  - discordID/twitterID the social ids of the user
     *  - signature is signature that we are validating comes from the owner of this contract, ie the minter account has signed off
     */
    function mintEcoNFT(
        string calldata socialID,
        address recipientAddress,
        bytes calldata signature
    ) external returns (uint256) {
        require(hasNotBeenMinted(socialID), "social has minted token");
        require(
            _verifyMint(socialID, recipientAddress, signature),
            "signature did not match"
        );
        uint256 tokenID = socialToNFTID(socialID);
        _safeMint(recipientAddress, tokenID);
        _mintedAccounts[socialID] = recipientAddress;
        _socialAccounts[recipientAddress].push(socialID);

        emit Mint(recipientAddress);

        return tokenID;
    }

    /**
     * Returns the NTF ID for a given social id that we have linked the user too. The function takes the
     * hash of the social id and returns it as a token id uint256
     */
    function socialToNFTID(string calldata socialID)
        internal
        pure
        returns (uint256)
    {
        return uint256(keccak256(abi.encodePacked(socialID)));
    }

    /**
     * Checks that the social id has not had an EcoNFT already minted
     *
     * Parameters:
     *  - discordID/twitterID the social ids of the user
     */
    function hasNotBeenMinted(string calldata socialID)
        internal
        view
        returns (bool)
    {
        return _mintedAccounts[socialID] == address(0);
    }

    /**
     * Verifies the signature supplied belongs to the owner address.
     *
     * Parameters:
     *  - socialID the social ids of the user
     *  - recipientAddress the address of the user
     *  - signature is signature that we are validating comes from the owner of this contract, ie the minter account has signed off
     *
     * Returns:
     *  - true if the signature is valid, false otherwise
     */
    function _verifyMint(
        string calldata socialID,
        address recipientAddress,
        bytes calldata signature
    ) internal view returns (bool) {
        bytes32 hash = getNftHash(socialID, recipientAddress);
        return hash.recover(signature) == owner();
    }

    /**
     * Hashes the input parameters and hashes using keccak256,
     * attaches eth_sign_message for a validator verification
     */
    function getNftHash(string calldata socialID, address recipientAddress)
        private
        pure
        returns (bytes32)
    {
        return
            keccak256(abi.encodePacked(socialID, recipientAddress))
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
