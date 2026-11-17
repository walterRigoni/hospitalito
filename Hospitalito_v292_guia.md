# Hospitalito v292 — agenda profesional y telemedicina

Incluye selector desplegable de especialidades por profesión, agenda propia desde Jornada → Telemedicina / Consultorio, días y horarios separados y precios configurables de 15, 30, 45 y 60 minutos. Los horarios se contrastan con las otras reservas, los bloqueos y el turnero institucional. Cada búsqueda permite consultar perfil, matrícula declarada, dirección, precio y disponibilidad. La matrícula declarada no sustituye su verificación profesional.

## Cobros: preparados, desactivados

El propietario no definió aún la comisión ni vinculó las cuentas de cobro. No se eligió un porcentaje ni se configuraron importes por él. La configuración inicial impide reservar consultas con pago y realizar cobros. Los profesionales pueden guardar y publicar sus agendas y precios.

La integración usa Mercado Pago Checkout Pro Marketplace 1:1. Las tarjetas se ingresan en Mercado Pago. La teleconsulta cobra el bloque completo y usa marketplace_fee para separar el importe de Hospitalito del importe del profesional. El profesional vincula su propia cuenta mediante OAuth. El split acredita las cuentas de Mercado Pago; el retiro a cuentas bancarias depende de la configuración de cada cuenta, no de una transferencia bancaria implementada por Hospitalito.

En consultorio particular se cobra por adelantado sólo el porcentaje de Hospitalito, a la cuenta configurada para la plataforma. El saldo se muestra como pago al profesional después de la atención y no se cobra automáticamente desde Hospitalito.

El servidor calcula los importes en centavos, conserva la comisión y las condiciones aceptadas y verifica el pago contra Mercado Pago, incluyendo moneda, destinatario e importe. Las notificaciones usan HMAC y son idempotentes. Los pagos duplicados o recibidos después de vencer la reserva quedan en revisión para reintegro; no habilitan minutos adicionales. Los reintegros requieren gestión desde Mercado Pago y conciliación administrativa: no están automatizados.

Antes de activar:
- En la cuenta de plataforma: definir el porcentaje de Hospitalito y las condiciones de cancelación/reintegro.
- Configurar la aplicación Marketplace y las credenciales del servidor: HC_TELE_MP_CLIENT_ID, HC_TELE_MP_CLIENT_SECRET, HC_TELE_MP_ACCESS_TOKEN, HC_TELE_MP_COLLECTOR_ID, HC_TELE_MP_WEBHOOK_SECRET y HC_TELE_TOKEN_KEY (32 bytes aleatorios en base64).
- Registrar el redirect OAuth exacto https://frbuhczonftjtvmviehw.supabase.co/functions/v1/hospitalito-telemed?oauth=1 y las notificaciones de pagos.
- Cada profesional debe autorizar su cuenta mediante “Vincular mi cuenta de Mercado Pago”.
- Probar pagos, rechazos y reintegros con las cuentas de prueba del proveedor. HC_TELE_MP_SANDBOX=true selecciona el modo de prueba; ambas cuentas deben corresponder al mismo entorno.
- Configurar TURN y comprobar una llamada entre redes distintas antes de ofrecer teleconsultas pagas.

Las credenciales se cargan como secretos del servidor; nunca en el HTML, el repositorio ni un chat. Los tokens de los profesionales se almacenan cifrados con AES-GCM y no se entregan al navegador. Sólo la cuenta global de plataforma configura la comisión.

## Sala de teleconsulta

Sala privada de dos participantes autorizados. Audio con cancelación de eco y reducción de ruido, video adaptable, control de cámara/micrófono, cambio de cámara, pantalla compartida, reconexión y modo de ahorro de datos. Usa la configuración TURN ya disponible del servidor (HC_TURN_URLS + HC_TURN_SECRET, o HC_TURN_CF_KEY_ID + HC_TURN_CF_API_TOKEN). Sin TURN no se garantiza conexión en redes restrictivas. No se graba la llamada.

El reloj es del servidor: comienza al informar conexión ambos participantes y se pausa si se pierde la presencia de alguno. La detección de desconexión tiene un margen de hasta 12 segundos. Se avisa cuando quedan dos minutos. Una extensión requiere disponibilidad, oferta del profesional, aceptación del paciente y un nuevo pago aprobado; no hay cargo automático a una tarjeta guardada. Al terminar el tiempo, la aplicación pausa audio y video. Una reconexión que invada otro turno no consume tiempo y debe coordinarse con el profesional. La validación de presencia no certifica que se haya realizado una prestación médica.

## Documentos y comunicación

El profesional puede preparar borradores de informe, receta, certificado y valoración prequirúrgica. Los documentos médicos se ofrecen sólo a médicos; cada profesional actúa dentro de sus incumbencias. La vista imprimible dice “Borrador” y no incorpora una firma electrónica o digital ni constituye una receta electrónica legalmente certificada. Para publicar al paciente, se adjunta el PDF revisado y firmado, emitido por el profesional o su sistema autorizado.

Los PDF se guardan en almacenamiento privado y se consultan sólo por el paciente y su profesional en esa consulta. Los enlaces de descarga vencen en 60 segundos. “Compartir archivo” usa las aplicaciones disponibles en el dispositivo y requiere confirmación. En computadoras que no comparten adjuntos, “Redactar correo” y “Abrir WhatsApp” abren el editor: hay que descargar y adjuntar el PDF y verificar al destinatario antes de enviarlo. No se envían mensajes automáticamente ni se colocan informes clínicos en enlaces públicos.

## DNI y letras pequeñas

OCR local Tesseract.js 7.0.0: mayor resolución acotada para celular, contraste y nitidez adicionales, lectura alternativa de texto disperso, encuadre manual y giro de lectura. Las fotos originales de frente y dorso se conservan. El reconocimiento no recupera detalle de una foto desenfocada y siempre requiere revisar los datos. Las imágenes no se transmiten para ejecutar OCR.

## Validación

- 52 bloques JavaScript analizados.
- 22 comprobaciones transaccionales en Postgres: precios, reservas, comisión, anticipo presencial, conflictos con agendas institucionales, pagos incorrectos, reintentos, repetición de notificaciones, extensiones y reloj.
- 15 comprobaciones de interfaz en pantalla móvil.
- 30 comprobaciones de cámara y selección con dispositivos simulados.
- 10 comprobaciones de sala con dos contextos independientes y audio/video WebRTC real de dispositivos simulados.
- OCR real sobre un DNI ficticio con letras pequeñas; se recuperaron nombre, número y nacimiento sin enviar el documento al servidor.
- Todas las tablas nuevas tienen RLS y no conceden acceso directo a anon/authenticated. Los endpoints verifican sesión propia y propiedad de la consulta. Las cuentas y operaciones de prueba SQL se ejecutaron en una transacción revertida. No se usaron cámaras reales, tarjetas ni pacientes reales.

No se probó un pago real ni una llamada de producción entre redes físicas distintas.

Fuentes de integración:
- https://www.mercadopago.com.ar/developers/es/docs/split-payments/split-1-1/integration-configuration/integrate-marketplace
- https://www.mercadopago.com.ar/developers/es/docs/split-payments/split-1-1/integration-configuration/create-configuration
- https://www.mercadopago.com.ar/developers/en/docs/checkout-pro-preferences/payment-notifications
- https://webrtc.org/getting-started/turn-server
- https://tesseract-ocr.github.io/tessdoc/ImproveQuality.html
