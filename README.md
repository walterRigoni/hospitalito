# Hospitalito

Sistema Digital de Historia Clínica. Versión de prueba actual: **v284**, basada en v283.

- [Abrir la aplicación](https://walterRigoni.github.io/hospitalito/)
- [Archivo HTML v284](https://walterRigoni.github.io/hospitalito/Hospitalito_v284.html)
- [Guía de uso y configuración](Hospitalito_v284_guia.md)

Esta versión corrige la carga y visualización de logos, permite al observador filtrar el censo y agrega configuración de servicios y camas. Incluye el rol Contador, registros de ingresos y egresos, contratos por institución o usuario, prueba inicial de 30 días editable, avisos de vencimiento y controles de servicio.

Los cobros están desactivados hasta configurar precios, cuentas receptoras y credenciales del proveedor en el servidor. La integración preparada con Mercado Pago utiliza Checkout Pro y notificaciones verificadas; no almacena datos de tarjeta. Las liquidaciones internas no son comprobantes fiscales de ARCA. El acceso biométrico utiliza las credenciales del dispositivo y requiere una plataforma compatible configurada por el usuario.

Se conservan los módulos y la sincronización clínica de v283. El directorio `supabase` contiene las funciones y migraciones del servidor; `tests` incluye comprobaciones de historia, prescripciones, sincronización, avisos, permisos y cobros sin pagos reales. Las credenciales permanentes permanecen en el servidor.

El relevo TURN para videollamadas entre redes distintas continúa pendiente de configuración. La integración de IA permanece como una posibilidad futura.
