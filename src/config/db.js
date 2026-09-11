const mongoose = require('mongoose');

/**
 * Connects to MongoDB using the URI from the environment. Kept as a plain
 * async function (not wrapped in a class) since it has no state of its own
 * -- it's a one-shot bootstrap step, not a service.
 */
async function connectDB(uri) {
  mongoose.set('strictQuery', true);

  const conn = await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 5000,
  });

  console.log(`MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
  return conn;
}

async function disconnectDB() {
  await mongoose.disconnect();
}

module.exports = { connectDB, disconnectDB };
