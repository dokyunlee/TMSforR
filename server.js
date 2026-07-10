const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { URL } = require("node:url");

const ROOT_DIR = __dirname;
const PORT = Number(process.env.PORT || 5173);
const DEFAULT_UPSTAGE_API_URL = "https://api.upstage.ai/v1/chat/completions";
const DATA_DIR = path.join(ROOT_DIR, "data");
const TASKS_FILE = path.join(DATA_DIR, "tasks.json");
const RESULTS_FILE = path.join(DATA_DIR, "results.json");

const normalizeUpstageApiUrl = (value) => {
  const trimmed = String(value || DEFAULT_UPSTAGE_API_URL).trim().replace(/\/+$/, "");
  if (/\/chat\/completions$/i.test(trimmed)) return trimmed;
  if (/\/v\d+(?:\/solar)?$/i.test(trimmed)) return trimmed + "/chat/completions";
  return trimmed;
};

const UPSTAGE_API_URL = normalizeUpstageApiUrl(process.env.UPSTAGE_API_URL);
const UPSTAGE_MODEL = process.env.UPSTAGE_MODEL || "solar-pro2";
const UPSTAGE_API_KEY = process.env.UPSTAGE_API_KEY || "";
const UPSTAGE_TIMEOUT_MS = Number(process.env.UPSTAGE_TIMEOUT_MS || 120000);
const SDT_REFERENCE = fs.readFileSync(path.join(ROOT_DIR, "docs", "sdt_reference.md"), "utf8");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".pdf": "application/pdf",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg"
};

const jsonResponse = (res, statusCode, payload) => {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
};

const ensureDataFile = (filePath, fallback) => {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, JSON.stringify(fallback, null, 2), "utf8");
};

const readJSONFile = (filePath, fallback) => {
  ensureDataFile(filePath, fallback);
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
};

const writeJSONFile = (filePath, data) => {
  ensureDataFile(filePath, Array.isArray(data) ? [] : {});
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
};

const readRequestBody = (req) => new Promise((resolve, reject) => {
  let body = "";
  req.on("data", (chunk) => {
    body += chunk;
    if (body.length > 40_000_000) {
      reject(new Error("Request body is too large."));
      req.destroy();
    }
  });
  req.on("end", () => {
    try {
      resolve(body ? JSON.parse(body) : {});
    } catch {
      reject(new Error("Invalid JSON body."));
    }
  });
  req.on("error", reject);
});

const clean = (value) => String(value || "").replace(/[<>]/g, "").replace(/\s+/g, " ").trim();

const summarizeUpstageError = (status, rawText) => {
  const fallback = rawText ? rawText.slice(0, 500) : "No response body.";
  try {
    const parsed = JSON.parse(rawText);
    const message = parsed.error?.message || parsed.message || parsed.detail || fallback;
    return "Upstage API error " + status + ": " + message;
  } catch {
    return "Upstage API error " + status + ": " + fallback;
  }
};

const buildMetadataBlock = (payload) => {
  const fields = {
    "\uC791\uC5C5 \uC81C\uBAA9": payload.title,
    "\uC644\uB8CC \uBCF4\uC0C1": payload.reward,
    "\uC791\uC5C5 \uC9C0\uCE68/\uC0C1\uC138 \uC124\uBA85": payload.description,
    "\uC815\uC11C\uC801 \uBD80\uB2F4": payload.riskLevel,
    "\uBC18\uBCF5/\uC9D1\uC911 \uBD80\uB2F4": payload.fatigueLevel,
    "\uC791\uC5C5\uC790\uAC00 \uD560 \uC77C": payload.objective,
    "\uC791\uC5C5\uC758 \uC2E4\uC81C \uAE30\uC5EC": payload.socialImpact,
    "\uC791\uC5C5\uC790\uAC00 \uACAA\uC744 \uC218 \uC788\uB294 \uC0C1\uD669": payload.workerContext
  };

  return Object.entries(fields)
    .map(([key, value]) => "- " + key + ": " + (clean(value) || "(\uBBF8\uC785\uB825)"))
    .join("\n");
};

