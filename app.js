// app.js
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import morgan from "morgan";
import connectDB from "./config/db.js";

dotenv.config();
const app = express();

// ✅ Allowed frontend origins
const allowedOrigins = [
  "https://fontflow-backend-vhnr.vercel.app", // Vercel frontend
  "http://localhost:3000" // local dev
];

// ✅ CORS middleware FIRST
app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);

// ✅ Handle preflight before hitting any routes
app.options("*", cors());

// ✅ Body parser
app.use(express.json());

// ✅ Logger
app.use(morgan("dev"));

// ✅ DB connection
connectDB();

// ✅ Routes
import authRoutes from "./routes/authRoutes.js";
import fontRoutes from "./routes/fontRoutes.js";
import projectRoutes from "./routes/projectsRoutes.js";

app.use("/api/auth", authRoutes);
app.use("/api/fonts", fontRoutes);
app.use("/api/projects", projectRoutes);

// ✅ Health check route
app.get("/", (req, res) => {
  res.send("FontFlow Backend is running 🚀");
});

// ✅ Start server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🌍 Allowed origins: ${allowedOrigins.join(", ")}`);
});
