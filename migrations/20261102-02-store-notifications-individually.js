const { calculateObjectSize } = require('bson')
const { isDeepStrictEqual } = require('util')

const LEGACY = 'Notification'
const ENTRIES = 'NotificationEntry'
const BACKUP = 'NotificationEntryRollback'
const PROGRESS = 'NotificationEntryMigration'
const MAX_DOCUMENT_BYTES = 16 * 1024 * 1024

async function ensureCollection (db, name) {
  try {
    await db.createCollection(name)
  } catch (error) {
    if (error.code !== 48 && error.codeName !== 'NamespaceExists') throw error
  }
}

function normalizeEntry (entry) {
  if (!entry || typeof entry.UUID !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(entry.UUID) ||
      Object.hasOwn(entry, 'user_uuid') ||
      typeof entry.body !== 'string' || !entry.body ||
      !['PRIVATE_MESSAGE', 'PUBLIC_MESSAGE'].includes(entry.type) ||
      !entry.created_at || Number.isNaN(new Date(entry.created_at).getTime()) ||
      (entry.links && (typeof entry.links !== 'object' || Array.isArray(entry.links))) ||
      (entry.links?.org_shortname !== undefined && typeof entry.links.org_shortname !== 'string') ||
      (entry.links?.user_shortname !== undefined && typeof entry.links.user_shortname !== 'string')) {
    throw new Error('Notification migration found an invalid entry; repair the source inbox before retrying')
  }
  const normalized = {
    UUID: entry.UUID,
    body: entry.body,
    type: entry.type,
    links: { org_shortname: '', user_shortname: '', ...entry.links },
    created_at: new Date(entry.created_at)
  }
  return normalized
}

async function inspectInbox (entries, inbox) {
  if (typeof inbox.user_uuid !== 'string' || !inbox.user_uuid || !Array.isArray(inbox.notifications)) {
    throw new Error('Notification migration found an invalid inbox; no inbox data was changed')
  }
  const seen = new Set()
  for (const raw of inbox.notifications) {
    const entry = normalizeEntry(raw)
    if (seen.has(entry.UUID)) throw new Error('Notification migration found duplicate entry UUIDs in an inbox; no entries will be discarded')
    seen.add(entry.UUID)
    const existing = await entries.findOne({ user_uuid: inbox.user_uuid, UUID: entry.UUID })
    if (existing) {
      const { _id, user_uuid: userUUID, ...stored } = existing
      if (!isDeepStrictEqual(stored, entry)) throw new Error('Notification migration found conflicting existing entry data; resolve the conflict before retrying')
    }
  }
}

async function * recipientUUIDs (db) {
  const seen = new Set()
  for await (const inbox of db.collection(LEGACY).find({}, { projection: { user_uuid: 1 } }).batchSize(100)) {
    seen.add(inbox.user_uuid)
    yield inbox.user_uuid
  }
  for await (const recipient of db.collection(ENTRIES).aggregate([{ $group: { _id: '$user_uuid' } }], { batchSize: 100 })) {
    if (!seen.has(recipient._id)) yield recipient._id
  }
}

async function rebuildInbox (db, userUUID) {
  const inbox = await db.collection(LEGACY).findOne({ user_uuid: userUUID }, { projection: { notifications: 0 } }) || { user_uuid: userUUID }
  inbox.notifications = []
  // Migration clients and application test clients may use different BSON
  // major versions. Keep their own _id instance for writes; size ObjectIds as
  // their fixed BSON representation without passing it to another serializer.
  const { _id, ...plainInbox } = inbox
  const idBytes = !_id || _id._bsontype === 'ObjectId' ? 17 : calculateObjectSize({ _id }) - 5
  let bytes = calculateObjectSize(plainInbox) + idBytes
  for await (const stored of db.collection(ENTRIES).find({ user_uuid: userUUID }).sort({ created_at: 1, _id: 1 }).batchSize(1)) {
    const { _id, user_uuid: recipient, ...entry } = stored
    bytes += 1 + Buffer.byteLength(String(inbox.notifications.length)) + 1 + calculateObjectSize(entry)
    if (bytes > MAX_DOCUMENT_BYTES) throw new Error('Notification rollback would exceed the 16 MiB legacy inbox limit; keep the new application and export/reconcile retained notifications before rollback')
    inbox.notifications.push(entry)
  }
  return inbox
}

