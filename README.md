# Hospitalito

Sistema Digital de Historia Clínica. Versión de prueba actual: **v288**, basada en v287.

- [Abrir la aplicación](https://walterRigoni.github.io/hospitalito/)
- [Archivo HTML v288](https://walterRigoni.github.io/hospitalito/Hospitalito_v288.html)
- [Guía de las mejoras](Hospitalito_v288_guia.md)
- [Implementación y pruebas de Escalas](ESCALAS.md)

El módulo **Escalas** reemplaza el panel de herramientas por especialidad de Consultorios. Incluye 18 herramientas con fuentes y validaciones: NIHSS, Glasgow, variantes TIMI, GRACE clásico, APACHE II, SOFA, qSOFA, CURB-65, CRB-65, CHA₂DS₂-VA/VASc, HAS-BLED, Wells TEP/TVP, Child–Pugh, gestograma y revisión de vancomicina por AUC24. Los cálculos son locales, sin guardado clínico automático ni decisiones terapéuticas autónomas.

Consultorios permite plegar los horarios. Laboratorio distribuye las solicitudes en dos columnas y agrega vancocinemia, contexto de muestra y revisión médica de órdenes activas ante un resultado nuevo o corregido. Un nivel aislado no cambia automáticamente la dosis. Se conserva la sincronización y el servidor de v287. La X de búsqueda, internaciones anteriores, dieta y portales institucionales se mantienen.

Las internaciones anteriores se consultan con la botonera clínica habitual en una vista violeta, aislada de las cachés editables. Prescripciones abre en el cierre o último día conocido y permite revisar fechas previas. Se conserva el aviso cuando una copia histórica está incompleta. La dieta muestra su indicación completa en prescripciones, el resumen lateral y el adjunto de Evolución. Los portales de imágenes se guardan por institución y recuerdan la última elección.

Se conservan el acceso inicial del administrador, logos, servicios y camas, rol Contador, contabilidad y sincronización clínica. Los cobros siguen desactivados hasta configurar precios, cuentas y credenciales del proveedor. Las liquidaciones internas no son comprobantes fiscales. TURN y la integración de IA continúan pendientes de configuración/desarrollo.

`supabase` conserva funciones y migraciones; `tests` contiene comprobaciones de historia, prescripciones, sincronización, permisos y cobros sin pagos reales. Las credenciales permanentes permanecen en el servidor.
