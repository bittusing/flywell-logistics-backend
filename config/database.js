const mongoose = require('mongoose');

/**
 * Database connection configuration
 */
const connectDB = async (retryCount = 0) => {
  const MAX_RETRIES = 5;
  const RETRY_INTERVAL = 5000; // 5 seconds

  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/onedelivery');

    console.log(`✅ MongoDB connected: ${conn.connection.host}`);
    
    // Handle connection events
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('⚠️  MongoDB disconnected. Attempting to reconnect...');
      // Mongoose handles reconnection automatically in most cases, 
      // but we log it here for visibility.
    });

    mongoose.connection.on('reconnected', () => {
      console.log('♻️  MongoDB reconnected');
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('MongoDB connection closed through app termination');
      process.exit(0);
    });

  } catch (error) {
    console.error(`❌ MongoDB connection error (Attempt ${retryCount + 1}/${MAX_RETRIES}):`, error.message);
    
    if (retryCount < MAX_RETRIES) {
      console.log(`⏱️ Retrying in ${RETRY_INTERVAL / 1000} seconds...`);
      setTimeout(() => connectDB(retryCount + 1), RETRY_INTERVAL);
    } else {
      console.error('💥 Could not connect to MongoDB after maximum retries. Exiting...');
      process.exit(1);
    }
  }
};

module.exports = connectDB;
