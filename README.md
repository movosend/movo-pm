# Movo PM

Herramienta interna de solo lectura para la planning quincenal del equipo de Movo: una lente sobre el ciclo activo de Linear (bloqueos, cadena crítica, sub-issues varadas). No reemplaza a Linear ni escribe en él. Uso exclusivo para devs de Movo.

Ver `movo-pm-preplan.md` para el dominio completo y `docs/mockup.html` para la referencia de interfaz.

## Setup local

1. `npm install`
2. Copiar `.env.example` a `.env.local` y completar:
   - `AUTH_SECRET`: generar con `npx auth secret`.
   - `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET`: crear una GitHub OAuth App en la org `movosend` (Settings → Developer settings → OAuth Apps). Callback URL: `http://localhost:3000/api/auth/callback/github` en local, `https://<dominio>/api/auth/callback/github` en producción.
   - `DATABASE_URL`: connection string de un proyecto Neon.
   - `LINEAR_API_KEY`: API key personal de Linear (Settings → Account → Security & Access), **solo servidor**.
   - `LINEAR_TEAM_KEY`: prefijo del equipo en Linear (p.ej. `MOVO`).
   - `LINEAR_WEBHOOK_SECRET`, `ANTHROPIC_API_KEY`, `MAX_ANALYSES_PER_DAY`: se completan en M3/M4.
3. Aplicar el schema a la base: `npm run db:generate && npm run db:migrate`.
4. Dar de alta a los devs del equipo en la allowlist: `npm run db:seed-allowlist -- alice@movosend.com bob@movosend.com ...`. Sin esto, nadie puede entrar aunque pertenezca a la org de GitHub — el gate de acceso exige **ambas** cosas (org `movosend` + email en `allowed_users`).
5. `npm run dev`.

## Comandos

- `npm run dev` / `build` / `start`
- `npm run lint` / `format` / `typecheck`
- `npm run db:generate` — genera migraciones Drizzle a partir de `lib/db/schema.ts`
- `npm run db:migrate` — aplica migraciones pendientes
- `npm run db:studio` — explorador visual de la base
- `npm run db:seed-allowlist -- <email> [...]` — agrega emails a `allowed_users`

## Adding components

```bash
npx shadcn@latest add button
```

Coloca los componentes en `components/ui`. Importar como:

```tsx
import { Button } from "@/components/ui/button"
```
