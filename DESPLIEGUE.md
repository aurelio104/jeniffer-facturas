# Despliegue en Vercel (todo en un solo proyecto)

| Componente | Dónde |
|------------|--------|
| **App** | https://jeniffer-facturas.vercel.app |
| **API** | Misma URL, rutas `/api/*` (serverless) |
| **Repositorio** | https://github.com/aurelio104/jeniffer-facturas |

---

## Arquitectura

- **Frontend:** estático (`frontend/dist`) en Vercel CDN.
- **Backend:** función serverless `api/index.ts` (Express).
- **Base de datos:** **Turso** (LibSQL en la nube). SQLite local no funciona en Vercel.

No hace falta Render ni túneles Cloudflare si usas esta guía.

---

## 1. Base de datos Turso (gratis)

1. Crea cuenta en [turso.tech](https://turso.tech).
2. Crea una base (ej. `jeniffer`).
3. Copia:
   - **URL** → `libsql://...`
   - **Auth token** → token de la base

---

## 2. Proyecto en Vercel

1. [vercel.com](https://vercel.com) → Importar repo `jeniffer-facturas`.
2. **Root Directory:** raíz del repo (no `frontend`).
3. Vercel detecta `vercel.json` en la raíz.

### Variables de entorno (Production)

| Variable | Valor |
|----------|--------|
| `DATABASE_URL` | `libsql://...` (Turso) |
| `LIBSQL_AUTH_TOKEN` | Token de Turso |
| `FRONTEND_URL` | `https://jeniffer-facturas.vercel.app` (tu dominio Vercel) |
| `NODE_ENV` | `production` |

### Importante: eliminar URL antigua

Si existía `VITE_API_URL` apuntando a `trycloudflare.com` u otro túnel:

1. Vercel → Project → **Settings → Environment Variables**
2. **Elimina** `VITE_API_URL` (o déjala vacía)
3. **Redeploy** el proyecto

El frontend usa automáticamente `https://tu-dominio.vercel.app/api` (mismo sitio).

### Root Directory

Puede ser **raíz del repo** o **`frontend`** — ambos `vercel.json` incluyen API serverless y build completo.

4. Deploy.

El build ejecuta `prisma db push` y seed de usuarios/catálogos en el primer arranque.

---

## 3. Usuarios iniciales

Tras el primer deploy, inicia sesión con los usuarios del archivo `usuarios` (ej. `admin` / `Admi123`).

---

## 4. Desarrollo local

```bash
npm run dev
```

- Web: http://localhost:3021 (proxy `/api` → 3020)
- API: http://localhost:3020
- BD local: `backend/prisma/dev.db`

---

## 5. Schedulers (BCV / alertas)

En Vercel serverless no hay procesos en background. Las tasas BCV se actualizan al usar la app o puedes añadir un **Vercel Cron** más adelante.

---

## Alternativa: Render + Vercel

Si prefieres API siempre encendida en Render, ver `render.yaml` y despliega solo `frontend` en Vercel con `VITE_API_URL=https://tu-api.onrender.com/api`.

---

## Resumen

| Opción | Frontend | API | BD |
|--------|----------|-----|-----|
| **Vercel solo (recomendado)** | Vercel | Vercel `/api` | Turso |
| Híbrido | Vercel | Render | Turso o SQLite Render |
