The repository contains the [EcoID](/contracts/EcoID.sol) contract, along with support tests and scripts. Purpose of the EcoID is to provide for a generic and open ERC-721 compliant NFT that can be used to register claims by one party onto another party.

## Table of Contents

- [Build & Test](#build--test)
- [Installing Package](#installing--package)
- [EcoID Contract](#ecoid-contract)
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

## Installing Package

This repo is published on [Github Packages](npm.pkg.github.com/). In order to consume the package in your own blockchain and web3 projects you need to tell npm where to find github packages.

To add github packages to your project, create a file in your project root named `.npmrc`, with the below contents:

```
@helix-foundation:registry=https://npm.pkg.github.com
```

After you add the above file to your repo, both `npm` and `yarn` should be able to fetch the library.

## EcoID Contract

The [EcoID](/contracts/EcoID.sol) contract is an ERC721 NFT, whose purpose is to act as a general, permissionless registrar of claims that are verified by oracles. This contract allows anyone to attest to a claim on an ethereum address. Multiple oracles can attest to a claim associated to an ethereum address, with the ability to make those attestation permanent or revocable. Every claim on an account can then be used to mint a single NFT representing that claim along with its verifiers.

To register a claim takes the cooperation of two parties: the participant and the verifier. The participant is the address that the verifier is attesting a given claim to. The register function requires that both the participant and verifier submit an EIP712 signature, where they both match; the claim, the fee the participant is paying in Eco to the verifier if any, and if the verification is revocable. To unregister the claim, the claim has to have been verified with a revocalbe verification. Unregistration only requires the participation of the verifier. In the case that a unregistration occurs, which causes a claim to no longer have any verifiers, any associated NFT to that claim still persists. Its up to participants and verifiers to decide under what circumstances they register and unregister verifications.

To mint an NFT, anyone can call `function mintNFT(address recipient, string memory claim)`. Any claim with at least one verification can get a minted NFT.

Once a claim has had an NFT minted, that NFT metadata can then be viewed through the `tokenURI(uint256 tokenID)` method. The metadata of an NFT is dynamically generated when called and lists the claim and all of its verifiers, along with some static data such as image and external url. In the case where the total number of verifiers on a single NFT exceeds 50, there is a paginated cursor method `function tokenURICursor(uint256 tokenID,uint256 cursor,uint256 limit)` that can be called instead.

## Deploy Script

The Eco ID system can be deployed to a test or mainnet chain by using the [deploy](/scripts/deploy.ts) script. The script deploys the [EcoID](/contracts/EcoID.sol) contract. In order for the script to work, it needs several environmental variables set such as the addresses of the Eco tokens to use for the nft contract; as well as some other deploy specific variables such as infura endpoints. The [deploy](/scripts/deploy.ts) script can be read to figure out all the environmental variables that are necessary. There is also a [.env.example](/.env.example) file with the list of all enviromnetal variable used in all the scripts, and not just the deploy script. The [deploy](/scripts/deploy.ts) script is set up to pull credentials from a `.env` file in the project root, that is intentionally ignored in [.gitingnore](./.gitignore) for security reasons.

To deploy the Eco ID system to the goerli ethereum network:

```
yarn deploy
```

The network the contracts are deployed to can be changed by editing the `deploy` command in [package.json](./package.json) and changing the `--network goerli` to the desired network. Note if you do change the deploy network, you will also have to ensure that your infura endpoints and private key are valid for that network in [hardhat.config.ts](./hardhat.config.ts)

## Contributing

Contributions are welcome. Please submit any issues as issues on GitHub, and open a pull request with any contributions.

## License

[MIT (c) Helix Foundation](./LICENSE)
