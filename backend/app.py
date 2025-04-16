from flask import Flask, jsonify, request
import mysql.connector
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

db_config = {
    'host': 'localhost',
    'port': 3307,
    'user': 'root',
    'password': '',
    'database': 'sweetfit'
}

# Ruta para obtener todos los productos
@app.route('/api/productos', methods=['GET'])
def obtener_productos():
    try:
        page = request.args.get('page', request.args.get('pagina', 1, type=int), type=int)
        limit = request.args.get('limit', default=6, type=int)

        offset = (page - 1) * limit

        categoria = request.args.get('categoria')

        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)

        if categoria:
            cursor.execute("SELECT COUNT(*) FROM producto WHERE categoria = %s", (categoria,))
        else:
            cursor.execute("SELECT COUNT(*) FROM producto")
        total_productos = cursor.fetchone()['COUNT(*)']

        if categoria:
            cursor.execute("SELECT * FROM producto WHERE categoria = %s LIMIT %s OFFSET %s", (categoria, limit, offset))
        else:
            cursor.execute("SELECT * FROM producto LIMIT %s OFFSET %s", (limit, offset))

        productos_crudos = cursor.fetchall()
        cursor.close()
        conn.close()

        productos = []
        for p in productos_crudos:
            productos.append({
                'id': p['ID_PRODUCTO'],
                'nombre': p['NOMBRE'],
                'descripcion': p['DESCRIPCION'],
                'categoria': p['CATEGORIA'],
                'cantidad': p['CANTIDAD'],
                'precio': float(p['PRECIO']),
                'imagen': p['IMAGEN']
            })

        total_paginas = (total_productos // limit) + (1 if total_productos % limit != 0 else 0)

        return jsonify({
            'productos': productos,
            'total_productos': total_productos,
            'total_paginas': total_paginas,
            'pagina_actual': page
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

# Ruta para agregar un nuevo producto
@app.route('/api/productos', methods=['POST'])
def agregar_producto():
    try:
        data = request.json
        nombre = data.get('nombre')
        descripcion = data.get('descripcion')
        categoria = data.get('categoria')
        cantidad = data.get('cantidad')
        precio = data.get('precio')
        imagen = data.get('imagen')

        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor()
        query = """INSERT INTO producto 
                   (nombre, descripcion, categoria, cantidad, precio, imagen)
                   VALUES (%s, %s, %s, %s, %s, %s)"""
        cursor.execute(query, (nombre, descripcion, categoria, cantidad, precio, imagen))
        conn.commit()
        cursor.close()
        conn.close()

        return jsonify({'success': True, 'mensaje': 'Producto agregado exitosamente'})
    except mysql.connector.Error as err:
        return jsonify({'error': str(err)}), 500

# Ruta para eliminar un producto
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

# Ruta para editar un producto existente
@app.route('/api/editar_producto/<int:id_producto>', methods=['PUT'])
def editar_producto(id_producto):
    try:
        data = request.json
        nombre = data.get('nombre')
        descripcion = data.get('descripcion')
        categoria = data.get('categoria')
        cantidad = data.get('cantidad')
        precio = data.get('precio')
        imagen = data.get('imagen')

        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor()
        query = """UPDATE producto 
                   SET nombre = %s, descripcion = %s, categoria = %s, cantidad = %s, precio = %s, imagen = %s
                   WHERE ID_PRODUCTO = %s"""
        cursor.execute(query, (nombre, descripcion, categoria, cantidad, precio, imagen, id_producto))
        conn.commit()
        cursor.close()
        conn.close()

        return jsonify({'success': True, 'mensaje': 'Producto actualizado exitosamente'})
    except mysql.connector.Error as err:
        return jsonify({'success': False, 'error': str(err)}), 500

# Ruta para obtener un producto por ID
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

# Ruta de prueba de conexión
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

# Ejecutar el servidor sino no te va a jalar
if __name__ == '__main__':
    app.run(debug=True)

#### quiero ver algo
