import { Hono } from "hono";
import admin from "firebase-admin";
import crypto from "crypto";

const app = new Hono();

// 🔥 Initialize Firebase Admin SDK (Using Service Account Key)
const serviceAccount = JSON.parse(Bun.env.FIREBASE_SERVICE_ACCOUNT_KEY;

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const db = admin.firestore();

// 🛡️ Get Razorpay Secret from Environment Variable
const RAZORPAY_SECRET = Bun.env.RAZORPAY_SECRET;

// 📌 Webhook Endpoint to Receive Razorpay Events
app.post("/razorpay-webhook", async (c) => {
  try {
    const body = await c.req.json();
    const signature = c.req.header("x-razorpay-signature");

    // 🔍 Verify Razorpay Signature
    const expectedSignature = crypto
      .createHmac("sha256", RAZORPAY_SECRET)
      .update(JSON.stringify(body))
      .digest("hex");

    if (signature !== expectedSignature) {
      return c.json({ error: "Invalid Signature" }, 400);
    }

    // ✅ If Payment is Successful, Store the Pin in Firestore
    if (body.event === "payment.captured") {
      const pin = body.payload.payment.entity.notes.pin; // Assuming pin is in "notes"

      if (!pin) {
        return c.json({ error: "No Pin Found in Payment Data" }, 400);
      }

      await db.collection("pins").doc(pin).set({
        pin: pin,
        status: "paid",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return c.json({ message: "Pin Stored Successfully!" }, 200);
    }

    return c.json({ message: "Event Ignored" }, 200);
  } catch (error) {
    return c.json({ error: "Error processing webhook", details: error.message }, 500);
  }
});

export default app;
