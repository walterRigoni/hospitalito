# Hospitalito v289

Versión basada en v288, preparada el 15 de noviembre de 2026. La versión descargable y la web contienen el mismo programa. Los datos continúan en Supabase; cambiar el archivo no copia historias dentro del HTML.

## Cuenta e interfaz

- El logo institucional tiene más espacio y mayor tamaño, también en el membrete imprimible. Hospitalito conserva el logo pequeño a la derecha.
- Cuenta abre un menú con Perfil, Jornada, Miembros, Mis Instituciones, Notificaciones, Configuración, Licencia y SALIR. En computadora funciona al pasar el puntero; en celular, al tocar. El nombre y el usuario están a la derecha.
- Perfil usa una foto circular más grande. La contraseña, la firma y las llaves del dispositivo se administran desde Configuración. Miembros ocupa la pantalla y permite abrir Profesionales.
- La videollamada está dentro de Chat. Acciones comunes usan símbolos con descripción al pasar el puntero y etiqueta accesible. Se conservan las palabras en acciones clínicas o ambiguas.
- Se redujeron los contornos de las tarjetas, conservando líneas y estados clínicos. Personalización separa ocho colores —incluido Rosado— de Claro/Oscuro y agrega fuentes. «Actual» conserva la tipografía previa. Los avisos clínicos mantienen sus colores.
- El indicador de sincronización viene apagado para una cuenta nueva. Puede activarse en Configuración → Notificaciones → Interfaz; ocultarlo no detiene la sincronización.

## Habilitar una institución en el Portal

1. Desde Hospitalito o Administración, abrir **Portal · clientes** y elegir la institución autorizada.
2. Cargar dirección y teléfono. Guardar las coordenadas de la institución usando su ubicación actual o ingresándolas. Se necesitan coordenadas para calcular distancias; no se deducen de una dirección escrita.
3. Publicar la institución en el directorio. No se publican automáticamente todas las instituciones ni todos los profesionales.
4. Cada profesional habilita su perfil y agenda desde **Consultorios → Mi agenda y reservas**. Los profesionales también pueden abrirla desde **Cuenta → Perfil → Mi agenda y reservas**, aunque su pantalla habitual no incluya Consultorios.

Los datos publicados son el nombre, foto/logo, especialidad, presentación, institución, dirección y disponibilidad. El directorio no publica DNI, contraseñas, fichas ni personas que reservaron otros horarios.

## Registro y verificación del cliente

Debajo del ingreso aparece **Registrarse**. Se solicita usuario, contraseña de al menos 10 caracteres, foto del frente del DNI y datos personales. La lectura del documento se realiza en el navegador con Tesseract.js 7.0.0; necesita Internet para cargar el lector. Si la foto no se lee correctamente, se puede reintentar o corregir los datos manualmente. Siempre se exige revisar y confirmar los datos.

La lectura automática **no acredita identidad**. El documento se envía al confirmar el registro, se guarda en un depósito privado y no tiene un enlace público. La cuenta queda pendiente de verificación por institución. El cliente puede pedir verificación en la institución elegida desde la agenda del profesional.

Hospitalito y el administrador autorizado de la institución pueden revisar el documento y registrar una decisión con su fundamento. Se ofrecen únicamente fichas cuyo DNI coincide. También puede verificarse un cliente ambulatorio sin ficha previa. La aprobación en una institución no autoriza otras. Es posible rechazar o revocar el vínculo; la revocación impide nuevas consultas a esos informes.

El cliente utiliza un Portal propio, sin acceso a la edición clínica profesional. Perfil permite guardar dirección, contacto, foto y ubicación. Cuenta omite Jornada, Miembros, Mis Instituciones y Licencia profesional.

## Turnos y agendas

El Portal abre un calendario mensual con vistas laterales. Las flechas o el arrastre cambian de mes; un día abre su detalle. Los turnos futuros se indican en verde y los anteriores en gris. **Registro** reúne turnos, resultados e internaciones vinculadas. La flecha del borde permite plegarlo o cambiar su ancho. **Nuevo Turno** queda flotando abajo.

La búsqueda permite seleccionar tipo de profesional, especialidad, varias instituciones, consultorio particular y Telemedicina. Las distancias se calculan cuando cliente e institución tienen coordenadas. El botón de ubicación solicita el permiso del navegador. No se inventa cercanía cuando falta esa información.

