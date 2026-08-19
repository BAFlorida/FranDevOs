import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";

import {
  deriveTier,
  normalizePlace,
  searchPlaces,
  isGooglePlacesConfigured,
  GooglePlacesNotConfiguredError,
  GooglePlacesRequestError,
  type RawPlace,
} from "./googlePlaces";

// Pure-function tests for the Places seam: normalization, tier derivation, and
// the fetch contract (mocked — no network, no DB).

const FULL_PLACE: RawPlace = {
  id: "ChIJabc123",
  displayName: { text: "Lone Star Cleaning Co" },
  formattedAddress: "123 Main St, Dallas, TX 75201",
  location: { latitude: 32.7767, longitude: -96.797 },
  primaryTypeDisplayName: { text: "Commercial Cleaning Service" },
  types: ["cleaning_service", "point_of_interest"],
  rating: 4.8,
  userRatingCount: 120,
  businessStatus: "OPERATIONAL",
  websiteUri: "https://lonestarcleaning.example",
  nationalPhoneNumber: "(214) 555-0100",
};

describe("deriveTier", () => {
  it("marks highly rated, well-reviewed businesses Tier 1", () => {
    assert.equal(deriveTier(4.5, 50), "Tier 1");
    assert.equal(deriveTier(4.9, 500), "Tier 1");
  });

  it("requires review volume for Tier 1", () => {
    assert.equal(deriveTier(5.0, 3), "Tier 2");
    assert.equal(deriveTier(5.0, null), "Tier 2");
  });

  it("marks decent ratings Tier 2 and the rest Tier 3", () => {
    assert.equal(deriveTier(3.5, 10), "Tier 2");
    assert.equal(deriveTier(3.4, 400), "Tier 3");
    assert.equal(deriveTier(null, null), "Tier 3");
    assert.equal(deriveTier(undefined, undefined), "Tier 3");
  });
});

describe("normalizePlace", () => {
  it("maps a full Places result onto the lead shape", () => {
    const place = normalizePlace(FULL_PLACE);
    assert.ok(place);
    assert.equal(place.placeId, "ChIJabc123");
    assert.equal(place.name, "Lone Star Cleaning Co");
    assert.equal(place.category, "Commercial Cleaning Service");
    assert.equal(place.address, "123 Main St, Dallas, TX 75201");
    assert.equal(place.phone, "(214) 555-0100");
    assert.equal(place.website, "https://lonestarcleaning.example");
    assert.equal(place.latitude, 32.7767);
    assert.equal(place.longitude, -96.797);
    assert.equal(place.rating, 4.8);
    assert.equal(place.ratingCount, 120);
    assert.equal(place.businessStatus, "OPERATIONAL");
    assert.equal(place.suggestedTier, "Tier 1");
    assert.deepEqual(place.rawPayload, FULL_PLACE);
  });

  it("falls back to the first raw type when no display category exists", () => {
    const place = normalizePlace({ ...FULL_PLACE, primaryTypeDisplayName: undefined });
    assert.ok(place);
    assert.equal(place.category, "cleaning_service");
  });

  it("nulls optional fields that are absent", () => {
    const place = normalizePlace({
      id: "x",
      displayName: { text: "Bare Minimum LLC" },
      location: { latitude: 1, longitude: 2 },
    });
    assert.ok(place);
    assert.equal(place.category, null);
    assert.equal(place.address, null);
    assert.equal(place.phone, null);
    assert.equal(place.website, null);
    assert.equal(place.rating, null);
    assert.equal(place.ratingCount, null);
    assert.equal(place.businessStatus, null);
    assert.equal(place.suggestedTier, "Tier 3");
  });

  it("rejects listings missing identity or coordinates", () => {
    assert.equal(normalizePlace({ ...FULL_PLACE, id: undefined }), null);
    assert.equal(normalizePlace({ ...FULL_PLACE, displayName: undefined }), null);
    assert.equal(normalizePlace({ ...FULL_PLACE, location: undefined }), null);
    assert.equal(
      normalizePlace({ ...FULL_PLACE, location: { latitude: 1 } }),
      null,
    );
  });
});

describe("searchPlaces", () => {
  const originalKey = process.env.GOOGLE_MAPS_API_KEY;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    delete process.env.GOOGLE_MAPS_API_KEY;
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env.GOOGLE_MAPS_API_KEY;
    else process.env.GOOGLE_MAPS_API_KEY = originalKey;
    globalThis.fetch = originalFetch;
    mock.restoreAll();
  });

  it("reports unconfigured when the key is missing", async () => {
    assert.equal(isGooglePlacesConfigured(), false);
    await assert.rejects(
      searchPlaces({ query: "coffee in Dallas" }),
      GooglePlacesNotConfiguredError,
    );
  });

  it("sends the text query with key + field mask and normalizes the response", async () => {
    process.env.GOOGLE_MAPS_API_KEY = "test-key";
    assert.equal(isGooglePlacesConfigured(), true);

    const calls: { url: string; init: RequestInit }[] = [];
    globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
      calls.push({ url: String(url), init: init! });
      return new Response(
        JSON.stringify({
          places: [FULL_PLACE, { id: "broken-no-location" }],
          nextPageToken: "tok-2",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as typeof fetch;

    const result = await searchPlaces({ query: "cleaning companies in Dallas, TX" });

    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.url, "https://places.googleapis.com/v1/places:searchText");
    const headers = calls[0]!.init.headers as Record<string, string>;
    assert.equal(headers["X-Goog-Api-Key"], "test-key");
    assert.match(headers["X-Goog-FieldMask"]!, /places\.id/);
    const body = JSON.parse(String(calls[0]!.init.body));
    assert.equal(body.textQuery, "cleaning companies in Dallas, TX");
    assert.equal(body.pageSize, 20);
    assert.equal("pageToken" in body, false);

    // The listing without coordinates is dropped, not returned half-empty.
    assert.equal(result.places.length, 1);
    assert.equal(result.places[0]!.placeId, "ChIJabc123");
    assert.equal(result.nextPageToken, "tok-2");
  });

  it("passes the page token through when provided", async () => {
    process.env.GOOGLE_MAPS_API_KEY = "test-key";
    let sentBody: Record<string, unknown> = {};
    globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
      sentBody = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ places: [] }), { status: 200 });
    }) as typeof fetch;

    const result = await searchPlaces({ query: "gyms in Austin", pageToken: "tok-9" });
    assert.equal(sentBody.pageToken, "tok-9");
    assert.deepEqual(result, { places: [], nextPageToken: null });
  });

  it("surfaces Google API errors with status + message", async () => {
    process.env.GOOGLE_MAPS_API_KEY = "bad-key";
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({ error: { message: "API key not valid." } }),
        { status: 403 },
      )) as typeof fetch;

    await assert.rejects(
      searchPlaces({ query: "anything" }),
      (err: unknown) =>
        err instanceof GooglePlacesRequestError &&
        err.status === 403 &&
        err.message === "API key not valid.",
    );
  });
});
