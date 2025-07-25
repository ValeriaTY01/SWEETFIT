from flask import Flask, jsonify, request, send_from_directory
import mysql.connector
from flask_cors import CORS
import os
from datetime import datetime, date, timedelta 
import re
from werkzeug.utils import secure_filename

app = Flask(__name__)
CORS(app)

# Carpeta absoluta para guardar imágenes subidas
UPLOAD_FOLDER = os.path.join(app.root_path, 'uploads')
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['ALLOWED_EXTENSIONS'] = {'png', 'jpg', 'jpeg'}
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)


db_config = {
    'host': os.environ['DB_HOST'],
    'user': os.environ['DB_USER'],
    'password': os.environ['DB_PASSWORD'],
    'database': os.environ['DB_NAME'],
    'port': 3306
}

#db_config = {
#    'host': 'localhost',
#    'port': 3306,
#    'user': 'chweHansol',
#   'password': 'kS2!0cN70',
#   'database': 'sweetfit'
#}

# ESTOS ENDPOINTS PERTENECEN A PANEL.HTML___________________________________________________

@app.route('/api/dashboard')
def dashboard():
    conn = mysql.connector.connect(**db_config)
    cursor = conn.cursor(dictionary=True)

    hoy = date.today()

    cursor.execute("SELECT IFNULL(SUM(TOTAL_VENTA), 0) AS ventas_dia FROM venta WHERE DATE(FECHA_VENTA) = %s", (hoy,))
    ventas_dia = cursor.fetchone()['ventas_dia']

    cursor.execute("SELECT COUNT(*) AS clientes_registrados FROM cliente")
    clientes_registrados = cursor.fetchone()['clientes_registrados']

    cursor.execute("SELECT COUNT(*) AS productos_disponibles FROM producto")
    productos_disponibles = cursor.fetchone()['productos_disponibles']

    cursor.execute("SELECT MAX(FECHA_COMPRA) AS ultima_compra FROM compra")
    ultima_compra = cursor.fetchone()['ultima_compra']
    ultima_compra = ultima_compra.strftime('%d/%m/%Y') if ultima_compra else 'Sin registro'

    conn.close()

    return jsonify({
        'ventas_dia': float(ventas_dia),
        'clientes_registrados': clientes_registrados,
        'productos_disponibles': productos_disponibles,
        'ultima_compra': ultima_compra
    })

# ESTOS ENDPOINTS PERTENECEN A PRODUCTOS.HTML Y VENTAS.HTML___________________________________________________

# Ruta para obtener todos los productos
@app.route('/api/productos', methods=['GET'])
def obtener_productos():
    try:
        page = request.args.get('page', type=int)
        limit = request.args.get('limit', type=int)
        categoria = request.args.get('categoria', '')
        nombre = request.args.get('nombre', '').strip().lower()

        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)

        filtros = []
        valores = []

        if categoria:
            filtros.append("categoria = %s")
            valores.append(categoria)

        if nombre:
            filtros.append("LOWER(nombre) LIKE %s")
            valores.append(f"%{nombre}%")

        where_clause = f"WHERE {' AND '.join(filtros)}" if filtros else ""

        if nombre:
            query = f"SELECT * FROM producto {where_clause}"
            cursor.execute(query, tuple(valores))
            productos_crudos = cursor.fetchall()
            total_productos = len(productos_crudos)
            total_paginas = 1
            pagina_actual = 1
        else:
            page = page or 1
            limit = limit or 6
            offset = (page - 1) * limit

            count_query = f"SELECT COUNT(*) FROM producto {where_clause}"
            cursor.execute(count_query, tuple(valores))
            total_productos = cursor.fetchone()['COUNT(*)']

            query = f"SELECT * FROM producto {where_clause} LIMIT %s OFFSET %s"
            cursor.execute(query, (*valores, limit, offset))
            productos_crudos = cursor.fetchall()

            total_paginas = (total_productos // limit) + (1 if total_productos % limit != 0 else 0)
            pagina_actual = page

        cursor.close()
        conn.close()

        productos = [ {
            'id': p['ID_PRODUCTO'],
            'nombre': p['NOMBRE'],
            'descripcion': p['DESCRIPCION'],
            'categoria': p['CATEGORIA'],
            'cantidad': p['CANTIDAD'],
            'precio': float(p['PRECIO']),
            'imagen': p['IMAGEN']
        } for p in productos_crudos ]

        return jsonify({
            'productos': productos,
            'total_productos': total_productos,
            'total_paginas': total_paginas,
            'pagina_actual': pagina_actual
        })

    except mysql.connector.Error as err:
        print("ERROR MYSQL:", err)
        return jsonify({'error': str(err)}), 500

@app.route('/login.html')
def login_page():
    return send_from_directory('.', 'login.html')

#Ruta del login
@app.route('/api/login', methods=['POST'])
def login():
    data = request.json  
    email = data.get('email')
    contraseña = data.get('contraseña')

    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)
        query = "SELECT * FROM empleado WHERE EMAIL = %s AND CONTRASEÑA = %s"
        cursor.execute(query, (email, contraseña))
        user = cursor.fetchone()
        cursor.close()
        conn.close()

        if user:
            return jsonify({
        "mensaje": "Login exitoso",
        "usuario": {
        "id": user["ID_EMPLEADO"],
        "nombre": user["NOMBRE"],
        "apellidos": user["APELLIDOS"],
        "email": user["EMAIL"],
        "puesto": user["PUESTO"]
    }
})
        else:
            return jsonify({"error": "Credenciales incorrectas"}), 401

    except mysql.connector.Error as err:
        return jsonify({"error": str(err)}), 500


# Ruta para obtener las categorías
@app.route('/api/categorias', methods=['GET'])
def obtener_categorias():
    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT DISTINCT categoria FROM producto")
        categorias = cursor.fetchall()
        cursor.close()
        conn.close()
        return jsonify(categorias)
    except mysql.connector.Error as err:
        return jsonify({'error': str(err)}), 500


# Ruta para agregar producto con imagen
@app.route('/api/productos', methods=['POST'])
def agregar_producto():
    try:
        nombre = request.form.get('nombre')
        descripcion = request.form.get('descripcion')
        categoria = request.form.get('categoria')
        cantidad = request.form.get('cantidad')
        precio = request.form.get('precio')
        imagen_file = request.files.get('imagen')

        if not imagen_file:
            return jsonify({'error': 'Imagen requerida'}), 400

        filename = secure_filename(imagen_file.filename)
        ruta_imagen = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        imagen_file.save(ruta_imagen)

        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor()
        query = """INSERT INTO producto 
                   (nombre, descripcion, categoria, cantidad, precio, imagen)
                   VALUES (%s, %s, %s, %s, %s, %s)"""
        cursor.execute(query, (nombre, descripcion, categoria, cantidad, precio, filename))
        conn.commit()
        cursor.close()
        conn.close()

        return jsonify({'success': True, 'mensaje': 'Producto agregado exitosamente'})
    except mysql.connector.Error as err:
        return jsonify({'error': str(err)}), 500

