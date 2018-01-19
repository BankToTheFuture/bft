require('babel-register');
require('babel-polyfill');

import EVMRevert from "../zeppelin/test/helpers/EVMRevert";
import {duration, increaseTimeTo} from '../zeppelin/test/helpers/increaseTime'
import {accounts} from './common/common';
import ether from '../zeppelin/test/helpers/ether';
import wei from './helpers/wei';

let Promise = require('bluebird');

const BigNumber = web3.BigNumber;

let chai = require('chai');
let assert = chai.assert;
const should = require('chai')
	.use(require('chai-as-promised'))
	.use(require('chai-bignumber')(BigNumber))
	.should();

const BftCrowdsale = artifacts.require("../contracts/BftCrowdsale.sol");
const BftToken = artifacts.require("../contracts/BftToken.sol");
const TokenTimelock = artifacts.require("../zeppelin/contracts/token/TokenTimelock.sol");

contract('00_BftCrowdsale.sol', function(rpc_accounts) {

	let ac = accounts(rpc_accounts);

	let pGetBalance = Promise.promisify(web3.eth.getBalance);
	let pSendTransaction = Promise.promisify(web3.eth.sendTransaction);

	const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';

	const SALE_CAP_USD = 3000000;
	const BUYER_CAP_LOW_USD = 1000;
	const BUYER_CAP_HIGH_USD = 10000;
	const PRICE_MULTIPLIER = 100;
	const TOKENS_PER_USD= 10;

	const INIT_ETH_PRICE = 2376.0 * PRICE_MULTIPLIER;
	const UPDATED_ETH_PRICE = 2398.0 * PRICE_MULTIPLIER;

	const TOKEN_DECIMALS = 18;
	const TOKEN_SYMBOL = 'BFT';
	const TOKEN_CAP = 1000000000;

	const tPreSaleBfPlatform = 300000000;
	const tCompany = 300000000;
	const tRewardPool = 200000000;
	const tShareholders = 100000000;
	const tTokenSaleCosts = 70000000;

	const tPreMintedSupply =
		tPreSaleBfPlatform+
		tCompany+
		tRewardPool+
		tShareholders+
		tTokenSaleCosts;

	let companyHolding2y = null;
	let shareholdersHolding1y = null;

	let crowdsale = null;
	let token = null;
	let aToken = null;

	let mintRate = null;
	let buyerCapLowEther = null;
	let buyerCapHighEther = null;

	let startTime = 1518818400; //Friday, 16th February 2018, 10:00pm UTC
	let endTime = 1520373600;   //Tuesday, 6th of March 2018, 10:00pm UTC

	let crowdsaleWalletBalanceBefore = undefined;

	it('should be able to deploy the BftCrowdsale contract and set initial state', async () => {

		crowdsaleWalletBalanceBefore = await pGetBalance(ac.crowdsaleWallet);

		console.log('startTime= '+startTime);
		console.log('endTime= '+endTime);

		crowdsale = await BftCrowdsale.new(
				startTime,
				endTime,
				INIT_ETH_PRICE,
				ac.crowdsaleWallet,

				ac.preSaleBfPlatform,
				ac.company,
				ac.rewardPool,
				ac.shareholders,
				ac.tokenSaleCosts,

				ac.operator1,
				ac.admin,

				SALE_CAP_USD,
				BUYER_CAP_LOW_USD,
				BUYER_CAP_HIGH_USD,

				{from: ac.operator1, gas: 7000000}
			);

		console.log("crowdsale.address= " +crowdsale.address);

		let result1 = await crowdsale.isOperator(ac.operator1);
		assert.isTrue(result1, "operator1 address not set correctly");

		let ad = await crowdsale.owner();
		assert.equal(ad, ac.admin, "operator1 address not set correctly");

		await check_updateEtherPrice(INIT_ETH_PRICE);
	})

	async function check_updateEtherPrice(_etherPrice) {
		buyerCapLowEther = await crowdsale.buyerCapLowEther();

		let jsBuyerCapLowEther =
			(new BigNumber(ether(BUYER_CAP_LOW_USD)))
				.div(_etherPrice)
				.mul(PRICE_MULTIPLIER)
				.floor();

		buyerCapLowEther.should.be.bignumber.equal(jsBuyerCapLowEther);
		console.log("buyerCapLowEther= "+wei(buyerCapLowEther));

		buyerCapHighEther = await crowdsale.buyerCapHighEther();

		let jsBuyerCapHighEther =
			(new BigNumber(ether(BUYER_CAP_HIGH_USD)))
				.div(_etherPrice)
				.mul(PRICE_MULTIPLIER)
				.floor();

		buyerCapHighEther.should.be.bignumber.equal(jsBuyerCapHighEther);
		console.log("buyerCapHighEther= "+wei(buyerCapHighEther));

		let saleHardCapEther = await crowdsale.saleHardCapEther();

		let jsSaleHardCapEther =
			(new BigNumber(ether(SALE_CAP_USD)))
				.div(_etherPrice)
				.mul(PRICE_MULTIPLIER)
				.floor();

		saleHardCapEther.should.be.bignumber.equal(jsSaleHardCapEther);
		console.log("saleHardCapEther= "+wei(saleHardCapEther));

		let cap = await crowdsale.cap();
		cap.should.be.bignumber.equal(saleHardCapEther);

		mintRate = await crowdsale.mintRate();

		let jsMintRate =
			(new BigNumber(TOKENS_PER_USD))
				.mul(_etherPrice)
				.div(PRICE_MULTIPLIER)
				.floor();

		mintRate.should.be.bignumber.equal(jsMintRate);
		console.log("mintRate= "+mintRate);

		let rate = await crowdsale.rate();
		rate.should.be.bignumber.equal(mintRate);

		return Promise.resolve(true);
	}

	it('should be able to change the etherPrice as an admin', async () => {

		await crowdsale.updateEtherPrice(UPDATED_ETH_PRICE, {from: ac.admin}).should.be.fulfilled;

		let etherPrice = await crowdsale.etherPrice();
		etherPrice.should.be.bignumber.equal(UPDATED_ETH_PRICE);

		await check_updateEtherPrice(UPDATED_ETH_PRICE);
	})

	it('should have deployed and configured the 2 TokenTimelock contracts', async () => {
		companyHolding2y = await crowdsale.companyHolding2y();
		assert.notEqual(companyHolding2y, NULL_ADDRESS, 'companyHolding2y not deployed');

		let tt1 = TokenTimelock.at(companyHolding2y);
		let beneficiary1 = await tt1.beneficiary();
		let releaseTime1 = await tt1.releaseTime();
		assert.equal(beneficiary1, ac.company);
		assert.equal(releaseTime1, startTime+duration.years(2));

		shareholdersHolding1y = await crowdsale.shareholdersHolding1y();
		assert.notEqual(shareholdersHolding1y, NULL_ADDRESS, 'shareholdersHolding1y not deployed');

		let tt2 = TokenTimelock.at(shareholdersHolding1y);
		let beneficiary2 = await tt2.beneficiary();
		let releaseTime2 = await tt2.releaseTime();
		assert.equal(beneficiary2, ac.shareholders);
		assert.equal(releaseTime2, startTime+duration.years(1));
	})

	it('should have filled-in the details of the standard token contract', async () => {
		aToken = await crowdsale.token();
		token = BftToken.at(aToken);
		console.log("token.address= "+token.address);

		let symbol = await token.symbol();
		console.log("symbol= "+symbol);
		symbol.should.equal(TOKEN_SYMBOL, 'The token symbol is not '+TOKEN_SYMBOL);

		let decimals = await token.decimals();
		console.log("decimals= "+decimals);
		decimals.should.be.bignumber.equal(TOKEN_DECIMALS, 'Incorrect number of decimals on the token');

		let cap = wei(await token.cap());
		console.log("cap= "+cap);
		cap.should.be.bignumber.equal(TOKEN_CAP, 'Incorrect cap on the token');
	})

	it('should have pre-minted the correct amount of tokens', async () => {

		let b2 = wei(await token.balanceOf(ac.preSaleBfPlatform));
		b2.should.be.bignumber.equal(tPreSaleBfPlatform);

		// the company address should have 0 tokens
		let b3 = wei(await token.balanceOf(ac.company));
		b3.should.be.bignumber.equal(0);

		// the holding contract for company tokens should have the company balance
		let b4 = wei(await token.balanceOf(companyHolding2y));
		b4.should.be.bignumber.equal(tCompany);

		let b5 = wei(await token.balanceOf(ac.rewardPool));
		b5.should.be.bignumber.equal(tRewardPool);

		let b6 = wei(await token.balanceOf(ac.shareholders));
		b6.should.be.bignumber.equal(0);

		let b7 = wei(await token.balanceOf(shareholdersHolding1y));
		b7.should.be.bignumber.equal(tShareholders);

		let b8 = wei(await token.balanceOf(ac.tokenSaleCosts));
		b8.should.be.bignumber.equal(tTokenSaleCosts);

		let totalSupply = wei(await token.totalSupply());
		totalSupply.should.be.bignumber.equal(tPreMintedSupply);

		let weiRaised = wei(await crowdsale.weiRaised());
		weiRaised.should.be.bignumber.equal(0);
	})

	it('should not allow a non-operator to add/rem to the whitelist', async () => {
		await crowdsale.addWhitelist([ac.buyer1], {from: ac.intruder1}).should.be.rejectedWith(EVMRevert);
		assert.isFalse(await crowdsale.isWhitelisted(ac.buyer1), 'buyer1 should not be whitelisted');
		await crowdsale.remWhitelist([ac.buyer1], {from: ac.intruder1}).should.be.rejectedWith(EVMRevert);
	})

	it('should allow operator to add/rem to the whitelist', async () => {
		await crowdsale.addWhitelist([ac.buyer1], {from: ac.operator1}).should.be.fulfilled;
		assert.isTrue(await crowdsale.isWhitelisted(ac.buyer1), 'buyer1 should be whitelisted');

		await crowdsale.remWhitelist([ac.buyer1], {from: ac.operator1}).should.be.fulfilled;
		assert.isFalse(await crowdsale.isWhitelisted(ac.buyer1), 'buyer1 should not be whitelisted');
	})

	it('should allow operator to add/rem multiple beneficiaries to the whitelist', async () => {
		await crowdsale.addWhitelist(
			[
				ac.buyer1,
				ac.buyer2,
				ac.buyer3,
				ac.buyer4,
				ac.buyer5
			],
			{from: ac.operator1}
		).should.be.fulfilled;
		assert.isTrue(await crowdsale.isWhitelisted(ac.buyer1), 'buyer1 should be whitelisted');
		assert.isTrue(await crowdsale.isWhitelisted(ac.buyer2), 'buyer2 should be whitelisted');
		assert.isTrue(await crowdsale.isWhitelisted(ac.buyer3), 'buyer3 should be whitelisted');
		assert.isTrue(await crowdsale.isWhitelisted(ac.buyer4), 'buyer4 should be whitelisted');
		assert.isTrue(await crowdsale.isWhitelisted(ac.buyer5), 'buyer5 should be whitelisted');

		await crowdsale.remWhitelist(
			[
				ac.buyer1,
				ac.buyer2,
				ac.buyer3,
				ac.buyer4,
				ac.buyer5,
			],
			{from: ac.operator1}
		).should.be.fulfilled;
		assert.isFalse(await crowdsale.isWhitelisted(ac.buyer1), 'buyer1 should not be whitelisted');
		assert.isFalse(await crowdsale.isWhitelisted(ac.buyer2), 'buyer2 should not be whitelisted');
		assert.isFalse(await crowdsale.isWhitelisted(ac.buyer3), 'buyer3 should not be whitelisted');
		assert.isFalse(await crowdsale.isWhitelisted(ac.buyer4), 'buyer4 should not be whitelisted');
		assert.isFalse(await crowdsale.isWhitelisted(ac.buyer5), 'buyer5 should not be whitelisted');
	})

	it('should allow owner/admin to change operator', async () => {
		await crowdsale.addWhitelist([ac.buyer2], {from: ac.operator2}).should.be.rejectedWith(EVMRevert);

		await crowdsale.addOperator(ac.operator2, {from: ac.admin}).should.be.fulfilled;
		let result1 = await crowdsale.isOperator(ac.operator2);
		assert.isTrue(result1, ac.operator2, "could not set operator2 as operator");

		await crowdsale.addWhitelist([ac.buyer2], {from: ac.operator2}).should.be.fulfilled;
		await crowdsale.remWhitelist([ac.buyer2], {from: ac.operator2}).should.be.fulfilled;

		// put ac.operator1 back as operator
		await crowdsale.remOperator(ac.operator2, {from: ac.admin}).should.be.fulfilled;
		let result2 = await crowdsale.isOperator(ac.operator2);
		assert.isFalse(result2, ac.operator2, "could not remove operator2 as operator");
	})

	it('should NOT stop adding/removing to/from whitelist if crowdsale is paused', async () => {
		await crowdsale.pause({from: ac.admin}).should.be.fulfilled;
		await crowdsale.addWhitelist([ac.buyer1], {from: ac.operator1}).should.be.fulfilled;

		await crowdsale.unpause({from: ac.admin}).should.be.fulfilled;
		await crowdsale.addWhitelist([ac.buyer1], {from: ac.operator1}).should.be.fulfilled;
		assert.isTrue(await crowdsale.isWhitelisted(ac.buyer1));
	})

	it('should NOT allow to change the ownership of the token before crowdsale ends', async () => {

		let owner1 = await token.owner();
		assert.equal(owner1, crowdsale.address, 'wrong owner of token smart contract');

		await crowdsale.transferTokenOwnership(ac.tokenAdmin,{from: ac.admin}).should.be.rejectedWith(EVMRevert);
		let owner2 = await token.owner();
		assert.equal(owner2, owner1, 'wrong owner of token smart contract');
	})

	it('should not allow a whitelisted buyer to buy tokens before the startTime', async() => {

		await crowdsale.addWhitelist([ac.buyer1], {from: ac.operator1}).should.be.fulfilled;
		assert.isTrue(await crowdsale.isWhitelisted(ac.buyer1));

		await crowdsale.buyTokens(
			ac.buyer1,
			{
				from: ac.buyer1,
				value: buyerCapLowEther
			}
		)
		.should.be.rejectedWith(EVMRevert);
	})


	it('should not allow a non-whitelisted buyer to send buy tokens', async() => {

		// move the time to the start of the crowdsale
		await increaseTimeTo(startTime);

		assert.isFalse(await crowdsale.isWhitelisted(ac.buyer2));
		await crowdsale.buyTokens(ac.buyer2, {from: ac.buyer2, value: buyerCapLowEther}).should.be.rejectedWith(EVMRevert);
	})

	it('should allow a whitelisted buyer to buy tokens', async() => {

		assert.isTrue(await crowdsale.isWhitelisted(ac.buyer1));
		await crowdsale.buyTokens(
			ac.buyer1,
			{
				from: ac.buyer1,
				value: buyerCapLowEther
			}
		)
		.should.be.fulfilled;


		let tBought = await token.balanceOf(ac.buyer1);
		let shouldBe = buyerCapLowEther.mul(mintRate);

		tBought.should.be.bignumber.equal(shouldBe);
	})

	it('should not be able to change the etherPrice after startTime', async () => {

		await crowdsale.updateEtherPrice(INIT_ETH_PRICE, {from: ac.admin}).should.be.rejectedWith(EVMRevert);
	})

	it('should not allow a whitelisted buyer to buy tokens twice', async() => {

		await crowdsale.buyTokens(
			ac.buyer1,
			{
				from: ac.buyer1,
				value: buyerCapLowEther
			}
		)
		.should.be.rejectedWith(EVMRevert);
	})

	it('should not allow a whitelisted buyer to buy more tokens than the buyerCapHighEther', async() => {

		await crowdsale.addWhitelist([ac.buyer2], {from: ac.operator1}).should.be.fulfilled;
		assert.isTrue(await crowdsale.isWhitelisted(ac.buyer2));

		let above = buyerCapHighEther.add(ether(0.001)).ceil();
		await crowdsale.buyTokens(
			ac.buyer2,
			{
				from: ac.buyer2,
				value: above
			}
		)
		.should.be.rejectedWith(EVMRevert);
	})

	it('should not allow a whitelisted buyer to send less ether than buyerCapLowEther', async() => {

		await crowdsale.addWhitelist([ac.buyer2], {from: ac.operator1}).should.be.fulfilled;
		assert.isTrue(await crowdsale.isWhitelisted(ac.buyer2));

		let under = buyerCapLowEther.mul(0.95).sub(ether(0.001)).floor();
		await crowdsale.buyTokens(
			ac.buyer2,
			{
				from: ac.buyer2,
				value: under,
			}
		)
		.should.be.rejectedWith(EVMRevert);
	})

	it('should not allow a whitelisted buyer to buy when crowdsale is paused', async() => {

		assert.isTrue(await crowdsale.isWhitelisted(ac.buyer2));
		await crowdsale.pause({from: ac.admin}).should.be.fulfilled;
		assert.isTrue(await crowdsale.paused());

		await crowdsale.buyTokens(
			ac.buyer2,
			{
				from: ac.buyer2,
				value: ether(1)
			}
		)
		.should.be.rejectedWith(EVMRevert);

		// un-pause back the contract
		await crowdsale.unpause({from: ac.admin}).should.be.fulfilled;
		assert.isFalse(await crowdsale.paused());
	})

	it('should allow a whitelisted buyer to buy tokens using the fallback function', async() => {

		// should allow the lower limit
		await pSendTransaction({
			value: buyerCapLowEther,
			from: ac.buyer2,
			to: crowdsale.address,
			gas: 100000
		})
		.should.be.fulfilled;

		let tBought = wei(await token.balanceOf(ac.buyer2));
		tBought.should.be.bignumber.equal(buyerCapLowEther.mul(wei(mintRate)));
	})

	it('should allow a NON-whitelisted buyer to buy tokens for a third party', async() => {

		await crowdsale.addWhitelist([ac.buyer3], {from: ac.operator1}).should.be.fulfilled;
		assert.isTrue(await crowdsale.isWhitelisted(ac.buyer3));

		// the sender does NOT have to be whitelisted
		assert.isFalse(await crowdsale.isWhitelisted(ac.intruder1));

		// should allow the upper limit
		await crowdsale.buyTokens(
			ac.buyer3,
			{
				from: ac.intruder1,
				value: buyerCapHighEther
			}
		)
		.should.be.fulfilled;

		let tBought = wei(await token.balanceOf(ac.buyer3));
		tBought.should.be.bignumber.equal(buyerCapHighEther.mul(wei(mintRate)));
	})

	it('should have correctly received the funds to the crowdsale wallet', async() => {
		let balance = await pGetBalance(ac.crowdsaleWallet);

		let total = buyerCapLowEther.mul(2).add(buyerCapHighEther);

		let balanceShouldBe = crowdsaleWalletBalanceBefore.add(total);
		balance.should.be.bignumber.equal(balanceShouldBe);
	})

	it('should have correctly calculated the totalSupply and weiRaised', async () => {

		let total = buyerCapLowEther.mul(2).add(buyerCapHighEther);

		let totalSupply = await token.totalSupply();
		totalSupply.should.be.bignumber.equal(ether(tPreMintedSupply).add(total.mul(mintRate)));

		let weiRaised = await crowdsale.weiRaised();
		weiRaised.should.be.bignumber.equal(total);
	})

	it('should not release tokens to shareholders account for 1 year', async () => {
		let th = TokenTimelock.at(shareholdersHolding1y);
		await th.release().should.be.rejectedWith(EVMRevert);
	})

	it('should release tokens to shareholders account after 1 year', async () => {
		let th = TokenTimelock.at(shareholdersHolding1y);
		await increaseTimeTo(startTime+duration.years(1));
		await th.release().should.be.fulfilled;

		let tShareholdersBalance = wei(await token.balanceOf(ac.shareholders));
		tShareholdersBalance.should.be.bignumber.equal(tShareholders);

		let tHolding = wei(await token.balanceOf(shareholdersHolding1y));
		tHolding.should.be.bignumber.equal(0);
	})

	it('should not release tokens to company account for 2 years', async () => {
		let th = TokenTimelock.at(companyHolding2y);
		await th.release().should.be.rejectedWith(EVMRevert);
	})

	it('should release tokens to company account after 2 years', async () => {
		let th = TokenTimelock.at(companyHolding2y);
		await increaseTimeTo(startTime+duration.years(2));
		await th.release().should.be.fulfilled;

		let tCompanyBalance = wei(await token.balanceOf(ac.company));
		tCompanyBalance.should.be.bignumber.equal(tCompany);

		let tHolding = wei(await token.balanceOf(companyHolding2y));
		tHolding.should.be.bignumber.equal(0);
	})


});
