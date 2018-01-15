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
	const BUYER_CAP_USD = 1000;
	const PRICE_MULTIPLIER = 100;
	const TOKENS_PER_USD= 10;

	const ETH_PRICE = 749.90 * PRICE_MULTIPLIER;

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

	let latestMintRate = null;
	let buyerCapEther = null;

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
				ETH_PRICE,
				ac.crowdsaleWallet,

				ac.preSaleBfPlatform,
				ac.company,
				ac.rewardPool,
				ac.shareholders,
				ac.tokenSaleCosts,

				ac.operator1,

				{from: ac.admin, gas: 7000000}
			);

		console.log("crowdsale.address= " +crowdsale.address);

		let op = await crowdsale.operator();
		assert.equal(op, ac.operator1, "operator1 address not set correctly");

		await check_updateEtherPrice(ETH_PRICE);
	})

	async function check_updateEtherPrice(_etherPrice) {
		buyerCapEther = await crowdsale.buyerCapEther();

		let jsBuyerCapEther =
			(new BigNumber(ether(BUYER_CAP_USD)))
				.div(_etherPrice)
				.mul(PRICE_MULTIPLIER)
				.floor();

		buyerCapEther.should.be.bignumber.equal(jsBuyerCapEther);
		console.log("buyerCapEther= "+wei(buyerCapEther));

		let saleCapEther = await crowdsale.saleCapEther();

		let jsSaleCapEther =
			(new BigNumber(ether(SALE_CAP_USD)))
				.div(_etherPrice)
				.mul(PRICE_MULTIPLIER)
				.floor();

		saleCapEther.should.be.bignumber.equal(jsSaleCapEther);
		console.log("saleCapEther= "+wei(saleCapEther));

		let cap = await crowdsale.cap();
		cap.should.be.bignumber.equal(saleCapEther);

		latestMintRate = await crowdsale.mintRate();

		let jsMintRate =
			(new BigNumber(TOKENS_PER_USD))
				.mul(_etherPrice)
				.div(PRICE_MULTIPLIER)
				.floor();

		latestMintRate.should.be.bignumber.equal(jsMintRate);
		console.log("mintRate= "+latestMintRate);

		let rate = await crowdsale.rate();
		rate.should.be.bignumber.equal(latestMintRate);

		return Promise.resolve(true);
	}

	it('should be able to change the etherPrice as an admin', async () => {

		let newEtherPrice = 1361.70 * PRICE_MULTIPLIER;
		await crowdsale.updateEtherPrice(newEtherPrice, {from: ac.admin}).should.be.fulfilled;

		let etherPrice = await crowdsale.etherPrice();
		etherPrice.should.be.bignumber.equal(newEtherPrice);

		await check_updateEtherPrice(newEtherPrice);
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

		let startTransfersTime = await token.startTransfersTime();
		startTransfersTime.should.be.bignumber.equal(endTime, 'The startTransfersDate timestamp is incorrect');
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

		await crowdsale.changeOperator(ac.operator2, {from: ac.admin}).should.be.fulfilled;
		let op = await crowdsale.operator();
		assert.equal(op, ac.operator2, "didn't set the correct address for operator2");

		await crowdsale.addWhitelist([ac.buyer2], {from: ac.operator2}).should.be.fulfilled;
		await crowdsale.remWhitelist([ac.buyer2], {from: ac.operator2}).should.be.fulfilled;

		// put ac.operator1 back as operator
		await crowdsale.changeOperator(ac.operator1, {from: ac.admin}).should.be.fulfilled;
	})

	it('should stop adding to whitelist if crowdsale is paused', async () => {
		await crowdsale.pause({from: ac.admin}).should.be.fulfilled;
		await crowdsale.addWhitelist([ac.buyer1], {from: ac.operator1}).should.be.rejectedWith(EVMRevert);

		await crowdsale.unpause({from: ac.admin}).should.be.fulfilled;
		await crowdsale.addWhitelist([ac.buyer1], {from: ac.operator1}).should.be.fulfilled;
		assert.isTrue(await crowdsale.isWhitelisted(ac.buyer1));
	})

	it('should allow to change the ownership of the token', async () => {

		let owner1 = await token.owner();
		assert.equal(owner1, crowdsale.address, 'wrong owner of token smart contract');

		await crowdsale.transferTokenOwnership(ac.tokenAdmin,{from: ac.admin}).should.be.fulfilled;
		let owner2 = await token.owner();
		assert.equal(owner2, ac.tokenAdmin, 'wrong owner of token smart contract - after transfer');

		// transfer back ownership to crowdsale contract
		await token.transferOwnership(crowdsale.address, {from: ac.tokenAdmin}).should.be.fulfilled;
		let owner3 = await token.owner();
		assert.equal(owner3, crowdsale.address, 'wrong owner of token smart contract');
	})

	it('should not allow a non-whitelisted buyer to send buy tokens', async() => {

		assert.isFalse(await crowdsale.isWhitelisted(ac.buyer2));
		await crowdsale.buyTokens(ac.buyer2, {from: ac.buyer2, value: ether(1)}).should.be.rejectedWith(EVMRevert);
	})

	it('should not allow a whitelisted buyer to buy tokens before the startTime', async() => {

		await crowdsale.addWhitelist([ac.buyer1], {from: ac.operator1}).should.be.fulfilled;
		assert.isTrue(await crowdsale.isWhitelisted(ac.buyer1));

		await crowdsale.buyTokens(
			ac.buyer1,
			{
				from: ac.buyer1,
				value: buyerCapEther
			}
		)
		.should.be.rejectedWith(EVMRevert);
	})

	it('should allow a whitelisted buyer to buy tokens', async() => {

		// move the time to the start of the crowdsale
		await increaseTimeTo(startTime);

		await crowdsale.buyTokens(
			ac.buyer1,
			{
				from: ac.buyer1,
				value: buyerCapEther
			}
		)
		.should.be.fulfilled;

		let tBought = await token.balanceOf(ac.buyer1);
		tBought.should.be.bignumber.equal(buyerCapEther.mul(latestMintRate));
	})

	it('should not be able to change the etherPrice after startTime', async () => {

		let newEtherPrice = 700.70 * PRICE_MULTIPLIER;
		await crowdsale.updateEtherPrice(newEtherPrice, {from: ac.admin}).should.be.rejectedWith(EVMRevert);
	})

	it('should not allow a whitelisted buyer to buy tokens twice', async() => {

		await crowdsale.buyTokens(
			ac.buyer1,
			{
				from: ac.buyer1,
				value: ether(0.1)
			}
		)
		.should.be.rejectedWith(EVMRevert);
	})

	it('should not allow a whitelisted buyer to buy more tokens than the buyerCapEther', async() => {

		await crowdsale.addWhitelist([ac.buyer2], {from: ac.operator1}).should.be.fulfilled;
		assert.isTrue(await crowdsale.isWhitelisted(ac.buyer2));

		await crowdsale.buyTokens(
			ac.buyer2,
			{
				from: ac.buyer2,
				value: buyerCapEther.add(ether(0.001))
			}
		)
		.should.be.rejectedWith(EVMRevert);
	})

	it('should not allow a whitelisted buyer to send less ether than buyerCapEther*0.95', async() => {

		await crowdsale.addWhitelist([ac.buyer2], {from: ac.operator1}).should.be.fulfilled;
		assert.isTrue(await crowdsale.isWhitelisted(ac.buyer2));

		let under = buyerCapEther.mul(0.95).sub(ether(0.001)).floor();
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

		// unpause back the contract
		await crowdsale.unpause({from: ac.admin}).should.be.fulfilled;
		assert.isFalse(await crowdsale.paused());
	})

	it('should allow a whitelisted buyer to buy tokens using the fallback function', async() => {

		// should allow the lower limit
		let low = buyerCapEther.mul(0.95).ceil();
		await pSendTransaction({
			value: low,
			from: ac.buyer2,
			to: crowdsale.address,
			gas: 100000
		})
		.should.be.fulfilled;

		let tBought = wei(await token.balanceOf(ac.buyer2));
		tBought.should.be.bignumber.equal(low.mul(wei(latestMintRate)));
	})

	it('should allow a whitelisted buyer to buy tokens for a third party - also whitelisted', async() => {

		await crowdsale.addWhitelist([ac.buyer3], {from: ac.operator1}).should.be.fulfilled;
		assert.isTrue(await crowdsale.isWhitelisted(ac.buyer3));

		let under = buyerCapEther.mul(0.99).ceil();
		await crowdsale.buyTokens(
			ac.buyer3,
			{
				from: ac.buyer1,
				value: under
			}
		)
		.should.be.fulfilled;

		let tBought = wei(await token.balanceOf(ac.buyer3));
		tBought.should.be.bignumber.equal(under.mul(wei(latestMintRate)));
	})

	it('should have correctly received the funds to the crowdsale wallet', async() => {
		let balance = await pGetBalance(ac.crowdsaleWallet);

		let low = buyerCapEther.mul(0.95).ceil();
		let under = buyerCapEther.mul(0.99).ceil();
		let total = buyerCapEther.add(low).add(under);

		let balanceShouldBe = crowdsaleWalletBalanceBefore.add(total);
		balance.should.be.bignumber.equal(balanceShouldBe);
	})

	it('should have correctly calculated the totalSupply and weiRaised', async () => {

		let low = buyerCapEther.mul(0.95).ceil();
		let under = buyerCapEther.mul(0.99).ceil();
		let total = buyerCapEther.add(low).add(under);

		let totalSupply = await token.totalSupply();
		totalSupply.should.be.bignumber.equal(ether(tPreMintedSupply).add(total.mul(latestMintRate)));

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
