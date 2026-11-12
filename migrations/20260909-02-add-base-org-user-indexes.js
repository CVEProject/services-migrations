const INDEXES = [
  { collectionName: 'BaseUser', key: { UUID: 1 } },
  { collectionName: 'BaseOrg', key: { UUID: 1 } },
  { collectionName: 'BaseOrg', key: { authority: 1 } }
]

function keysMatch (actual, expected) {
  const actualKeys = Object.keys(actual)
  const expectedKeys = Object.keys(expected)

  return actualKeys.length === expectedKeys.length &&
    expectedKeys.every((key, index) => key === actualKeys[index] && actual[key] === expected[key])
}

async function createIndexIfMissing (db, { collectionName, key }) {
  const collection = db.collection(collectionName)
  const existingIndexes = await collection.indexes()

  if (!existingIndexes.some(index => keysMatch(index.key, key))) {
    await collection.createIndex(key)
  }
}

module.exports = {
  async up (db) {
    for (const index of INDEXES) {
      await createIndexIfMissing(db, index)
    }
  },

  async down () {
    // Index removal could disrupt existing deployments, so leave it to an explicit migration.
  }
}
