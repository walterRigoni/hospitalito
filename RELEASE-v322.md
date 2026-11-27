# Hospitalito v322

- Registro de pacientes sin cambios; nueva opción de registro profesional con CUIL como usuario inicial y contraseña elegida por el titular.
- Las cuentas nuevas no reciben membresías institucionales automáticamente. El administrador vincula o revoca el acceso sin cambiar credenciales personales.
- Se conserva el identificador interno al cambiar el nombre de ingreso.
- Traslados: disponibilidad semanal y publicación voluntaria de tipo de servicio, cobertura y contacto. No incluye reservas, pagos ni despacho de emergencias.
- Cámara junto a los selectores de archivos de imagen, incluida la firma y los adjuntos de Ingreso/Evolución.
- La matrícula y habilitación son declaradas; se muestra la entidad de consulta. No se certifica automáticamente.
- Migración `20261127184928_hospitalito_v322_professional_registration_transport.sql` aplicada y funciones auth, login, telemed desplegadas.
- Pruebas: 71 scripts sintácticamente válidos; flujo de navegador con backend simulado; DNI/CUIL, exclusión de roles privilegiados, horario y URL validados; comprobación de RLS y permisos de la tabla de intentos.
