import { defineTool } from "@lovable.dev/mcp-js";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export default defineTool({
  name: "track_dossier",
  title: "Track a Yobbanté shipment",
  description:
    "Look up the current status and public timeline of a Yobbanté shipment by its tracking ID (e.g. 'GDBR62').",
  inputSchema: {
    tracking_id: z
      .string()
      .trim()
      .min(3)
      .describe("Public tracking ID of the dossier / shipment."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ tracking_id }) => {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;
    if (!url || !key) {
      return { content: [{ type: "text", text: "Backend not configured." }], isError: true };
    }
    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase.rpc("lookup_dossier_public", {
      _tracking_id: tracking_id.toUpperCase(),
    });
    if (error) {
      return { content: [{ type: "text", text: `Lookup failed: ${error.message}` }], isError: true };
    }
    if (!data) {
      return { content: [{ type: "text", text: `No shipment found for tracking ID ${tracking_id}.` }] };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { dossier: data },
    };
  },
});
