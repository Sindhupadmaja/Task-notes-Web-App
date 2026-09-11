# Task & Notes Web Application

A CRUD task-management API with JWT authentication, built on Node.js,
Express, and MongoDB. First project in a four-part series tracing a
backend engineer's progression from a single-service CRUD app (this one)
through a modular multi-resource API, a concurrency-safe booking platform,
and finally a multi-tenant SaaS platform with RBAC and observability.

## Why it's built this way

- **Service layer is framework-agnostic.** `AuthService` and `TaskService`
  don't know Express exists — they take plain objects in, return plain
  objects or throw typed errors out. That's what makes them unit-testable
  with mocked Mongoose models and no real database connection (see
  `tests/unit/authService.test.js` and `tests/unit/taskService.test.js`).
- **A typed error hierarchy, not string-matching.** Every thrown error is a
  subclass of `ApiError` (`BadRequestError`, `UnauthorizedError`,
  `ForbiddenError`, `NotFoundError`, `ConflictError`) with its own status
  code baked in. The central error-handling middleware just checks
  `err instanceof ApiError` — no route ever hand-formats its own error
  response.
- **Ownership is enforced in the query, not checked after the fact.** Every
  `TaskService` method takes `ownerId` as its first argument and every
  database call is scoped to it. There's no code path where a task lookup
  happens first and an ownership check happens second — which is exactly
  the kind of bug (fetch first, forget to check, or check the wrong field)
  that IDOR vulnerabilities come from.
- **Login never reveals whether the email or the password was wrong.**
  `tests/unit/authService.test.js` verifies this directly by comparing the
  error from a nonexistent email against the error from a wrong password —
  they're identical, on purpose.

## Architecture

```
Request
  │
  ▼
Express app (app.js)
  │
  ├─ /health                         (no auth)
  ├─ /api/auth/register, /login      (validators → controller → AuthService → User model)
  └─ /api/tasks/*                    (requireAuth → validators → controller → TaskService → Task model)
                                                        │
                                            every query scoped to req.userId
  │
  ▼
Central error handler (errorMiddleware.js)
  - ApiError subclasses → their own status code
  - Mongoose ValidationError / CastError / duplicate-key → mapped to 400/409
  - anything else → generic 500, logged server-side, never leaked to the client
```

## Project layout

```
task-notes-web-app/
├── src/
│   ├── app.js                  # Express app assembly (no listen() -- testable in isolation)
│   ├── server.js                # entry point: loads env, connects DB, starts listening
│   ├── config/db.js              # MongoDB connection
│   ├── models/User.js, Task.js    # Mongoose schemas
│   ├── services/AuthService.js, TaskService.js   # framework-agnostic business logic
│   ├── controllers/                # thin HTTP adapters over the services
│   ├── middleware/                  # JWT auth guard, validation chains, error handler
│   ├── routes/                       # Express routers
│   └── utils/ApiError.js              # typed error hierarchy
├── tests/unit/
│   ├── authService.test.js             # AuthService, mocked User model
│   ├── taskService.test.js              # TaskService, mocked Task model, ownership enforcement
│   └── httpApi.test.js                   # full HTTP request/response cycle, mocked models
├── Dockerfile                              # multi-stage, non-root user, healthcheck
├── docker-compose.yml                       # api + real MongoDB for local dev
└── .github/workflows/ci.yml                  # lint + test + Docker build on every push
```

## Setup

```bash
git clone <this-repo>
cd task-notes-web-app
npm install
cp .env.example .env    # then edit JWT_SECRET to a real random string
```

### Run with Docker Compose (API + real MongoDB)

```bash
docker compose up --build
```

### Run locally (requires your own MongoDB, e.g. `brew services start mongodb-community`)

```bash
npm run dev      # nodemon, auto-restarts on change
# or
npm start
```

### Run the tests

```bash
npm test
```

**Real, measured result:** 33 tests, all passing, 79.8% statement coverage
across the codebase (94.7% on the Express app wiring, 93–100% on both
service classes — the core business logic). Full breakdown from
`npm test`:

| Layer | Statement coverage |
|---|---|
| `app.js` (Express wiring) | 94.7% |
| `services/AuthService.js` | 96.0% |
| `services/TaskService.js` | 91.4% |
| `middleware/` (auth, error handling, validation) | 78.3% |
| `routes/` | 100% |

Note: unit tests mock the Mongoose models directly, so they run with no
database at all — `docker-compose.yml`'s MongoDB service is for actually
running the API, not for the test suite.

## API reference

| Endpoint | Auth | Description |
|---|---|---|
| `GET /health` | no | Liveness check |
| `POST /api/auth/register` | no | `{name, email, password}` → `{user, token}` |
| `POST /api/auth/login` | no | `{email, password}` → `{user, token}` |
| `POST /api/tasks` | yes | Create a task |
| `GET /api/tasks` | yes | List tasks — `?status=&priority=&search=&sortBy=&order=&page=&limit=` |
| `GET /api/tasks/:id` | yes | Get one task (must be the owner) |
| `PATCH /api/tasks/:id` | yes | Update a task (must be the owner) |
| `DELETE /api/tasks/:id` | yes | Delete a task (must be the owner) |

Authenticated requests need `Authorization: Bearer <token>` from the
register/login response.

```bash
# register
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Ada","email":"ada@example.com","password":"supersecret1"}'

# create a task (replace TOKEN with the token from above)
curl -X POST http://localhost:4000/api/tasks \
  -H "Content-Type: application/json" -H "Authorization: Bearer TOKEN" \
  -d '{"title":"Ship the API","priority":"high","dueDate":"2023-08-01"}'
```

## License

MIT — see [LICENSE](LICENSE).