# Ruta para servir las imágenes
@app.route('/uploads/<filename>')
def servir_imagen(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

# Eliminar producto
@app.route('/api/eliminar_producto/<int:id_producto>', methods=['DELETE'])
def eliminar_producto(id_producto):
    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor()

        cursor.execute("SELECT 1 FROM producto WHERE ID_PRODUCTO = %s", (id_producto,))
        if not cursor.fetchone():
            return jsonify({'success': False, 'error': 'Producto no encontrado'}), 404
        
        cursor.execute("DELETE FROM producto WHERE ID_PRODUCTO = %s", (id_producto,))
        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({'success': True, 'mensaje': 'Producto eliminado correctamente'})
    except mysql.connector.Error as err:
        return jsonify({'success': False, 'error': str(err)}), 500

# Editar producto (actualizar imagen)
@app.route('/api/editar_producto/<int:id_producto>', methods=['GET', 'POST'])
def editar_producto(id_producto):
    if request.method == 'GET':
        try:
            conn = mysql.connector.connect(**db_config)
            cursor = conn.cursor(dictionary=True)
            query = """
                    SELECT ID_PRODUCTO, NOMBRE, DESCRIPCION, CATEGORIA, CANTIDAD, PRECIO, IMAGEN
                    FROM producto 
                    WHERE ID_PRODUCTO = %s
                """
            cursor.execute(query, (id_producto,))
            producto = cursor.fetchone()
            cursor.close()
            conn.close()
            if not producto:
                return jsonify({'success': False, 'error': 'Producto no encontrado'}), 404
            
            producto_data = {
                'ID_PRODUCTO': producto['ID_PRODUCTO'],
                'nombre': producto['NOMBRE'],
                'descripcion': producto['DESCRIPCION'],
                'categoria': producto['CATEGORIA'],
                'cantidad': producto['CANTIDAD'],
                'precio': float(producto['PRECIO']),
                'imagen': producto['IMAGEN']
            }
            return jsonify(producto_data), 200
        except mysql.connector.Error as err:
            return jsonify({'success': False, 'error': str(err)}), 500

    if request.method == 'POST' and request.form.get('_method') == 'PUT':
        try:
            nombre = request.form.get('nombre')
            descripcion = request.form.get('descripcion')
            categoria = request.form.get('categoria')
            cantidad = request.form.get('cantidad')
            precio = request.form.get('precio')

            imagen = None
            if 'imagen' in request.files:
                imagen_file = request.files['imagen']
                if imagen_file and imagen_file.filename != '':
                    filename = secure_filename(imagen_file.filename)
                    ruta_imagen = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                    imagen_file.save(ruta_imagen)
                    imagen = filename

            conn = mysql.connector.connect(**db_config)
            cursor = conn.cursor()

            if imagen:
                query = """UPDATE producto 
                           SET NOMBRE = %s, DESCRIPCION = %s, CATEGORIA = %s, 
                               CANTIDAD = %s, PRECIO = %s, IMAGEN = %s 
                           WHERE ID_PRODUCTO = %s"""
                cursor.execute(query, (nombre, descripcion, categoria, cantidad, precio, imagen, id_producto))
            else:
                query = """UPDATE producto 
                           SET NOMBRE = %s, DESCRIPCION = %s, CATEGORIA = %s, 
                               CANTIDAD = %s, PRECIO = %s 
                           WHERE ID_PRODUCTO = %s"""
                cursor.execute(query, (nombre, descripcion, categoria, cantidad, precio, id_producto))

            conn.commit()
            cursor.close()
            conn.close()

            return jsonify({
                'success': True,
                'mensaje': 'Producto actualizado exitosamente',
                'imagen': imagen
            }), 200

        except mysql.connector.Error as err:
            return jsonify({'success': False, 'error': str(err)}), 500
        except Exception as e:
            return jsonify({'success': False, 'error': f"Error inesperado: {str(e)}"}), 500

    return jsonify({'success': False, 'error': 'Método no permitido'}), 405

# Obtener producto por ID
@app.route('/api/producto/<int:id_producto>', methods=['GET'])
def obtener_producto_por_id(id_producto):
    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM producto WHERE ID_PRODUCTO = %s", (id_producto,))
        p = cursor.fetchone()
        cursor.close()
        conn.close()

        if p:
            producto = {
                'id_producto': p['ID_PRODUCTO'],
                'nombre': p['NOMBRE'],
                'descripcion': p['DESCRIPCION'],
                'categoria': p['CATEGORIA'],
                'cantidad': p['CANTIDAD'],
                'precio': float(p['PRECIO']),
                'imagen': p['IMAGEN']
            }
            return jsonify(producto)
        else:
            return jsonify({'error': 'Producto no encontrado'}), 404
    except mysql.connector.Error as err:
        return jsonify({'error': str(err)}), 500
    
# ESTOS ENDPOINTS PERTENECEN A VENTAS.HTML___________________________________________________
@app.route('/api/ventas', methods=['GET'])
def obtener_ventas():
    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)

        query = """
            SELECT 
                v.ID_VENTA,
                v.FECHA_VENTA,
                v.TIPO_VENTA,
                v.TOTAL_VENTA,
                v.ESTADO,
                CONCAT(e.NOMBRE, ' ', e.APELLIDOS) AS empleado,
                CONCAT(c.NOMBRE, ' ', c.APELLIDO_PATERNO) AS CLIENTE
            FROM venta v
            LEFT JOIN empleado e ON v.ID_EMPLEADO = e.ID_EMPLEADO
            LEFT JOIN cliente c ON v.ID_CLIENTE = c.ID_CLIENTE
            ORDER BY v.FECHA_VENTA DESC
        """
        cursor.execute(query)
        ventas = cursor.fetchall()

        cursor.close()
        conn.close()
        return jsonify(ventas)
    except mysql.connector.Error as err:
        return jsonify({'error': str(err)}), 500
    

