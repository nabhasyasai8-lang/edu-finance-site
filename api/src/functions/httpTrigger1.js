const { app } = require("@azure/functions");

function toNum(v) {
  const n = Number(String(v ?? "").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function normalizeHorizon(raw) {
  // Handles: "5y+", "5Y+", "5+ years", "0–6M", "0-6m", etc.
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/–/g, "-")      // convert en-dash to hyphen
    .replace(/\s+/g, "");   // remove spaces
}

function horizonBucket(raw) {
  const h = normalizeHorizon(raw);

  // long
  if (h === "5y+" || h === "5+y" || h.includes("5y+") || h.includes("5+")) return "long";

  // medium
  if (h === "2-5y" || h === "2–5y" || h.includes("2-5")) return "mid";

  // short (includes 0-6m, 6-24m, empty, unknown)
  return "short";
}

function buildResult(d) {
  const income = toNum(d.income);
  const expenses = toNum(d.expenses);
  const savings = toNum(d.savings);

  const surplus = income - expenses;
  const timeHorizonRaw = d.timeHorizon;               // whatever HTML sends
  const bucket = horizonBucket(timeHorizonRaw);

  const options = [
    {
      title: "Safe Plan",
      risk: "Low",
      instruments: ["FD (Fixed Deposit)"],
      allocation: "100% FD",
      why: "Capital protection. Suitable for short-term needs."
    },
    {
      title: "Balanced Plan",
      risk: "Medium",
      instruments: ["FD", "SIP (Mutual Funds)"],
      allocation: "40% FD, 60% SIP",
      why: "Better growth than FD with some stability."
    },
    {
      title: "Growth Plan",
      risk: "High",
      instruments: ["SIP (Equity Mutual Funds)"],
      allocation: "100% SIP",
      why: "Highest long-term wealth creation potential."
    }
  ];

  let recommended;

  // Rule 1: No surplus => no investing
  if (surplus <= 0) {
    recommended = {
      title: "Stability Plan",
      risk: "Very Low",
      instruments: ["Budgeting", "Emergency Buffer"],
      allocation: "Create surplus first",
      why: "Expenses are greater than or equal to income. Investing is not possible yet."
    };
    options.unshift(recommended);
  } else {
    // Rule 2: ONLY by time horizon (money-maximizing)
    if (bucket === "long") recommended = options.find(p => p.title === "Growth Plan");
    else if (bucket === "mid") recommended = options.find(p => p.title === "Balanced Plan");
    else recommended = options.find(p => p.title === "Safe Plan");
  }

  return {
    income,
    expenses,
    savings,
    surplus,
    timeHorizon: String(timeHorizonRaw ?? ""),
    horizonBucket: bucket, // helpful for debugging
    options,
    recommended
  };
}

app.http("httpTrigger1", {
  methods: ["GET", "POST"],
  authLevel: "anonymous",
  handler: async (request) => {
    if (request.method === "GET") {
      return { jsonBody: { ok: true, message: "API is running. Use POST to get financial plans." } };
    }
    const data = await request.json().catch(() => ({}));
    return { jsonBody: { ok: true, result: buildResult(data) } };
  }
});

