const { TextAnalyticsClient, AzureKeyCredential } = require("@azure/ai-text-analytics");

// Fix for environments where global.crypto isn't present
global.crypto = global.crypto || require("crypto");

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

  let recommended = null;
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
    recommended = bucket === "long" ? options[2] : bucket === "mid" ? options[1] : options[0];
  }

  return { income, expenses, savings, surplus, timeHorizon: String(d.timeHorizon ?? ""), horizonBucket: bucket, options, recommended };
}

async function analyzeProblemText(problemDescription) {
  const endpoint = process.env.LANGUAGE_ENDPOINT;
  const key = process.env.LANGUAGE_KEY;

  if (!endpoint || !key) return { error: "Missing LANGUAGE_ENDPOINT or LANGUAGE_KEY" };

  const text = String(problemDescription ?? "").trim();
  if (!text) return null;

  const client = new TextAnalyticsClient(endpoint, new AzureKeyCredential(key));
  const [sentimentDoc] = await client.analyzeSentiment([text]);
  const [phrasesDoc] = await client.extractKeyPhrases([text]);

  if (sentimentDoc.error) return { error: sentimentDoc.error.message || "Sentiment failed" };
  if (phrasesDoc.error) return { error: phrasesDoc.error.message || "Key phrase extraction failed" };

  return { sentiment: sentimentDoc.sentiment, confidence: sentimentDoc.confidenceScores, keyPhrases: phrasesDoc.keyPhrases || [] };
}

module.exports = async function (context, req) {
  if (req.method === "GET") {
    context.res = { status: 200, body: { ok: true, message: "API is running. Use POST /api/httpTrigger1" } };
    return;
  }

  const data = req.body || {};
  const result = buildResult(data);

  let ai = null;
  try {
    ai = await analyzeProblemText(data.problemDescription);
  } catch (e) {
    ai = { error: String(e) };
  }

  context.res = { status: 200, body: { ok: true, result: { ...result, ai } } };
};
