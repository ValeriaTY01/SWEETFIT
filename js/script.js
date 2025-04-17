// ANIMACIÓN DE LA BARRA LATERAL
document.getElementById('toggleSidebar').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('collapsed');
});

// ESTA LOGICA PARA LA CARGA DE VENTANAS (productos.html, cliente.html, etc.)_____________________________________
document.addEventListener("DOMContentLoaded", () => {
  const contentArea = document.getElementById("content-area");
  const links = document.querySelectorAll(".menu a");
  const title = document.getElementById("titulo-vista");

  function loadPage(page, text) {
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

// ESTA LOGICA PERTECENE A PRODUCTOS.HTML ___________________________________________________________________________
let categoriaActual = "";
let paginaActual = 1;

function initProductoModal() {
  const btnAbrir = document.querySelector(".btn-agregar-producto");
  const modal = document.getElementById("modalAgregarProducto");
  const cerrar = document.getElementById("cerrarModal");
  const form = document.getElementById("formAgregarProducto");

  if (btnAbrir && modal && cerrar && form) {
    btnAbrir.addEventListener("click", () => {
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

    const inputImagen = form.querySelector("input[name='imagen']");
    const preview = document.getElementById("previewImagen");

    if (inputImagen && preview) {
      inputImagen.addEventListener("change", () => {
        const file = inputImagen.files[0];
        if (file) {
          preview.src = URL.createObjectURL(file);
        }
      });
    }

    form.addEventListener("submit", e => {
      e.preventDefault();
      const formData = new FormData(form);
      const id = document.getElementById("productoId").value;

      const url = id
        ? `http://localhost:5000/api/editar_producto/${id}`
        : "http://localhost:5000/api/productos";
      const method = "POST";

      fetch(url, {
        method,
        body: formData
      })
        .then(res => res.json())
        .then(response => {
          if (response.success) {
            modal.style.display = "none";
            form.reset();
            document.getElementById("productoId").value = "";
            preview.src = "";
            cargarProductos();
          } else {
            alert("Error al guardar el producto");
          }
        })
        .catch(err => {
          console.error(err);
          alert("Error en la conexión");
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
              <span class="editar" data-id="${prod.id_producto}">✏️</span>
              <span class="eliminar" data-id="${prod.id_producto}">🗑️</span>
            </div>
          </div>`;
        grid.appendChild(card);
      });

      document.querySelectorAll(".eliminar").forEach(btn => {
        btn.addEventListener("click", () => {
          const id = btn.dataset.id;
          if (confirm("¿Estás seguro de eliminar este producto?")) {
            fetch(`http://localhost:5000/api/eliminar_producto/${id}`, { method: "DELETE" })
              .then(res => res.json())
              .then(response => {
                if (response.success) {
                  cargarProductos(categoriaActual, paginaActual, document.getElementById("buscador").value);
                } else {
                  alert("Error al eliminar producto");
                }
              });
          }
        });
      });

      document.querySelectorAll(".editar").forEach(btn => {
        btn.addEventListener("click", () => {
          const id = btn.dataset.id;
          editarProducto(id);
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

function editarProducto(id) {
  fetch(`http://localhost:5000/api/producto/${id}`)
    .then(res => res.json())
    .then(prod => {
      const modal = document.getElementById("modalAgregarProducto");
      const form = document.getElementById("formAgregarProducto");
      const preview = document.getElementById("previewImagen");

      if (!prod || !form) return;

      form.nombre.value = prod.nombre;
      form.descripcion.value = prod.descripcion;
      form.precio.value = prod.precio;
      form.cantidad.value = prod.cantidad;
      form.categoria.value = prod.categoria;
      document.getElementById("productoId").value = prod.id_producto;
      preview.src = `http://localhost:5000/uploads/${prod.imagen}`;

      modal.style.display = "flex";
    })
    .catch(err => {
      console.error(err);
      alert("Error al cargar producto para edición");
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

// ESTA LOGICA PERTECENE A VENTAS.HTML ___________________________________________________________________________
let paginaModalActual = 1;
let totalPaginasModal = 1;

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
        card.innerHTML = `
          <img src="http://localhost:5000/uploads/${prod.imagen}" alt="${prod.nombre}">
          <h3>${prod.nombre}</h3>
          <p>Precio: $${parseFloat(prod.precio).toFixed(2)}</p>
          <p>Stock: ${prod.cantidad}</p>
          <input type="number" min="1" max="${prod.cantidad}" value="1" id="cantidad-${prod.id}" />
          <button onclick="agregarProductoAlCarrito(${prod.id}, '${prod.nombre}', ${prod.precio})">Agregar</button>
        `;
        grid.appendChild(card);
      });

      renderPaginacionModal();

      buscador.oninput = () => {
        abrirModalProductos(1);
      };
      
    });
}

function cerrarModalProductos() {
  document.getElementById("modalSeleccionarProductos").style.display = "none";
}

function agregarProductoAlCarrito(id, nombre, precio) {
  const cantidadInput = document.getElementById(`cantidad-${id}`);
  const cantidad = parseInt(cantidadInput.value);
  const tabla = document.querySelector("#tablaCarrito tbody");

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
    <td><input type="number" value="${cantidad}" min="1" onchange="actualizarSubtotal(this, ${precio})" /></td>
    <td>$${precio.toFixed(2)}</td>
    <td class="subtotal">$${subtotal}</td>
    <td><button onclick="eliminarProductoDelCarrito(this)">🗑️</button></td>
  `;
  tabla.appendChild(row);

  actualizarTotalVenta();
}

function actualizarSubtotal(input, precio) {
  const cantidad = parseInt(input.value);
  const subtotal = (cantidad * precio).toFixed(2);
  const celdaSubtotal = input.closest("tr").querySelector(".subtotal");
  celdaSubtotal.textContent = `$${subtotal}`;
  actualizarTotalVenta();
}

function eliminarProductoDelCarrito(btn) {
  const fila = btn.closest("tr");
  fila.remove();
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