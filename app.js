import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import morgan from "morgan";
import connectDB from "./config/db.js";

dotenv.config();
const app = express();

// Allowed origins from environment (comma-separated)
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
  : ["http://localhost:3000"];

// CORS middleware
app.use(
  cors({
    origin: function (origin, callback) {
        console.log("Incoming request origin:", origin); // Debug log

      if (!origin) return callback(null, true); // allow Postman / curl
      if (allowedOrigins.includes(origin)) {
          console.log("CORS allowed for:", origin);

        return callback(null, true);
      }
      console.warn(`CORS blocked request from: ${origin}`);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

// Parse JSON requests
app.use(express.json());

// Logger
app.use(morgan("dev"));

// Connect to DB
connectDB();

// Routes
import authRoutes from "./routes/authRoutes.js";
import fontRoutes from "./routes/fontRoutes.js";
import projectRoutes from "./routes/projectsRoutes.js";

app.use("/api/auth", authRoutes);
app.use("/api/fonts", fontRoutes);
app.use("/api/projects", projectRoutes);

// Health check
app.get("/", (req, res) => {
  res.send("FontFlow Backend is running 🚀");
});

// Start server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`🌍 Allowed origins: ${allowedOrigins.join(", ")}`);
});
