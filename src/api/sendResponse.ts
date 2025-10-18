import { Router, Request, Response } from "express";
import { dispatchResponse } from "../integrations/dispatcher.js";

const router = Router();

router.post("/", async (req: Request, res: Response) => {
  try {
    const response = req.body;
    console.log("📤 OutgoingResponse received:", JSON.stringify(response, null, 2));

    await dispatchResponse(response);

    res.status(200).json({ status: "ok" });
  } catch (err) {
    console.error("❌ send-response error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
