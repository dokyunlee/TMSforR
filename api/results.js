const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const json = (res, status, payload) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
};

const requireSupabase = () => {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required.");
  }
};

const supabaseFetch = (path, options = {}) => fetch(`${SUPABASE_URL.replace(/\/+$/, "")}/rest/v1${path}`, {
  ...options,
  headers: {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
    ...(options.headers || {})
  }
});

module.exports = async (req, res) => {
  try {
    requireSupabase();

    if (req.method === "GET") {
      const response = await supabaseFetch("/results?select=*&order=created_at.desc", { method: "GET" });
      const data = await response.json().catch(() => []);
      if (!response.ok) throw new Error(data.message || "Failed to load results.");
      return json(res, 200, { results: data.map(row => row.payload || row) });
    }

    if (req.method !== "POST") return json(res, 405, { error: "Method not allowed." });

    const record = req.body?.record || req.body;
    const row = {
      task_id: record.taskId || null,
      payload: record
    };
    const response = await supabaseFetch("/results", {
      method: "POST",
      body: JSON.stringify(row)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "Failed to save result.");
    json(res, 200, { ok: true });
  } catch (error) {
    json(res, 500, { error: error.message });
  }
};
