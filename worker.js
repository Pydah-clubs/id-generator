import { Hono } from "hono";
import admin from "firebase-admin";
import crypto from "crypto";

const app = new Hono();

// 🔥 Ensure Environment Variables are Loaded
if (!Bun.env.FIREBASE_SERVICE_ACCOUNT_KEY || !Bun.env.RAZORPAY_SECRET) {
  throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_KEY or RAZORPAY_SECRET in environment variables.");
}

// ✅ Parse Firebase Service Account Key
const serviceAccount = JSON.parse(Bun.env.FIREBASE_SERVICE_ACCOUNT_KEY);

// 🔥 Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}
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
      console.error("Invalid Razorpay Signature!");
      return c.json({ error: "Invalid Signature" }, 400);
    }

    // ✅ Process Only Successful Payments
    if (body.event === "payment.captured") {
      const pin = body.payload.payment.entity.notes?.pin; // Ensure "pin" exists

      if (!pin) {
        console.error("No pin found in payment data!");
        return c.json({ error: "No Pin Found in Payment Data" }, 400);
      }

      // 📌 Store Pin in Firestore
      await db.collection("pins").doc(pin).set({
        pin: pin,
        status: "paid",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(`✅ Pin ${pin} stored successfully in Firestore!`);
      return c.json({ message: "Pin Stored Successfully!" }, 200);
    }

    return c.json({ message: "Event Ignored" }, 200);
  } catch (error) {
    console.error("Error processing webhook:", error);
    return c.json({ error: "Error processing webhook", details: error.message }, 500);
  }
});

export default app;
