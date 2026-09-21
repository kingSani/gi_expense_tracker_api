import dotenv from "dotenv";
dotenv.config();
import type { Request, Response } from "express";
import express from "express";
import pg from "pg";
import validate from "express-zod-safe";
import { z } from "zod";
import { id } from "zod/locales";

const { Pool } = pg;
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.HOST,
  database: process.env.DATABASE,
  password: process.env.PASSWORD,
  port: Number(process.env.PORT_DB),
});
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const expenseSchema = z.object({
  amount: z.number().positive(),
  user_id: z.number().int().positive(),
  description: z.string().min(3).optional(),
  category_id: z.number().int().positive(),
});
const getExpenseSchema = z.object({
  user_id: z.number().int().positive(),
});
const paramsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

app.post(
  "/expenses",
  validate({ body: expenseSchema }),
  async (req: Request, res: Response) => {
    const client = await pool.connect();
    try {
      const { amount, user_id, description, category_id } = req.body;
      await client.query(
        "INSERT INTO expenses (amount, user_id, description, category_id) VALUES ($1, $2, $3, $4)",
        [amount, user_id, description, category_id],
      );
      res.status(201).json({ message: "Expense added successfully" });
    } catch (err) {
      if (err && typeof err === "object" && "message" in err) {
        res.status(400).json({ error: err.message });
      }
    } finally {
      client.release();
    }
  },
);

app.get("/expenses", async (req: Request, res: Response) => {
  const client = await pool.connect();
  if (!req.body.user_id || typeof req.body.user_id !== "number") {
    res.status(400).json({ error: "user_id is required" });
    client.release();
    return;
  }
  try {
    const { user_id } = req.body;
    const result = await client.query(
      "SELECT * FROM expenses WHERE user_id = $1",
      [user_id],
    );
    res.status(200).json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
});

app.get(
  "/expenses/:id",
  validate({ body: getExpenseSchema, params: paramsSchema }),
  async (req: Request, res: Response) => {
    const client = await pool.connect();
    try {
      const { id } = req.params;
      const { user_id } = req.body;
      const result = await client.query(
        "SELECT * FROM expenses WHERE user_id = $1 AND id = $2 RETURNING *",
        [user_id, id],
      );
      if (result.rows.length === 0) {
        res.status(404).json({ error: "Expense not found" });
      } else {
        res.status(200).json(result.rows[0]);
      }
    } catch (err) {
      res.status(500).json({ error: "Internal server error" });
    } finally {
      client.release();
    }
  },
);
app.patch(
  "/expenses/:id",
  validate({ body: expenseSchema, params: paramsSchema }),
  async (req: Request, res: Response) => {
    const client = await pool.connect();
    try {
      const { id } = req.params;
      const { user_id, amount, category_id, description } = req.body;
      const result = await client.query(
        "UPDATE expenses SET amount = $1,description = $2, category_id = $3 WHERE user_id = $4 AND id = $5 RETURNING *",
        [amount, description, category_id, user_id, id],
      );
      if (result.rows.length === 0) {
        res.status(404).json({ error: "Expense not found" });
      } else {
        res.status(200).json(result.rows[0]);
      }
    } catch (err) {
      res.status(500).json({ error: "Internal server error" });
    } finally {
      client.release();
    }
  },
);
app.delete(
  "/expenses/:id",
  validate({ body: getExpenseSchema, params: paramsSchema }),
  async (req: Request, res: Response) => {
    const client = await pool.connect();
    try {
      const { id } = req.params;
      const { user_id} = req.body;
      const result = await client.query(
        "DELETE FROM expenses WHERE user_id = $1 AND id = $2 RETURNING *",
        [user_id, id],
      );
      if (result.rows.length === 0) {
        res.status(404).json({ error: "Expense not found" });
      } else {
        res.status(200).json(result.rows[0]);
      }
    } catch (err) {
      res.status(500).json({ error: "Internal server error" });
    } finally {
      client.release();
    }
  },
);
app.listen(process.env.PORT || 3000);
