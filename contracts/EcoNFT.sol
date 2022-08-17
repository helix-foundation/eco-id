// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * This is the Eco NFT for linking a user's discord and twitter ids on chain. The owner of this contract will issue a signed tx
 * on behalf of the user once they authenticate their discord and twitter ids. The user can then submit the tx to this contract and
 * mint an EcoNFT. The issued NFT is soulbound to the address it was issue to, and cannot be transfered. Only one EcoNFT can ever be
 * minted per social account.
 */
contract EcoNFT is ERC721("EcoNFT", "EcoNFT") {
    /**
     * Use for signarture recovery and verification on minting of EcoNFT
     */
    using ECDSA for bytes32;

    /**
     * Event for when an EcoNFT is minted
     */
    event Mint(address indexed addr, address indexed minterAddress);

    /**
     * Event for when an EcoNFT is minted
     */
    uint256 public _tokenIndex = 0;

    /**
     * Mapping the attested social account id with user address
     */
    mapping(string => address[]) public _mintedAccounts;

    /**
     * Mapping the user address with all social accounts they have
     */
    mapping(address => string[]) public _socialAccounts;

    /**
     * The token contract that is used for fee payments to the minter address 
     */
    ERC20 public immutable _token;

    constructor(ERC20 token){
        _token = token;
    }

    /**
     * Mints an EcoNFT if the discord and twitter IDs have not been claimed yet, and only when the owener of this EcoNFT contract
     * has signed off on the minting
     *
     * @param socialID the social ids of the user
     * @param feeAmount the cost to mint the nft that is sent back to the minterAddress
     * @param recipientAddress the address of the recipient of the newly minted nft
     * @param minterAddress the address of the minter for the nft, that has verified the socialID
     * @param signature signature that we are validating comes from the minterAddress
     */
    function mintEcoNFT(
        string calldata socialID,
        uint256 feeAmount,
        address recipientAddress,
        address minterAddress,
        bytes calldata signature
    ) external returns (uint256) {
        require(hasNotBeenMinted(socialID, minterAddress), "social has minted token");
        require(
            _verifyMint(
                socialID,
                feeAmount,
                recipientAddress,
                minterAddress,
                signature
            ),
            "signature did not match"
        );

        uint256 tokenID = _tokenIndex++;
        _safeMint(recipientAddress, tokenID);
        _mintedAccounts[socialID].push(recipientAddress);
        _socialAccounts[recipientAddress].push(socialID);

        if(feeAmount > 0){    
            require(_token.transfer(minterAddress, feeAmount), "fee payment failed");
        }

        emit Mint(recipientAddress, minterAddress);

        return tokenID;
    }

    /**
     * Returns the NTF ID for a given social id that we have linked the user too. The function takes the
     * hash of the social id and returns it as a token id uint256
     *
     * @param socialID the social ids of the user
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
     * @param socialID the social ids of the user
     */
    function hasNotBeenMinted(string calldata socialID, address minterAddress)
        internal
        view
        returns (bool)
    {
        address[] memory verifiers = _mintedAccounts[socialID];
        for(uint256 i = 0; i < verifiers.length; i++){
            if(verifiers[i] == minterAddress){
                return false;
            }
        }
        return true;
    }

    /**
     * Verifies the signature supplied belongs to the owner address.
     *
     * @param socialID the social ids of the user
     * @param feeAmount the cost to mint the nft that is sent back to the minterAddress
     * @param recipientAddress the address of the user that gets the nft
     * @param minterAddress  the address of the minter for the nft, that has verified the socialID
     * @param signature signature that we are validating comes from the minterAddress
     *
     * @return true if the signature is valid, false otherwise
     */
    function _verifyMint(
        string calldata socialID,
        uint256 feeAmount,
        address recipientAddress,
        address minterAddress,
        bytes calldata signature
    ) internal pure returns (bool) {
        bytes32 hash = getNftHash(socialID, feeAmount, recipientAddress);
        return hash.recover(signature) == minterAddress;
    }

    /**
     * Hashes the input parameters and hashes using keccak256,
     * attaches eth_sign_message for a validator verification
     *
     * @param socialID the social ids of the user
     * @param feeAmount the cost to mint the nft that is sent back to the minterAddress
     * @param recipientAddress the address of the user that gets the nft
     */
    function getNftHash(
        string calldata socialID,
        uint256 feeAmount,
        address recipientAddress
    ) private pure returns (bytes32) {
        return
            keccak256(abi.encodePacked(socialID, feeAmount, recipientAddress))
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

    /**
     * @dev See {IERC721Metadata-tokenURI}.
     */
    function tokenURI(uint256 tokenId)
        public
        view
        virtual
        override
        returns (string memory)
    {
        require(
            _exists(tokenId),
            "ERC721Metadata: URI query for nonexistent token"
        );

        // string memory baseURI = _baseURI();
        // return bytes(baseURI).length > 0 ? string(abi.encodePacked(baseURI, tokenId.toString())) : "";
        return "";
    }
}
