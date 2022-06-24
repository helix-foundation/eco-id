import { expect } from "chai";
import { ethers } from "hardhat";
import { EcoNFT } from "../typechain";


import { Bytes, concat } from "@ethersproject/bytes";
import { keccak256 } from "@ethersproject/keccak256";
import { toUtf8Bytes } from "@ethersproject/strings";

export const messagePrefix = "\x19Ethereum Signed Message:\n";

describe("EcoNFT tests", async function () {
  const socialID = "twitterX1234321"
  let nft: EcoNFT

  before(async function () {
    const EcoNFT = await ethers.getContractFactory("EcoNFT")
    nft = await EcoNFT.deploy()
    await nft.deployed()
  })

  it("should fail when social id is already minted", async function () {

  })

  // https://dev.to/rounakbanik/tutorial-digital-signatures-nft-allowlists-eeb
  it.only("should fail an invalid owner signature", async function () {
    let messageHash = ethers.utils.id(socialID)
    let messageBytes = ethers.utils.arrayify(messageHash)

    const [owner, addr0] = await ethers.getSigners()
    const sig = await addr0.signMessage(messageBytes)

    await expect(
      nft.mintEcoNFT(
        socialID,
        sig
      )
    ).to.be.revertedWith("signature did not match");
  })

  describe("On successful EcoNFT minting", async function () {
    before(async function () {
      const EcoNFT = await ethers.getContractFactory("EcoNFT")
      nft = await EcoNFT.deploy()
      await nft.deployed()
    })
    it("should mint the nft token", async function () { })

    it("should should associate the social id to the nft", async function () { })

    it("should should add the social id to the array of ids associated with an account address", async function () { })

    it("should should emit a minting event", async function () { })

    it("should should fail to mint a new nft token for the same social id", async function () { })

  })
});
