addEventListener("fetch", event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const data = await request.json();

    if (data.event === "payment.captured") {
      const payment = data.payload.payment.entity;
      const pin = payment.notes?.pin; 

      if (!pin) {
        return new Response("No PIN found in payment metadata", { status: 400 });
      }

      const firebaseUrl = `https://club-registration-b85c3-default-rtdb.asia-southeast1.firebasedatabase.app/payments/${pin}.json`;

      await fetch(firebaseUrl, {
        method: "PUT",
        body: JSON.stringify({ paid: true }),
        headers: { "Content-Type": "application/json" }
      });

      return new Response("PIN stored successfully", { status: 200 });
    }

    return new Response("Invalid Event", { status: 400 });
  } catch (error) {
    return new Response("Error processing request", { status: 500 });
  }
}