const initialOutputSchema = [
  "{",
  "  \"psychologicalFactors\": {",
  "    \"inferredTaskTypes\": [",
  "      { \"type\": \"Emotionally Demanding Tasks | Responsibility-Critical Tasks | Repetitive Cognitive Tasks | Socially Meaningful Tasks | General Low-Stakes Tasks\", \"evidence\": \"metadata evidence\", \"confidence\": 0.0 }",
  "    ],",
  "    \"primaryTaskType\": \"Emotionally Demanding Tasks | Responsibility-Critical Tasks | Repetitive Cognitive Tasks | Socially Meaningful Tasks | General Low-Stakes Tasks\",",
  "    \"primaryPsychologicalType\": \"\uC815\uC11C\uC801\uC73C\uB85C \uBD80\uB2F4\uB418\uB294 \uC791\uC5C5 | \uCC45\uC784\uC774 \uC911\uC694\uD55C \uC791\uC5C5 | \uBC18\uBCF5 \uC778\uC9C0 \uC791\uC5C5 | \uC0AC\uD68C\uC801\uC73C\uB85C \uC758\uBBF8 \uC788\uB294 \uC791\uC5C5 | \uC77C\uBC18 \uC800\uC704\uD5D8 \uC791\uC5C5\",",
  "    \"psychologicalBurdens\": [\"\uC791\uC5C5\uC790\uAC00 \uB290\uB084 \uC218 \uC788\uB294 \uBD80\uB2F4\"],",
  "    \"motivationalFactors\": [\"\uB3D9\uAE30 \uBD80\uC5EC\uC5D0 \uD65C\uC6A9\uD560 \uC218 \uC788\uB294 \uC694\uC778\"],",
  "    \"sdtNeeds\": [\"relatedness\", \"competence\", \"autonomy\"],",
  "    \"selectedFrames\": [\"\uAD00\uACC4\uC131(\uAC10\uC0AC\u00B7\uACF5\uAC10)\", \"\uC720\uB2A5\uAC10\"],",
  "    \"frameSelectionReason\": \"\uC791\uC5C5 \uD2B9\uC131\uACFC \uBD80\uB2F4\uC744 \uACE0\uB824\uD574 \uAD00\uACC4\uC131 + \uC720\uB2A5\uAC10 \uC870\uD569\uC774 \uC801\uC808\uD55C \uBB38\uAD6C\uB97C \uB9CC\uB4E4 \uC218 \uC788\uC2B5\uB2C8\uB2E4.\",",
  "    \"constraintsApplied\": [\"\uBE44\uC555\uBC15\", \"\uBE44\uACFC\uC7A5\", \"\uAD6C\uCCB4\uC801 \uAE30\uC900 \uC720\uC9C0\"]",
  "  },",
  "  \"beforeOptions\": [",
  "    { \"label\": \"\uC758\uBBF8\uAC10/\uAD00\uACC4\uC131\", \"frame\": \"Meaningfulness / Relatedness\", \"message\": \"3~5\uBB38\uC7A5\uC758 \uC791\uC5C5 \uC2DC\uC791 \uC804 \uD6C4\uBCF4 \uBB38\uAD6C\" },",
  "    { \"label\": \"\uC720\uB2A5\uAC10/\uD310\uB2E8 \uC2E0\uB8B0\", \"frame\": \"Competence\", \"message\": \"3~5\uBB38\uC7A5\uC758 \uC791\uC5C5 \uC2DC\uC791 \uC804 \uD6C4\uBCF4 \uBB38\uAD6C\" },",
  "    { \"label\": \"\uC790\uC728\uC131/\uBD80\uB2F4 \uC644\uD654\", \"frame\": \"Autonomy support\", \"message\": \"3~5\uBB38\uC7A5\uC758 \uC791\uC5C5 \uC2DC\uC791 \uC804 \uD6C4\uBCF4 \uBB38\uAD6C\" }",
  "  ],",
  "  \"afterOptions\": [",
  "    { \"label\": \"\uAC10\uC0AC/\uAD00\uACC4\uC131\", \"frame\": \"Relatedness / Appreciation\", \"message\": \"3~5\uBB38\uC7A5\uC758 \uC791\uC5C5 \uC644\uB8CC \uD6C4 \uD6C4\uBCF4 \uBB38\uAD6C\" },",
  "    { \"label\": \"\uAE30\uC5EC/\uC720\uB2A5\uAC10\", \"frame\": \"Competence\", \"message\": \"3~5\uBB38\uC7A5\uC758 \uC791\uC5C5 \uC644\uB8CC \uD6C4 \uD6C4\uBCF4 \uBB38\uAD6C\" },",
  "    { \"label\": \"\uC790\uC728\uC801 \uB9C8\uBB34\uB9AC\", \"frame\": \"Autonomy support\", \"message\": \"3~5\uBB38\uC7A5\uC758 \uC791\uC5C5 \uC644\uB8CC \uD6C4 \uD6C4\uBCF4 \uBB38\uAD6C\" }",
  "  ],",
  "  \"finalBeforeText\": \"\uD6C4\uBCF4 2\uAC1C\uB97C \uC790\uC5F0\uC2A4\uB7FD\uAC8C \uC885\uD569\uD55C \uCD5C\uC885 \uC791\uC5C5 \uC2DC\uC791 \uC804 \uBB38\uAD6C\",",
  "  \"finalAfterText\": \"\uD6C4\uBCF4 3\uAC1C\uB97C \uC790\uC5F0\uC2A4\uB7FD\uAC8C \uC885\uD569\uD55C \uCD5C\uC885 \uC791\uC5C5 \uC644\uB8CC \uD6C4 \uBB38\uAD6C\",",
  "  \"structuredPromptSummary\": \"\uD504\uB86C\uD504\uD2B8 \uAD6C\uC870 \uC694\uC57D\"",
  "}"
].join("\n");

