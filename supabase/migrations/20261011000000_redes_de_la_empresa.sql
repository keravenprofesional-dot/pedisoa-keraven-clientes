-- Enlace a las redes, para ponerlo en la app del cliente.
alter table company_settings add column if not exists instagram text;
update company_settings set instagram = 'https://www.instagram.com/keravenp/' where id = 1 and instagram is null;
