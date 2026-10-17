# Herramientas por especialidad

La v287 incorpora un registro local en `window.HospitalitoSpecialtyTools`, definido en `tools/specialty-tools.js` e incluido dentro del HTML autónomo. No cambia las funciones Supabase ni los permisos clínicos. Las herramientas no reciben tokens, funciones de guardado ni acceso a historias; los cálculos se ejecutan localmente.

El registro acepta `calculator`, `risk`, `table` y `reference`. Cada descriptor debe tener `id` único, `title`, `specialties`, `kind` y `source: {title, url}` con referencia HTTPS. Puede incorporar `description` y `version`.

Para tablas y referencias: `columns` es una lista de encabezados y `rows` una lista de filas. Todos los textos se escapan al mostrarse. Para calculadoras y riesgos: `fields` describe entradas `date`, `number`, `select` o `text`; `calculate(values)` devuelve `{title, lines: [[etiqueta, valor]], note}` o arroja un error de validación. La pantalla ofrece copiar el resultado, sin guardarlo automáticamente.

Las extensiones se incorporan en el código revisado, después del registro base y antes del montaje de la interfaz. No se evalúan fórmulas ni código proporcionado por usuarios. Al agregar una herramienta, regenerar también el HTML autónomo; no alcanza con modificar el archivo de referencia en `tools`.

Antes de publicar una escala clínica hay que definir su fuente y versión, población, unidades, límites y datos requeridos. Validar ejemplos de la fuente, datos faltantes, valores extremos y reglas de interpretación. No implementar decisiones terapéuticas automáticas a partir de una puntuación.

La herramienta inicial es `obstetric-due-date`. Usa fechas de calendario en UTC para evitar diferencias por horario de verano. FPP = FUM + 280 + (duración del ciclo regular − 28) días. EG = 280 − (FPP − fecha de referencia), en días. Se rechazan fechas imposibles, FUM posterior a la referencia, ciclos no enteros o fuera del intervalo de entrada de 15–60 días, FUM incierta/ciclos irregulares y resultados fuera del intervalo de 0–45 semanas de la calculadora. Estos límites de entrada no clasifican por sí mismos la normalidad clínica de un ciclo o embarazo.

Fuente: [Merck Manual — Evaluation of the Obstetric Patient](https://www.merckmanuals.com/professional/gynecology-and-obstetrics/approach-to-the-pregnant-woman-and-prenatal-care/evaluation-of-the-obstetric-patient). La herramienta no redetermina una FPP ya establecida por la evaluación obstétrica.

Prueba portable: `node tests/specialty-tools.cjs`. Incluye fechas conocidas, años bisiestos, límites, ciclos regulares, aislamiento por especialidad y consistencia entre husos horarios.
