const crypto = require("crypto");
global.crypto = crypto;
const { app } = require("@azure/functions");
const { TextAnalysisClient, AzureKeyCredential } = require("@azure/ai-language-text");

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
  if (h === "5y+" || h === "5+y" || h.includes("5y+") || h.includes("5+")) return "long";
  if (h === "2-5y" || h.includes("2-5")) return "mid";
  return "short";
}

function buildResult(d) {
  const income = toNum(d.income);
  const expenses = toNum(d.expenses);
  const savings = toNum(d.savings);

  const surplus = income - expenses;
  const timeHorizonRaw = d.timeHorizon;
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
    horizonBucket: bucket,
    options,
    recommended
  };
}

/* ---------- Azure AI Language call ---------- */
async function analyzeProblemText(problemDescription) {
  const endpoint = process.env.LANGUAGE_ENDPOINT;
  const key = process.env.LANGUAGE_KEY;

  if (!endpoint || !key) {
    return { error: "Missing LANGUAGE_ENDPOINT or LANGUAGE_KEY in environment variables" };
  }

  const text = String(problemDescription ?? "").trim();
  if (!text) return null;

  const client = new TextAnalysisClient(endpoint, new AzureKeyCredential(key));
  const actions = [
    { kind: "SentimentAnalysis" },
    { kind: "KeyPhraseExtraction" }
  ];

  const [doc] = await client.analyze(actions, [text]);

  if (!doc || doc.error) return { error: doc?.error || "AI analysis failed" };

  const sentimentRes = doc.results.find(r => r.kind === "SentimentAnalysis");
  const keyphraseRes = doc.results.find(r => r.kind === "KeyPhraseExtraction");

  return {
    sentiment: sentimentRes?.sentiment || null,
    confidence: sentimentRes?.confidenceScores || null,
    keyPhrases: keyphraseRes?.keyPhrases || []
  };
}

/* ---------- HTTP trigger ---------- */
app.http("httpTrigger1", {
  methods: ["GET", "POST"],
  authLevel: "anonymous",
  handler: async (request) => {
    if (request.method === "GET") {
      return { jsonBody: { ok: true, message: "API is running. Use POST to get financial plans." } };
    }

    const data = await request.json().catch(() => ({}));
    const result = buildResult(data);

    let ai = null;
    try {
      ai = await analyzeProblemText(data.problemDescription);
    } catch (e) {
      ai = { error: String(e) };
    }

    return { jsonBody: { ok: true, result: { ...result, ai } } };
  }
});


