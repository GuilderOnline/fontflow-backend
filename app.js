// app.js
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import morgan from "morgan";
import connectDB from "./config/db.js";

dotenv.config();
const app = express();

// ✅ Simple CORS - allows frontend & local dev
app.use(
  cors({
    origin: [
      "https://fontflow-backend-vhnr.vercel.app", // your Vercel frontend
      "http://localhost:3000" // local development
    ],
    credentials: true,
  })
);

// ✅ Parse JSON requests
app.use(express.json());

// ✅ Logger
app.use(morgan("dev"));

// ✅ Connect to DB
connectDB();

// ✅ Routes
import authRoutes from "./routes/authRoutes.js";
import fontRoutes from "./routes/fontRoutes.js";
import projectRoutes from "./routes/projectsRoutes.js";

app.use("/api/auth", authRoutes);
app.use("/api/fonts", fontRoutes);
app.use("/api/projects", projectRoutes);

// ✅ Health check
app.get("/", (req, res) => {
  res.send("FontFlow Backend is running 🚀");
});

// ✅ Start server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
