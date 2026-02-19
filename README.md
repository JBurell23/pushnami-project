# Arc Raiders Landing Page System

A multi-service A/B testing platform with metrics tracking and admin controls. Built with React, Node.js, Express, TypeScript, and PostgreSQL.

###### Architecture ######

Four services orchestrated via Docker Compose:

1. **Landing Page** - React app that requests variant assignment and tracks user interactions
2. **Admin Dashboard** - React app for feature toggles and viewing stats
3. **AB Service** - Assigns visitors to variants (A/B) consistently using cookies
4. **Metrics Service** - Ingests events and provides aggregated statistics

PostgreSQL stores experiment configuration and event data.

###### How to Start ######

```bash
docker compose up --build
```

Then access:
- Landing Page: http://localhost:5173
- Override Landing Page Variant A: http://localhost:5173/?variant=A
- Override Landing Page Variant B: http://localhost:5173/?variant=B
- Admin Feature Toggles: http://localhost:5174
- Admin Stats Dashboard: http://localhost:5174/stats

**Port Configuration**: If ports are already in use, feel free to change them in `docker-compose.yml`.
- **Frontend ports** (5173, 5174): Update `docker-compose.yml` port mappings (lines 61, 72) and corresponding `vite.config.ts` files (`services/landing/vite.config.ts` line 8, `services/admin/vite.config.ts` line 8)
- **Backend ports** (4001, 4002): Update `docker-compose.yml` port mappings (lines 21, 41) and `PORT` environment variables (lines 23, 43)
- **Database port** (5433): Update `docker-compose.yml` port mapping (line 9)

**Variant Assignment**: On first visit, you're assigned a variant based on visitor ID hash (50/50 split). The assignment persists via cookies. 
To test organic assignment, open the landing page to receive an initial variant. To get a fresh assignment, clear the site cookies and reload the landing page. You can also do this in an incognito window. 
You can manually override using the URLs above, or submit the "Playstyle Poll", if it leans PvP, you'll see Variant A on refresh; if PvE, you'll see Variant B. Poll-based reassignment can be toggled off in the admin dashboard.
If the A/B feature is toggled off only variant A will be shown unless the override URL is used.

**Data Persistence**: All user interaction events (page views, clicks, poll submissions, etc.) are sent to the database for analytics. Favorite gun selections and tier list rankings are tracked as events but do not persist UI state across page refreshes. This keeps the demo focused on A/B testing metrics rather than user preference storage.


###### Design Decisions ######

**Cookie-based variant assignment**: Visitors get a consistent variant across visits using cookies. If no cookie exists, assignment is deterministic based on visitor ID hash, ensuring 50/50 split.

**Feature toggles in database**: All experiment configuration (enabled/disabled, section visibility, CTA behavior) is stored in PostgreSQL and fetched on each page load. This allows runtime changes without code deploys.

**Event-driven metrics**: Landing page sends events to metrics service for all interactions. Stats are calculated via SQL aggregations, not stored pre-computed.

**Variant-specific behavior**: Variant A shows tier ranking (drag-and-drop), Variant B shows favorite gun selection (quick selection). This creates behavioral differences and is an example of a different interaction experience based on variance.


###### Production Readiness ######

**Error handling**: Centralized error middleware in all Express services.

**Type safety**: Full TypeScript coverage. Zod validation on API inputs. Parameterized SQL queries prevent injection.

**Database**: Indexed columns on the events table (`variant`, `event_type`, `visitor_id`, `created_at`). JSONB for flexible metadata. Health checks ensure services are ready before dependencies start.

**Security**: CORS configured for specific origins. Input validation on all endpoints. Environment variables with safe defaults.

**Observability**: Health check endpoints (`/health`) on all services. Structured error logging. Database connection retries.

**Scalability**: Stateless services (except cookie assignment) can be horizontally scaled. Database queries use indexes for performance.

**Approach to Production Readiness**: Each feature was evaluated against production standards (error handling, type safety, security, observability). Code was reviewed and refined to ensure it meets these standards before implementation. This systematic approach ensures the system is ready for deployment.
