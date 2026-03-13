/**
 * E2E tests that hit the actual production backend.
 *
 * These verify that the mobile app's API client works correctly
 * with the real server responses (field names, data format, etc).
 *
 * Run with: npx jest e2e-backend --testPathPattern e2e
 * Skipped by default in CI (needs network access).
 */

const API_BASE = process.env.API_BASE_URL || "https://hayyabaca.ihfazh.com/api";
const TEST_USER = process.env.TEST_USER || "ihfazhtest";
const TEST_PASS = process.env.TEST_PASS || "";

// Skip in CI unless explicitly enabled
const describeE2E = process.env.E2E ? describe : describe.skip;

describeE2E("E2E: Backend API", () => {
  // --- Article list ---
  it("GET /books/?type=article → returns article list with expected fields", async () => {
    const res = await fetch(`${API_BASE}/books/?type=article`);
    expect(res.ok).toBe(true);

    const articles = await res.json();
    expect(Array.isArray(articles)).toBe(true);
    expect(articles.length).toBeGreaterThan(0);

    const first = articles[0];
    expect(first).toHaveProperty("id");
    expect(first).toHaveProperty("title");
    expect(first).toHaveProperty("categories");
    expect(typeof first.id).toBe("number");
    expect(typeof first.title).toBe("string");
    expect(Array.isArray(first.categories)).toBe(true);
  });

  // --- Article detail ---
  it("GET /books/:id/ → returns article detail with sections and quizzes", async () => {
    // First get list to find a valid ID
    const listRes = await fetch(`${API_BASE}/books/?type=article`);
    const articles = await listRes.json();
    const articleId = articles[0].id;

    const res = await fetch(`${API_BASE}/books/${articleId}/`);
    expect(res.ok).toBe(true);

    const detail = await res.json();
    expect(detail).toHaveProperty("id", articleId);
    expect(detail).toHaveProperty("title");
    expect(detail).toHaveProperty("sections");
    expect(detail).toHaveProperty("quizzes");
    expect(Array.isArray(detail.sections)).toBe(true);
    expect(Array.isArray(detail.quizzes)).toBe(true);

    // Check section structure
    if (detail.sections.length > 0) {
      const section = detail.sections[0];
      expect(section).toHaveProperty("order");
      expect(section).toHaveProperty("type");
      expect(section).toHaveProperty("text");
    }

    // Check quiz structure
    if (detail.quizzes.length > 0) {
      const quiz = detail.quizzes[0];
      expect(quiz).toHaveProperty("type");
      expect(quiz).toHaveProperty("question");
      expect(quiz).toHaveProperty("answer");
      expect(quiz).toHaveProperty("explanation");
      expect(["multiple_choice", "true_false"]).toContain(quiz.type);
    }
  });

  // --- Games list ---
  it("GET /games/ → returns games with expected fields", async () => {
    const res = await fetch(`${API_BASE}/games/`);
    expect(res.ok).toBe(true);

    const games = await res.json();
    expect(Array.isArray(games)).toBe(true);
    expect(games.length).toBeGreaterThan(0);

    const game = games[0];
    expect(game).toHaveProperty("slug");
    expect(game).toHaveProperty("title");
    expect(game).toHaveProperty("description");
    expect(game).toHaveProperty("coin_cost");
    expect(game).toHaveProperty("session_minutes");
    expect(game).toHaveProperty("bundle_url");
    expect(typeof game.slug).toBe("string");
    expect(typeof game.coin_cost).toBe("number");
    expect(typeof game.session_minutes).toBe("number");
  });

  // --- Game bundle accessible ---
  it("Game bundle_url is accessible", async () => {
    const listRes = await fetch(`${API_BASE}/games/`);
    const games = await listRes.json();
    const game = games.find((g: any) => g.bundle_url);

    if (!game) {
      console.warn("No game with bundle_url found, skipping");
      return;
    }

    const res = await fetch(game.bundle_url);
    expect(res.ok).toBe(true);
  });

  // --- Auth: login ---
  it("POST /auth/login/ with valid creds → returns token", async () => {
    const res = await fetch(`${API_BASE}/auth/login/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: TEST_USER, password: TEST_PASS }),
    });
    expect(res.ok).toBe(true);

    const data = await res.json();
    expect(data).toHaveProperty("token");
    expect(typeof data.token).toBe("string");
  });

  it("POST /auth/login/ with wrong password → 400", async () => {
    const res = await fetch(`${API_BASE}/auth/login/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "ihfazhtest", password: "wrongpass" }),
    });
    expect(res.ok).toBe(false);
  });

  // --- Children (requires auth) ---
  it("GET /children/ with auth → returns children list", async () => {
    // Login first
    const loginRes = await fetch(`${API_BASE}/auth/login/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: TEST_USER, password: TEST_PASS }),
    });
    const { token } = await loginRes.json();

    const res = await fetch(`${API_BASE}/children/`, {
      headers: { Authorization: `Token ${token}` },
    });
    expect(res.ok).toBe(true);

    const children = await res.json();
    expect(Array.isArray(children)).toBe(true);
  });

  it("GET /children/ without auth → 401", async () => {
    const res = await fetch(`${API_BASE}/children/`);
    expect(res.status).toBe(401);
  });

  // --- Timeline endpoint ---
  it("GET /children/:id/timeline/ → returns activity timeline", async () => {
    // Login to get a child ID
    const loginRes = await fetch(`${API_BASE}/auth/login/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: TEST_USER, password: TEST_PASS }),
    });
    const { token } = await loginRes.json();

    const childRes = await fetch(`${API_BASE}/children/`, {
      headers: { Authorization: `Token ${token}` },
    });
    const children = await childRes.json();

    if (children.length === 0) {
      console.warn("No children found, skipping timeline test");
      return;
    }

    const childId = children[0].id;
    const res = await fetch(`${API_BASE}/children/${childId}/timeline/`);
    expect(res.ok).toBe(true);

    const data = await res.json();
    expect(data).toHaveProperty("results");
    expect(data).toHaveProperty("count");
    expect(Array.isArray(data.results)).toBe(true);
  });

  // --- Balance endpoint ---
  it("GET /children/:id/balance/ → returns coin/star balance", async () => {
    const loginRes = await fetch(`${API_BASE}/auth/login/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: TEST_USER, password: TEST_PASS }),
    });
    const { token } = await loginRes.json();

    const childRes = await fetch(`${API_BASE}/children/`, {
      headers: { Authorization: `Token ${token}` },
    });
    const children = await childRes.json();

    if (children.length === 0) {
      console.warn("No children found, skipping balance test");
      return;
    }

    const childId = children[0].id;
    const res = await fetch(`${API_BASE}/children/${childId}/balance/`);
    expect(res.ok).toBe(true);

    const data = await res.json();
    expect(data).toHaveProperty("coins");
    expect(data).toHaveProperty("stars");
    expect(data).toHaveProperty("recent_transactions");
    expect(typeof data.coins).toBe("number");
    expect(typeof data.stars).toBe("number");
    expect(Array.isArray(data.recent_transactions)).toBe(true);
  });
});
