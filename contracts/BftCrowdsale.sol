pragma solidity ^0.4.18;

import {CappedCrowdsale, Crowdsale} from '../zeppelin/contracts/crowdsale/CappedCrowdsale.sol';
import {MintableToken} from '../zeppelin/contracts/token/MintableToken.sol';
import {TokenTimelock} from '../zeppelin/contracts/token/TokenTimelock.sol';
import {Ownable} from '../zeppelin/contracts/ownership/Ownable.sol';
import {Pausable} from '../zeppelin/contracts/lifecycle/Pausable.sol';
import {BftToken}  from './BftToken.sol';


contract BftCrowdsale is CappedCrowdsale, Pausable {

	uint256 public constant tokenCap = 1000000000 ether; // ether is a multiplier here 10 ** 18
	uint8 public constant tokenDecimals = 18;

	uint256 public constant SALE_CAP_USD = 3000000;
	uint256 public constant BUYER_CAP_USD = 1000;
	uint256 public constant PRICE_MULTIPLIER = 100;
	uint256 public constant TOKENS_PER_USD = 10;

	uint256 public etherPrice = PRICE_MULTIPLIER;
	uint256 public buyerCapEther = 1 ether;
	uint256 public saleCapEther = 1 ether;
	uint256 public mintRate = TOKENS_PER_USD;

	address public preSaleBfPlatform;
	address public company;
	address public rewardPool;
	address public shareholders;
	address public tokenSaleCosts;

	// smart contracts that will lock tokens for a pre-defined time
	TokenTimelock public companyHolding2y;
	TokenTimelock public shareholdersHolding1y;

	// address permissioned to whitelist public sale addresses
	address public operator;
	mapping(address => bool) whitelist;
	event LogAddWhitelist(address beneficiary, address operator);
	event LogRemWhitelist(address beneficiary, address operator);
	event LogOperatorChange(address newOperator);

	mapping(address => bool) bought;

	modifier onlyOperator() {
		require(msg.sender == operator);
		_;
	}

	modifier onlyWhitelisted(address _address) {
		require(whitelist[_address]);
		_;
	}

	modifier didNotBuy(address beneficiary) {
		require(bought[beneficiary] == false);
		_;
	}

	function BftCrowdsale(
		uint256 _startTime,
		uint256 _endTime,
		uint256 _etherPrice,
		address _wallet,

		// addresses with pre-minted tokens
		address _preSaleBfPlatform,
		address _company,
		address _rewardPool,
		address _shareholders,
		address _tokenSaleCosts,

		// owner of the whitelist function
		address _operator
	)
		CappedCrowdsale(saleCapEther)
		Crowdsale(_startTime, _endTime, mintRate, _wallet) public {

		require(_preSaleBfPlatform != address(0x0));
		require(_company != address(0x0));
		require(_rewardPool != address(0x0));
		require(_shareholders != address(0x0));
		require(_tokenSaleCosts != address(0x0));
		require(_operator != address(0x0));

		preSaleBfPlatform = _preSaleBfPlatform;
		company = _company;
		rewardPool = _rewardPool;
		shareholders = _shareholders;
		tokenSaleCosts = _tokenSaleCosts;
		operator = _operator;

		updateEtherPrice(_etherPrice);
		createHoldings();
		preMintTokens();
	}

	function updateEtherPrice(uint256 _price) onlyOwner public {
		require(_price > 0);
		require(now < startTime);

		etherPrice = _price;
		buyerCapEther = BUYER_CAP_USD.mul(1 ether).mul(PRICE_MULTIPLIER).div(etherPrice);
		saleCapEther = SALE_CAP_USD.mul(1 ether).mul(PRICE_MULTIPLIER).div(etherPrice);
		mintRate = TOKENS_PER_USD.mul(etherPrice).div(PRICE_MULTIPLIER);

		// update vars on parent contracts
		cap = saleCapEther;
		rate = mintRate;
	}

	function createHoldings() internal {
		companyHolding2y = new TokenTimelock(token, company, startTime+2 years);
		shareholdersHolding1y = new TokenTimelock(token, shareholders, startTime+1 years);
	}

	function preMintTokens() internal {
		token.mint(preSaleBfPlatform, 300000000 ether);
		token.mint(companyHolding2y, 300000000 ether);
		token.mint(rewardPool, 200000000 ether);
		token.mint(shareholdersHolding1y, 100000000 ether);
		token.mint(tokenSaleCosts, 70000000 ether);
	}

	// overriding CappedCrowdsale#validPurchase to add extra buyerCapEther logic
	// @return true if investors can buy at the moment
	function validPurchase() whenNotPaused
	internal view returns (bool) {
		bool withinBuyerCap = msg.value <= buyerCapEther;
		return super.validPurchase() && withinBuyerCap;
	}

	// overriding Crowdsale#buyTokens to check and mark the address in 'bought' array
	function buyTokens(address beneficiary)
	didNotBuy(beneficiary)
	onlyWhitelisted(msg.sender)
	onlyWhitelisted(beneficiary)
	whenNotPaused
	public payable {
		super.buyTokens(beneficiary);
		bought[beneficiary] = true;
	}

	// creates the token to be sold.
	// override this method to have crowdsale of a specific mintable token.
	function createTokenContract() internal returns (MintableToken) {
		return new BftToken(tokenCap, tokenDecimals, this);
	}

	function addWhitelist(address beneficiary) onlyOperator whenNotPaused public {
		whitelist[beneficiary] = true;
		LogAddWhitelist(beneficiary, msg.sender);
	}

	function remWhitelist(address beneficiary) onlyOperator whenNotPaused public {
		whitelist[beneficiary] = false;
		LogRemWhitelist(beneficiary, msg.sender);
	}

	function isWhitelisted(address beneficiary) view public returns(bool) {
		return whitelist[beneficiary];
	}

	function hasAlreadyBought(address beneficiary) view public returns(bool) {
		return bought[beneficiary];
	}

	function changeOperator(address _operator) onlyOwner whenNotPaused public {
		operator = _operator;
		LogOperatorChange(operator);
	}

	// this should only be done at the end of the sale, but works as emergency also
	function transferTokenOwnership(address _newOwner) onlyOwner public {
		token.transferOwnership(_newOwner);
	}
}

