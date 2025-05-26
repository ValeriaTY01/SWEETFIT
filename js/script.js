// ANIMACIÓN DE LA BARRA LATERAL
document.getElementById('toggleSidebar').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('collapsed');
});

// ESTA LOGICA ES PARA LA CARGA DE VENTANAS (productos.html, cliente.html, etc.)_____________________________________
document.addEventListener("DOMContentLoaded", () => {
  
  const usuarioData = JSON.parse(localStorage.getItem("usuario"));
  const usuario = usuarioData.usuario;
  if (!usuario) {
    window.location.href = "login.html";
    return;
  }

  if (window.location.pathname.includes("login.html")) {
    initLogin();
    return; 
  }

  const userLabel = document.getElementById("userLabel");
  if (userLabel && usuario && usuario.puesto) {
    userLabel.textContent = usuario.puesto;
  }

  const contentArea = document.getElementById("content-area");
  const links = document.querySelectorAll(".menu a");
  const title = document.getElementById("titulo-vista");
  const userButton = document.getElementById("userButton");
  const dropdownMenu = document.getElementById("dropdownMenu");
  const logoutButton = document.getElementById("logoutButton");


  if (userButton && dropdownMenu) {
    userButton.addEventListener("click", () => {
      dropdownMenu.style.display = dropdownMenu.style.display === "block" ? "none" : "block";
    });

  window.addEventListener("click", function (e) {
    if (!userButton.contains(e.target) && !dropdownMenu.contains(e.target)) {
      dropdownMenu.style.display = "none";
    }
  });
}

  if (logoutButton) {
    logoutButton.addEventListener("click", () => {
      localStorage.removeItem("usuario");
      window.location.href = "login.html";
    });
  }


  function loadPage(page, text) {
    const puesto = usuario.puesto;

    const permitidoCajero = ["panel.html", "ventas.html", "productos.html"];
    if (puesto === "Cajero" && !permitidoCajero.includes(page)) {
      contentArea.innerHTML = "<p>No tienes acceso a esta sección.</p>";
      return;
    }

    fetch(`views/${page}`)
      .then(res => res.text())
      .then(html => {
        contentArea.innerHTML = html;
        title.textContent = text;
  
        if (page === "productos.html") {
          initProductoModal();
          cargarCategorias();
          cargarProductos();
  
          const buscador = document.getElementById("buscador");
          if (buscador) {
            buscador.addEventListener("input", () => {
              const texto = buscador.value.trim().toLowerCase();
              cargarProductos(categoriaActual, 1, texto);
            });
          }
        }

        if (page === "ventas.html") {
          document.getElementById('formVenta').addEventListener('submit', function(event) {
            event.preventDefault();
            registrarVenta();
          });

          document.querySelectorAll("#tablaCarrito tbody input[type='number']").forEach(input => {
            input.addEventListener('input', () => {
              if (input.value === '' || parseInt(input.value) < 1) {
                input.value = 1;
                alert("La cantidad no puede ser negativa ni cero.");
              }
            });
          });

          window.addEventListener("click", function(event) {
            const modal = document.getElementById("modalSeleccionarProductos");
            const contenido = document.querySelector(".modal-productos-contenido");

            if (event.target === modal) {
              cerrarModalProductos();
            }
          });

          autocompletarEmpleado();
          cargarHistorialVentas();
          cargarSelectEmpleados(); 
          activarAutocompleteCliente();
        }
   
        if (page === "cliente.html") {
          initClienteModal();
          cargarClientes();

          const buscadorClientes = document.getElementById("buscadorClientes");
          if (buscadorClientes) {
            buscadorClientes.addEventListener("input", () => {
              const texto = buscadorClientes.value.trim().toLowerCase();
              document.querySelectorAll(".cliente-card").forEach(card => {
                const nombre = card.querySelector("h3").textContent.toLowerCase();
                card.style.display = nombre.includes(texto) ? "block" : "none";
              });
            });
          }
        }

        if (page === "proveedor.html") {
          initProveedorModal();
          cargarProveedores();
          cargarProductosProveedor();
          cargarHistorialCompras();
        
          document.querySelector(".btn-agregar-proveedor")?.addEventListener("click", abrirModalProveedor);
          document.querySelector(".btn-nueva-compra")?.addEventListener("click", abrirModalCompra);
          document.getElementById("formCompra")?.addEventListener("submit", guardarCompra);
          document.getElementById("filtroFecha")?.addEventListener("change", cargarHistorialCompras);
          document.getElementById("buscadorProveedores")?.addEventListener("input", e => {
            const texto = e.target.value.toLowerCase();
            mostrarProveedores(listaProveedores.filter(p => p.nombre.toLowerCase().includes(texto)));
          });
        } 
        
        if (page === "reportes.html") {
          inicializarReportes();
        }

        if (page === "configuracion.html") {
          cargarEmpleados();
          configurarFormularioEmpleado();
        } 
      })
      .catch(() => {
        contentArea.innerHTML = "<p>Error al cargar la página.</p>";
      });
  }
  
  links.forEach(link => {
    link.addEventListener("click", e => {
      e.preventDefault();
      const page = link.getAttribute("data-page");
      const text = link.querySelector(".text").textContent;
      loadPage(page, text);
    });
  });

  loadPage("panel.html", "Panel Principal");
});

//HASTA AQUI TERMINA LA LOGICA DE LAS VENTANAS DINAMICAS ___________________________________________________________
//ESTA LOGICA PERTENECE A LOGIN_____________________________________________________________________________________
function initLogin() {
  const form = document.getElementById("loginForm");
  if (!form) return;

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    const email = form.email.value;
    const contraseña = form.contraseña.value;

    fetch("http://localhost:5000/api/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, contraseña }),
    })
    .then(res => res.json())
    .then(data => {
      if (data.mensaje) {
        console.log("Login exitoso. Redirigiendo a index...");
        localStorage.setItem("usuario", JSON.stringify(data));
        window.location.href = "index.html";
      } else {
        alert(data.error);
      }
    })
    .catch(err => {
      console.error(err);
      alert("Error al conectar con el servidor");
    });
  });
}
// ESTA LOGICA PERTECENE A PRODUCTOS.HTML ___________________________________________________________________________
let categoriaActual = "";
let paginaActual = 1;

function initProductoModal() {
  const btnAbrir = document.querySelector(".btn-agregar-producto");
  const modal = document.getElementById("modalAgregarProducto");
  const cerrar = document.getElementById("cerrarModal");
  const form = document.getElementById("formAgregarProducto");
  const titulo = modal.querySelector("h3");
  const botonSubmit = form.querySelector("button[type='submit']");
  const preview = document.getElementById("previewImagen");
  const inputImagen = form.querySelector("input[name='imagen']");

  if (btnAbrir && modal && cerrar && form) {
    btnAbrir.addEventListener("click", () => {
      titulo.textContent = "Agregar nuevo producto";
      botonSubmit.textContent = "Guardar";
      form.reset();
      preview.src = "";
      document.getElementById("productoId").value = "";
      modal.style.display = "flex";
    });

    cerrar.addEventListener("click", () => {
      modal.style.display = "none";
    });

    window.addEventListener("click", e => {
      if (e.target === modal) {
        modal.style.display = "none";
      }
    });

    inputImagen.addEventListener("change", () => {
      const file = inputImagen.files[0];
      if (file && file.type.startsWith("image/")) {
        preview.src = URL.createObjectURL(file);
      } else {
        preview.src = "";
        inputImagen.value = "";
        alert("Selecciona una imagen válida.");
      }
    });

    form.addEventListener("submit", e => {
      e.preventDefault();

      const nombre = form.nombre.value.trim();
      const descripcion = form.descripcion.value.trim();
      const precio = parseFloat(form.precio.value);
      const cantidad = parseInt(form.cantidad.value);
      const categoria = form.categoria.value.trim();

      if (!nombre || !descripcion || !categoria || isNaN(precio) || isNaN(cantidad)) {
        alert("Por favor, completa todos los campos correctamente.");
        return;
      }

      const formData = new FormData(form);
      const id = document.getElementById("productoId").value;

      const url = id
        ? `http://localhost:5000/api/editar_producto/${id}`
        : "http://localhost:5000/api/productos";
      const method = "POST";
      if (id) {
        formData.append("_method", "PUT");
      }
      fetch(url, {
      method,
      body: formData
    })
      .then(res => res.json())
      .then(response => {
        if (response.success) {
          modal.style.display = "none";
          form.reset();
          preview.src = "";
          document.getElementById("productoId").value = "";
          cargarProductos(); 
        } else {
          alert("Error al guardar el producto.");
        }
      })
      .catch(err => {
        console.error(err);
        alert("Error en la conexión.");
      });
        });
      }
}


