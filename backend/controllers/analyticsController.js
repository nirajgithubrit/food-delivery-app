const Order = require("../models/order");
const ApiResponse = require("../utils/apiResponse");
const asyncHandler = require("../middleware/asyncHandler");
const AppError = require("../utils/AppError");

function parseRange(query) {
  const now = new Date();
  const to = query.to ? new Date(String(query.to)) : now;
  let from = query.from ? new Date(String(query.from)) : new Date(to);
  if (!query.from) {
    from.setDate(from.getDate() - 30);
  }
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new AppError("Invalid date range", 400);
  }
  return { from, to };
}

exports.getOverview = asyncHandler(async (req, res) => {
  if (req.user.role !== "admin") {
    throw new AppError("Forbidden", 403);
  }

  const { from, to } = parseRange(req.query);

  const baseMatch = { createdAt: { $gte: from, $lte: to } };

  const [statusCounts, revenueAgg, daily, topItems, hourly] = await Promise.all([
    Order.aggregate([
      { $match: baseMatch },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    Order.aggregate([
      { $match: { ...baseMatch, status: "delivered" } },
      { $group: { _id: null, revenue: { $sum: "$totalAmount" }, count: { $sum: 1 } } },
    ]),
    Order.aggregate([
      { $match: baseMatch },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          orders: { $sum: 1 },
          revenue: {
            $sum: { $cond: [{ $eq: ["$status", "delivered"] }, "$totalAmount", 0] },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Order.aggregate([
      { $match: baseMatch },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.name",
          qty: { $sum: "$items.qty" },
          revenue: { $sum: { $multiply: ["$items.price", "$items.qty"] } },
        },
      },
      { $sort: { qty: -1 } },
      { $limit: 12 },
    ]),
    Order.aggregate([
      { $match: baseMatch },
      {
        $group: {
          _id: { $hour: "$createdAt" },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
  ]);

  const byStatus = statusCounts.reduce((acc, row) => {
    acc[row._id] = row.count;
    return acc;
  }, {});

  const totalOrders = Object.values(byStatus).reduce((a, b) => a + b, 0);
  const revenueRow = revenueAgg[0] || { revenue: 0, count: 0 };

  ApiResponse.success(res, {
    range: { from, to },
    totals: {
      orders: totalOrders,
      revenue: revenueRow.revenue || 0,
      deliveredOrders: revenueRow.count || 0,
      activeDeliveries: (byStatus.out_for_delivery || 0) + (byStatus.picked_up || 0),
      rejected: byStatus.rejected || 0,
    },
    byStatus,
    dailyTrend: daily.map((d) => ({
      date: d._id,
      orders: d.orders,
      revenue: d.revenue,
    })),
    topItems: topItems.map((t) => ({
      name: t._id,
      qty: t.qty,
      revenue: t.revenue,
    })),
    peakHours: hourly.map((h) => ({ hour: h._id, orders: h.count })),
  });
});
