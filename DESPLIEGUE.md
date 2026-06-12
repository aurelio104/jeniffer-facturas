# Despliegue ligero (Vercel + API en la nube)

Jeniffer tiene **frontend** (React/Vite) y **backend** (Express + Prisma).  
Vercel es ideal para el frontend; el API y la base de datos van en otro servicio.

## ¿Se puede todo en Vercel solo?

**No recomendado** con la configuración actual: el API usa SQLite en archivo y Vercel serverless no guarda archivos entre invocaciones.

**Opción sencilla:** frontend en Vercel + API en Render (gratis) + base Turso (gratis) o SQLite en Render.

---

## 1. Crear usuarios (admin)

Ya está en la app:

1. Inicia sesión como `admin` / `Admi123`
2. Menú **Usuarios** o Panel → **+ Usuario**
3. Rellena usuario, nombre, contraseña y rol (`operador` o `admin`)

---

## 2. Frontend en Vercel

1. Conecta el repo en [vercel.com](https://vercel.com)
2. **Root Directory:** `frontend`
3. **Environment variable:**
   - `VITE_API_URL` = `https://TU-API.onrender.com/api`
4. Deploy

El archivo `frontend/vercel.json` ya configura SPA y build de Vite.

---

## 3. Backend en Render (recomendado)

1. Crea un **Web Service** desde el mismo repo
2. Usa `render.yaml` (root del repo) o configura manualmente:
   - Root: `backend`
   - Build: `npm install && npm run build && npx prisma db push`
   - Start: `npm start`
3. Variables de entorno:
   - `FRONTEND_URL` = `https://tu-app.vercel.app`
   - `DATABASE_URL` = ver sección Turso abajo (mejor) o `file:./prisma/dev.db`

Copia la URL del servicio (ej. `https://jeniffer-api.onrender.com`) y ponla en `VITE_API_URL` en Vercel.

---

## 4. Base de datos Turso (opcional, mejor para nube)

El proyecto ya usa el adaptador LibSQL de Prisma.

1. Crea una base en [turso.tech](https://turso.tech) (plan gratis)
2. En Render, configura:
   - `DATABASE_URL` = URL `libsql://...` de Turso
   - `LIBSQL_AUTH_TOKEN` si Turso lo exige (según tu cuenta)
3. Ejecuta `npx prisma db push` en el build (ya está en `render.yaml`)

Para migrar datos locales: exporta/importa o usa el backup desde el panel admin.

---

## 5. Desarrollo local

```bash
npm run dev
```

- Web: http://localhost:3021
- API: http://localhost:3020

---

## Resumen de URLs

| Componente | Dónde | Coste típico |
|------------|--------|--------------|
| Frontend | Vercel | Gratis |
| API | Render | Gratis (con limitaciones) |
| BD | Turso o SQLite en Render | Gratis |

Total: **ligero y sin servidor propio**, adecuado para uso interno de Jeniffer.