function cargarCategorias() {
  const contenedor = document.querySelector(".filtros-categorias");
  if (!contenedor) return;

  fetch("http://localhost:5000/api/categorias")
    .then(res => res.json())
    .then(categorias => {
      contenedor.innerHTML = `<button class="filtro activo" data-cat="">Todo</button>`;
      categorias.forEach(cat => {
        const btn = document.createElement("button");
        btn.className = "filtro";
        btn.textContent = cat.categoria;
        btn.dataset.cat = cat.categoria;
        contenedor.appendChild(btn);
      });

      const botones = contenedor.querySelectorAll(".filtro");
      botones.forEach(btn => {
        btn.addEventListener("click", () => {
          botones.forEach(b => b.classList.remove("activo"));
          btn.classList.add("activo");
          cargarProductos(btn.dataset.cat, 1);
        });
      });
    });
}

function cargarProductos(categoria = categoriaActual, pagina = paginaActual, nombreFiltro = "") {
  const grid = document.querySelector(".grid-productos");
  if (!grid) return;

  categoriaActual = categoria;
  paginaActual = pagina;

  let url = `http://localhost:5000/api/productos?page=${pagina}`;
  if (categoria) {
    url += `&categoria=${encodeURIComponent(categoria)}`;
  }
  if (nombreFiltro) {
    url += `&nombre=${encodeURIComponent(nombreFiltro)}`;
  }

  fetch(url)
    .then(res => res.json())
    .then(data => {
      console.log(data);
      const productos = data.productos || data;
      const totalPaginas = data.total_paginas || 1;
      const paginaActual = data.pagina_actual || 1;

      grid.innerHTML = "";

      if (productos.length === 0) {
        grid.innerHTML = "<p style='padding: 1rem;'>No hay productos que coincidan.</p>";
        renderPaginacion(1, 1, categoria);
        return;
      }

      productos.forEach(prod => {
        const card = document.createElement("div");
        card.className = "producto-card";
        card.innerHTML = `
          <img src="http://localhost:5000/uploads/${prod.imagen}" alt="${prod.nombre}" />
          <h3>${prod.nombre}</h3>
          <p class="desc">${prod.descripcion}</p>
          <p class="cantidad ${prod.cantidad <= 5 ? "stock-bajo" : ""}">
            Stock: ${prod.cantidad}
          </p>
          <div class="precio-edicion">
            <span class="precio">$${parseFloat(prod.precio).toFixed(2)}</span>
            <div class="acciones">
              <span class="editar" data-id="${prod.id}">✏️</span>
              <span class="eliminar" data-id="${prod.id}">🗑️</span>
            </div>
          </div>`;
        grid.appendChild(card);
      });

      document.querySelectorAll(".eliminar").forEach(btn => {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          const id_producto = btn.dataset.id;
          if (confirm("¿Estás seguro de eliminar este producto?")) {
            fetch(`http://localhost:5000/api/eliminar_producto/${id_producto}`, { method: "DELETE" })
              .then(res => res.json())
              .then(response => {
                if (response.success) {
                  cargarProductos(categoriaActual, paginaActual, document.getElementById("buscador").value);
                alert('Producto eliminado correctamente');
                } else {
                  alert("Error al eliminar producto");
                }
              });
          }
        });
      });

      document.querySelectorAll(".editar").forEach(btn => {
        btn.addEventListener("click", () => {
          const id_producto = btn.dataset.id;
          editarProducto(id_producto);
        });
      });

      renderPaginacion(totalPaginas, paginaActual, categoria, nombreFiltro);
    })
    .catch(() => {
      grid.innerHTML = "<p>Error al cargar productos.</p>";
    });
}

function filtrarProductosPorNombre(filtro) {
  const cards = document.querySelectorAll(".producto-card");
  cards.forEach(card => {
    const nombre = card.querySelector("h3").textContent.toLowerCase();
    card.style.display = nombre.includes(filtro) ? "flex" : "none";
  });
}

function editarProducto(id_producto) {
  fetch(`http://localhost:5000/api/editar_producto/${id_producto}`)
    .then(res => res.json())
    .then(prod => {
      const modal = document.getElementById("modalAgregarProducto");
      const form = document.getElementById("formAgregarProducto");
      const preview = document.getElementById("previewImagen");
      const titulo = modal.querySelector("h3");
      const botonSubmit = form.querySelector("button[type='submit']");

      if (!prod || !form) return;

      titulo.textContent = "Editar producto";
      botonSubmit.textContent = "Guardar cambios";

      form.nombre.value = prod.nombre || '';
      form.descripcion.value = prod.descripcion || '';
      form.precio.value = prod.precio || '';
      form.cantidad.value = prod.cantidad || '';
      form.categoria.value = prod.categoria || '';
      document.getElementById("productoId").value = prod.ID_PRODUCTO || id_producto;
      console.log(prod);
      if (prod.imagen) {
        preview.src = `http://localhost:5000/uploads/${prod.imagen}`;
        preview.style.display = 'block';
      } else {
        preview.style.display = 'none';
      }

      modal.style.display = "flex";
    })
    .catch(err => {
      console.error("Error al cargar producto:", err);
      alert("Error al cargar producto para edición.");
    });
}
function renderPaginacion(totalPaginas, paginaActual = 1, categoria = "", nombreFiltro = "") {
  const contenedor = document.getElementById("paginacionProductos");
  if (!contenedor) return;

  contenedor.innerHTML = "";

  for (let i = 1; i <= totalPaginas; i++) {
    const btn = document.createElement("button");
    btn.textContent = i;
    btn.classList.toggle("activo", i === paginaActual);
    btn.addEventListener("click", () => {
      cargarProductos(categoria, i, nombreFiltro);
    });
    contenedor.appendChild(btn);
  }
}
//HASTA AQUI TERMINA LA LOGICA PRODUCTOS.HTML ____________________________________________________________________
function abrirModalProductos(pagina = 1) {
  const modal = document.getElementById("modalSeleccionarProductos");
  const grid = document.getElementById("gridModalProductos");
  const buscador = document.getElementById("buscador-modal");

  modal.style.display = "flex";
  grid.innerHTML = "<p>Cargando productos...</p>";

  const filtroNombre = buscador.value.trim();
  fetch(`http://localhost:5000/api/productos?page=${pagina}&nombre=${encodeURIComponent(filtroNombre)}`)
    .then(res => res.json())
    .then(data => {
      const productos = data.productos || [];
      paginaModalActual = data.pagina_actual;
      totalPaginasModal = data.total_paginas;

      grid.innerHTML = "";

      if (productos.length === 0) {
        grid.innerHTML = "<p>No se encontraron productos.</p>";
        renderPaginacionModal();
        return;
      }

      productos.forEach(prod => {
        const card = document.createElement("div");
        card.className = "producto-card";

        if (prod.cantidad > 0) {
          card.innerHTML = `
            <img src="http://localhost:5000/uploads/${prod.imagen}" alt="${prod.nombre}">
            <h3>${prod.nombre}</h3>
            <p>Precio: $${parseFloat(prod.precio).toFixed(2)}</p>
            <p class="stock-producto">Stock: ${prod.cantidad}</p>
            <input type="number" min="1" max="${prod.cantidad}" value="1" id="cantidad-${prod.id}" />
            <button class="boton-agregar" onclick="agregarProductoAlCarrito(${prod.id}, '${prod.nombre}', ${prod.precio})">Agregar</button>
          `;
        } else {
          card.innerHTML = `
            <img src="http://localhost:5000/uploads/${prod.imagen}" alt="${prod.nombre}">
            <h3>${prod.nombre}</h3>
            <p>Precio: $${parseFloat(prod.precio).toFixed(2)}</p>
            <p class="sin-stock">Sin stock</p>
            <button class="boton-deshabilitado" disabled>Agregar</button>
          `;
        }

        grid.appendChild(card);
      });

      // Validar inputs (números negativos o vacíos)
      document.querySelectorAll("#gridModalProductos input[type='number']").forEach(input => {
        input.addEventListener("input", () => {
          if (input.value === "" || parseInt(input.value) < 1) {
            input.value = 1;
            alert("La cantidad no puede ser negativa ni cero.");
          }
        });
      });

      renderPaginacionModal();
    })
    .catch(err => {
      grid.innerHTML = "<p>Error al cargar productos.</p>";
      console.error("Error al cargar productos:", err);
    });

  buscador.oninput = () => abrirModalProductos(1);
}