module.exports = {
  async up (db) {
    // DocumentDB requires collections and indexes to exist before transactions.
    await ensureCollection(db, ENTRIES)
    await ensureCollection(db, PROGRESS)
    const entries = db.collection(ENTRIES)
    await entries.createIndex({ user_uuid: 1, UUID: 1 }, { unique: true })
    await entries.createIndex({ user_uuid: 1, created_at: -1, _id: 1 })
    const progress = db.collection(PROGRESS)

    // Validate all source data before copying any inbox. Writers must remain
    // stopped for both passes; never normalize a conflict by dropping entries.
    const recipients = new Set()
    for await (const inbox of db.collection(LEGACY).find({}).batchSize(1)) {
      if (recipients.has(inbox.user_uuid)) throw new Error('Notification migration found duplicate recipient inboxes; resolve them without discarding entries before retrying')
      recipients.add(inbox.user_uuid)
      if (await progress.findOne({ _id: inbox.user_uuid, complete: true })) continue
      await inspectInbox(entries, inbox)
    }
    for await (const inbox of db.collection(LEGACY).find({}).batchSize(1)) {
      if (await progress.findOne({ _id: inbox.user_uuid, complete: true })) continue
      for (const raw of inbox.notifications) {
        const entry = normalizeEntry(raw)
        await entries.updateOne({ user_uuid: inbox.user_uuid, UUID: entry.UUID }, {
          $setOnInsert: { user_uuid: inbox.user_uuid, ...entry }
        }, { upsert: true })
      }
      // Set only after the whole inbox is copied. Completed inboxes are skipped
      // on reruns so dismissals in the new application cannot be resurrected.
      // Keep progress separate: adding even one marker to a full legacy inbox
      // can itself exceed the document limit and strand the migration.
      await progress.updateOne({ _id: inbox.user_uuid }, { $set: { complete: true } }, { upsert: true })
    }
  },

  async down (db) {
    if (!(await db.listCollections({ name: ENTRIES }).toArray()).length) return
    // Preflight every recipient before changing any legacy inbox. The reverse
    // representation is not always possible once new history exceeds 16 MiB.
    for await (const userUUID of recipientUUIDs(db)) await rebuildInbox(db, userUUID)
    await ensureCollection(db, LEGACY)
    await db.collection(LEGACY).createIndex({ user_uuid: 1 }, { unique: true })
    await ensureCollection(db, BACKUP)
    await db.collection(BACKUP).createIndex({ user_uuid: 1, UUID: 1 }, { unique: true })
    // Retain an immutable record backup as well as the rebuilt legacy inboxes.
    for await (const entry of db.collection(ENTRIES).find({}).batchSize(1)) {
      const { _id, ...notification } = entry
      await db.collection(BACKUP).updateOne({ user_uuid: entry.user_uuid, UUID: entry.UUID }, { $setOnInsert: notification }, { upsert: true })
    }
    for await (const userUUID of recipientUUIDs(db)) {
      const inbox = await rebuildInbox(db, userUUID)
      await db.collection(LEGACY).replaceOne({ user_uuid: userUUID }, inbox, { upsert: true })
    }
    // Last step only, after successful copies. Repeated down is a no-op; a
    // later up starts from the then-current legacy data, not stale dismissed IDs.
    try {
      await db.collection(PROGRESS).drop()
    } catch (error) {
      if (error.code !== 26 && error.codeName !== 'NamespaceNotFound') throw error
    }
    await db.collection(ENTRIES).drop()
  }
}
