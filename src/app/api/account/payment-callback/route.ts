
// Handle both GET and POST requests
async function handleCallback(request: Request) {
  const url = new URL(request.url);
  const transId = url.searchParams.get("trans_id");
  const idGet = url.searchParams.get("id_get");

  // Log the payment details
  console.log("Payment callback received:", {
    method: request.method,
    transId,
    idGet,
    timestamp: new Date().toISOString(),
  });

  // Redirect to account page with verification parameters
  return new Response(null, {
    status: 303, // Force redirect as GET
    headers: {
      Location: `/account?verify=true&trans_id=${transId}&id_get=${idGet}`,
    },
  });
}

export const GET = handleCallback;
export const POST = handleCallback;
