
let crudTabella = "", crudMetadata = [], crudAzioni = true;
let currentPage = 1, pageSize = 25, totalRecords = 0, currentOrder = "", currentFilter = "";

window.initCRUD = async function (tabella) {
    crudTabella = tabella;
    currentPage = 1;

    try {
        const metaRes = await fetch(`/api/metadata/${tabella}`, { credentials: "include" });
        if (!metaRes.ok) throw new Error("no metadata");
        const metaJson = await metaRes.json();
        crudMetadata = metaJson.columns;
        crudAzioni = metaJson.actions !== false;
    } catch {
        const fallbackRes = await fetch(`/api/${tabella}?skip=0&take=1`, { credentials: "include" });
        const fallbackJson = await fallbackRes.json();
        const sample = (Array.isArray(fallbackJson) ? fallbackJson : fallbackJson.items || [])[0] || {};
        crudMetadata = Object.keys(sample).map(k => ({ name: k, label: k, type: typeof sample[k] }));
        crudAzioni = true;
    }

    renderTableHeader();
    loadData();

    document.getElementById("btn-nuovo").onclick = () => openModal();
    document.getElementById("crud-form").onsubmit = salvaElemento;
    document.getElementById("page-size").onchange = (e) => {
        pageSize = parseInt(e.target.value);
        currentPage = 1;
        loadData();
    };
    document.getElementById("filter-text").oninput = (e) => {
        currentFilter = e.target.value.trim();
        currentPage = 1;
        loadData();
    };

};

function renderTableHeader() {
    const thead = document.getElementById("crud-thead");
    thead.innerHTML = "<tr>" + crudMetadata.filter(c => c.name !== "Id").map(col =>
        `<th class='p-2 cursor-pointer hover:underline' onclick="toggleSort('${col.name}')">${col.label}</th>`
    ).join("") + (crudAzioni ? "<th class='p-2'>Azioni</th>" : "") + "</tr>";
}

function toggleSort(colName) {
    if (currentOrder === colName) currentOrder = colName + " desc";
    else if (currentOrder === colName + " desc") currentOrder = "";
    else currentOrder = colName;
    loadData();
}

async function loadData() {
    const skip = (currentPage - 1) * pageSize;
    const params = new URLSearchParams({ skip, take: pageSize });
    if (currentOrder) params.set("orderby", currentOrder);
    if (currentFilter) params.set("filter", currentFilter);

    const res = await fetch(`/api/${crudTabella}?${params.toString()}`, { credentials: "include" });
    const json = await res.json();
    const dati = Array.isArray(json) ? json : json.items || [];
    totalRecords = json.total || dati.length;

    const tbody = document.getElementById("crud-tbody");
    tbody.innerHTML = "";

    dati.forEach(r => {
        const tr = document.createElement("tr");
        tr.className = "border-t";
        tr.innerHTML = crudMetadata.filter(c => c.name !== "Id").map(col => {
            let val = r[col.name];
            if ((col.name === "DataModifica" || col.name === "DataInserimento") && val) {
                const d = new Date(val);
                val = d.toLocaleString("it-IT", { day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
            } else if (typeof val === "boolean") {
                val = val ? "✅" : "❌";
            }
            return `<td class='p-2'>${val ?? ''}</td>`;
        }).join("") +
        (crudAzioni ? `<td class='p-2'>
            <button onclick='modificaElemento(${r.Id})' class='text-blue-600 mr-2'>✏️</button>
            <button onclick='eliminaElemento(${r.Id})' class='text-red-600'>🗑️</button>
        </td>` : "");
        tbody.appendChild(tr);
    });

    renderPagination();
    document.getElementById("total-count").textContent = `Totale: ${totalRecords} record`;
}

function renderPagination() {
    const div = document.getElementById("pagination");
    const pageCount = Math.ceil(totalRecords / pageSize);
    div.innerHTML = "";
    for (let i = 1; i <= pageCount; i++) {
        const btn = document.createElement("button");
        btn.className = "px-2 py-1 border rounded" + (i === currentPage ? " bg-blue-200" : "");
        btn.textContent = i;
        btn.onclick = () => { currentPage = i; loadData(); };
        div.appendChild(btn);
    }
}

function openModal(valori = {}) {
    document.getElementById("crud-modal").classList.remove("hidden");
    document.getElementById("crud-modal").classList.add("flex");
    document.getElementById("crud-modal-title").textContent = valori.Id ? "Modifica" : "Nuovo";

    const form = document.getElementById("crud-form");
    form.innerHTML = "";

    crudMetadata.forEach(col => {
        if (["Id", "DataModifica", "DataInserimento"].includes(col.name)) return;

        const input = document.createElement("input");
        input.type = col.type || "text";
        input.name = col.name;
        input.placeholder = col.label;
        input.className = "w-full border p-2 rounded";
        if (col.readonly) input.disabled = true;
        if (valori[col.name]) input.value = valori[col.name];
        form.appendChild(input);
    });

    if (valori.Id) {
        const hidden = document.createElement("input");
        hidden.type = "hidden";
        hidden.name = "Id";
        hidden.value = valori.Id;
        form.appendChild(hidden);
    }
}

function closeModal() {
    document.getElementById("crud-modal").classList.add("hidden");
    document.getElementById("crud-modal").classList.remove("flex");
}


async function salvaElemento(e) {
    e.preventDefault();
    const form = e.target;

    // Rimuovi errori precedenti
    form.querySelectorAll(".error-message").forEach(el => el.remove());
    form.querySelectorAll("input").forEach(el => el.classList.remove("border-red-500"));

    let valido = true;

    const data = {};
    crudMetadata.forEach(col => {
        const input = form.elements[col.name];
        if (input && !input.disabled) data[col.name] = input.value;
    });

    
    crudMetadata.forEach(col => {
        const input = form.elements[col.name];
        if (input && !input.disabled) {
            const value = input.value.trim();
            let err = "";

            if (col.required && !value) {
                err = "Campo obbligatorio";
            }
            if (col.type === "number" && value && isNaN(Number(value))) {
                err = "Deve essere un numero";
            }
            if (col.min && value && Number(value) < col.min) {
                err = `Minimo ${col.min}`;
            }
            if (col.max && value && Number(value) > col.max) {
                err = `Massimo ${col.max}`;
            }

            if (err) {
                valido = false;
                input.classList.add("border-red-500");
                const msg = document.createElement("div");
                msg.className = "text-red-500 text-xs mt-1 error-message";
                msg.textContent = err;
                input.insertAdjacentElement("afterend", msg);
            } else {
                data[col.name] = value;
            }
        }
    });

    if (!valido) return;
    
    const method = data.Id ? "PUT" : "POST";

    const url = `/api/${crudTabella}` + (data.Id ? `/${data.Id}` : "");
    await fetch(url, {
        method: method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
    });

    closeModal();
    loadData();
}

async function modificaElemento(id) {
    const res = await fetch(`/api/${crudTabella}/${id}`, { credentials: "include" });
    const item = await res.json();
    openModal(item);
}

async function eliminaElemento(id) {
    if (!confirm("Confermi l'eliminazione?")) return;
    await fetch(`/api/${crudTabella}/${id}`, {
        method: "DELETE",
        credentials: "include"
    });
    loadData();
}


