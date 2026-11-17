# Hospitalito v290

La v290 mejora el registro del paciente y conserva las funciones de la v289.

## Crear una cuenta

1. Elegí **Registrarse** e ingresá un correo electrónico o un nombre de usuario, y una contraseña de al menos 10 caracteres.
2. Agregá una foto del **frente** y otra del **dorso** del DNI. Cada imagen tiene vista previa y opciones para cambiarla o eliminarla. Se admiten JPG, PNG y WebP de hasta 15 MB; las fotos se preparan antes del envío.
3. El lector intenta completar nombre, DNI y fecha de nacimiento. Revisá los campos y completá lo que falte. Si no reconoce los datos, lo informa y permite continuar a mano. Una nueva lectura conserva las correcciones manuales.
4. Elegí una institución o dejala para más adelante. Confirmá los datos y creá la cuenta.

Las dos caras son obligatorias. El registro acepta correos como usuario. Si el correo o usuario ya tiene cuenta, muestra la opción de iniciar sesión; un error conserva las fotos y los datos del formulario. Al crear la cuenta se intenta abrir el Portal; si el ingreso se interrumpe, la pantalla confirma que la cuenta fue creada y permite iniciar sesión.

## Consultar las fotos

En el Portal, abrí **Cuenta → Datos personales**. Allí aparecen las fotos guardadas del frente y del dorso. Las cuentas anteriores que sólo tenían el frente conservan esa foto. La foto de perfil se mantiene separada de las fotos del documento.

El DNI se guarda en almacenamiento privado y sólo se entrega al titular autenticado o a Administración cuando existe una solicitud de verificación para su institución. La lectura del texto no aprueba automáticamente la identidad ni habilita historias clínicas: se conserva la revisión institucional de la v289.

## Publicación y comprobaciones

- `index.html` y `Hospitalito_v290.html` contienen exactamente la misma aplicación.
- `service-worker.js` renueva la caché de la aplicación a v290.
- `ui/v290-*` y `ui/v290.css` conservan las fuentes de los bloques modificados.
- Se sincronizan en el repositorio las funciones de registro y autenticación que ya fueron actualizadas en Supabase.
- Las comprobaciones del lector y del flujo de registro se hicieron con datos e imágenes ficticias. Se verificaron lectura incompleta, correcciones manuales, eliminación de imágenes durante una lectura, errores de conexión, duplicados, fotos privadas y limpieza de registros incompletos. La lectura de un documento real depende de la calidad de la foto.

Comprobaciones sin navegador:

```sh
node tests/portal-identity.cjs
node tests/portal-registration.cjs
```

El segundo comando requiere una versión de Node.js que incluya `stripTypeScriptTypes`; se comprobó con Node.js 24. Las pruebas se ejecutan con datos en memoria y no crean cuentas reales.
