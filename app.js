const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const XLSX = require("xlsx");
const multer = require("multer");
const path = require("path");
const Fuse = require("fuse.js");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

// In-memory storage for uploaded data
const excelData = {};

// File upload setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });

// Upload endpoint with validation
app.post("/upload", upload.single("file"), (req, res) => {
  const filePath = req.file.path;
  const workbook = XLSX.readFile(filePath);
  const sheet = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

  // Validate the uploaded sheet
  if (!sheet || sheet.length === 0) {
    return res.status(400).json({ error: "The uploaded file is empty or invalid." });
  }

  const requiredColumns = ["Question", "Answer"];
  const sheetKeys = Object.keys(sheet[0]);

  const missingColumns = requiredColumns.filter((col) => !sheetKeys.includes(col));
  if (missingColumns.length > 0) {
    return res.status(400).json({
      error: `The uploaded file is missing required columns: ${missingColumns.join(", ")}.`,
    });
  }

  const scriptId = Date.now().toString(); // Generate a unique ID
  const redirectUrl = `/ask/${scriptId}`;

  // Store the uploaded data
  excelData[scriptId] = {
    sheet,
    fuse: new Fuse(sheet, { keys: ["Question"], threshold: 0.4 }), // Initialize Fuse.js with fuzzy matching
  };

  // Save the script link to a text file
  const scriptLink = `http://localhost:${PORT}${redirectUrl}\n`;
  fs.appendFile("script_links.txt", scriptLink, (err) => {
    if (err) {
      console.error("Error saving script link:", err);
    }
  });

  res.json({ scriptId, redirectUrl });
});

// Process questions endpoint
app.post("/process-speech/:id", (req, res) => {
  const scriptId = req.params.id;
  const userQuestion = req.body.question.toLowerCase();

  if (!excelData[scriptId]) {
    return res.status(404).json({ answer: "No data found for the uploaded file." });
  }

  const { sheet, fuse } = excelData[scriptId];

  // Use Fuse.js to find the best match
  const result = fuse.search(userQuestion);
  if (result.length > 0) {
    res.json({ answer: result[0].item.Answer });
  } else {
    res.json({ answer: "Sorry, I don't understand that question." });
  }
});

// Serve Ask Me Anything page
app.get("/ask/:id", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "ask.html"));
});

// Catch-all to serve index.html
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