function cerrarModalProductos() {
  document.getElementById("modalSeleccionarProductos").style.display = "none";
}

function agregarProductoAlCarrito(id, nombre, precio) {
  const cantidadInput = document.getElementById(`cantidad-${id}`);
  const cantidad = parseInt(cantidadInput.value);
  const tabla = document.querySelector("#tablaCarrito tbody");

  const card = cantidadInput.closest(".producto-card");
  const stockElemento = card.querySelector(".stock-producto");
  const botonAgregar = card.querySelector("button");

  let stockDisponible = parseInt(cantidadInput.max);

  if (stockDisponible <= 0) {
    alert("No hay stock disponible para este producto.");
    return;
  }
  if (cantidad < 1) {
    alert("La cantidad debe ser al menos 1.");
    return;
  }
  if (cantidad > stockDisponible) {
    alert(`La cantidad excede el stock disponible (${stockDisponible}).`);
    return;
  }

  const yaExiste = Array.from(tabla.children).some(row => row.dataset.id == id);
  if (yaExiste) {
    alert("Este producto ya fue agregado.");
    return;
  }

  const subtotal = (cantidad * precio).toFixed(2);
  const row = document.createElement("tr");
  row.dataset.id = id;
  row.innerHTML = `
    <td>${nombre}</td>
    <td><input type="number" value="${cantidad}" min="1" max="${stockDisponible}" onchange="actualizarSubtotal(this, ${precio})" /></td>
    <td>$${precio.toFixed(2)}</td>
    <td class="subtotal">$${subtotal}</td>
    <td><button onclick="eliminarProductoDelCarrito(this)">🗑️</button></td>
  `;
  tabla.appendChild(row);

  actualizarTotalVenta();

  stockDisponible -= cantidad;
  cantidadInput.max = stockDisponible;

  if (stockDisponible === 0) {
    cantidadInput.value = 0;
    cantidadInput.disabled = true;
    botonAgregar.disabled = true;
    botonAgregar.textContent = "Sin stock";
    botonAgregar.classList.add("boton-deshabilitado");
    stockElemento.textContent = "Sin stock";
  } else {
    stockElemento.textContent = `Stock: ${stockDisponible}`;
    cantidadInput.value = 1;
    cantidadInput.disabled = false;
    botonAgregar.disabled = false;
    botonAgregar.textContent = "Agregar";
    botonAgregar.classList.remove("boton-deshabilitado");
  }
}

function actualizarSubtotal(input, precio) {
  const cantidad = parseInt(input.value);
  const subtotal = (cantidad * precio).toFixed(2);
  const celdaSubtotal = input.closest("tr").querySelector(".subtotal");
  celdaSubtotal.textContent = `$${subtotal}`;
  actualizarTotalVenta();
}

function eliminarProductoDelCarrito(btn) {
  btn.closest("tr").remove();
  actualizarTotalVenta();
}

function actualizarTotalVenta() {
  let total = 0;
  document.querySelectorAll("#tablaCarrito tbody tr").forEach(row => {
    const subtotal = row.querySelector(".subtotal").textContent.replace("$", "");
    total += parseFloat(subtotal);
  });
  document.getElementById("totalVenta").textContent = total.toFixed(2);
}

function renderPaginacionModal() {
  let contenedor = document.getElementById("paginacionModalProductos");
  if (!contenedor) {
    contenedor = document.createElement("div");
    contenedor.id = "paginacionModalProductos";
    contenedor.className = "paginacion";
    document.getElementById("modalSeleccionarProductos").appendChild(contenedor);
  }

  contenedor.innerHTML = "";

  for (let i = 1; i <= totalPaginasModal; i++) {
    const btn = document.createElement("button");
    btn.textContent = i;
    btn.classList.toggle("activo", i === paginaModalActual);
    btn.addEventListener("click", () => abrirModalProductos(i));
    contenedor.appendChild(btn);
  }
}

function cargarHistorialVentas() {
  fetch("http://localhost:5000/api/ventas")
    .then(res => res.json())
    .then(ventas => {
      const tabla = document.querySelector("#tablaVentas tbody");
      tabla.innerHTML = "";

      if (!ventas || ventas.length === 0) {
        tabla.innerHTML = "<tr><td colspan='6'>No hay ventas registradas.</td></tr>";
        return;
      }

      ventas.forEach(venta => {
        const row = document.createElement("tr");
        row.innerHTML = `
          <td>${venta.ID_VENTA}</td>
          <td>${new Date(venta.FECHA_VENTA).toLocaleString()}</td>
          <td>${venta.TIPO_VENTA}</td>
          <td>${venta.EMPLEADO}</td>
          <td>$${parseFloat(venta.TOTAL_VENTA).toFixed(2)}</td>
          <td><button class="btn-ticket" onclick="mostrarTicketVenta(${venta.ID_VENTA})">📄 Ticket</button></td>
        `;
        tabla.appendChild(row);
      });
    })
    .catch(err => {
      console.error("Error al cargar historial:", err);
    });
}

function cerrarModalDetalleVenta() {
  document.getElementById("modalDetalleVenta").style.display = "none";
}

function mostrarTicketVenta(id_venta) {
  fetch(`http://localhost:5000/api/ventas/${id_venta}?t=${Date.now()}`)
    .then(res => res.json())
    .then(data => {
      if (!data || !data.detallesV) throw new Error("Datos de venta inválidos o no encontrados.");

      const { detallesV, cliente = 'Cliente desconocido', orden, empleado, fecha } = data;
      const fechaFormateada = new Date(fecha).toLocaleDateString('es-ES', {
        year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });

      let total = detallesV.reduce((sum, item) => sum + parseFloat(item.SUBTOTAL_VENTA), 0);
      let html = `
        <div class="ticket-header">
          <img src="img/logosweet.png" class="only-print" alt="Logo">
          <h2>SWEETFIT-VENTA</h2>
        </div>
        <p class="ticket-date">${fechaFormateada}</p>
        <div class="customer-info">
          <p><strong>Orden de Venta:</strong> ${orden}</p>
          <p><strong>Cliente:</strong> ${cliente}</p>
          <p><strong>Empleada:</strong> ${empleado}</p>
        </div>
        <div class="ticket-divider"></div>
        <div class="ticket-items">
          <table class="ticket-table">
            <thead>
              <tr>
                <th class="col-qty">Cant.</th>
                <th class="col-prod">Producto</th>
                <th class="col-price">Precio Unit.</th>
                <th class="col-subtotal">Subtotal</th>
              </tr>
            </thead>
            <tbody>
      `;

      if (detallesV.length === 0) {
        html += `<tr><td colspan="4" class="no-items">No hay productos registrados en esta venta.</td></tr>`;
      } else {
        detallesV.forEach(prod => {
          html += `
            <tr>
              <td class="col-qty">${prod.CANTIDAD_VENTA}</td>
              <td class="col-prod">${prod.PRODUCTO}</td>
              <td class="col-price">$${parseFloat(prod.PRECIO_UNITARIO).toFixed(2)}</td>
              <td class="col-subtotal">$${parseFloat(prod.SUBTOTAL_VENTA).toFixed(2)}</td>
            </tr>
          `;
        });
      }

      html += `
            </tbody>
          </table>
        </div>
        <div class="ticket-divider"></div>
        <div class="ticket-summary">
          <div class="summary-row total">
            <span class="summary-label">TOTAL:</span>
            <span class="summary-value">$${total.toFixed(2)}</span>
          </div>
          <div class="no-print" style="text-align: right; margin-top: 10px;">
            <button id="btnImprimirTicket" class="btn-imprimir">Imprimir Ticket</button>
          </div>
        </div>
      `;

      const modal = document.getElementById("modalDetalleVenta");
      const contenido = document.getElementById("detalleVentaContenido");
      contenido.innerHTML = html;
      modal.style.display = "block";

      setTimeout(() => {
        const boton = document.getElementById("btnImprimirTicket");
        boton?.addEventListener("click", () => imprimirTicket("detalleVentaContenido"));
      }, 0);
    })
    .catch(error => {
      console.error("Error al cargar los detalles de la compra:", error);
      const modal = document.getElementById("modalDetalleVenta");
      const contenido = document.getElementById("detalleVentaContenido");
      contenido.innerHTML = `<p class="error-message">Error al cargar los detalles de la compra. Por favor, intente nuevamente.</p>`;
      modal.style.display = "block";
    });
}

