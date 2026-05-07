function success(res, data, statusCode = 200) {
  return res.status(statusCode).json({ success: true, data });
}

function fail(res, message, statusCode = 400, extra = {}) {
  return res.status(statusCode).json({
    success: false,
    error: { message, ...extra },
  });
}

module.exports = { success, fail };
