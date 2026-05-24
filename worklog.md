---
Task ID: 1
Agent: Main Agent
Task: Fix claim calculation bug - item rate × quantity was wrong, and update existing claims

Work Log:
- Analyzed claim-form.tsx calculation logic: found it was using `amount = price × quantity` (full sale amount)
- Correct formula should be: `amount = price × (claimRate/100) × quantity` where claimRate is 78% by default
- Added `claimRate` field to Company model in Prisma schema (default 78%)
- Pushed schema changes to Neon database with `prisma db push`
- Regenerated Prisma client
- Updated companies POST API to accept claimRate and multiTierPricing
- Updated companies PUT API to accept claimRate and multiTierPricing
- Updated master-data CompaniesTab: added claimRate input, multiTier checkbox, new table columns
- Fixed claim-form.tsx: added getClaimRate() and calculateClaimAmount() functions
- Updated addProductToClaim, updateQuantity, and shop change effect to use new calculation
- Added claim rate info banner showing "Claim = Price x 78% x Qty"
- Updated item cards to show "Claim: Rs.X/unit (78%)" and breakdown "Rs.X x Qty"
- Updated receipt.tsx: added Claim Rate info, Claim/Unit column, fixed colSpan
- Created /api/claims/recalculate endpoint to fix existing claims in database
- Pushed all changes to GitHub
- Called recalculate API: updated 2 claims with correct amounts
- Verified all claim calculations match expected values (Price × 78% × Qty = Amount)
- Verified all companies have claimRate set to 78%

Stage Summary:
- Claim calculation bug FIXED: now correctly calculates Price × ClaimRate% × Quantity
- All 22 existing claims recalculated (2 were updated with correct amounts)
- ClaimRate is per-company setting (default 78%), editable in Master Data
- Receipt now shows Claim/Unit column with claim rate breakdown
- Site deployed and verified: https://al-falah-traders-claims.vercel.app
