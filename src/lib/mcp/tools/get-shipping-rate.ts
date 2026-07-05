import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

export default defineTool({
  name: "get_shipping_rate",
  title: "Estimate a Yobbanté shipping rate",
  description:
    "Estimate shipping cost and ETA for a parcel to a given destination country/city, based on weight in kg.",
  inputSchema: {
    destination_country: z
      .string()
      .trim()
      .min(2)
      .describe("Destination country name or ISO code (e.g. 'France', 'FR')."),
    destination_city: z.string().trim().optional().describe("Destination city (optional)."),
    weight_kg: z.number().positive().describe("Parcel weight in kilograms."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ destination_country, destination_city, weight_kg }) => {
    const url = process.env.SUPABASE_URL;
    if (!url) {
      return { content: [{ type: "text", text: "Backend not configured." }], isError: true };
    }
    const res = await fetch(`${url}/functions/v1/get-shipping-rates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ destination_country, destination_city, weight_kg }),
    });
    if (!res.ok) {
      return {
        content: [{ type: "text", text: `Rate estimate unavailable (${res.status}).` }],
        isError: true,
      };
    }
    const data = await res.json();
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: data,
    };
  },
});
