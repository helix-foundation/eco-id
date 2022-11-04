/* eslint node/no-unsupported-features/node-builtins: 0 */ // --> OFF
import fs from "fs"
import path from "path"

// This file is used by build system to build a clean npm package with the solidity files and their abi.

function main() {
  const rootDir = path.join(__dirname, "/../..")
  const libDir = path.join(rootDir, "/lib")
  console.log(`Creating lib directory at ${libDir}`)
  if (!fs.existsSync(libDir)) {
    fs.mkdirSync(libDir)
  }

  const source = fs.readFileSync(rootDir + "/package.json").toString("utf-8")
  const sourceObj = JSON.parse(source)

  delete sourceObj.scripts
  delete sourceObj.files
  delete sourceObj.devDependencies

  fs.copyFile(
    path.join(rootDir, "/LICENSE"),
    path.join(libDir, "/LICENSE"),
    function (err: any) {
      if (err) {
        return console.log(err)
      }
      console.log("The LICENSE sucessfuly copied!")
    }
  )

  fs.writeFile(
    path.join(libDir, "/package.json"),
    Buffer.from(JSON.stringify(sourceObj, null, 2), "utf-8"),
    function (err: any) {
      if (err) {
        return console.log(err)
      }
      console.log("The lib package.json file was saved!")
    }
  )

  const contractsDir = path.join(libDir, "/contracts")
  if (!fs.existsSync(contractsDir)) {
    fs.mkdirSync(contractsDir)
  }
  const interfacesDir = path.join(contractsDir, "/interfaces")
  if (!fs.existsSync(interfacesDir)) {
    fs.mkdirSync(interfacesDir)
  }
  const rootContracts = path.join(rootDir, "/contracts")
  const rootInterfaces = path.join(rootContracts, "/interfaces")
  fs.copyFile(
    path.join(rootContracts, "/EcoID.sol"),
    path.join(contractsDir, "/EcoID.sol"),
    function (err: any) {
      if (err) {
        return console.log(err)
      }
      console.log("The contract EcoID.sol sucessfuly copied!")
    }
  )

  fs.copyFile(
    path.join(rootContracts, "/Base64.sol"),
    path.join(contractsDir, "/Base64.sol"),
    function (err: any) {
      if (err) {
        return console.log(err)
      }
      console.log("The contract Base64.sol sucessfuly copied!")
    }
  )

  fs.copyFile(
    path.join(rootInterfaces, "/IECO.sol"),
    path.join(interfacesDir, "/IECO.sol"),
    function (err: any) {
      if (err) {
        return console.log(err)
      }
      console.log("The contract Base64.sol sucessfuly copied!")
    }
  )

  const rootAbiDir = path.join(rootDir, "/artifacts/contracts/EcoID.sol")
  if (!fs.existsSync(rootAbiDir)) {
    throw Error("Abi does not exist, run 'yarn build'")
  }
  const abiDir = path.join(libDir, "/abi")
  if (!fs.existsSync(abiDir)) {
    fs.mkdirSync(abiDir)
  }

  fs.copyFile(
    path.join(rootAbiDir, "/EcoID.json"),
    path.join(abiDir, "/EcoID.json"),
    function (err: any) {
      if (err) {
        return console.log(err)
      }
      console.log("The abi EcoID.json sucessfuly copied!")
    }
  )
}

main()
