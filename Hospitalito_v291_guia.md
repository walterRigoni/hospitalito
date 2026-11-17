# Hospitalito v291

Basada en v290. Mejora la carga del frente y el dorso del DNI en el registro de clientes/pacientes.

## Cargar las fotos

- **Elegir del álbum**: abre un selector nuevo en cada intento y renueva la vista previa al elegir otra imagen, aunque tenga el mismo nombre.
- **Usar cámara**: solicita permiso para abrir la cámara, prefiere la trasera y permite **Sacar foto**. Al capturar, cerrar, cambiar de lado o salir del formulario se detiene la cámara. Si la cámara web no está disponible, se ofrece la captura nativa del dispositivo.
- **¿No aparece tu foto reciente? → Buscar en archivos**: abre el selector de archivos sin el filtro del álbum. El sitio no puede actualizar el índice de fotos del celular ni ampliar sus permisos; la ayuda explica cómo buscar en Recientes/Cámara y revisar el acceso a la foto.

Se permiten imágenes de hasta 15 MB que el navegador pueda decodificar. Las fotos se convierten a JPEG para el registro. Si un formato no se puede abrir, se informa y se puede usar la cámara o elegir JPG, PNG o WebP. Cancelar o elegir un archivo inválido conserva la foto anterior. Cada lado se puede reemplazar o eliminar por separado.

La lectura de datos se inicia después de seleccionar o capturar la imagen. Las fotos se envían cuando se confirma **Crear cuenta** y se guardan de forma privada en **Cuenta → Datos personales**.

## Comprobaciones

Se comprobaron los 49 bloques JavaScript y 30 casos en navegador con cámara simulada e imágenes ficticias: selección, cancelación, reemplazo, captura, permisos denegados, captura nativa, cierre de una cámara pendiente, limpieza de recursos, envío de ambos lados y ancho de pantalla de 320, 390 y 768 píxeles. No se usaron cámaras reales ni se crearon cuentas reales. La vista nativa del álbum y los permisos de cada celular requieren comprobación en el dispositivo.

```sh
node tests/portal-camera.cjs
```

La prueba requiere Playwright y Chromium instalados. Puede configurarse `BROWSER_EXECUTABLE` para indicar un navegador compatible.
