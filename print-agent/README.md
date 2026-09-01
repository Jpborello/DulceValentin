# Agente de impresión remota

Programa chico que corre en una PC conectada a la impresora del local. Escucha
la cola de pedidos de impresión del panel de admin y va imprimiendo cada uno
en cuanto llega — sin importar desde dónde se haya mandado (podés estar en
casa y mandarlo desde ahí).

Funciona con **cualquier impresora**: usa el driver que Windows ya tenga
instalado para ella (vía [pdf-to-printer](https://www.npmjs.com/package/pdf-to-printer)),
no depende de la marca.

## Instalación (una sola vez, en la PC del local)

1. Instalar [Node.js](https://nodejs.org) si no está.
2. Copiar esta carpeta `print-agent` a esa PC.
3. Abrir una terminal ahí adentro y correr:
   ```
   npm install
   ```
4. Copiar `.env.example` a `.env` y completarlo:
   - `SITE_URL`: la URL del sitio (`https://www.dulcevalentin.com.ar`)
   - `AGENT_SECRET`: el mismo valor que está cargado como `PRINT_AGENT_SECRET`
     en las variables de entorno del sitio (Vercel)
   - `PRINTER_NAME`: opcional. Dejalo vacío para usar la impresora
     predeterminada de Windows en esa PC.

## Uso

```
npm start
```

Deja la ventana abierta (o configurala para que arranque sola con Windows —
ver más abajo). Mientras esté corriendo, cualquier pedido que se mande a
imprimir desde el panel sale por la impresora de esa PC en unos segundos.

## Que arranque solo con Windows (recomendado)

Para no depender de abrir la terminal a mano todos los días:

1. Crear un acceso directo a `iniciar.bat` (ver abajo) o directamente al
   comando `npm start` dentro de esta carpeta.
2. Copiarlo a la carpeta de inicio de Windows: `Win + R` → escribir
   `shell:startup` → Enter → pegar el acceso directo ahí.

Archivo `iniciar.bat` de ejemplo (crear en esta misma carpeta):
```bat
@echo off
cd /d "%~dp0"
npm start
pause
```

## Notas

- Si la impresora se queda sin papel/tinta o hay un error, el pedido queda
  marcado como "error" en la base y el panel de admin lo muestra — no se
  pierde, se puede reintentar.
- Este agente no sabe nada del rubro del negocio: solo recibe un JSON con
  los datos ya armados (`ticket_data`) y arma un PDF simple para imprimir.
  Por eso se puede reusar tal cual para otro cliente/negocio, cambiando
  solo lo que arma ese JSON del lado del sitio web.
