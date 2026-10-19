# Hospitalito v288 — Escalas, Consultorios y Laboratorio

19 de octubre de 2026. Base: v287.

## Llavecita y menú de la ventana

La llave y los tres puntos que aparecen en la barra de título pertenecen a Microsoft Edge y a su aplicación instalada, fuera de la interfaz de Hospitalito. No se pueden mostrar u ocultar según el rol de Hospitalito mediante este archivo HTML. El acceso al gestor de contraseñas depende del usuario del sistema y del perfil del navegador.

En un equipo compartido, usá cuentas de Windows y perfiles de navegador separados para las personas que deban mantener sus credenciales privadas. No guardes la contraseña de Administración en un perfil compartido. La gestión institucional de permisos continúa dentro de Hospitalito.

Referencias de Microsoft: [aplicaciones instaladas y menú de Edge](https://learn.microsoft.com/microsoft-edge/progressive-web-apps-chromium/ux), [privacidad de las contraseñas guardadas](https://support.microsoft.com/en-us/edge/keep-your-saved-passwords-private-in-microsoft-edge).

## Nuevo módulo Escalas

La botonera clínica incorpora **Escalas**. Se quitó **Herramientas por especialidad** de Consultorios. Buscá por nombre o área, elegí la herramienta, completá sus datos y presioná **Calcular resultado**. **Copiar resultado** permite pegar el informe en una evolución. **Limpiar esta escala** reinicia solo ese formulario.

La biblioteca inicial contiene 18 herramientas:

- NIHSS y Glasgow.
- TIMI para UA/NSTEMI y TIMI para STEMI, separados.
- GRACE clásico por tabla de puntos de ingreso; no es GRACE 2.0.
- APACHE II, SOFA clásico y qSOFA.
- CURB-65 y CRB-65.
- CHA₂DS₂-VA y CHA₂DS₂-VASc, separados.
- HAS-BLED.
- Wells para TEP y Wells para TVP, ambos de dos niveles.
- Child–Pugh estándar.
- Gestograma por FUM.
- Revisión proporcional de vancomicina por AUC24 ya obtenida.

Cada formulario indica su población, unidades y referencias. Los campos inicialmente vacíos no se contabilizan como normales. Los componentes no evaluables de NIHSS y Glasgow no se reemplazan por cero para producir un total completo. APACHE II utiliza las variables de las primeras 24 horas de UCI que más puntos asignen. GRACE muestra puntos y estrato clásico, sin atribuirle un porcentaje de GRACE 2.0.

El NIHSS informa el puntaje y recuerda los elementos que deben revisarse para reperfusión. **No declara que un paciente califica para trombólisis a partir del puntaje solo**: también se necesitan tiempo, discapacidad del déficit, neuroimagen y evaluación de contraindicaciones. Referencia: [AHA/ASA, guía de ACV isquémico de 2026](https://professional.heart.org/en/science-news/2026-guideline-for-the-early-management-of-patients-with-acute-ischemic-stroke).

Los cálculos no prescriben ni se guardan automáticamente. Sus entradas se conservan durante esta apertura de la aplicación, separadas por usuario, institución y paciente, y se mantienen al refrescar la pantalla. Se pueden agregar nuevas escalas revisando sus fuentes y pruebas; no se afirma que esta biblioteca incluya todas las escalas existentes.

## Ocultar horarios de Consultorios

**Mis días y horarios de atención** tiene una flecha para abrir y cerrar el recuadro. Se recuerda tu elección en este navegador e institución. Plegarlo no pierde los valores que estás editando. Para confirmar modificaciones sigue siendo necesario **Guardar mis horarios**.

## Laboratorio y vancocinemia

Las solicitudes ocupan dos columnas en computadora y una en pantallas pequeñas. Se agregó **Vancocinemia (vancomicina)** como estudio seleccionable.

Bioquímica informa la concentración en **mg/L**, equivalente numéricamente a µg/mL. Puede indicar tipo de muestra, extracción, comienzo y fin de la dosis previa, cantidad administrada e intervalo. Los datos faltantes se identifican como no informados. El contexto queda en el informe para el médico y los demás dispositivos.

Con vancomicina activa, un resultado nuevo o corregido produce un aviso naranja para el médico en el paciente y en Prescripciones, además del aviso habitual de Laboratorio. En Prescripciones se muestra **Vancocinemia informada · revisar tratamiento**. Permite ir a la revisión por AUC24, abrir la edición de una orden programada y registrar la conclusión médica. Una corrección del informe vuelve a exigir revisión. Registrar la revisión no cambia la dosis.

**No se cambia la dosis automáticamente con un valor aislado.** El profesional revisa el tratamiento y guarda la prescripción correspondiente; ese cambio sigue llegando a Enfermería por el circuito habitual. La herramienta por AUC24 necesita una exposición calculada por método farmacocinético validado y condiciones estables; devuelve una estimación diaria teórica, sin seleccionar intervalo ni crear una orden. No se aplica a pediatría, diálisis o lesión renal aguda. Fuente: [consenso ASHP/IDSA sobre vancomicina](https://www.idsociety.org/practice-guideline/vancomycin/).

## Sincronización y comprobaciones

No se modificaron las funciones ni los permisos del servidor. Las calculadoras no agregan solicitudes de red. Se probaron los límites y componentes de las escalas, campos incompletos, la solicitud e informe de vancomicina, corrección y revisión médica, diseño de celular y conservación de borradores. La prueba de concurrencia conserva una revisión médica junto con una administración nueva de Enfermería. No se midió en esta entrega el retardo real entre dos dispositivos físicos.

El archivo completo es **Hospitalito_v288.html**, también copiado a Descargas y publicado en GitHub. Las funciones anteriores de historia, dieta, portales y cierre de búsquedas se conservan.

