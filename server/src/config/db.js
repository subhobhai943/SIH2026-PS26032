import mongoose from 'mongoose';

/**
 * Connects to MongoDB with retry backoff in case Mongo service is starting up.
 */
export async function connectDB(uri, { retries = 5, delayMs = 3000 } = {}) {
  mongoose.set('strictQuery', true);

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
      console.log(`[db] connected to ${mongoose.connection.name}`);
      return mongoose.connection;
    } catch (err) {
      console.error(`[db] connection attempt ${attempt}/${retries} failed: ${err.message}`);
      if (attempt === retries) throw err;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

export async function disconnectDB() {
  await mongoose.disconnect();
}
