const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const itemRoutes = require("./routes/itemRoutes");
const orderRoutes = require("./routes/orderRoutes");
const authRoutes = require("./routes/authRoutes");
const Order = require("./models/order");

const app = express();
const http = require("http");
const server = http.createServer(app);

const io = require("socket.io")(server, {
  cors: { origin: "http://localhost:4200", credentials: true },
});

app.use(
  cors({
    origin: "http://localhost:4200",
    credentials: true,
  }),
);

app.use(express.json());
app.use(cookieParser());

// SOCKET
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // ✅ JOIN ROOM
  socket.on("join-order", (orderId) => {
    socket.join(orderId);
    console.log(`📦 Joined room: ${orderId}`);
  });

  socket.on("join-delivery", (id) => {
    socket.join(id);
    console.log(`📦 Joined Delivery: ${id}`);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });

  // 🔥 RECEIVE FROM DELIVERY
  socket.on("send-location", async (data) => {
    const { orderId, lat, lng } = data;

    const order = await Order.findByIdAndUpdate(
      orderId,
      {
        deliveryLocation: { lat, lng },
      },
      { returnDocument: "after" },
    );
    // 🔥 send ONLY location update
    io.to(orderId).emit("location-update", order);
  });
});

app.set("io", io);

// ROUTES
app.use("/api/auth", authRoutes);
app.use("/api/items", itemRoutes);
app.use("/api/orders", orderRoutes);

server.listen(3000, () => {
  console.log("Server running on port 3000");
});
