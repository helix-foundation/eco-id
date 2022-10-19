import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { expect } from "chai"
import { ethers } from "hardhat"
import { EcoNFT, EcoTest } from "../typechain-types"
import { deployEcoNFT, Meta } from "./utils/fixtures"
import {
  signRegistrationTypeMessage,
  signUnregistrationTypeMessage,
} from "./utils/sign"
import { latestBlockTimestamp } from "./utils/time"

/**
 * Tests that the EcoNFT contract performs correctly on minting of nft's
 * Note, check encryption https://dev.to/rounakbanik/tutorial-digital-signatures-nft-allowlists-eeb
 */
describe("EcoNFT tests", async function () {
  const claim = "discord:21306324"
  let owner: SignerWithAddress, addr0: SignerWithAddress
  let eco: EcoTest
  let ecoNft: EcoNFT
  const feeAmount = 1000
  let deadline: number, chainID: number, nonce: number

  type NftAttribute = { trait_type: string; value: string }

  beforeEach(async function () {
    ;[owner, addr0] = await ethers.getSigners()
    ;[eco, ecoNft] = await deployEcoNFT()
    deadline = parseInt(await latestBlockTimestamp(), 16) + 10000
    chainID = (await ethers.provider.getNetwork()).chainId
    nonce = (await ecoNft.nonces(claim)).toNumber()
  })
  describe("On nft transfer", async function () {
    it("returns proper domain separator", async () => {
      const domain = {
        name: "EcoNFT",
        version: "1",
        chainId: chainID,
        verifyingContract: ecoNft.address,
      }
      const expectedDomainSeparator =
        ethers.utils._TypedDataEncoder.hashDomain(domain)
      expect(await ecoNft.DOMAIN_SEPARATOR()).to.equal(expectedDomainSeparator)
    })

    it("should not allow the transfer of nft's", async function () {
      const revocable = false

      const [approvSig, verifySig] = await signRegistrationTypeMessage(
        claim,
        feeAmount,
        revocable,
        addr0,
        owner,
        deadline,
        nonce,
        chainID,
        ecoNft.address
      )
      await payFee(addr0, feeAmount)

      await ecoNft.register(
        claim,
        feeAmount,
        revocable,
        addr0.address,
        owner.address,
        deadline,
        approvSig,
        verifySig
      )

      const tokenID = 1
      await expect(ecoNft.mintNFT(addr0.address, claim))
        .to.emit(ecoNft, "Mint")
        .withArgs(addr0.address, claim, tokenID)

      await expect(
        ecoNft.transferFrom(addr0.address, owner.address, tokenID)
      ).to.be.revertedWith("ERC721: caller is not token owner nor approved")
    })
  })

  describe("On registration", async function () {
    it("should fail on expired deadline", async function () {
      const expiredDeadline = parseInt(await latestBlockTimestamp(), 16) - 1000
      const revocable = true
      const [approvSig, verifySig] = await signRegistrationTypeMessage(
        claim,
        feeAmount,
        revocable,
        addr0,
        owner,
        expiredDeadline,
        nonce,
        chainID,
        ecoNft.address
      )

      await expect(
        ecoNft.register(
          claim,
          feeAmount,
          revocable,
          addr0.address,
          owner.address,
          expiredDeadline,
          approvSig,
          verifySig
        )
      ).to.be.revertedWith("DeadlineExpired()")
    })

    it("should fail registration on empty claim", async function () {
      const revocable = true
      const [approvSig, verifySig] = await signRegistrationTypeMessage(
        claim,
        feeAmount,
        revocable,
        addr0,
        owner,
        deadline,
        nonce,
        chainID,
        ecoNft.address
      )

      await expect(
        ecoNft.register(
          "",
          feeAmount,
          revocable,
          addr0.address,
          owner.address,
          deadline,
          approvSig,
          verifySig
        )
      ).to.be.revertedWith("EmptyClaim()")
    })

    it("should fail an invalid approval signature", async function () {
      const revocable = false
      const [, verifySig] = await signRegistrationTypeMessage(
        claim,
        feeAmount,
        revocable,
        addr0,
        owner,
        deadline,
        nonce,
        chainID,
        ecoNft.address
      )
      await expect(
        ecoNft.register(
          claim,
          feeAmount,
          revocable,
          addr0.address,
          owner.address,
          deadline,
          verifySig,
          verifySig
        )
      ).to.be.revertedWith("InvalidRegistrationApproveSignature()")
    })

    it("should fail an invalid verify signature", async function () {
      const revocable = true
      const [approvSig] = await signRegistrationTypeMessage(
        claim,
        feeAmount,
        revocable,
        addr0,
        owner,
        deadline,
        nonce,
        chainID,
        ecoNft.address
      )

      const [, verifySig] = await signRegistrationTypeMessage(
        claim + "1",
        feeAmount,
        revocable,
        addr0,
        owner,
        deadline,
        nonce,
        chainID,
        ecoNft.address
      )

      await expect(
        ecoNft.register(
          claim,
          feeAmount,
          revocable,
          addr0.address,
          owner.address,
          deadline,
          approvSig,
          verifySig
        )
      ).to.be.revertedWith("InvalidRegistrationVerifierSignature()")
    })

    it("should fail on a fee amount difference", async function () {
      const revocable = true
      const [approvSig] = await signRegistrationTypeMessage(
        claim,
        feeAmount,
        revocable,
        addr0,
        owner,
        deadline,
        nonce,
        chainID,
        ecoNft.address
      )

      const [, verifySig] = await signRegistrationTypeMessage(
        claim,
        feeAmount + 10,
        revocable,
        addr0,
        owner,
        deadline,
        nonce,
        chainID,
        ecoNft.address
      )

      await expect(
        ecoNft.register(
          claim,
          feeAmount,
          revocable,
          addr0.address,
          owner.address,
          deadline,
          approvSig,
          verifySig
        )
      ).to.be.revertedWith("InvalidRegistrationVerifierSignature()")
    })

    it("should fail on nonce difference", async function () {
      const revocable = true
      const [approvSig] = await signRegistrationTypeMessage(
        claim,
        feeAmount,
        revocable,
        addr0,
        owner,
        deadline,
        nonce,
        chainID,
        ecoNft.address
      )

      const [, verifySig] = await signRegistrationTypeMessage(
        claim,
        feeAmount + 10,
        revocable,
        addr0,
        owner,
        deadline,
        nonce + 1,
        chainID,
        ecoNft.address
      )

      await expect(
        ecoNft.register(
          claim,
          feeAmount,
          revocable,
          addr0.address,
          owner.address,
          deadline,
          approvSig,
          verifySig
        )
      ).to.be.revertedWith("InvalidRegistrationVerifierSignature()")
    })

    it("should fail on payment transfer failure", async function () {
      const revocable = false
      const [approvSig, verifySig] = await signRegistrationTypeMessage(
        claim,
        feeAmount,
        revocable,
        addr0,
        owner,
        deadline,
        nonce,
        chainID,
        ecoNft.address
      )

      await expect(
        ecoNft.register(
          claim,
          feeAmount,
          revocable,
          addr0.address,
          owner.address,
          deadline,
          approvSig,
          verifySig
        )
      ).to.be.revertedWith("ERC20: insufficient allowance")
    })

    it("should register and emit on valid registration", async function () {
      const revocable = true
      const [approvSig, verifySig] = await signRegistrationTypeMessage(
        claim,
        feeAmount,
        revocable,
        addr0,
        owner,
        deadline,
        nonce,
        chainID,
        ecoNft.address
      )

      await payFee(addr0, feeAmount)
      await expect(
        ecoNft.register(
          claim,
          feeAmount,
          revocable,
          addr0.address,
          owner.address,
          deadline,
          approvSig,
          verifySig
        )
      )
        .to.emit(ecoNft, "RegisterClaim")
        .withArgs(claim, feeAmount, revocable, addr0.address, owner.address)
    })

    it("should fail on trying to use the same signature for a second consecutive registration", async function () {
      const revocable = true
      const [approvSig, verifySig] = await signRegistrationTypeMessage(
        claim,
        feeAmount,
        revocable,
        addr0,
        owner,
        deadline,
        nonce,
        chainID,
        ecoNft.address
      )

      await payFee(addr0, feeAmount)
      await expect(
        ecoNft.register(
          claim,
          feeAmount,
          revocable,
          addr0.address,
          owner.address,
          deadline,
          approvSig,
          verifySig
        )
      )
        .to.emit(ecoNft, "RegisterClaim")
        .withArgs(claim, feeAmount, revocable, addr0.address, owner.address)

      // check nonce incremented
      const firstNonce = (await ecoNft.nonces(claim)).toNumber()
      expect(firstNonce).to.eq(nonce + 1)

      await payFee(addr0, feeAmount)
      await expect(
        ecoNft.register(
          claim,
          feeAmount,
          revocable,
          addr0.address,
          owner.address,
          deadline,
          approvSig,
          verifySig
        )
      ).to.be.revertedWith("InvalidRegistrationApproveSignature()")

      // check nonce is the same
      const secondNonce = (await ecoNft.nonces(claim)).toNumber()
      expect(secondNonce).to.eq(firstNonce)
    })

    it("should fail when the same verifier attempts to verify the same claim twice", async function () {
      const revocable = false
      const [approvSig1, verifySig1] = await signRegistrationTypeMessage(
        claim,
        feeAmount,
        revocable,
        addr0,
        owner,
        deadline,
        nonce,
        chainID,
        ecoNft.address
      )

      await payFee(addr0, feeAmount)
      await ecoNft.register(
        claim,
        feeAmount,
        revocable,
        addr0.address,
        owner.address,
        deadline,
        approvSig1,
        verifySig1
      )
      // check nonce incremented
      const firstNonce = (await ecoNft.nonces(claim)).toNumber()
      expect(firstNonce).to.eq(nonce + 1)

      const [approvSig2, verifySig2] = await signRegistrationTypeMessage(
        claim,
        feeAmount,
        revocable,
        addr0,
        owner,
        deadline,
        firstNonce,
        chainID,
        ecoNft.address
      )

      await expect(
        ecoNft.register(
          claim,
          feeAmount,
          revocable,
          addr0.address,
          owner.address,
          deadline,
          approvSig2,
          verifySig2
        )
      ).to.be.revertedWith(`DuplicateVerifier("${owner.address}")`)

      // check nonce is the same
      const secondNonce = (await ecoNft.nonces(claim)).toNumber()
      expect(secondNonce).to.eq(firstNonce)
    })

    it("should allow multiple verifiers to verify the same claim", async function () {
      const revocable = true
      const [, , addr1] = await ethers.getSigners()
      const [approvSig1, verifySig1] = await signRegistrationTypeMessage(
        claim,
        feeAmount,
        revocable,
        addr0,
        owner,
        deadline,
        nonce,
        chainID,
        ecoNft.address
      )

      await payFee(addr0, feeAmount * 2)
      await expect(
        ecoNft.register(
          claim,
          feeAmount,
          revocable,
          addr0.address,
          owner.address,
          deadline,
          approvSig1,
          verifySig1
        )
      )
        .to.emit(ecoNft, "RegisterClaim")
        .withArgs(claim, feeAmount, revocable, addr0.address, owner.address)

      // check nonce incremented
      const firstNonce = (await ecoNft.nonces(claim)).toNumber()
      expect(firstNonce).to.eq(nonce + 1)
      const [approvSig2, verifySig2] = await signRegistrationTypeMessage(
        claim,
        feeAmount,
        revocable,
        addr0,
        addr1,
        deadline,
        firstNonce,
        chainID,
        ecoNft.address
      )
      await expect(
        ecoNft.register(
          claim,
          feeAmount,
          revocable,
          addr0.address,
          addr1.address,
          deadline,
          approvSig2,
          verifySig2
        )
      )
        .to.emit(ecoNft, "RegisterClaim")
        .withArgs(claim, feeAmount, revocable, addr0.address, addr1.address)

      // check nonce incremented
      const secondNonce = (await ecoNft.nonces(claim)).toNumber()
      expect(secondNonce).to.eq(firstNonce + 1)
    })
  })

  describe("On unregistration", async function () {
    it("should revert if there is no verified claim", async function () {
      const sig = await signUnregistrationTypeMessage(
        claim,
        addr0,
        owner,
        deadline,
        nonce,
        chainID,
        ecoNft.address
      )
      await expect(
        ecoNft.unregister(claim, addr0.address, owner.address, deadline, sig)
      ).to.be.revertedWith("UnverifiedClaim()")
    })

    it("should fail on expired deadline", async function () {
      await registerClaim(
        claim,
        0,
        true,
        addr0,
        owner,
        deadline,
        nonce,
        chainID
      )
      // check nonce incremented
      const firstNonce = (await ecoNft.nonces(claim)).toNumber()
      expect(firstNonce).to.eq(nonce + 1)

      const expiredDeadline = parseInt(await latestBlockTimestamp(), 16) - 1000
      const sig = await signUnregistrationTypeMessage(
        claim,
        addr0,
        owner,
        expiredDeadline,
        firstNonce,
        chainID,
        ecoNft.address
      )

      await expect(
        ecoNft.unregister(
          claim,
          addr0.address,
          owner.address,
          expiredDeadline,
          sig
        )
      ).to.be.revertedWith("DeadlineExpired()")
    })

    it("should fail on trying to use the same signature for a second consecutive unregistration", async function () {
      await registerClaim(
        claim,
        0,
        true,
        addr0,
        owner,
        deadline,
        nonce,
        chainID
      )
      // check nonce incremented
      const firstNonce = (await ecoNft.nonces(claim)).toNumber()
      expect(firstNonce).to.eq(nonce + 1)
      const sig = await signUnregistrationTypeMessage(
        claim,
        addr0,
        owner,
        deadline,
        firstNonce,
        chainID,
        ecoNft.address
      )

      await expect(
        ecoNft.unregister(claim, addr0.address, owner.address, deadline, sig)
      )
        .to.emit(ecoNft, "UnregisterClaim")
        .withArgs(claim, addr0.address, owner.address)

      const secondNonce = (await ecoNft.nonces(claim)).toNumber()
      expect(secondNonce).to.eq(firstNonce + 1)

      await registerClaim(
        claim,
        0,
        true,
        addr0,
        owner,
        deadline,
        secondNonce,
        chainID
      )

      // should fail on using sig with nonce outdated
      await expect(
        ecoNft.unregister(claim, addr0.address, owner.address, deadline, sig)
      ).to.be.revertedWith("InvalidVerifierSignature()")
    })

    it("should revert if the claim is unrevocable", async function () {
      await registerClaim(
        claim,
        0,
        false,
        addr0,
        owner,
        deadline,
        nonce,
        chainID
      )
      // check nonce incremented
      const firstNonce = (await ecoNft.nonces(claim)).toNumber()
      expect(firstNonce).to.eq(nonce + 1)
      const sig = await signUnregistrationTypeMessage(
        claim,
        addr0,
        owner,
        deadline,
        firstNonce,
        chainID,
        ecoNft.address
      )
      await expect(
        ecoNft.unregister(claim, addr0.address, owner.address, deadline, sig)
      ).to.be.revertedWith("UnrevocableClaim()")
    })

    it("should revert if the verifier signature is invalid", async function () {
      await registerClaim(
        claim,
        0,
        true,
        addr0,
        owner,
        deadline,
        nonce,
        chainID
      )
      // check nonce incremented
      const firstNonce = (await ecoNft.nonces(claim)).toNumber()
      expect(firstNonce).to.eq(nonce + 1)
      const sig = await signUnregistrationTypeMessage(
        claim,
        addr0,
        addr0,
        deadline,
        firstNonce,
        chainID,
        ecoNft.address
      )
      await expect(
        ecoNft.unregister(claim, addr0.address, owner.address, deadline, sig)
      ).to.be.revertedWith("InvalidVerifierSignature()")
    })

    it("should succeed in removing a claim", async function () {
      await registerClaim(
        claim,
        0,
        true,
        addr0,
        owner,
        deadline,
        nonce,
        chainID
      )
      // check nonce incremented
      const firstNonce = (await ecoNft.nonces(claim)).toNumber()
      expect(firstNonce).to.eq(nonce + 1)
      const sig = await signUnregistrationTypeMessage(
        claim,
        addr0,
        owner,
        deadline,
        firstNonce,
        chainID,
        ecoNft.address
      )

      await expect(ecoNft.mintNFT(addr0.address, claim))
        .to.emit(ecoNft, "Mint")
        .withArgs(addr0.address, claim, 1)

      const [meta, dataAttr, verifierAttrs] = await getMeta(
        await ecoNft.tokenURI(1)
      )
      expect(meta.name).to.equal(
        "Eco Fragment [data:discord..., verifiers:0xf39fd...]"
      )
      expect(dataAttr.trait_type).to.equal("Data")
      expect(dataAttr.value).to.equal(claim)
      expect(verifierAttrs.length).to.equal(1)
      expect(verifierAttrs[0].trait_type).to.equal("Verifier")
      expect(verifierAttrs[0].value).to.equal(owner.address.toLocaleLowerCase())

      await expect(
        ecoNft.unregister(claim, addr0.address, owner.address, deadline, sig)
      )
        .to.emit(ecoNft, "UnregisterClaim")
        .withArgs(claim, addr0.address, owner.address)

      // check nft is now without verifier
      const [meta1, dataAttr1, verifierAttrs1] = await getMeta(
        await ecoNft.tokenURI(1)
      )

      expect(meta1.name).to.equal(
        "Eco Fragment [data:discord..., verifiers:null]"
      )
      expect(dataAttr1.trait_type).to.equal("Data")
      expect(dataAttr1.value).to.equal(claim)
      expect(verifierAttrs1.length).to.equal(0)
    })
  })

  describe("On NFT minting", async function () {
    beforeEach(async function () {
      await registerClaim(
        claim,
        0,
        false,
        addr0,
        owner,
        deadline,
        nonce,
        chainID
      )
    })

    it("should revert if there is no verified claim", async function () {
      // wrong claim
      await expect(
        ecoNft.mintNFT(addr0.address, claim + "1")
      ).to.be.revertedWith("UnverifiedClaim()")
      // wrong address
      await expect(ecoNft.mintNFT(owner.address, claim)).to.be.revertedWith(
        "UnverifiedClaim()"
      )
    })

    it("should succeed to mint an nft for a claim and emit", async function () {
      await expect(ecoNft.mintNFT(addr0.address, claim))
        .to.emit(ecoNft, "Mint")
        .withArgs(addr0.address, claim, 1)
    })

    it("should revert nft has already been minted for claim", async function () {
      const tokenID = 1
      await expect(ecoNft.mintNFT(addr0.address, claim))
        .to.emit(ecoNft, "Mint")
        .withArgs(addr0.address, claim, tokenID)

      await expect(ecoNft.mintNFT(addr0.address, claim)).to.be.revertedWith(
        `NftAlreadyMinted(${tokenID})`
      )
    })

    it("should allow minting of multiple nfts for different verified claims", async function () {
      await expect(ecoNft.mintNFT(addr0.address, claim))
        .to.emit(ecoNft, "Mint")
        .withArgs(addr0.address, claim, 1)

      // register new claim
      const claim2 = claim + "1"
      await registerClaim(
        claim2,
        0,
        false,
        addr0,
        owner,
        deadline,
        nonce,
        chainID
      )

      await expect(ecoNft.mintNFT(addr0.address, claim2))
        .to.emit(ecoNft, "Mint")
        .withArgs(addr0.address, claim2, 2)
    })
  })

  describe("On NFT metadata", async function () {
    let addr1: SignerWithAddress

    beforeEach(async function () {
      ;[, , addr1] = await ethers.getSigners()
      await payFee(addr0, feeAmount * 2)

      await registerClaim(
        claim,
        0,
        false,
        addr0,
        owner,
        deadline,
        nonce,
        chainID
      )

      // check nonce incremented
      const firstNonce = (await ecoNft.nonces(claim)).toNumber()
      expect(firstNonce).to.eq(nonce + 1)

      await registerClaim(
        claim,
        0,
        true,
        addr0,
        addr1,
        deadline,
        firstNonce,
        chainID
      )

      await expect(ecoNft.mintNFT(addr0.address, claim))
    })

    it("should revert on metadata for non-existant token", async function () {
      await expect(ecoNft.tokenURI(10)).to.be.revertedWith("NonExistantToken()")
    })

    it("should dispay the verifier of a claim", async function () {
      const [meta, dataAttr, verifierAttrs] = await getMeta(
        await ecoNft.tokenURI(1)
      )

      expect(meta.description).to.equal("EcoNFT")
      expect(meta.external_url).to.equal("https://eco.org/")
      expect(meta.image).to.equal(
        "https://ipfs.io/ipfs/QmZxvWzRT4Kq3FGEjvMeBaad7qvrSc79MqPggk5At5qxP6"
      )
      expect(meta.name).to.equal(
        "Eco Fragment [data:discord..., verifiers:0xf39fd...]"
      )
      expect(dataAttr.trait_type).to.equal("Data")
      expect(dataAttr.value).to.equal(claim)
      expect(verifierAttrs.length).to.equal(2)
      expect(verifierAttrs[0].trait_type).to.equal("Verifier")
      expect(verifierAttrs[0].value).to.equal(owner.address.toLocaleLowerCase())
      expect(verifierAttrs[1].trait_type).to.equal("Verifier")
      expect(verifierAttrs[1].value).to.equal(addr1.address.toLocaleLowerCase())
    })

    it("should paginate", async function () {
      const [, , verifierAttrs] = await getMeta(
        await ecoNft.tokenURICursor(1, 0, 1)
      )

      expect(verifierAttrs[0].value).to.equal(owner.address.toLocaleLowerCase())
      expect(verifierAttrs.length).to.equal(1)

      const [, , verifierAttrs1] = await getMeta(
        await ecoNft.tokenURICursor(1, 1, 1)
      )
      expect(verifierAttrs1[0].value).to.equal(
        addr1.address.toLocaleLowerCase()
      )
      expect(verifierAttrs1.length).to.equal(1)

      const [, , verifierAttrs2] = await getMeta(
        await ecoNft.tokenURICursor(1, 0, 10)
      )

      expect(verifierAttrs2[0].value).to.equal(
        owner.address.toLocaleLowerCase()
      )
      expect(verifierAttrs2[1].value).to.equal(
        addr1.address.toLocaleLowerCase()
      )
      expect(verifierAttrs2.length).to.equal(2)
    })
  })

  /**
   * Registers a claim
   *
   * @param claim the claim to register
   * @param feeAmount the fee to pay the verifier
   * @param revocable true if the claim can be revoked in the future by the verifier
   * @param recipient the recipient on which the claim is being made
   * @param verifier  the verifier of the claim
   */
  async function registerClaim(
    claim: string,
    feeAmount: number,
    revocable: boolean,
    recipient: SignerWithAddress,
    verifier: SignerWithAddress,
    deadline: number,
    nonce: number,
    chainID: number
  ) {
    const [approvSig, verifySig] = await signRegistrationTypeMessage(
      claim,
      feeAmount,
      revocable,
      recipient,
      verifier,
      deadline,
      nonce,
      chainID,
      ecoNft.address
    )

    await payFee(addr0, feeAmount)
    await expect(
      ecoNft.register(
        claim,
        feeAmount,
        revocable,
        recipient.address,
        verifier.address,
        deadline,
        approvSig,
        verifySig
      )
    )
      .to.emit(ecoNft, "RegisterClaim")
      .withArgs(
        claim,
        feeAmount,
        revocable,
        recipient.address,
        verifier.address
      )
  }

  /**
   * Decodes the metadata and returns it as objects
   *
   * @param metaEncoded the metadata to decode
   */
  async function getMeta(
    metaEncoded: string
  ): Promise<[Meta, NftAttribute, NftAttribute[]]> {
    const encodedMeta = metaEncoded.split(",")[1]
    const decodedMeta = Buffer.from(encodedMeta, "base64").toString("utf-8")
    const meta: Meta = JSON.parse(decodedMeta)

    // @ts-ignore
    const dataAttr: NftAttribute = meta.attributes[0]
    // @ts-ignore
    const verifierAttrs: NftAttribute[] = meta.attributes.slice(1)

    return [meta, dataAttr, verifierAttrs]
  }

  /**
   * Transfers tokens to the user and then approves the nft contract to
   * spend those tokens on their behalf
   *
   * @param user the user to transfer tokens to
   * @param fee the tokens to transfer
   */
  async function payFee(user: SignerWithAddress, fee: number) {
    await eco.transfer(user.address, fee)
    await eco.connect(user).approve(ecoNft.address, fee)
  }
})
