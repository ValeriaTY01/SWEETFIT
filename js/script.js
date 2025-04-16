// VARIABLES GLOBALES PARA PAGINACIÓN Y CATEGORÍA
let categoriaActual = "";
let paginaActual = 1;

// ANIMACIÓN DE LA BARRA LATERAL
document.getElementById('toggleSidebar').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('collapsed');
});

// CARGA DE VENTANAS DINÁMICAS
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
              const texto = buscador.value.toLowerCase();
              filtrarProductosPorNombre(texto);
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

// MODAL DE AGREGAR / EDITAR PRODUCTO
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

    // Vista previa de imagen
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

    // Manejo del envío del formulario
    form.addEventListener("submit", e => {
      e.preventDefault();
      const formData = new FormData(form);
      const id = document.getElementById("productoId").value;

      const url = id
        ? `http://localhost:5000/api/editar_producto/${id}`
        : "http://localhost:5000/api/productos";
      const method = "POST"; // Para FormData, usamos POST también para edición

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

// CATEGORÍAS DINÁMICAS
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

// CARGA DE PRODUCTOS CON PAGINACIÓN
function cargarProductos(categoria = categoriaActual, pagina = paginaActual) {
  const grid = document.querySelector(".grid-productos");
  if (!grid) return;

  categoriaActual = categoria;
  paginaActual = pagina;

  let url = `http://localhost:5000/api/productos?page=${pagina}`;
  if (categoria) {
    url += `&categoria=${encodeURIComponent(categoria)}`;
  }

  fetch(url)
    .then(res => res.json())
    .then(data => {
      const productos = data.productos || data;
      const totalPaginas = data.total_paginas || 1;
      const paginaActual = data.pagina_actual || 1;

      grid.innerHTML = "";

      if (productos.length === 0) {
        grid.innerHTML = "<p style='padding: 1rem;'>No hay productos en esta categoría.</p>";
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
                  cargarProductos();
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

      renderPaginacion(totalPaginas, paginaActual, categoria);
    })
    .catch(() => {
      grid.innerHTML = "<p>Error al cargar productos.</p>";
    });
}

// FILTRO POR NOMBRE
function filtrarProductosPorNombre(filtro) {
  const cards = document.querySelectorAll(".producto-card");
  cards.forEach(card => {
    const nombre = card.querySelector("h3").textContent.toLowerCase();
    card.style.display = nombre.includes(filtro) ? "flex" : "none";
  });
}

// EDITAR PRODUCTO
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

// PAGINACIÓN
function renderPaginacion(totalPaginas, paginaActual = 1, categoria = "") {
  const contenedor = document.getElementById("paginacionProductos");
  if (!contenedor) return;

  contenedor.innerHTML = "";

  for (let i = 1; i <= totalPaginas; i++) {
    const btn = document.createElement("button");
    btn.textContent = i;
    btn.classList.toggle("activo", i === paginaActual);
    btn.addEventListener("click", () => {
      cargarProductos(categoria, i);
    });
    contenedor.appendChild(btn);
  }
}
