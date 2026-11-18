# Hospitalito v299

Jornada de trabajo tiene × para cerrar sin guardar y ↩ para volver al ingreso de usuario y contraseña utilizando la salida de cuenta existente. Escape también permite cerrar. El aviso no vuelve a abrirse inmediatamente en la misma página/sesión; se puede abrir manualmente desde Jornada. Cerrar no registra una jornada ficticia.

En el Portal, ⌖ Mi ubicación solicita permiso de ubicación después de pulsarlo. Para Consultorio Privado ordena a los profesionales por la menor distancia aproximada a una sede con horarios disponibles en el día elegido. Se muestra la precisión informada por el dispositivo. Se puede quitar la ubicación de la búsqueda; no se guarda automáticamente en la cuenta.

En los bloques de Consultorio Privado, ✎ Editar agenda habilita ⌖ para tomar la ubicación de esa sede, ingresar coordenadas manuales, ver el mapa o quitar el GPS. Tomar ubicación actual debe usarse estando en ese consultorio. Después de aplicar el punto hay que guardar la agenda. Cada sede mantiene coordenadas independientes y opcionales; no se convierte una dirección en coordenadas inventadas.

El paciente elige un horario/consultorio y puede abrir ↗ Cómo llegar. Si faltan coordenadas, el enlace usa la dirección declarada, y el listado no muestra una distancia falsa. Las reservas también ofrecen un enlace a la dirección guardada.

El GPS requiere un contexto seguro HTTPS y permiso del navegador/dispositivo. Se presentan mensajes específicos para permiso bloqueado, demora, ubicación no disponible y datos inválidos. Las búsquedas institucionales y la ubicación del perfil usan la misma captura mejorada.

Se validaron las fórmulas, casos de error, permisos simulados, conservación de coordenadas y cierre de Jornada. No se probó el GPS físico del equipo del usuario. Los datos ficticios de pruebas SQL se revirtieron y no se alteraron agendas reales.