@app.route('/api/ventas', methods=['POST'])
def registrar_venta():
    try:
        data = request.get_json()

        cliente = data.get("cliente")
        carrito = data.get("carrito")
        empleado = data.get("empleado")
        TIPOS_VENTA_VALIDOS = {"Local", "Domicilio", "App"}

        tipo_venta_raw = data.get("tipo_venta", "")
        tipo_venta = tipo_venta_raw.strip().capitalize()

        if tipo_venta not in TIPOS_VENTA_VALIDOS:
            return jsonify({"error": f"Tipo de venta inválido. Valores permitidos: {', '.join(TIPOS_VENTA_VALIDOS)}"}), 400


        estado = data.get("estado", "FINALIZADA").upper()

        ESTADOS_VALIDOS = {"FINALIZADA", "EN ESPERA", "CANCELADA"}
        if estado not in ESTADOS_VALIDOS:
            return jsonify({"error": f"Estado inválido. Valores permitidos: {', '.join(ESTADOS_VALIDOS)}"}), 400

        if not carrito or not cliente or not empleado or not tipo_venta:
            return jsonify({"error": "Datos incompletos"}), 400

        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor()

        # 1. Buscar si el cliente ya existe
        query_buscar_cliente = """
            SELECT ID_CLIENTE FROM cliente
            WHERE NOMBRE = %s AND APELLIDO_PATERNO = %s AND APELLIDO_MATERNO = %s AND TELEFONO = %s
        """
        cursor.execute(query_buscar_cliente, (
            cliente["nombre"],
            cliente["apellido_paterno"],
            cliente["apellido_materno"],
            cliente["telefono"]
        ))
        cliente_existente = cursor.fetchone()

        if cliente_existente:
            id_cliente = cliente_existente[0]
        else:
            # Si no existe, insertarlo
            query_cliente = """
                INSERT INTO cliente (NOMBRE, APELLIDO_PATERNO, APELLIDO_MATERNO, DIRECCION, TELEFONO)
                VALUES (%s, %s, %s, %s, %s)
            """
            cursor.execute(query_cliente, (
                cliente["nombre"],
                cliente["apellido_paterno"],
                cliente["apellido_materno"],
                cliente["direccion"],
                cliente["telefono"]
            ))
            id_cliente = cursor.lastrowid


        # 2. Obtener ID del empleado (supongo que llega como nombre completo)
        query_empleado = "SELECT ID_EMPLEADO FROM empleado WHERE CONCAT(NOMBRE, ' ', APELLIDOS) = %s"
        cursor.execute(query_empleado, (empleado,))
        empleado_result = cursor.fetchone()
        if not empleado_result:
            conn.rollback()
            return jsonify({"error": "empleado no encontrado"}), 400
        id_empleado = empleado_result[0]

        # 3. Calcular total
        total = sum(p['subtotal'] for p in carrito)

        # 4. Insertar venta
        query_venta = """
            INSERT INTO venta (ID_CLIENTE, TIPO_VENTA, TOTAL_VENTA, FECHA_VENTA, ID_EMPLEADO, ESTADO)
            VALUES (%s, %s, %s, %s, %s, %s)
        """
        fecha_venta = datetime.now()
        cursor.execute(query_venta, (
            id_cliente,
            tipo_venta,
            total,
            fecha_venta,
            id_empleado,
            estado
        ))
        id_venta = cursor.lastrowid

        # 5. Insertar productos en detalle_venta
        for producto in carrito:
            query_detalle = """
                INSERT INTO detalle_venta (SUBTOTAL_VENTA, CANTIDAD_VENTA, ID_VENTA, ID_PRODUCTO)
                VALUES (%s, %s, %s, %s)
            """
            cursor.execute(query_detalle, (
                producto["subtotal"],
                producto["cantidad"],
                id_venta,
                producto["id"]
            ))

        conn.commit()
        cursor.close()
        conn.close()

        return jsonify({"mensaje": "Venta registrada correctamente", "id_venta": id_venta})

    except mysql.connector.Error as err:
        print("Error al registrar venta:", err)
        return jsonify({"error": str(err)}), 500
    

@app.route('/api/ventas/<int:id_venta>', methods=['PUT'])
def actualizar_venta_completa(id_venta):
    try:
        data = request.get_json()

        nuevo_estado = data.get("estado", "").upper()
        tipo_venta_raw = data.get("tipo_venta") or data.get("tipoVenta") or ""
        cliente_data = data.get("cliente", {})
        carrito_data = data.get("carrito", [])

        ESTADOS_VALIDOS = {"FINALIZADA", "EN ESPERA", "CANCELADA"}
        TIPOS_VENTA_VALIDOS = {"Local", "Domicilio", "App"}

        tipo_venta = None
        if tipo_venta_raw:
            tipo_venta_formateado = tipo_venta_raw.strip().capitalize()
            if tipo_venta_formateado not in TIPOS_VENTA_VALIDOS:
                return jsonify({"error": f"Tipo de venta inválido. Debe ser uno de: {', '.join(TIPOS_VENTA_VALIDOS)}"}), 400
            tipo_venta = tipo_venta_formateado

        if nuevo_estado and nuevo_estado not in ESTADOS_VALIDOS:
            return jsonify({"error": f"Estado inválido. Debe ser uno de: {', '.join(ESTADOS_VALIDOS)}"}), 400

        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)

        # Obtener cliente asociado
        cursor.execute("SELECT ID_CLIENTE FROM venta WHERE ID_VENTA = %s", (id_venta,))
        result = cursor.fetchone()
        if not result:
            return jsonify({"error": "Venta no encontrada"}), 404
        id_cliente = result["ID_CLIENTE"]

        # Obtener detalles antiguos (productos y cantidades)
        cursor.execute("SELECT ID_PRODUCTO, CANTIDAD_VENTA FROM detalle_venta WHERE ID_VENTA = %s", (id_venta,))
        detalles_antiguos = cursor.fetchall()
        cantidades_anteriores = {d["ID_PRODUCTO"]: d["CANTIDAD_VENTA"] for d in detalles_antiguos}

        # *** DEVOLVER STOCK ANTIGUO PRIMERO ***
        for detalle in detalles_antiguos:
            cursor.execute(
                "UPDATE producto SET CANTIDAD = CANTIDAD + %s WHERE ID_PRODUCTO = %s",
                (detalle["CANTIDAD_VENTA"], detalle["ID_PRODUCTO"])
            )

        # VALIDAR STOCK NUEVO
        for item in carrito_data:
            id_producto = item.get("ID_PRODUCTO") or item.get("id") or item.get("id_producto")
            cantidad_nueva = item.get("cantidad")

            if id_producto is None or cantidad_nueva is None:
                return jsonify({"error": f"Producto con datos faltantes: {item}"}), 400

            cursor.execute("SELECT CANTIDAD FROM producto WHERE ID_PRODUCTO = %s", (id_producto,))
            producto = cursor.fetchone()
            if not producto:
                return jsonify({"error": f"Producto con ID {id_producto} no encontrado"}), 404

            stock_actual = producto["CANTIDAD"]

            if cantidad_nueva > stock_actual:
                return jsonify({"error": f"Stock insuficiente para el producto {id_producto} (Disponible: {stock_actual}, Pedido: {cantidad_nueva})"}), 400

        # ACTUALIZAR CLIENTE
        if cliente_data:
            cursor.execute("""
                UPDATE cliente SET NOMBRE = %s, APELLIDO_PATERNO = %s, APELLIDO_MATERNO = %s,
                DIRECCION = %s, TELEFONO = %s WHERE ID_CLIENTE = %s
            """, (
                cliente_data.get("nombre"),
                cliente_data.get("apellido_paterno"),
                cliente_data.get("apellido_materno"),
                cliente_data.get("direccion"),
                cliente_data.get("telefono"),
                id_cliente
            ))

        # ACTUALIZAR ESTADO Y TIPO VENTA
        if nuevo_estado:
            cursor.execute("UPDATE venta SET ESTADO = %s WHERE ID_VENTA = %s", (nuevo_estado, id_venta))
        if tipo_venta:
            cursor.execute("UPDATE venta SET TIPO_VENTA = %s WHERE ID_VENTA = %s", (tipo_venta, id_venta))

        # ELIMINAR DETALLES ANTIGUOS (ya devolvimos stock antes)
        cursor.execute("DELETE FROM detalle_venta WHERE ID_VENTA = %s", (id_venta,))

        # INSERTAR NUEVOS DETALLES Y DESCONTAR STOCK
        insert_detalle_query = """
            INSERT INTO detalle_venta (ID_VENTA, ID_PRODUCTO, CANTIDAD_VENTA, SUBTOTAL_VENTA)
            VALUES (%s, %s, %s, %s)
        """
        for item in carrito_data:
            id_producto = item.get("ID_PRODUCTO") or item.get("id") or item.get("id_producto")
            cantidad = item.get("cantidad")
            subtotal = item.get("subtotal")

            cursor.execute(insert_detalle_query, (id_venta, id_producto, cantidad, subtotal))

        conn.commit()
        cursor.close()
        conn.close()

        return jsonify({"mensaje": f"Venta {id_venta} actualizada correctamente"})

    except mysql.connector.Error as err:
        return jsonify({"error": str(err)}), 500


