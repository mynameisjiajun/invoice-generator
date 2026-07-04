Task 1: complete (commits 7e1ae8c..b536e03, review clean)
Task 2: complete (commits b536e03..4c59cff, review clean)
  Minor (deferred to final review): formatSGD relies on en-SG ICU locale + replace cleanup; brief's manual fallback is more portable across browsers. No negative-input tests.
Task 3: complete (commits 4c59cff..e8b9e77, review clean)
  Minor (deferred): tlv() length prefix unbounded >99 chars — currently impossible at call sites. Real-device QR scan still pending (Task 10 step).
Task 4: complete (commits e8b9e77..a9f9168, review clean). Cloud infra done by orchestrator: project gjsiholuyrqrqgyrfewu (Singapore), migration applied via Management API, signups disabled, user chuajiajun2705@gmail.com created (password in .env.local APP_LOGIN_PASSWORD). DB password unknown (reset unavailable) — Management API query endpoint used instead.
  Minor (deferred): no isOverdue unit test; isOverdue UTC-vs-local midnight nit; no index on invoices.customer_id.
Task 5: complete (commits a9f9168..041a91b, review clean). Orchestrator verified live credential login (HTTP 200, role authenticated).
  Minor (deferred): login inputs lack <label>/aria-label; error msg lacks aria-live; signOut no error guard.
Task 6: complete (commits 041a91b..39855a3, review clean)
  Minor (deferred): ok() null-data edge cast; delete() silent no-op on missing rows; setPaid uses UTC date not SGT.
Task 7: complete (commits 39855a3..918880e incl. fix commit, re-review approved). Live CRUD + RLS verified by orchestrator; preset "Photo & Video Shoot without Edit" $250 seeded.
Task 8: complete (commits 918880e..38aa493 incl. fix, re-review approved). Live draft->finalize verified (A-30, seq reset to 30 after test cleanup).
  Minor (deferred): preset filter can retain qty-only blank line; stray localStorage form can resurface after draft-resume.
Task 9: complete (commits 38aa493..0cfb9e4, review clean)
Task 10: complete (commits 0cfb9e4..493d861 incl. fix). Invoice detail page with client-side PDF + PayNow QR. Real-device QR scan pending human verification.
Task 11: complete (commit 21828d1, review clean). Stats page with yearly/monthly/client breakdowns. 3 new tests, 21 total passing.
Task 12: complete (commit 7d178bf, review clean). PWA manifest, icons, layout metadata + viewport. Build verified. Vercel deploy pending user action.
