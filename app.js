// fontflow-backend/app.js
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import morgan from "morgan";
import connectDB from "./config/db.js";
import multer from "multer";

import { uploadFont } from "./controllers/fontController.js";
import fileType from 'file-type';
import pkg from 'file-type/package.json' assert { type: 'json' };

console.log("📦 file-type version on Render:", pkg.version);
console.log("📦 file-type keys:", Object.keys(fileType));

// Load environment variables
dotenv.config();

// Create Express app
const app = express();

// Middleware
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "*", // Allow frontend to connect
    credentials: true
  })
);
app.use(express.json());
app.use(morgan("dev"));

// Connect to MongoDB
connectDB();

// ✅ Multer setup: Use memory storage (no local files)
const upload = multer({ storage: multer.memoryStorage() });

// Routes
import authRoutes from "./routes/authRoutes.js";
import fontRoutes from "./routes/fontRoutes.js";
import projectRoutes from "./routes/projectsRoutes.js";

app.use("/api/auth", authRoutes);
app.use("/api/fonts", fontRoutes);
app.use("/api/projects", projectRoutes);

// ✅ Direct font upload route using Multer + Controller
app.post("/api/fonts/upload", upload.single("font"), uploadFont);

// Health check
app.get("/", (req, res) => {
  res.send("FontFlow Backend is running 🚀");
});

// Start server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
