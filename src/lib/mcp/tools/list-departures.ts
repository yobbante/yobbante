import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

export default defineTool({
  name: "list_upcoming_departures",
  title: "List upcoming Yobbanté departures",
  description:
    "List upcoming scheduled shipment departures on the Yobbanté network (route, date, capacity).",
  inputSchema: {
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .default(10)
      .describe("Maximum number of departures to return."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }) => {
    const url = process.env.SUPABASE_URL;
    if (!url) {
      return { content: [{ type: "text", text: "Backend not configured." }], isError: true };
    }
    const res = await fetch(`${url}/functions/v1/list-departures`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ limit }),
    });
    if (!res.ok) {
      return {
        content: [{ type: "text", text: `Departures unavailable (${res.status}).` }],
        isError: true,
      };
    }
    const data = await res.json();
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { departures: data },
    };
  },
});