@app.route('/api/ventas/<int:id_venta>', methods=['GET'])
def obtener_detalles_venta(id_venta):
    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)

        # Obtener info cliente, venta y empleado
        query_venta = """
            SELECT v.ID_VENTA, v.FECHA_VENTA, v.TIPO_VENTA, v.TOTAL_VENTA, v.ESTADO,
                   c.ID_CLIENTE, c.NOMBRE AS cliente_nombre, c.APELLIDO_PATERNO AS cliente_apellido_paterno,
                   c.APELLIDO_MATERNO AS cliente_apellido_materno, c.DIRECCION AS cliente_direccion,
                   c.TELEFONO AS cliente_telefono,
                   e.NOMBRE AS empleado_nombre, e.APELLIDOS AS empleado_apellidos
            FROM venta v
            JOIN cliente c ON v.ID_CLIENTE = c.ID_CLIENTE
            LEFT JOIN empleado e ON v.ID_EMPLEADO = e.ID_EMPLEADO
            WHERE v.ID_VENTA = %s
        """
        cursor.execute(query_venta, (id_venta,))
        venta = cursor.fetchone()
        if not venta:
            return jsonify({"error": "Venta no encontrada"}), 404

        # Obtener detalles del carrito (productos)
        query_detalle = """
            SELECT dv.ID_PRODUCTO, p.NOMBRE, dv.CANTIDAD_VENTA AS cantidad, 
                   p.PRECIO, dv.SUBTOTAL_VENTA AS subtotal
            FROM detalle_venta dv
            JOIN producto p ON dv.ID_PRODUCTO = p.ID_PRODUCTO
            WHERE dv.ID_VENTA = %s
        """
        cursor.execute(query_detalle, (id_venta,))
        carrito = cursor.fetchall()

        cursor.close()
        conn.close()

        # Construir cliente como nombre completo
        cliente_nombre_completo = " ".join(filter(None, [
            venta.get("cliente_nombre"),
            venta.get("cliente_apellido_paterno"),
            venta.get("cliente_apellido_materno")
        ])).strip() or "Cliente desconocido"

        # Construir empleado como nombre completo
        empleado_nombre_completo = " ".join(filter(None, [
            venta.get("empleado_nombre"),
            venta.get("empleado_apellidos")
        ])).strip() or "Empleado desconocido"

        # Fecha en formato ISO para JS
        fecha_iso = venta["FECHA_VENTA"].isoformat() if venta.get("FECHA_VENTA") else ""

        # Estructura de respuesta
        response = {
            "orden": venta["ID_VENTA"],
            "cliente": cliente_nombre_completo,
            "empleado": empleado_nombre_completo,
            "fecha": fecha_iso,
            "direccion": venta.get("cliente_direccion", ""),
            "telefono": venta.get("cliente_telefono", ""),
            "tipo_venta": venta.get("TIPO_VENTA", ""),
            "detallesV": [
                {
                    "ID_PRODUCTO": item["ID_PRODUCTO"],              # ¡Aquí está el ID correcto!
                    "PRODUCTO": item["NOMBRE"],
                    "CANTIDAD_VENTA": item["cantidad"],
                    "PRECIO_UNITARIO": float(item["PRECIO"]),
                    "SUBTOTAL_VENTA": float(item["subtotal"])
                } for item in carrito
            ]
        }

        return jsonify(response)

    except mysql.connector.Error as err:
        return jsonify({"error": str(err)}), 500
    
    
# Obtener historial de ventas con filtros
@app.route('/api/ventas/historial', methods=['GET'])
def historial_ventas():
    try:
        fecha_inicio = request.args.get('fecha_inicio')
        fecha_fin = request.args.get('fecha_fin')
        tipo_venta = request.args.get('tipo_venta')
        id_empleado = request.args.get('empleado')

        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)

        query = """
            SELECT v.ID_VENTA, v.FECHA_VENTA, v.TOTAL_VENTA, v.TIPO_VENTA, v.ESTADO,
                   c.NOMBRE AS nombre_cliente,
                   e.NOMBRE AS nombre_empleado
            FROM venta v
            LEFT JOIN cliente c ON v.ID_CLIENTE = c.ID_CLIENTE
            LEFT JOIN empleado e ON v.ID_EMPLEADO = e.ID_EMPLEADO
            WHERE 1=1
        """
        params = []

        if fecha_inicio and fecha_fin:
            query += " AND v.FECHA_VENTA BETWEEN %s AND %s"
            params.extend([fecha_inicio, fecha_fin])

        if tipo_venta:
            query += " AND v.TIPO_VENTA = %s"
            params.append(tipo_venta)

        if id_empleado:
            query += " AND v.ID_EMPLEADO = %s"
            params.append(id_empleado)

        query += " ORDER BY v.FECHA_VENTA DESC"

        cursor.execute(query, tuple(params))
        ventas = cursor.fetchall()

        cursor.close()
        conn.close()

        return jsonify(ventas)
    except mysql.connector.Error as err:
        return jsonify({'error': str(err)}), 500

