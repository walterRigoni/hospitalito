# Hospitalito

Sistema Digital de Historia Clínica. Versión de prueba actual: **v286**, basada en v285.

- [Abrir la aplicación](https://walterRigoni.github.io/hospitalito/)
- [Archivo HTML v286](https://walterRigoni.github.io/hospitalito/Hospitalito_v286.html)
- [Guía de uso y configuración](Hospitalito_v286_guia.md)

Las internaciones anteriores se consultan con la botonera clínica habitual en una vista violeta, aislada de las cachés editables. Prescripciones abre en el cierre o último día conocido y permite revisar fechas previas. Se conserva el aviso cuando una copia histórica está incompleta. La dieta muestra su indicación completa en prescripciones, el resumen lateral y el adjunto de Evolución. Los portales de imágenes se guardan por institución y recuerdan la última elección.

Se conservan el acceso inicial del administrador, logos, servicios y camas, rol Contador, contabilidad y sincronización clínica. Los cobros siguen desactivados hasta configurar precios, cuentas y credenciales del proveedor. Las liquidaciones internas no son comprobantes fiscales. TURN y la integración de IA continúan pendientes de configuración/desarrollo.

`supabase` conserva funciones y migraciones; `tests` contiene comprobaciones de historia, prescripciones, sincronización, permisos y cobros sin pagos reales. Las credenciales permanentes permanecen en el servidor.