Al abrir un profesional se muestran días y horarios libres. Verde, amarillo y rojo expresan ocupación; un día rojo puede conservar horarios disponibles. **URGENCIA** reemplaza la búsqueda por **LLAMAR AL 107**, que abre la aplicación de llamadas del dispositivo.

La agenda combina horarios semanales, modificaciones posteriores de la agenda de Hospitalito, turnos institucionales registrados en Hospitalito, reservas del Portal y bloqueos manuales. Un mismo profesional no puede recibir reservas superpuestas entre sus instituciones o su consultorio particular. También se comprueba en el servidor una carrera entre dos reservas o entre una reserva y un bloqueo.

**Sacar turno registra una solicitud pendiente de confirmación y ocupa el horario inmediatamente en Hospitalito.** El profesional puede confirmar, marcar atendido o cancelar; el cliente puede cancelar su propia reserva. La pantalla de Consultorios permite bloquear un día o un intervalo y quitar bloqueos. Un bloqueo no cancela un turno existente: primero debe revisarse ese turno.

**Los turneros externos de las instituciones todavía no están conectados.** No se muestra su disponibilidad como si existiera esa conexión. Antes de confirmar una solicitud, el personal debe comprobar el turnero externo cuando corresponda. La integración futura necesitará datos y acceso de cada proveedor.

## Pacientes ambulatorios e informes

Médico, Bioquímica, Microbiología e Imágenes tienen acceso a **Ambulatorios**. El médico emite la solicitud para un cliente verificado de la institución. El servicio correspondiente redacta el informe, puede adjuntar PDF o imagen de hasta 5 MB y elige **Guardar borrador** o **Publicar al cliente**.

Un borrador nuevo no es visible para el cliente. Al corregir un informe ya publicado, el cliente continúa viendo la última versión publicada hasta que se publique la corrección. Se comprueba la revisión del informe para evitar que una pantalla atrasada sobrescriba otra edición. Los adjuntos se entregan mediante enlaces privados breves y se vuelve a comprobar el permiso al solicitarlos.

El cliente sólo recibe sus informes publicados y los datos permitidos de su ficha institucional verificada. Los resultados y resúmenes históricos disponibles dependen de que la institución haya vinculado la ficha correcta y de que esos registros existan.

## Acceso con dispositivo

Desde Configuración → Seguridad se puede vincular la huella, rostro o PIN que ya ofrece el equipo. Se necesita la web HTTPS de Hospitalito y un dispositivo compatible; cada equipo se vincula por separado. Hospitalito conserva una llave pública, no imágenes del rostro ni huellas. El registro y la autenticación se verificaron con un autenticador virtual WebAuthn.

El Portal se bloquea tras cinco minutos sin actividad. Contraseña o llave del dispositivo permiten continuar y se conserva el formulario abierto. El archivo local puede utilizar contraseña; las llaves requieren la web segura. Los cambios de contraseña y biometría reales deben realizarlos los titulares de las cuentas.

## Comprobaciones realizadas

Se probaron con datos ficticios: registro y lectura local de DNI; verificación y denegación entre instituciones; separación entre dos clientes; documento privado; solicitudes e informes de los tres servicios; borradores, corrección y revisión; revocación; dos reservas simultáneas; bloqueos y turnos institucionales en ambas direcciones; actualización de horarios con fecha local argentina; denegación de acceso anónimo a tablas y depósito privado; registro y acceso WebAuthn; menú, temas, celular y conservación del formulario al bloquearse.

También pasaron las pruebas previas de historia, borradores clínicos, avisos al médico, escalas, permisos y guardados concurrentes de médico y enfermería. La sincronización clínica existente se mantiene. Estas comprobaciones técnicas no reemplazan la prueba operativa de la institución ni acreditan por sí solas aptitud clínica, legal o de protección de datos para una puesta en producción.

Para la prueba con pacientes reales deben definirse el procedimiento institucional de verificación, autorizaciones, conservación de documentos, responsabilidades y soporte. En equipos compartidos, usar perfiles de navegador separados para profesionales y clientes y seguir la política institucional para cachés y borradores locales.
