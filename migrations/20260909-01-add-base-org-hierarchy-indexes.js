function keysMatch (actual, expected) {
  const actualKeys = Object.keys(actual)
  const expectedKeys = Object.keys(expected)

  return actualKeys.length === expectedKeys.length &&
    expectedKeys.every((key, index) => key === actualKeys[index] && actual[key] === expected[key])
}

async function createIndexIfMissing (collection, key) {
  const existingIndexes = await collection.indexes()
  const hasIndex = existingIndexes.some(index => keysMatch(index.key, key))

  if (!hasIndex) {
    await collection.createIndex(key)
  }
}

module.exports = {
  async up (db, client) {
    const baseOrgs = db.collection('BaseOrg')
    await createIndexIfMissing(baseOrgs, { UUID: 1 })
    await createIndexIfMissing(baseOrgs, { oversees: 1 })
  },

  async down (db, client) {
    // Intentionally no-op because either index may predate this migration.
  }
}