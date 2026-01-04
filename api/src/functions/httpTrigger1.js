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

  // 🚫 Rule 1: No surplus → no investing
  if (surplus <= 0) {
    recommended = {
      title: "Stability Plan",
      risk: "Very Low",
      instruments: ["Budgeting", "Emergency Buffer"],
      allocation: "Create surplus first",
      why:
        "Expenses are greater than or equal to income. Investing is not possible yet."
    };
    options.unshift(recommended);
  }
  // ⏱ Rule 2: Recommendation ONLY by time horizon (money-maximizing)
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
      return {
        jsonBody: {
          ok: true,
          message: "API is running. Use POST to get financial plans."
        }
      };
    }

    const data = await request.json().catch(() => ({}));
    return { jsonBody: { ok: true, result: buildResult(data) } };
  }
});