#Ruta para info del ticket venta
@app.route('/api/ventas/<int:id_venta>', methods=['GET'])
def  detalle_venta(id_venta):
    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary = True)
        query_venta= """
        SELECT V.ID_VENTA AS ORDEN_VENTA, V.FECHA_VENTA, CONCAT(C.NOMBRE, ' ', C.APELLIDO_PATERNO, ' ', C.APELLIDO_MATERNO) AS 'NOMBRE_CLIENTE',
        E.NOMBRE AS 'NOMBRE_EMPLEADO'
        FROM venta V
        LEFT JOIN cliente C ON V.ID_CLIENTE = C.ID_CLIENTE
        JOIN empleado E ON V.ID_EMPLEADO = E.ID_EMPLEADO
        WHERE V.ID_VENTA = %s;
        """ 
        cursor.execute(query_venta, (id_venta,))
        venta = cursor.fetchone()
        if not venta :
            return jsonify({'error': 'Venta no encontrada'}), 404
        
        orden_venta = venta['ORDEN_VENTA']
        fecha_venta = venta['FECHA_VENTA'].strftime("%Y-%m-%dT%H:%M:%S")
        nombre_cliente = venta['NOMBRE_CLIENTE'] or "General"
        nombre_empleado = venta['NOMBRE_EMPLEADO']

        query_detallesV ="""
        SELECT DV.CANTIDAD_VENTA, PR.NOMBRE AS PRODUCTO, PR.PRECIO AS 'PRECIO_UNITARIO', DV.SUBTOTAL_VENTA
        FROM detalle_venta DV
        JOIN producto PR ON DV.ID_PRODUCTO = PR.ID_PRODUCTO
        WHERE DV.ID_VENTA = %s;
        """ 
        cursor.execute(query_detallesV, (id_venta,))
        detallesV = cursor.fetchall()
        cursor.close()
        conn.close()
        return jsonify({
            'orden': orden_venta,
            'fecha': fecha_venta,
            'cliente': nombre_cliente,
            'empleado': nombre_empleado,
            'detallesV': detallesV
        })

    except mysql.connector.Error as err:
        print("Error al consultar detalles de la venta:", err)
        return jsonify({'error': str(err)}), 500
    
    
@app.route('/api/cliente', methods=['GET'])
def buscar_cliente():
    nombre_query = request.args.get('nombre', '').strip()
    if not nombre_query:
        return jsonify([])  # Sin nombre no buscamos nada

    conn = mysql.connector.connect(**db_config)
    cursor = conn.cursor(dictionary=True)

    # Buscar clientes cuyo nombre empiece con lo escrito
    query = """
        SELECT NOMBRE, APELLIDO_PATERNO, APELLIDO_MATERNO, DIRECCION, TELEFONO
        FROM cliente
        WHERE NOMBRE LIKE %s
        LIMIT 5
    """
    cursor.execute(query, (nombre_query + '%',))
    resultados = cursor.fetchall()

    cursor.close()
    conn.close()

    return jsonify(resultados)

# ESTOS ENDPOINTS PERTENECEN A CLIENTE.HTML __________________________________________________________________________________________
# Ruta para obtener todos los clientes
@app.route('/api/clientes', methods=['GET'])
def obtener_clientes():
    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM cliente")
        clientes = cursor.fetchall()
        cursor.close()
        conn.close()
        return jsonify(clientes)
    except mysql.connector.Error as err:
        return jsonify({'error': str(err)}), 500
    
# ruta para agregar clientes
@app.route('/api/clientes', methods=['POST'])
def agregar_cliente():
    try:
        data = request.json
        nombre = data.get('nombre')
        apellido_paterno = data.get('apellido_paterno')
        apellido_materno = data.get('apellido_materno')
        direccion = data.get('direccion')
        telefono = data.get('telefono')

        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor()
        query = "INSERT INTO cliente (nombre, apellido_paterno, apellido_materno, direccion, telefono) VALUES (%s, %s, %s, %s, %s)"
        cursor.execute(query, (nombre, apellido_paterno, apellido_materno, direccion, telefono))
        conn.commit()
        cursor.close()
        conn.close()

        return jsonify({'success': True})
    except mysql.connector.Error as err:
        return jsonify({'success': False, 'error': str(err)}), 500
    
# Ruta para eliminar clientes
@app.route('/api/clientes/<int:id_cliente>', methods=['DELETE'])
def eliminar_cliente(id_cliente):
    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor()
        cursor.execute("DELETE FROM cliente WHERE id_cliente = %s", (id_cliente,))
        conn.commit()
        cursor.close()
        conn.close()

        return jsonify({'success': True})
    except mysql.connector.Error as err:
        return jsonify({'success': False, 'error': str(err)}), 500
    
# Ruta para obtener el historial de venntas por cada cliente
@app.route('/api/clientes/<int:id_cliente>/historial', methods=['GET'])
def obtener_historial_compras(id_cliente):
    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)

        query = """
        SELECT V.ID_VENTA, V.TIPO_VENTA, V.TOTAL_VENTA, V.FECHA_VENTA
        FROM venta V
        WHERE V.ID_CLIENTE = %s
        """
        cursor.execute(query, (id_cliente,))
        historial = cursor.fetchall()
        cursor.close()
        conn.close()
        
        if historial:
            return jsonify(historial)
        else:
            return jsonify({'message': 'No se encontraron ventas para este cliente.'}), 404
    except mysql.connector.Error as err:
        return jsonify({'error': str(err)}), 500
# __________________________________________________________________________________________________________________________________

# ESTOS ENDPOINTS PERTENECEN A PROVEEDORES.HTML __________________________________________________________________________________________
# Obtener proveedores
@app.route('/api/proveedores', methods=['GET'])
def obtener_proveedores():
    try:
        nombre = request.args.get('nombre','').strip().lower()

        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)
        if nombre:
            query = "SELECT * FROM proveedor WHERE LOWER(NOMBRE) LIKE %s"
            cursor.execute(query, (f"%{nombre}%",))
        else:
            cursor.execute("SELECT * FROM proveedor")

        proveedores = cursor.fetchall()
        cursor.close()
        conn.close()
        return jsonify(proveedores)
    except mysql.connector.Error as err:
        return jsonify({'error': str(err)}), 500
    
#Obtener productos por proveedor
@app.route('/api/productoproveedor/<int:id_proveedor>', methods=['GET'])
def obtener_productoproveedor(id_proveedor):
    try: 
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)
        query = """
        SELECT p.*, pr.NOMBRE as nombre_proveedor, pr.ID_PROVEEDOR as id_proveedor
        FROM producto p
        JOIN producto_proveedor pp ON p.ID_PRODUCTO = pp.ID_PRODUCTO
        JOIN proveedor pr ON pp.ID_PROVEEDOR = pr.ID_PROVEEDOR
        WHERE pr.ID_PROVEEDOR = %s
        """
        cursor.execute(query, (id_proveedor,))
        productos = cursor.fetchall()
        cursor.close()
        conn.close()
        return jsonify(productos)
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    

# Agregar proveedor
@app.route('/api/proveedores', methods=['POST'])
def agregar_proveedor():
    try:
        data = request.json
        nombre = data.get('nombre')
        email = data.get('email')
        telefono = data.get('telefono')

        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor()
        query = "INSERT INTO proveedor (NOMBRE, EMAIL, TELEFONO) VALUES (%s, %s, %s)"
        cursor.execute(query, (nombre, email, telefono))
        conn.commit()
        cursor.close()
        conn.close()

        return jsonify({'success': True})
    except mysql.connector.Error as err:
        return jsonify({'error': str(err)}), 500
    
