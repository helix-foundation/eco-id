// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import "./Base64.sol";

/**
 * This is the EcoNFT for verifying an arbitraty claim.
 */
contract EcoNFT is ERC721("EcoNFT", "EcoNFT") {
    /**
     * Use for signarture recovery and verification on minting of EcoNFT
     */
    using ECDSA for bytes32;

    /**
     * The static web url for the nft
     */
    string public constant NFT_EXTERNAL_URL = "https://eco.com/";

    /**
     * The static image url for all the nft's, todo update to real link
     */
    string public constant NFT_IMAGE_URL =
        "https://media4.giphy.com/media/iF0sIlvGhJ5G5WCWIx/giphy.gif?cid=ecf05e47v3jsp4s8gj3u8li6kmfx2d6f98si1fn3o8hjg0d7&rid=giphy.gif&ct=g";

    /**
     * The default pagination limit for the tokenURI meta that reads from the claim verifiers array
     */
    uint256 public constant META_LIMIT = 50;

    /**
     * Event for when a claim is verified for a recipient
     */
    event RegisterClaim(
        string indexed claim,
        uint256 feeAmount,
        address indexed recipient,
        address indexed verifier
    );

    /**
     * Event for when an EcoNFT is minted
     */
    event Mint(
        address indexed recipient,
        string indexed claim,
        uint256 tokenID
    );

    /**
     * Structure for storing a verified claim
     */
    struct VerifiedClaim {
        string claim;
        uint256 tokenID;
        address[] verifiers;
        mapping(address => bool) verifierMap;
    }

    /**
     * Structure for storing the relation between a tokenID and the address and claim
     * that they are linked to
     */
    struct TokenClaim {
        address recipient;
        string claim;
    }

    /**
     * Event for when an EcoNFT is minted
     */
    uint256 public _tokenIDIndex = 1;

    /**
     * Mapping the user address with all claims they have
     */
    mapping(address => mapping(string => VerifiedClaim)) public _verifiedClaims;

    /**
     * Mapping the tokenID of minted tokens with the claim they represent. Necessary as we can't fetch the claim
     * directly from the _verifiedClaims for a given tokenID
     */
    mapping(uint256 => TokenClaim) public _tokenClaimIDs;

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
     *
     * @return true if the claim is verified, false otherwise
     */
    function isClaimVerified(
        address recipient,
        address verifier,
        string calldata claim
    ) external view returns (bool) {
        return _verifiedClaims[recipient][claim].verifierMap[verifier];
    }

    /**
     * Registers a claim by an approved verifier to the recipient of that claim.
     *
     * @param claim the claim that is beign verified
     * @param feeAmount the cost to mint the nft that is sent back to the verifier address
     * @param recipient the address of the recipient of the registered claim
     * @param verifier the address that is verifying the claim
     * @param approveSig signature that proves that the recipient has approved the verifier to register a claim
     * @param verifySig signature that we are validating comes from the verifier address
     */
    function register(
        string calldata claim,
        uint256 feeAmount,
        address recipient,
        address verifier,
        bytes calldata approveSig,
        bytes calldata verifySig
    ) external {
        require(bytes(claim).length != 0, "invalid empty claim");
        require(
            _verifyApprove(claim, feeAmount, recipient, verifier, approveSig),
            "invalid recipient signature"
        );
        require(
            _verifyRegistration(
                claim,
                feeAmount,
                recipient,
                verifier,
                verifySig
            ),
            "invalid verifier signature"
        );

        VerifiedClaim storage vclaim = _verifiedClaims[recipient][claim];
        vclaim.claim = claim;
        require(!vclaim.verifierMap[verifier], "duplicate varifier");
        vclaim.verifiers.push(verifier);
        vclaim.verifierMap[verifier] = true;

        if (feeAmount > 0) {
            require(
                _token.transferFrom(recipient, verifier, feeAmount),
                "fee payment failed"
            );
        }

        emit RegisterClaim(claim, feeAmount, recipient, verifier);
    }

    /**
     * Mints the nft token for the claim
     *
     * @param recipient the address of the recipient for the nft
     * @param claim the claim that is being associated to the nft
     *
     * @return tokenID the ID of the nft
     */
    function mintNFT(address recipient, string memory claim)
        external
        returns (uint256 tokenID)
    {
        VerifiedClaim storage vclaim = _verifiedClaims[recipient][claim];
        require(bytes(vclaim.claim).length != 0, "nft claim non-existant");
        require(vclaim.tokenID == 0, "token already minted for claim");

        tokenID = _tokenIDIndex++;

        vclaim.tokenID = tokenID;
        _tokenClaimIDs[tokenID] = TokenClaim(recipient, claim);
        _safeMint(recipient, tokenID);

        emit Mint(recipient, claim, tokenID);
    }

    /**
     * Constructs and returns the ERC-721 schema metadata as a json object.
     * Calls a pagination for the verifier array that limits to 50.
     * See tokenURICursor if you need to paginate the metadata past that number
     *
     * @param tokenID the id of the nft
     *
     * @return the metadata as a json object
     */
    function tokenURI(uint256 tokenID)
        public
        view
        virtual
        override
        returns (string memory)
    {
        return tokenURICursor(tokenID, 0, META_LIMIT);
    }

    function _substring(
        string memory str,
        uint256 startIndex,
        uint256 endIndex
    ) private pure returns (string memory) {
        bytes memory strBytes = bytes(str);
        bytes memory result = new bytes(endIndex - startIndex);
        for (uint256 i = startIndex; i < endIndex; i++) {
            result[i - startIndex] = strBytes[i];
        }
        return string(result);
    }

    /**
     * Constructs and returns the metadata ERC-721 schema json for the NFT.
     * Uses regular cursor pagination in case the verifiers array for the claim is large.
     *
     * @param tokenID the id of the nft
     * @param cursor the pagination cursor for the verifiers array
     * @param limit  the pagination limit for the verifiers array
     *
     * @return meta the metadata as a json array
     */
    function tokenURICursor(
        uint256 tokenID,
        uint256 cursor,
        uint256 limit
    ) public view virtual returns (string memory meta) {
        require(_exists(tokenID), "non-existent token");

        TokenClaim storage tokenClaim = _tokenClaimIDs[tokenID];
        VerifiedClaim storage vclaim = _verifiedClaims[tokenClaim.recipient][
            tokenClaim.claim
        ];

        string memory metadataName = string.concat(
            "Eco Identity [data:",
            _substring(vclaim.claim, 0, 11),
            "..., verifier:",
            _substring(
                _metaVerifierArray(vclaim.verifiers, cursor, limit),
                0,
                6
            ),
            "...]"
        );

        meta = _metaPrefix(vclaim.claim, metadataName);
        meta = string.concat(
            meta,
            _metaVerifierArray(vclaim.verifiers, cursor, limit),
            '"}]}'
        );
        string memory base = "data:application/json;base64,";
        string memory base64EncodedMeta = Base64.encode(
            bytes(string(abi.encodePacked(meta)))
        );

        meta = string(abi.encodePacked(base, base64EncodedMeta));
    }

    /**
     * Constructs the first portion of the nft metadata
     *
     * @param claim the claim being verified
     *
     * @return meta the partially constructed json
     */
    function _metaPrefix(string storage claim, string memory name)
        internal
        pure
        returns (string memory meta)
    {
        meta = "{";
        meta = string.concat(meta, '"description":', '"EcoNFT",');
        meta = string.concat(
            meta,
            '"external_url":',
            '"',
            NFT_EXTERNAL_URL,
            '",'
        );
        meta = string.concat(meta, '"image":', '"', NFT_IMAGE_URL, '",');
        meta = string.concat(meta, '"name":"', name, '",');
        meta = string.concat(
            meta,
            '"attributes":[{"trait_type":"Data","value":"',
            claim,
            '"},'
        );
        meta = string.concat(meta, '{"trait_type":"Verifiers","value":"');
    }

    /**
     * Constructs the verifier address array portion of the nft metadata
     *
     * @param verifiers the claim being verified
     * @param cursor the pagination cursor for the verifiers array
     * @param limit  the pagination limit for the verifiers array
     *
     * @return meta the partially constructed json
     */
    function _metaVerifierArray(
        address[] storage verifiers,
        uint256 cursor,
        uint256 limit
    ) internal view returns (string memory meta) {
        //get the ending position
        uint256 readEnd = cursor + limit;
        uint256 vl = verifiers.length;
        uint256 end = vl <= readEnd ? vl : readEnd;

        uint256 lastPoint = end - 1;
        for (uint256 i = cursor; i < end; i++) {
            string memory addr = Strings.toHexString(
                uint256(uint160(verifiers[i])),
                20
            );

            if (i < lastPoint) {
                meta = string.concat(meta, addr, ", ");
            } else {
                meta = string.concat(meta, addr);
            }
        }
    }

    /**
     * Verifies the signature supplied grants the verifier approval by the recipient to modify their claim
     *
     * @param claim the claim being verified
     * @param feeAmount the cost paid to the verifier by the recipient
     * @param recipient the address of the recipient of a registration
     * @param verifier  the address of the verifying agent
     * @param approveSig signature that we are validating grants the verifier permission to register the claim to the recipient
     *
     * @return true if the signature is valid, false otherwise
     */
    function _verifyApprove(
        string calldata claim,
        uint256 feeAmount,
        address recipient,
        address verifier,
        bytes calldata approveSig
    ) internal pure returns (bool) {
        bytes32 hash = getApproveHash(claim, feeAmount, recipient, verifier);
        return hash.recover(approveSig) == recipient;
    }

    /**
     * Verifies the signature supplied belongs to the verifier for a certain claim.
     *
     * @param claim the claim being verified
     * @param feeAmount the cost paid to the verifier by the recipient
     * @param recipient the address of the recipient of a registration
     * @param verifier  the address of the verifying agent
     * @param signature signature that we are validating comes from the verifier
     *
     * @return true if the signature is valid, false otherwise
     */
    function _verifyRegistration(
        string calldata claim,
        uint256 feeAmount,
        address recipient,
        address verifier,
        bytes calldata signature
    ) internal pure returns (bool) {
        bytes32 hash = getRegistrationHash(claim, feeAmount, recipient);
        return hash.recover(signature) == verifier;
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
     * Hashes the input parameters for the registration signature verification
     *
     * @param claim the claim being attested to
     * @param feeAmount the cost to register the claim the recipient is willing to pay
     * @param recipient the address of the user that is having a claim registered
     */
    function getRegistrationHash(
        string calldata claim,
        uint256 feeAmount,
        address recipient
    ) private pure returns (bytes32) {
        return
            keccak256(abi.encodePacked(claim, feeAmount, recipient))
                .toEthSignedMessageHash();
    }

    /**
     * Hashes the input parameters for the approval signature verification
     *
     * @param claim the claim being attested to
     * @param feeAmount the cost paid to the verifier by the recipient
     * @param recipient the address of the user that is having a claim registered
     * @param verifier the address of the verifier of the claim
     */
    function getApproveHash(
        string calldata claim,
        uint256 feeAmount,
        address recipient,
        address verifier
    ) private pure returns (bytes32) {
        return
            keccak256(abi.encodePacked(claim, feeAmount, recipient, verifier))
                .toEthSignedMessageHash();
    }
}
