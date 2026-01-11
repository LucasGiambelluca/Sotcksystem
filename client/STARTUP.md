# Guía de Inicio - StockSystem

Sigue estos pasos para ejecutar la aplicación en tu computadora.

## 1. Abrir la Terminal
Abre tu terminal o línea de comandos (PowerShell, CMD, o la terminal de VS Code).

## 2. Navegar a la carpeta del cliente
La aplicación se encuentra en la carpeta `client`. Ejecuta el siguiente comando para entrar:

```bash
cd client
```

## 3. Instalar Dependencias
Si es la primera vez que ejecutas el proyecto o si has tenido errores, es recomendable instalar las dependencias nuevamente:

```bash
npm install
```

> **Nota:** Si encuentras errores de permisos (EPERM), intenta cerrar otros programas que puedan estar usando los archivos (como otros servidores de node) o ejecuta la terminal como Administrador.

## 4. Iniciar el Servidor de Desarrollo
Una vez instaladas las dependencias, inicia la aplicación con:

```bash
npm run dev
```

## 5. Abrir en el Navegador
Verás un mensaje indicando que el servidor está corriendo, generalmente en:
`http://localhost:5173`

Abre esa dirección en tu navegador web para usar el sistema.

---

## Solución de Problemas Comunes

### Error "npm run dev" falla inmediatamente
1. Borra la carpeta `node_modules` y el archivo `package-lock.json` dentro de `client`.
2. Ejecuta `npm install` nuevamente.
3. Intenta `npm run dev` otra vez.

### Error de "Missing script"
Asegúrate de estar dentro de la carpeta `client` antes de ejecutar los comandos `npm`.
