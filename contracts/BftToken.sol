pragma solidity ^0.4.18;

import {DetailedERC20} from '../zeppelin/contracts/token/DetailedERC20.sol';
import {PausableToken} from '../zeppelin/contracts/token/PausableToken.sol';
import {CappedToken} from '../zeppelin/contracts/token/CappedToken.sol';
import {MintableToken} from '../zeppelin/contracts/token/MintableToken.sol';
import {BurnableToken} from '../zeppelin/contracts/token/BurnableToken.sol';
import {Crowdsale} from '../zeppelin/contracts/crowdsale/Crowdsale.sol';

contract BftToken is DetailedERC20, CappedToken, BurnableToken, PausableToken {

	Crowdsale public crowdsale;

	function BftToken(
		uint256 _tokenCap,
		uint8 _decimals,
		Crowdsale _crowdsale
	)
		DetailedERC20("BF Token", "BFT", _decimals)
		CappedToken(_tokenCap) public {

		crowdsale = _crowdsale;
	}

	// ----------------------------------------------------------------------------------------------------------------
	// the following is the functionality to upgrade this token smart contract to a new one

	MintableToken public newToken = MintableToken(0x0);
	event LogRedeem(address beneficiary, uint256 amount);

	modifier hasUpgrade() {
		require(newToken != MintableToken(0x0));
		_;
	}

	function upgrade(MintableToken _newToken) whenPaused onlyOwner public {
		newToken = _newToken;
	}

	// overriding BurnableToken#burn to make disable it for public use
	function burn(uint256 _value) public {
		revert();
		_value = _value; // to silence compiler warning
	}

	function redeem() whenPaused hasUpgrade public {

		var balance = balanceOf(msg.sender);
		require(balance>0);

		// burn the tokens in this token smart contract
		super.burn(balance);

		// mint tokens in the new token smart contract
		require(newToken.mint(msg.sender, balance));
		LogRedeem(msg.sender, balance);
	}

	// ----------------------------------------------------------------------------------------------------------------
	// we override the token transfer functions to block transfers before startTransfersDate timestamp

	modifier canDoTransfers() {
		require(now >= startTransfersTime());
		_;
	}

	function startTransfersTime() public view returns (uint256) {
		return crowdsale.endTime();
	}

	function transfer(address _to, uint256 _value) public canDoTransfers returns (bool) {
		return super.transfer(_to, _value);
	}

	function transferFrom(address _from, address _to, uint256 _value) public canDoTransfers returns (bool) {
		return super.transferFrom(_from, _to, _value);
	}

	function approve(address _spender, uint256 _value) public canDoTransfers returns (bool) {
		return super.approve(_spender, _value);
	}

	function increaseApproval(address _spender, uint _addedValue) public canDoTransfers returns (bool success) {
		return super.increaseApproval(_spender, _addedValue);
	}

	function decreaseApproval(address _spender, uint _subtractedValue) public canDoTransfers returns (bool success) {
		return super.decreaseApproval(_spender, _subtractedValue);
	}
}
