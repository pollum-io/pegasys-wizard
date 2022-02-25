// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/draft-ERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20FlashMint.sol";

contract Eed is ERC20, Ownable, ERC20Permit, ERC20FlashMint {
    constructor() ERC20("33eed", "MTK") ERC20Permit("33eed") {}

    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }
}
