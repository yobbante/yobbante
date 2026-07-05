import { defineMcp } from "@lovable.dev/mcp-js";
import trackDossier from "./tools/track-dossier";
import listDepartures from "./tools/list-departures";
import getShippingRate from "./tools/get-shipping-rate";

export default defineMcp({
  name: "yobbante-mcp",
  title: "Yobbanté",
  version: "0.1.0",
  instructions:
    "Yobbanté is a logistics orchestration platform (shipping between Europe/Africa and worldwide). " +
    "Use `track_dossier` to look up a shipment by its public tracking ID, " +
    "`list_upcoming_departures` to see scheduled departures on the network, " +
    "and `get_shipping_rate` to estimate cost and ETA for a parcel.",
  tools: [trackDossier, listDepartures, getShippingRate],
});
