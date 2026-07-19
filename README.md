# Skkolarship

Phase 0 to Phase 3 scaffold for the Skkolarship service.

## Run locally

1. Copy `.env.example` to `.env.local`
2. Start Postgres with `docker compose up -d`
3. Install dependencies
4. Run `npm run dev`

## Notes

- Node.js is required for the Next.js toolchain.
- Prisma schema is in `prisma/schema.prisma`.
- Phase 1 authentication is wired with Google OAuth and email OTP scaffolding.
- Phase 2 onboarding now has a 3-step flow with upload, review, and manual fields.
- Phase 3 dashboard now has tabs, filters, detail pages, and bookmark toggles using seed data.
