import { Hono } from "hono";
import crypto from "crypto";

const app = new Hono();

// 🛡️ Environment Variables
const FIREBASE_PROJECT_ID = Bun.env.FIREBASE_PROJECT_ID; // Your Firestore Project ID
const FIREBASE_WEB_API_KEY = Bun.env.FIREBASE_WEB_API_KEY; // Get from Firebase Console
const FIREBASE_AUTH_TOKEN = Bun.env.FIREBASE_AUTH_TOKEN; // Service Account Bearer Token
const RAZORPAY_SECRET = Bun.env.RAZORPAY_SECRET;

if (!FIREBASE_PROJECT_ID || !FIREBASE_AUTH_TOKEN || !RAZORPAY_SECRET) {
  throw new Error("Missing required environment variables.");
}

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

      // 📌 Save PIN to Firestore Using REST API
      const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/pins/${pin}`;

      const firestoreResponse = await fetch(firestoreUrl, {
        method: "PATCH",
        headers: {
          "Authorization": `Bearer ${FIREBASE_AUTH_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fields: {
            pin: { stringValue: pin },
            status: { stringValue: "paid" },
            createdAt: { timestampValue: new Date().toISOString() },
          },
        }),
      });

      if (!firestoreResponse.ok) {
        const errorData = await firestoreResponse.json();
        console.error("Failed to store pin in Firestore:", errorData);
        return c.json({ error: "Failed to store pin in Firestore" }, 500);
      }

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