#EliminarProveedor
@app.route('/api/proveedores/<int:id_proveedor>', methods=['DELETE'])
def eliminar_proveedor(id_proveedor):
    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor()

        cursor.execute("DELETE FROM proveedor WHERE ID_PROVEEDOR = %s", (id_proveedor,))
        conn.commit()
        cursor.close()
        conn.close()

        return jsonify({'success': True})
    except mysql.connector.Error as err:
        return jsonify({'error': str(err)}), 500
    
#Editar Proveedor
@app.route('/api/proveedores/<int:id_proveedor>', methods=['PUT'])
def actualizar_proveedor(id_proveedor):
    try:
        data = request.json
        nombre =data.get('nombre')
        email = data.get('email')
        telefono = data.get('telefono')

        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor()
        query = """
                UPDATE PROVEEDOR
                SET NOMBRE = %s, EMAIL = %s, TELEFONO = %s
                WHERE ID_PROVEEDOR = %s
        """
        cursor.execute(query, (nombre, email, telefono, id_proveedor))
        conn.commit()
        cursor.close()
        conn.close()

        return jsonify({'success': True})
    except mysql.connector.Error as err:
        return jsonify({'error': str(err)}, 500)

# Registrar una compra
@app.route('/api/compras', methods=['POST'])
def registrar_compra():
    try:
        data = request.json
        proveedor_id = data.get('proveedor')
        empleado_id = data.get('empleado')
        productos = data.get('productos')

        if not proveedor_id or not productos or not empleado_id:
            return jsonify({'error': 'Faltan datos de proveedor, empleado o productos'}), 400

        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor()

        cursor.execute(
            "INSERT INTO compra (ID_PROVEEDOR, ID_EMPLEADO, TOTAL_COMPRA) VALUES (%s, %s, %s)",
            (proveedor_id, empleado_id, 0)  # Total temporal
        )
        id_compra = cursor.lastrowid

        total = 0
        for prod in productos:
            id_producto = prod['id']
            cantidad = prod['cantidad']

            cursor.execute("SELECT PRECIO FROM `u783499980_sweetfit`.`producto` WHERE ID_PRODUCTO = %s", (id_producto,))
            precio = cursor.fetchone()[0]
            subtotal = float(precio) * cantidad
            total += subtotal

            cursor.execute("""
                INSERT INTO detalle_compra (ID_COMPRA, ID_PRODUCTO, CANTIDAD_COMPRA, SUBTOTAL_COMPRA)
                VALUES (%s, %s, %s, %s)
            """, (id_compra, id_producto, cantidad, subtotal))

            # Actualizar inventario

#            cursor.execute("""
#                UPDATE producto SET CANTIDAD = CANTIDAD + %s WHERE ID_PRODUCTO = %s
#           """, (cantidad, id_producto))

        # Actualizar total final
        cursor.execute("UPDATE compra SET TOTAL_COMPRA = %s WHERE ID_COMPRA = %s", (total, id_compra))

        conn.commit()
        cursor.close()
        conn.close()

        return jsonify({'success': True})
    except mysql.connector.Error as err:
        return jsonify({'error': str(err)}), 500

# Obtener historial de compras
@app.route('/api/compras', methods=['GET'])
def historial_compras_proveedores():
    try:
        fecha = request.args.get('fecha')

        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)

        query = """
        SELECT C.ID_COMPRA, C.FECHA_COMPRA, C.TOTAL_COMPRA, P.NOMBRE AS NOMBRE_PROVEEDOR
        FROM compra C
        JOIN proveedor P ON C.ID_PROVEEDOR = P.ID_PROVEEDOR
        """
        if fecha:
            query += " WHERE DATE(C.FECHA_COMPRA) = %s ORDER BY C.FECHA_COMPRA DESC"
            cursor.execute(query, (fecha,))
        else:
            query += " ORDER BY C.FECHA_COMPRA DESC"
            cursor.execute(query)

        compras = cursor.fetchall()
        cursor.close()
        conn.close()

        return jsonify([
            {
                'id_compra': c['ID_COMPRA'],
                'fecha': c['FECHA_COMPRA'].strftime("%d-%m-%Y %H:%M"),
                'total': float(c['TOTAL_COMPRA']),
                'nombre_proveedor': c['NOMBRE_PROVEEDOR']
            } for c in compras
        ])
    except mysql.connector.Error as err:
        return jsonify({'error': str(err)}), 500

# RUTA PARA LOS TICKETS DE COMPRA
@app.route('/api/compras/<int:id_compra>', methods=['GET'])
def detalle_compra(id_compra):
    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)
        query_compra = """
        SELECT C.FECHA_COMPRA, P.NOMBRE AS PROVEEDOR_NOMBRE, C.ID_COMPRA AS ORDEN_COMPRA, E.NOMBRE AS NOMBRE_EMPLEADO
        FROM compra C
        JOIN proveedor P ON C.ID_PROVEEDOR = P.ID_PROVEEDOR
        JOIN empleado E ON C.ID_EMPLEADO = E.ID_EMPLEADO
        WHERE C.ID_COMPRA = %s;
        """
        cursor.execute(query_compra, (id_compra,))
        compra = cursor.fetchone()

        if not compra:
            return jsonify({'error': 'Compra no encontrada'}), 404

        fecha_compra = compra['FECHA_COMPRA'].strftime("%Y-%m-%dT%H:%M:%S")
        nombre_proveedor = compra['PROVEEDOR_NOMBRE']
        orden_compra = compra['ORDEN_COMPRA']
        nombre_empleado = compra['NOMBRE_EMPLEADO']


        query_detalles = """
        SELECT DP.CANTIDAD_COMPRA, PR.NOMBRE, PR.PRECIO AS 'PRECIO UNITARIO', DP.SUBTOTAL_COMPRA
        FROM detalle_compra DP
        JOIN producto PR ON DP.ID_PRODUCTO = PR.ID_PRODUCTO
        WHERE DP.ID_COMPRA = %s;
        """
        cursor.execute(query_detalles, (id_compra,))
        detalles = cursor.fetchall()

        cursor.close()
        conn.close()

        return jsonify({
            'fecha': fecha_compra,
            'proveedor': nombre_proveedor,
            'orden': orden_compra,
            'empleado': nombre_empleado,
            'detalles': detalles
        })

    except mysql.connector.Error as err:
        print("Error al consultar detalles de la compra:", err)
        return jsonify({'error': str(err)}), 500

# __________________________________________________________________________________________________________________________________

# ESTOS ENDPOINTS PERTENECEN A REPORTES.HTML______________________________________________________________________________________________________________________

