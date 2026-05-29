import express from "express";
import cors from "cors";

export const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.text({ type: ["text/plain", "text/csv"], limit: "10mb" }));
