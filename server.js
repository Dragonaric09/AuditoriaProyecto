const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Sirve el frontend estatico desde /public (index.html en la raiz)
app.use(express.static(path.join(__dirname, "public")));

// Cualquier otra ruta tambien devuelve la demo (util para el escaneo del QR)
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Demo Quishing corriendo en http://localhost:${PORT}`);
});
