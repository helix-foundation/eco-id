// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

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
    string public constant NFT_EXTERNAL_URL = "https://eco.org/";

    /**
     * The static image url for all the nft's, todo update to real link
     */
    string public constant NFT_IMAGE_URL =
        "https://ipfs.io/ipfs/QmZxvWzRT4Kq3FGEjvMeBaad7qvrSc79MqPggk5At5qxP6";

    /**
     * The default pagination limit for the tokenURI meta that reads from the claim verifiers array
     */
    uint256 public constant META_LIMIT = 50;

    /**
     * The length of a substring for the name field of an nft
     */
    uint256 public constant SUB_NAME_LENGTH = 6;

    /**
     * Event for when the constructor has finished
     */
    event InitializeEcoNFT();

    /**
     * Event for when a claim is verified for a recipient
     */
    event RegisterClaim(
        string claim,
        uint256 feeAmount,
        bool revocable,
        address indexed recipient,
        address indexed verifier
    );

    /**
     * Event for when a claim is unregistered by the verifier
     */
    event UnregisterClaim(
        string claim,
        address indexed recipient,
        address indexed verifier
    );

    /**
     * Event for when an EcoNFT is minted
     */
    event Mint(address indexed recipient, string claim, uint256 tokenID);

    /**
     * Structure for storing a verified claim
     */
    struct VerifiedClaim {
        string claim;
        uint256 tokenID;
        VerifierRecord[] verifiers;
        mapping(address => bool) verifierMap;
    }

    /**
     * Structure for the verifier record
     */
    struct VerifierRecord {
        address verifier;
        bool revocable;
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
     * Stores the last token index minted
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

    /**
     * Constructor that sets the ERC20 and emits an initialization event
     *
     * @param token the erc20 that is used to pay for registrations
     */
    constructor(ERC20 token) {
        _token = token;

        emit InitializeEcoNFT();
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
     * @param revocable true if the verifier can revoke their verification of the claim in the future
     * @param recipient the address of the recipient of the registered claim
     * @param verifier the address that is verifying the claim
     * @param approveSig signature that proves that the recipient has approved the verifier to register a claim
     * @param verifySig signature that we are validating comes from the verifier address
     */
    function register(
        string calldata claim,
        uint256 feeAmount,
        bool revocable,
        address recipient,
        address verifier,
        bytes calldata approveSig,
        bytes calldata verifySig
    ) external _validClaim(claim) {
        require(
            _verifyRegistrationApprove(
                claim,
                feeAmount,
                revocable,
                recipient,
                verifier,
                approveSig
            ),
            "invalid recipient signature"
        );
        require(
            _verifyRegistrationVerify(
                claim,
                feeAmount,
                revocable,
                recipient,
                verifier,
                verifySig
            ),
            "invalid verifier signature"
        );

        VerifiedClaim storage vclaim = _verifiedClaims[recipient][claim];
        require(!vclaim.verifierMap[verifier], "duplicate varifier");
        vclaim.claim = claim;
        vclaim.verifiers.push(VerifierRecord(verifier, revocable));
        vclaim.verifierMap[verifier] = true;

        if (feeAmount > 0) {
            require(
                _token.transferFrom(recipient, verifier, feeAmount),
                "fee payment failed"
            );
        }

        emit RegisterClaim(claim, feeAmount, revocable, recipient, verifier);
    }

    /**
     * Revokes a claim that has been made by the verifier if it was revocable
     *
     * @param claim the claim that was verified
     * @param recipient the address of the recipient of the registered claim
     * @param verifier the address that had verified the claim
     * @param verifySig signature that we are validating comes from the verifier address
     */
    function unregister(
        string calldata claim,
        address recipient,
        address verifier,
        bytes calldata verifySig
    ) external _validClaim(claim) {
        VerifiedClaim storage vclaim = _verifiedClaims[recipient][claim];
        require(vclaim.verifierMap[verifier], "claim not verified");
        VerifierRecord storage record = _getVerifierRecord(
            verifier,
            vclaim.verifiers
        );
        require(record.revocable, "claim unrevocable");

        require(
            _verifyUnregistration(claim, recipient, verifier, verifySig),
            "invalid verifier signature"
        );

        vclaim.verifierMap[verifier] = false;
        _removeVerifierRecord(verifier, vclaim.verifiers);

        emit UnregisterClaim(claim, recipient, verifier);
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
        require(vclaim.verifiers.length > 0, "nft claim non-existant");
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

        string memory claim = vclaim.claim;
        string memory nameFrag = _getStringSize(claim) > SUB_NAME_LENGTH
            ? string.concat(_substring(claim, 0, SUB_NAME_LENGTH + 1), "...")
            : claim;
        bool hasVerifiers = vclaim.verifiers.length > 0;
        string memory verifiersFrag = hasVerifiers
            ? string.concat(
                _substring(
                    Strings.toHexString(
                        uint256(uint160(vclaim.verifiers[0].verifier)),
                        20
                    ),
                    0,
                    SUB_NAME_LENGTH + 1
                ),
                "...]"
            )
            : "null]";
        string memory metadataName = string.concat(
            "Eco Fragment [data:",
            nameFrag,
            ", verifiers:",
            verifiersFrag
        );

        meta = _metaPrefix(vclaim.claim, metadataName, hasVerifiers);
        string memory closing = hasVerifiers ? '"}]}' : "]}";
        meta = string.concat(
            meta,
            _metaVerifierArray(vclaim.verifiers, cursor, limit),
            closing
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
     * @param claim the claim
     * @param name the name of the nft
     * @param hasVerifiers whether the nft has any verifiers
     * @return meta the partially constructed json
     */
    function _metaPrefix(
        string storage claim,
        string memory name,
        bool hasVerifiers
    ) internal pure returns (string memory meta) {
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
        string memory closing = hasVerifiers ? '"},' : '"}';
        meta = string.concat(
            meta,
            '"attributes":[{"trait_type":"Data","value":"',
            claim,
            closing
        );
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
        VerifierRecord[] storage verifiers,
        uint256 cursor,
        uint256 limit
    ) internal view returns (string memory meta) {
        if (verifiers.length == 0) {
            return meta;
        }
        //get the ending position
        uint256 readEnd = cursor + limit;
        uint256 vl = verifiers.length;
        uint256 end = vl <= readEnd ? vl : readEnd;

        uint256 lastPoint = end - 1;
        for (uint256 i = cursor; i < end; i++) {
            string memory addr = Strings.toHexString(
                uint256(uint160(verifiers[i].verifier)),
                20
            );
            string memory revocable = verifiers[i].revocable ? "true" : "false";

            if (i < lastPoint) {
                meta = string.concat(
                    meta,
                    '{"trait_type":"Verifier","value":"',
                    addr,
                    '","revocable":"',
                    revocable,
                    '"},'
                );
            } else {
                meta = string.concat(
                    meta,
                    '{"trait_type":"Verifier","value": "',
                    addr,
                    '","revocable":"',
                    revocable
                );
            }
        }
    }

    /**
     * Verifies the signature supplied grants the verifier approval by the recipient to modify their claim
     *
     * @param claim the claim being verified
     * @param feeAmount the cost paid to the verifier by the recipient
     * @param revocable true if the verifier can revoke their verification of the claim in the future
     * @param recipient the address of the recipient of a registration
     * @param verifier  the address of the verifying agent
     * @param approveSig signature that we are validating grants the verifier permission to register the claim to the recipient
     *
     * @return true if the signature is valid, false otherwise
     */
    function _verifyRegistrationApprove(
        string calldata claim,
        uint256 feeAmount,
        bool revocable,
        address recipient,
        address verifier,
        bytes calldata approveSig
    ) internal pure returns (bool) {
        bytes32 hash = _getApproveHash(
            claim,
            feeAmount,
            revocable,
            recipient,
            verifier
        );
        return hash.recover(approveSig) == recipient;
    }

    /**
     * Verifies the signature supplied belongs to the verifier for a certain claim.
     *
     * @param claim the claim being verified
     * @param feeAmount the cost paid to the verifier by the recipient
     * @param revocable true if the verifier can revoke their verification of the claim in the future
     * @param recipient the address of the recipient of a registration
     * @param verifier  the address of the verifying agent
     * @param signature signature that we are validating comes from the verifier
     *
     * @return true if the signature is valid, false otherwise
     */
    function _verifyRegistrationVerify(
        string calldata claim,
        uint256 feeAmount,
        bool revocable,
        address recipient,
        address verifier,
        bytes calldata signature
    ) internal pure returns (bool) {
        bytes32 hash = _getRegistrationHash(
            claim,
            feeAmount,
            revocable,
            recipient
        );
        return hash.recover(signature) == verifier;
    }

    /**
     * Verifies the signature supplied belongs to the verifier for the claim.
     *
     * @param claim the claim that was verified
     * @param recipient  the address of the recipient
     * @param verifier  the address of the verifying agent
     * @param signature signature that we are validating comes from the verifier
     * @return true if the signature is valid, false otherwise
     */
    function _verifyUnregistration(
        string calldata claim,
        address recipient,
        address verifier,
        bytes calldata signature
    ) internal pure returns (bool) {
        bytes32 hash = _getUnregistrationHash(claim, recipient, verifier);
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
     * @param revocable true if the verifier can revoke their verification of the claim in the future
     * @param recipient the address of the user that is having a claim registered
     */
    function _getRegistrationHash(
        string calldata claim,
        uint256 feeAmount,
        bool revocable,
        address recipient
    ) private pure returns (bytes32) {
        return
            keccak256(abi.encodePacked(claim, feeAmount, revocable, recipient))
                .toEthSignedMessageHash();
    }

    /**
     * Hashes the input parameters for the unregistration signature verification
     *
     * @param claim the claim that was verified
     * @param recipient the address of the user that owns that claim
     * @param verifier  the address of the verifying agent
     */
    function _getUnregistrationHash(
        string calldata claim,
        address recipient,
        address verifier
    ) private pure returns (bytes32) {
        return
            keccak256(abi.encodePacked(claim, recipient, verifier))
                .toEthSignedMessageHash();
    }

    /**
     * Hashes the input parameters for the approval signature verification
     *
     * @param claim the claim being attested to
     * @param feeAmount the cost paid to the verifier by the recipient
     * @param revocable true if the verifier can revoke their verification of the claim in the future
     * @param recipient the address of the user that is having a claim registered
     * @param verifier the address of the verifier of the claim
     */
    function _getApproveHash(
        string calldata claim,
        uint256 feeAmount,
        bool revocable,
        address recipient,
        address verifier
    ) private pure returns (bytes32) {
        return
            keccak256(
                abi.encodePacked(
                    claim,
                    feeAmount,
                    revocable,
                    recipient,
                    verifier
                )
            ).toEthSignedMessageHash();
    }

    /**
     * Checks that the claim is not empty
     *
     * @param claim the claim to check
     */
    modifier _validClaim(string memory claim) {
        require(bytes(claim).length != 0, "invalid empty claim");
        _;
    }

    /**
     * Finds the verifier record in the array and returns it, or reverts
     *
     * @param verifier the verified address to search for
     * @param verifierRecords the verifier records array
     */
    function _getVerifierRecord(
        address verifier,
        VerifierRecord[] storage verifierRecords
    ) internal view returns (VerifierRecord storage) {
        for (uint256 i = 0; i < verifierRecords.length; i++) {
            if (verifierRecords[i].verifier == verifier) {
                return verifierRecords[i];
            }
        }
        //should never get here
        revert("invalid verifier");
    }

    /**
     * Removes a verifier from the verifiers array, does not preserve order
     *
     * @param verifier the verifier to remove from the array
     * @param verifierRecords the verifier records array
     */
    function _removeVerifierRecord(
        address verifier,
        VerifierRecord[] storage verifierRecords
    ) internal {
        for (uint256 i = 0; i < verifierRecords.length; i++) {
            if (verifierRecords[i].verifier == verifier) {
                verifierRecords[i] = verifierRecords[
                    verifierRecords.length - 1
                ];
                verifierRecords.pop();
                return;
            }
        }
    }

    /**
     * Returns a substring of the input argument
     */
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
     * Returns the size of a string in bytes
     *
     * @param str string to check
     */
    function _getStringSize(string memory str) internal pure returns (uint256) {
        return bytes(str).length;
    }
}
