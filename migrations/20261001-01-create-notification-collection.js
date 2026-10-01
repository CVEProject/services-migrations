const COLLECTION_NAME = 'Notification'

module.exports = {
  async up (db, client) {
    const collections = await db.listCollections({ name: COLLECTION_NAME }).toArray()
    if (collections.length === 0) {
      try {
        await db.createCollection(COLLECTION_NAME)
      } catch (err) {
        if (err.code !== 48 && err.codeName !== 'NamespaceExists') {
          throw err
        }
      }
    }

    const notifications = db.collection(COLLECTION_NAME)
    await notifications.createIndex({ user_uuid: 1 }, { unique: true })
    await notifications.createIndex({ user_uuid: 1, 'notifications.created_at': -1 })
  },

  async down (db, client) {
    try {
      await db.collection(COLLECTION_NAME).drop()
    } catch (err) {
      if (err.code !== 26 && err.codeName !== 'NamespaceNotFound') {
        throw err
      }
    }
  }
}
