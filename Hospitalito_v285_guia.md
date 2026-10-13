# Hospitalito v285 — guía de uso

13 de octubre de 2026. Base: v284. Prueba gratuita inicial: **30 días**, modificable por acuerdo.

## Acceso inicial del administrador

El administrador local continúa vinculando el equipo desde **Administración → Institución**. No necesita una vinculación previa para llegar a esa pantalla.

Si aparece **Sesión bloqueada**, ingresá la contraseña habitual del administrador y presioná **Entrar a Administración**. En un equipo sin vinculación se habilita únicamente la configuración institucional. Ingresá el nombre y la contraseña de la institución y elegí **Conectar institución**. Esperá la confirmación de Supabase.

En equipos ya vinculados, el desbloqueo renueva la autorización del servidor. Una contraseña incorrecta o una vinculación revocada no permite continuar. La vinculación se guarda en el navegador o la aplicación que usás; otro navegador puede necesitar su configuración inicial.

La v284 mostraba v283 en el título por un dato de versión que no se había actualizado. La v285 muestra su versión correcta.

## Logos

En Administración → Institución elegí el logo en **Logos del membrete institucional**. Se muestra una vista previa y se guarda automáticamente. Esperá el mensaje **Logo guardado en Supabase**. Si hay un error, la pantalla lo informa y permite volver a presionar **Guardar logos**.

El logo institucional aparece a la izquierda del membrete. Hospitalito ocupa un cuadrado pequeño a la derecha. PNG, JPG y WebP se ajustan automáticamente. El membrete se usa en la historia y las impresiones.

La cuenta Hospitalito puede cargar el logo desde cada tarjeta de institución. Puede configurar también el logo cuadrado general del programa. El control antiguo de logo del admin local se unificó con el nuevo; el cambio de contraseña institucional continúa separado.

## Servicios y camas

Administración → Institución → **Servicios y camas**. Hospitalito también encuentra ese botón en la tarjeta de cada institución.

- Agregá o cambiá el nombre de cada servicio.
- Ajustá su cantidad de camas. En **Ver nombres y habilitación de las camas** podés editar sus nombres o retirar una cama específica.
- **Guardar distribución** confirma el cambio en el servidor.
- Una cama ocupada no puede retirarse. Primero debe resolverse el traslado o alta del paciente.
- Retirar una cama conserva su identificador y sus registros históricos. Se excluye del censo actual.
- Se admiten hasta 100 servicios y entre 1 y 2000 camas habilitadas por institución.
- Si otro administrador modificó la distribución, actualizá antes de guardar: no se sobrescribe su cambio.

El observador puede elegir **Todo** o cualquier servicio del censo. Continúa sin permisos para modificar la historia clínica.

## Contador y administración

El rol **Contador** utiliza internamente el identificador `contabilidad`. Asignalo desde Hospitalito → Usuarios → Accesos de la institución.

Al ingresar, abre su panel de Contabilidad. No inicia la sincronización clínica ni abre las historias de pacientes. Administración accede desde **Contabilidad / Facturación**.

El registro inicial incluye ingresos y egresos, fecha, importe en pesos, categoría, cliente/proveedor, referencia de comprobante y notas. Permite corregir o anular conservando la trazabilidad. Muestra totales y saldo por mes, exporta CSV e imprime.

**Estos registros y las liquidaciones de licencia son internos. No emiten facturas fiscales.** El contador deberá definir tipos de comprobantes, impuestos y eventual integración de facturación fiscal.

## Hospitalito: acuerdos, prueba y cobros

Ingresá con la cuenta Hospitalito y abrí **Facturación**. Se mantienen las herramientas de instituciones, usuarios y accesos.

Los cobros están **desactivados** inicialmente. No se asignaron precios ni contratos de cobro a instituciones reales durante esta actualización.

1. Creá una o varias **cuentas de cobro**, con su titular y alias/CBU/CVU, o con Mercado Pago.
2. Creá un **acuerdo** por institución o usuario. Definí concepto, importe mensual en pesos, cuenta receptora, inicio y fin de prueba y días de gracia.
3. La prueba comienza con 30 días, pero se puede modificar. El fin de prueba también es editable.
4. Los acuerdos nuevos quedan en borrador. Habilitá sólo los que ya tienen condiciones, importe y cuenta definidos.
5. Cuando decidas iniciar la facturación, habilitá **Cobros de los acuerdos activos** en la configuración general.

### Quién paga

- **Institución paga todo:** un acuerdo con “Paga la institución”.
- **Cada usuario paga:** un acuerdo para cada usuario.
- **Mixto:** un acuerdo por la parte de la institución y acuerdos por la parte de sus usuarios. Cada uno puede utilizar una cuenta receptora diferente.

La suma de esas partes es el precio que vos definas. El sistema no calcula automáticamente una distribución porcentual ni presume valores.

Al finalizar la prueba se generan liquidaciones mensuales al consultar el estado de licencia. La generación es idempotente: no duplica un mes. Usa meses calendario y ajusta los días que no existen en un mes. No debita automáticamente una tarjeta y no crea suscripciones de débito automático.

Los usuarios encuentran sus acuerdos, liquidaciones y avisos en **Licencia**. Administración y el contador pueden consultar la facturación institucional. Un usuario común ve la licencia de su institución y sus propios cargos individuales.

### Transferencias

El usuario puede **Informar transferencia**, con la referencia del comprobante. Ese aviso queda pendiente de verificación; no acredita dinero por sí mismo.

