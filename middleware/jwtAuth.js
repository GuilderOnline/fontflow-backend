// middleware/jwtAuth.js
import jwt from "jsonwebtoken";
import User from "../models/userModel.js";

export const jwtAuth = async (req, res, next) => {
  // ✅ Allow OPTIONS preflight to pass without token check
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Missing or malformed token" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // ✅ Double-check user exists
    const user = await User.findById(decoded.id || decoded.userId).select("-password");
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    req.user = {
      id: user._id.toString(),
      role: user.role
    };

    next();
  } catch (err) {
    console.error("❌ JWT verification failed:", err.message);
    res.status(401).json({ message: "Invalid token" });
  }
};