def parse_fecha_semana(fecha):
    match = re.match(r"(\d{4})-W(\d{1,2})", fecha)
    if match:
        anio = int(match.group(1))
        semana = int(match.group(2))
        return anio, semana
    return None, None

def validar_fecha_diario(fecha):
    try:
        dt = datetime.strptime(fecha, '%Y-%m-%d')
        return dt.date()
    except ValueError:
        return None

def validar_fecha_mensual(fecha):
    try:
        dt = datetime.strptime(fecha, '%Y-%m')
        return dt.year, dt.month
    except ValueError:
        return None, None

@app.route('/api/reportes/ventas', methods=['GET'])
def obtener_ventas_reporte():
    tipo = request.args.get('tipo', 'diario').lower()
    fecha = request.args.get('fecha', None)

    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)

        if tipo == 'diario':
            if fecha:
                fecha_valida = validar_fecha_diario(fecha)
                if not fecha_valida:
                    return jsonify({'error': 'Formato de fecha inválido para tipo diario. Use YYYY-MM-DD'}), 400

                query = """
                    SELECT 
                        DATE_FORMAT(FECHA_VENTA, '%Y-%m-%d %H:00:00') AS fecha,
                        SUM(TOTAL_VENTA) AS total_ventas
                    FROM venta
                    WHERE DATE(FECHA_VENTA) = %s AND ESTADO = 'FINALIZADA'
                    GROUP BY HOUR(FECHA_VENTA)
                    ORDER BY HOUR(FECHA_VENTA)
                """
                cursor.execute(query, (fecha_valida,))
                ventas = cursor.fetchall()
            else:
                query = """
                    SELECT 
                        DATE(FECHA_VENTA) AS fecha,
                        SUM(TOTAL_VENTA) AS total_ventas
                    FROM venta
                    WHERE FECHA_VENTA >= CURDATE() - INTERVAL 30 DAY AND ESTADO = 'FINALIZADA'
                    GROUP BY DATE(FECHA_VENTA)
                    ORDER BY fecha
                """
                cursor.execute(query)
                ventas = cursor.fetchall()

        elif tipo == 'semanal':
            if fecha:
                anio, semana = parse_fecha_semana(fecha)
                if anio is None or semana is None:
                    return jsonify({'error': 'Formato de fecha inválido para tipo semanal. Use YYYY-Www'}), 400

                query = """
                    SELECT 
                        DATE(FECHA_VENTA) AS fecha,
                        SUM(TOTAL_VENTA) AS total_ventas
                    FROM venta
                    WHERE YEAR(FECHA_VENTA) = %s 
                    AND WEEK(FECHA_VENTA, 1) = %s
                    AND ESTADO = 'FINALIZADA'
                    GROUP BY DATE(FECHA_VENTA)
                    ORDER BY fecha
                """
                cursor.execute(query, (anio, semana))
                ventas = cursor.fetchall()
            else:
                query = """
                    SELECT 
                        DATE(FECHA_VENTA) AS fecha,
                        SUM(TOTAL_VENTA) AS total_ventas
                    FROM venta
                    WHERE FECHA_VENTA >= CURDATE() - INTERVAL 12 WEEK
                    AND ESTADO = 'FINALIZADA'
                    GROUP BY DATE(FECHA_VENTA)
                    ORDER BY fecha
                """
                cursor.execute(query)
                ventas = cursor.fetchall()

        elif tipo == 'mensual':
            if fecha:
                anio, mes = validar_fecha_mensual(fecha)
                if anio is None or mes is None:
                    return jsonify({'error': 'Formato de fecha inválido para tipo mensual. Use YYYY-MM'}), 400

                query = """
                    SELECT 
                        YEAR(FECHA_VENTA) AS anio,
                        MONTH(FECHA_VENTA) AS mes,
                        DATE_FORMAT(FECHA_VENTA, '%Y-%m-01') AS fecha,
                        SUM(TOTAL_VENTA) AS total_ventas
                    FROM venta
                    WHERE YEAR(FECHA_VENTA) = %s AND MONTH(FECHA_VENTA) = %s AND ESTADO = 'FINALIZADA'
                    GROUP BY anio, mes
                    ORDER BY anio, mes
                """
                cursor.execute(query, (anio, mes))
                ventas = cursor.fetchall()
            else:
                query = """
                    SELECT 
                        YEAR(FECHA_VENTA) AS anio,
                        MONTH(FECHA_VENTA) AS mes,
                        DATE_FORMAT(FECHA_VENTA, '%Y-%m-01') AS fecha,
                        SUM(TOTAL_VENTA) AS total_ventas
                    FROM venta
                    WHERE FECHA_VENTA >= CURDATE() - INTERVAL 12 MONTH AND ESTADO = 'FINALIZADA'
                    GROUP BY anio, mes
                    ORDER BY anio, mes
                """
                cursor.execute(query)
                ventas = cursor.fetchall()

        else:
            return jsonify({'error': 'Tipo de reporte inválido. Use diario, semanal o mensual.'}), 400

        cursor.close()
        conn.close()

        return jsonify({'ventas': ventas})

    except mysql.connector.Error as err:
        print("ERROR MYSQL:", err)
        return jsonify({'error': str(err)}), 500

    
@app.route('/api/reportes/categorias', methods=['GET'])
def obtener_categorias_mas_vendidas():
    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)

        query = """
            SELECT p.CATEGORIA, SUM(dv.CANTIDAD_VENTA) as total_cantidad_vendida, SUM(dv.SUBTOTAL_VENTA) as total_ventas
            FROM detalle_venta dv
            JOIN producto p ON dv.ID_PRODUCTO = p.ID_PRODUCTO
            JOIN venta v ON dv.ID_VENTA = v.ID_VENTA
            WHERE v.FECHA_VENTA >= CURDATE() - INTERVAL 30 DAY
            GROUP BY p.CATEGORIA
            ORDER BY total_cantidad_vendida DESC
            LIMIT 10
        """
        cursor.execute(query)
        categorias = cursor.fetchall()

        cursor.close()
        conn.close()

        return jsonify({'categorias': categorias})

    except mysql.connector.Error as err:
        print("ERROR MYSQL:", err)
        return jsonify({'error': str(err)}), 500
    