function filtrarVentas() {
  const fechaInicio = document.getElementById("filtroFechaInicio")?.value || '';
  const fechaFin = document.getElementById("filtroFechaFin")?.value || '';
  const tipoVenta = document.getElementById("filtroTipo")?.value || '';
  const empleadoSelect = document.getElementById("selectEmpleadoVenta");
  const idEmpleado = empleadoSelect ? empleadoSelect.value : '';

  let url = `http://localhost:5000/api/ventas/historial?`;

  if (fechaInicio && fechaFin) {
    url += `fecha_inicio=${fechaInicio}&fecha_fin=${fechaFin}&`;
  }

  if (tipoVenta) {
    url += `tipo_venta=${tipoVenta}&`;
  }

  if (idEmpleado) {
    url += `empleado=${idEmpleado}&`;
  }

  fetch(url)
    .then(res => res.json())
    .then(ventas => {
      const tabla = document.querySelector("#tablaVentas tbody");
      tabla.innerHTML = "";

      if (!ventas || ventas.length === 0) {
        tabla.innerHTML = "<tr><td colspan='6'>No se encontraron ventas.</td></tr>";
        return;
      }

      ventas.forEach(venta => {
        const row = document.createElement("tr");
        row.innerHTML = `
          <td>${venta.ID_VENTA}</td>
          <td>${new Date(venta.FECHA_VENTA).toLocaleString()}</td>
          <td>${venta.TIPO_VENTA}</td>
          <td>${venta.nombre_empleado || '—'}</td>
          <td>$${parseFloat(venta.TOTAL_VENTA).toFixed(2)}</td>
          <td><button class="btn-ticket" onclick="mostrarTicketVenta(${venta.ID_VENTA})">📄 Ticket</button></td>
        `;
        tabla.appendChild(row);
      });
    })
    .catch(err => {
      console.error("Error al filtrar ventas:", err);
    });
}

function cargarSelectEmpleados() {
  const selects = document.querySelectorAll("#selectEmpleado, #selectEmpleadoVenta");
  if (!selects.length) return;

  fetch("http://localhost:5000/api/empleados")
    .then(res => res.json())
    .then(empleados => {
      selects.forEach(select => {
        select.innerHTML = "<option value=''>Seleccionar Empleado</option>";
        empleados.forEach(emp => {
          const option = document.createElement("option");
          option.value = emp.ID_EMPLEADO;
          option.textContent = `${emp.NOMBRE} ${emp.APELLIDOS}`;
          select.appendChild(option);
        });
      });
    })
    .catch(err => {
      console.error("Error al cargar empleados:", err);
    });
}

function obtenerCarrito() {
  const filas = document.querySelectorAll("#tablaCarrito tbody tr");
  const carrito = [];

  for (const fila of filas) {
    const cantidadInput = fila.querySelector("input[type='number']");
    let cantidad = parseInt(cantidadInput.value);

    if (isNaN(cantidad) || cantidad < 1) {
      alert("La cantidad de productos no puede ser negativa ni cero.");
      cantidadInput.focus();
      return null; // Abortamos por error
    }

    const id = parseInt(fila.dataset.id);
    const nombre = fila.cells[0].textContent;
    const precio = parseFloat(fila.cells[2].textContent.replace("$", ""));
    const subtotal = parseFloat(fila.cells[3].textContent.replace("$", ""));

    carrito.push({
      id,
      nombre,
      cantidad,
      precio,
      subtotal
    });
  }

  return carrito;
}

function registrarVenta() {
  const carrito = obtenerCarrito();
  if (!carrito) return; // Si hay error de cantidades, no sigue

  const tipoVenta = document.getElementById("tipoVenta").value;
  const empleado = document.getElementById("empleado").value;

  const cliente = {
    nombre: document.getElementById("nombreCliente").value,
    apellido_paterno: document.getElementById("apellidoPaterno").value,
    apellido_materno: document.getElementById("apellidoMaterno").value,
    direccion: document.getElementById("direccionCliente").value,
    telefono: document.getElementById("telefonoCliente").value
  };

  if (carrito.length === 0) {
    alert("No hay productos en el carrito");
    return;
  }

  fetch("http://localhost:5000/api/ventas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tipo_venta: tipoVenta,
      empleado: empleado,
      cliente: cliente,
      carrito: carrito
    })
  })
    .then(res => res.json())
    .then(data => {
      alert(data.mensaje || "Venta registrada correctamente");
      limpiarFormularioVenta();
      cargarHistorialVentas(); 
    })
    .catch(err => {
      console.error("Error al registrar venta:", err);
      alert("Error al registrar la venta");
    });
}

function activarAutocompleteCliente() {
  const inputNombre = document.getElementById('nombreCliente');
  const listaSugerencias = document.createElement('ul');
  listaSugerencias.style.position = 'absolute';
  listaSugerencias.style.backgroundColor = '#fff';
  listaSugerencias.style.listStyle = 'none';
  listaSugerencias.style.padding = '0';
  listaSugerencias.style.margin = '0';
  listaSugerencias.style.maxHeight = '150px';
  listaSugerencias.style.overflowY = 'auto';
  listaSugerencias.style.width = inputNombre.offsetWidth + 'px';
  listaSugerencias.style.zIndex = '1000';
  inputNombre.parentNode.appendChild(listaSugerencias);

  inputNombre.addEventListener('input', () => {
    const valor = inputNombre.value.trim();
    if (valor.length < 2) {
      listaSugerencias.innerHTML = '';
      return;
    }

    fetch(`http://localhost:5000/api/cliente?nombre=${encodeURIComponent(valor)}`)
      .then(res => res.json())
      .then(clientes => {
        listaSugerencias.innerHTML = '';
        clientes.forEach(cliente => {
          const li = document.createElement('li');
          li.style.padding = '5px';
          li.style.cursor = 'pointer';
          li.textContent = `${cliente.NOMBRE} ${cliente.APELLIDO_PATERNO} ${cliente.APELLIDO_MATERNO}`;
          li.addEventListener('click', () => {
            // Autocompletar campos
            inputNombre.value = cliente.NOMBRE;
            document.getElementById('apellidoPaterno').value = cliente.APELLIDO_PATERNO;
            document.getElementById('apellidoMaterno').value = cliente.APELLIDO_MATERNO;
            document.getElementById('direccionCliente').value = cliente.DIRECCION;
            document.getElementById('telefonoCliente').value = cliente.TELEFONO;
            listaSugerencias.innerHTML = '';
          });
          listaSugerencias.appendChild(li);
        });
      })
      .catch(err => {
        console.error('Error buscando clientes:', err);
        listaSugerencias.innerHTML = '';
      });
  });

  // Ocultar la lista si se hace clic fuera
  document.addEventListener('click', e => {
    if (!inputNombre.contains(e.target) && !listaSugerencias.contains(e.target)) {
      listaSugerencias.innerHTML = '';
    }
  });
}

function limpiarFormularioVenta() {
  document.getElementById("formVenta").reset();
  document.querySelector("#tablaCarrito tbody").innerHTML = "";
  document.getElementById("totalVenta").textContent = "0.00";
}

function autocompletarEmpleado() {
  const usuarioJSON = localStorage.getItem("usuario");
  if (!usuarioJSON) return;

  try {
    const data = JSON.parse(usuarioJSON);

    if (data.usuario && data.usuario.nombre && data.usuario.apellidos) {
      const empleadoInput = document.getElementById("empleado");
      if (empleadoInput) {
        empleadoInput.value = `${data.usuario.nombre} ${data.usuario.apellidos}`;
        empleadoInput.readOnly = true;
      }
    }
  } catch (error) {
    console.error("Error al parsear el usuario guardado en localStorage:", error);
  }
} 
//HASTA AQUI TERMINA LA LOGICA VENTAS.HTML ____________________________________________________________________

