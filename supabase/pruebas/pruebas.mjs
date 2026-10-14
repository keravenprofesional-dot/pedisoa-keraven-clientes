import { nuevaBase, como } from './base.mjs';
const db = await nuevaBase();
let ok = 0, mal = 0;
const bien = (c, msg) => { if (c) { ok++; } else { mal++; console.log('  X FALLA:', msg); } };
const falla = async (fn, msg) => { try { await fn(); bien(false, msg + ' (debio ser rechazado)'); } catch { bien(true, msg); } };
const q = (s, p) => db.query(s, p);

// --- Datos: lo que haria la funcion de servidor admin-usuarios ---
const nu = async (email) => (await q(`insert into auth.users(email) values($1) returning id`, [email])).rows[0].id;
const SUP = await nu('supremo@personal.keraven.local'), MAN = await nu('manuel@personal.keraven.local');
const CA = await nu('cl-a@clientas.keraven.local'), CB = await nu('cl-b@clientas.keraven.local');
const rolSU = (await q(`select id from pedidos_roles where nombre='Super usuario'`)).rows[0].id;
await q(`insert into profiles(id,tipo,es_supremo,usuario,telefono,full_name) values($1,'personal',true,'supremo','8098623014','Dueno')`, [SUP]);
await q(`insert into profiles(id,tipo,rol_id,usuario,telefono,full_name) values($1,'personal',$2,'manuel','8095416241','Manuel')`, [MAN, rolSU]);
await q(`insert into profiles(id,tipo,full_name) values($1,'clienta','Ana'),($2,'clienta','Bea')`, [CA, CB]);
const cliA = (await q(`insert into clients(profile_id,full_name,telefono_login,credit_enabled,credit_limit) values($1,'Ana','8091110000',true,5000) returning id`, [CA])).rows[0].id;
await q(`insert into clients(profile_id,full_name,telefono_login) values($1,'Bea','8092220000')`, [CB]);
const P1 = (await q(`insert into products(nombre,precio,stock) values('Shampoo 32oz',1200,10) returning id`)).rows[0].id;
const P2 = (await q(`insert into products(nombre,precio,stock) values('Mascarilla',800,1) returning id`)).rows[0].id;
const parada = (await q(`select id from delivery_stops limit 1`)).rows[0].id;
const pedido = (uid, items, pago = 'contado', avance = null) => como(db, uid,
  `select * from crear_pedido($1::jsonb,'parada',$2,null,$3,$4,'')`, [JSON.stringify(items), parada, pago, avance]);

console.log('1) Clienta tramposa');
const r1 = await como(db, CA, `update profiles set es_supremo=true, tipo='personal' where id=$1`, [CA]);
bien(r1.affectedRows === 0 && !(await q(`select es_supremo from profiles where id=$1`, [CA])).rows[0].es_supremo, 'clienta NO puede hacerse supremo');
await falla(() => como(db, CA, `insert into orders(client_id,total) values($1,1)`, [cliA]), 'clienta NO inserta pedidos directo');
const o1 = (await pedido(CA, [{ product_id: P1, cantidad: 2 }])).rows[0];
bien(Number(o1.total) === 2400 && o1.order_number.startsWith('KP-'), 'precio lo calcula el servidor (2 x 1200 = 2400)');
bien((await q(`select stock from products where id=$1`, [P1])).rows[0].stock === 8, 'existencia baja de 10 a 8');
await falla(() => pedido(CB, [{ product_id: P1, cantidad: 1 }], 'credito'), 'clienta SIN credito no puede pedir a credito');
await falla(() => pedido(CA, [{ product_id: P2, cantidad: 5 }]), 'no deja pedir mas de lo que hay en existencia');
await falla(() => pedido(CA, [{ product_id: P1, cantidad: 0 }]), 'cantidad 0 rechazada');
await falla(() => pedido(CA, [{ product_id: P1, cantidad: 5 }], 'credito'), 'no deja pasar el limite de credito (6000 > 5000)');
const o2 = (await pedido(CA, [{ product_id: P1, cantidad: 1 }], 'avance', 200)).rows[0];
bien(Number(o2.balance) === 1000, 'avance 200 de 1200 deja balance 1000');
bien(Number((await q(`select balance_pendiente from clients where id=$1`, [cliA])).rows[0].balance_pendiente) === 1000, 'balance de la clienta sube a 1000');
bien((await como(db, CB, `select * from orders`)).rows.length === 0, 'Bea NO ve los pedidos de Ana');
await falla(() => como(db, CB, `insert into order_items(order_id,product_id,cantidad,precio_unitario,subtotal) values($1,$2,1,1,1)`, [o1.id, P1]), 'Bea NO mete productos en pedido de Ana');
bien((await como(db, CA, `update orders set total=1 where id=$1`, [o1.id])).affectedRows === 0, 'clienta NO cambia el total de su pedido');
bien((await como(db, CA, `select * from clients`)).rows.length === 1, 'clienta solo ve su propia ficha');
bien((await como(db, CA, `select * from profiles`)).rows.length === 1, 'clienta solo ve su propio perfil');
bien((await como(db, null, `select * from products`)).rows.length === 0, 'sin entrar (anonimo) no ve nada');
{ const ext = await nu('extrano@x.com'); bien((await como(db, ext, `select * from products`)).rows.length === 0 && (await como(db, ext, `select * from bank_accounts`)).rows.length === 0, 'cuenta creada por fuera (sin perfil) no ve catalogo ni bancos'); }

