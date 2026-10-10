# Hospitalito v280: resultados de laboratorio externos

Hospitalito recibe envíos estructurados en una bandeja institucional y exige validación de un bioquímico antes de incorporarlos a la historia clínica. No se ha conectado ni certificado un analizador físico ni una instalación de Nobilis.

## Contrato del adaptador

Endpoint: `POST https://frbuhczonftjtvmviehw.supabase.co/functions/v1/hospitalito-lab-inbox?forceFunctionRegion=eu-central-1`

Encabezados: `Content-Type: application/json` y la clave publicable de la aplicación. La clave publicable no concede acceso por sí sola: se necesita una sesión institucional vigente de un usuario activo de laboratorio o administración, y su membresía vigente en la institución.

Acciones: `receive`, `list`, `approve`, `reject`. Cada petición incluye `token` e `institutionId` (ID de autorización institucional). El servidor deriva el ámbito de datos: no acepta el ámbito elegido por el remitente. Un adaptador desatendido necesitará en una implementación futura una credencial dedicada con alcance de recepción; no debe guardar la contraseña de un profesional ni usar una clave de servicio de Supabase.

Ejemplo de mensaje normalizado (datos ficticios):

```json
{
  "action": "receive",
  "token": "SESION_INSTITUCIONAL",
  "institutionId": "INSTITUCION",
  "message": {
    "schema": "hospitalito.lab.v1",
    "source": "Analizador-prueba",
    "messageId": "ENVIO-UNICO-0001",
    "patientId": "ID_INTERNO_DEL_PACIENTE",
    "requestId": "ID_DE_SOLICITUD_EXPORTADA",
    "resultRows": [
      {"key": "codigo_interno", "label": "Determinación", "value": "VALOR", "unit": "UNIDAD", "ref": "REFERENCIA", "flag": ""}
    ],
    "freeNote": ""
  }
}
```

`source` y `messageId` identifican el envío para evitar duplicados. Reutilizar el identificador con resultados distintos se rechaza. Se admiten hasta 200 determinaciones y 160 KB por petición. La muestra debe corresponder exactamente a un paciente y una solicitud pendientes en esa institución. Nunca se asocia por nombre parecido ni se deduce una unidad o una referencia.

El proveedor del equipo debe implementar o configurar un adaptador de su protocolo (por ejemplo ASTM, HL7 v2 ORU o API propia) a este contrato. La compatibilidad de Nobilis depende de los módulos/licencias y la documentación de interfaz que entregue Wiener lab.; Hospitalito no presupone una API pública de Nobilis.

## Flujo de revisión

1. Exportar desde Laboratorio las solicitudes pendientes para preservar los identificadores de paciente y solicitud.
2. Configurar la asociación entre código de barras de muestra, solicitud, códigos de determinaciones y unidades. Probarla con el proveedor y el laboratorio.
3. Recibir resultados por el endpoint o importar el JSON en la interfaz de Laboratorio.
4. El bioquímico revisa paciente, muestra, unidades, referencias y valores. Luego elige **Validar e informar** o **Rechazar envío**.
5. La validación registra el informe y completa la solicitud en una transacción. La operación repetida no duplica informes. Los resultados externos no modifican prescripciones automáticamente.

Las tablas de la bandeja y de versiones están protegidas con RLS, sin acceso directo desde clientes. Las funciones comprueban sesión, usuario, rol, membresía e institución. El envío de equipos no está habilitado de manera anónima.

## Acceso con dispositivo

Las llaves de acceso WebAuthn se registran después de confirmar la contraseña, en **Acceso seguro**. Hospitalito almacena la clave pública; huella, rostro o PIN se verifican en el dispositivo. Se requiere la web HTTPS de Hospitalito y un navegador compatible. El archivo HTML descargado conserva acceso con contraseña y bloqueo por inactividad, pero no activa llaves para el origen `file://`.

El bloqueo por inactividad predeterminado es de 5 minutos, configurable a 2, 5, 10 o 15 minutos. Protege la pantalla y exige nueva verificación para continuar; no equivale a revocar globalmente todas las sesiones del usuario. Los borradores permanecen en el mismo navegador, separados por institución, usuario y paciente.
