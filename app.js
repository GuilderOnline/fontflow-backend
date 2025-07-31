// app.js
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import morgan from "morgan";
import connectDB from "./config/db.js";

dotenv.config();
const app = express();

// ✅ CORS must be FIRST middleware
const allowedOrigins = [
  "https://fontflow-backend-vhnr.vercel.app", // your Vercel frontend
  "http://localhost:3000" // local dev
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like curl, mobile apps)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true, // allow cookies/auth headers
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

// ✅ Explicitly handle preflight requests
app.options("*", cors());

// Body parser
app.use(express.json());

// Logger
app.use(morgan("dev"));

// DB connection
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
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🌍 Allowed origins: ${allowedOrigins.join(", ")}`);
});
