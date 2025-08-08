import mongoose from 'mongoose';

// Async function to connect to MongoDB using Mongoose
const connectDB = async () => {
  try {
    // Attempt to connect using environment variable for URI
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,      // Use new URL parser
      useUnifiedTopology: true,   // Use new server discovery and monitoring engine
    });
    // Log successful connection
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (err) {
    // Log error and exit process if connection fails
    console.error(`MongoDB Connection Error: ${err.message}`);
    process.exit(1);
  }
};

export default connectDB;