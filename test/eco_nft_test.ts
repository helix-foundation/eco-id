import { expect } from "chai";
import { ethers } from "hardhat";

describe("EcoNFT tests", function () {
  beforeEach(async function () {
    const EcoNFT = await ethers.getContractFactory("EcoNFT");
    const nft = await EcoNFT.deploy();
    await nft.deployed();
  });
  it("should deploy the contract", async function () {});
  it("should ", async function () {});
  it("should", async function () {});
  it("should", async function () {});
  it("should", async function () {});
  it("should", async function () {});
  it("should", async function () {});
  it("should", async function () {});
  it("should", async function () {});

  //   it("Should return the new greeting once it's changed", async function () {
  //     const Greeter = await ethers.getContractFactory("Greeter");
  //     const greeter = await Greeter.deploy("Hello, world!");
  //     await greeter.deployed();

  //     expect(await greeter.greet()).to.equal("Hello, world!");

  //     const setGreetingTx = await greeter.setGreeting("Hola, mundo!");

  //     // wait until the transaction is mined
  //     await setGreetingTx.wait();

  //     expect(await greeter.greet()).to.equal("Hola, mundo!");
  //   });
});
