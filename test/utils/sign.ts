import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { TypedDataDomain, TypedDataField } from "ethers"

// the type data that we use for signatures
type TypeData = {
  domain: TypedDataDomain
  types: Record<string, TypedDataField[]>
  value: Record<string, any>
}
/**
 * Creates the signature for the unregister EcoID call
 *
 * @param claim the claim being attested to
 * @param feeAmount the fee being paid from the recipient to the verifier
 * @param revocable whether the attestation can be revoked in the future
 * @param recipient the address of the recipient of the attestation
 * @param verifier the address doing the attestation
 * @param deadline the expiration of the signature
 * @param nonce the nonce of the signature
 * @param chainID the chain id of the contract
 * @param contractAddress the address of the contract
 * @returns
 */
export async function signRegistrationTypeMessage(
  claim: string,
  feeAmount: number,
  revocable: boolean,
  recipient: SignerWithAddress,
  verifier: SignerWithAddress,
  deadline: number,
  nonce: number,
  chainID: number,
  contractAddress: string
): Promise<[string, string]> {
  const typeDataApprove = registrationTypeMessage(
    claim,
    feeAmount,
    revocable,
    recipient,
    verifier,
    deadline,
    nonce,
    chainID,
    contractAddress,
    true
  )
  const typeDataVerifier = registrationTypeMessage(
    claim,
    feeAmount,
    revocable,
    recipient,
    verifier,
    deadline,
    nonce,
    chainID,
    contractAddress,
    false
  )

  return [
    await recipient._signTypedData(
      typeDataApprove.domain,
      typeDataApprove.types,
      typeDataApprove.value
    ),
    await verifier._signTypedData(
      typeDataVerifier.domain,
      typeDataVerifier.types,
      typeDataVerifier.value
    ),
  ]
}

/**
 * Creates the signature for the claimTokensOnBehalf contract call
 *
 * @param claim the claim on the recipient
 * @param recipient the address having an attestation removed
 * @param verifier the verifier removing its attestation
 * @param deadline the expiration of the signature
 * @param nonce the nonce of the signature
 * @param chainID the chain id of the contract
 * @param contractAddress the address of the contract
 * @returns the signature
 */
export async function signUnregistrationTypeMessage(
  claim: string,
  recipient: SignerWithAddress,
  verifier: SignerWithAddress,
  deadline: number,
  nonce: number,
  chainID: number,
  contractAddress: string
): Promise<string> {
  const typeDataApprove = unregistrationTypeMessage(
    claim,
    recipient,
    verifier,
    deadline,
    nonce,
    chainID,
    contractAddress
  )
  return await verifier._signTypedData(
    typeDataApprove.domain,
    typeDataApprove.types,
    typeDataApprove.value
  )
}

/**
 * Creates the typed message for signing for the register EcoID call
 *
 * @param claim the claim to unregister verifier from
 * @param feeAmount the fee paid for registration to the verifier
 * @param revocable whether the attestation can be revoked later by the verifier
 * @param recipient the recipient of the claim
 * @param verifier the verifier doing the attestation and receiving the fee
 * @param deadline the expiration of the signature
 * @param nonce the nonce of the signature
 * @param chainID the chain id of the contract
 * @param contractAddress the address of the contract
 * @param approvalSig the approving signature from the recipient granting the verifier permission to register
 * @returns typed message for signing
 */
function registrationTypeMessage(
  claim: string,
  feeAmount: number,
  revocable: boolean,
  recipient: SignerWithAddress,
  verifier: SignerWithAddress,
  deadline: number,
  nonce: number,
  chainID: number,
  contractAddress: string,
  approvalSig: boolean
): TypeData {
  const domain = {
    name: "EcoID",
    version: "1",
    chainId: chainID,
    verifyingContract: contractAddress,
  }
  return approvalSig
    ? {
        domain,
        types: {
          Register: [
            {
              name: "claim",
              type: "string",
            },
            {
              name: "feeAmount",
              type: "uint256",
            },
            {
              name: "revocable",
              type: "bool",
            },
            {
              name: "recipient",
              type: "address",
            },
            {
              name: "verifier",
              type: "address",
            },
            {
              name: "deadline",
              type: "uint256",
            },
            {
              name: "nonce",
              type: "uint256",
            },
          ],
        },
        value: {
          claim,
          feeAmount,
          revocable,
          recipient: recipient.address,
          verifier: verifier.address,
          deadline,
          nonce,
        },
      }
    : {
        domain,
        types: {
          Register: [
            {
              name: "claim",
              type: "string",
            },
            {
              name: "feeAmount",
              type: "uint256",
            },
            {
              name: "revocable",
              type: "bool",
            },
            {
              name: "recipient",
              type: "address",
            },
            {
              name: "deadline",
              type: "uint256",
            },
            {
              name: "nonce",
              type: "uint256",
            },
          ],
        },
        value: {
          claim,
          feeAmount,
          revocable,
          recipient: recipient.address,
          deadline,
          nonce,
        },
      }
}

/**
 * Creates the typed message for signing for the unregister EcoID call
 *
 * @param claim the claim to unregister verifier from
 * @param recipient the recipient of the claim
 * @param verifier the verifier being unregistered
 * @param deadline the expiration of the signature
 * @param nonce the nonce of the signature
 * @param chainID the chain id of the contract
 * @param contractAddress the address of the contract
 * @returns typed message for signing
 */
function unregistrationTypeMessage(
  claim: string,
  recipient: SignerWithAddress,
  verifier: SignerWithAddress,
  deadline: number,
  nonce: number,
  chainID: number,
  contractAddress: string
): TypeData {
  const domain = {
    name: "EcoID",
    version: "1",
    chainId: chainID,
    verifyingContract: contractAddress,
  }

  return {
    domain,
    types: {
      Unregister: [
        {
          name: "claim",
          type: "string",
        },
        {
          name: "recipient",
          type: "address",
        },
        {
          name: "verifier",
          type: "address",
        },
        {
          name: "deadline",
          type: "uint256",
        },
        {
          name: "nonce",
          type: "uint256",
        },
      ],
    },
    value: {
      claim,
      recipient: recipient.address,
      verifier: verifier.address,
      deadline,
      nonce,
    },
  }
}
