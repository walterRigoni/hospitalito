# Sincronización clínica de Hospitalito v281

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
