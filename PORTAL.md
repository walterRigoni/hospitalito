# Portal de clientes · v289

La interfaz se incluye en `index.html` y en el archivo HTML descargable. `ui/` conserva los módulos editables; no se carga código privado en el navegador. El registro OCR usa Tesseract.js 7.0.0 en el navegador, con trabajador y núcleo fijados a 7.0.0. No se usa un servicio de OCR remoto. La foto se envía al registro sólo después de la confirmación del usuario; el OCR nunca concede permisos.

## Autorización

`hospitalito-portal` comprueba la clave publicable y el token de sesión propio de Hospitalito en cada solicitud. `verify_jwt=false` corresponde a esta autenticación propia; no autoriza solicitudes sin credenciales, excepto directorio optativo y registro limitado por frecuencia.

Las tablas `hc_portal_*` tienen RLS habilitada y no conceden acceso a `anon` ni `authenticated`. Sólo las funciones del servidor acceden con el rol de servicio, después de comprobar la cuenta activa, rol e institución. El aviso informativo de RLS sin políticas es intencional en esta arquitectura de acceso exclusivo por funciones; no se abrió una política pública para silenciarlo.

El rol `cliente` no recibe membresía clínica. Los endpoints de login admiten cuentas cliente sin instituciones. La API de cuentas limita sus acciones a perfil, contraseña y notificaciones propias; los endpoints clínicos continúan exigiendo membresías. El Portal filtra por el usuario autenticado, no por un DNI o usuario enviado desde el navegador.

La verificación es una relación `(usuario, institución)`. Hospitalito global o Administración autorizada de esa institución revisan el documento y registran fundamento y ficha. Se comprueba la coincidencia del DNI y se impide vincular dos identidades verificadas a la misma ficha. La revocación se comprueba nuevamente al consultar informes o solicitar sus adjuntos.

El depósito `hospitalito-portal-private` no es público y admite imágenes/PDF de hasta 5 MB. Los documentos de identidad sólo se entregan a quienes verifican en la institución solicitada. Los adjuntos publicados se ofrecen mediante enlaces firmados de 60 segundos después de comprobar propiedad y autorización. No hay rutas de documentos ni nombres de otros pacientes en el calendario público de disponibilidad.

## Agenda y concurrencia

Los profesionales publican voluntariamente perfiles y horarios, con publicación institucional independiente. Las agendas institucional y particular del mismo profesional comparten sus ocupaciones. La consulta combina reservas, bloqueos manuales y el turnero que ya está almacenado en `hc_state`; no afirma una conexión con turneros externos.

Las reservas se validan en un disparador de Postgres con bloqueo transaccional por profesional: cuenta y membresía activas, institución y agenda publicadas, identidad institucional verificada, día/horario/duración/alineación válidos y ausencia de superposición. También se protegen los guardados del turnero previo y de bloqueos manuales en ambas direcciones. Las reservas pendientes ocupan el horario; cancelar lo libera. Las modificaciones recientes de horarios nativos prevalecen sobre la publicación anterior. Las fechas locales sin zona se interpretan en America/Argentina/Buenos_Aires.

Los resultados se guardan con revisión y comparación de versión bajo bloqueo de fila. Un borrador se almacena separado del contenido publicado. Publicar una corrección conserva la versión publicada previa. Médico emite solicitudes; sólo el servicio correspondiente publica sus informes. Un error posterior de auditoría no elimina un adjunto de un informe ya confirmado.

## Migraciones y funciones

Migraciones: `20261115033441_patient_portal_v289.sql`, `20261115040809_portal_booking_guards_v289.sql`, `20261115041053_portal_schedule_time_v289.sql`.

Funciones actualizadas: `hospitalito-auth` v7, `hospitalito-login` v2, `hospitalito-passkeys` v2; nueva `hospitalito-portal` v4. Se mantuvieron los endpoints clínicos existentes y sus mecanismos de guardado, mezcla y recepción incremental. Las preferencias visuales nuevas se conservan al guardar ajustes anteriores del perfil.

## Validación

Se ejecutaron pruebas del servidor real con dos clientes, dos instituciones y cuatro servicios ficticios. Se verificaron identidad y documento privados, separación por institución/cliente, publicación y corrección de tres tipos de informes, revisiones concurrentes, revocación y denegación de acceso clínico. Se probaron carreras entre dos reservas y entre una reserva y un bloqueo; el turnero previo y las reservas se protegieron mutuamente. También se verificaron cambios de horarios con fechas locales, acceso anónimo denegado y depósito privado.

La interfaz se probó en escritorio y celular, incluyendo los 16 pares de tema, fuentes, menú, pantalla completa de Miembros, búsqueda, horarios libres/ocupados, urgencia y conservación del formulario al bloquearse. Se leyó una imagen de DNI expresamente ficticia con el OCR real del navegador; no se transmitió al servidor. El acceso WebAuthn se probó con un autenticador virtual, firma real verificada, restricción de origen y desafíos de un solo uso. Las cuentas, membresías, instituciones y sesiones ficticias quedaron deshabilitadas al finalizar.

La bandeja ambulatoria y los resultados del cliente se comprueban cada ocho segundos mientras están abiertos. Se probó que una solicitud entrante avisa sin borrar el texto de un informe en edición, que guardar el borrador permite actualizar la bandeja y que un informe publicado aparece en el Portal sin reabrir la pantalla. `tests/portal-live-updates.cjs` reproduce esas comprobaciones sin cuentas reales.

Las comprobaciones previas de sincronización clínica, historia, borradores, avisos, permisos y escalas también pasaron. `release-v289.json` registra la huella del HTML entregado. Las pruebas no constituyen una certificación clínica ni una garantía de disponibilidad o latencia de servicios externos.

Pruebas de navegador reproducibles con Node y Playwright: instalar Playwright y su Chromium; ejecutar `node tests/portal-ui.cjs` y `node tests/portal-ocr.cjs` desde la raíz. Puede indicarse un ejecutable existente con `BROWSER_EXECUTABLE`. Las capturas se escriben en `test-artifacts/`. Las pruebas con credenciales temporales del servidor no se publican.
