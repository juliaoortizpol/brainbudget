# Backend architecture

## Composition and entry points
src/main.ts bootstraps Nest on PORT (default 3000), enables CORS for FRONTEND_URL
(default http://localhost:5173), and installs DTO validation with whitelist,
transformation and rejection of unknown properties.
src/app.module.ts composes ConfigModule, MongoDB, throttling and feature modules.
src/config/validate-environment.ts validates environment configuration.
Beta/production enable throttling; bootstrap enables Helmet for those environments.

src/modules contains accounts, auth, budgets, users, transactions, institutions,
gmail-reader, transaction-mail-import and report schemas. Controllers expose HTTP
interfaces, DTOs validate inputs, services perform work, schemas define persistence.
Some imports use @/ mapped to src; build runs tsc-alias after Nest compilation.
Report schemas alone do not establish a complete reporting API.

## Data and contracts
MongoDB is accessed through Mongoose. User identifiers are Mongo ObjectIds.
Review service ownership filters and soft-delete behavior before modifying queries.
Transactions use number amounts, date, expense/income type and optional currency.
Gmail persistence uses upsert with $setOnInsert and a unique partial index on
userId/source/sourceMessageId. Preserve idempotency and account matching semantics.
Budget aggregation and rounding live in BudgetsService.appendSpentToItems.

## Integration
Frontend requests use JWT Bearer authentication. The frontend dev proxy strips
/api and forwards to port 3000; backend routes do not have that /api prefix.
Password login returns access_token. Google login redirects to the frontend
/auth/callback with a token query parameter in the current implementation.
Gmail connection is separate from Google sign-in; inspect its controllers and
pipeline contracts before changing scopes, callbacks, parsing or persistence.

## Configuration
MONGODB_URI is required even outside deployed environments. Use an isolated local
database. JWT, Google OAuth, frontend and Gmail callback settings are described by
.env.example and the environment validator. Placeholder example values are not
usable credentials. Real Google sign-in/Gmail requires authorized test credentials.
Never point tests at a production mailbox or database.
