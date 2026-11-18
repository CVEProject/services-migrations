import { parseArgs } from 'node:util';
import { open } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { BSON, MongoClient } from 'mongodb';

async function main() {
  const { values } = parseArgs({
    options: {
      username: { type: 'string' },
      uuid: { type: 'string' },
      help: { type: 'boolean' }
    }
  });

  if (values.help) {
    console.log('Usage: npm run db:user-log -- --username <username> [--uuid <UUID>]');
    console.log('Provide --username, --uuid, or both.');
    console.log('Shows matching collections and writes full records to scripts/specific_user_log-<timestamp>-<pid>.jsonl.');
    return;
  }

  const username = values.username;
  const userUUID = values.uuid;
  const names = username ? [username] : [];
  const uuids = userUUID ? [userUUID] : [];

  if (!names.length && !uuids.length) {
    throw new Error('Provide --username or --uuid.');
  }

  const { default: config } = await import('../migrate-mongo-config.js');
  const { url, databaseName, options } = config.mongodb;
  if (!databaseName) {
    throw new Error('Set MONGO_DB_NAME or provide a database in MONGO_CONN_STRING.');
  }

  const client = new MongoClient(url, options);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputPath = fileURLToPath(new URL(`./specific_user_log-${timestamp}-${process.pid}.jsonl`, import.meta.url));
  let output;
  try {
    await client.connect();
    const db = client.db(databaseName);
    const collections = (await db.listCollections({}, { nameOnly: true }).toArray())
      .map(collection => collection.name);

    // Resolve identities from current and legacy user records.
    for (const collection of ['BaseUser', 'User']) {
      if (!collections.includes(collection)) continue;

      const conditions = [];
      if (username) conditions.push({ username });
      if (userUUID) conditions.push({ UUID: userUUID });

      const users = db.collection(collection).find(
        { $or: conditions },
        { projection: { UUID: 1, username: 1 } }
      );
      for await (const user of users) {
        if (user.UUID && !uuids.includes(user.UUID)) uuids.push(user.UUID);
        if (user.username && !names.includes(user.username)) names.push(user.username);
      }
    }

    // Collection, UUID reference paths, username reference paths.
    const checks = [
      ["Cve", ["cve.cveMetadata.requesterUserId"], []],
      ["Cve-Id", ["requested_by.user"], []],
      ["BaseUser", ["UUID"], ["username"]],
      ["User", ["UUID"], ["username"]],
      ["BaseOrg", ["users", "admins"], []],
      ["Org", ["users", "admins"], []],
      ["Conversation", ["author_id", "target_uuid"], []],
      ["ReviewObject",
        ["new_review_data.users", "new_review_data.admins"],
        ["requester.username", "approver.username", "rejector.username"]],
      ["Audit",
        ["history.change_author",
         "history.audit_object.users",
         "history.audit_object.admins"], []],
      ["NotificationEntry", ["user_uuid"], ["links.user_shortname"]],
      ["Notification", ["user_uuid"], ["notifications.links.user_shortname"]],
      ["NotificationEntryRollback", ["user_uuid"], ["links.user_shortname"]],
      ["NotificationEntryMigration", ["_id"], []]
    ];

    output = await open(outputPath, 'wx');
    for (const [collection, uuidPaths, usernamePaths] of checks) {
      if (!collections.includes(collection)) continue;

      const conditions = [];
      if (uuids.length) {
        for (const path of uuidPaths) conditions.push({ [path]: { $in: uuids } });
      }
      if (names.length) {
        for (const path of usernamePaths) conditions.push({ [path]: { $in: names } });
      }
      if (!conditions.length) continue;

      const filter = { $or: conditions };
      let count = 0;
      const records = db.collection(collection).find(filter, { promoteValues: false });
      for await (const record of records) {
        await output.writeFile(BSON.EJSON.stringify({ collection, record }, { relaxed: false }) + '\n');
        count++;
      }
      if (count > 0) {
        console.log(JSON.stringify({ collection, count, filter }));
      }
    }
    await output.close();
    output = undefined;
    console.log(`Full records written to ${outputPath}`);
  } catch (error) {
    if (output) console.error(`Incomplete results may be present in ${outputPath}`);
    throw error;
  } finally {
    try {
      if (output) await output.close();
    } finally {
      await client.close();
    }
  }
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
