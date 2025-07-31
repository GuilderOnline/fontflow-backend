// app.js
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import morgan from "morgan";
import connectDB from "./config/db.js"; // ✅ Correct relative path

// Load environment variables
dotenv.config();

// Initialize app
const app = express();

// Middleware
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "*", // Allow frontend to connect
    credentials: true,
  })
);
app.use(express.json());
app.use(morgan("dev"));

// Connect to MongoDB
connectDB();

// Routes
import authRoutes from "./routes/authRoutes.js";
import fontRoutes from "./routes/fontRoutes.js";
import projectRoutes from "./routes/projectsRoutes.js";

// Mount routes
app.use("/api/auth", authRoutes);
app.use("/api/fonts", fontRoutes);
app.use("/api/projects", projectRoutes);

// Health check route
app.get("/", (req, res) => {
  res.send("FontFlow Backend is running 🚀");
});

// Start server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
