pragma solidity ^0.4.18;

import {CappedCrowdsale, Crowdsale} from '../zeppelin/contracts/crowdsale/CappedCrowdsale.sol';
import {MintableToken} from '../zeppelin/contracts/token/MintableToken.sol';
import {TokenTimelock} from '../zeppelin/contracts/token/TokenTimelock.sol';
import {Ownable} from '../zeppelin/contracts/ownership/Ownable.sol';
import {Pausable} from '../zeppelin/contracts/lifecycle/Pausable.sol';
import {BftToken}  from './BftToken.sol';


contract BftCrowdsale is CappedCrowdsale, Pausable {

	uint8 public constant tokenDecimals = 18;
	uint256 public constant etherInWei = 10**uint256(tokenDecimals);
	uint256 public constant tokenCap = 1000000000 * etherInWei;

	uint256 public SALE_CAP_USD;
	uint256 public BUYER_CAP_LOW_USD;
	uint256 public BUYER_CAP_HIGH_USD;

	uint256 public constant PRICE_MULTIPLIER = 100;
	uint256 public constant TOKENS_PER_USD = 10;

	uint256 public etherPrice = PRICE_MULTIPLIER;
	uint256 public buyerCapLowEther = etherInWei;
	uint256 public buyerCapHighEther = etherInWei;
	uint256 public saleHardCapEther = etherInWei;
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
	mapping(address => bool) whitelist;

	mapping(address => bool) operators;
	event LogOperatorAdd(address newOperator);
	event LogOperatorRem(address newOperator);

	modifier onlyOperator() {
		require(operators[msg.sender]);
		_;
	}

	modifier onlyWhitelisted(address _address) {
		require(whitelist[_address]);
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
		address _operator,
		address _admin,

		uint256 _saleCapUsd,
		uint256 _buyerCapLowUsd,
		uint256 _buyerCapHighUsd
	)
		CappedCrowdsale(saleHardCapEther)
		Crowdsale(_startTime, _endTime, mintRate, _wallet) public {

		require(_preSaleBfPlatform != address(0x0));
		require(_company != address(0x0));
		require(_rewardPool != address(0x0));
		require(_shareholders != address(0x0));
		require(_tokenSaleCosts != address(0x0));
		require(_operator != address(0x0));

		SALE_CAP_USD = _saleCapUsd;
		BUYER_CAP_LOW_USD = _buyerCapLowUsd;
		BUYER_CAP_HIGH_USD = _buyerCapHighUsd;

		preSaleBfPlatform = _preSaleBfPlatform;
		company = _company;
		rewardPool = _rewardPool;
		shareholders = _shareholders;
		tokenSaleCosts = _tokenSaleCosts;

		addOperator(_operator);
		updateEtherPrice(_etherPrice);
		createHoldings();
		preMintTokens();

		// transfer ownership the the admin multi-sig
		transferOwnership(_admin);
	}

	function updateEtherPrice(uint256 _price) onlyOwner public {
		require(_price > 0);
		require(now < startTime);

		etherPrice = _price;
		buyerCapLowEther = BUYER_CAP_LOW_USD.mul(etherInWei).mul(PRICE_MULTIPLIER).div(etherPrice);
		buyerCapHighEther = BUYER_CAP_HIGH_USD.mul(etherInWei).mul(PRICE_MULTIPLIER).div(etherPrice);
		saleHardCapEther = SALE_CAP_USD.mul(etherInWei).mul(PRICE_MULTIPLIER).div(etherPrice);
		mintRate = TOKENS_PER_USD.mul(etherPrice).div(PRICE_MULTIPLIER);

		// update vars on parent contracts
		cap = saleHardCapEther;
		rate = mintRate;
	}

	function createHoldings() internal {
		companyHolding2y = new TokenTimelock(token, company, startTime+2 years);
		shareholdersHolding1y = new TokenTimelock(token, shareholders, startTime+1 years);
	}

	function preMintTokens() internal {
		token.mint(preSaleBfPlatform, 300000000 * etherInWei);
		token.mint(companyHolding2y, 300000000 * etherInWei);
		token.mint(rewardPool, 200000000 * etherInWei);
		token.mint(shareholdersHolding1y, 100000000 * etherInWei);
		token.mint(tokenSaleCosts, 70000000 * etherInWei);
	}

	function checkSaleEnded() internal {
		// if no further purchases are possible due to lower buyer cap
		if(saleHardCapEther.sub(weiRaised) < buyerCapLowEther) {
			token.mint(rewardPool, tokenCap.sub(token.totalSupply()));
		}
	}

	// overriding CappedCrowdsale#validPurchase to add extra low/high limits logic
	// @return true if investors can buy at the moment
	function validPurchase() whenNotPaused
	internal view returns (bool) {
		bool aboveLowBuyerCap = (msg.value >= buyerCapLowEther);
		bool underMaxBuyerCap = (msg.value <= buyerCapHighEther);
		return super.validPurchase() && aboveLowBuyerCap && underMaxBuyerCap;
	}

	// overriding Crowdsale#hasEnded to add token cap logic
	// @return true if crowdsale event has ended
	function hasEnded() public view returns (bool) {
		bool tokenCapReached = token.totalSupply() == tokenCap;
		return super.hasEnded() || tokenCapReached;
	}

	function buyTokens(address beneficiary)
	onlyWhitelisted(beneficiary)
	whenNotPaused
	public payable {
		require(token.balanceOf(beneficiary)==0);
		super.buyTokens(beneficiary);
		checkSaleEnded();
	}

	// creates the token to be sold.
	// override this method to have crowdsale of a specific mintable token.
	function createTokenContract() internal returns (MintableToken) {
		return new BftToken(tokenCap, tokenDecimals, this);
	}

	function addWhitelist(address[] beneficiaries) onlyOperator public {
		for (uint i = 0; i < beneficiaries.length; i++) {
			whitelist[beneficiaries[i]] = true;
		}
	}

	function remWhitelist(address[] beneficiaries) onlyOperator public {
		for (uint i = 0; i < beneficiaries.length; i++) {
			whitelist[beneficiaries[i]] = false;
		}
	}

	function isWhitelisted(address beneficiary) view public returns(bool) {
		return whitelist[beneficiary];
	}

	function addOperator(address _operator) onlyOwner public {
		operators[_operator] = true;
		LogOperatorAdd(_operator);
	}

	function remOperator(address _operator) onlyOwner public {
		operators[_operator] = false;
		LogOperatorAdd(_operator);
	}

	function isOperator(address _operator) view public returns(bool) {
		return operators[_operator];
	}

	function transferTokenOwnership(address _newOwner) onlyOwner public {
		// only allow transfer at the end of the sale
		require(hasEnded());
		// stop the minting process on the token as we only allow the crowdsale to mint
		token.finishMinting();
		token.transferOwnership(_newOwner);
	}
}

