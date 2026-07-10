const DEFAULT_UPSTAGE_API_URL = "https://api.upstage.ai/v1/chat/completions";

const normalizeUpstageApiUrl = (value) => {
  const trimmed = String(value || DEFAULT_UPSTAGE_API_URL).trim().replace(/\/+$/, "");
  if (/\/chat\/completions$/i.test(trimmed)) return trimmed;
  if (/\/v\d+(?:\/solar)?$/i.test(trimmed)) return trimmed + "/chat/completions";
  return trimmed;
};

const clean = (value) => String(value || "").replace(/[<>]/g, "").replace(/\s+/g, " ").trim();

const json = (res, status, payload) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
};

const summarizeUpstageError = (status, rawText) => {
  const fallback = rawText ? rawText.slice(0, 500) : "No response body.";
  try {
    const parsed = JSON.parse(rawText);
    return `Upstage API error ${status}: ${parsed.error?.message || parsed.message || parsed.detail || fallback}`;
  } catch {
    return `Upstage API error ${status}: ${fallback}`;
  }
};

const buildMessages = (payload) => [
  {
    role: "system",
    content: [
      "당신은 크라우드소싱 작업자에게 전달할 한국어 안내 메시지를 작성하는 UX 라이터입니다.",
      "자기결정성이론(SDT)의 관계성, 유능감, 자율성을 참고하되 화면에는 이론 용어를 직접 드러내지 마세요.",
      "작업 시작 전 후보 3개, 작업 완료 후 후보 3개, 최종 작업 전/후 문구를 JSON으로만 반환하세요.",
      "beforeOptions와 afterOptions의 각 후보 message는 반드시 서로 자연스럽게 이어지는 완결된 한국어 5문장으로 작성하세요. 짧은 구절을 마침표로 나누어 문장 수만 맞추지 마세요.",
      "문구는 과장, 압박, 죄책감, 홍보성 표현 없이 차분하고 구체적으로 작성하세요.",
      "finalBeforeText는 반드시 다음 문장으로 시작하세요: 안녕하세요, \"" + clean(payload.title) + "\" 작업에 참여해 주셔서 감사합니다."
    ].join("\n")
  },
  {
    role: "user",
    content: [
      "[작업 정보]",
      `작업 제목: ${clean(payload.title)}`,
      `완료 보상: ${clean(payload.reward)}`,
      `작업 지침: ${clean(payload.description)}`,
      `정서적 부담: ${clean(payload.riskLevel)}`,
      `반복/집중 부담: ${clean(payload.fatigueLevel)}`,
      `작업자가 할 일: ${clean(payload.objective)}`,
      `작업의 실제 기여: ${clean(payload.socialImpact)}`,
      `작업자가 겪을 수 있는 상황: ${clean(payload.workerContext)}`,
      "",
      "[반환 JSON 스키마]",
      JSON.stringify({
        psychologicalFactors: {
          inferredTaskTypes: [{ type: "General Low-Stakes Tasks", evidence: "metadata evidence", confidence: 0.7 }],
          primaryTaskType: "General Low-Stakes Tasks",
          primaryPsychologicalType: "일반 저위험 작업",
          psychologicalBurdens: ["작업자가 느낄 수 있는 부담"],
          motivationalFactors: ["동기 부여에 활용할 수 있는 요인"],
          sdtNeeds: ["relatedness", "competence"],
          selectedFrames: ["관계성(감사·공감)", "유능감"],
          frameSelectionReason: "작업 특성을 고려한 선택 이유",
          constraintsApplied: ["비압박", "비과장", "구체적 기준 유지"]
        },
        beforeOptions: [
          { label: "의미감/관계성", frame: "Meaningfulness / Relatedness", message: "자연스럽게 이어지는 완결된 5문장의 작업 시작 전 후보 문구" },
          { label: "유능감/판단 신뢰", frame: "Competence", message: "자연스럽게 이어지는 완결된 5문장의 작업 시작 전 후보 문구" },
          { label: "자율성/부담 완화", frame: "Autonomy support", message: "자연스럽게 이어지는 완결된 5문장의 작업 시작 전 후보 문구" }
        ],
        afterOptions: [
          { label: "감사/관계성", frame: "Relatedness / Appreciation", message: "자연스럽게 이어지는 완결된 5문장의 작업 완료 후 후보 문구" },
          { label: "기여/유능감", frame: "Competence", message: "자연스럽게 이어지는 완결된 5문장의 작업 완료 후 후보 문구" },
          { label: "자율적 마무리", frame: "Autonomy support", message: "자연스럽게 이어지는 완결된 5문장의 작업 완료 후 후보 문구" }
        ],
        finalBeforeText: "최종 작업 시작 전 문구",
        finalAfterText: "최종 작업 완료 후 문구",
        structuredPromptSummary: "프롬프트 구조 요약"
      }, null, 2)
    ].join("\n")
  }
];

const parseModelJson = (content) => {
  const trimmed = String(content || "").trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(candidate.slice(start, end + 1));
    throw new Error("Could not parse model response as JSON.");
  }
};

const normalizeMessageText = (message) => String(message || "").replace(/\s+/g, " ").trim();

const ensureBeforeOpening = (message, title) => {
  const opening = `안녕하세요, "${clean(title)}" 작업에 참여해 주셔서 감사합니다.`;
  const body = normalizeMessageText(message).replace(/^안녕하세요,\s*["“][^"”]+["”]\s*작업에\s*참여해\s*주셔서\s*감사합니다[.!]?\s*/i, "");
  return normalizeMessageText(`${opening} ${body}`);
};

module.exports = async (req, res) => {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed." });

  const apiKey = process.env.UPSTAGE_API_KEY || "";
  if (!apiKey) return json(res, 500, { error: "UPSTAGE_API_KEY environment variable is not set." });

  try {
    const payload = req.body || {};
    const apiUrl = normalizeUpstageApiUrl(process.env.UPSTAGE_API_URL);
    const model = process.env.UPSTAGE_MODEL || "solar-pro2";
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        messages: buildMessages(payload),
        temperature: 0.35,
        max_tokens: 3200,
        stream: false
      })
    });

    const rawText = await response.text();
    if (!response.ok) throw new Error(summarizeUpstageError(response.status, rawText));

    const transport = JSON.parse(rawText);
    const content = transport.choices?.[0]?.message?.content;
    if (!content) throw new Error("Upstage API response did not include message content.");

    const parsed = parseModelJson(content);
    if (parsed.finalBeforeText) parsed.finalBeforeText = ensureBeforeOpening(parsed.finalBeforeText, payload.title);
    if (parsed.finalAfterText) parsed.finalAfterText = normalizeMessageText(parsed.finalAfterText);

    json(res, 200, {
      provider: "upstage",
      model: transport.model || model,
      usage: transport.usage || null,
      ...parsed
    });
  } catch (error) {
    json(res, 502, { error: error.message });
  }
};
