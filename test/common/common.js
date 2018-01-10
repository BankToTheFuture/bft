function accounts(rpc_accounts) {
	return {
		admin: rpc_accounts[0],
		crowdsaleWallet: rpc_accounts[1],

		privateContributors: rpc_accounts[2],
		preSaleBfPlatform: rpc_accounts[3],
		company: rpc_accounts[4],
		rewardPool: rpc_accounts[5],
		shareholders: rpc_accounts[6],
		tokenSaleCosts: rpc_accounts[7],

		operator1: rpc_accounts[8],
		operator2: rpc_accounts[9],

		intruder1: rpc_accounts[10],
		intruder2: rpc_accounts[11],

		buyer1: rpc_accounts[12],
		buyer2: rpc_accounts[13],
		buyer3: rpc_accounts[14],
		buyer4: rpc_accounts[15],
		buyer5: rpc_accounts[16],

		tokenAdmin: rpc_accounts[17],
	};
}

module.exports = {
	accounts: accounts,
};
