from flask import Flask, jsonify, request, send_from_directory
import mysql.connector
from flask_cors import CORS
import os
from werkzeug.utils import secure_filename

app = Flask(__name__)
CORS(app)

# Carpeta para guardar imágenes subidas
UPLOAD_FOLDER = 'uploads'
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

db_config = {
    'host': 'localhost',
    'port': 3307,
    'user': 'root',
    'password': 'cookie01122004$',
    'database': 'sweetfit'
}

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
        cursor.execute("DELETE FROM producto WHERE ID_PRODUCTO = %s", (id_producto,))
        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({'success': True, 'mensaje': 'Producto eliminado correctamente'})
    except mysql.connector.Error as err:
        return jsonify({'success': False, 'error': str(err)}), 500

# Editar producto (actualizar imagen)
@app.route('/api/editar_producto/<int:id_producto>', methods=['PUT'])
def editar_producto(id_producto):
    try:
        nombre = request.form.get('nombre')
        descripcion = request.form.get('descripcion')
        categoria = request.form.get('categoria')
        cantidad = request.form.get('cantidad')
        precio = request.form.get('precio')

        imagen = None
        if 'imagen' in request.files:
            imagen_file = request.files['imagen']
            if imagen_file.filename:
                filename = secure_filename(imagen_file.filename)
                ruta_imagen = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                imagen_file.save(ruta_imagen)
                imagen = filename

        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor()
        if imagen:
            query = """UPDATE producto 
                       SET nombre = %s, descripcion = %s, categoria = %s, cantidad = %s, precio = %s, imagen = %s 
                       WHERE ID_PRODUCTO = %s"""
            cursor.execute(query, (nombre, descripcion, categoria, cantidad, precio, imagen, id_producto))
        else:
            query = """UPDATE producto 
                       SET nombre = %s, descripcion = %s, categoria = %s, cantidad = %s, precio = %s 
                       WHERE ID_PRODUCTO = %s"""
            cursor.execute(query, (nombre, descripcion, categoria, cantidad, precio, id_producto))

        conn.commit()
        cursor.close()
        conn.close()

        return jsonify({'success': True, 'mensaje': 'Producto actualizado exitosamente'})
    except mysql.connector.Error as err:
        return jsonify({'success': False, 'error': str(err)}), 500

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
                'id': p['ID_PRODUCTO'],
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
                CONCAT(e.NOMBRE, ' ', e.APELLIDOS) AS EMPLEADO,
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
            SELECT v.ID_VENTA, v.FECHA_VENTA, v.TOTAL_VENTA, v.TIPO_VENTA,
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
        FROM VENTA V
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

            cursor.execute("SELECT PRECIO FROM producto WHERE ID_PRODUCTO = %s", (id_producto,))
            precio = cursor.fetchone()[0]
            subtotal = float(precio) * cantidad
            total += subtotal

            cursor.execute("""
                INSERT INTO detalle_compra (ID_COMPRA, ID_PRODUCTO, CANTIDAD_COMPRA, SUBTOTAL_COMPRA)
                VALUES (%s, %s, %s, %s)
            """, (id_compra, id_producto, cantidad, subtotal))

            # Actualizar inventario
            cursor.execute("""
                UPDATE producto SET CANTIDAD = CANTIDAD + %s WHERE ID_PRODUCTO = %s
            """, (cantidad, id_producto))

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
# __________________________________________________________________________________________________________________________________

# ESTO ENDPOINT  PERTENECE A LA CARGA DE EMPLEADOS DE VENTAS__________________________________________________________________________________________
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