// ESTA LOGICA PERTECENE A CLIENTE.HTML ___________________________________________________________________________
function cargarClientes() {
  const contenedor = document.getElementById("listaClientes");
  if (!contenedor) return;

    fetch("http://localhost:5000/api/clientes")
    .then(res => res.json())
    .then(clientes => {
      contenedor.innerHTML = "";

      clientes.forEach(cliente => {
        const div = document.createElement("div");
        div.className = "cliente-card";
        div.innerHTML = `
          <h3>${cliente.NOMBRE} ${cliente.APELLIDO_PATERNO || ''} ${cliente.APELLIDO_MATERNO || ''}</h3>
          <p><strong>Tel:</strong> ${cliente.TELEFONO || 'N/A'}</p>
          <p><strong>Dirección:</strong> ${cliente.DIRECCION || 'N/A'}</p>
          <div class="acciones-cliente">
            <button class="btn-editar" data-id="${cliente.ID_CLIENTE}">✏️</button>
            <button class="btn-eliminar" data-id="${cliente.ID_CLIENTE}">🗑️</button>
            <button class="btn-historial" data-id="${cliente.ID_CLIENTE}">📜 Historial</button>
          </div>
        `;
        contenedor.appendChild(div);
      });

      document.querySelectorAll(".btn-editar").forEach(btn => {
        btn.addEventListener("click", () => editarCliente(btn.dataset.id));
      });

      document.querySelectorAll(".btn-eliminar").forEach(btn => {
        btn.addEventListener("click", () => eliminarCliente(btn.dataset.id));
      });

      document.querySelectorAll(".btn-historial").forEach(btn => {
        btn.addEventListener("click", () => mostrarHistorialCliente(btn.dataset.id));
      });
    })
    .catch(err => {
      console.error("Error al cargar clientes:", err);
    });
}

function initClienteModal() {
  const modal = document.getElementById("modalCliente");
  const cerrar = document.getElementById("cerrarModalCliente");
  const form = document.getElementById("formCliente");

  if (!modal || !cerrar || !form) {
    console.warn("⚠️ Elementos del modal no encontrados");
    return;
  }

  cerrar.addEventListener("click", () => {
    modal.style.display = "none";
  });

  window.addEventListener("click", e => {
    if (e.target === modal) modal.style.display = "none";
  });

  form.addEventListener("submit", e => {
    e.preventDefault();
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    fetch("http://localhost:5000/api/clientes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    })
      .then(res => res.json())
      .then(response => {
        if (response.success) {
          modal.style.display = "none";
          cargarClientes();
        } else {
          alert("Error al guardar cliente");
        }
      });
  });
}

function editarCliente(id) {
  alert("Sigan viendo" + id);
}

function eliminarCliente(id) {
  if (confirm("¿Deseas eliminar este cliente?")) {
    fetch(`http://localhost:5000/api/clientes/${id}`, { method: "DELETE" })
      .then(res => res.json())
      .then(response => {
        if (response.success) {
          cargarClientes();
        } else {
          alert("Error al eliminar");
        }
      });
  }
}

function abrirModalCliente() {
  const modal = document.getElementById("modalCliente");
  document.getElementById("formCliente").reset();
  modal.style.display = "flex";
}

function cerrarModalCliente() {
  const modal = document.getElementById("modalCliente");
  modal.style.display = "none";
}

function mostrarHistorialCliente(idCliente) {
  const panel = document.getElementById("historialPanel");
  const contenedor = document.getElementById("contenidoHistorial");

  contenedor.style.opacity = 0;

  setTimeout(() => {
    contenedor.innerHTML = '';

    fetch(`http://localhost:5000/api/clientes/${idCliente}/historial`)
      .then(res => res.json())
      .then(historial => {
        if (Array.isArray(historial)) {
          historial.forEach(venta => {
            const ventaDiv = document.createElement("div");
            ventaDiv.className = "venta-item";

            let tipoColor = "";
            let tipoIcono = "";
            switch (venta.TIPO_VENTA) {
              case "Local":
                tipoColor = "#4CAF50";
                tipoIcono = "🏪";
                break;
              case "Domicilio":
                tipoColor = "#2196F3";
                tipoIcono = "🏠";
                break;
              case "App":
                tipoColor = "#9C27B0";
                tipoIcono = "📱";
                break;
              default:
                tipoColor = "#999";
                tipoIcono = "❓";
            }

            ventaDiv.innerHTML = `
              <p><strong>Fecha:</strong> ${new Date(venta.FECHA_VENTA).toLocaleString()}</p>
              <p><strong>Total:</strong> $${parseFloat(venta.TOTAL_VENTA).toFixed(2)}</p>
              <p><strong>Tipo:</strong> <span style="color:${tipoColor}; font-weight: bold;">${tipoIcono} ${venta.TIPO_VENTA}</span></p>
              <hr>
            `;

            contenedor.appendChild(ventaDiv);
          });

          contenedor.style.opacity = 1;
        } else {
          contenedor.innerHTML = `<p>No se encontraron ventas para este cliente.</p>`;
          contenedor.style.opacity = 1;
        }

      abrirHistorialCliente();
    })
    .catch(err => {
      console.error("Error al cargar el historial:", err);
      contenedor.innerHTML = `<p>Error al cargar el historial.</p>`;
      contenedor.style.opacity = 1;
      abrirHistorialCliente();
    });
  }, 50);
}

function abrirHistorialCliente() {
  const panel = document.getElementById("historialPanel");
  panel.style.right = "0";
}

function cerrarHistorialCliente() {
  const panel = document.getElementById("historialPanel");
  panel.style.right = "-100%";
}
//HASTA AQUI TERMINA LA LOGICA CLIENTE.HTML ____________________________________________________________________

// ESTA LÓGICA PERTENECE A PROVEEDORES.HTML ____________________________________________________________________

let listaProveedores = [];
let productosDisponibles = [];
let productosCompra = [];

function initProveedorModal(){
  const modalProveedor = document.getElementById("modalProveedor");
  const cerrar = document.getElementById("cerrarModalProveedor");
  const form = document.getElementById("formProveedor");

  if (!modalProveedor || !cerrar || !form) return;

  cerrar.addEventListener("click", () => {
    modalProveedor.style.display = "none";
  });

  window.addEventListener("click", e => {
    if (e.target === modalProveedor) modalProveedor.style.display = "none";
  });
  const cancelar = document.getElementById("cancelarEdicion");
  if (cancelar) {
    cancelar.addEventListener("click", () => {
      modalProveedor.style.display = "none";
      form.reset();
    });
  }
  form.addEventListener("submit", guardarProveedor);
  const buscador = document.getElementById("buscadorProveedores");
  if (buscador) {
    buscador.addEventListener("input", function(e) {
      cargarProveedores(e.target.value);
    });
  }
}

function abrirModalProveedor() {
  const modal = document.getElementById("modalProveedor");
  const form = document.getElementById("formProveedor");
  const titulo = modal.querySelector("h3");

  titulo.textContent = "Agregar Proveedor"; // Cambiar el título
  modal.style.display = "flex";
}

function guardarProveedor(e) {
  e.preventDefault();
  const form = e.target;
  const data = Object.fromEntries(new FormData(form));
  const id =data.id_proveedor;

  const url = id 
    ? `http://localhost:5000/api/proveedores/${id}`
    : "http://localhost:5000/api/proveedores";

  const method = id ? "PUT" : "POST";

  fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  })
  .then(res => res.json())
  .then(data => {
    if (data.error) {
      alert("Error: " + data.error);
      return;
    }
    document.getElementById("modalProveedor").style.display = "none";
    form.reset(); 
    cargarProveedores();
  })
  .catch(err => {
    console.error("Error en fetch:", err);
    alert("Error al guardar proveedor.");
  });
}

