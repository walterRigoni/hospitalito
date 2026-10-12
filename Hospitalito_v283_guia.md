# Hospitalito v283

Cambios realizados sobre v282, 12 de octubre de 2026.

- Corregidos el contraste de los cuadros clínicos y la alineación de solicitudes con sus casillas.
- Kinesiología, Hemoterapia y Nutrición pueden consultar todos los módulos. Sólo pueden modificar los registros de su servicio; el servidor también controla esta restricción.
- Evolución muestra todas las prescripciones activas, sin ocultar las últimas detrás de un contador.
- Chat con selector General / Privado por usuario de la institución.
- Administración → Institución: carga de logos con ajuste de tamaño. Logo institucional a la izquierda, Hospitalito en un cuadrado más pequeño a la derecha. Los membretes e impresiones leen la misma configuración compartida.
- Consentimientos: modelos institucionales y documentos de cada paciente en almacenamiento privado, hasta 10 MB por archivo. PDF, PNG/JPG y texto se abren para imprimir. Word se descarga y se imprime desde Word. Se conserva el formulario de alta voluntaria.
- Enfermería: botón Sonido / vibración para elegir y probar dos toques breves. Preferencias por usuario y dispositivo. El sonido requiere tocar/interactuar con la aplicación; la vibración depende del celular y navegador. Los avisos se procesan mientras Hospitalito está abierto: no se garantiza sonido con la aplicación cerrada o suspendida en segundo plano.
- Videollamada: icono de cámara, resolución moderada, negociación de conexiones simultáneas, errores de permisos visibles y opción de activar reproducción cuando el navegador bloquea el audio.

## Hemoterapia

Desde el módulo se abren **Donantes** y **Banco de sangre · unidades y movimientos**.

El donante tiene nombre, documento, nacimiento, contacto, domicilio, grupo/Rh informado, código y fecha de donación, evaluación del servicio, profesional, referencia de consentimiento y observaciones. La asociación a un paciente es opcional y exige justificación terapéutica.

La unidad tiene código único, componente, grupo/Rh, fenotipo, lote, origen, donación asociada, extracción/recepción, vencimiento, volumen, ubicación, estado, receptor, referencia de validación/compatibilidad, responsable y fecha de transfusión. Se conserva cada cambio con fecha, usuario y valores anteriores. Si otro usuario modifica la misma ficha, hay que actualizar antes de guardar; no se sobrescribe su cambio.

El registro no calcula compatibilidad ni decide automáticamente aptitud del donante. La validación corresponde al servicio. Las unidades nuevas se registran en cuarentena. Los registros de donantes son exclusivos de Hemoterapia y Administración.

La [normativa nacional actual](https://www.argentina.gob.ar/node/499823) prioriza la donación voluntaria y habitual y exige trazabilidad; no debe condicionarse la atención a que un paciente presente donantes. Este desarrollo es un registro operativo para probar con el servicio; no constituye una certificación de cumplimiento ni reemplaza su sistema habilitado y sus protocolos.

## Videollamadas entre redes distintas: configuración pendiente

Supabase sigue guardando y sincronizando la historia clínica; el video utiliza WebRTC. Algunas redes móviles y hospitalarias impiden conexiones directas y requieren un **servidor de relevo TURN**. La v283 está preparada para recibir credenciales temporales desde el servidor, pero todavía no hay un proveedor de relevo configurado.

Opción recomendada para evaluar: **Cloudflare Realtime TURN**. Su [precio publicado](https://developers.cloudflare.com/realtime/sfu/platform/pricing/) es USD 0,05 por GB de salida y los primeros 1.000 GB mensuales compartidos con SFU son gratuitos. Verificar condiciones y facturación en la cuenta antes de activarlo. No se ha contratado ni activado facturación en esta tarea.

Configuración técnica ya admitida por `hospitalito-call`:

1. Crear el servicio TURN en una cuenta del proveedor y conservar sus credenciales en el servidor.
2. Para Cloudflare: configurar como secretos de la función `HC_TURN_CF_KEY_ID` y `HC_TURN_CF_API_TOKEN`. La función solicita credenciales de conexión de una hora según la [documentación del proveedor](https://developers.cloudflare.com/realtime/turn/generate-credentials/).
3. Para un servidor Coturn propio: configurar `HC_TURN_URLS` (direcciones TURN/TURNS separadas por coma) y `HC_TURN_SECRET` (secreto de autenticación temporal del servidor).
4. Comprobar que el acceso a videollamadas indique “Conexión de relevo habilitada” y probar computadora ↔ celular con Wi-Fi y datos móviles distintos.

Las claves permanentes no se incluyen en el HTML ni se publican en GitHub. La conexión clínica no necesita migrarse para agregar el relevo de video.

## Asistente de IA futuro

Sí es posible incorporar conversación y dictado por usuario. OpenAI dispone de [transcripción de voz](https://developers.openai.com/api/docs/guides/speech-to-text) y [llamadas a funciones de la aplicación](https://developers.openai.com/api/docs/guides/function-calling).

El flujo previsto sería: identificar usuario y paciente → transcribir el dictado → preparar un borrador estructurado → mostrarlo al profesional → confirmar → guardar con sus permisos y autoría → sincronizar al servicio correspondiente. Ejemplos: preparar una prescripción con fármaco/dosis/vía/horario, una solicitud de laboratorio o resultados dictados por Bioquímica.

Decir solamente “Noradrenalina” debe abrir el borrador y pedir los datos clínicos necesarios; no alcanza para emitir una orden completa. La IA no recibe permisos adicionales por encima del usuario ni firma en su lugar. Esta versión no tiene una integración de IA activa; requiere un proveedor/cuenta, configuración de privacidad y pruebas específicas con los profesionales.

## Comprobaciones

Se verificaron navegador de escritorio y pantalla de 390 × 844; lectura y edición de los tres servicios; archivos privados e aislamiento institucional; chat general y privado; logo en membretes impresos; conservación de evoluciones/borradores; guardados simultáneos de médico y enfermería; avisos naranjas; unidades con movimientos y protección contra edición concurrente. La prueba de video usa dos navegadores con cámara/micrófono sintéticos y señalización real. Falta probar un celular físico, especialmente vibración y redes móviles con TURN.
