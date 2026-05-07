const pino = require("pino");
const config = require("../config");

const logger = pino({
  level: process.env.LOG_LEVEL || (config.nodeEnv === "production" ? "info" : "debug"),
});

module.exports = logger;
