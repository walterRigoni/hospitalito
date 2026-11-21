# Hospitalito

Sistema Digital de Historia Clínica. Versión de prueba actual: **v309**, basada en v308.

- [Abrir Hospitalito](https://walterrigoni.github.io/hospitalito/)
- [Descargar el HTML v309](https://walterrigoni.github.io/hospitalito/Hospitalito_v309.html)
- [Guía v307](Hospitalito_v307_guia.md)
- [Arquitectura del Portal y comprobaciones](PORTAL.md)
- [Escalas clínicas conservadas](ESCALAS.md)

v309 guía el registro del paciente en tres pasos. Nuevo turno muestra Telemedicina, Consultorio Privado e Instituciones en la misma pantalla. La agenda profesional señala los campos que hay que corregir para guardar y la historia privada conserva los cambios escritos durante un guardado.

v308 conserva el texto de las acciones, reúne el acceso en una sola tarjeta y organiza Cuenta por función. En celular, Módulos permite saltar a una sección de la historia clínica. Evolución conserva los campos y adjuntos al cambiar de modo. El Portal invalida el horario al cambiar la selección.

v307 recupera las luces de las infusiones (verde activa, celeste pausa, rojo glóbulos rojos y amarillo plasma), reduce la altura de las prescripciones y permite desplazar las tablas de Balances hasta Balance acumulado. La barra superior y el Portal muestran v307.

v306 conserva el módulo y paciente al retomar la sesión, reconoce jornadas nocturnas, ofrece activación directa de huella/rostro/PIN, compacta Cuenta y Prescripciones, mejora el tema Claro y mantiene fijos los membretes y la botonera. Permite guardar escalas por paciente y adjuntarlas a Evolución junto con informes parciales y definitivos de Microbiología. Nutrición incluye programación por comidas. Se verifica con datos ficticios en escritorio y celular.

v291 agrega **Usar cámara**, con captura directa, preferencia por la cámara trasera y cierre automático al terminar. **Elegir del álbum** abre un selector nuevo cada vez y admite todos los formatos de imagen que pueda abrir el navegador. **Buscar en archivos** permite localizar fotos recientes que el álbum del dispositivo no muestre. El orden y la disponibilidad del álbum dependen del sistema y sus permisos.

v290 mejora el registro del paciente: frente y dorso del DNI con vista previa, cambio y eliminación de fotos, lectura con mensajes claros cuando faltan datos y fotografías privadas en **Cuenta → Datos personales**. El registro acepta correo o usuario y conserva el formulario ante errores.

La v289 incorporó el Portal de clientes, registro con lectura local de DNI y verificación institucional, agendas publicadas voluntariamente, reservas y bloqueos comprobados en el servidor e informes ambulatorios de Laboratorio, Microbiología e Imágenes. Cuenta reúne la navegación personal y agrega colores, iluminación y fuentes separados.

Las instituciones y los profesionales deben publicar expresamente sus datos y horarios. Una identidad aprobada en una institución no habilita otra. Los clientes sólo reciben sus resultados publicados y datos permitidos de su ficha verificada. Los documentos están en un depósito privado; no se incluyen historias, DNI ni credenciales privadas en los archivos publicados.

Los turnos del Portal quedan pendientes de confirmación y reservan el horario internamente. Los turneros externos todavía no están conectados: se combinan únicamente las agendas, los turnos y los bloqueos registrados en Hospitalito. La ubicación se usa con permiso y no se inventan distancias cuando faltan coordenadas.

Se conserva la sincronización clínica, los borradores, la historia por internación, dieta, avisos al médico, portales de imágenes, 18 herramientas de Escalas y la revisión médica de vancomicina por AUC. Los cobros continúan desactivados hasta configurar los acuerdos y proveedores. Las liquidaciones internas no son comprobantes fiscales. TURN e integración de IA continúan pendientes.

`supabase` contiene funciones y migraciones. `tests` conserva comprobaciones de historia, sincronización, permisos y cálculos y agrega pruebas de interfaz del Portal con datos ficticios. Las pruebas reales del servidor se hicieron con cuentas ficticias aisladas, deshabilitadas al finalizar.
