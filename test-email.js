const mongoose = require('mongoose');
const authService = require('./services/auth.service');
const emailService = require('./services/email.service');
require('dotenv').config();

async function testPasswordReset(email) {
  console.log(`\n--- TESTING PASSWORD RESET FOR: ${email} ---`);
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    const result = await authService.forgotPassword({ email });
    console.log('Result from AuthService:', result);
    
  } catch (error) {
    console.error('TEST ERROR:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB\n');
  }
}

// Replace with the email you are testing
const testEmail = process.argv[2] || 'roshann.work@gmail.com';
testPasswordReset(testEmail);