Hospitalito puede **Registrar cobro recibido** después de comprobar el ingreso del dinero. Se admiten pagos parciales. Repetir la misma operación no vuelve a sumar el cobro.

### Mercado Pago, tarjetas de crédito y débito

Se preparó la integración con **Checkout Pro**, que abre el pago alojado por Mercado Pago. Los medios disponibles los presenta el proveedor según la cuenta y el pago. Hospitalito no captura números de tarjeta ni códigos de seguridad.

**Falta configurar tus cuentas comerciales en el servidor para usar cobros reales.** Crear el nombre de una cuenta en el panel no instala sus credenciales. Actualmente no hay credenciales de cobro reales ni prueba de un pago real completada.

Para quien configure el servidor:

- En los secretos de Supabase, crear `HC_MP_ACCOUNTS` como un objeto JSON. Cada clave debe ser el ID de la cuenta receptora mostrado por Hospitalito.
- Cada cuenta contiene `accessToken`, `webhookSecret`, `collectorId` y `sandbox` (true para pruebas). Estas claves se cargan directamente en el servidor; nunca en el HTML, el repositorio ni este chat.
- Registrar la notificación Webhook de pagos correspondiente a la integración. La función `hospitalito-finance` agrega el ID de cuenta y la referencia al crear cada preferencia.
- Probar primero con la cuenta de pruebas del proveedor, verificar notificación y acreditación, y luego configurar producción.

El servidor valida la firma de la notificación y consulta el pago al proveedor. Comprueba cuenta receptora, moneda, importe y referencia antes de acreditarlo. El retorno del navegador desde el checkout no acredita un pago. Los estados pendientes no se confunden con aprobados. La misma notificación puede repetirse sin duplicar el importe. Se contemplan cambios de estado y reintegros informados por el proveedor.

El usuario también puede **Verificar mi pago** ingresando el número de pago del comprobante. El servidor verifica que corresponda a su liquidación.

Referencias oficiales: [Preferencias Checkout Pro](https://www.mercadopago.com.ar/developers/es/docs/checkout-pro-preferences/create-payment-preference) y [Notificaciones](https://www.mercadopago.com.ar/developers/es/docs/checkout-pro-preferences/payment-notifications).

### Avisos y servicio

Hospitalito puede enviar un aviso dentro del sistema a una institución o a un usuario. No se enviaron mensajes a usuarios reales en esta actualización.

La pantalla muestra liquidaciones pendientes/vencidas y un aviso próximo al fin de la prueba. Se consulta el estado al ingresar y periódicamente mientras la app está activa. No se configuró un servicio de envío de correo, SMS o WhatsApp.

**Suspender nuevas cargas** deja la historia disponible para consulta y bloquea escrituras en el servidor. **Restablecer nuevas cargas** revierte esa suspensión manual. Si activaste restricción automática por mora, también debe resolverse la deuda o ajustarse ese acuerdo. Las cuentas reales actuales continúan con acceso: no tienen un acuerdo de cobro activo creado por esta actualización.

## Huella y reconocimiento facial

Primero ingresá con usuario y contraseña. Abrí **Acceso seguro**, confirmá tu contraseña y elegí **Vincular huella, rostro o PIN de este dispositivo**. Registrá un nombre para reconocer el equipo.

**Celular:** utiliza la huella o Face ID que ya configuraste en los ajustes del dispositivo, si admite esa verificación para llaves de acceso. El teléfono muestra su propia pantalla de verificación. Cada dispositivo se vincula por separado.

**Windows:** Configuración → Cuentas → Opciones de inicio de sesión → Windows Hello. El rostro se registra allí. Requiere una cámara compatible con Windows Hello; una cámara web común no alcanza. También puede usarse lector de huella compatible o PIN.

Hospitalito guarda la clave pública de una llave de acceso. No almacena una fotografía del rostro ni una plantilla de huella. El método biométrico disponible lo controla el sistema operativo.

Usá la [web segura de Hospitalito](https://walterrigoni.github.io/hospitalito/) para activar y utilizar la llave. El archivo descargado no permite registrar WebAuthn desde `file://`; su pantalla incluye un botón para abrir la web. Una app instalada desde esa web utiliza el mismo origen seguro.

Se conserva el bloqueo por inactividad configurable en 2, 5, 10 o 15 minutos. Al bloquearse, conserva borradores y solicita contraseña o verificación del dispositivo.

Referencia: [Configuración de Windows Hello](https://support.microsoft.com/en-us/windows/security/configure-windows-hello).

## Verificaciones de esta versión

Se verificaron la imagen JPG indicada por el usuario, compresión y guardado en Supabase, recarga y membretes; selector del observador; distribución y protección de camas ocupadas; aislamiento del contador; acuerdos y cuentas; 30 días editables; interfaz móvil; alta y acceso mediante un autenticador WebAuthn virtual; preservación de historia y recepción de una prescripción entre médico y enfermería.

Las pruebas de cobros utilizaron datos ficticios y respuestas simuladas del proveedor. Se probaron pagos parciales, repetición de comprobantes, fechas mensuales y años bisiestos, importes y cuentas incorrectos, firma de notificación y pagos pendientes. No se efectuó un cargo real.

Se conserva Supabase y el funcionamiento clínico de v281–v283. Para la prueba operativa, usá la misma versión web/app en todos los equipos y verificá la marca de clínica sincronizada antes de continuar con las tareas del servicio.
