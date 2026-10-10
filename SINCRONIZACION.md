# Sincronización clínica de Hospitalito v282

## Avisos médicos restaurados en v282

El subrayado naranja del paciente y de cada módulo se obtiene ahora del cambio clínico recibido, sin esperar la transferencia del historial de actividad. La respuesta incluye el autor verificado, la revisión y la fecha del servidor. También se incluye esta información en la consulta dirigida del paciente. No se agregaron permisos ni tablas.

El médico recibe avisos por acciones de otros usuarios. Abrir un módulo marca ese módulo como revisado para ese médico en ese equipo; una nueva acción vuelve a encenderlo. Otros módulos, pacientes, instituciones y usuarios conservan su estado independiente. El aviso pendiente y las lecturas se conservan al recargar. La autoría en las escrituras se toma de la sesión validada.

Prueba con sesiones aisladas contra el servidor real: una administración de enfermería encendió el aviso del médico en 1537 ms sin entregar actividad clínica. Se verificaron el color naranja, el apagado al abrir, una nueva acción, un resultado de laboratorio, recarga, acciones propias y aislamiento por módulo, paciente, institución y usuario. Las sesiones y datos sintéticos se eliminaron al finalizar. Este tiempo es una medición de prueba, no una garantía para toda conexión.

Desplegar las versiones actualizadas de `hospitalito-care`, `hospitalito-sync` y `hospitalito-patient-sync`; publicar `index.html` y `service-worker.js` de v282. Los clientes v281 pueden seguir enviando datos clínicos y generar avisos en un médico que use v282. La corrección conserva la separación del catálogo introducida en v281.

Pruebas portables: `node tests/doctor-alerts.cjs` y `node tests/clinical-sync.cjs` con Node.js 24.

## Sincronización prioritaria incorporada en v281

Una indicación podía quedar guardada solamente en el equipo mientras el catálogo de medicamentos y otros datos grandes ocupaban la conexión. Además, dos guardados simultáneos podían competir por la misma ficha. Aumentar el plan del servidor por sí solo no corrige esos problemas.

v281 envía los cambios clínicos mediante `hospitalito-care`, separados del catálogo, el archivo y la actividad. Solo retira un cambio de la cola local cuando el servidor confirma expresamente su recepción. Si falla la conexión, conserva el pendiente y muestra que todavía no se envió. La recepción clínica se consulta cada segundo mientras hay actividad.

Las escrituras clínicas usan una comparación de revisión y reintentan con la versión más reciente si otro usuario guardó antes. La combinación conserva las indicaciones, las administraciones y la confirmación de enfermería. Una copia anterior no debe volver a marcar como pendiente una indicación ya vista.

El catálogo se guarda en IndexedDB y se recibe por páginas mediante `hc281_bulk_page`. Sus transferencias funcionan en segundo plano y no ocupan la cola clínica. La función SQL solo es ejecutable por `service_role`; las funciones HTTP siguen comprobando la sesión y la institución. `hospitalito-sync` conserva compatibilidad con versiones anteriores.

## Validación

- Dos sesiones de prueba, médico y enfermero, conectadas al servidor real: recepción de tres nuevas indicaciones en 2268, 1732 y 1952 ms; confirmación de administración de regreso en 2451 ms.
- Desconexión, conservación del pendiente y envío al recuperar la conexión.
- Reenvío de una copia antigua sin perder indicaciones nuevas ni repetir una administración.
- Colisión simultánea de escritura y reintento de la revisión.
- Catálogo de 9,9 MB conservado tras recargar sin llenar el almacenamiento de los datos clínicos.
- Edición, borradores, bloqueo, historia, protocolos y flujo de prescripciones.

Los tiempos corresponden a datos sintéticos y sesiones de prueba; no garantizan la latencia de un teléfono o red particular. Los datos y sesiones temporales se eliminaron después de la prueba. No se incluyeron historias clínicas en el repositorio.

Para probar la corrección, ambos equipos deben abrir v281. Si hay una indicación pendiente en un archivo descargado, mantener la misma ruta del archivo conserva el acceso a su almacenamiento local. No volver a crear la indicación para forzar el envío.

## Despliegue

1. Aplicar la migración `20261010174514_hospitalito_v281_paged_catalog_read.sql`.
2. Desplegar `hospitalito-care` y la actualización compatible de `hospitalito-sync`, con la validación de sesión propia de Hospitalito y `verify_jwt=false`.
3. Publicar `index.html` y `service-worker.js` de v281.

La prueba de concurrencia se ejecuta con Node.js 24: `node tests/clinical-sync.cjs`.
