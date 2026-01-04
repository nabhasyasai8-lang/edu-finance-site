const crypto = require("crypto");
global.crypto = crypto;

const { app } = require("@azure/functions");

/* ---------- helpers ---------- */
function toNum(v) {
  const n = Number(String(v ?? "").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function normalizeHorizon(raw) {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/–/g, "-")
    .replace(/\s+/g, "");
}

function horizonBucket(raw) {
  const h = normalizeHorizon(raw);
  if (h.includes("5y+") || h.includes("5+")) return "long";
  if (h.includes("2-5")) return "mid";
  return "short";
}

/* Simple definitions to send to user */
function investmentDefinitions() {
  return {
    fd: "FD (Fixed Deposit): You keep money in a bank for a fixed time and get a fixed interest. Low risk, predictable returns.",
    fixedDeposit:
      "Fixed Deposit: Same as FD. Bank deposit for a fixed period with fixed interest.",
    mutualFunds:
      "Mutual Funds: A pool of money from many people that a professional manager invests in shares/bonds. Returns can go up or down.",
    sip: "SIP (Systematic Investment Plan): Investing a fixed amount regularly (usually monthly) into a mutual fund. Helps build habit and reduces timing risk."
  };
}

function buildResult(d) {
  const income = toNum(d.income);
  const expenses = toNum(d.expenses);
  const savings = toNum(d.savings);

  const surplus = income - expenses;
  const bucket = horizonBucket(d.timeHorizon);

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
    if (bucket === "long") recommended = options[2];
    else if (bucket === "mid") recommended = options[1];
    else recommended = options[0];
  }

  return {
    income,
    expenses,
    savings,
    surplus,
    timeHorizonBucket: bucket,
    options,
    recommended,
    definitions: investmentDefinitions() // ✅ simple definitions included
  };
}

/* ---------- HTTP trigger ---------- */
app.http("httpTrigger1", {
  methods: ["GET", "POST"],
  authLevel: "anonymous",
  handler: async (request) => {
    if (request.method === "GET") {
      return { jsonBody: { ok: true, message: "API is running (rule-based)" } };
    }

    const data = await request.json().catch(() => ({}));
    const result = buildResult(data);

    return { jsonBody: { ok: true, result } };
  }
});

