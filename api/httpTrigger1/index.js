const crypto = require("crypto");
global.crypto = crypto;

const { app } = require("@azure/functions");
const { TextAnalyticsClient, AzureKeyCredential } = require("@azure/ai-text-analytics");

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

function buildResult(d) {
  const income = toNum(d.income);
  const expenses = toNum(d.expenses);
  const savings = toNum(d.savings);

  const surplus = income - expenses;
  const bucket = horizonBucket(d.timeHorizon);

  const options = [
    { title: "Safe Plan", risk: "Low", instruments: ["FD (Fixed Deposit)"], allocation: "100% FD", why: "Capital protection. Suitable for short-term needs." },
    { title: "Balanced Plan", risk: "Medium", instruments: ["FD", "SIP (Mutual Funds)"], allocation: "40% FD, 60% SIP", why: "Better growth than FD with some stability." },
    { title: "Growth Plan", risk: "High", instruments: ["SIP (Equity Mutual Funds)"], allocation: "100% SIP", why: "Highest long-term wealth creation potential." }
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

  return { income, expenses, savings, surplus, options, recommended };
}

/* ---------- AI ---------- */
async function analyzeProblemText(text) {
  const endpoint = process.env.LANGUAGE_ENDPOINT;
  const key = process.env.LANGUAGE_KEY;

  if (!endpoint || !key) {
    return { error: "Missing LANGUAGE_ENDPOINT or LANGUAGE_KEY" };
  }

  if (!text) return null;

  const client = new TextAnalyticsClient(endpoint, new AzureKeyCredential(key));
  const [sentiment] = await client.analyzeSentiment([text]);
  const [phrases] = await client.extractKeyPhrases([text]);

  return {
    sentiment: sentiment.sentiment,
    keyPhrases: phrases.keyPhrases
  };
}

/* ---------- HTTP trigger ---------- */
app.http("httpTrigger1", {
  methods: ["GET", "POST"],
  authLevel: "anonymous",
  handler: async (request) => {
    if (request.method === "GET") {
      return { jsonBody: { ok: true, message: "API is running" } };
    }

    const data = await request.json().catch(() => ({}));
    const result = buildResult(data);
    const ai = await analyzeProblemText(data.problemDescription);

    return { jsonBody: { ok: true, result: { ...result, ai } } };
  }
});
