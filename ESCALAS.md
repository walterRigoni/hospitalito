# Escalas de Hospitalito v288

`tools/clinical-scales.js` implementa funciones locales y puras; el HTML autónomo incluye la misma fuente. `window.HospitalitoScales` expone `list`, `calculate`, `validate`, `visible`, `vancoReview` y `vancoAuc`. La interfaz está en el bloque `hc-v288-ui` del HTML. El gestograma reutiliza el registro de v287. No hay cambios de esquema, de funciones Supabase ni de permisos.

Las versiones se distinguen explícitamente: TIMI UA/NSTEMI y STEMI; GRACE clásico por puntos de ingreso; APACHE II; SOFA clásico; CHA₂DS₂-VA y CHA₂DS₂-VASc. Los campos se validan antes de calcular. No se asigna cero a datos ausentes. Los campos condicionales de APACHE II evitan sumar a la vez PaO₂ y gradiente A–a, o pH y bicarbonato. Glasgow y NIHSS bloquean un total completo ante componentes NT/UN. La interfaz no estima elegibilidad definitiva de trombólisis ni una mortalidad individual de APACHE II.

Las referencias están en cada descriptor. Para agregar una escala, definir población, variante, unidades, entradas, cálculo e interpretación y comprobar casos de la fuente y valores límite. No ejecutar fórmulas recibidas de usuarios ni cargar scripts externos. Mantener la biblioteca embebida y el archivo de fuente iguales al regenerar el HTML.

Vancomicina utiliza `labRequests` y `labResults` existentes. Los datos de muestra se guardan en `vancomycinTdm`, junto con texto visible. Las correcciones conservan el contexto anterior en `vancomycinTdmHistory`. La revisión médica se añade a `prescripciones.infusionesContinuas[].vancomycinReviews`, con identificador, informe y autor. El identificador del informe incluye valor, unidad, edición y metadatos canonizados para que el orden de claves de JSONB no reabra avisos ya revisados. La comparación temporal utiliza fechas interpretadas, incluyendo zona horaria cuando está indicada. No se agregan solicitudes periódicas.

Los avisos de revisión se derivan de informes y órdenes activas. Bioquímica no cambia órdenes como parte de informar una vancocinemia. La revisión del médico tampoco cambia dosis por sí misma. El cálculo proporcional opcional requiere AUC24 previamente obtenida por método validado y farmacocinética estable; muestra una estimación teórica. La modificación efectiva utiliza el editor de prescripciones, su guardado explícito y los avisos habituales de Enfermería.

Pruebas portables:

- `node tests/clinical-scales.cjs`: límites, componentes, variantes, datos incompletos, unidades, identificación de informes y cálculo por AUC24.
- `node tests/clinical-sync.cjs`: guardados concurrentes, reenvío de réplicas antiguas, administraciones y revisión de vancomicina.
- `node tests/history.cjs`: identidad y consulta de la historia.
- `node tests/service-permissions.cjs`: límites de escritura de los roles de servicios.

Referencia de la relación proporcional para AUC: [estudio farmacocinético de 2024](https://pmc.ncbi.nlm.nih.gov/articles/PMC11459921/). El objetivo clínico y los límites de aplicación siguen el [consenso ASHP/IDSA](https://www.idsociety.org/practice-guideline/vancomycin/); no se infiere AUC a partir de un único valle en esta herramienta.
