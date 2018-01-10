export default async promise => {
  try {
    await promise;
  } catch (error) {
    const index = error.message.search('Cannot send value to non-payable function') >= 0;
    assert(
      index,
      "Expected \'Cannot send value to non-payable function\', got '" + error + "' instead",
    );
    return;
  }
  assert.fail('Expected throw not received');
};
