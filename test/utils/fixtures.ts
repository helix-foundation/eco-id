import { ethers, upgrades } from "hardhat"
import { EcoID, EcoTest } from "../../typechain-types"
/**
 * Deploys the {@link EcoID} through a proxy, as well as a support ERC20
 *
 * @return The ERC20 and the proxy of EcoID
 */
export async function deployEcoID(): Promise<[EcoTest, EcoID]> {
  const amount = 1000000000

  const EcoTest = await ethers.getContractFactory("EcoTest")
  const eco = await EcoTest.deploy("Eco", "Eco", amount)
  await eco.deployed()

  const EcoIDContract = await ethers.getContractFactory("EcoID")
  const ecoIDProxy = await upgrades.deployProxy(EcoIDContract, [eco.address], {
    initializer: "initialize",
  })
  await ecoIDProxy.deployed()

  // @ts-ignore
  return [eco, ecoIDProxy]
}
