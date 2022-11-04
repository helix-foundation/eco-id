import { ethers } from "hardhat"
import { EcoID, EcoTest } from "../../typechain-types"

/**
 * Deploys the {@link EcoID} and support {@link ERC20}
 *
 * @return All the contracts
 */
export async function deployEcoID(): Promise<[EcoTest, EcoID]> {
  const amount = 1000000000

  const EcoTest = await ethers.getContractFactory("EcoTest")
  const eco = await EcoTest.deploy("Eco", "Eco", amount)
  await eco.deployed()

  const EcoID = await ethers.getContractFactory("EcoID")
  const ecoID = await EcoID.deploy(eco.address)
  await ecoID.deployed()
  // @ts-ignore
  return [eco, ecoID]
}
