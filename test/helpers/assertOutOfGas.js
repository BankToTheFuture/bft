module.exports = function(error) {
  assert.isAbove(error.message.search('out of gas'), -1, '\'out of gas\' error must be returned');
}
