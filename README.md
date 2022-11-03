The repository contains two components: the [EcoID](/contracts/EcoID.sol) and [EcoClaim](/contracts/EcoClaim.sol) contracts, along with support tests and scripts. Purpose of the EcoID is to provide for a generic and open ERC-721 compliant NFT that can be used to register claims by one party onto another party. The EcoClaim contract is meant to distribute tokens to a set of accounts based on their eligibility, which is validated by looking up their ether accounts on the EcoID registry.

## Table of Contents

- [Build & Test](#build--test)
- [EcoID Contract](#ecoid-contract)
- [Claim Contract](#claim-contract)
- [Merkle Script](#merkle-script)
- [Deploy Script](#deploy-script)

## Build & Test

To build the project:

```
yarn build
```

To test the project:

```
yarn test
```

To run the linter and auto correct formatting issues:

```
yarn format
```

## EcoID Contract

The [EcoID](/contracts/EcoID.sol) contract is an ERC721 NFT, whose purpose is to act as a general, permissionless registrar of claims that are verified by oracles. This contract allows anyone to attest to a claim on an ethereum address. Multiple oracles can attest to a claim associated to an ethereum address, with the ability to make those attestation permanent or revocable. Every claim on an account can then be used to mint a single NFT representing that claim along with its verifiers.

To register a claim takes the cooperation of two parties: the participant and the verifier. The participant is the address that the verifier is attesting a given claim to. The register function requires that both the participant and verifier submit an EIP712 signature, where they both match; the claim, the fee the participant is paying in Eco to the verifier if any, and if the verification is revocable. To unregister the claim, the claim has to have been verified with a revocalbe verification. Unregistration only requires the participation of the verifier. In the case that a unregistration occurs, which causes a claim to no longer have any verifiers, any associated NFT to that claim still persists. Its up to participants and verifiers to decide under what circumstances they register and unregister verifications.

To mint an NFT, anyone can call `function mintNFT(address recipient, string memory claim)`. Any claim with at least one verification can get a minted NFT.

Once a claim has had an NFT minted, that NFT metadata can then be viewed through the `tokenURI(uint256 tokenID)` method. The metadata of an NFT is dynamically generated when called and lists the claim and all of its verifiers, along with some static data such as image and external url. In the case where the total number of verifiers on a single NFT exceeds 50, there is a paginated cursor method `function tokenURICursor(uint256 tokenID,uint256 cursor,uint256 limit)` that can be called instead.

## Claim Contract

The [EcoClaim](/contracts/EcoClaim.sol) contract purpose is to hold and disburse funds to accounts in our community. A list of users and their points are generated off chain, then we take that list and generate a merkle tree out of it. The root of the merkle tree passed to the EcoClaim contract during construction, so that the contract can verify that a user is within that set later on. Each user in the user set, is entitled to both Eco and Ecox tokens in direct proportion to their point total. The contract allows users to make two claim; the first claim must be made within 1 year of the contract deploy, the second can be made at any point after the initial claim. If the initial claim for an account is not made within that 1 year, the user will effectively forfeit their tokens and not be able to claim any.

The first claim a participant makes rewards them with 5x their points balance in Eco, and 0.5x their points balance in Ecox. To make the first claim, the user calls the `function claimTokens(bytes32[] memory proof,string calldata socialID,uint256 points)` method or the `function claimTokensOnBehalf(bytes32[] memory proof,string calldata socialID,uint256 points,address recipient,uint256 feeAmount,uint256 deadline,bytes calldata recipientSig)` method. The latter allows for someone other than the participant to call claim on their behalf and be granted a fee in Eco for the service. The `claimTokensOnBehalf` method requires a EIP712 signature from the user.

The second claim a participant makes scales with the time the user takes to make it. The participant gets another 5x their points in Eco, and dynamic amount of Ecox based on how long the wait to call the second claim. The longer the user waits the greater the amount of Ecox they will be able to withdraw. This vesting schedule begins at the time of the first claim. The vesting schedule changes returns at 1, 6, 18, and 24 months after the first claim, with the returns being 0.5, 1.5, 2.5 and 3.5x their points in Ecox. To make the second claim, the user calls the `function releaseTokens(string calldata socialID)` method or the `function releaseTokensOnBehalf(string calldata socialID,address recipient,uint256 feeAmount,uint256 deadline,bytes calldata recipientSig)` method. The latter allows for someone other than the participant to call release on their behalf and be granted a fee in Eco for the service. The `releaseTokensOnBehalf` method requires a EIP712 signature from the user, and once the signature is release into the wild, anyone can call it on chain to `releaseTokensOnBehalf` for the user. The intended process for `releaseTokensOnBehalf` would be to only generate a release signature when you want to release your tokens at the vesting period.

## Merkle Script

The EcoClaim contract requires some configurations at initialization. The contract distributes tokens to a set of social accounts that is stored in a merkle tree off chain. These social accounts are either discord or twitter accounts. When the contract is called, it needs to check:

1. The inclusion of a given social account and its point total in its set for distribution
2. The ethereum address associated with the social account

To check for inclusion of a given social id in its set, the contract employs a merkle tree. The merkle tree is generated from the set of all social accounts. Each leaf of the tree is comprised of two variables: `{socialID: "discord:asdf", points: 123}` Once the tree is generated, the contract is initialized with the root and layer depth of the merkle tree. With those two variables, the contract can calculate whether a given social id and its corresponding points are included in that set without needing to store the whole set.

To auto generate the merkle tree and points lookup files:

```
yarn merkle
```

For the initial deploy of the EcoClaim contract, we generated and used these two files which you can find:

The hashtable matching the claim ids with their points: [local file](/raw/claim_points) or on [IPFS](https://ipfs.io/ipfs/QmawAKmYL95JbvjKGwh2QJQGbR1AbLffV3kdYaENKQjy2f)

The merkle tree can be found at: [local file](/raw/merkle_tree) or on [IPFS](https://ipfs.io/ipfs/QmZB2vsvAVjp7Xkg9d9oyagDLmziPp5tTEFk2d9cxUSAKx)

## Deploy Script

The Eco ID system can be deployed to a test or mainnet chain by using the [deploy](/scripts/deploy.ts) script. The script first deploys the [EcoID](/contracts/EcoID.sol) contract, and then deploys the [EcoClaim](/contracts/EcoClaim.sol) contract. In order for the script to work, it needs several environmental variables set such as the addresses of the Eco and Ecox tokens to use for the nft and claims contracts; as well as some other deploy specific variables such as infura endpoints. The [deploy](/scripts/deploy.ts) script can be read to figure out all the environmental variables that are necessary. There is also a [.env.example](/.env.example) file with the list of all enviromnetal variable used in all the scripts, and not just the deploy script. The [deploy](/scripts/deploy.ts) script is set up to pull credentials from a `.env` file in the project root, that is intentionally ignored in [.gitingnore](./.gitignore) for security reasons.

To deploy the Eco ID system to the goerli ethereum network:

```
yarn deploy
```

The network the contracts are deployed to can be changed by editing the `deploy` command in [package.json](./package.json) and changing the `--network goerli` to the desired network. Note if you do change the deploy network, you will also have to ensure that your infura endpoints and private key are valid for that network in [hardhat.config.ts](./hardhat.config.ts)
