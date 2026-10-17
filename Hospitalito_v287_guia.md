# Hospitalito v287 — guía de las mejoras

17 de octubre de 2026. Base: v286.

## Cerrar los resultados de una búsqueda

Después de buscar un paciente, aparece una **×** en la esquina superior derecha de los resultados, abajo a la izquierda de la pantalla. Cierra los resultados y limpia el buscador. Conserva el paciente abierto y todos sus datos. Una respuesta pendiente del servidor no vuelve a abrir una búsqueda que cerraste.

## Herramientas de Consultorios

En **Consultorios → Herramientas por especialidad**, desplegá el recuadro y elegí una especialidad. Se toma inicialmente la del turno o del profesional, si está registrada. **Todas las especialidades** permite ver las herramientas disponibles.

Queda disponible el **gestograma: fecha probable de parto** en Ginecología y Obstetricia, Ginecología y Obstetricia por separado. Ingresá el primer día de la última menstruación (FUM), la duración habitual del ciclo y la fecha para calcular la edad gestacional. Presioná **Calcular**. Muestra la fecha probable de parto y las semanas y días de gestación. **Copiar resultado** permite pegarlo donde corresponda.

La estimación usa FUM + 280 días, con ajuste por la diferencia entre la duración de un ciclo regular y 28 días. Debe confirmarse la datación con ecografía y criterio obstétrico. Si la FUM es incierta o los ciclos son irregulares, la calculadora solicita esa evaluación. No modifica una fecha de parto ya establecida ni guarda automáticamente una evolución. Los datos de cálculo se mantienen solo durante esta apertura de la aplicación y separados por usuario, institución, paciente y turno.

Referencia clínica: [Merck Manual, Evaluación de la paciente obstétrica](https://www.merckmanuals.com/professional/gynecology-and-obstetrics/approach-to-the-pregnant-woman-and-prenatal-care/evaluation-of-the-obstetric-patient).

El espacio está preparado para incorporar tablas, referencias y escalas por especialidad. Las especialidades sin herramientas muestran un aviso; todavía no se incluyeron otras escalas de riesgo. Cada herramienta nueva deberá tener su referencia, criterios de uso y comprobaciones del cálculo.

## Sincronización

Se conservan las funciones del servidor, los permisos y la frecuencia de sincronización de v286. Estas herramientas calculan localmente, sin agregar solicitudes al servidor. Se verificó la prueba de guardados simultáneos de medicina y enfermería, incluido el caso de una prescripción nueva y una administración recibidas a la vez. Esta prueba no mide el retardo real entre tu computadora y tu celular.

Se mantienen la consulta de internaciones anteriores, dieta, portales por institución, avisos, accesos y configuración institucional de las versiones anteriores.

## Archivo y web

El archivo completo es **Hospitalito_v287.html**. Se entrega también en Descargas. La aplicación publicada utiliza la misma versión. Al abrir una aplicación instalada previamente, verificá que el título diga **v287** después de actualizarla.
