const { TextAnalyticsClient, AzureKeyCredential } = require("@azure/ai-text-analytics");
global.crypto = global.crypto || require("crypto");

function toNum(v) {
  const n = Number(String(v ?? "").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

function analyzeNumbers(income, expenses, savings) {
  const surplus = income - expenses;
  const savingsRate = income > 0 ? (surplus / income) : 0;
  const runwayMonths = expenses > 0 ? (savings / expenses) : 0;

  return {
    surplus,
    savingsRate,
    runwayMonths,
    savingsRatePct: Math.round(clamp(savingsRate * 100, -999, 999))
  };
}

function pickStage({ income, expenses, savings, surplus, savingsRate, runwayMonths }) {
  // Simple, explainable rules (good for viva)
  if (income <= 0) {
    return { label: "No Income Recorded", meaning: "Please enter a valid monthly income so we can assess your situation." };
  }
  if (surplus <= 0) {
    return {
      label: "Survival Stage",
      meaning: "Your expenses are equal to or higher than your income. First goal is to create a monthly surplus (even a small one) before any investing."
    };
  }
  if (runwayMonths < 2) {
    return {
      label: "Stability Stage",
      meaning: "You have a surplus, but your emergency buffer is low. Priority: build 2–6 months of expenses in a safe place before aggressive investing."
    };
  }
  if (savingsRate < 0.2) {
    return {
      label: "Growth Stage",
      meaning: "You are stable, but your savings rate can improve. Focus on increasing savings rate + starting consistent long-term investments."
    };
  }
  return {
    label: "Wealth Building Stage",
    meaning: "You have surplus + buffer + a healthy savings rate. You can focus on long-term compounding and disciplined investing."
  };
}

function keywordFlags(text) {
  const t = String(text || "").toLowerCase();

  const has = (...words) => words.some(w => t.includes(w));

  return {
    debt: has("debt", "loan", "emi", "credit card"),
    jobLoss: has("job", "laid off", "unemployed", "salary stopped"),
    anxiety: has("stress", "worried", "anxious", "fear", "confused"),
    goalStudy: has("study", "college", "tuition", "education"),
    goalHouse: has("house", "home", "rent"),
    investing: has("invest", "sip", "mutual", "stock", "equity", "fd"),
    overspend: has("overspend", "shopping", "impulse", "spending too much")
  };
}

function buildPlans(stageLabel, flags) {
  // Core options (kept simple)
  const plans = [];

  // If debt/job loss/anxiety -> emphasize stability
  if (flags.debt) {
    plans.push({
      title: "Debt-First Plan",
      risk: "Very Low",
      instruments: ["Debt payoff (highest interest first)", "Budgeting", "Emergency Buffer"],
      allocation: "Pay high-interest debt first + build small buffer",
      why: "High-interest debt grows faster than most investments. Clearing it improves long-term stability."
    });
  }

  if (stageLabel === "Survival Stage") {
    plans.push({
      title: "Surplus Creation Plan",
      risk: "Very Low",
      instruments: ["Budgeting", "Expense cuts", "Mini emergency fund"],
      allocation: "Create surplus first (₹0 → ₹X per month)",
      why: "Before investing, your money system must stop leaking. Even a small monthly surplus changes everything."
    });
  }

  plans.push(
    {
      title: "Safe Plan",
      risk: "Low",
      instruments: ["FD (Fixed Deposit)", "Emergency Buffer"],
      allocation: "Emergency buffer first, then FD",
      why: "Best when goals are near-term or stability is priority."
    },
    {
      title: "Balanced Plan",
      risk: "Medium",
      instruments: ["FD (Fixed Deposit)", "SIP (Mutual Funds)"],
      allocation: "40% FD, 60% SIP",
      why: "Mix of safety and growth. Suitable for most beginners once a buffer exists."
    },
    {
      title: "Growth Plan",
      risk: "High",
      instruments: ["SIP (Equity Mutual Funds)"],
      allocation: "100% SIP (long-term)",
      why: "Higher long-term growth potential, but value fluctuates. Only after emergency fund is ready."
    }
  );

  // Recommended logic based on stage + flags
  let recommended = plans.find(p => p.title === "Safe Plan");

  if (flags.debt) recommended = plans.find(p => p.title === "Debt-First Plan") || recommended;

  if (stageLabel === "Survival Stage") {
    recommended = plans.find(p => p.title === "Surplus Creation Plan") || recommended;
  } else if (stageLabel === "Stability Stage") {
    recommended = plans.find(p => p.title === "Safe Plan") || recommended;
  } else if (stageLabel === "Growth Stage") {
    recommended = plans.find(p => p.title === "Balanced Plan") || recommended;
  } else if (stageLabel === "Wealth Building Stage") {
    recommended = plans.find(p => p.title === "Growth Plan") || recommended;
  }

  return { options: plans, recommended };
}

function educationBlock(result) {
  // Definitions (international, simple-professional)
  const defs = [
    "FD (Fixed Deposit): A bank product where you lock money for a fixed time and earn a guaranteed interest. Low risk, usually lower returns.",
    "SIP (Systematic Investment Plan): Investing a fixed amount regularly (e.g., monthly) into a mutual fund. Helps build discipline and long-term wealth.",
    "Mutual Fund: A pool of money managed by professionals that invests in many assets (stocks/bonds). Diversification reduces risk vs single-stock bets.",
    "Emergency Fund: Cash set aside for unexpected events (medical, job loss). Common target: 2–6 months of expenses in a safe place.",
    "Asset vs Liability (Rich Dad Poor Dad idea): Assets put money in your pocket, liabilities take money out. Wealthy people try to buy assets first."
  ];

  // Book-inspired principles (summaries only)
  const principles = [
    "Principle: Spend less than you earn (The Richest Man in Babylon). → Surplus is the fuel for all progress.",
    "Principle: Consistency beats intensity (Atomic Habits). → Small monthly actions (like SIP) beat random big decisions.",
    "Principle: Control behavior, not just math (The Psychology of Money). → Staying calm and consistent matters more than chasing quick wins."
  ];

  const rec = result.recommended;
  const whatNext = [
    `What successful people do: They protect downside first (buffer), then invest consistently for years (compounding).`,
    `What you should do next: Follow the recommended plan, track expenses weekly, and improve savings rate gradually.`
  ];

  // Optional sentiment text
  let sentimentText = "";
  if (result.ai && !result.ai.error && result.ai.sentiment) {
    sentimentText =
      `\nSentiment (from your description): ${String(result.ai.sentiment).toUpperCase()}\n` +
      (Array.isArray(result.ai.keyPhrases) && result.ai.keyPhrases.length
        ? `Key phrases: ${result.ai.keyPhrases.join(", ")}\n`
        : "");
  }

  return [
    `Recommended Plan: ${rec?.title || "N/A"}`,
    "",
    ...whatNext,
    "",
    "Education (key terms):",
    ...defs.map(d => "• " + d),
    "",
    "Book-inspired principles:",
    ...principles.map(p => "• " + p),
    sentimentText ? "\n---\n" + sentimentText.trim() : ""
  ].join("\n");
}

async function analyzeSentimentIfEnabled(text) {
  const endpoint = process.env.LANGUAGE_ENDPOINT;
  const key = process.env.LANGUAGE_KEY;

  // Optional: if not configured, just skip (no failure)
  if (!endpoint || !key) return null;

  const clean = String(text || "").trim();
  if (!clean) return null;

  const client = new TextAnalyticsClient(endpoint, new AzureKeyCredential(key));
  const [sentimentDoc] = await client.analyzeSentiment([clean]);
  const [phrasesDoc] = await client.extractKeyPhrases([clean]);

  if (sentimentDoc?.error) return { error: sentimentDoc.error.message || "Sentiment failed" };
  if (phrasesDoc?.error) return { error: phrasesDoc.error.message || "Key phrase extraction failed" };

  return {
    sentiment: sentimentDoc.sentiment,
    keyPhrases: phrasesDoc.keyPhrases || []
  };
}

module.exports = async function (context, req) {
  if (req.method === "GET") {
    context.res = { status: 200, body: { ok: true, message: "API is running. Use POST /api/httpTrigger1" } };
    return;
  }

  const d = req.body || {};
  const income = toNum(d.income);
  const expenses = toNum(d.expenses);
  const savings = toNum(d.savings);

  const metrics = analyzeNumbers(income, expenses, savings);
  const stage = pickStage({ income, expenses, savings, ...metrics });

  const flags = keywordFlags(d.problemDescription);
  const { options, recommended } = buildPlans(stage.label, flags);

  let ai = null;
  try {
    ai = await analyzeSentimentIfEnabled(d.problemDescription);
  } catch (e) {
    ai = { error: String(e) };
  }

  const result = {
    currency: "$", // international-friendly; you can switch to "₹" later if you want
    income,
    expenses,
    savings,
    surplus: metrics.surplus,
    metrics: { savingsRatePct: metrics.savingsRatePct, runwayMonths: Math.round(metrics.runwayMonths * 10) / 10 },
    stage,
    flags,
    options,
    recommended,
    ai
  };

  result.educationText = educationBlock(result);

  context.res = { status: 200, body: { ok: true, result } };
};
