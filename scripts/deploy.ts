import { ethers } from "hardhat"

async function main() {
  const EcoIDContract = await ethers.getContractFactory("EcoID")

  const feeData = await ethers.provider.getFeeData();
  const gasVal = ethers.utils.formatUnits(feeData.gasPrice!, 'wei');
  const gasPrice = feeData.gasPrice?.mul(13).div(10)
  console.log(`Gas value: ${gasVal} and paying ${gasPrice}`)

  // Deploy EcoID
  const ecoIDContract = await EcoIDContract.deploy(
    process.env.ECO_ADDRESS as string,
    {gasPrice: gasPrice}
  )

  await ecoIDContract.deployed()

  console.log("EcoID Contract deployed to:", ecoIDContract.address)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