function cargarProveedores(filtroNombre = '') {
  let url= ("http://localhost:5000/api/proveedores")

  if(filtroNombre){
    url +=`?nombre=${encodeURIComponent(filtroNombre)}`;
  }
  fetch(url)
    .then(res => res.json())
    .then(data => {
      listaProveedores = data;
      mostrarProveedores(data);
      cargarSelectProveedores(data);
      if (document.getElementById("proveedorSelect")){
        const selectProveedor = document.getElementById("proveedorSelect");
        // Remover los event listeners anteriores para evitar duplicados
        const nuevoSelect = selectProveedor.cloneNode(true);
        selectProveedor.parentNode.replaceChild(nuevoSelect, selectProveedor);
        nuevoSelect.addEventListener("change", cargarProductosProveedor);
      }
    });
}

function mostrarProveedores(proveedores) {
  const tbody = document.getElementById("listaProveedores");
  if (!tbody) return;
  tbody.innerHTML = "";
  proveedores.forEach(prov => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${prov.NOMBRE}</td>
      <td>${prov.EMAIL}</td>
      <td>${prov.TELEFONO}</td>
      <td class="col-acciones">
        <button class="btn-editarprov" title="Editar proveedor">✏️</button>
        <button class="btn-eliminar" title="Eliminar proveedor">🗑️</button>
      </td>
    `;
    const btnEliminar = tr.querySelector(".btn-eliminar");
    btnEliminar.addEventListener("click", () => eliminarProveedor(prov.ID_PROVEEDOR));

    const btnEditarProv = tr.querySelector(".btn-editarprov");
    btnEditarProv.addEventListener("click", () => modalEditarProveedor(prov.ID_PROVEEDOR));

    tbody.appendChild(tr);
  });
}

function eliminarProveedor(id_proveedor) {
  if (confirm("¿Estás seguro de que deseas eliminar este proveedor?")) {

    fetch(`http://localhost:5000/api/proveedores/${id_proveedor}`, {
      method: 'DELETE'

    })
    .then(response => {
      if (!response.ok) {
        throw new Error("No se pudo eliminar el proveedor.");
      }
      return response.json();
    })
    .then(data => {
      alert("Proveedor eliminado correctamente.");
      obtenerProveedores(); 
    })
    .catch(error => {
      console.error("Error al eliminar proveedor:", error);
      alert("Ocurrió un error al eliminar el proveedor.");
    });
  }
}

function modalEditarProveedor(id_proveedor){
  const modal = document.getElementById("modalProveedor");
  const form = document.getElementById("formProveedor");
  const titulo = modal.querySelector("h3");

  const prov = listaProveedores.find(p => p.ID_PROVEEDOR === id_proveedor);
  if (!prov) return alert("Proveedor no encontrado");

  form.id_proveedor.value = prov.ID_PROVEEDOR;
  form.nombre.value = prov.NOMBRE;
  form.email.value = prov.EMAIL;
  form.telefono.value = prov.TELEFONO;

  titulo.textContent = "Editar Proveedor";

  modal.style.display = "flex";
}

function cargarSelectProveedores(proveedores) {
  const select = document.getElementById("proveedorSelect");
  if (!select) return;

  select.innerHTML = "<option value=''>Selecciona proveedor</option>";
  proveedores.forEach(p => {
    const option = document.createElement("option");
    option.value = p.ID_PROVEEDOR;
    option.textContent = p.NOMBRE;
    select.appendChild(option);
  });
}

function cargarProductosProveedor() {
  const proveedorSeleccionado = document.getElementById("proveedorSelect").value;

  if (!proveedorSeleccionado) return;


  fetch(`http://localhost:5000/api/productoproveedor/${proveedorSeleccionado}`)
    .then(res => res.json())
    .then(data => {

      const select = document.getElementById("productoSelect");
      if (!select) return;

      select.innerHTML = "<option value=''>Selecciona producto</option>";
      data.forEach(p => {
        const opt = document.createElement("option");
        opt.value = p.ID_PRODUCTO;
        opt.textContent = p.NOMBRE; 
        select.appendChild(opt);
      });
    })
    .catch(error => {
      console.error('Error al cargar productos:', error);
    });
}

function abrirModalCompra() {
  document.getElementById("modalCompra").style.display = "flex";
  productosCompra = [];
  actualizarListaProductosCompra();
}

function cerrarModalCompra() {
  document.getElementById("modalCompra").style.display = "none";
  document.getElementById("formCompra").reset();
}

function agregarProductoCompra() {
  const productoSelect = document.getElementById("productoSelect");
  const productoId = productoSelect.value;
  const nombreProducto = productoSelect.options[productoSelect.selectedIndex].text;
  const cantidad = parseInt(document.getElementById("cantidadProducto").value);

  if (!productoId || isNaN(cantidad) || cantidad <= 0) {
    return alert("Completa producto y cantidad");
  }

  productosCompra.push({ id: productoId, nombre: nombreProducto, cantidad });
  actualizarListaProductosCompra();
}

function actualizarListaProductosCompra() {
  const contenedor = document.getElementById("listaProductosCompra");
  contenedor.innerHTML = "";
  productosCompra.forEach(prod => {
    const div = document.createElement("div");
    div.textContent = `${prod.nombre} - ${prod.cantidad} unidades`;
    contenedor.appendChild(div);
  });
}

function guardarCompra(e) {
  e.preventDefault();
  const proveedorId = document.getElementById("proveedorSelect").value;
  if (!proveedorId || productosCompra.length === 0) return alert("Selecciona proveedor y agrega productos");

  // Aquí se debera obtener el ID del empleado cuando se haga el login
  const empleadoId = obtenerEmpleadoLogueado();

  const data = {
    proveedor: proveedorId,
    empleado: empleadoId,
    productos: productosCompra
  };

  fetch("http://localhost:5000/api/compras", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  })
    .then(res => res.json())
    .then(() => {
      cerrarModalCompra();
      cargarHistorialCompras();
    });
}

