import {
  BuiltInAgent,
  CopilotKitIntelligence,
  CopilotRuntime,
  createCopilotRuntimeHandler,
} from "@copilotkit/runtime/v2";

const intelligenceApiKey = process.env.CPK_INTELLIGENCE_API_KEY;
const learningContainerId = process.env.CPK_INTELLIGENCE_LEARNING_CONTAINER_ID;

const intelligence = intelligenceApiKey
  ? new CopilotKitIntelligence({
      apiKey: intelligenceApiKey,
      ...(learningContainerId
        ? {
            getLearningContainerId: ({ agentId }) =>
              agentId === "default" ? learningContainerId : undefined,
          }
        : {}),
    })
  : undefined;

function createAssistantAgent() {
  return new BuiltInAgent({
    model: process.env.COPILOTKIT_MODEL || "openai/gpt-4o-mini",
    prompt: [
      "You are PocketKirana's grocery planning assistant in a local feature demo.",
      "This demo is not connected to PocketKirana's live catalog, prices, inventory, delivery estimates, or checkout.",
      "Never claim that example products are in stock or that any price or delivery time is real.",
      "Use show_grocery_idea to present an illustrative grocery or recipe idea as a card.",
      "Use read_draft_cart when you need to inspect the user's shared draft list.",
      "When the user asks to add items to the draft list, call request_cart_addition and wait for the user's approval.",
      "Only describe an item as added after the user approves it. Never place an order.",
    ].join("\n\n"),
    ...(intelligence && learningContainerId
      ? {
          learnedSkills: {
            client: intelligence,
            containerId: learningContainerId,
          },
        }
      : {}),
  });
}

function localDeveloper(request: Request) {
  const hostname = new URL(request.url).hostname.replace(/^\[|\]$/g, "");
  const isLoopback =
    hostname === "localhost" ||
    hostname === "::1" ||
    hostname.startsWith("127.");

  if (process.env.NODE_ENV !== "production" && isLoopback) {
    return { id: "local-pocketkirana-developer", name: "Local developer" };
  }

  return null;
}

function trustedUser(request: Request) {
  // PocketKirana middleware removes client-supplied x-pk-* headers, then sets
  // x-pk-uid only after verifying the app session in production.
  const userId = request.headers.get("x-pk-uid");
  if (userId) {
    return { id: userId, name: request.headers.get("x-pk-role") || "PocketKirana user" };
  }

  return localDeveloper(request);
}

const runtime = intelligence
  ? new CopilotRuntime({
      // Give each run its own BuiltInAgent instance; the SDK agent instance is
      // single-run at a time, while the Runtime may handle concurrent requests.
      agents: () => ({ default: createAssistantAgent() }),
      intelligence,
      identifyUser: async (request: Request) => {
        const user = trustedUser(request);
        if (!user) throw new Error("A verified PocketKirana session is required.");
        return user;
      },
    })
  : new CopilotRuntime({ agents: () => ({ default: createAssistantAgent() }) });

const handler = createCopilotRuntimeHandler({
  runtime,
  basePath: "/api/copilotkit",
  hooks: {
    onRequest: ({ request }: { request: Request }) => {
      if (!trustedUser(request)) {
        throw new Response("A verified PocketKirana session is required.", { status: 401 });
      }

      // These inspector endpoints read by thread ID without applying user
      // ownership filters. Keep them closed in production until the app adds
      // explicit per-thread ownership checks.
      if (process.env.NODE_ENV === "production") {
        const path = new URL(request.url).pathname;
        const unscopedThreadRead = /\/threads\/[^/]+\/(events|state)(?:\/|$)/.test(path);
        const unscopedStop = /\/agent\/[^/]+\/stop\/[^/]+(?:\/|$)/.test(path);
        if (unscopedThreadRead || unscopedStop) {
          throw new Response("This runtime operation is disabled until thread ownership checks are configured.", {
            status: 403,
          });
        }
      }
    },
  },
});

export const GET = handler;
export const POST = handler;
export const PATCH = handler;
export const DELETE = handler;
