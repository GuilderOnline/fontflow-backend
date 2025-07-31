// app.js
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import morgan from "morgan";
import connectDB from "./config/db.js";

dotenv.config(); 
const app = express();

// 🔹 Allowed origins
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
  : [
      "http://localhost:3000",
      "https://fontflow-backend-vhnr.vercel.app"
    ];

// 🔹 CORS middleware (allow Authorization header!)
app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true); // Allow server tools
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"], // ✅
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"], // ✅
  })
);

// 🔹 Ensure preflight requests always pass
app.options("*", cors());

// 🔹 JSON parsing
app.use(express.json());

// 🔹 Logger
app.use(morgan("dev"));

// 🔹 Connect DB
connectDB();

// 🔹 Routes
import authRoutes from "./routes/authRoutes.js";
import fontRoutes from "./routes/fontRoutes.js";
import projectRoutes from "./routes/projectsRoutes.js";

app.use("/api/auth", authRoutes);
app.use("/api/fonts", fontRoutes); // ✅ Will now pass preflight
app.use("/api/projects", projectRoutes);

// 🔹 Health check
app.get("/", (req, res) => {
  res.send("FontFlow Backend is running 🚀");
});

// 🔹 Start
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🌍 Allowed origins: ${allowedOrigins.join(", ")}`);
});
