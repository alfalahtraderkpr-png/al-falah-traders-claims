---
Task ID: 1
Agent: Main Agent
Task: Fix Application Error crash when adding products

Work Log:
- Investigated the "Application error: a client-side exception has occurred" issue
- Found that the Neon database schema was in sync (wholesalePrice, lmtPrice columns exist)
- Discovered the root cause: when API calls fail (Neon connection timeout, cold start), the response is an error object like `{error: "Internal server error"}` instead of an array
- The React components were calling `.map()` on these error objects, causing a crash
- Added `neonConfig.poolQueryViaFetch = true` in db.ts to force HTTP fetch mode instead of WebSocket for more stable database connections
- Added `error.tsx` error boundary component for graceful error handling
- Added `res.ok` and `Array.isArray()` validation in ALL data loading functions across 5 components
- Pushed fix to GitHub, Vercel auto-deployed, all APIs verified working

Stage Summary:
- Fixed files: db.ts, error.tsx (new), master-data.tsx, claim-list.tsx, claim-form.tsx, dashboard.tsx, reports.tsx, products/route.ts
- Key fix: API response validation prevents .map() crash on error responses
- Key fix: neonConfig.poolQueryViaFetch = true for stable Neon connections
- Key fix: error.tsx boundary catches any remaining unhandled errors gracefully
- All APIs tested and working on live Vercel deployment
