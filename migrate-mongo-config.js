require('dotenv').config()

const config = require('config')

const appEnv = process.env.NODE_ENV || 'development'

const TLS_ENABLED = appEnv === 'development' ? false : true;
const USE_AWS = appEnv === 'development' ? false : true;


function getConfiguredValue (key) {
  const configPath = `${appEnv}.${key}`
  return config.has(configPath) ? config.get(configPath) : null
}

function getMongoConnectionString () {
  if (process.env.MONGO_CONN_STRING) {
    return process.env.MONGO_CONN_STRING
  }

  const dbUser = process.env.MONGO_USER || getConfiguredValue('username')
  const dbPassword = process.env.MONGO_PASSWORD || getConfiguredValue('password')
  const dbHost = process.env.MONGO_HOST || getConfiguredValue('host')
  const dbPort = process.env.MONGO_PORT || getConfiguredValue('port')
  const dbName = getMongoDatabaseName()
  const dbLoginPrepend = dbUser && dbPassword ? `${dbUser}:${dbPassword}@` : ''

  if (USE_AWS) {
    return `mongodb://${dbLoginPrepend}${dbHost}:${dbPort}/${dbName}?replicaSet=rs0&readPreference=secondaryPreferred&retryWrites=false`
  }

  return `mongodb://${dbLoginPrepend}${dbHost}:${dbPort}/${dbName}`
}

function getDatabaseNameFromUri () {
  if (!process.env.MONGO_CONN_STRING) {
    return null
  }

  try {
    const uri = new URL(process.env.MONGO_CONN_STRING)
    const databaseName = uri.pathname.replace(/^\//, '')
    return databaseName || null
  } catch (err) {
    return null
  }
}

function getMongoDatabaseName () {
  return process.env.MONGO_DB_NAME || getDatabaseNameFromUri() || getConfiguredValue('database')
}

function getMongoConnectionOptions () {
  if (USE_AWS) {
    return {
      authMechanism: 'SCRAM-SHA-1',
      tls: TLS_ENABLED
    }
  }

  return {
    tls: TLS_ENABLED
  }
}

const migrationConfig = {
  mongodb: {
    url: getMongoConnectionString(),
    databaseName: getMongoDatabaseName(),
    options: getMongoConnectionOptions()
  },
  migrationsDir: 'migrations',
  changelogCollectionName: 'migrations_changelog',
  lockCollectionName: 'migrations_changelog_lock',
  lockTtl: 0,
  migrationFileExtension: '.js',
  useFileHash: false,
  moduleSystem: 'commonjs'
}

module.exports = migrationConfig