const buildInitialMessages = (payload) => [
  {
    role: "system",
    content: [
      "\uB2F9\uC2E0\uC740 \uD06C\uB77C\uC6B0\uB4DC\uC18C\uC2F1 \uC791\uC5C5\uC790\uC5D0\uAC8C \uC804\uB2EC\uD560 \uC548\uB0B4 \uBA54\uC2DC\uC9C0\uB97C \uC791\uC131\uD558\uB294 UX \uB77C\uC774\uD130\uC785\uB2C8\uB2E4.",
      "\uC790\uAE30\uACB0\uC815\uC131\uC774\uB860(SDT)\uC758 \uAD00\uACC4\uC131, \uC720\uB2A5\uAC10, \uC790\uC728\uC131\uC744 \uCC38\uACE0\uD558\uB418 \uD654\uBA74\uC5D0 \uC774\uB860 \uC6A9\uC5B4\uB97C \uC9C1\uC811 \uB4DC\uB7EC\uB0B4\uC9C0 \uB9C8\uC138\uC694.",
      "Requester\uAC00 \uC785\uB825\uD55C \uC791\uC5C5 \uC815\uBCF4\uC640 PDF \uAE30\uBC18 \uADDC\uCE59\uC744 \uBC14\uD0D5\uC73C\uB85C \uC791\uC5C5 \uD2B9\uC131\uC744 \uCD94\uB860\uD558\uACE0, \uC791\uC5C5 \uC2DC\uC791 \uC804 \uD6C4\uBCF4 3\uAC1C\uC640 \uC791\uC5C5 \uC644\uB8CC \uD6C4 \uD6C4\uBCF4 3\uAC1C\uB97C \uB9CC\uB4DC\uC138\uC694.",
      "\uD6C4\uBCF4 \uBB38\uAD6C\uB294 \uAC01\uAC01 \uD55C\uAD6D\uC5B4 3~5\uBB38\uC7A5\uC73C\uB85C \uC791\uC131\uD558\uACE0, \uC8C4\uCC45\uAC10\u00B7\uC555\uBC15\u00B7\uACFC\uC7A5\u00B7\uD64D\uBCF4\uC131 \uD45C\uD604\uC744 \uD53C\uD558\uC138\uC694.",
      "\uCD5C\uC885 \uC791\uC5C5 \uC2DC\uC791 \uC804 \uBB38\uAD6C\uB294 \uC120\uD0DD \uD504\uB808\uC784 2\uAC1C\uC5D0 \uD574\uB2F9\uD558\uB294 \uD6C4\uBCF4 2\uAC1C\uB97C \uC790\uC5F0\uC2A4\uB7FD\uAC8C \uC11E\uC5B4 \uC791\uC131\uD558\uC138\uC694.",
      "\uCD5C\uC885 \uC791\uC5C5 \uC644\uB8CC \uD6C4 \uBB38\uAD6C\uB294 \uBC29\uAE08 \uC644\uB8CC\uD55C \uC791\uC5C5\uC5D0 \uB300\uD55C \uAC10\uC0AC\uC640 \uACB0\uACFC \uD65C\uC6A9 \uB9E5\uB77D\uB9CC \uCC28\uBD84\uD558\uAC8C \uB2F4\uACE0, \uCD94\uAC00 \uCC38\uC5EC\uB97C \uAD8C\uC720\uD558\uC9C0 \uB9C8\uC138\uC694.",
      "\uC791\uC5C5\uC790\uC5D0\uAC8C \uC9C1\uC811 \uB9D0\uD558\uB294 \uC790\uC5F0\uC2A4\uB7EC\uC6B4 \uC874\uB313\uB9D0\uC744 \uC0AC\uC6A9\uD558\uC138\uC694. \uBCF4\uACE0\uC11C\uCCB4, \uC778\uC99D\uC11C\uCCB4, \uACFC\uC7A5\uB41C \uACF5\uC775 \uBB38\uAD6C\uB294 \uD53C\uD558\uC138\uC694.",
      "finalBeforeText\uB294 \uBC18\uB4DC\uC2DC \uB2E4\uC74C \uBB38\uC7A5\uC73C\uB85C \uC2DC\uC791\uD558\uC138\uC694: \uC548\uB155\uD558\uC138\uC694, \"\uC791\uC5C5 \uC81C\uBAA9\" \uC791\uC5C5\uC5D0 \uCC38\uC5EC\uD574 \uC8FC\uC154\uC11C \uAC10\uC0AC\uD569\uB2C8\uB2E4.",
      "\uBC18\uB4DC\uC2DC JSON \uAC1D\uCCB4\uB9CC \uBC18\uD658\uD558\uC138\uC694. Markdown \uCF54\uB4DC\uBE14\uB85D, \uC124\uBA85\uBB38, \uC8FC\uC11D\uC740 \uD3EC\uD568\uD558\uC9C0 \uB9C8\uC138\uC694."
    ].join("\n")
  },
  {
    role: "user",
    content: [
      "[PDF \uAE30\uBC18 \uADDC\uCE59]",
      SDT_REFERENCE,
      "",
      "[Requester \uC785\uB825 \uBA54\uD0C0\uB370\uC774\uD130]",
      buildMetadataBlock(payload),
      "",
      "[\uC791\uC131 \uADDC\uCE59]",
      "1. \uC791\uC5C5 \uBA54\uD0C0\uB370\uC774\uD130\uC5D0\uC11C \uC791\uC5C5 \uC720\uD615, \uBD80\uB2F4, \uB3D9\uAE30 \uC694\uC778, SDT \uC695\uAD6C\uB97C \uBA3C\uC800 \uCD94\uB860\uD558\uC138\uC694.",
      "2. PDF \uAE30\uBC18 \uCE74\uD14C\uACE0\uB9AC \uADDC\uCE59\uC744 \uCC38\uACE0\uD574 \uAC00\uC7A5 \uC801\uC808\uD55C \uC791\uC5C5 \uCE74\uD14C\uACE0\uB9AC 1\uAC1C\uC640 SDT \uD504\uB808\uC784 2\uAC1C\uB97C \uC120\uD0DD\uD558\uC138\uC694.",
      "3. selectedFrames\uB294 \uBC18\uB4DC\uC2DC 2\uAC1C\uB9CC \uBC18\uD658\uD558\uC138\uC694.",
      "4. \uC791\uC5C5 \uC2DC\uC791 \uC804 \uD6C4\uBCF4 3\uAC1C\uB294 \uAC01\uAC01 \uC758\uBBF8\uAC10/\uAD00\uACC4\uC131, \uC720\uB2A5\uAC10, \uC790\uC728\uC131/\uBD80\uB2F4 \uC644\uD654\uB97C \uBD84\uBA85\uD788 \uBC18\uC601\uD558\uC138\uC694.",
      "5. \uC791\uC5C5 \uC644\uB8CC \uD6C4 \uD6C4\uBCF4 3\uAC1C\uB294 \uAC10\uC0AC, \uAE30\uC5EC, \uC790\uC728\uC801 \uB9C8\uBB34\uB9AC \uAD00\uC810\uC744 \uCC28\uBD84\uD558\uAC8C \uBC18\uC601\uD558\uC138\uC694.",
      "6. \uCD5C\uC885 \uBB38\uAD6C\uC5D0\uB294 \uC791\uC5C5\uC790\uAC00 \uC2E4\uC81C\uB85C \uB530\uB77C \uD560 \uC218 \uC788\uB294 \uAE30\uC900\uACFC \uC548\uC2EC\uAC10\uC744 \uB2F4\uB418, \uC131\uACFC\uB97C \uACFC\uC7A5\uD558\uC9C0 \uB9C8\uC138\uC694.",
      "7. finalAfterText\uB294 \uC644\uB8CC\uB41C \uC791\uC5C5\uC5D0 \uB300\uD55C \uAC10\uC0AC\uB85C \uB9C8\uBB34\uB9AC\uD558\uC138\uC694.",
      "8. finalBeforeText\uC758 \uCCAB \uBB38\uC7A5\uC740 \uBC18\uB4DC\uC2DC \uB2E4\uC74C \uBB38\uC7A5\uC774\uC5B4\uC57C \uD569\uB2C8\uB2E4: \uC548\uB155\uD558\uC138\uC694, \"" + clean(payload.title) + "\" \uC791\uC5C5\uC5D0 \uCC38\uC5EC\uD574 \uC8FC\uC154\uC11C \uAC10\uC0AC\uD569\uB2C8\uB2E4.",
      "",
      "[\uCD9C\uB825 JSON \uC2A4\uD0A4\uB9C8]",
      initialOutputSchema
    ].join("\n")
  }
];

