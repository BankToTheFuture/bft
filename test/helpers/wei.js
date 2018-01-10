export default function wei (n) {
  return new web3.fromWei(n, 'ether');
}