function cargarHistorialCompras() {
  const fecha = document.getElementById("filtroFecha").value;
  let url = "http://localhost:5000/api/compras";
  if (fecha) url += `?fecha=${fecha}`;

  fetch(url)
    .then(res => res.json())
    .then(data => {
      const contenedor = document.getElementById("tablaHistorialCompras");
      contenedor.innerHTML = "";
      data.forEach(compra => {
        const div = document.createElement("div");
        div.className = "compra-item";
        div.innerHTML = `
          <p><strong>Proveedor:</strong> ${compra.nombre_proveedor}</p>
          <p><strong>Fecha:</strong> ${compra.fecha}</p>
          <p><strong>Total:</strong> $${parseFloat(compra.total).toFixed(2)}</p>
        `;
        div.addEventListener("click", (()=> {
          const id = compra.id_compra;
          return () => mostrarTicketCompra(id);

        })());
        contenedor.appendChild(div);
      });
    });
}
function mostrarTicketCompra(id_compra) {
  fetch(`http://localhost:5000/api/compras/${id_compra}?t=${Date.now()}`)
    .then(res => res.json())
    .then(data => {
      const detalles = data.detalles;
      const fechaCompra = new Date(data.fecha); 
      const proveedor = data.proveedor || 'Proveedor desconocido';
      const ordenCompra = data.orden;
      const empleado = data.empleado;

      const options = { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      };
      const fechaFormateada = fechaCompra.toLocaleDateString('es-ES', options);

      let total = 0;
      if (detalles.length > 0) {
        total = detalles.reduce((sum, item) => sum + parseFloat(item.SUBTOTAL_COMPRA), 0);
      }

      let html = `
        <div class="ticket-header">

          <h2>SWEETFIT-COMPRA</h2>
          <p class="ticket-date">${fechaFormateada}</p>
          <p><strong>Proveedor:</strong> ${proveedor}</p>
          <p><strong>Empleado:</strong>${empleado}</p>
          <p><strong>Orden de Compra:</strong>${ordenCompra}</p>
        </div>
        <div class="ticket-divider"></div>
        <div class="ticket-items">
          <table class="ticket-table">
            <thead>
              <tr>
                <th>Cant.</th>
                <th>Producto</th>
                <th>Precio Unit.</th>
                <th>Subtotal</th>
              </tr>
            </thead>
            <tbody>
      `;

      if (detalles.length === 0) {
        html += `<tr><td colspan="4" class="no-items">No hay productos registrados en esta compra.</td></tr>`;
      } else {
        detalles.forEach(prod => {
          html += `
            <tr>
              <td class="text-center">${prod.CANTIDAD_COMPRA}</td>
              <td>${prod.NOMBRE}</td>
              <td class="text-right">$${parseFloat(prod['PRECIO UNITARIO']).toFixed(2)}</td>
              <td class="text-right">$${parseFloat(prod.SUBTOTAL_COMPRA).toFixed(2)}</td>
            </tr>
          `;
        });
      }

      html += `
            </tbody>
          </table>
        </div>
        <div class="ticket-divider"></div>
        <div class="ticket-summary">
          <div class="summary-row total">
            <span class="summary-label">TOTAL:</span>
            <span class="summary-value">$${total.toFixed(2)}</span>
          </div>
          <div class="no-print" style="text-align: right; margin-top: 10px;">
            <button id="btnImprimirTicket" class="btn-imprimir">Imprimir Ticket</button>
          </div>
        </div>
      `;

      const modal = document.getElementById("modalTicket");
      const contenido = document.getElementById("contenidoTicket");
      contenido.innerHTML = html;
      modal.style.display = "block";
      setTimeout(() => {
        const boton = document.getElementById("btnImprimirTicket");
        if (boton) {
          boton.addEventListener("click",() => imprimirTicket("contenidoTicket"));
        } else {
          console.error("No se encontró el botón de imprimir.");
        }
      }, 0);
    })
    .catch(error => {
      console.error("Error al cargar los detalles de la compra:", error);
      const modal = document.getElementById("modalTicket");
      const contenido = document.getElementById("contenidoTicket");
      contenido.innerHTML = `<p class="error-message">Error al cargar los detalles de la compra. Por favor, intente nuevamente.</p>`;
      modal.style.display = "block";
    });
}
function imprimirTicket(idContenedor) {
  const contenidoOriginal = document.getElementById(idContenedor);

  if (!contenidoOriginal) {
    console.error(`No se encontró el contenedor con ID '${idContenedor}'`);
    alert("No se pudo encontrar el contenido para imprimir.");
    return;
  }

  const clon = contenidoOriginal.cloneNode(true);
  const boton = clon.querySelector("#btnImprimirTicket");
  if (boton) {
    boton.remove();
  }

  const ventana = window.open('', '_blank', 'width=600,height=600');
  if (!ventana) {
    alert("Bloqueador de ventanas emergentes detectado. Por favor, permite las ventanas emergentes para imprimir.");
    return;
  }
  
  const html = `
    <html>
      <head>
        <style>
          body {
            font-family: monospace;
            font-size: 11px;
            margin: 0;
            padding: 10px;
            width: 68mm;
          }
          img {
            max-width: 60%;
            height: auto;
            display: block;
            margin: 0 auto 0px auto;
          }
          .ticket-header {
            text-align: center;
          }
          .ticket-header h2 {
            font-size: 14px;
            margin: 0;
          }
          .ticket-date {
            text-align: center;
            font-size: 10px;
            margin: 5px 0;
          }
          .customer-info {
            margin: 5px 0;
          }
          .customer-info p {
            margin: 2px 0;
          }
          .ticket-divider {
            border-top: 1px dashed #000;
            margin: 5px 0;
          }
          .ticket-table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
          }
          .ticket-table th {
            font-size: 10px;
            text-align: left;
            padding: 2px 0;
          }
          .ticket-table td {
            font-size: 10px;
            padding: 2px 0;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .ticket-table .col-qty {
            width: 10%;
            text-align: center;
          }
          .ticket-table .col-prod {
            width: 40%;
            text-align: left;
          }
          .ticket-table .col-price {
            width: 25%;
            text-align: right;
          }
          .ticket-table .col-subtotal {
            width: 25%;
            text-align: right;
          }
          .ticket-summary {
            margin-top: 10px;
            text-align: right;
            font-weight: bold;
            font-size: 12px;
          }
          .no-print {
            margin-top: 0px;
          }
          .logo-placeholder {
            width: 60px;
            height: 10px; /* Reducida la altura */
            margin: 0; 
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            border: 0 px solid #ccc;
          }
        </style>
      </head>
      <body>
        ${clon.innerHTML}
      </body>
    </html>
  `;

  ventana.document.open();
  ventana.document.write(html);
  ventana.document.close();

  ventana.onload = () => {
    ventana.focus();
    ventana.print();
    ventana.onafterprint = () => ventana.close();
  };
}
// FIN DE LÓGICA DE PROVEEDORES ______________________________________________________________________

