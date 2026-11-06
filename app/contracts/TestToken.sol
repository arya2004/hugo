// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
// Local tests only. Never deployed by application scripts.
contract TestToken is ERC20 {
    bool public fail;
    address public target;
    bytes public payload;
    bool public callbackSucceeded;
    constructor() ERC20("Test USDC", "tUSDC") {}
    function decimals() public pure override returns (uint8) {
        return 6;
    }
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
    function setFailure(bool value) external {
        fail = value;
    }
    function setCallback(address t, bytes calldata p) external {
        target = t;
        payload = p;
    }
    function transfer(address to, uint256 amount) public override returns (bool) {
        require(!fail, "blocked transfer");
        if (target != address(0)) {
            (callbackSucceeded, ) = target.call(payload);
        }
        return super.transfer(to, amount);
    }
}
