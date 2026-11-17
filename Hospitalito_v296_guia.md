# Hospitalito v296

La lista y el perfil de profesionales muestran su foto de Perfil. Si no hay foto, muestran una inicial.

La agenda guardada se abre en modo lectura. El botón ✎ Editar horarios y tarifas permite cambiarla y guardar una nueva revisión. Los precios y condiciones de reservas ya confirmadas se conservan.

Mientras el profesional no vincule su cuenta, sus nuevas consultas de telemedicina y consultorio son pruebas gratuitas: $0, sin tarjeta ni solicitud de pago. Se confirma la reserva al seleccionar un horario y aceptar las condiciones. La duración elegida y los conflictos de agenda siguen controlándose en el servidor. La prueba no incluye extensiones pagas; se puede reservar otra consulta. Al vincular la cuenta, nuevas reservas usan las tarifas publicadas y requieren la configuración completa de la pasarela de Hospitalito. Si cambia la condición de cobro mientras el paciente elige, debe volver a consultar y aceptar el importe. Las reservas gratuitas anteriores siguen a $0.

Los recordatorios aparecen en Notificaciones / Recordatorios de turnos. Un trabajo del servidor verifica cada minuto los avisos de 24 y 12 horas de consultas confirmadas, sin duplicados y sin depender de un navegador abierto. Las reservas realizadas después de un umbral no generan retroactivamente ese aviso. Se admite un retraso operativo de hasta 15 minutos; no se generan avisos vencidos fuera de ese margen. Este cambio no configura WhatsApp, correo ni notificaciones push del sistema operativo.

Validación: sintaxis de 52 scripts, pruebas de guardado y edición, lógica de importes y autorización, consultas de prueba con datos ficticios en transacción revertida y verificación del directorio real. No se efectuaron cobros ni se modificaron agendas reales durante las pruebas. Falta la prueba de usuario de la interfaz y una llamada real entre dos equipos.