//COMIENZO DE LA LOGICA DE REPORTES.HTML _____________________________________________________________________
function inicializarReportes() {
  const tipoReporte = document.getElementById("tipoReporte");
  const tituloTipoReporte = document.getElementById("tituloTipoReporte");
  const graficaVentas = document.getElementById("graficaVentas");
  const graficaCategorias = document.getElementById("graficaCategorias");

  let chartVentas;
  let chartCategorias;

  function actualizarTitulo(tipo) {
    switch (tipo) {
      case "diario": return "Ventas Diarias (últimos 30 días)";
      case "semanal": return "Ventas Semanales (últimas 12 semanas)";
      case "mensual": return "Ventas Mensuales (últimos 12 meses)";
      default: return "";
    }
  }

  function obtenerFechaPorTipo(tipo) {
    if (tipo === "diario") {
      return document.getElementById("fechaDia")?.value || "";
    }
    if (tipo === "semanal") {
      return document.getElementById("fechaSemana")?.value || "";
    }
    if (tipo === "mensual") {
      return document.getElementById("fechaMes")?.value || "";
    }
    return "";
  }

  function obtenerNombreDiaSemana(fecha) {
    const dias = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
    return dias[fecha.getDay()];
  }

  function obtenerSemanaDelMes(fecha) {
    const primerDiaMes = new Date(fecha.getFullYear(), fecha.getMonth(), 1);
    const diaDelMes = fecha.getDate();

    // Número de días entre el primer día del mes y la fecha actual
    const ajuste = primerDiaMes.getDay(); // 0 (Domingo) a 6 (Sábado)
    return Math.ceil((diaDelMes + ajuste) / 7);
  }

  function formatearFecha(fechaStr, tipo) {
    const fecha = new Date(fechaStr + "T00:00:00"); // fuerza local

    if (isNaN(fecha)) return "Fecha inválida";

    switch (tipo) {
      case "diario":
        return fecha.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });

      case "semanal": {
        // Día largo (ej: "Lunes 01 Abr")
        const opciones = { weekday: "long", day: "2-digit", month: "short" };
        return fecha.toLocaleDateString("es-MX", opciones).replace('.', '');
      }

      case "mensual": {
        const semana = obtenerSemanaDelMes(fecha);
        const mes = fecha.toLocaleDateString("es-MX", { month: "long" });
        return `Semana ${semana} (${mes})`;
      }

      default:
        return fecha.toLocaleDateString();
    }
  }

  async function obtenerDatosVentas(tipo, fecha) {
    try {
      let url = `http://localhost:5000/api/reportes/ventas?tipo=${tipo}`;
      if (fecha) url += `&fecha=${encodeURIComponent(fecha)}`;

      const response = await fetch(url);
      if (!response.ok) throw new Error("Error en la respuesta del servidor");

      const json = await response.json();

      if (!json.ventas || !Array.isArray(json.ventas)) throw new Error("No se encontraron datos de ventas");

      return {
        labels: json.ventas.map(v => formatearFecha(v.fecha, tipo)),
        data: json.ventas.map(v => v.total_ventas)
      };

    } catch (err) {
      console.error("Error al obtener datos de ventas:", err.message);
      return { labels: [], data: [] };
    }
  }

  function renderizarGrafica(tipo) {
    const fecha = obtenerFechaPorTipo(tipo); // Esta función debe estar definida en tu entorno

    obtenerDatosVentas(tipo, fecha).then(datos => {
      if (chartVentas) chartVentas.destroy(); // chartVentas debe estar definido globalmente

      chartVentas = new Chart(graficaVentas, {
        type: "line",
        data: {
          labels: datos.labels,
          datasets: [{
            label: "Ventas",
            data: datos.data,
            borderColor: "#28a745",
            backgroundColor: "rgba(40, 167, 69, 0.2)",
            tension: 0.4,
            fill: true,
            pointBackgroundColor: "#28a745",
            pointRadius: 4,
            pointHoverRadius: 6,
          }]
        },
        options: {
          responsive: true,
          interaction: {
            mode: 'index',
            intersect: false,
          },
          plugins: {
            legend: {
              display: true,
              labels: {
                color: '#222',
                font: { size: 14, weight: 'bold' }
              }
            },
            tooltip: {
              callbacks: {
                label: ctx => `$${parseFloat(ctx.raw).toFixed(2)}`
              },
              backgroundColor: 'rgba(0,0,0,0.7)',
              titleFont: { weight: 'bold' }
            }
          },
          scales: {
            x: {
              title: {
                display: true,
                text: 'Fecha',
                color: '#555',
                font: { size: 14, weight: 'bold' }
              },
              ticks: {
                color: '#444',
                maxRotation: 45,
                minRotation: 45,
                autoSkip: true,
                maxTicksLimit: 15
              },
              grid: {
                display: false
              }
            },
            y: {
              title: {
                display: true,
                text: 'Monto ($)',
                color: '#555',
                font: { size: 14, weight: 'bold' }
              },
              beginAtZero: true,
              ticks: {
                color: '#444'
              },
              grid: {
                color: 'rgba(0,0,0,0.1)'
              }
            }
          }
        }
      });

      tituloTipoReporte.textContent = actualizarTitulo(tipo); // Asegúrate de tener esta función
    });
  }


  async function obtenerDatosCategorias() {
    try {
      const response = await fetch('http://localhost:5000/api/reportes/categorias');
      const json = await response.json();

      if (!json.categorias) throw new Error("No se encontraron datos de categorías");

      return {
        labels: json.categorias.map(c => c.CATEGORIA),
        data: json.categorias.map(c => c.total_cantidad_vendida)
      };
    } catch (err) {
      console.error("Error al obtener datos de categorías:", err);
      return { labels: [], data: [] };
    }
  }

  function renderizarGraficaCategorias() {
    obtenerDatosCategorias().then(datos => {
      if (chartCategorias) chartCategorias.destroy();

      chartCategorias = new Chart(graficaCategorias, {
        type: "bar",
        data: {
          labels: datos.labels,
          datasets: [{
            label: "Productos Vendidos",
            data: datos.data,
            backgroundColor: "rgba(0, 123, 255, 0.7)",
            borderColor: "rgba(0, 123, 255, 1)",
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          indexAxis: "y",
          scales: {
            x: {
              beginAtZero: true,
              ticks: { color: '#444' },
              grid: { color: 'rgba(0,0,0,0.1)' }
            },
            y: {
              ticks: { color: '#444' },
              grid: { display: false }
            }
          },
          plugins: {
            legend: {
              labels: { color: '#222', font: { size: 14, weight: 'bold' } }
            },
            tooltip: {
              enabled: true,
              backgroundColor: 'rgba(0,0,0,0.7)',
              titleFont: { weight: 'bold' }
            }
          }
        }
      });
    });
  }

  // Ejecutar al cargar la vista
  renderizarGrafica(tipoReporte.value);
  renderizarGraficaCategorias();

  // Evento cambio en selector tipoReporte
  tipoReporte.addEventListener("change", () => {
    renderizarGrafica(tipoReporte.value);
  });

  // Eventos para detectar cambios en inputs de fecha según el tipo
  ["fechaDia", "fechaSemana", "fechaMes"].forEach(id => {
    document.getElementById(id)?.addEventListener("change", () => {
      renderizarGrafica(tipoReporte.value);
    });
  });
}

// ESTA LOGICA PERTECENE A CONFIGURACION.HTML ___________________________________________________________________________
function cargarEmpleados() {
  const empleadosTable = document.getElementById("empleadosTable");
  if (!empleadosTable) return;

  fetch("http://localhost:5000/empleados")
    .then(res => res.json())
    .then(data => {
      empleadosTable.innerHTML = "";
      if (!data || data.length === 0) {
        empleadosTable.innerHTML = `<tr><td colspan="3">No hay empleados registrados.</td></tr>`;
        return;
      }
      data.forEach(emp => {
        const tr = document.createElement("tr");
        tr.dataset.id = emp.ID_EMPLEADO;
        tr.innerHTML = `
          <td>${emp.NOMBRE} ${emp.APELLIDOS}</td>
          <td>${emp.EMAIL}</td>
          <td>${emp.PUESTO}</td>
        `;
        tr.addEventListener("dblclick", () => editarEmpleado(emp));
        empleadosTable.appendChild(tr);
      });
    })
    .catch(err => {
      console.error("Error cargando empleados:", err);
      empleadosTable.innerHTML = `<tr><td colspan="3">Error al cargar empleados.</td></tr>`;
    });
}

function configurarFormularioEmpleado() {
  const form = document.getElementById("altaEmpleadoForm");
  if (!form) return;

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const idEditando = form.dataset.editandoId || null;

    const formData = {
      nombre: form.nombre.value.trim(),
      apellidos: form.apellidos.value.trim(),
      email: form.email.value.trim(),
      puesto: form.puesto.value
    };

    const password = form.password.value.trim();
    if (password !== "") {
      formData.password = password;
    }

    const url = idEditando ? `http://localhost:5000/empleados/${idEditando}` : "http://localhost:5000/empleados";
    const method = idEditando ? "PUT" : "POST";

    fetch(url, {
      method: method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData)
    })
    .then(res => {
      if (!res.ok) throw new Error("Error al guardar empleado");
      return res.json();
    })
    .then(data => {
      alert(data.message || "Empleado guardado correctamente");
      resetFormulario(form);
      cargarEmpleados();
    })
    .catch(err => {
      alert("Error al guardar empleado");
      console.error(err);
    });
  });
}

function editarEmpleado(emp) {
  const form = document.getElementById("altaEmpleadoForm");
  if (!form) return;

  form.nombre.value = emp.NOMBRE;
  form.apellidos.value = emp.APELLIDOS;
  form.email.value = emp.EMAIL;
  form.puesto.value = emp.PUESTO;
  form.password.value = ""; // No mostrar contraseña

  form.dataset.editandoId = emp.ID_EMPLEADO;
  form.querySelector(".btn-guardar").textContent = "Actualizar Empleado";
  form.querySelector(".btn-guardar").classList.add("editando");

  // Agregar botón Eliminar si no existe
  if (!document.getElementById("btnEliminarEmpleado")) {
    const btnEliminar = document.createElement("button");
    btnEliminar.id = "btnEliminarEmpleado";
    btnEliminar.textContent = "Eliminar Empleado";
    btnEliminar.type = "button";
    btnEliminar.className = "btn-eliminar";
    form.appendChild(btnEliminar);

    btnEliminar.addEventListener("click", () => {
      if (confirm("¿Seguro que deseas eliminar este empleado?")) {
        fetch(`http://localhost:5000/empleados/${emp.ID_EMPLEADO}`, {
          method: "DELETE"
        })
          .then(res => {
            if (!res.ok) throw new Error("Error al eliminar empleado");
            return res.json();
          })
          .then(data => {
            alert(data.message || "Empleado eliminado");
            resetFormulario(form);
            cargarEmpleados();
          })
          .catch(err => {
            alert("Error al eliminar empleado");
            console.error(err);
          });
      }
    });
  }

  // Agregar botón Cancelar si no existe
  if (!document.getElementById("btnCancelarEdicion")) {
    const btnCancelar = document.createElement("button");
    btnCancelar.id = "btnCancelarEdicion";
    btnCancelar.textContent = "Cancelar Edición";
    btnCancelar.type = "button";
    btnCancelar.className = "btn-cancelar";
    form.appendChild(btnCancelar);

    btnCancelar.addEventListener("click", () => {
      resetFormulario(form);
    });
  }
}

// Función para resetear el formulario y limpiar estado de edición
function resetFormulario(form) {
  form.reset();
  form.querySelector(".btn-guardar").textContent = "Guardar Empleado";
  form.querySelector(".btn-guardar").classList.remove("editando");
  delete form.dataset.editandoId;

  // Eliminar botones Eliminar y Cancelar si existen
  const btnEliminar = document.getElementById("btnEliminarEmpleado");
  if (btnEliminar) btnEliminar.remove();

  const btnCancelar = document.getElementById("btnCancelarEdicion");
  if (btnCancelar) btnCancelar.remove();
}
