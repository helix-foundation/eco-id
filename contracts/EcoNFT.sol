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
    event Mint(
        address indexed recipient,
        string indexed claim,
        uint256 tokenID
    );

    struct VerifiedClaim {
        string claim;
        uint256 tokenID;
        address[] verifiers;
        mapping(address => bool) verifierMap;
    }

    struct TokenClaim {
        address recipient;
        string claim;
    }

    /**
     * Event for when an EcoNFT is minted
     */
    uint256 public _tokenIDIndex = 1;

    /**
     * Mapping the user address with all social accounts they have
     */
    mapping(address => mapping(string => VerifiedClaim)) public _verifiedClaims;

    /**
     * Mapping the tokenID of minted tokens with the claim they represent. Necessary as we can't fetch the claim
     * directly from the _verifiedClaims for a given tokenID
     */
    mapping(uint256 => TokenClaim) public _tokenClaimIDs;

    /**
     * Mapping of the hash(claim, address) to the address
     */
    mapping(string => address) public _claimAddresses;

    /**
     * The token contract that is used for fee payments to the minter address
     */
    ERC20 public immutable _token;

    constructor(ERC20 token) {
        _token = token;
    }

    /**
     * Check if the claim has been verified by the given verifier for the given address
     *
     * @param recipient the address of the associated claim
     * @param verifier the address of the verifier for the claim on the recipient address
     * @param claim the claim that should be verified
     */
    function isClaimVerified(
        address recipient,
        address verifier,
        string calldata claim
    ) external view returns (bool) {
        return _verifiedClaims[recipient][claim].verifierMap[verifier];
    }

    /**
     * Mints an EcoNFT if the discord and twitter IDs have not been claimed yet, and only when the owener of this EcoNFT contract
     * has signed off on the minting
     *
     * @param claim the claim that is beign verified
     * @param feeAmount the cost to mint the nft that is sent back to the minterAddress
     * @param recipient the address of the recipient of the newly minted nft
     * @param verifier the address of the minter for the nft, that has verified the socialID
     * @param signature signature that we are validating comes from the minterAddress
     */
    // multi source array as meta
    function register(
        string calldata claim,
        uint256 feeAmount,
        address recipient,
        address verifier,
        bytes calldata signature
    ) external {
        require(bytes(claim).length == 0, "invalid empty claim");
        require(
            _verifyMint(claim, feeAmount, recipient, verifier, signature),
            "signature did not match"
        );

        VerifiedClaim storage vclaim = _verifiedClaims[recipient][claim];
        vclaim.claim = claim;
        require(!vclaim.verifierMap[verifier], "duplicate varifier");
        vclaim.verifiers.push(verifier);
        vclaim.verifierMap[verifier] = true;

        if (feeAmount > 0) {
            require(_token.transfer(verifier, feeAmount), "fee payment failed");
        }
    }

    /**
     * Mints the nft for the claim
     *
     * @param recipient the address of the recipient for the nft
     * @param claim the claim that is being associated to the nft
     *
     */
    function mintNFT(address recipient, string memory claim) external {
        VerifiedClaim storage vclaim = _verifiedClaims[recipient][claim];
        require(vclaim.tokenID == 0, "token already minted for claim");

        uint256 tokenID = _tokenIDIndex++;

        vclaim.tokenID = tokenID;
        _tokenClaimIDs[tokenID] = TokenClaim(recipient, claim);
        _safeMint(recipient, tokenID);

        emit Mint(recipient, claim, tokenID);
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
     * @param claim the claim being attested to
     * @param feeAmount the cost to mint the nft that is sent back to the minterAddress
     * @param recipient the address of the user that gets the nft
     */
    function getNftHash(
        string calldata claim,
        uint256 feeAmount,
        address recipient
    ) private pure returns (bytes32) {
        return
            keccak256(abi.encodePacked(claim, feeAmount, recipient))
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
    function tokenURI(uint256 tokenID)
        public
        view
        virtual
        override
        returns (string memory)
    {
        require(_exists(tokenID), "nonexistent token");

        TokenClaim storage tokenClaim = _tokenClaimIDs[tokenID];
        VerifiedClaim storage vclaim = _verifiedClaims[tokenClaim.recipient][
            tokenClaim.claim
        ];

        return string(abi.encodePacked(vclaim.verifiers));
    }
}
