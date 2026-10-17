# Hospitalito

Sistema Digital de Historia Clínica. Versión de prueba actual: **v287**, basada en v286.

- [Abrir la aplicación](https://walterRigoni.github.io/hospitalito/)
- [Archivo HTML v287](https://walterRigoni.github.io/hospitalito/Hospitalito_v287.html)
- [Guía de las mejoras](Hospitalito_v287_guia.md)
- [Extensión de herramientas por especialidad](HERRAMIENTAS_ESPECIALIDAD.md)

Los resultados de búsqueda se cierran con una X sin cambiar el paciente abierto. Consultorios incorpora herramientas por especialidad y un gestograma por FUM, con fecha probable de parto y edad gestacional. Los cálculos son locales y no se guardan automáticamente en la historia. Queda preparado el registro para agregar tablas, referencias y escalas validadas; las demás especialidades todavía no incluyen escalas. Se conserva la sincronización de v286 sin cambios del servidor.

Las internaciones anteriores se consultan con la botonera clínica habitual en una vista violeta, aislada de las cachés editables. Prescripciones abre en el cierre o último día conocido y permite revisar fechas previas. Se conserva el aviso cuando una copia histórica está incompleta. La dieta muestra su indicación completa en prescripciones, el resumen lateral y el adjunto de Evolución. Los portales de imágenes se guardan por institución y recuerdan la última elección.

Se conservan el acceso inicial del administrador, logos, servicios y camas, rol Contador, contabilidad y sincronización clínica. Los cobros siguen desactivados hasta configurar precios, cuentas y credenciales del proveedor. Las liquidaciones internas no son comprobantes fiscales. TURN y la integración de IA continúan pendientes de configuración/desarrollo.

`supabase` conserva funciones y migraciones; `tests` contiene comprobaciones de historia, prescripciones, sincronización, permisos y cobros sin pagos reales. Las credenciales permanentes permanecen en el servidor.
