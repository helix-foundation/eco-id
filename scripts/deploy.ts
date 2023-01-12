import { ethers, upgrades } from "hardhat"
// import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

async function main() {
  const EcoIDContract = await ethers.getContractFactory("EcoID")

  const feeData = await ethers.provider.getFeeData()
  const gasVal = ethers.utils.formatUnits(feeData.gasPrice!, "wei")
  const gasPrice = feeData.gasPrice?.mul(13).div(10)
  console.log(`Gas value: ${gasVal} and paying ${gasPrice}`)

  // const EcoContract = await ethers.getContractFactory("ERC20")

  // Deploy EcoID
  // const ecoIDContract = await EcoIDContract.deploy(
  //   process.env.ECO_ADDRESS as string,
  //   { gasPrice: gasPrice }
  // )
  console.log(`eco address ${process.env.ECO_ADDRESS}`)
  const ecoIDContract = await upgrades.deployProxy(
    EcoIDContract,
    [process.env.ECO_ADDRESS as string],
    { initializer: "initialize" }
  )

  await ecoIDContract.deployed()

  console.log("EcoID Contract deployed to:", ecoIDContract.address)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