const callUpstage = async (messages, temperature = 0.35, maxTokens = 3200) => {
  if (!UPSTAGE_API_KEY) {
    throw new Error("UPSTAGE_API_KEY environment variable is not set.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTAGE_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(UPSTAGE_API_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: "Bearer " + UPSTAGE_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: UPSTAGE_MODEL,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: false
      })
    });
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("Upstage API timed out after " + Math.round(UPSTAGE_TIMEOUT_MS / 1000) + " seconds.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  const rawText = await response.text();
  if (!response.ok) {
    throw new Error(summarizeUpstageError(response.status, rawText));
  }

  let data;
  try {
    data = JSON.parse(rawText);
  } catch {
    throw new Error("Upstage API returned a non-JSON transport response.");
  }

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Upstage API response did not include message content.");
  }

  return {
    content,
    usage: data.usage || null,
    model: data.model || UPSTAGE_MODEL
  };
};

const parseModelJson = (content) => {
  const trimmed = String(content || "").trim();
  const fenced = trimmed.match(/\x60\x60\x60(?:json)?\s*([\s\S]*?)\s*\x60\x60\x60/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;

  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(candidate.slice(start, end + 1));
    }
    throw new Error("Could not parse model response as JSON.");
  }
};

const normalizeMessageText = (message) => String(message || "")
  .replace(/\s+/g, " ")
  .replace(/\s+([.!?\u3002])/g, "$1")
  .trim();

