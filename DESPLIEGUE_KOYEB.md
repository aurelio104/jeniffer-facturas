# Despliegue en Koyeb (recomendado)

Un solo servicio con **volumen persistente** para SQLite: frontend + API + base de datos.

| | |
|---|---|
| **URL activa** | https://jeniffer-facturas-aurelio104-d09b8633.koyeb.app |
| **Salud API** | `/api/health` |
| **Coste** | Instancia **standard** mínima (los volúmenes no funcionan en plan free/eco) |
| **Región** | `was` (Washington) o `fra` (Frankfurt) — obligatoria para volúmenes |
| **Escala** | **1** réplica (requisito del volumen) |

---

## 1. Crear volumen

En [Koyeb Console](https://app.koyeb.com) → **Volumes** → **Create volume**

- Nombre: `jeniffer-data`
- Tamaño: **1 GB** (suficiente)
- Región: la misma que usarás para el servicio (`was` o `fra`)

---

## 2. Crear servicio desde GitHub

1. **Create Web Service** → repositorio `jeniffer-facturas`
2. **Builder:** Dockerfile (detecta `Dockerfile` en la raíz)
3. **Instance:** **Nano** o la standard más pequeña (no eco/free)
4. **Regions:** una sola región (ej. Washington)
5. **Scale:** min **1**, max **1**
6. **Port:** `8000` (HTTP)
7. **Health check path:** `/api/health`

### Montar volumen

En el servicio → **Volumes** → Attach:

| Volumen | Montaje en contenedor |
|---------|------------------------|
| `jeniffer-data` | `/data` |

### Variables de entorno (opcionales)

| Variable | Valor | Notas |
|----------|--------|--------|
| `DATA_DIR` | `/data` | Ya está en Dockerfile |
| `FRONTEND_URL` | `https://TU-DOMINIO.koyeb.app` | O dejar vacío: usa `KOYEB_PUBLIC_DOMAIN` |

No hace falta `DATABASE_URL` ni Turso: SQLite en `file:/data/jeniffer.db`.

---

## 3. Desplegar

Tras el deploy, abre la URL pública:

- App: `https://xxx.koyeb.app`
- Salud: `https://xxx.koyeb.app/api/health`

### Usuarios iniciales

| Usuario | Contraseña | Rol |
|---------|------------|-----|
| `admin` | `Admi123` | admin |
| `jeniffer` | `1234` | operador |

---

## 4. CLI (alternativa)

```bash
# Volumen
koyeb volume create jeniffer-data --region was --size 1

# Servicio (ajusta el nombre de tu app)
koyeb app init jeniffer \
  --git github.com/aurelio104/jeniffer-facturas \
  --git-branch main \
  --git-builder docker \
  --region was \
  --instance-type nano \
  --port 8000:http \
  --route /:8000 \
  --volumes jeniffer-data:/data \
  --health-check /api/health
```

---

## 5. Vercel

Si usabas Vercel solo para frontend, puedes **desactivar** ese proyecto y usar solo Koyeb (todo en una URL).

---

## Desarrollo local

```bash
npm run dev
```

Local sigue usando `backend/prisma/dev.db`.

Probar imagen Docker local:

```bash
docker build -t jeniffer .
docker run --rm -p 8000:8000 -v jeniffer-data:/data jeniffer
```

Abrir http://localhost:8000
