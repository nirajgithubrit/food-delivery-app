const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.resolve(__dirname, ".env") });

const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const http = require("http");
const pinoHttp = require("pino-http");

const config = require("./config");
const logger = require("./utils/logger");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");
const { createSocketAuthMiddleware } = require("./middleware/socketAuth");
const { registerSocketHandlers } = require("./sockets/handlers");

const itemRoutes = require("./routes/itemRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const uploadRoutes = require("./routes/uploadRoutes");
const orderRoutes = require("./routes/orderRoutes");
const authRoutes = require("./routes/authRoutes");

const app = express();
const server = http.createServer(app);

// Dynamic API responses (orders/tracking) should never be browser-cached.
app.set("etag", false);

if (config.nodeEnv === "production") {
  app.set("trust proxy", 1);
}

app.use(
  pinoHttp({
    logger,
    autoLogging: { ignore: (req) => req.url === "/health" },
  }),
);

const io = require("socket.io")(server, {
  cors: {
    origin: config.allowedOrigins,
    credentials: true,
  },
  transports: ["websocket", "polling"],
});

io.use(createSocketAuthMiddleware());
registerSocketHandlers(io);

app.set("io", io);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || config.allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  }),
);

app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

app.get("/health", (req, res) => {
  res.status(200).json({ ok: true });
});

app.use("/api/orders", (req, res, next) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  next();
});

app.use("/api/auth", authRoutes);
app.use("/api/items", itemRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/orders", orderRoutes);

app.use(notFound);
app.use(errorHandler);

server.listen(config.port, () => {
  logger.info({ msg: "Server listening", port: config.port, env: config.nodeEnv });
});
