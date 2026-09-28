const COLLECTION_NAMES = [
  'Audit',
  'BaseOrg',
  'BaseUser',
  'Conversation',
  'Cve',
  'Cve-Id',
  'Cve-Id-Range',
  'Glossary',
  'Org',
  'ReviewObject',
  'User'
]

const INDEXES = [
  { collectionName: 'Audit', key: { uuid: 1 } },
  { collectionName: 'Conversation', key: { target_uuid: 1 } },
  { collectionName: 'Conversation', key: { previous_conversation_uuid: 1 } },
  { collectionName: 'Conversation', key: { next_conversation_uuid: 1 } },
  { collectionName: 'Conversation', key: { author_id: 1 } },
  { collectionName: 'Conversation', key: { posted_at: 1 } },
  { collectionName: 'Cve', key: { 'cve.cveMetadata.cveId': 1 } },
  { collectionName: 'Cve', key: { 'cve.cveMetadata.dateUpdated': 1 } },
  { collectionName: 'Cve', key: { 'cve.containers.cna.providerMetadata.dateUpdated': 1 } },
  { collectionName: 'Cve', key: { 'time.modified': 1 } },
  { collectionName: 'Cve', key: { 'time.created': 1 } },
  { collectionName: 'Cve-Id', key: { cve_id: 1 } },
  { collectionName: 'Cve-Id', key: { owning_cna: 1, state: 1 } },
  { collectionName: 'Cve-Id', key: { reserved: 1 } },
  { collectionName: 'Glossary', key: { services_short_name: 1 }, options: { unique: true } },
  { collectionName: 'Org', key: { UUID: 1 } },
  { collectionName: 'Org', key: { 'authority.active_roles': 1 } },
  { collectionName: 'ReviewObject', key: { target_object_uuid: 1, status: 1, created: -1 } },
  { collectionName: 'User', key: { UUID: 1 } }
]

async function collectionExists (db, collectionName) {
  const collections = await db.listCollections({ name: collectionName }).toArray()
  return collections.length > 0
}

async function createCollectionIfMissing (db, collectionName) {
  if (await collectionExists(db, collectionName)) {
    return
  }

  try {
    await db.createCollection(collectionName)
  } catch (err) {
    if (err.code === 48 || err.codeName === 'NamespaceExists') {
      return
    }
    throw err
  }
}

function keysMatch (actual, expected) {
  const actualKeys = Object.keys(actual)
  const expectedKeys = Object.keys(expected)

  return actualKeys.length === expectedKeys.length &&
    expectedKeys.every((key, index) => key === actualKeys[index] && actual[key] === expected[key])
}

async function createIndexIfMissing (db, { collectionName, key, options = {} }) {
  const existingIndexes = await db.collection(collectionName).indexes()
  const hasIndex = existingIndexes.some(index => keysMatch(index.key, key))

  if (!hasIndex) {
    await db.collection(collectionName).createIndex(key, options)
  }
}

module.exports = {
  async up (db, client) {
    for (const collectionName of COLLECTION_NAMES) {
      await createCollectionIfMissing(db, collectionName)
    }

    for (const index of INDEXES) {
      await createIndexIfMissing(db, index)
    }
  },

  async down (db, client) {
    // Intentionally no-op. Dropping application collections is too destructive
    // for a rollback in shared or production-like environments.
  }
}
