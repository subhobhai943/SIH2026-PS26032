import mongoose from 'mongoose';

/**
 * Connects to MongoDB. Retries with a fixed backoff so the container can start
 * before Mongo is ready (docker-compose brings both up at once).
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