console.log('2) Super usuario (Manuel)');
bien((await como(db, MAN, `select * from orders`)).rows.length === 2, 've los pedidos de todas las clientas');
bien((await como(db, MAN, `select * from clients`)).rows.length === 2, 've todas las clientas');
const perms = (await como(db, MAN, `select * from mis_permisos()`)).rows.map(r => r.mis_permisos).sort().join(',');
bien(perms === 'cambiar_estado,crear_clientas,ver_clientas,ver_pedidos,ver_solicitudes', 'sus permisos: ' + perms);
bien((await como(db, MAN, `update orders set status='confirmado' where id=$1`, [o1.id])).affectedRows === 1, 'SI cambia el estado de un pedido');
await falla(() => como(db, MAN, `update orders set total=1 where id=$1`, [o1.id]), 'NO cambia montos del pedido');
await falla(() => como(db, MAN, `insert into pedidos_roles(nombre) values('Hackeo')`), 'NO crea roles');
await falla(() => como(db, MAN, `insert into pedidos_rol_permisos values($1,'productos')`, [rolSU]), 'NO se da permisos a si mismo');
bien((await como(db, MAN, `select * from profiles where tipo='personal'`)).rows.length === 1, 'NO ve las cuentas del resto del personal');
await falla(() => como(db, MAN, `select * from registrar_pago($1,100,'efectivo')`, [o2.id]), 'NO registra pagos (no tiene ese permiso)');
bien((await como(db, MAN, `update company_settings set telefono='x'`)).affectedRows === 0, 'NO cambia la configuracion');
bien((await como(db, MAN, `update products set precio=1`)).affectedRows === 0, 'NO cambia precios');

console.log('3) Supremo');
bien((await como(db, SUP, `select * from mis_permisos()`)).rows.length === 12, 'tiene los 12 permisos');
const rn = (await como(db, SUP, `insert into pedidos_roles(nombre) values('Despacho') returning id`)).rows[0].id;
await como(db, SUP, `insert into pedidos_rol_permisos values($1,'despacho'),($1,'ver_pedidos')`, [rn]);
bien(true, 'crea un rol nuevo con sus permisos');
bien((await como(db, SUP, `select * from profiles`)).rows.length === 4, 've todas las cuentas');
const pago = (await como(db, SUP, `select * from registrar_pago($1,300,'transferencia')`, [o2.id])).rows[0];
bien(Number(pago.monto) === 300 && Number((await q(`select balance from orders where id=$1`, [o2.id])).rows[0].balance) === 700, 'registra un pago y el balance baja a 700');
await falla(() => como(db, SUP, `select * from registrar_pago($1,5000,'x')`, [o2.id]), 'no deja pagar mas que el balance');
bien((await como(db, SUP, `update company_settings set telefono='809-000-0000'`)).affectedRows === 1, 'cambia la configuracion');
await como(db, SUP, `update orders set status='cancelado' where id=$1`, [o2.id]);
bien((await q(`select stock from products where id=$1`, [P1])).rows[0].stock === 8 && Number((await q(`select balance_pendiente from clients where id=$1`, [cliA])).rows[0].balance_pendiente) === 0, 'al cancelar vuelve la existencia y se borra el balance');
await falla(() => como(db, SUP, `update orders set status='recibido' where id=$1`, [o2.id]), 'un cancelado no se puede reabrir');
const otro = await nu('x@x');
await falla(() => q(`insert into profiles(id,tipo,es_supremo,full_name) values($1,'personal',true,'Otro')`, [otro]), 'no puede haber dos supremos');
await q(`update profiles set active=false where id=$1`, [MAN]);
bien((await como(db, MAN, `select * from orders`)).rows.length === 0, 'usuario desactivado ya no ve nada');

console.log('4) Entrada');
bien((await como(db, null, `select correo_de_entrada('809-111-0000', true) e`)).rows[0].e === 'cl-a@clientas.keraven.local', 'clienta: telefono con guiones encuentra su cuenta');
bien((await como(db, null, `select correo_de_entrada(' Supremo ', false) e`)).rows[0].e === 'supremo@personal.keraven.local', 'personal: usuario sin importar mayusculas');
bien((await como(db, null, `select correo_de_entrada('8091110000', false) e`)).rows[0].e === null, 'el telefono de una clienta NO sirve en la puerta del personal');
bien((await como(db, null, `select correo_de_entrada('supremo', true) e`)).rows[0].e === null, 'el usuario del personal NO sirve en la puerta de clientas');

console.log(`\nResultado: ${ok} pruebas bien, ${mal} fallas`);
