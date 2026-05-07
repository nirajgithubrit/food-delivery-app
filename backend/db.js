const mongoose = require("mongoose");
const config = require("./config");
const logger = require("./utils/logger");

mongoose
  .connect(config.mongoUri)
  .then(() => logger.info({ msg: "MongoDB connected" }))
  .catch((err) => logger.error({ msg: "MongoDB connection error", err: err.message }));

module.exports = mongoose;