const stripDuplicateOpening = (message) => normalizeMessageText(message)
  .replace(/^\uC548\uB155\uD558\uC138\uC694,\s*["\u201C][^"\u201D]+["\u201D]\s*\uC791\uC5C5\uC5D0\s*\uCC38\uC5EC\uD574\s*\uC8FC\uC154\uC11C\s*\uAC10\uC0AC\uD569\uB2C8\uB2E4[.!]?\s*/i, "")
  .replace(/^\uCC38\uC5EC\uD574\s*\uC8FC\uC154\uC11C\s*\uAC10\uC0AC\uD569\uB2C8\uB2E4[.!]?\s*/i, "");

const ensureBeforeOpening = (message, title) => {
  const opening = "\uC548\uB155\uD558\uC138\uC694, \"" + clean(title) + "\" \uC791\uC5C5\uC5D0 \uCC38\uC5EC\uD574 \uC8FC\uC154\uC11C \uAC10\uC0AC\uD569\uB2C8\uB2E4.";
  const body = stripDuplicateOpening(message);
  return normalizeMessageText(opening + " " + body);
};

const normalizeOption = (option, title, phase) => {
  if (typeof option === "string") {
    return phase === "before" ? ensureBeforeOpening(option, title) : normalizeMessageText(option);
  }

  const message = phase === "before"
    ? ensureBeforeOpening(option?.message || option?.text || "", title)
    : normalizeMessageText(option?.message || option?.text || "");

  return {
    ...option,
    message
  };
};

const softenWorkerMessages = (payload) => {
  const next = { ...payload };
  const title = next.requestTitle || "";

  if (next.finalBeforeText) next.finalBeforeText = ensureBeforeOpening(next.finalBeforeText, title);
  if (next.finalAfterText) next.finalAfterText = normalizeMessageText(next.finalAfterText);
  if (Array.isArray(next.beforeOptions)) {
    next.beforeOptions = next.beforeOptions.map(option => normalizeOption(option, title, "before"));
  }
  if (Array.isArray(next.afterOptions)) {
    next.afterOptions = next.afterOptions.map(option => normalizeOption(option, title, "after"));
  }

  return next;
};

const handleGenerate = async (req, res) => {
  try {
    const payload = await readRequestBody(req);
    if (!clean(payload.title) || !clean(payload.description)) {
      jsonResponse(res, 400, { error: "title and description are required." });
      return;
    }

    const completion = await callUpstage(buildInitialMessages(payload));
    const parsed = softenWorkerMessages({
      ...parseModelJson(completion.content),
      requestTitle: payload.title
    });
    delete parsed.requestTitle;

    jsonResponse(res, 200, {
      provider: "upstage",
      model: completion.model,
      usage: completion.usage,
      ...parsed
    });
  } catch (error) {
    jsonResponse(res, 502, { error: error.message });
  }
};

const handleSaveTask = async (req, res) => {
  try {
    const payload = await readRequestBody(req);
    const task = payload.task || payload;
    if (!task || !task.id) {
      jsonResponse(res, 400, { error: "Task id is required." });
      return;
    }
    const tasks = readJSONFile(TASKS_FILE, {});
    tasks[task.id] = {
      ...task,
      savedAt: new Date().toISOString()
    };
    writeJSONFile(TASKS_FILE, tasks);
    jsonResponse(res, 200, { ok: true, task: tasks[task.id] });
  } catch (error) {
    jsonResponse(res, 500, { error: error.message });
  }
};

const handleGetTask = (req, res, taskId) => {
  const tasks = readJSONFile(TASKS_FILE, {});
  const task = tasks[taskId];
  if (!task) {
    jsonResponse(res, 404, { error: "Task not found." });
    return;
  }
  jsonResponse(res, 200, { task });
};

const handleSaveResult = async (req, res) => {
  try {
    const payload = await readRequestBody(req);
    const record = payload.record || payload;
    const results = readJSONFile(RESULTS_FILE, []);
    results.push({
      ...record,
      savedAt: new Date().toISOString()
    });
    writeJSONFile(RESULTS_FILE, results);
    jsonResponse(res, 200, { ok: true });
  } catch (error) {
    jsonResponse(res, 500, { error: error.message });
  }
};

const handleGetResults = (res) => {
  const results = readJSONFile(RESULTS_FILE, []);
  jsonResponse(res, 200, { results });
};

const serveStatic = (req, res, pathname) => {
  const relativePath = pathname === "/" ? "index.html" : decodeURIComponent(pathname.slice(1));
  const filePath = path.normalize(path.join(ROOT_DIR, relativePath));
  const rootWithSep = ROOT_DIR.endsWith(path.sep) ? ROOT_DIR : ROOT_DIR + path.sep;

  if (!(filePath === ROOT_DIR || filePath.startsWith(rootWithSep))) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404);
      res.end("Not Found");
      return;
    }
    const contentType = MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream";
    res.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "Pragma": "no-cache",
      "Expires": "0"
    });
    res.end(data);
  });
};

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url, "http://" + (req.headers.host || "localhost"));

  if (req.method === "GET" && requestUrl.pathname === "/api/health") {
    jsonResponse(res, 200, {
      ok: true,
      hasApiKey: Boolean(UPSTAGE_API_KEY),
      model: UPSTAGE_MODEL,
      endpoint: UPSTAGE_API_URL,
      timeoutMs: UPSTAGE_TIMEOUT_MS
    });
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/api/generate-motivation") {
    await handleGenerate(req, res);
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/api/tasks") {
    await handleSaveTask(req, res);
    return;
  }

  if (req.method === "GET" && requestUrl.pathname.startsWith("/api/tasks/")) {
    const taskId = decodeURIComponent(requestUrl.pathname.replace("/api/tasks/", ""));
    handleGetTask(req, res, taskId);
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/api/results") {
    await handleSaveResult(req, res);
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/api/results") {
    handleGetResults(res);
    return;
  }

  if (req.method === "GET" || req.method === "HEAD") {
    serveStatic(req, res, requestUrl.pathname);
    return;
  }

  jsonResponse(res, 405, { error: "Method not allowed." });
});

server.listen(PORT, () => {
  console.log("AgenticMotivation server running at http://localhost:" + PORT);
  console.log("Upstage model: " + UPSTAGE_MODEL);
  console.log("Upstage endpoint: " + UPSTAGE_API_URL);
  console.log("Upstage API key loaded: " + (UPSTAGE_API_KEY ? "yes" : "no"));
});
