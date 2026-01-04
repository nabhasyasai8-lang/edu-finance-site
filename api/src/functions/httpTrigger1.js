const { app } = require("@azure/functions");

function toNum(v) {
  const n = Number(String(v ?? "").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function buildResult(d) {
  const income = toNum(d.income);
  const expenses = toNum(d.expenses);
  const savings = toNum(d.savings);
  const surplus = income - expenses;
  const timeHorizon = String(d.timeHorizon || "");
  const emergencyMonths = expenses > 0 ? savings / expenses : 0;

  const options = [
    {
      title: "Safe Plan",
      risk: "Low",
      instruments: ["FD (Fixed Deposit)"],
      allocation: "Emergency + short‑term goals in FD",
      why: "Capital protection. Suitable only for short horizons."
    },
    {
      title: "Balanced Plan",
      risk: "Medium",
      instruments: ["FD", "SIP (Mutual Funds)"],
      allocation: "60% SIP, 40% FD",
      why: "Moderate growth with controlled volatility."
    },
    {
      title: "Growth Plan",
      risk: "High",
      instruments: ["SIP (Equity Mutual Funds)"],
      allocation: "100% SIP (Equity‑oriented)",
      why: "Maximizes long‑term wealth creation over 5+ years."
    }
  ];

  let recommended;

  // 🚫 Rule 1: No surplus → no investing
  if (surplus <= 0) {
    const stabilityPlan = {
      title: "Stability Plan",
      risk: "Very Low",
      instruments: ["Budgeting", "Emergency Buffer"],
      allocation: "Reduce expenses and create surplus first",
      why:
        "Investing is not possible without surplus. Focus on cash‑flow stability."
    };
    options.unshift(stabilityPlan);
    recommended = stabilityPlan;
  }

  // 🚀 Rule 2: Profit‑first based on time horizon
  else {
    if (timeHorizon === "5y+") {
      recommended = options.find(p => p.title === "Growth Plan");
    } else if (timeHorizon === "2-5y") {
      recommended = options.find(p => p.title === "Balanced Plan");
    } else {
      recommended = options.find(p => p.title === "Safe Plan");
    }
  }

  return {
    income,
    expenses,
    savings,
    surplus,
    emergencyMonths,
    timeHorizon,
    options,
    recommended
  };
}

app.http("httpTrigger1", {
  methods: ["GET", "POST"],
  authLevel: "anonymous",
  handler: async (request) => {
    if (request.method === "GET") {
      return { jsonBody: { ok: true, message: "API is running" } };
    }

    const data = await request.json().catch(() => ({}));
    return { jsonBody: { ok: true, result: buildResult(data) } };
  },
});

