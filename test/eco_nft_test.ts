import { expect } from "chai"
import { ethers } from "hardhat"
import { EcoNFT } from "../typechain"

import { signMessage } from "./utils/sign"

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"

/**
 * Tests that the EcoNFT contract performs correctly on minting of nft's
 * Note, check encryption https://dev.to/rounakbanik/tutorial-digital-signatures-nft-allowlists-eeb
 */
describe("EcoNFT tests", async function () {
  const socialID = "twitterX1234321"
  let owner: SignerWithAddress, addr0: SignerWithAddress
  let nft: EcoNFT

  describe("On invalid signatures", async function () {
    beforeEach(async function () {
      await deployEcoNFT()
    })

    it("should fail an invalid message", async function () {
      const sig = await signMessage(socialID + "1", owner)
      await expect(nft.mintEcoNFT(socialID, sig)).to.be.revertedWith(
        "signature did not match"
      )
    })

    it("should fail an invalid owner signature", async function () {
      const sig = await signMessage(socialID, addr0)
      await expect(nft.mintEcoNFT(socialID, sig)).to.be.revertedWith(
        "signature did not match"
      )
    })
  })

  // These test run serially and are order depenednt, so don't use .only or comment out their sequence
  describe("On successful EcoNFT minting", async function () {
    before(async function () {
      await deployEcoNFT()
    })

    it("should mint the nft token and emit a minting event", async function () {
      const sig = await signMessage(socialID, owner)

      await expect(nft.connect(addr0).mintEcoNFT(socialID, sig))
        .to.emit(nft, "MintEvent")
        .withArgs(await addr0.getAddress())
    })

    it("should associate the social id to the nft", async function () {
      expect(await nft._mintedAccounts(socialID)).to.equal(
        await addr0.getAddress()
      )
    })

    it("should add the social id to the array of ids associated with an account address", async function () {
      expect(await nft._socialAccounts(await addr0.getAddress(), 0)).to.equal(
        socialID
      )
    })

    it("should fail to mint a new nft token for the same social id", async function () {
      const sig = await signMessage(socialID, owner)

      await expect(
        nft.connect(addr0).mintEcoNFT(socialID, sig)
      ).to.be.revertedWith("social has minted token")
    })
  })

  /**
   * Deploys the contract and sets some variables
   */
  async function deployEcoNFT() {
    [owner, addr0] = await ethers.getSigners()
    const EcoNFT = await ethers.getContractFactory("EcoNFT")
    nft = await EcoNFT.deploy()
    await nft.deployed()
  }
})
