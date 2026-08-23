# Evidence-first provider contract

## Google Places API (New)

Sources retrieved 2026-08-23:

- https://developers.google.com/maps/documentation/places/web-service/text-search
- https://developers.google.com/maps/documentation/places/web-service/place-details
- https://developers.google.com/maps/documentation/places/web-service/choose-fields

Google’s official documentation states that Text Search (New) uses `POST https://places.googleapis.com/v1/places:searchText` with `textQuery` and a required `X-Goog-FieldMask`; Place Details (New) uses `GET https://places.googleapis.com/v1/places/{PLACE_ID}` and also requires a field mask. The API returns structured `Place` objects, including stable place IDs, display names, formatted addresses, business status, phone fields, website URI, Google Maps URI, ratings, and user-rating counts when those fields are requested. Google also states that field masks reduce response size, latency, and unnecessary billing, and that Text Search results are not guaranteed to be identical for identical requests.

Implementation implication: the backend must use a server-side `GOOGLE_PLACES_API_KEY`, request a narrowly scoped field mask, retain the place ID and Google Maps URI as provenance, map only fields actually returned by the provider, and leave absent fields as explicit missing markers. The backend must not ask an LLM to invent or infer place identities or contact fields. If the Places API key is absent or the provider fails, lead discovery returns a structured `503` rather than synthetic records.

Google Places data is provider evidence, not an absolute guarantee of current real-world truth. The UI must show the provider and retrieval timestamp and avoid claims stronger than the returned `businessStatus` and field values. Any usage must follow Google Maps Platform terms and required attribution/presentation policies.
