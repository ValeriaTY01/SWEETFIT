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

        # Guardar imagen
        filename = secure_filename(imagen_file.filename)
        ruta_imagen = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        imagen_file.save(ruta_imagen)

        # Guardar en la base de datos (guardamos solo el nombre de la imagen)
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

# Editar producto (opcionalmente actualizar imagen)
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
