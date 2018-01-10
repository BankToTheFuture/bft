export default async promise => {
  try {
    await promise;
  } catch (error) {
    const outOfGas = error.message.search('out of gas') >= 0;
    assert(
      outOfGas,
      "Expected \'out of gas\', got '" + error + "' instead",
    );
    return;
  }
  assert.fail('Expected throw not received');
};
