import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { expect } from "chai"
import { ethers } from "hardhat"
import { EcoNFT, ERC20Test } from "../typechain"
import { deployEcoNFT, Meta } from "./utils/fixtures"
import { signRegistrationMessage } from "./utils/sign"

/**
 * Tests that the EcoNFT contract performs correctly on minting of nft's
 * Note, check encryption https://dev.to/rounakbanik/tutorial-digital-signatures-nft-allowlists-eeb
 */
describe("EcoNFT tests", async function () {
  const claim = "ecoID:twitter:21306324"
  let owner: SignerWithAddress, addr0: SignerWithAddress
  let erc20: ERC20Test
  let ecoNft: EcoNFT
  const feeAmount = 1000

  type NftAttribute = { trait_type: string; value: string }

  beforeEach(async function () {
    ;[owner, addr0] = await ethers.getSigners()
    ;[erc20, ecoNft] = await deployEcoNFT()
  })
  describe("On nft transfer", async function () {
    it("should not allow the transfer of nft's", async function () {
      const [approvSig, verifySig] = await signRegistrationMessage(
        claim,
        feeAmount,
        addr0,
        owner
      )

      await payFee(addr0, feeAmount)

      await ecoNft.register(
        claim,
        feeAmount,
        addr0.address,
        owner.address,
        approvSig,
        verifySig
      )

      const tokenID = 1
      await expect(ecoNft.mintNFT(addr0.address, claim))
        .to.emit(ecoNft, "Mint")
        .withArgs(addr0.address, claim, tokenID)

      await expect(
        ecoNft.transferFrom(addr0.address, owner.address, tokenID)
      ).to.be.revertedWith("ERC721: transfer caller is not owner nor approved")
    })
  })

  describe("On registration", async function () {
    it("should fail registration on empty claim", async function () {
      const [approvSig, verifySig] = await signRegistrationMessage(
        claim,
        feeAmount,
        addr0,
        owner
      )

      await expect(
        ecoNft.register(
          "",
          feeAmount,
          addr0.address,
          owner.address,
          approvSig,
          verifySig
        )
      ).to.be.revertedWith("invalid empty claim")
    })

    it("should fail an invalid approval signature", async function () {
      const [, verifySig] = await signRegistrationMessage(
        claim,
        feeAmount,
        addr0,
        owner
      )
      await expect(
        ecoNft.register(
          claim,
          feeAmount,
          addr0.address,
          owner.address,
          verifySig,
          verifySig
        )
      ).to.be.revertedWith("invalid recipient signature")
    })

    it("should fail an invalid verify signature", async function () {
      const [approvSig] = await signRegistrationMessage(
        claim,
        feeAmount,
        addr0,
        owner
      )

      const [, verifySig] = await signRegistrationMessage(
        claim + "1",
        feeAmount,
        addr0,
        owner
      )

      await expect(
        ecoNft.register(
          claim,
          feeAmount,
          addr0.address,
          owner.address,
          approvSig,
          verifySig
        )
      ).to.be.revertedWith("invalid verifier signature")
    })

    it("should fail on a fee amount difference", async function () {
      const [approvSig] = await signRegistrationMessage(
        claim,
        feeAmount,
        addr0,
        owner
      )

      const [, verifySig] = await signRegistrationMessage(
        claim,
        feeAmount + 10,
        addr0,
        owner
      )

      await expect(
        ecoNft.register(
          claim,
          feeAmount,
          addr0.address,
          owner.address,
          approvSig,
          verifySig
        )
      ).to.be.revertedWith("invalid verifier signature")
    })

    it("should fail on payment transfer failure", async function () {
      const [approvSig, verifySig] = await signRegistrationMessage(
        claim,
        feeAmount,
        addr0,
        owner
      )
      await expect(
        ecoNft.register(
          claim,
          feeAmount,
          addr0.address,
          owner.address,
          approvSig,
          verifySig
        )
      ).to.be.revertedWith("ERC20: insufficient allowance")
    })

    it("should register and emit on valid registration", async function () {
      const [approvSig, verifySig] = await signRegistrationMessage(
        claim,
        feeAmount,
        addr0,
        owner
      )

      await payFee(addr0, feeAmount)
      await expect(
        ecoNft.register(
          claim,
          feeAmount,
          addr0.address,
          owner.address,
          approvSig,
          verifySig
        )
      )
        .to.emit(ecoNft, "RegisterClaim")
        .withArgs(claim, feeAmount, addr0.address, owner.address)
    })

    it("should fail when the same verifier attempts to verify the same claim twice", async function () {
      const [approvSig, verifySig] = await signRegistrationMessage(
        claim,
        feeAmount,
        addr0,
        owner
      )

      await payFee(addr0, feeAmount)
      await ecoNft.register(
        claim,
        feeAmount,
        addr0.address,
        owner.address,
        approvSig,
        verifySig
      )

      await expect(
        ecoNft.register(
          claim,
          feeAmount,
          addr0.address,
          owner.address,
          approvSig,
          verifySig
        )
      ).to.be.revertedWith("duplicate varifier")
    })

    it("should allow multiple verifiers to verify the same claim", async function () {
      const [, , addr1] = await ethers.getSigners()
      const [approvSig1, verifySig1] = await signRegistrationMessage(
        claim,
        feeAmount,
        addr0,
        owner
      )
      const [approvSig2, verifySig2] = await signRegistrationMessage(
        claim,
        feeAmount,
        addr0,
        addr1
      )
      await payFee(addr0, feeAmount * 2)
      await expect(
        ecoNft.register(
          claim,
          feeAmount,
          addr0.address,
          owner.address,
          approvSig1,
          verifySig1
        )
      )
        .to.emit(ecoNft, "RegisterClaim")
        .withArgs(claim, feeAmount, addr0.address, owner.address)

      await expect(
        ecoNft.register(
          claim,
          feeAmount,
          addr0.address,
          addr1.address,
          approvSig2,
          verifySig2
        )
      )
        .to.emit(ecoNft, "RegisterClaim")
        .withArgs(claim, feeAmount, addr0.address, addr1.address)
    })
  })
  describe("On NFT minting", async function () {
    beforeEach(async function () {
      const [approvSig, verifySig] = await signRegistrationMessage(
        claim,
        feeAmount,
        addr0,
        owner
      )

      await payFee(addr0, feeAmount)
      await ecoNft.register(
        claim,
        feeAmount,
        addr0.address,
        owner.address,
        approvSig,
        verifySig
      )
    })

    it("should revert if there is no verified claim", async function () {
      // wrong claim
      await expect(
        ecoNft.mintNFT(addr0.address, claim + "1")
      ).to.be.revertedWith("nft claim non-existant")
      // wrong address
      await expect(ecoNft.mintNFT(owner.address, claim)).to.be.revertedWith(
        "nft claim non-existant"
      )
    })

    it("should succeed to mint an nft for a claim and emit", async function () {
      await expect(ecoNft.mintNFT(addr0.address, claim))
        .to.emit(ecoNft, "Mint")
        .withArgs(addr0.address, claim, 1)
    })

    it("should revert nft has already been minted for claim", async function () {
      await expect(ecoNft.mintNFT(addr0.address, claim))
        .to.emit(ecoNft, "Mint")
        .withArgs(addr0.address, claim, 1)

      await expect(ecoNft.mintNFT(addr0.address, claim)).to.be.revertedWith(
        "token already minted for claim"
      )
    })

    it("should allow minting of multiple nfts for different verified claims", async function () {
      await expect(ecoNft.mintNFT(addr0.address, claim))
        .to.emit(ecoNft, "Mint")
        .withArgs(addr0.address, claim, 1)

      // register new claim
      const claim2 = claim + "1"
      const [approvSig, verifySig] = await signRegistrationMessage(
        claim2,
        feeAmount,
        addr0,
        owner
      )

      await payFee(addr0, feeAmount)
      await expect(
        ecoNft.register(
          claim2,
          feeAmount,
          addr0.address,
          owner.address,
          approvSig,
          verifySig
        )
      )
        .to.emit(ecoNft, "RegisterClaim")
        .withArgs(claim2, feeAmount, addr0.address, owner.address)

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

      const [approvSig0, verifySig0] = await signRegistrationMessage(
        claim,
        feeAmount,
        addr0,
        owner
      )
      const [approvSig1, verifySig1] = await signRegistrationMessage(
        claim,
        feeAmount,
        addr0,
        addr1
      )
      await ecoNft.register(
        claim,
        feeAmount,
        addr0.address,
        owner.address,
        approvSig0,
        verifySig0
      )
      await ecoNft.register(
        claim,
        feeAmount,
        addr0.address,
        addr1.address,
        approvSig1,
        verifySig1
      )
      await expect(ecoNft.mintNFT(addr0.address, claim))
    })

    it("should revert on metadata for non-existant token", async function () {
      await expect(ecoNft.tokenURI(10)).to.be.revertedWith("non-existent token")
    })

    it("should dispay the verifier of a claim", async function () {
      const [meta, dataAttr, verifierAttr, verifierAttrArray] = await getMeta(
        await ecoNft.tokenURI(1)
      )

      expect(meta.description).to.equal("EcoNFT")
      expect(meta.external_url).to.equal("https://eco.com/")
      expect(meta.image).to.equal(
        "https://media4.giphy.com/media/iF0sIlvGhJ5G5WCWIx/giphy.gif?cid=ecf05e47v3jsp4s8gj3u8li6kmfx2d6f98si1fn3o8hjg0d7&rid=giphy.gif&ct=g"
      )
      expect(meta.name).to.equal(
        "Eco Identity [data:ecoID:twitt..., verifier:0xf39f...]"
      )
      expect(dataAttr.trait_type).to.equal("Data")
      expect(dataAttr.value).to.equal(claim)
      expect(verifierAttr.trait_type).to.equal("Verifiers")
      expect(verifierAttrArray.length).to.equal(2)
      expect(verifierAttrArray[0]).to.equal(owner.address.toLocaleLowerCase())
      expect(verifierAttrArray[1]).to.equal(addr1.address.toLocaleLowerCase())
    })

    it("should paginate", async function () {
      const [, , , verifierAttrArray] = await getMeta(
        await ecoNft.tokenURICursor(1, 0, 1)
      )
      expect(verifierAttrArray[0]).to.equal(owner.address.toLocaleLowerCase())
      expect(verifierAttrArray.length).to.equal(1)

      const [, , , verifierAttrArray1] = await getMeta(
        await ecoNft.tokenURICursor(1, 1, 1)
      )
      expect(verifierAttrArray1[0]).to.equal(addr1.address.toLocaleLowerCase())
      expect(verifierAttrArray1.length).to.equal(1)

      const [, , , verifierAttrArray2] = await getMeta(
        await ecoNft.tokenURICursor(1, 0, 10)
      )
      expect(verifierAttrArray2[0]).to.equal(owner.address.toLocaleLowerCase())
      expect(verifierAttrArray2[1]).to.equal(addr1.address.toLocaleLowerCase())
      expect(verifierAttrArray2.length).to.equal(2)
    })
  })

  /**
   * Decodes the metadata and returns it as objects
   *
   * @param metaEncoded the metadata to decode
   */
  async function getMeta(
    metaEncoded: string
  ): Promise<[Meta, NftAttribute, NftAttribute, string[]]> {
    const meta: Meta = JSON.parse(atob(metaEncoded.split(",")[1]))
    // @ts-ignore
    const dataAttr: NftAttribute = meta.attributes[0]
    // @ts-ignore
    const verifierAttr: NftAttribute = meta.attributes[1]
    const verifierAttrArray = verifierAttr.value
      .split(",")
      .map((id) => id.replace(" ", ""))

    return [meta, dataAttr, verifierAttr, verifierAttrArray]
  }

  /**
   * Transfers tokens to the user and then approves the nft contract to
   * spend those tokens on their behalf
   *
   * @param user the user to transfer tokens to
   * @param fee the tokens to transfer
   */
  async function payFee(user: SignerWithAddress, fee: number) {
    await erc20.transfer(user.address, fee)
    await erc20.connect(user).approve(ecoNft.address, fee)
  }
})
