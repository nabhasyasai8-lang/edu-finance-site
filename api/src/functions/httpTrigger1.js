const { app } = require("@azure/functions");

function toNum(v) {
  const n = Number(String(v ?? "").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function buildResult(d) {
  const income = toNum(d.income);
  const expenses = toNum(d.expenses);
  const savings = toNum(d.savings);
  const surplus = Math.max(0, income - expenses);

  const options = [
    {
      title: "Safe Plan",
      risk: "Low",
      instruments: ["FD (Fixed Deposit)"],
      allocation: "Emergency + short-term goals in FD",
      why: "Stable, predictable, low risk."
    },
    {
      title: "Balanced Plan",
      risk: "Medium",
      instruments: ["FD", "SIP (Mutual Funds)"],
      allocation: "60% FD, 40% SIP",
      why: "Mix of safety + growth."
    },
    {
      title: "Growth Plan",
      risk: "High",
      instruments: ["SIP (Equity Mutual Funds)"],
      allocation: "80% SIP, 20% FD",
      why: "Higher long-term growth, but ups/downs."
    }
  ];

  let recommended = options[1];
  if (savings < expenses * 3) recommended = options[0];
  else if (surplus >= income * 0.3) recommended = options[2];

  const education = {
    fd: "FD = Fixed Deposit. Bank gives fixed/guaranteed interest. Low risk.",
    sip: "SIP = investing a fixed amount monthly in mutual funds (good for long term).",
    creditScore: "Credit score affects loan interest rate. Higher score usually means cheaper loans."
  };

  return { income, expenses, savings, surplus, options, recommended, education };
}

app.http("httpTrigger1", {
  methods: ["POST"],
  authLevel: "anonymous",
  handler: async (request) => {
    const data = await request.json().catch(() => ({}));
    return { jsonBody: { ok: true, result: buildResult(data) } };
  },
});