@app.route('/api/reportes/detalles', methods=['GET'])
def obtener_reporte_completo():
    tipo = request.args.get('tipo')
    fecha = request.args.get('fecha')

    if not tipo or not fecha:
        return jsonify({'error': 'Parámetros requeridos: tipo y fecha'}), 400

    # Validar fechas según tipo
    if tipo == 'diario':
        fecha_valida = validar_fecha_diario(fecha)
        if not fecha_valida:
            return jsonify({'error': 'Fecha inválida (YYYY-MM-DD requerida)'}), 400
        filtro_fecha = "DATE(v.FECHA_VENTA) = %s"
        filtro_fecha_compra = "DATE(c.FECHA_COMPRA) = %s"
        params = (fecha_valida,)
    
    elif tipo == 'semanal':
        anio, semana = parse_fecha_semana(fecha)
        if not anio or not semana:
            return jsonify({'error': 'Fecha inválida para semanal (YYYY-Www)'}), 400
        filtro_fecha = "YEAR(v.FECHA_VENTA) = %s AND WEEK(v.FECHA_VENTA, 1) = %s"
        filtro_fecha_compra = "YEAR(c.FECHA_COMPRA) = %s AND WEEK(c.FECHA_COMPRA, 1) = %s"
        params = (anio, semana)
    
    elif tipo == 'mensual':
        anio, mes = validar_fecha_mensual(fecha)
        if not anio or not mes:
            return jsonify({'error': 'Fecha inválida para mensual (YYYY-MM)'}), 400
        filtro_fecha = "YEAR(v.FECHA_VENTA) = %s AND MONTH(v.FECHA_VENTA) = %s"
        filtro_fecha_compra = "YEAR(c.FECHA_COMPRA) = %s AND MONTH(c.FECHA_COMPRA) = %s"
        params = (anio, mes)
    
    else:
        return jsonify({'error': 'Tipo inválido. Use diario, semanal o mensual'}), 400

    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)

        # Detalle de ventas
        query_ventas = f"""
            SELECT 
                v.FECHA_VENTA,
                p.NOMBRE AS producto,
                p.CATEGORIA,
                dv.CANTIDAD_VENTA,
                p.PRECIO,
                dv.SUBTOTAL_VENTA
            FROM venta v
            JOIN detalle_venta dv ON v.ID_VENTA = dv.ID_VENTA
            JOIN producto p ON dv.ID_PRODUCTO = p.ID_PRODUCTO
            WHERE {filtro_fecha} AND v.ESTADO = 'FINALIZADA'
        """
        cursor.execute(query_ventas, params)
        ventas = cursor.fetchall()
        total_ventas = sum(v['SUBTOTAL_VENTA'] for v in ventas)

        # Detalle de compras
        query_compras = f"""
            SELECT 
                c.FECHA_COMPRA,
                pr.NOMBRE AS proveedor,
                p.NOMBRE AS producto,
                dc.CANTIDAD_COMPRA,
                dc.SUBTOTAL_COMPRA
            FROM compra c
            JOIN detalle_compra dc ON c.ID_COMPRA = dc.ID_COMPRA
            JOIN producto p ON dc.ID_PRODUCTO = p.ID_PRODUCTO
            JOIN proveedor pr ON c.ID_PROVEEDOR = pr.ID_PROVEEDOR
            WHERE {filtro_fecha_compra}
        """
        cursor.execute(query_compras, params)
        compras = cursor.fetchall()
        total_compras = sum(c['SUBTOTAL_COMPRA'] for c in compras)

        cursor.close()
        conn.close()

        return jsonify({
            'ventas': ventas,
            'totalVentas': total_ventas,
            'compras': compras,
            'totalCompras': total_compras
        })

    except mysql.connector.Error as err:
        return jsonify({'error': str(err)}), 500


# ESTO ENDPOINT  PERTENECE A LA CARGA DE empleadoS DE VENTAS__________________________________________________________________________________________
@app.route('/api/empleados', methods=['GET'])
def obtener_empleados():
    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT ID_EMPLEADO, NOMBRE, APELLIDOS FROM empleado")
        empleados = cursor.fetchall()
        cursor.close()
        conn.close()

        return jsonify(empleados)
    except mysql.connector.Error as err:
        return jsonify({'error': str(err)}), 500

# ESTOS ENPOINTS PERTENECEN A LA VENTANA DE CONFIGURACION.HTML _____________________________________
# Endpoint para mostrar todos los empleados
@app.route('/empleados', methods=['GET'])
def mostrar_empleados():
    conn = mysql.connector.connect(**db_config)
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT ID_EMPLEADO, NOMBRE, APELLIDOS, EMAIL, PUESTO FROM empleado")
    empleados = cursor.fetchall()
    cursor.close()
    conn.close()
    return jsonify(empleados)

# Endpoint para agregar un nuevo empleado
@app.route('/empleados', methods=['POST'])
def agregar_empleado():
    data = request.json
    nombre = data.get('nombre')
    apellidos = data.get('apellidos')
    email = data.get('email')
    contraseña = data.get('password')
    puesto = data.get('puesto')

    if not (nombre and apellidos and email and contraseña and puesto):
        return jsonify({'error': 'Faltan datos obligatorios'}), 400

    conn = mysql.connector.connect(**db_config)
    cursor = conn.cursor()

    # Insertar nuevo empleado
    sql = "INSERT INTO empleado (NOMBRE, APELLIDOS, EMAIL, CONTRASEÑA, PUESTO, ID_EMPLEADO) VALUES (%s, %s, %s, %s, %s, NULL)"
    try:
        cursor.execute(sql, (nombre, apellidos, email, contraseña, puesto))
        conn.commit()
    except mysql.connector.Error as err:
        cursor.close()
        conn.close()
        return jsonify({'error': str(err)}), 500

    cursor.close()
    conn.close()

    return jsonify({'message': 'empleado agregado exitosamente'}), 201

@app.route('/empleados/<int:id>', methods=['PUT'])
def actualizar_empleado(id):
    data = request.json
    conn = mysql.connector.connect(**db_config)
    cursor = conn.cursor()
    try:
        if data.get('password'):
            sql = """UPDATE empleado SET NOMBRE=%s, APELLIDOS=%s, EMAIL=%s, CONTRASEÑA=%s, PUESTO=%s WHERE ID_EMPLEADO=%s"""
            cursor.execute(sql, (data['nombre'], data['apellidos'], data['email'], data['password'], data['puesto'], id))
        else:
            sql = """UPDATE empleado SET NOMBRE=%s, APELLIDOS=%s, EMAIL=%s, PUESTO=%s WHERE ID_EMPLEADO=%s"""
            cursor.execute(sql, (data['nombre'], data['apellidos'], data['email'], data['puesto'], id))
        conn.commit()
        return jsonify({"message": "empleado actualizado exitosamente"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
        conn.close()

@app.route('/empleados/<int:id>', methods=['DELETE'])
def eliminar_empleado(id):
    conn = mysql.connector.connect(**db_config)
    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM empleado WHERE ID_EMPLEADO = %s", (id,))
        conn.commit()
        return jsonify({"message": "empleado eliminado exitosamente"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
        conn.close()

# Ruta de prueba
@app.route('/api/test')
def test_conexion():
    try:
        conn = mysql.connector.connect(**db_config)
        if conn.is_connected():
            return jsonify({"mensaje": "Conexión exitosa a MySQL en puerto 3307"})
        else:
            return jsonify({"error": "No se pudo conectar"})
    except mysql.connector.Error as err:
        return jsonify({'error': str(err)})

# Ejecutar servidor
if __name__ == '__main__':
    app.run(debug=True)