// seeder.js

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import User from './models/userModel.js';

dotenv.config();

const seedUsers = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    await User.deleteMany();

    const users = [
      {
        username: 'admin@fontflow.com',
        password: await bcrypt.hash('admin123', 10),
        role: 'admin',
      },
      {
        username: 'user1@fontflow.com',
        password: await bcrypt.hash('user123', 10),
        role: 'user',
      },
    ];

    await User.insertMany(users);
    console.log('✅ Seeded users successfully');
    process.exit();
  } catch (err) {
    console.error('❌ Seeder failed:', err);
    process.exit(1);
  }
};

seedUsers();
