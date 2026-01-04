const { app } = require("@azure/functions");

function toNum(v) {
  const n = Number(String(v ?? "").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function buildResult(d) {
  const income = toNum(d.income);
  const expenses = toNum(d.expenses);
  const savings = toNum(d.savings);

  // IMPORTANT: keep actual surplus (can be negative)
  const surplusRaw = income - expenses;

  // Time horizon from frontend (dropdown values: 0-6m, 6-24m, 2-5y, 5y+)
  const timeHorizon = String(d.timeHorizon || "");

  const emergencyMonths = expenses > 0 ? savings / expenses : 0;

  const options = [
    {
      title: "Safe Plan",
      risk: "Low",
      instruments: ["FD (Fixed Deposit)"],
      allocation: "Emergency + short-term goals in FD",
      why: "Stable, predictable, low risk. Best for short horizons."
    },
    {
      title: "Balanced Plan",
      risk: "Medium",
      instruments: ["FD", "SIP (Mutual Funds)"],
      allocation: "60% FD, 40% SIP",
      why: "Mix of safety + growth. Good for mid-term goals."
    },
    {
      title: "Growth Plan",
      risk: "High",
      instruments: ["SIP (Equity Mutual Funds)"],
      allocation: "80% SIP, 20% FD",
      why: "Higher long-term growth, but short-term ups/downs."
    }
  ];

  let recommended;

  // Gate 1: if no surplus, investing is not possible
  if (surplusRaw <= 0) {
    const stabilityPlan = {
      title: "Stability Plan",
      risk: "Very Low",
      instruments: ["Budgeting", "Emergency Buffer"],
      allocation: "No investing yet (create surplus first)",
      why:
        "If expenses are equal to (or more than) income, investing isn't possible. First create a small monthly buffer."
    };
    options.unshift(stabilityPlan);
    recommended = stabilityPlan;
  }
  // Gate 2: if emergency buffer is extremely low AND horizon isn't long, stay safe
  else if (emergencyMonths < 1 && timeHorizon !== "5y+") {
    recommended = options.find(p => p.title === "Safe Plan");
  }
  // Profit-first by time horizon (max growth within suitable horizon)
  else {
    if (timeHorizon === "5y+") recommended = options.find(p => p.title === "Growth Plan");
    else if (timeHorizon === "2-5y") recommended = options.find(p => p.title === "Balanced Plan");
    else recommended = options.find(p => p.title === "Safe Plan"); // 0-6m or 6-24m
  }

  const education = {
    fd: "FD = Fixed Deposit. Bank gives fixed/guaranteed interest. Low risk.",
    sip: "SIP = investing a fixed amount monthly in mutual funds (good for long term).",
    creditScore: "Credit score affects loan interest rate. Higher score usually means cheaper loans."
  };

  return {
    income,
    expenses,
    savings,
    surplus: surplusRaw,      // show real surplus (can be negative)
    emergencyMonths,
    timeHorizon,
    options,
    recommended,
    education
  };
}

app.http("httpTrigger1", {
  methods: ["GET", "POST"],
  authLevel: "anonymous",
  handler: async (request) => {
    if (request.method === "GET") {
      return { jsonBody: { ok: true, message: "API is running. Use POST to get plans." } };
    }

    const data = await request.json().catch(() => ({}));
    return { jsonBody: { ok: true, result: buildResult(data) } };
  },
});
