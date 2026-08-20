# Judge Q&A — 25 hostile questions

Short answers. Do not argue. Offer a live click if it helps.

1. **Why blockchain and not a database?**
   The database *is* the operational system of record. The chain is an integrity proof: a soulbound token whose only payload is a `keccak256` commitment, so a checkpoint in Tawang can verify “this credential was issued by MDoNER and has not been revoked” without reading KYC. If Amoy is down, the Postgres mirror still lets staff work. We would not put the geofence on-chain.

2. **Your AI is trained on fake data.**
   Yes. IsolationForest is unsupervised on synthetic NE trajectories (`pnpm sim:generate`) because we cannot hold real tourist GPS under DPDP for a 36-hour hackathon. The *decision* to alert is rules + PostGIS, not the model. The model only ranks. Rules-only mode is one env flip.

3. **What about GPS in low-connectivity Arunachal?**
   The PWA writes pings to IndexedDB and flushes with Background Sync. Turf.js evaluates zones on-device so the tourist sees a warning before the packet arrives. When the tower returns, Postgres de-dupes. SOS falls back to `sms:` with coordinates.

4. **How is this DPDP compliant?**
   Consent at the permission primer (purpose: safety tracking). KYC encrypted with pgcrypto, never logged, never on-chain. RLS so a tourist reads only their rows. Retention cron downsamples pings after 24 h. Right to erasure = delete tourist → cascade. Lawful basis: consent + public safety for the control room. See `docs/PRIVACY-DPDP.md` if present.

5. **What does this cost to run at 10,000 tourists?**
   Ingest is PostgREST, not Vercel invocations (50 Hz at 10k × 1 ping / 30 s stationary is fine). Supabase free is 500 MB — we downsample to `location_tracks`. Vercel Hobby + Groq free + HF CPU Basic + Amoy testnet = **₹0** at demo scale. At 10k we would still stay on the same architecture; the first paid line is SMS and a non-pausing DB, not a rewrite.

6. **What happens when the tourist's battery dies?**
   Last ping stands. `pg_cron` raises `signal_lost` after `SIGNAL_LOST_MINUTES` (default 20). Control room sees a stale marker, not a false “safe”. The digital ID remains verifiable at a checkpoint without the phone battery if they printed/screenshotted the QR earlier; otherwise staff use the name + last-4 KYC against the mirror.

7. **Isn't this surveillance?**
   Tracking is opt-in, trip-scoped, and visible to the tourist (`/home` safety score, `/alerts`). It is not a city-wide camera grid. Emergency contacts are notified only at `critical`. We do not sell data. The design choice is “panic button that actually reaches a human,” not continuous behavioural advertising.

8. **RLS is on every table — prove it.**
   `supabase/migrations/20250101000900_rls.sql` — `alter table … enable row level security` plus policies. Service role is server-only. The tourist JWT cannot `select` another tourist’s pings.

9. **Your map needs an API key.**
   No. MapLibre + OpenFreeMap, no token. Offline: PMTiles or a GeoJSON envelope we ship in `/public/offline`.

10. **Free tiers will rate-limit you during the pitch.**
    That is why the four switches exist: `DB_MODE`, `CHAIN_MODE`, `AI_MODE`, `NEXT_PUBLIC_MAP_TILE_MODE`. We rehearsed unplugged. See `docs/OFFLINE-DEMO.md`.

11. **Polygon Amoy is a toy. Government will want mainnet / India chain.**
    Amoy is the demo rail (free POL, EVM). The contracts are vanilla OpenZeppelin v5; redeploying to mainnet Polygon or an India CBDC-adjacent EVM is a config change, not a rewrite. We will not demo mainnet with a hackathon key.

12. **Soulbound tokens are controversial / not transferable — what if the tourist loses the phone?**
    The token is bound to a custodial wallet derived on the server (`m/44'/60'/0'/0/{hd_index}`). The tourist never holds a seed. Re-issue is an admin revoke + issue. The QR is a view of the VC, not the private key.

13. **keccak256 commitments can still be brute-forced (Aadhaar).**
    We salt per tourist (`kyc_salt`), normalise the identifier, and never put the salt on-chain. Rainbow tables of 12-digit Aadhaar without salt are irrelevant. Indian onboarding also rejects numbers that fail the UIDAI Verhoeff checksum before anything is hashed. DigiLocker is the Indian fetch path — the in-app portal mirrors sign-in, consent, and issued XML fetch, then the same parsers fill the form. The number is still encrypted in Postgres and only a keccak256 commitment goes on-chain.

14. **PostGIS in the hot path will melt.**
    Containment is GiST on `geography`. 10 writes/s is noise. The dangerous bug is duplicate alerts — that is a partial unique index on open `(tourist, type, zone)`, not CPU.

15. **Why not Firebase / AWS / Twilio?**
    All three fail the SIH constraint (card or Blaze). Twilio SMS is the one genuinely paid channel; `sms.stub.ts` is the interface if a ministry later funds it.

16. **The IsolationForest will page on a bus stuck in traffic.**
    Dwell + itinerary corridor + speed plausibility are rules in PL/pgSQL. Anomaly score only *escalates* an existing incident. A parked tourist in a safe zone does not create a critical.

17. **E-FIR is a legal document. An LLM cannot file it.**
    Correct. We draft a narrative PDF for the officer. `approved_by` is a human. Nothing is submitted to CCTNS from this repo.

18. **How do you stop a malicious tourist app from spoofing GPS?**
    We cannot stop a rooted phone. We can refuse implausible speed (`IMPLAUSIBLE_SPEED_KMH`), require a session JWT, and treat SOS as higher-trust because it is a user gesture. Checkpoint QR still binds the person to the credential.

19. **Multilingual?**
    UI catalogues en/hi/as/bn/ne. Alert copy is templated in those five; LLM translation is best-effort and skipped in `rules-only`.

20. **Vercel Hobby sleeps / Supabase pauses after 7 days.**
    GitHub Action hits `/api/health` every 6 hours. Local `supabase start` is the stage fallback.

21. **Who is the data fiduciary?**
    MDoNER (or the deploying tourism department). We are a processor in this prototype. Consent copy names safety monitoring, not marketing.

22. **Inner Line Permit / border areas — are you leaking troop locations?**
    Responder base points are police/tourist-police stations from the seed, not patrol tracks. Border polygons are public-ish caution zones (Bum La *approach*), not a classified overlay.

23. **Why FastAPI on Hugging Face instead of scoring in Next.js?**
    scikit-learn + a 2 vCPU Space keeps the Vercel bundle small. The same ONNX file is embedded so scoring never depends on the Space staying awake.

24. **Can a responder acknowledge from Telegram by accident?**
    Callbacks are signed with the bot secret header, bound to `incident_id`, and write `incident_events` with actor label. Double-ack is idempotent.

25. **If we fund you, what is month-one production work?**
    (1) SMS via a ministry short-code, (2) real ILP/KYC adapter, (3) non-pausing Postgres, (4) Amoy → Polygon mainnet with a hardware-backed issuer, (5) a threat model + CERT-In intake. The geofence engine does not change.
