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

module.exports = async (req, res) => {
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed." });

  try {
    requireSupabase();
    const taskId = req.query?.id;
    if (!taskId) return json(res, 400, { error: "Task id is required." });

    const response = await fetch(`${SUPABASE_URL.replace(/\/+$/, "")}/rest/v1/tasks?id=eq.${encodeURIComponent(taskId)}&select=payload&limit=1`, {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
      }
    });
    const data = await response.json().catch(() => []);
    if (!response.ok) throw new Error(data.message || "Failed to load task.");
    if (!data[0]) return json(res, 404, { error: "Task not found." });
    json(res, 200, { task: data[0].payload });
  } catch (error) {
    json(res, 500, { error: error.message });
  }
};
