// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../interfaces/IECO.sol";

contract EcoTest is ERC20, IECO {
    uint256 public inflation;

    constructor(
        string memory name_,
        string memory symbol_,
        uint256 amount
    ) ERC20(name_, symbol_) {
        _mint(msg.sender, amount);
        inflation = 100;
    }

    function getPastLinearInflation(uint256 blockNumber)
        external
        view
        returns (uint256)
    {
        blockNumber += blockNumber; //turn off no-unused-vars
        return inflation;
    }

    function updateInflation(uint256 newInflation) public {
        inflation = newInflation;
    }
}
