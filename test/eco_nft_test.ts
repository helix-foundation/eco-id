import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { expect } from "chai"
import { ethers } from "hardhat"
import { EcoNFT, ERC20Test } from "../typechain"
import { deployEcoNFT } from "./utils/fixtures"
import { signRegistrationMessage } from "./utils/sign"

/**
 * Tests that the EcoNFT contract performs correctly on minting of nft's
 * Note, check encryption https://dev.to/rounakbanik/tutorial-digital-signatures-nft-allowlists-eeb
 */
describe.only("EcoNFT tests", async function () {
  const claim = "twitterX1234321"
  let owner: SignerWithAddress, addr0: SignerWithAddress
  let erc20: ERC20Test
  let ecoNft: EcoNFT
  const feeAmount = 1000

  beforeEach(async function () {
    ;[owner, addr0] = await ethers.getSigners()
    ;[erc20, ecoNft] = await deployEcoNFT()
  })
  describe("On nft transfer", async function () {
    it("should not allow the transfer of nft's", async function () {
      const [approvSig, verifySig] = await signRegistrationMessage(claim, feeAmount, addr0, owner)

      await payFee(addr0, feeAmount)

      await ecoNft.register(claim, feeAmount, addr0.address, owner.address, approvSig, verifySig)

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
      const [approvSig, verifySig] = await signRegistrationMessage(claim, feeAmount, addr0, owner)

      await expect(
        ecoNft.register("", feeAmount, addr0.address, owner.address, approvSig, verifySig)
      ).to.be.revertedWith("invalid empty claim")
    })

    it("should fail an invalid approval signature", async function () {
      const [approvSig, verifySig] = await signRegistrationMessage(
        claim,
        feeAmount,
        addr0,
        owner
      )
      await expect(
        ecoNft.register(claim, feeAmount, addr0.address, owner.address, verifySig, verifySig)
      ).to.be.revertedWith("verifier not approved")
    })

    it("should fail an invalid verify signature", async function () {
      const approvSig = (await signRegistrationMessage(
        claim,
        feeAmount,
        addr0,
        owner
      ))[0]

      const verifySig = (await signRegistrationMessage(
        claim + "1",
        feeAmount,
        addr0,
        owner
      ))[1]
      
      await expect(
        ecoNft.register(claim, feeAmount, addr0.address, owner.address, approvSig, verifySig)
      ).to.be.revertedWith("signature did not match")
    })

    it("should fail on payment transfer failure", async function () {
      const [approvSig, verifySig] = await signRegistrationMessage(claim, feeAmount, addr0, owner)
      await expect(
        ecoNft.register(claim, feeAmount, addr0.address, owner.address, approvSig, verifySig)
      ).to.be.revertedWith("ERC20: insufficient allowance")
    })

    it("should register and emit on valid registration", async function () {
      const [approvSig, verifySig] = await signRegistrationMessage(claim, feeAmount, addr0, owner)

      await payFee(addr0, feeAmount)
      await expect(
        ecoNft.register(claim, feeAmount, addr0.address, owner.address, approvSig, verifySig)
      )
        .to.emit(ecoNft, "RegisterClaim")
        .withArgs(claim, feeAmount, addr0.address, owner.address)
    })

    it("should fail on duplicate verifier on a claim", async function () {
      const [approvSig, verifySig] = await signRegistrationMessage(claim, feeAmount, addr0, owner)

      await payFee(addr0, feeAmount)
      await ecoNft.register(claim, feeAmount, addr0.address, owner.address, approvSig, verifySig)

      await expect(
        ecoNft.register(claim, feeAmount, addr0.address, owner.address, approvSig, verifySig)
      ).to.be.revertedWith("duplicate varifier")
    })
  })
  describe("On NFT minting", async function () {
    beforeEach(async function () {
      const [approvSig, verifySig] = await signRegistrationMessage(claim, feeAmount, addr0, owner)

      await payFee(addr0, feeAmount)
      await ecoNft.register(claim, feeAmount, addr0.address, owner.address, approvSig, verifySig)
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
      const [approvSig, verifySig] = await signRegistrationMessage(claim2, feeAmount, addr0, owner)

      await payFee(addr0, feeAmount)
      await expect(
        ecoNft.register(claim2, feeAmount, addr0.address, owner.address, approvSig, verifySig)
      )
        .to.emit(ecoNft, "RegisterClaim")
        .withArgs(claim2, feeAmount, addr0.address, owner.address)

      await expect(ecoNft.mintNFT(addr0.address, claim2))
        .to.emit(ecoNft, "Mint")
        .withArgs(addr0.address, claim2, 2)
    })
  })

  describe("On NFT metadata", async function () {
    // test the metadata ur that we get and that it increases with more verifiers
    it("should revert on metadata for non-existant token", async function () {
      await expect(ecoNft.tokenURI(1)).to.be.revertedWith("non-existent token")
    })

    it.skip("should dispay the verifier of a claim", async function () {
      const [approvSig, verifySig] = await signRegistrationMessage(claim, feeAmount, addr0, owner)

      await payFee(addr0, feeAmount)
      await ecoNft.register(claim, feeAmount, addr0.address, owner.address, approvSig, verifySig)
      await expect(ecoNft.mintNFT(addr0.address, claim))
      // const meta = await ecoNft.face(1)
      const meta = await ecoNft.tokenURI(1)
      console.log(meta)
    })
  })

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
